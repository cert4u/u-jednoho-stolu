import {eq} from 'drizzle-orm';
import {getDb} from '../../../db';
import {rooms} from '../../../db/schema';
import type {Game} from '../../../lib/game';
import {voiceConfig,voiceToken} from '../../../lib/voice';
const headers={'Cache-Control':'no-store'};
const fail=(error:string,status:number)=>Response.json({error},{status,headers});
async function handle(req:Request){
 try{
  let code:string;
  if(req.method==='GET')code=new URL(req.url).searchParams.get('room')||'';
  else{const raw=await req.text();if(new TextEncoder().encode(raw).length>1024)return fail('Požadavek je příliš velký.',413);let data;try{data=JSON.parse(raw);}catch{return fail('Neplatný požadavek.',400);}code=typeof data?.room==='string'?data.room:'';}
  if(!/^[A-F0-9]{10}$/.test(code))return fail('Neplatná místnost.',400);
  const row=await getDb().select().from(rooms).where(eq(rooms.id,code)).get();
  if(!row)return fail('Připoj se k místnosti.',401);
  const game=JSON.parse(row.data) as Game,credential=req.headers.get('Authorization');
  const member=game.members.find(m=>!m.archived&&credential==='Bearer '+m.token);
  if(!member)return fail('Připoj se k místnosti.',401);
  if(req.method==='GET')return Response.json({enabled:!!voiceConfig()},{headers});
  if(!voiceConfig())return fail('Hlasové volání není na tomto serveru nastavené.',503);
  return Response.json(await voiceToken(code,member),{headers});
 }catch{return fail('Připojení k hovoru se nepodařilo. Zkus to znovu.',503);}
}
export const GET=handle;
export const POST=handle;
