import http from 'node:http';
import {spawn} from 'node:child_process';
export function docker(method,endpoint,data){return new Promise((resolve,reject)=>{const req=http.request({socketPath:process.env.DOCKER_SOCKET||'/var/run/docker.sock',path: endpoint,method,headers:data?{'Content-Type':'application/json'}:{}},res=>{let text='';res.setEncoding('utf8');res.on('data',s=>{text+=s;if(text.length>4e6)req.destroy(new Error('Odpověď Dockeru je příliš velká.'));});res.on('end',()=>{if(res.statusCode>=400){reject(new Error(`Docker ${res.statusCode}: ${text.slice(0,500)}`));return;}try{resolve(text?JSON.parse(text):{});}catch{reject(new Error('Neplatná odpověď Dockeru.'));}});});req.setTimeout(120000,()=>req.destroy(new Error('Docker neodpovídá.')));req.on('error',reject);req.end(data?JSON.stringify(data):undefined);});}
export async function buildImage(sha,tag,log){
 if(!/^[a-f0-9]{40}$/.test(sha)||!/^v\d+\.\d+\.\d+$/.test(tag))throw new Error('Neplatná verze.');
 const image=`stul-app:${sha}`;
 await new Promise((resolve,reject)=>{const child=spawn('docker',['build','--pull','--tag',image,'--build-arg',`STUL_VERSION=${tag.slice(1)}`,'--build-arg',`STUL_REVISION=${sha}`,`https://github.com/cert4u/u-jednoho-stolu.git#${sha}`],{stdio:['ignore','pipe','pipe']});
 let tail='';for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{tail=(tail+chunk.toString()).slice(-6000);});
 const timeout=setTimeout(()=>child.kill('SIGKILL'),30*60e3);child.once('error',e=>{clearTimeout(timeout);reject(e);});child.once('exit',code=>{clearTimeout(timeout);if(code===0)resolve();else{log(tail.slice(-2000));reject(new Error(`Sestavení image skončilo s kódem ${code}.`));}});
 });return image;
}
export function replacementConfig(old,image){const {Hostname,Domainname,Image,Cmd,Entrypoint,Healthcheck,OnBuild,...config}=old.Config;
 return {...config,Image:image,HostConfig:old.HostConfig,NetworkingConfig:{EndpointsConfig:Object.fromEntries(Object.keys(old.NetworkSettings.Networks).map(name=>[name,{Aliases:['app',process.env.STUL_APP_CONTAINER||'stul-app']}]))}};
}
