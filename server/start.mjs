import {catalogApi,catalogAsset} from './catalog-api.mjs';
import {createServer,request} from 'node:http';
import {readFileSync,existsSync,writeFileSync,unlinkSync,readdirSync,openSync,fsyncSync,closeSync,statfsSync} from 'node:fs';
import {randomBytes,createHmac,scryptSync} from 'node:crypto';
import path from 'node:path';
import {startProdServer} from 'vinext/server/prod-server';
import {openDatabase,dataDirectory} from './database.mjs';
import {createSnapshot,snapshots,downloadSnapshot,storageStatus} from './snapshots.mjs';
import {equal,json,body} from './http.mjs';
const password=process.env.STUL_ADMIN_PASSWORD||'',token=process.env.STUL_UPDATER_TOKEN||'';
if(password.length<20||token.length<32)throw new Error('Nastav STUL_ADMIN_PASSWORD (alespoň 20 znaků) a STUL_UPDATER_TOKEN (alespoň 32 znaků).');
const origin=new URL(process.env.PUBLIC_ORIGIN||'http://localhost:8080');
if(!['http:','https:'].includes(origin.protocol)||origin.username||origin.password||origin.pathname!=='/')throw new Error('PUBLIC_ORIGIN musí obsahovat pouze http(s) původ.');
const info=JSON.parse(readFileSync('dist/stul-build.json','utf8'));
const flag=path.join(dataDirectory(),'maintenance');
function syncMaintenanceFlag(){
 const directory=openSync(dataDirectory(),'r');
 try{fsyncSync(directory);}finally{closeSync(directory);}
}
openDatabase();
const internal=await startProdServer({host:'127.0.0.1',port:0,silent:true});
const salt=randomBytes(32),hash=scryptSync(password,salt,32),sessionKey=randomBytes(32);
let inFlight=0,draining=false;
const attempts=new Map();
function session(value){return createHmac('sha256',sessionKey).update(value).digest('hex');}
function authorized(req){const cookie=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('stul_admin='))?.slice(11)||'';const [expiry,nonce,signature]=cookie.split('.');return Number(expiry)>Date.now()&&Number(expiry)<Date.now()+8*3600e3+1000&&equal(signature,session(`${expiry}.${nonce}`));}
function cookie(value,age){return `stul_admin=${value}; HttpOnly; SameSite=Strict; Path=/admin; Max-Age=${age}${origin.protocol==='https:'?'; Secure':''}`;}
async function updater(endpoint,method='GET',data,refresh=false){const url=new URL(process.env.STUL_UPDATER_URL||'http://updater:8090');if(url.protocol!=='http:'||url.username||url.password)throw new Error('Neplatná adresa aktualizátoru.');url.pathname=endpoint;url.search=refresh?'?refresh':'';let response;try{response=await fetch(url,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(45000)});}catch{throw new Error('Aktualizační služba není dostupná. Ověř, že běží Docker updater.');}const result=await response.json();if(!response.ok)throw new Error(result.error||'Aktualizační služba není dostupná.');return result;}
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 const {pathname}=url;
 if(pathname==='/api/game'&&req.method==='POST'){const disk=statfsSync(dataDirectory());if(disk.bavail*disk.bsize<16_000_000){console.warn('game_write_denied_low_disk');res.setHeader('Retry-After','60');json(res,503,{error:'Na serveru není dost volného místa. Kontaktuj správce.'});return;}}
 if(pathname.startsWith('/catalog-assets/')){await catalogAsset(req,res,pathname);return;}
 if(pathname==='/healthz'){json(res,200,{ok:true,...info,hostingProtocol:1,maintenance:existsSync(flag)});return;}
 if(pathname.startsWith('/internal/')){
  if(!equal(req.headers.authorization,`Bearer ${token}`)){json(res,401,{error:'Nepovolený přístup.'});return;}
  if(req.method!=='POST'){json(res,405,{error:'Použij POST.'});return;}
  if(pathname==='/internal/maintenance'){
   const b=await body(req);if(b.enabled!==true&&b.enabled!==false)throw new Error('Chybí stav údržby.');
   if(b.enabled){draining=true;writeFileSync(flag,'maintenance',{mode:0o600,flush:true});syncMaintenanceFlag();const end=Date.now()+15000;while(inFlight&&Date.now()<end)await new Promise(r=>setTimeout(r,50));if(inFlight)throw new Error('Požadavky se ještě dokončují.');}
   else{if(existsSync(flag)){unlinkSync(flag);syncMaintenanceFlag();}draining=false;}json(res,200,{ok:true});return;
  }
  if(pathname==='/internal/backup'){
   if(!existsSync(flag)||inFlight)throw new Error('Záloha vyžaduje klidový režim.');
   json(res,200,{name:createSnapshot()});return;
  }
  if(pathname==='/internal/smoke'){
   const db=openDatabase();
   db.prepare('SELECT id, data, version FROM rooms LIMIT 0').all();
   if(db.prepare('PRAGMA quick_check(1)').get()?.quick_check!=='ok')
    throw new Error('Databáze neprošla kontrolou integrity.');
   const migrations=new Set(readdirSync('drizzle').filter(name=>name.endsWith('.sql')));
   if(db.prepare('SELECT name FROM stul_migrations').all().some(row=>!migrations.has(row.name)))
    throw new Error('Databáze obsahuje migraci z novější verze.');
   const local=`http://127.0.0.1:${server.address().port}`;
   const [game,admin,protectedAdmin]=await Promise.all(
    ['/api/game?room=stul-smoke-neexistuje','/admin','/admin/api/status'].map(endpoint=>
      fetch(local+endpoint,{signal:AbortSignal.timeout(5000)})));
   const gameBody=await game.json();
   if(game.status!==404||typeof gameBody.error!=='string'||admin.status!==200||
      !(await admin.text()).includes('Správa instalace')||protectedAdmin.status!==401)
    throw new Error('Herní API nebo administrace neprošly kontrolou.');
   await protectedAdmin.text();
   json(res,200,{ok:true,revision:info.revision});return;
  }
  json(res,404,{error:'Nenalezeno.'});return;
 }
 if(pathname==='/admin'||pathname==='/admin/'||pathname==='/admin/app.js'||pathname==='/admin/catalogs.js'||pathname==='/admin/dialogs.js'){
  if(req.method!=='GET'){json(res,405,{error:'Použij GET.'});return;}
  const js=pathname.endsWith('.js');res.writeHead(200,{'Content-Type':js?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'DENY','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"});res.end(readFileSync(new URL(js?(pathname==='/admin/catalogs.js'?'./admin-catalogs.js':pathname==='/admin/dialogs.js'?'./admin-dialog.js':'./admin.js'):'./admin.html',import.meta.url)));return;
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
  if(pathname==='/admin/api/catalogs'||pathname.startsWith('/admin/api/catalogs/')){
   if(req.method==='POST'&&(draining||existsSync(flag))){json(res,503,{error:'Probíhá údržba. Katalogy nyní neupravuj.'});return;}
   if(req.method==='POST')inFlight++;
   try{await catalogApi(req,res,url);}finally{if(req.method==='POST')inFlight--;}
   return;
  }
  if(pathname==='/admin/api/logout'&&req.method==='POST'){res.setHeader('Set-Cookie',cookie('',0));json(res,200,{ok:true});return;}
  if(pathname==='/admin/api/status'&&req.method==='GET'){
   const local={
    installed:info, hostingProtocol:1, maintenance:existsSync(flag),
    voiceConfigured:Boolean(process.env.STUL_LIVEKIT_URL&&process.env.STUL_LIVEKIT_API_KEY&&process.env.STUL_LIVEKIT_API_SECRET),
    storage:storageStatus(),
   };
   try{
    const remote=await updater('/status','GET',undefined,url.searchParams.has('refresh'));
    const {protocol,hostingConfig,channel,latest,releaseError,updateBlocked,job,locked,automaticKeep,canRollback}=remote;
    json(res,200,{...local,protocol,hostingConfig,channel,latest,releaseError,updateBlocked,job,locked,automaticKeep,canRollback,updaterAvailable:true});
   }catch{
    json(res,200,{...local,updaterAvailable:false,latest:null,job:null,canRollback:false,releaseError:'Aktualizační služba není dostupná. Pro webové aktualizace spusť Docker updater.'});
   }
   return;
  }
  if(pathname==='/admin/api/backups'&&req.method==='GET'){
   json(res,200,{snapshots:snapshots()});return;
  }
  if(pathname==='/admin/api/backups'&&req.method==='POST'){
   if(draining||existsSync(flag)){json(res,409,{error:'Počkej, až skončí údržba.'});return;}
   json(res,201,{name:createSnapshot(true)});return;
  }
  if(pathname==='/admin/api/backup'&&req.method==='GET'){
   if(!await downloadSnapshot(url.searchParams.get('name'),res,url.searchParams.get('bundle')==='1'))json(res,404,{error:'Záloha neexistuje.'});
   return;
  }
  const command=pathname.slice('/admin/api/'.length);
  if(['update','rollback','restore','resolve'].includes(command)&&req.method==='POST'){
   const b=await body(req);
   if(command==='update'&&(typeof b?.expectedSha!=='string'||!/^[a-f0-9]{40}$/.test(b.expectedSha))){
    json(res,400,{error:'Potvrď přesný commit aktualizace.'});return;
   }
   try{
    const {protocol}=await updater('/protocol');
    if(protocol!==1)throw new Error('Aktualizuj nejdřív službu updateru podle provozního návodu.');
    json(res,command==='resolve'?200:202,await updater('/'+command,'POST',b));
   }catch(error){json(res,409,{error:error.message});}
   return;
  }
  json(res,404,{error:'Nenalezeno.'});return;
 }
 const mutates=!['GET','HEAD','OPTIONS'].includes(req.method);
 if(mutates&&(draining||existsSync(flag))){res.setHeader('Retry-After','15');json(res,503,{error:'Probíhá aktualizace stolu. Za chvíli akci zopakuj.'});return;}
 if(mutates)inFlight++;
 let done=false;
 const finish=()=>{if(mutates&&!done){done=true;inFlight--;}};
 const proxy=request({hostname:'127.0.0.1',port:internal.port,path:req.url,method:req.method,headers:req.headers},upstream=>{
  // A disconnected browser does not cancel a mutation already sent to the game.
  upstream.once('end',finish);
  upstream.once('close',finish);
  if(res.destroyed){upstream.resume();return;}
  res.writeHead(upstream.statusCode,upstream.headers);
  res.once('close',()=>upstream.resume());
  upstream.pipe(res);
 });
 proxy.on('error',()=>{
  finish();
  if(res.destroyed)return;
  if(!res.headersSent)json(res,502,{error:'Stůl se spouští.'});
  else res.destroy();
 });
 req.on('aborted',()=>{if(!req.complete)proxy.destroy();});
 req.pipe(proxy);
 }catch(error){console.error(error.message);if(!res.headersSent)json(res,503,{error:'Operaci se nepodařilo dokončit. Podrobnosti jsou v logu serveru.'});else res.destroy();}
});
server.requestTimeout=30000;server.headersTimeout=15000;
server.listen(Number(process.env.PORT||8080),'0.0.0.0',()=>console.log(`U jednoho stolu ${info.version}: port ${process.env.PORT||8080}, správa /admin`));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{server.close();internal.server.close();setTimeout(()=>process.exit(0),2000).unref();});
