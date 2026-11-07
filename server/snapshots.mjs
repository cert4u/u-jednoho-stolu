import {readZip,writeZip} from './catalog-zip.mjs';
import {createHash} from 'node:crypto';
import { constants, chmodSync, closeSync, fsyncSync, openSync, mkdirSync, readdirSync, renameSync, lstatSync, statSync, statfsSync, unlinkSync, readFileSync, writeFileSync } from 'node:fs';
import { open } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { backupDatabase, dataDirectory } from './database.mjs';


const snapshotZipLimits={archive:280_000_000,total:256_000_000,file:128_000_000,files:4098};
function lstatSafe(file){try{return lstatSync(file);}catch(error){if(error.code==='ENOENT')return;throw error;}}

const namePattern = /^(manual-)?(\d+)-[a-f0-9]{16}\.sqlite$/;

export function createSnapshot(manual = false) {
  const dir = path.join(dataDirectory(), 'backups');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const name = `${manual ? 'manual-' : ''}${Date.now()}-${randomBytes(8).toString('hex')}.sqlite`;
  const temp = path.join(dir, '.' + name + '.tmp');
  try {
    backupDatabase(temp);
    chmodSync(temp, 0o600);
    const snapshot = openSync(temp, 'r');
    try { fsyncSync(snapshot); } finally { closeSync(snapshot); }
    const assetDir=path.join(dataDirectory(),'catalog-assets'),assetFiles=new Map();
    if (lstatSafe(assetDir)?.isDirectory()) for(const file of readdirSync(assetDir)){
      if(!/^[a-f0-9]{64}\.webp$/.test(file))continue;
      const full=path.join(assetDir,file);if(!lstatSync(full).isFile())throw new Error('Neplatná příloha při záloze.');
      const bytes=readFileSync(full);if(createHash('sha256').update(bytes).digest('hex')!==file.slice(0,64))throw new Error('Poškozená příloha při záloze.');
      assetFiles.set('catalog-assets/'+file,bytes);
    }
    if(assetFiles.size){writeFileSync(temp+'.assets',writeZip(assetFiles,snapshotZipLimits),{mode:0o600,flush:true});renameSync(temp+'.assets',path.join(dir,name+'.assets.zip'));}
    renameSync(temp, path.join(dir, name));
    const directory = openSync(dir, 'r');
    try { fsyncSync(directory); } finally { closeSync(directory); }
    return name;
  } finally {
    for(const candidate of [temp,temp+'.assets'])try{unlinkSync(candidate);}catch(error){if(error.code!=='ENOENT')throw error;}
  }
}

export function snapshots() {
  const dir = path.join(dataDirectory(), 'backups');
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  return entries.flatMap(entry => {
    const match = entry.name.match(namePattern);
    if (!match || !entry.isFile()) return [];
    try {
      const stat = lstatSync(path.join(dir, entry.name));
      if (!stat.isFile()) return [];
      return [{ name: entry.name, manual: Boolean(match[1]), size: stat.size,
        createdAt: new Date(Number(match[2])).toJSON() }];
    } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  }).sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

export async function downloadSnapshot(name, res, bundle = false) {
  if (!namePattern.test(name ?? '')) return false;
  let file;
  try { file = await open(path.join(dataDirectory(), 'backups', name), constants.O_RDONLY | constants.O_NOFOLLOW); }
  catch (error) { if (['ENOENT', 'ELOOP'].includes(error.code)) return false; throw error; }
  try {
    const stat = await file.stat();
    if (!stat.isFile()) return false;
    if(bundle){
      if(stat.size>128_000_000)throw new Error('Databáze překračuje limit přenosné serverové zálohy.');
      const files=new Map([['game.sqlite',await file.readFile()]]);
      let assets;
      try{assets=await open(path.join(dataDirectory(),'backups',name+'.assets.zip'),constants.O_RDONLY|constants.O_NOFOLLOW);
        const assetStat=await assets.stat();if(!assetStat.isFile()||assetStat.size>140_000_000)throw new Error('Neplatná záloha příloh.');
        for(const [key,value]of readZip(await assets.readFile(),snapshotZipLimits))files.set(key,value);
      }catch(error){if(error.code!=='ENOENT')throw error;}finally{await assets?.close();}
      const data=writeZip(files,snapshotZipLimits);
      res.writeHead(200,{'Content-Type':'application/zip','Content-Length':data.length,'Content-Disposition':`attachment; filename="${name.replace('.sqlite','.zip')}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);return true;
    }
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream', 'Content-Length': stat.size,
      'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    const stream = file.createReadStream();
    res.once('close', () => stream.destroy());
    stream.on('error', () => res.destroy());
    stream.pipe(res);
    file = undefined; // The stream owns the open file descriptor.
    return true;
  } finally { await file?.close(); }
}

export function storageStatus() {
  const dir = dataDirectory();
  const volume = statfsSync(dir);
  const databaseBytes = ['game.sqlite', 'game.sqlite-wal'].reduce((total, name) => {
    try { return total + statSync(path.join(dir, name)).size; }
    catch (error) { if (error.code === 'ENOENT') return total; throw error; }
  }, 0);
  return { databaseBytes, freeBytes: volume.bavail * volume.bsize };
}
