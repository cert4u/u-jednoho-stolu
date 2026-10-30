import {combatFields,type CombatStats} from './mechanics';
export const ABILITIES = [
  {key:'strength',label:'Síla',short:'SIL'},
  {key:'dexterity',label:'Obratnost',short:'OBR'},
  {key:'constitution',label:'Odolnost',short:'ODL'},
  {key:'intelligence',label:'Inteligence',short:'INT'},
  {key:'charisma',label:'Charisma',short:'CHR'},
] as const;
export type AbilityKey=typeof ABILITIES[number]['key'];
export type CharacterDetails={combat?:CombatStats;race?:string;profession?:string;level?:number;abilities?:Partial<Record<AbilityKey,number>>;stats:string};
export function abilityValues(member:CharacterDetails):Record<AbilityKey,number>{return Object.fromEntries(ABILITIES.map(({key,label})=>{const stored=member.abilities?.[key];const legacy=member.stats.match(new RegExp(`${label}\\s*[:=]?\\s*(\\d{1,2})(?!\\d)`,'i'));return [key,stored??(legacy?Math.min(21,Math.max(1,Number(legacy[1]))):10)];})) as Record<AbilityKey,number>;}
export function characterDetails(payload:Record<string,unknown>,member:CharacterDetails){const next:Partial<CharacterDetails>={};const combat=combatFields(payload,member.combat);if(combat)next.combat=combat;if(payload.race!==undefined)next.race=String(payload.race).trim().slice(0,50);if(payload.profession!==undefined)next.profession=String(payload.profession).trim().slice(0,50);if(payload.level!==undefined){const n=Number(payload.level);if(!Number.isInteger(n)||n<1||n>36)throw new Error('Úroveň musí být celé číslo od 1 do 36.');next.level=n;}const values=abilityValues(member);let changed=false;for(const {key,label} of ABILITIES){if(payload[key]===undefined)continue;const n=Number(payload[key]);if(!Number.isInteger(n)||n<1||n>21)throw new Error(`${label}: zadej celé číslo od 1 do 21.`);values[key]=n;changed=true;}if(changed)next.abilities=values;return next;}
