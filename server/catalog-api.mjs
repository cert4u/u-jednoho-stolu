// @ts-check
import { ZodError } from 'zod';
import {
  prepareGithubCatalog,
  recommendedCatalogs,
} from './catalog-github.mjs';
import { json, body } from './http.mjs';
import * as library from './catalog-store.mjs';
import { catalogFiles } from './catalog-files.mjs';
import { loadCatalogCore } from './catalogs/validation.mjs';
import { zipLimits } from './catalog-zip.mjs';

/** @typedef {import('node:http').IncomingMessage} IncomingMessage */
/** @typedef {import('node:http').ServerResponse} ServerResponse */

/** @param {IncomingMessage} req @param {number} max */
async function bytes(req, max) {
  let size = 0;
  const parts = [];
  for await (const part of req) {
    size += part.length;
    if (size > max) throw new Error('Příliš velký soubor.');
    parts.push(part);
  }
  return Buffer.concat(parts);
}

/** @param {URLSearchParams} params */
function queryFields(params) {
  const fields = Object.fromEntries(params);
  if (Object.keys(fields).length !== params.size)
    throw new Error('Parametry katalogu se nesmějí opakovat.');
  return fields;
}

/** @param {ZodError} error */
function validationMessage(error) {
  return error.issues
    .map((issue) => {
      let message = issue.message;
      switch (issue.code) {
        case 'invalid_value':
          message = 'povolené hodnoty: ' + issue.values.join(', ');
          break;
        case 'too_small':
          message = 'minimum je ' + issue.minimum;
          break;
        case 'too_big':
          message = 'maximum je ' + issue.maximum;
          break;
        case 'unrecognized_keys':
          message = 'neznámá pole: ' + issue.keys.join(', ');
          break;
      }
      return issue.path.length
        ? `${issue.path.join('.')}: ${message}`
        : message;
    })
    .join('\n');
}

/**
 * @param {keyof typeof import('../lib/catalogs/admin-requests').catalogAdminRequests} action
 * @param {unknown} raw
 * @param {typeof import('../lib/catalogs/admin-requests').catalogAdminRequests} schemas
 * @returns {Promise<object>}
 */
async function runCatalogAction(action, raw, schemas) {
  switch (action) {
    case 'github':
      return prepareGithubCatalog(schemas.github.parse(raw));
    case 'recommend':
      schemas.recommend.parse(raw);
      return { catalogs: await recommendedCatalogs() };
    case 'create': {
      const { manifest } = schemas.create.parse(raw);
      return library.createCatalog(manifest);
    }
    case 'manifest': {
      const { id, expectedRevision, manifest } = schemas.manifest.parse(raw);
      return library.editManifest(id, expectedRevision, manifest);
    }
    case 'entry':
      return library.editEntry(schemas.entry.parse(raw));
    case 'copy':
      return library.copyEntry(schemas.copy.parse(raw));
    case 'enable': {
      const { id, expectedRevision, enabled } = schemas.enable.parse(raw);
      return library.setCatalogEnabled(id, expectedRevision, enabled);
    }
    case 'remove': {
      const { id, expectedRevision, preserveCampaigns } =
        schemas.remove.parse(raw);
      return library.removeCatalog(id, expectedRevision, preserveCampaigns);
    }
    case 'install':
      return library.installPrepared(schemas.install.parse(raw).token);
    case 'discard':
      return library.discardImport(schemas.discard.parse(raw).token);
    case 'rollback': {
      const { id, expectedRevision, historyId } = schemas.rollback.parse(raw);
      return library.rollbackCatalog(id, expectedRevision, historyId);
    }
  }
}

/** @param {IncomingMessage} req @param {ServerResponse} res @param {URL} url */
export async function catalogApi(req, res, url) {
  const action = url.pathname
    .slice('/admin/api/catalogs'.length)
    .replace(/^\//, '');
  try {
    if (req.method === 'GET') {
      if (!action) {
        json(res, 200, { catalogs: await library.listCatalogs() });
        return;
      }
      if (action === 'view' || action === 'export') {
        const { catalogIdQuery } = await loadCatalogCore();
        const { id } = catalogIdQuery.parse(queryFields(url.searchParams));
        if (action === 'view') {
          json(res, 200, await library.viewCatalog(id));
          return;
        }
        const data = await library.exportCatalog(id);
        res.writeHead(200, {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${id}.zip"`,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        });
        res.end(data);
        return;
      }
    }
    if (req.method === 'POST') {
      if (action === 'preview') {
        json(
          res,
          200,
          await library.prepareCatalogImport(
            await bytes(req, zipLimits.archive),
          ),
        );
        return;
      }
      const { catalogAdminRequests, catalogImageQuery } =
        await loadCatalogCore();
      if (action === 'image') {
        const { id, revision, portrait } = catalogImageQuery.parse(
          queryFields(url.searchParams),
        );
        json(
          res,
          200,
          await library.uploadImage(
            id,
            revision,
            portrait,
            await bytes(req, 1_500_000),
          ),
        );
        return;
      }
      if (!Object.hasOwn(catalogAdminRequests, action)) {
        json(res, 404, { error: 'Katalogová operace neexistuje.' });
        return;
      }
      /** @type {unknown} */
      const raw = await body(req, 500_000);
      json(
        res,
        200,
        await runCatalogAction(
          /** @type {keyof typeof catalogAdminRequests} */ (action),
          raw,
          catalogAdminRequests,
        ),
      );
      return;
    }
    json(res, 405, { error: 'Nepodporovaná operace.' });
  } catch (error) {
    if (error instanceof ZodError) {
      json(res, 400, { error: validationMessage(error) });
      return;
    }
    const message =
      error instanceof SyntaxError
        ? 'Neplatný JSON požadavku.'
        : error instanceof Error
          ? error.message
          : 'Katalogovou operaci se nepodařilo dokončit.';
    json(
      res,
      /změnil|neexistuje|závisejí|zachovej|Potvrď/i.test(message) ? 409 : 400,
      { error: message },
    );
  }
}

/** @param {IncomingMessage} req @param {ServerResponse} res @param {string} pathname */
export async function catalogAsset(req, res, pathname) {
  const match = pathname.match(/^\/catalog-assets\/([a-f0-9]{64})\.webp$/);
  if (!match || req.method !== 'GET') {
    json(res, 404, { error: 'Obrázek neexistuje.' });
    return;
  }
  try {
    const data = await catalogFiles.read(match[1]);
    res.writeHead(200, {
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
    });
    res.end(data);
  } catch {
    json(res, 404, { error: 'Obrázek neexistuje.' });
  }
}
