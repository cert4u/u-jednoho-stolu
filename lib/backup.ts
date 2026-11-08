import { omitFields } from './objects';
import type { Game } from './game';
import { backupSchema } from './backup/campaign-schema';
import { validateCampaign } from './backup/validate-campaign';

import { assertBackupSize } from './backup-limits';
export { MAX_BACKUP_BYTES } from './backup-limits';

export function makeBackup(g: Game) {
  const game = structuredClone(g);
  delete game.mapNoteAlerts;
  const members = game.members.map(
    (member) => omitFields(member, ['token', 'recoveryHash', 'recoveryReplay']),
  );
  return {
    format: 'u-jednoho-stolu',
    version: 1,
    exportedAt: new Date().toISOString(),
    game: { ...game, members },
  };
}

export function validateBackup(value: unknown) {
  assertBackupSize(value);
  const result = backupSchema.safeParse(value);
  if (!result.success) {
    throw new Error(
      'Soubor není podporovaná úplná záloha verze 1 nebo obsahuje neplatné údaje.',
    );
  }

  const campaign = result.data.game;
  validateCampaign(campaign);
  return campaign;
}

export function readBackup(value: unknown): Game {
  const campaign = validateBackup(value);
  return {
    ...campaign,
    members: campaign.members.map((member) => ({
      ...member,
      token: crypto.randomUUID(),
    })),
  };
}
