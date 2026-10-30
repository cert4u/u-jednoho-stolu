'use client';
import {useEffect,useState} from 'react';
import {MapPin,X} from 'lucide-react';
import type {MapNoteAlertView} from '../lib/map-note-alerts';
export default function MapNoteNotifications({alerts,room,me,loading,onOpen}:{alerts:MapNoteAlertView[];room:string;me:string;loading:boolean;onOpen:(alert:MapNoteAlertView,opened:()=>void)=>void}){
 const key=`stul-note-alerts:${room}:${me}`,[seen,setSeen]=useState<Set<string>|null>(null);
 useEffect(()=>{const load=()=>{try{const ids=JSON.parse(localStorage.getItem(key)||'[]');setSeen(new Set(Array.isArray(ids)?ids.filter((id:unknown)=>typeof id==='string').slice(-512):[]));}catch{setSeen(new Set());}};load();const changed=(e:StorageEvent)=>{if(e.key===key)load();};window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);},[key]);
 function remember(ids:string[]){const next=new Set([...(seen||[]),...ids]);const saved=[...next].slice(-512);setSeen(new Set(saved));try{localStorage.setItem(key,JSON.stringify(saved));}catch{}}
 const pending=seen?alerts.filter(a=>!seen.has(a.id)):[],active=pending[0];if(!active)return null;
 return <aside className="map-note-toast" role="status" aria-live="polite" aria-label="Upozornění pro PJ"><button className="map-note-toast-close" aria-label="Zavřít upozornění" onClick={()=>remember([active.id])}><X size={15}/></button><span className="eyebrow"><MapPin size={14}/> JEN PRO PJ</span><strong>Družina se přiblížila k místu</strong><p>{active.title}</p><small>{active.levelName} · políčko {active.x+1}, {active.y+1}{pending.length>1?` · ${pending.length} upozornění`:''}</small><div><button disabled={loading} onClick={()=>onOpen(active,()=>remember([active.id]))}>{loading?'Načítání…':'Otevřít přípravu'}</button><button onClick={()=>remember([active.id])}>Rozumím</button></div>{pending.length>1&&<button className="map-note-toast-all" onClick={()=>remember(pending.map(a=>a.id))}>Označit vše jako přečtené</button>}</aside>;
}
