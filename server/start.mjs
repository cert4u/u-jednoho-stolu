import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { startProdServer } from 'vinext/server/prod-server';
import { catalogAsset } from './catalog-api.mjs';
import { dataDirectory, openDatabase } from './database.mjs';
import { json } from './http.mjs';
import { createAdminAuth } from './hosting/admin-auth.mjs';
import {
  createAdminApi,
  isAdminAsset,
  serveAdminAsset,
} from './hosting/admin-routes.mjs';
import { createDesktopSharing } from './hosting/desktop-sharing.mjs';
import { proxyGame, rejectLowDiskWrite } from './hosting/game-proxy.mjs';
import { createMaintenance } from './hosting/maintenance.mjs';
import { openPjDeletions } from './hosting/pj-deletions.mjs';
import { createPublicPj } from './hosting/public-pj.mjs';
import { createUpdaterClient } from './hosting/updater-client.mjs';

const password = process.env.STUL_ADMIN_PASSWORD || '',
  token = process.env.STUL_UPDATER_TOKEN || '';
if (password.length < 20 || token.length < 32)
  throw new Error(
    'Nastav STUL_ADMIN_PASSWORD (alespoň 20 znaků) a STUL_UPDATER_TOKEN (alespoň 32 znaků).',
  );
const origin = new URL(process.env.PUBLIC_ORIGIN || 'http://localhost:8080');
if (
  !['http:', 'https:'].includes(origin.protocol) ||
  origin.username ||
  origin.password ||
  origin.pathname !== '/'
)
  throw new Error('PUBLIC_ORIGIN musí obsahovat pouze http(s) původ.');
const desktop = process.env.STUL_DESKTOP === '1';
const shareOrigin =
  desktop && process.env.STUL_DESKTOP_SHARE_ORIGIN
    ? new URL(process.env.STUL_DESKTOP_SHARE_ORIGIN)
    : null;
const sharePort = Number(process.env.STUL_DESKTOP_SHARE_PORT || 8081);
if (
  shareOrigin &&
  (shareOrigin.protocol !== 'https:' ||
    shareOrigin.username ||
    shareOrigin.password ||
    shareOrigin.pathname !== '/' ||
    shareOrigin.search ||
    shareOrigin.hash)
)
  throw new Error('Neplatné nastavení sdílení stolu.');
const info = JSON.parse(readFileSync('dist/stul-build.json', 'utf8'));
const db = openDatabase();
const maintenance = createMaintenance({ token, info });
const publicMode = !desktop && process.env.STUL_PUBLIC_ACCOUNTS === '1';
const deletions = openPjDeletions(dataDirectory(), publicMode);
deletions?.removeRecordedRooms(db);
const publicPj = publicMode
  ? await createPublicPj({ db, origin, maintenance, deletions })
  : null;
if (publicPj) {
  const sweep = () =>
    publicPj.sweep().catch(() => console.warn('pj_cleanup_failed'));
  setInterval(sweep, 15 * 60_000).unref();
}
const internal = await startProdServer({
  host: '127.0.0.1',
  port: 0,
  silent: true,
});
const adminApi = createAdminApi({
  publicPj,
  auth: createAdminAuth(password, origin),
  origin,
  info,
  maintenance,
  updater: createUpdaterClient(token),
});

export const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const { pathname } = url;

    if (desktop && req.headers.host !== origin.host) {
      json(res, 404, {
        error: 'Použij místní adresu stolu nebo port pro veřejnou hru.',
      });
      return;
    }
    if (
      desktop &&
      pathname === '/desktop/invite-origin' &&
      req.method === 'GET'
    ) {
      json(res, 200, {
        origin: desktopSharing?.listening ? shareOrigin.origin : null,
      });
      return;
    }
    if (rejectLowDiskWrite(req, res, pathname)) return;
    if (pathname.startsWith('/catalog-assets/')) {
      await catalogAsset(req, res, pathname);
      return;
    }
    if (pathname === '/healthz') {
      json(res, 200, {
        ok: true,
        ...info,
        hostingProtocol: 1,
        maintenance: maintenance.hasMarker(),
      });
      return;
    }
    if (pathname.startsWith('/internal/')) {
      await maintenance.handleInternal(
        req,
        res,
        pathname,
        server.address().port,
      );
      return;
    }
    if (isAdminAsset(pathname)) {
      serveAdminAsset(req, res, pathname);
      return;
    }
    if (pathname.startsWith('/admin/api/')) {
      await adminApi(req, res, url);
      return;
    }
    if (pathname.startsWith('/pj/api/')) {
      if (publicPj) await publicPj.handle(req, res, url);
      else json(res, 404, { error: 'Správa účtů PJ není zapnutá.' });
      return;
    }
    delete req.headers['x-stul-pj-account'];
    if (publicPj && (pathname === '/api/game' || pathname === '/api/voice')) {
      const trusted = publicPj.authHeaders(req);
      if (
        trusted['x-stul-pj-account'] &&
        req.method === 'POST' &&
        req.headers.origin !== origin.origin
      ) {
        json(res, 403, { error: 'Neplatný původ požadavku.' });
        return;
      }
      Object.assign(req.headers, trusted);
    }
    proxyGame(req, res, internal.port, maintenance);
  } catch (error) {
    console.error(error.message);
    if (!res.headersSent)
      json(res, 503, {
        error:
          'Operaci se nepodařilo dokončit. Podrobnosti jsou v logu serveru.',
      });
    else res.destroy();
  }
});
server.requestTimeout = 30000;
server.headersTimeout = 15000;
server.listen(
  Number(process.env.PORT || 8080),
  process.env.STUL_BIND_HOST || '0.0.0.0',
  () =>
    console.log(
      `U jednoho stolu ${info.version}: port ${process.env.PORT || 8080}, správa /admin`,
    ),
);
export async function startDesktopSharing() {
  if (!shareOrigin) return;
  if (!Number.isInteger(sharePort) || sharePort < 1024 || sharePort > 65535) {
    throw new Error('Port pro veřejnou hru musí být v rozsahu 1024 až 65535.');
  }
  const listener = createServer(
    createDesktopSharing({
      origin: shareOrigin,
      gamePort: internal.port,
      maintenance,
      catalogAsset,
    }),
  );
  listener.requestTimeout = server.requestTimeout;
  listener.headersTimeout = server.headersTimeout;
  listener.listen(sharePort, '127.0.0.1');
  await once(listener, 'listening');
  desktopSharing = listener;
}

let desktopSharing;
export async function stopServer() {
  await Promise.all(
    [server, internal.server, ...(desktopSharing ? [desktopSharing] : [])].map(
      (listener) => new Promise((resolve) => listener.close(resolve)),
    ),
  );
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    void stopServer();
    setTimeout(() => process.exit(0), 2000).unref();
  });
}
