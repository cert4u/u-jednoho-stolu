import { randomUUID } from 'node:crypto';
import { playDate, playPeriod } from '../play-calendar.mjs';
import { equal } from '../http.mjs';
import {
  defaultPjLimits,
  pjAdmissionError,
  pjAdmissionSql,
  pjAdmissionValues,
  pjUsageSql,
} from '../pj-quota.mjs';
import { roomCapacity } from '../room-capacity.mjs';

const day = 86_400_000;
const ownerColumns = `id, owner_id AS ownerId, json_extract(data, '$.title') AS title,
  created_at AS createdAt, last_activity_at AS lastActivityAt, archived_at AS archivedAt,
  length(CAST(data AS BLOB)) AS bytes,
  (SELECT completed_on FROM pj_completed_rooms c
    WHERE c.account_id = rooms.owner_id AND c.room_id = rooms.id) AS completedOn`;

export function createPjTables(
  db,
  { inactiveDays, archiveDays, cleanup, deletions },
) {
  const inactiveTime = inactiveDays * day;
  const archiveTime = archiveDays * day;

  function dates(room) {
    return {
      ...room,
      archiveAt:
        room.archivedAt === null && room.ownerId !== null
          ? room.lastActivityAt + inactiveTime
          : null,
      deleteAt: room.archivedAt === null ? null : room.archivedAt + archiveTime,
    };
  }

  function list(owner) {
    return db
      .prepare(
        `SELECT ${ownerColumns}, invites_paused AS invitesPaused FROM rooms WHERE owner_id = ?
      ORDER BY archived_at IS NOT NULL, last_activity_at DESC, id`,
      )
      .all(owner)
      .map(dates);
  }

  function session(owner, id, backup = false) {
    const room = db
      .prepare(
        'SELECT data, archived_at FROM rooms WHERE id = ? AND owner_id = ?',
      )
      .get(id, owner);
    if (!room || (!backup && room.archived_at !== null)) return null;
    const pj = JSON.parse(room.data).members.find(
      (member) => member.role === 'pj' && !member.archived,
    );
    return pj?.token ? { room: id, token: pj.token } : null;
  }

  function quota(owner) {
    const defaults = defaultPjLimits(process.env);
    return db.prepare(pjUsageSql).get(defaults.tables, defaults.bytes, owner);
  }

  function claim(owner, id, token) {
    const denied =
      'Stůl nelze přiřadit. Otevři ho v prohlížeči jako PJ a ověř, že ještě nemá vlastníka.';
    const room = db
      .prepare(
        'SELECT data, version, owner_id FROM rooms WHERE id = ? AND archived_at IS NULL',
      )
      .get(id);
    if (!room || room.owner_id !== null) return denied;
    const pj = JSON.parse(room.data).members.find(
      (member) => member.role === 'pj' && !member.archived,
    );
    if (!pj?.token || !equal(pj.token, token)) return denied;
    const bytes = Buffer.byteLength(room.data);
    const moved = db
      .prepare(
        `
      UPDATE rooms SET owner_id = ?, last_activity_at = ?, version = version + 1
      WHERE id = ? AND version = ? AND owner_id IS NULL AND archived_at IS NULL
        AND ${pjAdmissionSql}
    `,
      )
      .run(
        owner,
        Date.now(),
        id,
        room.version,
        ...pjAdmissionValues(owner, defaultPjLimits(process.env), bytes),
      ).changes;
    return moved ? null : pjAdmissionError(quota(owner), bytes) || denied;
  }

  function purge(select, values) {
    if (!deletions) return 0;
    db.exec('BEGIN IMMEDIATE');
    try {
      const expired = db.prepare(select).all(...values);
      // The separate ledger is durable before deleting from the restorable database.
      deletions.record(expired);
      const remove = db.prepare('DELETE FROM rooms WHERE id = ?');
      for (const room of expired) remove.run(room.id);
      db.exec('COMMIT');
      return expired.length;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  function change(owner, id, action, title) {
    const now = Date.now();
    if (action === 'delete')
      return purge(
        `SELECT id FROM rooms WHERE id = ? AND owner_id = ? AND archived_at IS NOT NULL
        AND coalesce(nullif(json_extract(data, '$.title'), ''), id) = ?`,
        [id, owner, title],
      );
    if (action === 'archive')
      return db
        .prepare(
          `
        UPDATE rooms SET archived_at = ?, version = version + 1
        WHERE id = ? AND owner_id = ? AND archived_at IS NULL AND coalesce(nullif(json_extract(data, '$.title'), ''), id) = ?
      `,
        )
        .run(now, id, owner, title).changes;
    const status =
      action === 'restore' ? 'archived_at IS NOT NULL' : 'archived_at IS NULL';
    return db
      .prepare(
        `
      UPDATE rooms SET archived_at = NULL, last_activity_at = ?, warned_for_activity_at = NULL, version = version + 1
      WHERE id = ? AND owner_id = ? AND ${status}
    `,
      )
      .run(now, id, owner).changes;
  }

  function invitation(owner, id, operation) {
    const matching = 'WHERE id = ? AND owner_id = ? AND archived_at IS NULL';
    const projection = 'invite_token AS token, invites_paused AS paused';
    if (operation === 'read')
      return db
        .prepare(`SELECT ${projection} FROM rooms ${matching}`)
        .get(id, owner);
    // Bumping the room revision forces an in-flight join to recheck the invitation.
    return db
      .prepare(
        `
      UPDATE rooms SET
        invite_token = CASE
          WHEN ? = 'rotate' OR (? = 'resume' AND invite_token IS NULL) THEN ?
          ELSE invite_token END,
        invites_paused = CASE WHEN ? = 'pause' THEN 1 WHEN ? = 'resume' THEN 0 ELSE invites_paused END,
        version = version + 1
      ${matching} RETURNING ${projection}
    `,
      )
      .get(operation, operation, randomUUID(), operation, operation, id, owner);
  }

  function setCompleted(owner, id, completed) {
    const owned = db.prepare(
      'SELECT 1 FROM rooms WHERE id = ? AND owner_id = ?',
    );
    if (completed) {
      db.prepare(
        `
        INSERT INTO pj_completed_rooms (account_id, room_id, completed_on)
        SELECT owner_id, id, ? FROM rooms WHERE id = ? AND owner_id = ?
        ON CONFLICT(account_id, room_id) DO NOTHING
      `,
      ).run(playDate(Date.now()), id, owner);
    } else {
      db.prepare(
        `
        DELETE FROM pj_completed_rooms WHERE account_id = ? AND room_id = ?
        AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND owner_id = ?)
      `,
      ).run(owner, id, id, owner);
    }
    return Boolean(owned.get(id, owner));
  }

  function overview(days = null, now = Date.now()) {
    const period = playPeriod(now, days);
    const defaults = defaultPjLimits(process.env);
    const counts = db
      .prepare(
        `
      SELECT count(*) AS total, count(*) FILTER (WHERE archived_at IS NULL) AS active,
        count(*) FILTER (WHERE archived_at IS NOT NULL) AS archived,
        coalesce(sum(length(CAST(data AS BLOB))), 0) AS bytes,
        count(*) FILTER (WHERE owner_id IS NULL) AS legacy,
        count(*) FILTER (WHERE archived_at IS NULL AND last_activity_at >= ?) AS recent7,
        count(*) FILTER (WHERE archived_at IS NULL AND last_activity_at >= ?) AS recent30,
        count(*) FILTER (WHERE archived_at IS NULL AND last_activity_at >= ?) AS recent90,
        count(*) FILTER (WHERE archived_at IS NULL AND last_activity_at IS NULL) AS unknownActivity,
        count(*) FILTER (WHERE created_at >= ?) AS created30
      FROM rooms
    `,
      )
      .get(now - 7 * day, now - 30 * day, now - 90 * day, now - 30 * day);
    const history = db
      .prepare(
        `
      SELECT account_id AS ownerId, count(DISTINCT room_id) AS playedRooms,
        count(DISTINCT played_on) AS activeDays, count(*) AS totalRoomDays,
        min(played_on) AS firstPlayedOn, max(played_on) AS lastPlayedOn
      FROM pj_play_days WHERE played_on BETWEEN ? AND ? GROUP BY account_id
    `,
      )
      .all(period.from ?? '', period.through);
    const playByOwner = new Map(
      history.map(({ ownerId, ...stats }) => [ownerId, stats]),
    );
    const completedByOwner = new Map(
      db
        .prepare(
          `
        SELECT account_id AS ownerId, count(*) AS count FROM pj_completed_rooms
        WHERE completed_on BETWEEN ? AND ? GROUP BY account_id
      `,
        )
        .all(period.from ?? '', period.through)
        .map((row) => [row.ownerId, row.count]),
    );
    const accounts = db
      .prepare(
        `
      SELECT a.id, a.email, a.name, a.status, a.note, a.created_at AS createdAt, a.approved_at AS approvedAt, a.table_limit AS tableOverride, a.bytes_limit AS byteOverride,
        (SELECT mode FROM pj_email_changes c WHERE c.account_id = a.id AND c.expires_at > ?) AS emailChangeMode,
        count(r.id) FILTER (WHERE r.archived_at IS NULL) AS active,
        count(r.id) FILTER (WHERE r.archived_at IS NOT NULL) AS archived,
        max(r.last_activity_at) AS lastActivityAt,
        count(r.id) FILTER (WHERE r.archived_at IS NULL AND r.last_activity_at >= ?) AS recent30,
        coalesce(sum(length(CAST(r.data AS BLOB))), 0) AS bytes,
        min(r.last_activity_at + ?) FILTER (WHERE r.archived_at IS NULL) AS nextArchiveAt
      FROM pj_accounts a LEFT JOIN rooms r ON r.owner_id = a.id
      WHERE a.verified_at IS NOT NULL OR a.status = 'invited'
      GROUP BY a.id ORDER BY (a.status = 'requested') DESC, a.created_at DESC
    `,
      )
      .all(now, now - 30 * day, inactiveTime)
      .map(({ tableOverride, byteOverride, ...account }) => {
        const play = playByOwner.get(account.id) ?? {
          playedRooms: 0,
          activeDays: 0,
          totalRoomDays: 0,
          firstPlayedOn: null,
          lastPlayedOn: null,
        };
        return {
          ...account,
          quota: {
            tableOverride,
            byteOverride,
            tableLimit: tableOverride ?? defaults.tables,
            byteLimit: byteOverride ?? defaults.bytes,
          },
          play: {
            ...play,
            completedRooms: completedByOwner.get(account.id) ?? 0,
            averageDays: play.playedRooms
              ? play.totalRoomDays / play.playedRooms
              : null,
          },
        };
      });
    const rooms = db
      .prepare(
        `SELECT ${ownerColumns} FROM rooms ORDER BY last_activity_at DESC, id`,
      )
      .all()
      .map(dates);
    const candidates = rooms.filter((room) =>
      room.deleteAt !== null
        ? room.deleteAt <= now
        : room.archiveAt !== null && room.archiveAt <= now,
    );
    const events = db
      .prepare(
        `
      SELECT account_id AS accountId, action, happened_at AS happenedAt FROM pj_admin_events
      ORDER BY id DESC LIMIT 50
    `,
      )
      .all();
    return {
      counts,
      capacity: roomCapacity(process.env),
      sampledAt: now,
      playPeriod: period,
      rooms,
      accounts,
      candidates,
      events,
      cleanup,
      inactiveDays,
      archiveDays,
    };
  }

  function detail(id, days = null, now = Date.now()) {
    const period = playPeriod(now, days);
    const rooms = db
      .prepare(
        `
      SELECT ${ownerColumns},
        (SELECT count(*) FROM json_each(data, '$.members') m
          WHERE json_extract(m.value, '$.role') = 'player'
            AND NOT coalesce(json_extract(m.value, '$.archived'), 0)) AS players,
        (SELECT count(*) FROM json_each(data, '$.members') m
          WHERE json_extract(m.value, '$.role') = 'player'
            AND coalesce(json_extract(m.value, '$.archived'), 0)) AS archivedPlayers,
        coalesce(history.playDays, 0) AS playDays,
        history.firstPlayedOn, history.lastPlayedOn
      FROM rooms LEFT JOIN (
        SELECT room_id, count(*) AS playDays,
          min(played_on) AS firstPlayedOn, max(played_on) AS lastPlayedOn
        FROM pj_play_days WHERE account_id = ? AND played_on BETWEEN ? AND ?
        GROUP BY room_id
      ) history ON history.room_id = rooms.id
      WHERE owner_id = ? ORDER BY archived_at IS NOT NULL, last_activity_at DESC, id
    `,
      )
      .all(id, period.from ?? '', period.through, id)
      .map(dates);
    return { rooms };
  }

  async function sweep(now, send, allowWrites) {
    if (!cleanup || !allowWrites()) return;
    const warnings = db
      .prepare(
        `
      SELECT r.id, r.last_activity_at, a.email FROM rooms r JOIN pj_accounts a ON a.id = r.owner_id
      WHERE r.archived_at IS NULL AND a.status = 'approved'
        AND r.last_activity_at <= ? AND r.last_activity_at > ?
        AND r.warned_for_activity_at IS NOT r.last_activity_at LIMIT 25
    `,
      )
      .all(
        now - inactiveTime + Math.min(7 * day, inactiveTime),
        now - inactiveTime,
      );
    for (const room of warnings) {
      if (!allowWrites()) return;
      try {
        await send(
          room.email,
          'Blíží se archivace stolu · U jednoho stolu',
          `Stůl ${room.id} se blíží k archivaci. V přehledu Moje stoly můžeš jeho platnost prodloužit nebo stáhnout zálohu.`,
        );
        if (allowWrites())
          db.prepare(
            'UPDATE rooms SET warned_for_activity_at = ? WHERE id = ? AND last_activity_at = ?',
          ).run(room.last_activity_at, room.id, room.last_activity_at);
      } catch {
        console.warn('pj_archive_warning_delivery_failed');
      }
    }
    if (!allowWrites()) return;
    // The eligibility predicate is checked in the write itself, after any game action in flight.
    db.prepare(
      `UPDATE rooms SET archived_at = ?, version = version + 1 WHERE owner_id IS NOT NULL
      AND archived_at IS NULL AND last_activity_at <= ?`,
    ).run(now, now - inactiveTime);
    purge(
      'SELECT id FROM rooms WHERE owner_id IS NOT NULL AND archived_at <= ?',
      [now - archiveTime],
    );
  }

  return {
    list,
    session,
    quota,
    claim,
    change,
    setCompleted,
    invitation,
    overview,
    detail,
    sweep,
  };
}
