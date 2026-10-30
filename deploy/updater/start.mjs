import {createServer} from 'node:http';
import {UpdateManager} from './manager.mjs';
import {equal,json,body} from './http.mjs';
const token=process.env.STUL_UPDATER_TOKEN||'';if(token.length<32)throw new Error('STUL_UPDATER_TOKEN musí mít alespoň 32 znaků.');
const manager=new UpdateManager();await manager.resume();
createServer(async(req,res)=>{try{if(!equal(req.headers.authorization,`Bearer ${token}`)){json(res,401,{error:'Nepovolený přístup.'});return;}
 if(req.url==='/status'&&req.method==='GET'){json(res,200,await manager.status());return;}
 if(['/update','/rollback'].includes(req.url)&&req.method==='POST'){const b=await body(req);json(res,202,await manager.begin(req.url.slice(1),b.requestId));return;}
 json(res,404,{error:'Nenalezeno.'});}catch(e){json(res,409,{error:e.message});}}).listen(8090,'0.0.0.0');
