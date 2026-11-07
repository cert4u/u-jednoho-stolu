import { z } from 'zod';

// Shared by community templates, persisted preparation and the editor.
export const storyPhaseSchema = z.enum(['entrance-obstacle', 'challenge', 'complication', 'climax', 'resolution']);
export type StoryPhase = z.infer<typeof storyPhaseSchema>;
export const storyPhases: { id: StoryPhase; title: string; hint: string }[] = [
  { id: 'entrance-obstacle', title: 'Vstup a překážka', hint: 'Proč družina přichází a co jí stojí v cestě?' },
  { id: 'challenge', title: 'Výzva', hint: 'Připrav problém, který může vyřešit důvtip, rozhovor nebo průzkum.' },
  { id: 'complication', title: 'Komplikace', hint: 'Co nové zjištění změní a koho postaví do obtížné situace?' },
  { id: 'climax', title: 'Vyvrcholení', hint: 'Která volba nebo střet rozhodne? Boj je jen jedna z možností.' },
  { id: 'resolution', title: 'Rozuzlení', hint: 'Co si družina odnese a jaké následky mohou pokračovat příště?' },
];
const noteId = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/)
  .refine(value => !['__proto__', 'constructor', 'prototype'].includes(value));
export const storyBeatSchema = z.object({
  title: z.string().trim().max(100).default(''),
  notes: z.string().trim().max(3000).default(''),
  noteIds: z.array(noteId).max(200).refine(ids => new Set(ids).size === ids.length).default([]),
  played: z.boolean().default(false),
}).strict();
export const storyOutlineSchema = z.object({
  revision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  phases: z.record(storyPhaseSchema, storyBeatSchema),
  operations: z.array(z.string().regex(/^[a-zA-Z0-9-]{16,80}$/)).max(256).optional(),
}).strict();
export type StoryBeat = z.infer<typeof storyBeatSchema>;
export type StoryOutline = z.infer<typeof storyOutlineSchema>;
export const emptyStoryBeat = (): StoryBeat => ({ title: '', notes: '', noteIds: [], played: false });
