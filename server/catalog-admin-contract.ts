// Type-only contract for the admin browser client and the Node catalog service.
import type { CatalogRequests } from '../lib/catalogs/admin-requests';
import type { CatalogType, CategoryData } from '../lib/catalogs/model';

export type { CatalogRequests } from '../lib/catalogs/admin-requests';

type CatalogStore = typeof import('./catalog-store.mjs');

export type CatalogImportPreview = Awaited<
  ReturnType<CatalogStore['prepareCatalogImport']>
>;

export type CatalogResponses = {
  '': { catalogs: Awaited<ReturnType<CatalogStore['listCatalogs']>> };
  view: Awaited<ReturnType<CatalogStore['viewCatalog']>>;
  preview: CatalogImportPreview;
  github: CatalogImportPreview;
  install: Awaited<ReturnType<CatalogStore['installPrepared']>>;
  recommend: {
    catalogs: Awaited<
      ReturnType<typeof import('./catalog-github.mjs').recommendedCatalogs>
    >;
  };
  create: Awaited<ReturnType<CatalogStore['createCatalog']>>;
  manifest: Awaited<ReturnType<CatalogStore['editManifest']>>;
  entry: Awaited<ReturnType<CatalogStore['editEntry']>>;
  copy: Awaited<ReturnType<CatalogStore['copyEntry']>>;
  enable: Awaited<ReturnType<CatalogStore['setCatalogEnabled']>>;
  remove: Awaited<ReturnType<CatalogStore['removeCatalog']>>;
  discard: ReturnType<CatalogStore['discardImport']>;
  rollback: Awaited<ReturnType<CatalogStore['rollbackCatalog']>>;
  image: Awaited<ReturnType<CatalogStore['uploadImage']>>;
};

export type CatalogAction = keyof CatalogResponses;

export type CatalogArguments<Action extends CatalogAction> =
  Action extends keyof CatalogRequests
    ? [data: CatalogRequests[Action], options?: RequestInit]
    : [data?: unknown, options?: RequestInit];

export type CatalogEditing =
  | { type: 'manifest' }
  | { type: CatalogType; originalId?: string };

export type CatalogEditorEntry = CategoryData[CatalogType];

type EntryAction = (
  type: CatalogType,
  entry: CatalogEditorEntry,
) => void | Promise<void>;

export type CatalogEditorView = {
  selected: CatalogResponses['view'];
  type: CatalogType;
  entry: CatalogEditorEntry;
  originalId?: string;
  onCopy: EntryAction;
  onRemove: EntryAction;
  onDuplicate: EntryAction;
};
