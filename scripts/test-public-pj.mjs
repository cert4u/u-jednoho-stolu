import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:tls';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
import { playPeriod } from '../server/play-calendar.mjs';
import {
  openPjDeletions,
  pjDeletionsFilename,
} from '../server/hosting/pj-deletions.mjs';
import { createPjTables } from '../server/hosting/pj-tables.mjs';
import { readZip } from '../server/catalog-zip.mjs';

const dir = mkdtempSync(join(tmpdir(), 'stul-public-pj-'));
const port = 18177;
const base = 'http://127.0.0.1:' + port;
const origin = 'https://stul.example.test';
const password = 'test-admin-password-isolated';
const certificate = join(dir, 'smtp.pem');
const key = join(dir, 'smtp-key.pem');
const mail = [];
let smtp, server, db;

function startSmtp() {
  const generated = spawnSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-days',
      '1',
      '-subj',
      '/CN=127.0.0.1',
      '-addext',
      'subjectAltName=IP:127.0.0.1',
      '-keyout',
      key,
      '-out',
      certificate,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(generated.status, 0, generated.stderr);
  return createServer(
    { key: readFileSync(key), cert: readFileSync(certificate) },
    (socket) => {
      let input = '';
      let recipient = '';
      let message = null;
      const reply = (text) => socket.write(text + '\r\n');
      reply('220 fixture ESMTP');
      socket.setEncoding('utf8');
      socket.on('error', () => {});
      socket.on('data', (chunk) => {
        input += chunk;
        let end;
        while ((end = input.indexOf('\r\n')) >= 0) {
          const line = input.slice(0, end);
          input = input.slice(end + 2);
          if (message !== null) {
            if (line !== '.') message.push(line);
            else {
              mail.push({
                recipient,
                text: message.join('\n').replace(/=\n/g, ''),
              });
              message = null;
              reply('250 queued');
            }
          } else if (line.startsWith('RCPT TO:')) {
            recipient = line.slice(8);
            reply('250 OK');
          } else if (line === 'DATA') {
            message = [];
            reply('354 End data with <CRLF>.<CRLF>');
          } else if (line === 'QUIT') {
            socket.end('221 fixture closing\r\n');
          } else {
            reply('250 fixture');
          }
        }
      });
    },
  );
}

async function request(path, values, { cookie, token, extra } = {}) {
  const response = await fetch(base + path, {
    method: values === undefined ? 'GET' : 'POST',
    headers: {
      ...(values !== undefined && {
        Origin: origin,
        'Content-Type': 'application/json',
      }),
      ...(cookie && { Cookie: cookie }),
      ...(token && { Authorization: 'Bearer ' + token }),
      ...extra,
    },
    ...(values !== undefined && { body: JSON.stringify(values) }),
  });
  assert.match(
    response.headers.get('content-type') || '',
    /application\/json/,
    await response.clone().text(),
  );
  return {
    status: response.status,
    cookie: response.headers.get('set-cookie'),
    data: await response.json(),
  };
}
const post = (action, values = {}, headers) =>
  request('/api/game', { action, ...values }, headers);
const pj = (path, values, headers) =>
  request('/pj/api/' + path, values, headers);
const ok = (r, status = 200) => {
  assert.equal(r.status, status, JSON.stringify(r.data));
  return r.data;
};
async function signinSecret(email, kind = 'prihlaseni') {
  for (let i = 0; i < 80; i++) {
    const index = mail.findIndex(
      (item) =>
        item.recipient.includes(email) && item.text.includes('#' + kind),
    );
    if (index >= 0) {
      const [message] = mail.splice(index, 1);
      return message.text.match(
        new RegExp('#' + kind + '(?:=3D|=)([A-Za-z0-9_-]{43})'),
      )?.[1];
    }
    await delay(50);
  }
  assert.fail('Ověřovací zpráva v testovací poště chybí.');
}
async function confirm(email) {
  const secret = await signinSecret(email);
  assert(secret);
  const r = await pj('confirm', { secret });
  ok(r);
  assert.match(
    r.cookie,
    /HttpOnly; SameSite=Strict; Path=\/; Max-Age=\d+; Secure/,
  );
  assert.equal((await pj('confirm', { secret })).status, 400);
  return { cookie: r.cookie.split(';')[0] };
}

