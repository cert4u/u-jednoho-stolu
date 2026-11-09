import { statfsSync } from 'node:fs';
import { request } from 'node:http';
import { dataDirectory } from '../database.mjs';
import { json } from '../http.mjs';

export function rejectLowDiskWrite(req, res, pathname) {
  if (pathname === '/api/game' && req.method === 'POST') {
    const disk = statfsSync(dataDirectory());
    if (disk.bavail * disk.bsize < 16_000_000) {
      console.warn('game_write_denied_low_disk');
      res.setHeader('Retry-After', '60');
      json(res, 503, {
        error: 'Na serveru není dost volného místa. Kontaktuj správce.',
      });
      return true;
    }
  }
  return false;
}

export function proxyGame(req, res, port, maintenance) {
  const mutates = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  if (mutates && maintenance.blocksWrites()) {
    res.setHeader('Retry-After', '15');
    json(res, 503, {
      error: 'Probíhá aktualizace stolu. Za chvíli akci zopakuj.',
    });
    return;
  }
  const finish = maintenance.trackMutation(mutates);
  const proxy = request(
    {
      hostname: '127.0.0.1',
      port,
      path: req.url,
      method: req.method,
      headers: req.headers,
    },
    (upstream) => {
      // A disconnected browser does not cancel a mutation already sent to the game.
      upstream.once('end', finish);
      upstream.once('close', finish);
      if (res.destroyed) {
        upstream.resume();
        return;
      }
      res.writeHead(upstream.statusCode, upstream.headers);
      res.once('close', () => upstream.resume());
      upstream.pipe(res);
    },
  );
  proxy.on('error', () => {
    finish();
    if (res.destroyed) return;
    if (!res.headersSent) json(res, 502, { error: 'Stůl se spouští.' });
    else res.destroy();
  });
  req.on('aborted', () => {
    if (!req.complete) proxy.destroy();
  });
  req.pipe(proxy);
}
