import { z } from 'zod';
import catalog from '../content/scenery/index';
import { contentId, parseCatalog } from './content-schema';
export const sceneryEntrySchema = z.object({
  id: contentId, name: z.string().trim().min(1).max(40), category: z.enum(['object','floor']),
  environments: z.array(z.enum(['castle','mine','cave'])).min(1).max(3).refine(items=>new Set(items).size===items.length),
  automatic: z.boolean().default(false),
  surface:z.object({color:z.string().regex(/^#[0-9a-fA-F]{6}$/),texture:z.enum(['ripples','speckles','strokes','stones']),roughness:z.number().min(0).max(1).default(.5)}).strict().optional(),
  path: z.string().min(3).max(6000).regex(/^[Mm][MmLlHhVvCcSsQqTtAaZz0-9.,+\-\s]*$/),
}).strict().refine(entry=>!entry.surface || entry.category==='floor'&&!entry.automatic, 'Plocha musí mít kategorii floor a automatic false.').refine(entry=>!entry.automatic || entry.category==='floor', 'Automaticky lze rozmísťovat jen podlahové detaily.');
export const sceneryCatalog = parseCatalog(catalog,sceneryEntrySchema).map(entry=>({...entry,kind:entry.id}));
export const sceneryKinds = sceneryCatalog.map(entry=>entry.id);
export type SceneryDefinition=typeof sceneryCatalog[number];
const byId = new Map(sceneryCatalog.map(entry=>[entry.id,entry]));
export const findSceneryEntry = (id:string,entries?:readonly SceneryDefinition[]) => entries?entries.find(e=>e.id===id):byId.get(id);

export type SceneryCategory='object'|'floor'|'area';
export type SceneryEnvironment='all'|'castle'|'mine'|'cave';
export function sceneryChoices(category:SceneryCategory,environment:SceneryEnvironment,entries:readonly SceneryDefinition[]=sceneryCatalog){
  return entries.filter(entry=>(category==='area'?Boolean(entry.surface):entry.category===category&&!entry.surface)
    &&(environment==='all'||entry.environments.includes(environment)));
}
