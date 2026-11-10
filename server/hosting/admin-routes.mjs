import { readFileSync } from 'node:fs';
import { catalogApi } from '../catalog-api.mjs';
import { body, json } from '../http.mjs';
import {
  createSnapshot,
  snapshots,
  downloadSnapshot,
  storageStatus,
} from '../snapshots.mjs';
const adminFiles = new Map([
  ['/admin', '../admin.html'],
  ['/admin/', '../admin.html'],
  ['/admin/app.js', '../admin.js'],
  ['/admin/catalogs.js', '../admin-catalogs.js'],
  ['/admin/dialogs.js', '../admin-dialog.js'],
  ['/admin/admin-catalog-presentation.js', '../admin-catalog-presentation.js'],
  ['/admin/admin-catalog-state.js', '../admin-catalog-state.js'],
  ['/admin/admin-catalog-editor.js', '../admin-catalog-editor.js'],
  ['/admin/admin-catalog-view.js', '../admin-catalog-view.js'],
  ['/admin/admin-catalog-api.js', '../admin-catalog-api.js'],
  ['/admin/admin-catalog-operations.js', '../admin-catalog-operations.js'],
]);
export function isAdminAsset(pathname) {
  return adminFiles.has(pathname);
}
export function serveAdminAsset(req, res, pathname) {
  if (req.method !== 'GET') {
    json(res, 405, { error: 'Použij GET.' });
    return;
  }
  const js = pathname.endsWith('.js');
  res.writeHead(200, {
    'Content-Type': js
      ? 'text/javascript; charset=utf-8'
      : 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy':
      "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  });
  res.end(readFileSync(new URL(adminFiles.get(pathname), import.meta.url)));
  return;
}

export function createAdminApi({ auth, origin, info, maintenance, updater }) {
  return async function handleAdminApi(req, res, url) {
    const { pathname } = url;
    if (req.method === 'POST' && req.headers.origin !== origin.origin) {
      json(res, 403, { error: 'Neplatný původ požadavku.' });
      return;
    }
    if (pathname === '/admin/api/login' && req.method === 'POST') {
      await auth.login(req, res);
      return;
    }
    if (!auth.authorized(req)) {
      json(res, 401, { error: 'Přihlas se jako správce instalace.' });
      return;
    }
    if (
      pathname === '/admin/api/catalogs' ||
      pathname.startsWith('/admin/api/catalogs/')
    ) {
      if (req.method === 'POST' && maintenance.blocksWrites()) {
        json(res, 503, { error: 'Probíhá údržba. Katalogy nyní neupravuj.' });
        return;
      }
      const finish = maintenance.trackMutation(req.method === 'POST');
      try {
        await catalogApi(req, res, url);
      } finally {
        finish();
      }
      return;
    }
    if (pathname === '/admin/api/logout' && req.method === 'POST') {
      auth.logout(req, res);
      return;
    }
    if (pathname === '/admin/api/status' && req.method === 'GET') {
      const local = {
        installed: info,
        hostingProtocol: 1,
        maintenance: maintenance.hasMarker(),
        voiceConfigured: Boolean(
          process.env.STUL_LIVEKIT_URL &&
            process.env.STUL_LIVEKIT_API_KEY &&
            process.env.STUL_LIVEKIT_API_SECRET,
        ),
        storage: storageStatus(),
      };
      try {
        const remote = await updater(
          '/status',
          'GET',
          undefined,
          url.searchParams.has('refresh'),
        );
        const {
          protocol,
          hostingConfig,
          channel,
          latest,
          releaseError,
          updateBlocked,
          job,
          locked,
          automaticKeep,
          canRollback,
        } = remote;
        json(res, 200, {
          ...local,
          protocol,
          hostingConfig,
          channel,
          latest,
          releaseError,
          updateBlocked,
          job,
          locked,
          automaticKeep,
          canRollback,
          updaterAvailable: true,
        });
      } catch {
        json(res, 200, {
          ...local,
          updaterAvailable: false,
          latest: null,
          job: null,
          canRollback: false,
          releaseError:
            'Aktualizační služba není dostupná. Pro webové aktualizace spusť Docker updater.',
        });
      }
      return;
    }
    if (pathname === '/admin/api/backups' && req.method === 'GET') {
      json(res, 200, { snapshots: snapshots() });
      return;
    }
    if (pathname === '/admin/api/backups' && req.method === 'POST') {
      if (maintenance.blocksWrites()) {
        json(res, 409, { error: 'Počkej, až skončí údržba.' });
        return;
      }
      json(res, 201, { name: createSnapshot(true) });
      return;
    }
    if (pathname === '/admin/api/backup' && req.method === 'GET') {
      if (
        !(await downloadSnapshot(
          url.searchParams.get('name'),
          res,
          url.searchParams.get('bundle') === '1',
        ))
      )
        json(res, 404, { error: 'Záloha neexistuje.' });
      return;
    }
    const command = pathname.slice('/admin/api/'.length);
    if (
      ['update', 'rollback', 'restore', 'resolve'].includes(command) &&
      req.method === 'POST'
    ) {
      const b = await body(req);
      if (
        command === 'update' &&
        (typeof b?.expectedSha !== 'string' ||
          !/^[a-f0-9]{40}$/.test(b.expectedSha))
      ) {
        json(res, 400, { error: 'Potvrď přesný commit aktualizace.' });
        return;
      }
      try {
        const { protocol } = await updater('/protocol');
        if (protocol !== 1)
          throw new Error(
            'Aktualizuj nejdřív službu updateru podle provozního návodu.',
          );
        json(
          res,
          command === 'resolve' ? 200 : 202,
          await updater('/' + command, 'POST', b),
        );
      } catch (error) {
        json(res, 409, { error: error.message });
      }
      return;
    }
    json(res, 404, { error: 'Nenalezeno.' });
    return;
  };
}
