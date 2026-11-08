// Fault injection only in the isolated readiness test child, never a production setting.
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import path from 'node:path';
const original=fs.statfsSync;
fs.statfsSync=(directory,...args)=>{
 const result=original(directory,...args);
 return path.resolve(String(directory))===path.resolve(process.env.STUL_DATA_DIR)?{...result,bavail:0}:result;
};
syncBuiltinESMExports();
