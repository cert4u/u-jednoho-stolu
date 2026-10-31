'use client';
import {useState} from 'react';
import {defaultDoorSettings,type Dungeon} from '../lib/dungeon';
export default function DoorSettingsPanel({map,edge,busy,onSave}:{map:Dungeon;edge:string;busy:boolean;onSave:(values:Record<string,unknown>)=>Promise<unknown>}){
 const [initial]=useState(()=>({...map.doorSettings?.[edge]||defaultDoorSettings()})),[locked,setLocked]=useState(initial.locked),[secret,setSecret]=useState(initial.secret),[discovered,setDiscovered]=useState(initial.discovered);
 const changed=locked!==initial.locked||secret!==initial.secret||discovered!==initial.discovered;
 return <form data-dirty={changed} onSubmit={e=>{e.preventDefault();void onSave({tool:'door-settings',edge,locked,secret,discovered,expected:initial});}}><h3>Nastavení dveří</h3><label className="map-note-notify"><input type="checkbox" checked={locked} disabled={busy} onChange={e=>setLocked(e.target.checked)}/> Zamčené</label><label className="map-note-notify"><input type="checkbox" checked={secret} disabled={busy} onChange={e=>{setSecret(e.target.checked);if(e.target.checked)setDiscovered(false);}}/> Tajné dveře</label>{secret&&<label className="map-note-notify"><input type="checkbox" checked={discovered} disabled={busy} onChange={e=>setDiscovered(e.target.checked)}/> Odhalené družině</label>}<p className="sheet-hint">Neodhalené tajné dveře jsou pro hráče zdí. Zamčení nebo skrytí dveře zavře. Zkoušku hledání či odemykání vyhodnoť zvlášť a výsledek potvrď tady.</p><button className="primary" disabled={busy||!changed}>Uložit nastavení dveří</button></form>;
}
