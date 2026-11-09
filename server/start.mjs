import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { startProdServer } from 'vinext/server/prod-server';
import { catalogAsset } from './catalog-api.mjs';
import { openDatabase } from './database.mjs';
import { json } from './http.mjs';
import { createAdminAuth } from './hosting/admin-auth.mjs';
import {
  createAdminApi,
  isAdminAsset,
  serveAdminAsset,
} from './hosting/admin-routes.mjs';
import { proxyGame, rejectLowDiskWrite } from './hosting/game-proxy.mjs';
import { createMaintenance } from './hosting/maintenance.mjs';
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
const info = JSON.parse(readFileSync('dist/stul-build.json', 'utf8'));
openDatabase();
const internal = await startProdServer({
  host: '127.0.0.1',
  port: 0,
  silent: true,
});
const maintenance = createMaintenance({ token, info });
const adminApi = createAdminApi({
  auth: createAdminAuth(password, origin),
  origin,
  info,
  maintenance,
  updater: createUpdaterClient(token),
});

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const { pathname } = url;

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
server.listen(Number(process.env.PORT || 8080), '0.0.0.0', () =>
  console.log(
    `U jednoho stolu ${info.version}: port ${process.env.PORT || 8080}, správa /admin`,
  ),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => {
    server.close();
    internal.server.close();
    setTimeout(() => process.exit(0), 2000).unref();
  });
