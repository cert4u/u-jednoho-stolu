/** Static WebP only. Bound decoded canvas and every RIFF chunk, not just file magic. */
export function inspectCatalogWebp(bytes:Uint8Array){
  const fail=()=>{throw new Error('Obrázek musí být statický WebP do 1,5 MB a nejvýše 2048 × 2048 bodů, bez metadat.');};
  if(bytes.length<30||bytes.length>1_500_000)fail();
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const ascii=(at:number,n:number)=>String.fromCharCode(...bytes.subarray(at,at+n));
  const u24=(at:number)=>bytes[at]+bytes[at+1]*256+bytes[at+2]*65536;
  if(ascii(0,4)!=='RIFF'||ascii(8,4)!=='WEBP'||view.getUint32(4,true)+8!==bytes.length)fail();
  let width=0,height=0,frames=0,canvasWidth=0,canvasHeight=0;
  for(let at=12;at<bytes.length;){
    if(at+8>bytes.length)fail();
    const type=ascii(at,4),size=view.getUint32(at+4,true),p=at+8;
    if(!['VP8 ','VP8L','VP8X','ALPH','ICCP'].includes(type)||p+size+(size%2)>bytes.length)fail();
    if(size%2&&bytes[p+size]!==0)fail();
    if(type==='VP8X'){
      if(at!==12||size!==10||(bytes[p]&~0x30)!==0)fail();
      canvasWidth=u24(p+4)+1;canvasHeight=u24(p+7)+1;
    }
    if(type==='VP8 '){if(size<10||(bytes[p]&1)||ascii(p+3,3)!=='\x9d\x01\x2a')fail();width=view.getUint16(p+6,true)&0x3fff;height=view.getUint16(p+8,true)&0x3fff;frames++;}
    if(type==='VP8L'){if(size<5||bytes[p]!==0x2f)fail();const bits=view.getUint32(p+1,true);if(bits>>>29)fail();width=(bits&0x3fff)+1;height=((bits>>>14)&0x3fff)+1;frames++;}
    if(width>2048||height>2048||canvasWidth>2048||canvasHeight>2048)fail();
    at=p+size+(size%2);
  }
  if(frames!==1||!width||!height||(canvasWidth&&(canvasWidth!==width||canvasHeight!==height)))fail();
  return {width,height};
}
