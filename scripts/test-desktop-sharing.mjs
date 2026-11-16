import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const host = '127.0.0.1';
const local = 'http://127.0.0.1:18186';
const publicOrigin = 'https://zkusebni-stul.example.ts.net';
const publicHost = new URL(publicOrigin).host;
const sharePort = 18187;
const password = crypto.randomUUID();
const data = await mkdtemp(join(tmpdir(), 'stul-desktop-sharing-'));
const child = spawn(
  process.execPath,
  [
    '--input-type=module',
    '-e',
    "const desktop = await import('./server/start.mjs'); await desktop.startDesktopSharing();",
  ],
  {
    env: {
      ...process.env,
      STUL_DESKTOP: '1',
      STUL_BIND_HOST: host,
      STUL_DESKTOP_SHARE_ORIGIN: publicOrigin,
      STUL_DESKTOP_SHARE_PORT: String(sharePort),
      PUBLIC_ORIGIN: local,
      PORT: new URL(local).port,
      STUL_DATA_DIR: data,
      STUL_ADMIN_PASSWORD: password,
      STUL_UPDATER_TOKEN: crypto.randomUUID(),
      STUL_UPDATER_URL: 'off',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
const exited = once(child, 'exit');
let logs = '';
for (const stream of [child.stdout, child.stderr])
  stream.on('data', (chunk) => {
    logs += chunk;
  });

function asPublic(path, options = {}) {
  const { method = 'GET', headers = {}, data, port = sharePort } = options;
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: host,
        port,
        path,
        method,
        headers: { Host: publicHost, ...headers },
      },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () =>
          resolve({
            status: response.statusCode,
            text: Buffer.concat(chunks).toString(),
          }),
        );
        response.on('error', reject);
      },
    );
    request.on('error', reject);
    request.end(data);
  });
}
const publicPost = (data, origin = publicOrigin, headers) =>
  asPublic('/api/game', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, ...headers },
    data: JSON.stringify(data),
  });

function localPost(path, data) {
  return fetch(local + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: local },
    body: JSON.stringify(data),
  });
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) throw new Error(logs);
    try {
      const res = await fetch(local + '/desktop/invite-origin');
      ready = (await res.json()).origin === publicOrigin;
      if (ready) break;
    } catch {}
    await delay(100);
  }
  assert(ready, logs);
  assert.equal((await localPost('/admin/api/login', { password })).status, 200);
  assert.equal(
    (await asPublic('/admin', { port: new URL(local).port })).status,
    404,
  );
  for (const path of [
    '/admin',
    '/admin/',
    '/admin/api/status',
    '/internal/smoke',
    '/desktop/invite-origin',
    '/_next/static/../../admin',
    '/_next/static/%2fadmin',
  ]) {
    assert.equal((await asPublic(path)).status, 404, path);
  }
  assert.equal(
    (await asPublic('/', { headers: { Host: 'wrong.example' } })).status,
    404,
  );
  assert.equal((await asPublic('/')).status, 200);
  assert.equal((await asPublic('/monsters/kobold.webp')).status, 200);
  for (const action of ['create', 'restore'])
    assert.equal((await publicPost({ action })).status, 403);
  assert.equal(
    (await publicPost({ action: 'join' }, 'https://wrong.example')).status,
    403,
  );
  assert.equal(
    (await publicPost({ action: 'join', name: 'x'.repeat(3_100_000) })).status,
    413,
  );
  const created = await localPost('/api/game', {
    action: 'create',
    name: 'Pán jeskyně',
  });
  assert.equal(created.status, 200);
  const { room } = await created.json();
  const joined = await publicPost({ action: 'join', room, name: 'Hráč' });
  assert.equal(joined.status, 200, joined.text);
  const { token } = JSON.parse(joined.text);
  assert.equal((await asPublic('/api/game?room=' + room)).status, 401);
  assert.equal(
    (
      await asPublic('/api/game?room=' + room, {
        headers: { Authorization: 'Bearer ' + token },
      })
    ).status,
    200,
  );
  console.log(
    'PASS: desktop host stays local, the public port rejects admin and campaign creation/restore and accepts a valid player.',
  );
} finally {
  if (child.exitCode === null) child.kill();
  await exited;
  await rm(data, { recursive: true, force: true });
}
