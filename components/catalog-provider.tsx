'use client';
import {createContext,useContext,useEffect,useMemo,useState,useCallback,useRef,type ReactNode} from 'react';
import {sceneryCatalog,type SceneryDefinition} from '../lib/scenery-catalog';
import {dungeonPresets} from '../lib/dungeon-presets';
import type {Session} from './game-table/types';
type Preparation={scenery:SceneryDefinition[];presets:typeof dungeonPresets};
const defaults:Preparation={scenery:sceneryCatalog,presets:dungeonPresets};
const Context=createContext({...defaults,refresh:async()=>{},error:''});
async function loadPreparation(session:Session):Promise<Preparation>{
 const response=await fetch('/api/game?'+new URLSearchParams({room:session.room,catalog:'preparation'}),{headers:{Authorization:'Bearer '+session.token}});
 if(!response.ok)throw new Error('Katalogy se nepodařilo načíst.');
 return response.json();
}
type Props={session:Session;pj:boolean;visuals:SceneryDefinition[];children:ReactNode};
export function CatalogProvider(props:Props){return <ScopedCatalogProvider key={props.session.room+':'+props.session.token+':'+props.pj} {...props}/>;}
function ScopedCatalogProvider({session,pj,visuals,children}:Props){
 const request=useRef(0);
 const [available,setAvailable]=useState(defaults),[error,setError]=useState('');
 const refresh=useCallback(()=>{
  if(!pj)return Promise.resolve();
  const serial=++request.current;
  return loadPreparation({room:session.room,token:session.token}).then(data=>{
   if(serial===request.current){setAvailable(data);setError('');}
  },error=>{
   if(serial===request.current)setError(error instanceof Error?error.message:'Katalogy nejsou dostupné.');
  });
 },[session.room,session.token,pj]);
 useEffect(()=>{void refresh();const focus=()=>void refresh(), currentRequest=request;window.addEventListener('focus',focus);return()=>{currentRequest.current++;window.removeEventListener('focus',focus);};},[refresh]);
 const scenery=useMemo(()=>{const entries=new Map((pj?available.scenery:sceneryCatalog).map(e=>[e.id,e]));for(const entry of visuals)entries.set(entry.id,entry);return [...entries.values()];},[available,pj,visuals]);
 return <Context.Provider value={{...available,scenery,refresh,error}}>{children}</Context.Provider>;
}
export const useCatalog=()=>useContext(Context);