async function startApp(dataDirectory) {
  server = spawn(process.execPath, ['server/start.mjs'], {
    env: {
      ...process.env,
      NODE_EXTRA_CA_CERTS: certificate,
      PORT: String(port),
      STUL_BIND_HOST: '127.0.0.1',
      PUBLIC_ORIGIN: origin,
      STUL_PUBLIC_ACCOUNTS: '1',
      STUL_PJ_CLEANUP: '0',
      STUL_ROOM_LIMIT: '500',
      STUL_PJ_ROOM_LIMIT: '3',
      STUL_PJ_ROOM_BYTES_LIMIT: '4194304',
      STUL_ROOM_CREATE_RATE: '1000',
      STUL_DATA_DIR: dataDirectory,
      STUL_UPDATER_URL: 'off',
      STUL_ADMIN_PASSWORD: password,
      STUL_UPDATER_TOKEN: 'isolated-test-updater-token-32-characters',
      STUL_SMTP_URL: 'smtps://127.0.0.1:' + smtp.address().port,
      STUL_SMTP_FROM: 'stul@example.test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  server.stderr.on('data', (chunk) => {
    logs += chunk;
  });
  let listening = false;
  for (let i = 0; i < 100; i++) {
    assert.equal(server.exitCode, null, logs);
    try {
      if ((await fetch(base + '/healthz')).ok) {
        listening = true;
        break;
      }
    } catch {
      /* Wait for startup. */
    }
    await delay(50);
  }
  assert(listening, logs);
}

async function stopApp() {
  if (server?.exitCode === null && server.pid) {
    server.kill();
    await new Promise((resolve) => server.once('exit', resolve));
  }
}

async function downloadBackup(name, admin) {
  const response = await fetch(
    base + '/admin/api/backup?bundle=1&name=' + encodeURIComponent(name),
    {
      headers: { Cookie: admin.cookie },
    },
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/zip/);
  return readZip(Buffer.from(await response.arrayBuffer()));
}

function unpackBackup(files, directory) {
  mkdirSync(directory);
  assert.deepEqual([...files.keys()].sort(), [
    'game.sqlite',
    pjDeletionsFilename,
  ]);
  for (const [name, data] of files) writeFileSync(join(directory, name), data);
}

try {
  smtp = startSmtp();
  await new Promise((resolve, reject) => {
    smtp.once('error', reject);
    smtp.listen(0, '127.0.0.1', resolve);
  });
  await startApp(dir);
  db = new DatabaseSync(join(dir, 'game.sqlite'));
  db.exec('PRAGMA busy_timeout = 5000');
  const adminSession = await request('/admin/api/login', { password });
  ok(adminSession);
  const admin = { cookie: adminSession.cookie.split(';')[0] };
  assert.equal((await request('/admin/api/pj')).status, 401);
  assert.equal((await post('create')).status, 403);
  assert.equal((await post('restore')).status, 403);
  assert.equal(
    (await post('create', {}, { extra: { 'x-stul-pj-account': 'fake' } }))
      .status,
    403,
  );
  assert.equal(
    (
      await pj(
        'request',
        { email: 'ana@example.test' },
        { extra: { Origin: 'https://wrong.test' } },
      )
    ).status,
    403,
  );
  ok(await pj('request', { email: 'ana@example.test', name: 'Ana' }), 202);
  assert.equal(
    ok(await request('/admin/api/pj', undefined, admin)).accounts.length,
    0,
  );
  const ana = await confirm('ana@example.test');
  const pending = ok(await pj('profile', undefined, ana));
  assert.equal(pending.user.status, 'requested');
  assert.equal((await post('create', {}, ana)).status, 403);
  ok(
    await request(
      '/admin/api/pj',
      { action: 'approve', id: pending.user.id },
      admin,
    ),
  );

  ok(
    await request(
      '/admin/api/pj',
      { action: 'invite', name: 'Borek', email: 'borek@example.test' },
      admin,
    ),
  );
  const borek = await confirm('borek@example.test');
  const table = ok(await post('create', { name: 'Ana' }, ana));
  const room = table.room;
  const owner = { ...ana, token: table.token };
  assert.equal(
    (await request('/api/game?room=' + room, undefined, { token: table.token }))
      .status,
    401,
  );
  assert.equal((await pj('open', { room }, borek)).status, 404);
  assert.equal(
    (await pj('archive', { room, title: table.game.title }, borek)).status,
    409,
  );
  const invitation = (account, room, operation = 'read') =>
    pj('invite', { room, operation }, account);
  const invite = ok(await invitation(ana, room));
  assert(invite.token);
  assert.equal(invite.paused, false);
  assert.equal((await invitation(borek, room, 'rotate')).status, 404);
  assert.equal((await post('join', { room, name: 'Hráč' })).status, 403);
  const player = ok(
    await post('join', { room, name: 'Hráč', invite: invite.token }),
  );
  assert.equal(player.game.managedInvites, true);
  assert(!JSON.stringify(player).includes(invite.token));
  const playerCredentials = { token: player.token };
  assert.equal(
    (await pj('archive', { room, title: table.game.title }, playerCredentials))
      .status,
    403,
  );
  assert.equal(ok(await pj('open', { room }, ana)).token, table.token);

  assert.deepEqual(
    ok(
      await request(
        '/api/game?room=' + room + '&invite=settings',
        undefined,
        owner,
      ),
    ),
    invite,
  );
  assert.equal(
    (
      await request(
        '/api/game?room=' + room + '&invite=settings',
        undefined,
        playerCredentials,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request('/api/game?room=' + room + '&invite=settings', undefined, {
        token: table.token,
      })
    ).status,
    401,
  );
  assert.equal(ok(await invitation(ana, room, 'pause')).paused, true);
  assert.equal(
    (await post('join', { room, name: 'Pozastavený', invite: invite.token }))
      .status,
    403,
  );
  const freshInvite = ok(await invitation(ana, room, 'rotate'));
  assert.notEqual(freshInvite.token, invite.token);
  assert.equal(freshInvite.paused, true);
  assert.equal(
    (
      await post('join', {
        room,
        name: 'Pozastavený',
        invite: freshInvite.token,
      })
    ).status,
    403,
  );
  assert.deepEqual(ok(await invitation(ana, room, 'resume')), {
    token: freshInvite.token,
    paused: false,
  });
  assert.equal(
    (await post('join', { room, name: 'Starý odkaz', invite: invite.token }))
      .status,
    403,
  );
  ok(await request('/api/game?room=' + room, undefined, playerCredentials));

  const activity = () =>
    db
      .prepare('SELECT last_activity_at AS timestamp FROM rooms WHERE id = ?')
      .get(room).timestamp;
  const initial = activity();
  ok(await request('/api/game?room=' + room, undefined, playerCredentials));
  assert.equal(activity(), initial);
  ok(
    await post(
      'map',
      {
        room,
        tool: 'room',
        from: [1, 1],
        to: [3, 3],
        requestId: crypto.randomUUID(),
      },
      owner,
    ),
  );
  assert(activity() > initial);
  const detail = ok(
    await request('/admin/api/pj?pj=' + pending.user.id, undefined, admin),
  );
  assert.equal(detail.rooms[0].lastActivityAt, activity());
  assert.equal(detail.rooms[0].players, 1);
  assert.equal(detail.rooms[0].archivedPlayers, 0);
  assert.equal(detail.rooms[0].playDays, 0);
  assert(!JSON.stringify(detail).includes(player.token));
  const current = ok(await request('/admin/api/pj', undefined, admin));
  assert.equal(current.counts.active, 1);
  assert.equal(current.counts.recent7, 1);
  assert.equal(current.counts.created30, 1);
  assert.equal(current.capacity.tables, 500);
  assert.equal(current.rooms[0].ownerId, pending.user.id);
  assert.equal(
    current.accounts.find((item) => item.id === pending.user.id).recent30,
    1,
  );
  assert.equal(
    current.accounts.find((item) => item.id === pending.user.id).active,
    1,
  );
  assert(
    current.accounts.find((item) => item.id === pending.user.id).bytes > 0,
  );

  const getPlay = async () =>
    ok(await request('/admin/api/pj', undefined, admin)).accounts.find(
      (item) => item.id === pending.user.id,
    ).play;
  assert.equal((await getPlay()).playedRooms, 0);
  ok(
    await post(
      'chat',
      { room, text: 'Příprava PJ', requestId: crypto.randomUUID() },
      owner,
    ),
  );
  assert.equal((await getPlay()).activeDays, 0);
  assert.equal(
    (
      await post(
        'chat',
        { room, text: '', requestId: crypto.randomUUID() },
        playerCredentials,
      )
    ).status,
    400,
  );
  assert.equal((await getPlay()).activeDays, 0);
  const firstMove = {
    room,
    text: 'Jdeme k bráně.',
    requestId: crypto.randomUUID(),
  };
  ok(await post('chat', firstMove, playerCredentials));
  ok(await post('chat', firstMove, playerCredentials));
  ok(
    await post(
      'chat',
      { room, text: 'Otevírám bránu.', requestId: crypto.randomUUID() },
      playerCredentials,
    ),
  );
  assert.equal((await getPlay()).totalRoomDays, 1);
  db.prepare("UPDATE rooms SET last_play_day = '2000-01-01' WHERE id = ?").run(
    room,
  );
  // An older day is staged ahead of current game traffic to verify distinct-day aggregation.
  ok(await post('chat', firstMove, playerCredentials));
  assert.equal(
    db.prepare('SELECT last_play_day FROM rooms WHERE id = ?').get(room)
      .last_play_day,
    '2000-01-01',
  );

  assert.equal(
    (await pj('completion', { room, completed: true }, borek)).status,
    404,
  );
  assert.equal(
    (await pj('completion', { room, completed: true }, playerCredentials))
      .status,
    403,
  );
  assert.equal(
    (await pj('completion', { room, completed: 'true' }, ana)).status,
    400,
  );
  ok(await pj('completion', { room, completed: true }, ana));
  assert.equal((await getPlay()).completedRooms, 1);
  const completedProfile = ok(await pj('profile', undefined, ana));
  assert.match(
    completedProfile.rooms.find((item) => item.id === room).completedOn,
    /^\d{4}-\d{2}-\d{2}$/,
  );
  db.prepare(
    "UPDATE pj_completed_rooms SET completed_on = '2000-01-01' WHERE room_id = ?",
  ).run(room);
  ok(await pj('completion', { room, completed: true }, ana));
  const periodCompleted = ok(
    await request('/admin/api/pj?period=30', undefined, admin),
  );
  assert.equal(
    periodCompleted.accounts.find((item) => item.id === pending.user.id).play
      .completedRooms,
    0,
  );
  ok(await pj('completion', { room, completed: false }, ana));
  assert.equal((await getPlay()).completedRooms, 0);
  ok(await request('/api/game?room=' + room, undefined, playerCredentials));

  const second = ok(await post('create', { name: 'Druhý stůl' }, ana));
  const currentInvite = ok(await invitation(ana, second.room));
  const guest = ok(
    await post('join', {
      room: second.room,
      name: 'Host',
      invite: currentInvite.token,
    }),
  );
  ok(
    await post(
      'chat',
      {
        room: second.room,
        text: 'Hra na druhém stole.',
        requestId: crypto.randomUUID(),
      },
      { token: guest.token },
    ),
  );
  assert.deepEqual(playPeriod(Date.parse('2026-03-29T22:15:00Z'), 30), {
    days: 30,
    from: '2026-03-01',
    through: '2026-03-30',
  });
  ok(await pj('completion', { room: second.room, completed: true }, ana));
  const history = await getPlay();
  assert.equal(history.playedRooms, 2);
  assert.equal(history.completedRooms, 1);
  assert.equal(history.activeDays, 2);
  assert.equal(history.totalRoomDays, 3);
  assert.equal(history.averageDays, 1.5);
  const tableStats = ok(
    await request('/admin/api/pj?pj=' + pending.user.id, undefined, admin),
  ).rooms;
  assert.equal(tableStats.find((item) => item.id === room).playDays, 2);
  assert.equal(tableStats.find((item) => item.id === second.room).playDays, 1);
  ok(await pj('archive', { room: second.room, title: second.game.title }, ana));
  ok(await pj('delete', { room: second.room, title: second.game.title }, ana));
  assert.deepEqual(await getPlay(), history);
  assert.equal(
    (await request('/admin/api/pj?period=120', undefined, admin)).status,
    400,
  );
  db.prepare('UPDATE rooms SET last_play_day = ? WHERE id = ?').run(
    playPeriod(Date.now(), 61).from,
    room,
  );
  const recent = ok(await request('/admin/api/pj?period=30', undefined, admin));
  const lastQuarter = ok(
    await request('/admin/api/pj?period=90', undefined, admin),
  );
  const ownerPlay = (result) =>
    result.accounts.find((item) => item.id === pending.user.id).play;
  assert.equal(recent.playPeriod.days, 30);
  assert.equal(ownerPlay(recent).playedRooms, 2);
  assert.equal(ownerPlay(recent).activeDays, 1);
  assert.equal(ownerPlay(recent).averageDays, 1);
  assert.equal(ownerPlay(recent).completedRooms, 1);
  assert.equal(ownerPlay(lastQuarter).activeDays, 2);
  assert.equal(ownerPlay(lastQuarter).averageDays, 1.5);
  assert.deepEqual(lastQuarter.counts, recent.counts);
  const selected = ok(
    await request(
      '/admin/api/pj?period=30&pj=' + pending.user.id,
      undefined,
      admin,
    ),
  );
  assert.equal(selected.rooms.find((item) => item.id === room).playDays, 1);

  assert.equal(
    (await pj('archive', { room, title: 'Špatný název' }, ana)).status,
    409,
  );
  ok(await pj('archive', { room, title: table.game.title }, ana));
  assert.equal(
    (await post('join', { room, name: 'Hráč', invite: freshInvite.token }))
      .status,
    404,
  );
  assert.equal(
    (await request('/api/game?room=' + room, undefined, owner)).status,
    404,
  );
  assert.equal(
    (
      await request(
        '/api/game?room=' + room + '&download=backup',
        undefined,
        playerCredentials,
      )
    ).status,
    404,
  );
  const backup = ok(
    await request(
      '/api/game?room=' + room + '&download=backup',
      undefined,
      owner,
    ),
  );
  assert(!JSON.stringify(backup).includes('ana@example.test'));
  assert(!JSON.stringify(backup).includes(table.token));
  const imported = ok(await post('restore', { backup }, borek));
  assert.equal(
    ok(await pj('profile', undefined, borek)).rooms[0].id,
    imported.room,
  );
  ok(await pj('restore', { room }, ana));
  ok(await request('/api/game?room=' + room, undefined, playerCredentials));

  db.prepare('UPDATE rooms SET owner_id = NULL WHERE id = ?').run(
    imported.room,
  );
  assert.equal(
    (await pj('claim', { room: imported.room, token: player.token }, ana))
      .status,
    409,
  );
  ok(await pj('claim', { room: imported.room, token: imported.token }, borek));
  assert.equal(
    (await pj('claim', { room: imported.room, token: imported.token }, ana))
      .status,
    409,
  );

  assert.equal(
    (
      await pj(
        'delete',
        { room: imported.room, title: table.game.title },
        borek,
      )
    ).status,
    409,
  );
  ok(
    await pj(
      'archive',
      { room: imported.room, title: table.game.title },
      borek,
    ),
  );
  assert.equal(
    (await pj('delete', { room: imported.room, title: table.game.title }, ana))
      .status,
    409,
  );
  ok(
    await pj('delete', { room: imported.room, title: table.game.title }, borek),
  );
  assert.equal(ok(await pj('profile', undefined, borek)).rooms.length, 0);
  assert.equal(
    (
      await post(
        'create',
        {},
        { ...ana, extra: { Origin: 'https://sibling.example.test' } },
      )
    ).status,
    403,
  );

  db.prepare('UPDATE rooms SET invite_token = NULL WHERE id = ?').run(room);
  assert.equal(ok(await invitation(ana, room)).token, null);
  ok(await post('join', { room, name: 'Starší pozvánka' }));
  assert(ok(await invitation(ana, room, 'resume')).token);
  assert.equal(
    (await post('join', { room, name: 'Starší pozvánka' })).status,
    403,
  );

  const now = Date.now();
  const day = 86_400_000;
  db.prepare('UPDATE rooms SET last_activity_at = ? WHERE id = ?').run(
    now - 91 * day,
    room,
  );
  assert(
    ok(await request('/admin/api/pj', undefined, admin)).candidates.some(
      (item) => item.id === room,
    ),
  );
  ok(await request('/api/game?room=' + room, undefined, owner));
  const survivor = ok(
    await post('create', { name: 'Stůl v ZIP záloze' }, borek),
  );
  const snapshot = ok(await request('/admin/api/backups', {}, admin), 201).name;
  const earlierBackup = await downloadBackup(snapshot, admin);
  const deletions = openPjDeletions(dir, true);
  const oldRow = db
    .prepare('SELECT data, owner_id, last_activity_at FROM rooms WHERE id = ?')
    .get(room);
  const cleanup = createPjTables(db, {
    inactiveDays: 90,
    archiveDays: 30,
    cleanup: true,
    deletions,
  });
  await cleanup.sweep(
    now,
    async () => {},
    () => true,
  );
  assert.equal(
    (await request('/api/game?room=' + room, undefined, owner)).status,
    404,
  );
  await cleanup.sweep(
    now + 31 * day,
    async () => {},
    () => true,
  );
  assert.equal(cleanup.list(pending.user.id).length, 0);
  const portableBackup = await downloadBackup(snapshot, admin);
  ok(
    await pj(
      'archive',
      { room: survivor.room, title: survivor.game.title },
      borek,
    ),
  );
  ok(
    await pj(
      'delete',
      { room: survivor.room, title: survivor.game.title },
      borek,
    ),
  );
  db.prepare(
    'INSERT INTO rooms(id, data, owner_id, last_activity_at) VALUES (?, ?, ?, ?)',
  ).run(room, oldRow.data, oldRow.owner_id, oldRow.last_activity_at);
  deletions.removeRecordedRooms(db);
  assert.equal(
    cleanup.list(pending.user.id).length,
    0,
    'Snapshot replay cannot resurrect a purged room.',
  );
  deletions.close();
  ok(
    await request(
      '/admin/api/pj',
      { action: 'suspend', id: pending.user.id },
      admin,
    ),
  );
  assert.equal((await post('create', {}, ana)).status, 403);
  assert.equal(ok(await pj('profile', undefined, ana)).user, null);
  const initialBorek = ok(await pj('profile', undefined, borek)).user;
  const retained = ok(
    await post('create', { name: 'Kampaň po změně' }, borek),
  ).room;
  const startEmail = (email, session) =>
    pj('request-email-change', { email }, session);
  const confirmEmail = (secret) => pj('confirm-email-change', { secret });
  const emailAfterSelf = 'borek-novy@example.test';
  const emailAfterRecovery = 'borek-obnoveny@example.test';
  assert.equal((await startEmail(emailAfterSelf)).status, 403);
  assert.equal((await startEmail('ana@example.test', borek)).status, 409);
  ok(await pj('login', { email: initialBorek.email }), 202);
  const queuedOldLogin = await signinSecret(initialBorek.email);
  ok(await startEmail(emailAfterSelf, borek));
  ok(
    await pj('request', { email: emailAfterSelf, name: 'Duplicitní účet' }),
    202,
  );
  assert.equal(
    db.prepare('SELECT id FROM pj_accounts WHERE email=?').get(emailAfterSelf),
    undefined,
  );
  const oldProof = await signinSecret(initialBorek.email, 'zmena-emailu');
  const newProof = await signinSecret(emailAfterSelf, 'zmena-emailu');
  assert.equal(ok(await confirmEmail(newProof)).completed, false);
  assert.equal((await confirmEmail(newProof)).status, 400);
  const inProgress = ok(await pj('profile', undefined, borek));
  assert.equal(inProgress.user.email, initialBorek.email);
  assert.equal(inProgress.emailChange.oldConfirmed, false);
  assert.equal(inProgress.emailChange.newConfirmed, true);
  assert.equal(ok(await confirmEmail(oldProof)).completed, true);
  assert.equal((await pj('confirm', { secret: queuedOldLogin })).status, 400);
  assert.equal(ok(await pj('profile', undefined, borek)).user, null);
  ok(await pj('login', { email: emailAfterSelf }), 202);
  const changed = await confirm(emailAfterSelf);
  assert.equal(
    ok(await pj('profile', undefined, changed)).user.id,
    initialBorek.id,
  );
  assert.equal(
    ok(await pj('open', { room: retained }, changed)).room,
    retained,
  );

  const recover = (currentEmail, email, session) =>
    request(
      '/admin/api/pj',
      { action: 'recover-email', id: initialBorek.id, currentEmail, email },
      session,
    );
  assert.equal(
    (await recover(emailAfterSelf, emailAfterRecovery, changed)).status,
    401,
  );
  assert.equal(
    (await recover(initialBorek.email, emailAfterRecovery, admin)).status,
    409,
  );
  ok(await pj('login', { email: emailAfterSelf }), 202);
  const outstandingLogin = await signinSecret(emailAfterSelf);
  ok(await recover(emailAfterSelf, emailAfterRecovery, admin));
  assert.equal(ok(await pj('profile', undefined, changed)).user, null);
  assert.equal((await pj('confirm', { secret: outstandingLogin })).status, 400);
  assert.equal((await pj('cancel-email-change', {}, changed)).status, 403);
  const pendingRecovery = ok(
    await request('/admin/api/pj', undefined, admin),
  ).accounts.find((item) => item.id === initialBorek.id);
  assert.equal(pendingRecovery.email, emailAfterSelf);
  assert.equal(pendingRecovery.emailChangeMode, 'recovery');
  assert.equal(
    ok(
      await confirmEmail(
        await signinSecret(emailAfterRecovery, 'zmena-emailu'),
      ),
    ).completed,
    true,
  );
  ok(await pj('login', { email: emailAfterRecovery }), 202);
  const recovered = await confirm(emailAfterRecovery);
  assert.equal(
    ok(await pj('profile', undefined, recovered)).user.id,
    initialBorek.id,
  );
  assert.equal(
    ok(await pj('open', { room: retained }, recovered)).room,
    retained,
  );
  const historyAfterRecovery = ok(
    await request('/admin/api/pj', undefined, admin),
  ).events;
  assert(
    historyAfterRecovery.some(
      (item) =>
        item.accountId === initialBorek.id && item.action === 'email-recovered',
    ),
  );

  const cancelledEmail = 'zrusena-zmena@example.test';
  ok(await startEmail(cancelledEmail, recovered));
  const cancelledProof = await signinSecret(cancelledEmail, 'zmena-emailu');
  ok(await pj('cancel-email-change', {}, recovered));
  assert.equal((await confirmEmail(cancelledProof)).status, 400);
  assert.equal(
    ok(await pj('profile', undefined, recovered)).user.email,
    emailAfterRecovery,
  );

  const setQuota = (tables, bytes, session = admin) =>
    request(
      '/admin/api/pj',
      { action: 'set-quota', id: initialBorek.id, tables, bytes },
      session,
    );
  const usage = async () => ok(await pj('profile', undefined, recovered)).quota;
  const ownerAccess = {
    ...recovered,
    token: ok(await pj('open', { room: retained }, recovered)).token,
  };
  const retainedView = () =>
    request('/api/game?room=' + retained, undefined, ownerAccess);
  assert.equal((await usage()).tableLimit, 3);
  assert.equal((await usage()).byteLimit, 4 * 1024 ** 2);
  assert.equal((await setQuota(1, null, recovered)).status, 401);
  assert.equal((await setQuota(0, null)).status, 400);
  const legacy = ok(await post('create', { name: 'Starší stůl' }, recovered));
  db.prepare('UPDATE rooms SET owner_id = NULL WHERE id = ?').run(legacy.room);

  ok(await setQuota(1, null));
  assert.equal((await usage()).tables, 1);
  assert.equal((await usage()).tableLimit, 1);
  assert.match(
    (await post('create', {}, recovered)).data.error,
    /limitu počtu stolů/,
  );
  assert.equal((await post('restore', { backup }, recovered)).status, 409);
  assert.match(
    (await pj('claim', { room: legacy.room, token: legacy.token }, recovered))
      .data.error,
    /limitu počtu stolů/,
  );

  const title = ok(await retainedView()).title;
  ok(await pj('archive', { room: retained, title }, recovered));
  assert.equal((await usage()).tables, 1);
  assert.equal((await post('create', {}, recovered)).status, 409);
  ok(await pj('restore', { room: retained }, recovered));

  const retainedInvite = ok(
    await pj('invite', { room: retained, operation: 'read' }, recovered),
  );
  const participant = ok(
    await post('join', {
      room: retained,
      invite: retainedInvite.token,
      name: 'Test hráče',
    }),
  );
  const originalNotes = ok(await retainedView()).notes;
  const expandedNotes = 'P'.repeat(800);
  ok(
    await post(
      'notes',
      {
        room: retained,
        notes: expandedNotes,
        expected: { notes: originalNotes },
      },
      ownerAccess,
    ),
  );
  ok(await setQuota(null, 1));
  assert.equal((await post('restore', { backup }, recovered)).status, 409);
  const growth = await post(
    'chat',
    {
      room: retained,
      text: 'Pokus o růst dat',
      requestId: crypto.randomUUID(),
    },
    { token: participant.token },
  );
  assert.equal(growth.status, 409);
  assert.match(growth.data.error, /limitu dat/);
  ok(
    await post(
      'notes',
      {
        room: retained,
        notes: 'Zkráceno.',
        expected: { notes: expandedNotes },
      },
      ownerAccess,
    ),
  );
  assert.equal(ok(await retainedView()).notes, 'Zkráceno.');
  ok(
    await request(
      '/api/game?room=' + retained + '&download=backup',
      undefined,
      ownerAccess,
    ),
  );

  ok(await setQuota(null, null));
  ok(await pj('claim', { room: legacy.room, token: legacy.token }, recovered));
  assert.equal((await usage()).tables, 2);
  const concurrent = await Promise.all([
    post('create', { name: 'Souběh A' }, recovered),
    post('create', { name: 'Souběh B' }, recovered),
  ]);
  assert.deepEqual(concurrent.map((entry) => entry.status).sort(), [200, 409]);
  assert.equal((await usage()).tables, 3);
  const report = ok(
    await request('/admin/api/pj', undefined, admin),
  ).accounts.find((account) => account.id === initialBorek.id);
  assert.deepEqual(report.quota, {
    tableOverride: null,
    byteOverride: null,
    tableLimit: 3,
    byteLimit: 4194304,
  });

  const fresh = join(dir, 'restored-fresh');
  unpackBackup(portableBackup, fresh);
  const rollback = join(dir, 'restored-rollback');
  unpackBackup(earlierBackup, rollback);
  const archived = new DatabaseSync(join(fresh, 'game.sqlite'), {
    readOnly: true,
  });
  try {
    assert(archived.prepare('SELECT id FROM rooms WHERE id = ?').get(room));
  } finally {
    archived.close();
  }
  const existingLedger = openPjDeletions(rollback);
  assert(existingLedger);
  existingLedger.record([{ id: survivor.room }]);
  existingLedger.close();
  const merge = spawnSync(
    process.execPath,
    [
      'scripts/merge-pj-deletions.mjs',
      join(fresh, pjDeletionsFilename),
      rollback,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(merge.status, 0, merge.stderr);
  await stopApp();
  await startApp(fresh);
  assert.equal(
    (await request('/api/game?room=' + room, undefined, owner)).status,
    404,
  );
  assert.equal(
    (
      await request('/api/game?room=' + survivor.room, undefined, {
        ...borek,
        token: survivor.token,
      })
    ).status,
    200,
  );
  await stopApp();
  await startApp(rollback);
  assert.equal(
    (await request('/api/game?room=' + room, undefined, owner)).status,
    404,
  );
  assert.equal(
    (
      await request('/api/game?room=' + survivor.room, undefined, {
        ...borek,
        token: survivor.token,
      })
    ).status,
    404,
  );
  console.log(
    'PASS: úplný ZIP obnoví původní přístupy a záznamy o smazání. Sloučení při návratu uchová záznamy z obou databází.',
  );

  console.log(
    'PASS: SMTP/TLS, ověření a schválení PJ, přímá pozvánka, ochrana API, vlastnictví, statistiky, archivace, obnova e-mailu a kvóty PJ.',
  );
} finally {
  db?.close();
  await stopApp();
  if (smtp?.listening) await new Promise((resolve) => smtp.close(resolve));
  rmSync(dir, { recursive: true, force: true });
}
