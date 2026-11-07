'use client';
import { useState } from 'react';
import type { SceneryFillOptions } from '../../lib/scenery-fill';
export type FillProposal={options:SceneryFillOptions;count:number;stale:boolean};
export type SceneryFillControlsProps={busy:boolean;hidden:boolean;proposal?:FillProposal;onPreview:(options:SceneryFillOptions)=>void;onApply:()=>Promise<unknown>;onDiscard:()=>void};
export default function SceneryFillControls({busy,hidden,proposal,onPreview,onApply,onDiscard}:SceneryFillControlsProps){
  const [seed,setSeed]=useState('podlaha-1'),[environment,setEnvironment]=useState<SceneryFillOptions['environment']>('auto'),[density,setDensity]=useState<SceneryFillOptions['density']>('sparse');
  const options={seed,environment,density,hidden};
  const changed=Boolean(proposal&&JSON.stringify(proposal.options)!==JSON.stringify(options));
  return <details className="scenery-fill"><summary>Doplnit podlahu střídmě</summary>
    <p>Jen podlahové detaily. Dveře, schody, úzké chodby a obsazená místa zůstanou volné.</p>
    <label>Prostředí návrhu<select value={environment} onChange={e=>{setEnvironment(e.target.value as typeof environment);onDiscard();}}><option value="auto">Podle mapy / univerzální</option><option value="castle">Hrad</option><option value="mine">Důl</option><option value="cave">Jeskyně</option></select></label>
    <label>Hustota<select value={density} onChange={e=>{setDensity(e.target.value as typeof density);onDiscard();}}><option value="sparse">Střídmě</option><option value="balanced">Běžně</option><option value="rich">Více detailů</option></select></label>
    <label>Semínko stafáže<input value={seed} maxLength={80} onChange={e=>{setSeed(e.target.value);onDiscard();}} /></label>
    <div className="scenery-fill-actions"><button type="button" disabled={busy||!seed.trim()} onClick={()=>onPreview(options)}>Navrhnout rozmístění</button><button type="button" disabled={busy} onClick={()=>{setSeed(crypto.randomUUID().slice(0,12));onDiscard();}}>Nové semínko</button></div>
    {proposal&&<><p role="status">Návrh: {proposal.count} prvků{hidden?' · jen PJ':''}. {proposal.stale||changed?'Mapa nebo nastavení se změnily; vytvoř nový návrh.':proposal.count?'Přerušované rámečky v mapě jsou zatím jen náhled.':'Žádné vhodné volné místo; zkus jinou hustotu nebo uprav mapu.'}</p>
      <div className="scenery-fill-actions"><button type="button" disabled={busy||changed||proposal.stale||!proposal.count} onClick={()=>void onApply()}>Vložit návrh jedním tahem</button><button type="button" onClick={onDiscard}>Zahodit návrh</button></div></>}
  </details>;
}
