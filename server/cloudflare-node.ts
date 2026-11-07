import {catalogFiles} from './catalog-files.mjs';
import {getD1} from './database.mjs';
export const env={CATALOG_FILES:catalogFiles,get DB(){return getD1() as unknown as D1Database;}};
