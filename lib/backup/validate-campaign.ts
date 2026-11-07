import { generationStairIssues } from '../generator-provenance';
import { validateGeneratedFloor } from '../generator-validation';
import type { BackupCampaign } from './campaign-schema';

export function validateCampaign(campaign: BackupCampaign) {
  const noteIds = new Set((campaign.mapNotes ?? []).map(note => note.id));
  if (Object.values(campaign.storyOutline?.phases ?? {}).some(beat => beat.noteIds.some(id => !noteIds.has(id))))
    throw new Error('Příběhová osnova odkazuje na neexistující místo.');
  const memberIds = new Set(campaign.members.map((member) => member.id));
  validateJourney(campaign);
  validateParty(campaign, memberIds);
  validateMapReferences(campaign, memberIds);
  validateCombatReferences(campaign);
}

function validateJourney(g: BackupCampaign) {
  if (
    g.journeyUndo &&
    (!g.journey ||
      g.journeyUndo.afterRevision !== g.journey.revision ||
      g.journeyUndo.before.revision + 1 !== g.journey.revision ||
      g.journeyUndo.before.minutes >= g.journey.minutes ||
      g.journey.minutes - g.journeyUndo.before.minutes > 1440 ||
      JSON.stringify(g.journeyUndo.before.lights.map((l) => l.id)) !==
        JSON.stringify(g.journey.lights.map((l) => l.id)))
  )
    throw new Error('Záloha obsahuje neplatnou historii času.');
  if (
    [
      ...(g.journey?.lights || []),
      ...(g.journeyUndo?.before.lights || []),
    ].some(
      (l) =>
        l.carrierId &&
        !g.members.some((m) => m.id === l.carrierId && m.role === 'player'),
    )
  )
    throw new Error('Světlo odkazuje na neexistujícího nosiče.');
}

function validateParty(g: BackupCampaign, memberIds: ReadonlySet<string>) {
  if (
    memberIds.size !== g.members.length ||
    g.members.filter((m) => m.role === 'pj' && !m.archived).length !== 1 ||
    g.members.filter((m) => !m.archived).length > 12 ||
    g.members.some((m) => m.role === 'pj' && m.archived)
  )
    throw new Error('Záloha má neplatné složení družiny.');
  if (
    g.challenges?.some(
      (c) => !g.members.some((m) => m.id === c.memberId && m.role === 'player'),
    )
  )
    throw new Error('Zkouška odkazuje na neexistujícího hráče.');
  if (
    g.loot?.some((l) =>
      l.claims.some(
        (c) =>
          !g.members.some((m) => m.id === c.memberId && m.role === 'player'),
      ),
    )
  )
    throw new Error('Rozdělení kořisti odkazuje na neexistujícího hráče.');
}

function validateMapReferences(
  g: BackupCampaign,
  memberIds: ReadonlySet<string>,
) {
  const levels = new Set(g.atlas?.levels.map((l) => l.id) || ['ground']);
  if (g.atlas) {
    const { battle, location, levels: floors, stairs, order } = g.atlas;
    if (
      battle &&
      (!location ||
        battle.levelId !== location.levelId ||
        location.x !== battle.origin[0] ||
        location.y !== battle.origin[1] ||
        !floors.some(
          (l) =>
            l.id === battle.levelId &&
            l.map.floors.includes(battle.origin.join()),
        ) ||
        g.members.some(
          (m) =>
            m.role === 'player' &&
            !m.archived &&
            !floors
              .find((l) => l.id === battle.levelId)
              ?.map.floors.includes(`${m.x},${m.y}`),
        ))
    )
      throw new Error('Neplatné bojové rozestavení v záloze.');
    if (
      levels.size !== floors.length ||
      (location && !levels.has(location.levelId)) ||
      stairs.some(
        (s) => !levels.has(s.a.levelId) || !levels.has(s.b.levelId),
      ) ||
      order.some((id) => !memberIds.has(id))
    )
      throw new Error('Záloha obsahuje neplatná propojení pater nebo družiny.');
  }
  const maps = [
    ...(g.dungeon ? [g.dungeon] : []),
    ...(g.mapHistory || []),
    ...(g.atlas?.levels.flatMap((l) => [l.map, ...l.history]) || []),
  ];
  if (maps.some(map => (map.scenery?.length ?? 0) > 200)) throw new Error('Na patře může být nejvýše 200 prvků stafáže.');
  for (const map of maps)
    if (map.generation?.status === 'valid')
      validateGeneratedFloor(map, map.generation);
  if (g.atlas?.levels.some((l) => l.memory.generation || l.memory.doorSettings || l.memory.scenery?.some(item => item.hidden !== undefined || item.note !== undefined || item.revision !== undefined)))
    throw new Error('Paměť hráčské mapy nesmí obsahovat tajná metadata.');
  if (
    g.generationRuns?.some((run) =>
      run.levelIds.some((id, index) => {
        if (!levels.has(id)) return true;
        const metadata = g.atlas?.levels.find((l) => l.id === id)?.map
          .generation;
        return (
          run.options.version === 'v2' &&
          (!metadata ||
            metadata.levelIndex !== index ||
            JSON.stringify(metadata.options) !== JSON.stringify(run.options))
        );
      }),
    )
  )
    throw new Error('Neplatný původ generovaných pater.');
  if (
    (!g.atlas && g.dungeon?.generation) ||
    g.atlas?.levels.some(
      (level) =>
        level.map.generation &&
        !g.generationRuns?.some(
          (run) =>
            run.options.version === 'v2' && run.levelIds.includes(level.id),
        ),
    )
  )
    throw new Error('Generovanému patru chybí uložený původ.');
  if (generationStairIssues(g).length)
    throw new Error('Propojení pater neodpovídá platným metadatům generování.');
  if (
    g.generationOperations?.some((op) =>
      op.levelIds.some((id) => !levels.has(id)),
    )
  )
    throw new Error('Záznam generování odkazuje na neexistující patro.');
  if (g.mapNotes?.some((n) => !levels.has(n.levelId)))
    throw new Error('Poznámka odkazuje na neexistující patro.');
  if ((g.monsters || []).some((m) => !levels.has(m.levelId)))
    throw new Error('Příšera odkazuje na neexistující patro.');
}

function validateCombatReferences(g: BackupCampaign) {
  const actors = new Set([
    ...g.members.map((m) => 'member:' + m.id),
    ...(g.monsters || []).map((m) => 'monster:' + m.id),
  ]);
  if (
    g.initiative?.order.some(
      (r) =>
        !actors.has(r.type + ':' + r.id) ||
        (r.type === 'member' &&
          g.members.find((m) => m.id === r.id)?.role !== 'player'),
    )
  )
    throw new Error('Záloha obsahuje neplatné účastníky souboje.');
  const records = g.combatActions || {};
  if (
    Object.keys(records).length > 1200 ||
    Object.entries(records).some(([id, m]) => m.id !== id) ||
    [...g.messages, ...Object.values(records)].some(
      (m) =>
        m.mechanics &&
        (!actors.has(m.mechanics.actor.type + ':' + m.mechanics.actor.id) ||
          (m.mechanics.target &&
            !actors.has(
              m.mechanics.target.type + ':' + m.mechanics.target.id,
            ))),
    )
  )
    throw new Error('Záloha obsahuje neplatné soubojové akce.');
}
