import {inflateRawSync} from 'node:zlib';
// ZIP32, stored/deflate only. Files are decoded into bounded memory, never extracted.
export const zipLimits={archive:40_000_000,total:32_000_000,file:1_500_000,files:700};
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
export function crc32(data){let crc=0xffffffff;for(const byte of data)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
export function safeZipPath(name){
 if(typeof name!=='string'||name.length>240||!/^[A-Za-z0-9_.\-/]+$/.test(name)||name.startsWith('/')||name.includes('//')||name.split('/').some(p=>p==='.'||p==='..'))throw new Error('Nebezpečná cesta v ZIP archivu.');
 return name;
}
function extraFields(data){for(let i=0;i<data.length;){if(i+4>data.length)throw new Error('Poškozená ZIP metadata.');const id=data.readUInt16LE(i),size=data.readUInt16LE(i+2);if(id===1||id===0x7075||i+4+size>data.length)throw new Error('ZIP64 a alternativní cesty nejsou podporované.');i+=4+size;}}
export function readZip(input,limits=zipLimits){
 const data=Buffer.from(input);if(data.length<22||data.length>limits.archive)throw new Error('ZIP archiv je prázdný nebo příliš velký.');
 let end=-1;
 for(let i=data.length-22;i>=Math.max(0,data.length-65557);i--)if(data.readUInt32LE(i)===0x06054b50&&i+22+data.readUInt16LE(i+20)===data.length){end=i;break;}
 if(end<0||data.readUInt16LE(end+4)||data.readUInt16LE(end+6))throw new Error('Poškozený nebo vícedílný ZIP archiv.');
 const count=data.readUInt16LE(end+10),size=data.readUInt32LE(end+12),start=data.readUInt32LE(end+16);
 if(!count||count>limits.files||count!==data.readUInt16LE(end+8)||start+size!==end)throw new Error('Nepodporovaná struktura nebo počet souborů ZIP.');
 const files=new Map(),names=new Set(),ranges=[];let total=0,at=start;
 for(let i=0;i<count;i++){
  if(at+46>end||data.readUInt32LE(at)!==0x02014b50)throw new Error('Poškozený centrální adresář ZIP.');
  const flags=data.readUInt16LE(at+8),method=data.readUInt16LE(at+10),crc=data.readUInt32LE(at+16),compressed=data.readUInt32LE(at+20),length=data.readUInt32LE(at+24),nameLength=data.readUInt16LE(at+28),extraLength=data.readUInt16LE(at+30),commentLength=data.readUInt16LE(at+32),disk=data.readUInt16LE(at+34),attributes=data.readUInt32LE(at+38),offset=data.readUInt32LE(at+42);
  const next=at+46+nameLength+extraLength+commentLength;
  if(next>end||disk||flags&~0x808||![0,8].includes(method)||length>limits.file||offset+30>start||data.readUInt32LE(offset)!==0x04034b50)throw new Error('Nepodporovaný nebo příliš velký soubor ZIP.');
  const nameBytes=data.subarray(at+46,at+46+nameLength),name=safeZipPath(new TextDecoder('utf-8',{fatal:true}).decode(nameBytes)),mode=(attributes>>>16)&0xf000;
  if(names.has(name.toLowerCase()))throw new Error('Duplicitní cesta v ZIP archivu.');names.add(name.toLowerCase());
  const directory=name.endsWith('/');
  if(mode&&mode!==(directory?0x4000:0x8000)||!directory&&((attributes>>>16)&0o111))throw new Error('Odkazy, speciální a spustitelné soubory nejsou povolené.');
  extraFields(data.subarray(at+46+nameLength,at+46+nameLength+extraLength));
  const localName=data.readUInt16LE(offset+26),localExtra=data.readUInt16LE(offset+28),body=offset+30+localName+localExtra;
  if(body+compressed>start||data.readUInt16LE(offset+6)!==flags||data.readUInt16LE(offset+8)!==method||!nameBytes.equals(data.subarray(offset+30,offset+30+localName)))throw new Error('Rozpor lokálního a centrálního záznamu ZIP.');
  extraFields(data.subarray(offset+30+localName,body));
  ranges.push([offset,body+compressed]);total+=length;if(total>limits.total)throw new Error('Rozbalený ZIP překračuje povolený limit.');
  let decoded;
  try{decoded=method===0?data.subarray(body,body+compressed):inflateRawSync(data.subarray(body,body+compressed),{maxOutputLength:Math.max(1,length)});}catch{throw new Error('Poškozená nebo příliš rozsáhlá komprese ZIP.');}
  if(decoded.length!==length||crc32(decoded)!==crc||directory&&length)throw new Error('ZIP neprošel kontrolou délky nebo CRC.');
  if(!directory)files.set(name,Buffer.from(decoded));at=next;
 }
 if(at!==end)throw new Error('Neplatná délka centrálního adresáře ZIP.');
 ranges.sort((a,b)=>a[0]-b[0]);if(ranges[0][0]!==0||ranges.some((r,i)=>i&&r[0]<ranges[i-1][1]))throw new Error('Překrývající se data ZIP nejsou povolená.');
 return files;
}
export function writeZip(files,limits=zipLimits){
 if(!files.size||files.size>limits.files)throw new Error('Příliš mnoho souborů pro ZIP.');
 const local=[],central=[];let offset=0,total=0;
 for(const [name,value]of [...files.entries()].sort(([a],[b])=>a.localeCompare(b,'en'))){
  safeZipPath(name);const bytes=Buffer.from(value),encoded=Buffer.from(name),crc=crc32(bytes);
  total+=bytes.length;if(bytes.length>limits.file||total>limits.total)throw new Error('Příliš velký obsah ZIP.');
  const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(0x21,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(bytes.length,18);header.writeUInt32LE(bytes.length,22);header.writeUInt16LE(encoded.length,26);
  const record=Buffer.alloc(46);record.writeUInt32LE(0x02014b50);record.writeUInt16LE(0x314,4);record.writeUInt16LE(20,6);record.writeUInt16LE(0x800,8);record.writeUInt16LE(0x21,14);record.writeUInt32LE(crc,16);record.writeUInt32LE(bytes.length,20);record.writeUInt32LE(bytes.length,24);record.writeUInt16LE(encoded.length,28);record.writeUInt32LE((0o100600<<16)>>>0,38);record.writeUInt32LE(offset,42);
  local.push(header,encoded,bytes);central.push(record,encoded);offset+=header.length+encoded.length+bytes.length;
 }
 const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.size,8);end.writeUInt16LE(files.size,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
 const result=Buffer.concat([...local,directory,end]);if(result.length>limits.archive)throw new Error('ZIP archiv překračuje velikostní limit.');return result;
}
