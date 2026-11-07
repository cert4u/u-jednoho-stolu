import assert from 'node:assert/strict';
import {deflateRawSync} from 'node:zlib';
import {readZip,writeZip,crc32} from '../server/catalog-zip.mjs';
const files=new Map([['catalog.json',Buffer.from('{"schemaVersion":1}')],['bestiary/rat.json',Buffer.from('{"id":"rat"}')]]),zip=writeZip(files);
assert.deepEqual(readZip(zip),files);
for(const path of ['../escape','/absolute','a\\b','a/../x','a//b','c:/x','a\0b'])assert.throws(()=>writeZip(new Map([[path,Buffer.from('x')]])));
const damaged=Buffer.from(zip);damaged[30+'bestiary/rat.json'.length]^=1;assert.throws(()=>readZip(damaged),/CRC/);
const symlink=Buffer.from(zip),central=symlink.indexOf(Buffer.from('504b0102','hex'));symlink.writeUInt32LE((0o120777<<16)>>>0,central+38);assert.throws(()=>readZip(symlink),/Odkazy/);
const large=Buffer.from(zip);large.writeUInt32LE(2_000_000,central+24);assert.throws(()=>readZip(large),/velký/);
const unsafe=writeZip(new Map([['aaa.json',Buffer.from('x')]]));for(let i=0;i<unsafe.length-8;i++)if(unsafe.subarray(i,i+8).toString()==='aaa.json')unsafe.write('../x.txt',i);assert.throws(()=>readZip(unsafe),/cesta/);
function compressedZip(data,claimed=data.length){
 const filename=Buffer.from('catalog.json'),compressed=deflateRawSync(data),crc=crc32(data),local=Buffer.alloc(30),directory=Buffer.alloc(46),end=Buffer.alloc(22);
 local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(8,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(claimed,22);local.writeUInt16LE(filename.length,26);
 directory.writeUInt32LE(0x02014b50);directory.writeUInt16LE(20,6);directory.writeUInt16LE(8,10);directory.writeUInt32LE(crc,16);directory.writeUInt32LE(compressed.length,20);directory.writeUInt32LE(claimed,24);directory.writeUInt16LE(filename.length,28);
 end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(46+filename.length,12);end.writeUInt32LE(30+filename.length+compressed.length,16);
 return Buffer.concat([local,filename,compressed,directory,filename,end]);
}
assert.equal(readZip(compressedZip(Buffer.from('data'))).get('catalog.json').toString(),'data');
assert.throws(()=>readZip(compressedZip(Buffer.alloc(500_000),10)),/komprese/);
assert.throws(()=>readZip(zip,{archive:zip.length-1,total:1000,file:1000,files:10}),/velký/);
assert.throws(()=>readZip(zip,{archive:10000,total:1,file:1000,files:10}),/limit/);
assert.throws(()=>readZip(zip,{archive:10000,total:1000,file:1000,files:1}),/počet/);
console.log('PASS: ZIP roundtrip, stored/deflate, CRC, symlinks, paths, file/count/size limits and bounded decompression.');
