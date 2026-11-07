import {env} from 'cloudflare:workers';
import {getDb} from '../../db';
import {catalogs} from '../../db/schema';
import {catalogBundleSchema,type CampaignCatalog,type InstalledCatalog} from './model';
import {CatalogResolver,type CatalogFiles} from './resolver';
export function catalogFileAdapter():CatalogFiles|undefined{return (env as unknown as {CATALOG_FILES?:CatalogFiles}).CATALOG_FILES;}
/** No Node imports here. Cloudflare deliberately uses distributed catalogs only. */
export async function loadCatalogs(pinned?:CampaignCatalog){
  if(!catalogFileAdapter())return new CatalogResolver([],pinned);
  const rows=await getDb().select().from(catalogs).all();
  const installed:InstalledCatalog[]=rows.filter(row=>row.enabled).map(row=>({
    bundle:catalogBundleSchema.parse(JSON.parse(row.payload)),digest:row.digest,
    kind:row.kind as 'local'|'community',enabled:Boolean(row.enabled),revision:row.revision,
    ...(row.source?{source:JSON.parse(row.source)}:{}),installedAt:row.installedAt,
  }));
  return new CatalogResolver(installed,pinned);
}
