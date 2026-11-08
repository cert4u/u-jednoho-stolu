import {catalogFiles} from './catalog-files.mjs';
import {getD1} from './database.mjs';
export const env={STUL_NATIVE_NODE:true,
 get STUL_ROOM_CREATE_RATE(){return process.env.STUL_ROOM_CREATE_RATE;},
 get STUL_ROOM_LIMIT(){return process.env.STUL_ROOM_LIMIT;},
 get STUL_ROOM_BYTES_LIMIT(){return process.env.STUL_ROOM_BYTES_LIMIT;},CATALOG_FILES:catalogFiles,get DB(){return getD1() as unknown as D1Database;}};
