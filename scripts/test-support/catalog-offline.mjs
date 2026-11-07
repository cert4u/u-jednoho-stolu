import {appendFileSync} from 'node:fs';
const transport=globalThis.fetch;
globalThis.fetch=async(input,options)=>{
 const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
 if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)){
  appendFileSync(process.env.STUL_AUDIT_NETWORK_LOG,'Unexpected outbound request: '+url.origin+'\n');
  throw Error('Audit: síť mimo localhost je vypnutá.');
 }
 return transport(input,options);
};
