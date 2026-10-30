import assert from 'node:assert/strict';
// Optional native test SDK; kept out of application dependencies.
const {Room,RoomEvent,AudioSource,AudioFrame,AudioStream,LocalAudioTrack,TrackPublishOptions,TrackSource,dispose}=await import(process.env.STUL_RTC_SDK||'@livekit/rtc-node');
const base=process.argv[2]||'http://127.0.0.1:18089';
if(!['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname))throw Error('Use an isolated local test server.');
async function request(endpoint,body,session){const response=await fetch(base+endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.token}:{})},body:JSON.stringify(body)});assert.equal(response.status,200);return response.json();}
const a=await request('/api/game',{action:'create',name:'Test audio A'}),b=await request('/api/game',{action:'join',room:a.room,name:'Test audio B'});
const ta=await request('/api/voice',{room:a.room},a),tb=await request('/api/voice',{room:b.room},b);
const sender=new Room(),receiver=new Room();let source,track,reader,timer;
try{
 const received=new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(Error('No remote audio received')),12000);receiver.on(RoomEvent.TrackSubscribed,remote=>{void(async()=>{reader=new AudioStream(remote,48000,1).getReader();let loud=0;for(let i=0;i<300;i++){const result=await reader.read();if(result.done)break;if(result.value.data.some(v=>Math.abs(v)>100))loud++;if(loud>=10){resolve(loud);return;}}reject(Error('Received only silence'));})().catch(reject);});});
 await receiver.connect(tb.url,tb.token,{autoSubscribe:true});await sender.connect(ta.url,ta.token);
 source=new AudioSource(48000,1);track=LocalAudioTrack.createAudioTrack('synthetic-microphone',source);const options=new TrackPublishOptions();options.source=TrackSource.SOURCE_MICROPHONE;
 await sender.localParticipant.publishTrack(track,options);
 const send=(async()=>{for(let i=0;i<200;i++){const samples=Int16Array.from({length:480},(_,j)=>Math.round(4000*Math.sin(2*Math.PI*440*(i*480+j)/48000)));await source.captureFrame(new AudioFrame(samples,48000,1,480));await new Promise(r=>setTimeout(r,10));}})();
 const loud=await received;await send;console.log('PASS: real LiveKit WebRTC microphone track published; remote client decoded '+loud+' non-silent audio frames using application-issued tokens.');
}finally{clearTimeout(timer);await reader?.cancel();await sender.disconnect();await receiver.disconnect();await track?.close();await source?.close();await dispose();}
