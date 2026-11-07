'use client';
import {createContext,useContext,useEffect,useMemo,useState,useCallback,useRef,type ReactNode} from 'react';
import {sceneryCatalog,type SceneryDefinition} from '../lib/scenery-catalog';
import {dungeonPresets} from '../lib/dungeon-presets';
import type {Session} from './game-table/types';
type Preparation={scenery:SceneryDefinition[];presets:typeof dungeonPresets};
const defaults:Preparation={scenery:sceneryCatalog,presets:dungeonPresets};
const Context=createContext({...defaults,refresh:async()=>{},error:''});
export function CatalogProvider({session,pj,visuals,children}:{session:Session;pj:boolean;visuals:SceneryDefinition[];children:ReactNode}){
 const request=useRef(0);
 const [available,setAvailable]=useState(defaults),[error,setError]=useState('');
 const refresh=useCallback(async()=>{
  if(!pj)return;const serial=++request.current;
  try{const response=await fetch('/api/game?'+new URLSearchParams({room:session.room,catalog:'preparation'}),{headers:{Authorization:'Bearer '+session.token}});if(!response.ok)throw Error('Katalogy se nepodařilo načíst.');const data=await response.json() as Preparation;if(serial===request.current){setAvailable(data);setError('');}}catch(e){if(serial===request.current)setError(e instanceof Error?e.message:'Katalogy nejsou dostupné.');}
 },[session.room,session.token,pj]);
 useEffect(()=>{setAvailable(defaults);void refresh();const focus=()=>void refresh();window.addEventListener('focus',focus);return()=>{request.current++;window.removeEventListener('focus',focus);};},[refresh]);
 const scenery=useMemo(()=>{const entries=new Map((pj?available.scenery:sceneryCatalog).map(e=>[e.id,e]));for(const entry of visuals)entries.set(entry.id,entry);return [...entries.values()];},[available,pj,visuals]);
 return <Context.Provider value={{...available,scenery,refresh,error}}>{children}</Context.Provider>;
}
export const useCatalog=()=>useContext(Context);
