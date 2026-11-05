'use client';
import {useEffect,useState} from 'react';
import {MapPin,X,Dices,Swords,Package,ChevronRight} from 'lucide-react';
import type {EncounterLink,MapNoteAlertView} from '../lib/map-note-alerts';
export type EncounterTarget = Pick<EncounterLink, 'kind'|'id'> | {kind:'combat'};
const kinds = {
 challenge: {label:'Zkouška', Icon:Dices},
 monster: {label:'Příšera', Icon:Swords},
 loot: {label:'Kořist', Icon:Package},
};
export default function MapNoteNotifications({alerts,room,me,loading,blocked,onOpen}:{alerts:MapNoteAlertView[];room:string;me:string;loading:boolean;blocked:boolean;onOpen:(alert:MapNoteAlertView,opened:()=>void,target?:EncounterTarget)=>void}){
 const key=`stul-note-alerts:${room}:${me}`,[seen,setSeen]=useState<Set<string>|null>(null);
 useEffect(()=>{const load=()=>{try{const ids=JSON.parse(localStorage.getItem(key)||'[]');setSeen(new Set(Array.isArray(ids)?ids.filter((id:unknown)=>typeof id==='string').slice(-512):[]));}catch{setSeen(new Set());}};load();const changed=(e:StorageEvent)=>{if(e.key===key)load();};window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);},[key]);
 function remember(ids:string[]){const next=new Set([...(seen||[]),...ids]);const saved=[...next].slice(-512);setSeen(new Set(saved));try{localStorage.setItem(key,JSON.stringify(saved));}catch{}}
 const pending=seen?alerts.filter(a=>!seen.has(a.id)):[],active=pending[0];if(!active||blocked)return null;
 return <aside className="map-note-toast" role="status" aria-live="polite" aria-label="Upozornění pro PJ"><button className="map-note-toast-close" aria-label="Zavřít upozornění" onClick={()=>remember([active.id])}><X size={15}/></button><span className="eyebrow"><MapPin size={14}/> JEN PRO PJ</span><strong>Družina se přiblížila k místu</strong><p>{active.title}</p><small>{active.levelName} · políčko {active.x+1}, {active.y+1}{pending.length>1?` · ${pending.length} upozornění`:''}</small>{active.encounter?.length>0&&<section className="encounter-links" aria-label="Připravené setkání">
 <span className="eyebrow">PŘIPRAVENÉ SETKÁNÍ</span>
 <ul tabIndex={0}>{active.encounter.map(link=>{
  const {label,Icon}=kinds[link.kind];
  return <li key={link.kind+':'+link.id}><button disabled={loading} onClick={()=>onOpen(active,()=>remember([active.id]),link)}>
   <Icon size={15} aria-hidden="true"/><span><small>{label}</small>{link.title}</span><ChevronRight size={14} aria-hidden="true"/>
  </button></li>;
 })}</ul>
 {active.encounter.some(link=>link.kind==='monster')&&<button className="encounter-combat" disabled={loading} onClick={()=>onOpen(active,()=>remember([active.id]),{kind:'combat'})}><Swords size={14} aria-hidden="true"/> Otevřít přípravu souboje</button>}
 </section>}<div><button disabled={loading} onClick={()=>onOpen(active,()=>remember([active.id]))}>{loading?'Načítání…':'Otevřít přípravu'}</button><button onClick={()=>remember([active.id])}>Rozumím</button></div>{pending.length>1&&<button className="map-note-toast-all" onClick={()=>remember(pending.map(a=>a.id))}>Označit vše jako přečtené</button>}</aside>;
}
