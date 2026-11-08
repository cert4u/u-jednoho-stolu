import {campaignCatalogSchema} from '../catalogs/model';
import { storyOutlineSchema } from '../story-phases';
import { z } from 'zod';
import { generationRunsSchema } from '../generator-schema';
import { member, monster } from './actors-schema';
import { message, initiative } from './combat-schema';
import { id, int, text } from './fields';
import { atlas, cell, dungeon } from './map-schema';
import {
  challenges,
  journey,
  loot,
  mapNotes,
  sessionRecap,
} from './preparation-schema';

export const backupSchema = z.object({
  format: z.literal('u-jednoho-stolu'),
  version: z.literal(1),
  exportedAt: z.string(),
  game: z.object({
    messageOperations: z.array(z.object({actor:id,requestId:id,fingerprint:z.string().regex(/^[a-f0-9]{64}$/),messageId:id})).max(256).optional(),
    contentLibrary:campaignCatalogSchema.optional(),
    storyOutline: storyOutlineSchema.optional(),
    sessionRecap: sessionRecap.optional(),
    generationRuns: generationRunsSchema.optional(),
    generationOperations: z
      .array(
        z.object({
          id,
          levelIds: z
            .array(id)
            .min(1)
            .max(8)
            .refine((ids) => new Set(ids).size === ids.length),
        }),
      )
      .max(64)
      .refine((ops) => new Set(ops.map((op) => op.id)).size === ops.length)
      .optional(),
    lifeOperations: z.array(id).max(256).optional(),
    equipmentOperations: z.array(text(200)).max(256).optional(),
    loot: loot.optional(),
    lootOperations: z.array(text(200)).max(256).optional(),
    challenges: challenges.optional(),
    challengeOperations: z.array(text(200)).max(256).optional(),
    mapNotes: mapNotes.optional(),
    mapNoteOperations: z.array(id).max(256).optional(),
    journey: journey.optional(),
    journeyUndo: z
      .object({
        before: journey,
        afterRevision: int(0, Number.MAX_SAFE_INTEGER),
      })
      .optional(),
    journeyOperations: z.array(id).max(256).optional(),
    recoveryOperations: z.array(id).max(256).optional(),
    powerOperations: z.array(id).max(256).optional(),
    conditionOperations: z.array(id).max(256).optional(),
    initiative: initiative.optional(),
    initiativeOperations: z.array(id).max(256).optional(),
    title: text(100),
    scene: text(100),
    notes: text(20000),
    cells: z.record(cell, z.string().max(20)),
    fog: z.array(cell).max(560),
    members: z.array(member).min(1).max(200),
    messages: z.array(message).max(500),
    experienceAwards: z
      .array(
        z.object({
          id,
          by: id,
          amount: int(1, 1000000),
          recipients: z.array(id).max(12),
          reason: text(300),
          time: z.number().finite(),
        }),
      )
      .max(20000)
      .optional(),
    dungeon: dungeon.optional(),
    mapHistory: z.array(dungeon).max(12).optional(),
    mapOperations: z.array(id).max(256).optional(),
    atlas: atlas.optional(),
    monsters: z.array(monster).max(200).optional(),
    monsterCounter: int(0, 1000000).optional(),
    monsterOperations: z.array(id).max(256).optional(),
    mechanicsOperations: z.array(text(200)).max(256).optional(),
    combatActions: z.record(id, message).optional(),
  }),
});

export type BackupCampaign = z.infer<typeof backupSchema>['game'];
