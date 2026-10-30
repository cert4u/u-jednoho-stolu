import {timingSafeEqual} from 'node:crypto';
export function equal(a,b){const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&timingSafeEqual(x,y);}
export function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
export async function body(req,max=4096){let size=0,parts=[];for await(const part of req){size+=part.length;if(size>max)throw new Error('Příliš velký požadavek.');parts.push(part);}return JSON.parse(Buffer.concat(parts).toString()||'{}');}
