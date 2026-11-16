import { json } from '../http.mjs';
import { proxyGame, rejectLowDiskWrite } from './game-proxy.mjs';

const staticPath =
  /^\/(?:_next\/static|characters|monsters|catalog-assets)\/[A-Za-z0-9/._-]+$/;
const readPaths = new Set([
  '/',
  '/favicon.svg',
  '/api/game',
  '/api/adventures',
]);
const maxGameRequestBytes = 3_100_000;

async function gameBody(req) {
  const chunks = [];
  let length = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    length += chunk.length;
    if (length > maxGameRequestBytes) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function createDesktopSharing({
  origin,
  gamePort,
  maintenance,
  catalogAsset,
}) {
  return async function desktopSharing(req, res) {
    try {
      const address = req.url || '';
      if (
        req.headers.host !== origin.host ||
        !address.startsWith('/') ||
        address.startsWith('//')
      ) {
        json(res, 404, { error: 'Stránka neexistuje.' });
        return;
      }
      const { pathname, search } = new URL(address, origin);
      const safePath =
        !address.split('?')[0].includes('\\') && !pathname.includes('%');
      const read = req.method === 'GET' || req.method === 'HEAD';
      const write = req.method === 'POST' && pathname === '/api/game';
      if (
        !safePath ||
        !(
          (read && (readPaths.has(pathname) || staticPath.test(pathname))) ||
          write
        )
      ) {
        json(res, 404, { error: 'Stránka neexistuje.' });
        return;
      }
      // Pass on the same canonical path which was allowed above.
      req.url = pathname + search;
      if (pathname.startsWith('/catalog-assets/')) {
        await catalogAsset(req, res, pathname);
        return;
      }
      if (write) {
        if (req.headers.origin !== origin.origin) {
          json(res, 403, { error: 'Neplatný původ požadavku.' });
          return;
        }
        if (rejectLowDiskWrite(req, res, pathname)) return;
        const bytes = await gameBody(req);
        if (bytes === null) {
          res.setHeader('Connection', 'close');
          json(res, 413, { error: 'Požadavek je příliš velký.' });
          return;
        }
        let action;
        try {
          action = JSON.parse(bytes.toString())?.action;
        } catch {
          json(res, 400, { error: 'Neplatný požadavek.' });
          return;
        }
        if (action === 'create' || action === 'restore') {
          json(res, 403, {
            error: 'Kampaň založ nebo obnov v místní aplikaci.',
          });
          return;
        }
        proxyGame(req, res, gamePort, maintenance, bytes);
        return;
      }
      proxyGame(req, res, gamePort, maintenance);
    } catch {
      if (!res.headersSent)
        json(res, 503, { error: 'Sdílený stůl není dostupný.' });
      else res.destroy();
    }
  };
}
