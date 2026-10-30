import type {Challenge} from './challenges';
import type {MapNoteAlert} from './map-note-alerts';
import type {MapNote} from './map-notes';
import type {Journey,JourneyUndo} from './journey';
import type {Power,Mana} from './powers';
import type {Condition} from './conditions';
import type {Initiative} from './initiative';
import type { MechanicsRoll } from './mechanics';
import type { Monster } from './monsters';
import type { Atlas } from './exploration';
import { emptyDungeon, type Dungeon } from './dungeon';
import type { ExperienceAward } from './experience';
import type { CharacterDetails } from './character';
export type Member=CharacterDetails & {powers?:Power[];mana?:Mana;conditions?:Condition[];id:string;token:string;recoveryHash?:string;recoveryReplay?:{previousHash:string;requestId:string;tokenHash:string};archived?:boolean;name:string;role:'pj'|'player';hp:number;maxHp:number;experience?:number;stats:string;inventory:string;x:number;y:number;color:string;seen:number};
export type Msg={id:string;from:string;name:string;text:string;to:string;time:number;roll?:boolean;experience?:boolean;mechanics?:MechanicsRoll;audience?:string[]};
export type Game={challenges?:Challenge[];challengeOperations?:string[];mapNoteAlerts?:MapNoteAlert[];mapNotes?:MapNote[];mapNoteOperations?:string[];journey?:Journey;journeyUndo?:JourneyUndo;journeyOperations?:string[];recoveryOperations?:string[];powerOperations?:string[];conditionOperations?:string[];initiative?:Initiative;initiativeOperations?:string[];title:string;scene:string;notes:string;cells:Record<string,string>;fog:string[];members:Member[];messages:Msg[];experienceAwards?:ExperienceAward[];dungeon?:Dungeon;mapHistory?:Dungeon[];mapOperations?:string[];atlas?:Atlas;monsters?:Monster[];monsterCounter?:number;monsterOperations?:string[];mechanicsOperations?:string[];combatActions?:Record<string,Msg>};
export function initialGame(name:string,token:string):Game {const cells:Record<string,string>={};return {title:'Kronika zapomenuté věže',scene:'Podzemí staré strážnice',dungeon:emptyDungeon(),notes:'Za dveřmi severní místnosti čeká strážce.\n\nVodítko: na kamenné desce je vyrytý znak havrana.',cells,fog:[],members:[{id:crypto.randomUUID(),token,name,role:'pj',experience:0,hp:12,maxHp:12,stats:'Síla 12 · Obratnost 11 · Odolnost 13\nInteligence 10 · Charisma 10',inventory:'Pochodeň, lano, cestovní zásoby',x:5,y:6,color:'#b77945',seen:Date.now()}],messages:[]};}
