import {AccessToken,TrackSource} from 'livekit-server-sdk';
import type {Member} from './game';
export function voiceConfig(){
 const url=process.env.STUL_LIVEKIT_URL||'',key=process.env.STUL_LIVEKIT_API_KEY||'',secret=process.env.STUL_LIVEKIT_API_SECRET||'';
 if(!url||!key||secret.length<32)return null;
 try{const u=new URL(url);if(!['ws:','wss:'].includes(u.protocol)||u.username||u.password||u.search||u.hash)return null;if(u.protocol==='ws:'&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname))return null;}catch{return null;}
 return {url,key,secret};
}
export async function voiceToken(room:string,member:Pick<Member,'id'|'name'>){
 const config=voiceConfig();if(!config)throw new Error('Hlasové volání není na tomto serveru nastavené.');
 const token=new AccessToken(config.key,config.secret,{identity:member.id,name:member.name,ttl:120});
 token.addGrant({roomJoin:true,room:'stul-'+room,canSubscribe:true,canPublish:true,canPublishSources:[TrackSource.MICROPHONE],canPublishData:false,canUpdateOwnMetadata:false});
 return {url:config.url,token:await token.toJwt()};
}
