import assert from 'node:assert/strict';
import {TokenVerifier} from 'livekit-server-sdk';
const base=process.argv[2]||'http://127.0.0.1:5173';
async function game(s,action,values={}){const r=await fetch(base+'/api/game',{method:'POST',headers:{'Content-Type':'application/json',...(s?{Authorization:'Bearer '+s.token}:{})},body:JSON.stringify({action,room:s?.room,...values})});return {status:r.status,...await r.json()};}
async function voice(s,method='POST',values={}){const r=await fetch(base+'/api/voice'+(method==='GET'?'?room='+s.room:''),{method,headers:{Authorization:'Bearer '+s.token,...(method==='POST'?{'Content-Type':'application/json'}:{})},...(method==='POST'?{body:JSON.stringify({room:s.room,...values})}:{})});assert.match(r.headers.get('cache-control'),/no-store/);return {status:r.status,...await r.json()};}
const pj=await game(null,'create',{name:'Hlas PJ'}),player=await game(null,'join',{room:pj.room,name:'Hráč'}),other=await game(null,'create',{name:'Jiný stůl'});
assert.equal((await voice({...pj,token:'bad'})).status,401);assert.equal((await voice({...player,room:other.room})).status,401);assert.equal((await voice({...player,room:'bad'})).status,400);
const config=await voice(pj,'GET');assert.equal(config.status,200);assert(!('token' in config));
if(config.enabled){
 const result=await voice(player,'POST',{identity:pj.game.me,name:'Podvrh',canPublishSources:['camera'],admin:true});assert.equal(result.status,200);assert.equal(typeof result.token,'string');
 const jwt=JSON.parse(Buffer.from(result.token.split('.')[1],'base64url').toString());assert.equal(jwt.sub,player.game.me);assert.equal(jwt.name,'Hráč');assert.equal(jwt.video.room,'stul-'+pj.room);assert.equal(jwt.video.roomJoin,true);assert.equal(jwt.video.canSubscribe,true);assert.equal(jwt.video.canPublish,true);assert.deepEqual(jwt.video.canPublishSources,['microphone']);assert.equal(jwt.video.canPublishData,false);assert(!jwt.video.roomAdmin);assert(!jwt.video.roomRecord);assert(!jwt.video.roomCreate);assert(jwt.exp-Math.floor(Date.now()/1000)<=120);assert(jwt.exp>Date.now()/1000);
 if(process.env.STUL_VOICE_TEST_SECRET){await new TokenVerifier(process.env.STUL_VOICE_TEST_KEY,process.env.STUL_VOICE_TEST_SECRET).verify(result.token);assert(!JSON.stringify(result).includes(process.env.STUL_VOICE_TEST_SECRET));}
 const backup=await (await fetch(base+'/api/game?room='+pj.room+'&download=backup',{headers:{Authorization:'Bearer '+pj.token}})).text();assert(!backup.includes(result.token));
}else assert.equal((await voice(player)).status,503);
assert.equal((await game(pj,'member-archive',{memberId:player.game.me})).status,200);assert.equal((await voice(player)).status,401);assert.equal((await voice(player,'GET')).status,401);
console.log('PASS: voice membership/archival, isolated rooms and identities, no-store, optional configuration'+(config.enabled?', signed short-lived microphone-only grants, no camera/screen/data/admin rights and no stored voice tokens.':', disabled service remains playable.'));
