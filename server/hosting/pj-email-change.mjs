import { randomBytes, randomUUID } from 'node:crypto';
import { digest } from './pj-accounts.mjs';

const lifetime = 30 * 60_000;
const lookup =
  'SELECT * FROM pj_email_changes WHERE account_id = ? AND expires_at > ?';

export function createPjEmailChanges(db, accounts, send, origin) {
  function pending(id) {
    const row = db.prepare(lookup).get(id, Date.now());
    if (!row) return null;
    return {
      mode: row.mode,
      expiresAt: row.expires_at,
      ...(row.mode === 'self' && { email: row.target_email }),
      oldConfirmed: row.old_verified_at !== null,
      newConfirmed: row.new_verified_at !== null,
    };
  }

  async function start(id, currentEmail, next, mode) {
    const now = Date.now();
    const requestId = randomUUID();
    const oldSecret =
      mode === 'self' ? randomBytes(32).toString('base64url') : null;
    const newSecret = randomBytes(32).toString('base64url');
    const ready = accounts.transaction(() => {
      const owner = db
        .prepare(
          "SELECT email FROM pj_accounts WHERE id = ? AND status = 'approved'",
        )
        .get(id);
      if (owner?.email !== currentEmail || next === currentEmail) return false;
      const previous = db.prepare(lookup).get(id, now);
      if (
        previous &&
        ((mode === 'self' && previous.mode === 'recovery') ||
          (previous.mode === mode && previous.created_at > now - 60_000))
      )
        return false;
      db.prepare('DELETE FROM pj_email_changes WHERE expires_at <= ?').run(now);
      if (
        accounts.find(next) ||
        db
          .prepare(
            'SELECT 1 FROM pj_email_changes WHERE target_email = ? AND account_id != ?',
          )
          .get(next, id)
      )
        return false;
      db.prepare(
        `
        INSERT INTO pj_email_changes
          (account_id, request_id, target_email, mode, old_digest, new_digest, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(account_id) DO UPDATE SET request_id = excluded.request_id,
          target_email = excluded.target_email, mode = excluded.mode,
          old_digest = excluded.old_digest, new_digest = excluded.new_digest,
          old_verified_at = NULL, new_verified_at = NULL,
          created_at = excluded.created_at, expires_at = excluded.expires_at
      `,
      ).run(
        id,
        requestId,
        next,
        mode,
        oldSecret ? digest(oldSecret) : null,
        digest(newSecret),
        now,
        now + lifetime,
      );
      if (mode === 'recovery') {
        accounts.revokeAccess(id);
        accounts.recordEvent(id, 'email-recovery-requested', now);
      }
      return true;
    });
    if (!ready) return false;

    const link = (secret) => {
      const url = new URL('/pj', origin);
      url.hash = 'zmena-emailu=' + secret;
      return url.href;
    };
    const notice = oldSecret
      ? send(
          currentEmail,
          'Potvrzení změny e-mailu PJ',
          `Potvrď žádost na původní adrese na ${link(oldSecret)}\n\nOdkaz platí 30 minut.`,
        )
      : send(
          currentEmail,
          'Správce zahájil obnovu účtu PJ',
          'Správce zahájil změnu přihlašovacího e-mailu. Pokud jsi o obnovu nežádal, kontaktuj správce instance.',
        );
    const delivery = await Promise.allSettled([
      send(
        next,
        mode === 'recovery' ? 'Obnova účtu PJ' : 'Ověření nového e-mailu PJ',
        `Potvrď novou adresu na ${link(newSecret)}\n\nOdkaz platí 30 minut.`,
      ),
      notice,
    ]);
    if (
      delivery[0].status === 'rejected' ||
      (oldSecret && delivery[1].status === 'rejected')
    ) {
      db.prepare(
        'DELETE FROM pj_email_changes WHERE account_id = ? AND request_id = ?',
      ).run(id, requestId);
      throw new Error(
        'Potvrzovací poštu se nepodařilo odeslat. Zkus to později.',
      );
    }
    if (mode === 'recovery' && delivery[1].status === 'rejected')
      console.warn('pj_email_recovery_notice_failed');
    return true;
  }

  function confirm(secret) {
    if (typeof secret !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(secret))
      return null;
    return accounts.transaction(() => {
      const hash = digest(secret);
      const now = Date.now();
      const row = db
        .prepare(
          `
        SELECT c.* FROM pj_email_changes c JOIN pj_accounts a ON a.id = c.account_id
        WHERE a.status = 'approved' AND c.expires_at > ? AND (c.old_digest = ? OR c.new_digest = ?)
      `,
        )
        .get(now, hash, hash);
      if (!row) return null;
      const old = row.old_digest === hash;
      db.prepare(
        old
          ? 'UPDATE pj_email_changes SET old_digest = NULL, old_verified_at = ? WHERE account_id = ?'
          : 'UPDATE pj_email_changes SET new_digest = NULL, new_verified_at = ? WHERE account_id = ?',
      ).run(now, row.account_id);
      const oldConfirmed =
        old || row.old_verified_at !== null || row.mode === 'recovery';
      const newConfirmed = !old || row.new_verified_at !== null;
      if (!oldConfirmed || !newConfirmed) return { completed: false };
      const updated = db
        .prepare(
          `
        UPDATE pj_accounts SET email = ?, verified_at = ?
        WHERE id = ? AND NOT EXISTS (SELECT 1 FROM pj_accounts WHERE email = ?)
      `,
        )
        .run(row.target_email, now, row.account_id, row.target_email);
      db.prepare('DELETE FROM pj_email_changes WHERE account_id = ?').run(
        row.account_id,
      );
      if (!updated.changes) return null;
      accounts.revokeAccess(row.account_id);
      accounts.recordEvent(
        row.account_id,
        row.mode === 'recovery' ? 'email-recovered' : 'email-changed',
        now,
      );
      return { completed: true };
    });
  }

  function cancel(id, admin = false) {
    return accounts.transaction(() => {
      const changed = db
        .prepare(
          `
        DELETE FROM pj_email_changes WHERE account_id = ? AND (? = 1 OR mode = 'self')
          AND expires_at > ?
      `,
        )
        .run(id, admin ? 1 : 0, Date.now());
      if (changed.changes && admin)
        accounts.recordEvent(id, 'email-change-cancelled');
      return Boolean(changed.changes);
    });
  }

  return { start, pending, confirm, cancel };
}
