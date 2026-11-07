import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const dir=mkdtempSync(path.join(tmpdir(),'stul-catalog-migrate-'));
try{
 const db=new DatabaseSync(path.join(dir,'game.sqlite')),name='0000_complex_sharon_ventura.sql',sql=readFileSync('drizzle/'+name,'utf8');
 db.exec(sql);db.exec('CREATE TABLE stul_migrations(name TEXT PRIMARY KEY, hash TEXT NOT NULL)');
 db.prepare('INSERT INTO stul_migrations VALUES (?,?)').run(name,createHash('sha256').update(sql).digest('hex'));
 db.prepare('INSERT INTO rooms(id,data,version) VALUES (?,?,?)').run('OLD','{"title":"Původní"}',7);db.close();
 const child=spawnSync(process.execPath,['--input-type=module','-e',`import {openDatabase} from './server/database.mjs';const db=openDatabase();if(db.prepare('SELECT version FROM rooms WHERE id=?').get('OLD').version!==7)process.exit(2);if(!db.prepare('SELECT name FROM sqlite_master WHERE name=?').get('catalogs'))process.exit(3);`],{env:{...process.env,STUL_DATA_DIR:dir},encoding:'utf8'});
 assert.equal(child.status,0,child.stderr);
 const reopened=spawnSync(process.execPath,['--input-type=module','-e',"import {openDatabase} from './server/database.mjs';if(openDatabase().prepare('SELECT count(*) n FROM stul_migrations').get().n!==2)process.exit(4);"],{env:{...process.env,STUL_DATA_DIR:dir},encoding:'utf8'});
 assert.equal(reopened.status,0,reopened.stderr);
 console.log('PASS: catalog migration on an existing SQLite installation preserves campaign data and is idempotent after restart.');
}finally{rmSync(dir,{recursive:true,force:true});}
