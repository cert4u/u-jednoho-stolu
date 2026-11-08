export const panelDetails = {
  'story-outline': { label: 'Příběhová osnova' },
  generator: { label: 'Generátor jeskyně', className: 'generator-modal' },
  life: { label: 'Vyřazení postav' },
  equipment: { label: 'Výbava a měšec', className: 'loot-modal' },
  loot: { label: 'Kořist družiny', className: 'loot-modal' },
  challenges: { label: 'Zkoušky a pasti' },
  'map-note': { label: 'Poznámka k místu' },
  'session-recap': { label: 'Kronika družiny' },
  journey: { label: 'Čas a světlo' },
  recovery: { label: 'Odpočinek a léčení' },
  powers: { label: 'Kouzla a schopnosti' },
  conditions: { label: 'Stavy postav a příšer' },
  initiative: { label: 'Účastníci souboje' },
  mechanics: { label: 'Hody a souboj' },
  character: { label: 'Deník postavy', className: 'character-modal' },
  monsters: { label: 'Správa příšer', className: 'monster-modal' },
  experience: { label: 'Herní okno' },
  notes: { label: 'Herní okno' },
  account: { label: 'Herní okno' },
  help: { label: 'Herní okno' },
} satisfies Record<string, { label: string; className?: string }>;

export type TablePanel = keyof typeof panelDetails;
