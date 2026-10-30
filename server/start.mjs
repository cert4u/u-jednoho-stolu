import {createServer,request} from 'node:http';
import {readFileSync,existsSync,writeFileSync,unlinkSync,mkdirSync} from 'node:fs';
import {randomBytes,createHmac,scryptSync} from 'node:crypto';
import path from 'node:path';
import {startProdServer} from 'vinext/server/prod-server';
import {openDatabase,backupDatabase,dataDirectory} from './database.mjs';
import {equal,json,body} from './http.mjs';
const password=process.env.STUL_ADMIN_PASSWORD||'',token=process.env.STUL_UPDATER_TOKEN||'';
if(password.length<20||token.length<32)throw new Error('Nastav STUL_ADMIN_PASSWORD (alespoň 20 znaků) a STUL_UPDATER_TOKEN (alespoň 32 znaků).');
const origin=new URL(process.env.PUBLIC_ORIGIN||'http://localhost:8080');
if(!['http:','https:'].includes(origin.protocol)||origin.username||origin.password||origin.pathname!=='/')throw new Error('PUBLIC_ORIGIN musí obsahovat pouze http(s) původ.');
const info=JSON.parse(readFileSync('dist/stul-build.json','utf8'));
const flag=path.join(dataDirectory(),'maintenance');
openDatabase();
const internal=await startProdServer({host:'127.0.0.1',port:0,silent:true});
const salt=randomBytes(32),hash=scryptSync(password,salt,32),sessionKey=randomBytes(32);
let inFlight=0,draining=false;
const attempts=new Map();
function session(value){return createHmac('sha256',sessionKey).update(value).digest('hex');}
function authorized(req){const cookie=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('stul_admin='))?.slice(11)||'';const [expiry,nonce,signature]=cookie.split('.');return Number(expiry)>Date.now()&&Number(expiry)<Date.now()+8*3600e3+1000&&equal(signature,session(`${expiry}.${nonce}`));}
function cookie(value,age){return `stul_admin=${value}; HttpOnly; SameSite=Strict; Path=/admin; Max-Age=${age}${origin.protocol==='https:'?'; Secure':''}`;}
async function updater(endpoint,method='GET',data){const url=new URL(process.env.STUL_UPDATER_URL||'http://updater:8090');if(url.protocol!=='http:'||url.username||url.password)throw new Error('Neplatná adresa aktualizátoru.');url.pathname=endpoint;url.search='';let response;try{response=await fetch(url,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(20000)});}catch{throw new Error('Aktualizační služba není dostupná. Ověř, že běží Docker updater.');}const result=await response.json();if(!response.ok)throw new Error(result.error||'Aktualizační služba není dostupná.');return result;}
const server=createServer(async(req,res)=>{try{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/healthz'){json(res,200,{ok:true,...info,maintenance:existsSync(flag)});return;}
 if(pathname.startsWith('/internal/')){
  if(!equal(req.headers.authorization,`Bearer ${token}`)){json(res,401,{error:'Nepovolený přístup.'});return;}
  if(req.method!=='POST'){json(res,405,{error:'Použij POST.'});return;}
  if(pathname==='/internal/maintenance'){
   const b=await body(req);if(b.enabled!==true&&b.enabled!==false)throw new Error('Chybí stav údržby.');
   if(b.enabled){draining=true;writeFileSync(flag,'maintenance',{mode:0o600});const end=Date.now()+15000;while(inFlight&&Date.now()<end)await new Promise(r=>setTimeout(r,50));if(inFlight)throw new Error('Požadavky se ještě dokončují.');}
   else{if(existsSync(flag))unlinkSync(flag);draining=false;}json(res,200,{ok:true});return;
  }
  if(pathname==='/internal/backup'){
   if(!existsSync(flag)||inFlight)throw new Error('Záloha vyžaduje klidový režim.');
   mkdirSync(path.join(dataDirectory(),'backups'),{recursive:true,mode:0o700});
   const name=`${Date.now()}-${randomBytes(8).toString('hex')}.sqlite`;backupDatabase(path.join(dataDirectory(),'backups',name));json(res,200,{name});return;
  }
  json(res,404,{error:'Nenalezeno.'});return;
 }
 if(pathname==='/admin'||pathname==='/admin/'||pathname==='/admin/app.js'){
  if(req.method!=='GET'){json(res,405,{error:'Použij GET.'});return;}
  const js=pathname.endsWith('.js');res.writeHead(200,{'Content-Type':js?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'DENY','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"});res.end(readFileSync(new URL(js?'./admin.js':'./admin.html',import.meta.url)));return;
 }
 if(pathname.startsWith('/admin/api/')){
  if(req.method==='POST'&&req.headers.origin!==origin.origin){json(res,403,{error:'Neplatný původ požadavku.'});return;}
  if(pathname==='/admin/api/login'&&req.method==='POST'){
   const address=req.socket.remoteAddress||'unknown',now=Date.now();for(const [key,item] of attempts)if(item.until<now)attempts.delete(key);
   const attempt=attempts.get(address)||{count:0,until:now+15*60e3};if(attempt.count>=10){json(res,429,{error:'Příliš mnoho pokusů. Zkus to za 15 minut.'});return;}attempt.count++;attempts.set(address,attempt);
   const b=await body(req);if(typeof b.password!=='string'||b.password.length>1024||!equal(scryptSync(b.password,salt,32),hash)){json(res,401,{error:'Nesprávné heslo správce instalace.'});return;}
   attempts.delete(address);const value=`${now+8*3600e3}.${randomBytes(24).toString('hex')}`;res.setHeader('Set-Cookie',cookie(`${value}.${session(value)}`,8*3600));json(res,200,{ok:true});return;
  }
  if(!authorized(req)){json(res,401,{error:'Přihlas se jako správce instalace.'});return;}
  if(pathname==='/admin/api/logout'&&req.method==='POST'){res.setHeader('Set-Cookie',cookie('',0));json(res,200,{ok:true});return;}
  if(pathname==='/admin/api/status'&&req.method==='GET'){
   try{json(res,200,{installed:info,...await updater('/status'),updaterAvailable:true});}
   catch{json(res,200,{installed:info,updaterAvailable:false,latest:null,job:null,canRollback:false,releaseError:'Aktualizační služba není dostupná. Správa instalace funguje, aktualizace a návrat verze jsou do připojení služby vypnuté. Pro aktualizace spusť aplikaci přes Docker Compose.'});}
   return;
  }
  if(['/admin/api/update','/admin/api/rollback'].includes(pathname)&&req.method==='POST'){const b=await body(req);json(res,202,await updater(pathname.endsWith('rollback')?'/rollback':'/update','POST',b));return;}
  json(res,404,{error:'Nenalezeno.'});return;
 }
 if((draining||existsSync(flag))&&!['GET','HEAD','OPTIONS'].includes(req.method)){res.setHeader('Retry-After','15');json(res,503,{error:'Probíhá aktualizace stolu. Za chvíli akci zopakuj.'});return;}
 inFlight++;let done=false;const finish=()=>{if(!done){done=true;inFlight--;}};res.once('close',finish);res.once('finish',finish);
 const proxy=request({hostname:'127.0.0.1',port:internal.port,path:req.url,method:req.method,headers:req.headers},upstream=>{res.writeHead(upstream.statusCode,upstream.headers);upstream.pipe(res);});proxy.on('error',()=>{if(!res.headersSent)json(res,502,{error:'Stůl se spouští.'});else res.destroy();});req.on('aborted',()=>proxy.destroy());req.pipe(proxy);
 }catch(error){console.error(error.message);if(!res.headersSent)json(res,503,{error:error.message});else res.destroy();}
});
server.requestTimeout=30000;server.headersTimeout=15000;
server.listen(Number(process.env.PORT||8080),'0.0.0.0',()=>console.log(`U jednoho stolu ${info.version}: port ${process.env.PORT||8080}, správa /admin`));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{server.close();internal.server.close();setTimeout(()=>process.exit(0),2000).unref();});
