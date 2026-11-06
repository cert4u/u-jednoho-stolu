import { createServer } from 'node:http';
import { UpdateManager, UPDATER_PROTOCOL } from './manager.mjs';
import { equal, json, body } from './http.mjs';

const token = process.env.STUL_UPDATER_TOKEN || '';
if (token.length < 32) throw new Error('STUL_UPDATER_TOKEN musí mít alespoň 32 znaků.');
const manager = new UpdateManager();
await manager.resume();

createServer(async (req, res) => {
  try {
    if (!equal(req.headers.authorization, `Bearer ${token}`)) {
      json(res, 401, { error: 'Nepovolený přístup.' });
      return;
    }
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/protocol' && req.method === 'GET') {
      json(res, 200, { protocol: UPDATER_PROTOCOL });
      return;
    }
    if (url.pathname === '/status' && req.method === 'GET') {
      json(res, 200, await manager.status(url.searchParams.has('refresh')));
      return;
    }
    if (url.pathname === '/resolve' && req.method === 'POST' && manager.channel === 'development') {
      const { ref } = await body(req);
      json(res, 200, await manager.development(ref, { includeCI: true }));
      return;
    }
    if (['/update', '/rollback', '/restore'].includes(url.pathname) && req.method === 'POST') {
      const options = await body(req);
      json(res, 202, await manager.begin(url.pathname.slice(1), options.requestId, options));
      return;
    }
    json(res, 404, { error: 'Nenalezeno.' });
  } catch (error) { json(res, 409, { error: error.message }); }
}).listen(8090, '0.0.0.0');
