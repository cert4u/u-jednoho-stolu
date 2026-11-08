'use client';
import {useCatalog} from '../catalog-provider';
import { useState } from 'react';
import { type Scenery } from '../../lib/scenery';
import {sceneryChoices,type SceneryCategory,type SceneryEnvironment} from '../../lib/scenery-catalog';
import SceneryFillControls,{type SceneryFillControlsProps} from './fill-controls';
import SceneryGlyph from './glyph';
export type SceneryBrush = Pick<Scenery,'kind'|'rotation'|'size'|'hidden'>;
type Category=SceneryCategory;
export default function SceneryPalette({brush,onChange,moving,onCancelMove,fill,surfaceOp,onSurfaceOp}:{
  brush:SceneryBrush;onChange:(next:SceneryBrush)=>void;moving:boolean;onCancelMove:()=>void;fill:SceneryFillControlsProps;
  surfaceOp:'add'|'remove';onSurfaceOp:(op:'add'|'remove')=>void;
}){
  const {scenery:sceneryCatalog,refresh,error}=useCatalog();
  const [environment,setEnvironment]=useState<SceneryEnvironment>('all');
  const [category,setCategory]=useState<Category>('object');
  const choose=(nextCategory:Category,nextEnvironment=environment)=>{
    setCategory(nextCategory);setEnvironment(nextEnvironment);
    const entry=sceneryChoices(nextCategory,nextEnvironment,sceneryCatalog)[0];
    if(entry)onChange({...brush,kind:entry.id});
  };
  const area=Boolean(sceneryCatalog.find(item=>item.id===brush.kind)?.surface);
  return <section className="scenery-palette" aria-label="Stafáž mapy">
    <button type="button" onClick={()=>void refresh()}>Obnovit katalogy</button>{error&&<p role="status">{error}</p>}
    <div className="scenery-palette-heading"><strong>Stafáž</strong><label>Prostředí<select value={environment} onChange={event=>choose(category,event.target.value as typeof environment)}>
      <option value="all">Všechna</option><option value="castle">Hrad</option><option value="mine">Důl</option><option value="cave">Jeskyně</option>
    </select></label></div>
    <div className="scenery-categories" role="group" aria-label="Druh stafáže">{(['object','floor','area'] as const).map(value=><button key={value} type="button" aria-pressed={category===value} onClick={()=>choose(value)}>{({object:'Předměty',floor:'Podlahové značky',area:'Plochy'})[value]}</button>)}</div>
    <div className="scenery-choices" role="group" aria-label="Prvky stafáže">
      {sceneryChoices(category,environment,sceneryCatalog).map(item=><button type="button" key={item.id} aria-pressed={brush.kind===item.id} aria-label={item.name} title={`${item.name} · ${item.id}`} onClick={()=>onChange({...brush,kind:item.id})}>
        <svg viewBox="0 0 32 32" aria-hidden="true"><SceneryGlyph kind={item.id}/></svg><span>{item.name}</span>
      </button>)}
    </div>
    <div className="scenery-brush-controls">
      {area?<div className="scenery-categories" role="group" aria-label="Tah plochy">{(['add','remove'] as const).map(op=><button key={op} type="button" aria-pressed={surfaceOp===op} onClick={()=>onSurfaceOp(op)}>{op==='add'?'Přidat':'Ubrat'}</button>)}</div>:<label>Velikost<select value={brush.size} onChange={event=>onChange({...brush,size:event.target.value as Scenery['size']})}><option value="small">Malá</option><option value="medium">Střední</option><option value="large">Velká</option></select></label>}
      <label className="scenery-hidden"><input type="checkbox" checked={Boolean(brush.hidden)} onChange={event=>onChange({...brush,hidden:event.target.checked})}/>Jen PJ</label>
    </div>
    {!area&&category==='object'&&<details className="scenery-rotation"><summary>Otočení předmětu</summary><button type="button" onClick={()=>onChange({...brush,rotation:((brush.rotation+90)%360) as Scenery['rotation']})}>Otočit · {brush.rotation}°</button></details>}
    {moving?<p role="status">Klikni na nové místo prvku. <button type="button" onClick={onCancelMove}>Zrušit přesun</button></p>:<p>{area?'Táhni přes podlahu: sousedící plochy stejného materiálu se spojí. Ubrat maže jen vybraný materiál. Enter upraví jedno políčko; Escape zruší tah.':'Kliknutím vložíš prvek nebo otevřeš úpravy. Šipky a Enter fungují také.'}</p>}
    {!area&&<SceneryFillControls {...fill}/>}
  </section>;
}
