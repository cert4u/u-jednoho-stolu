import { MAP_WIDTH, MAP_HEIGHT } from '../../../lib/map-limits';
import {campaignVisuals} from '../../../lib/catalogs/visuals';
import { storyOutlineView } from '../../../lib/story-outline';
import { sessionRecapView } from '../../../lib/session-recap';
import { generationState } from '../../../lib/generation';
import { lifeView } from '../../../lib/life';
import { lootViews, emptyCoins } from '../../../lib/loot';
import { challengeViews } from '../../../lib/challenges';
import { mapNoteAlertViews } from '../../../lib/map-note-alerts';
import { mapNotesView } from '../../../lib/map-notes';
import { journeyView } from '../../../lib/journey';
import { visibleConditions } from '../../../lib/conditions';
import { initiativeView } from '../../../lib/initiative';
import { canReadMessage, pendingCombat } from '../../../lib/mechanics';
import { monsterViews } from '../../../lib/monsters';
import {
  ensureAtlas,
  getLevel,
  explorationView,
} from '../../../lib/exploration';
import { dungeonFor, playerDungeon, cellKey } from '../../../lib/dungeon';
import type { Game, Member } from '../../../lib/game';

export function missingViewLevel(game: Game, member: Member, level?: string) {
  if (member.role !== 'pj' || !level) return false;
  return game.atlas
    ? !game.atlas.levels.some((entry) => entry.id === level)
    : level !== 'ground';
}

export function gameView(
  g: Game,
  id: string,
  revision = 0,
  requested?: string,
) {
  const me = g.members.find((m) => m.id === id)!;
  const pj = me.role === 'pj';
  const pendingActions = pendingCombat(g, id);
  if (g.atlas) ensureAtlas(g);
  const exploration = explorationView(g, pj, requested);
  const level = g.atlas ? getLevel(g.atlas, exploration?.levelId) : undefined;
  const map = level?.map || dungeonFor(g),
    visible = exploration?.playerMap || playerDungeon(map);
  const seen = new Set(map.revealed);
  const { mapHistory, generationRuns } = g;
  // List the response fields here so new stored data stays private by default.
  return {
    contentVisuals:campaignVisuals(g,pj?map:visible),
    title: g.title,
    scene: g.scene,
    experienceAwards: g.experienceAwards,
    ...(pj ? { storyOutline: storyOutlineView(g, me) } : {}),
    sessionRecap: sessionRecapView(g, pj),
    ...(pj
      ? { generation: generationState(g), generationRuns: generationRuns || [] }
      : {}),
    loot: lootViews(g, pj),
    challenges: challengeViews(g, me),
    noteAlerts: pj ? mapNoteAlertViews(g) : [],
    mapNotes: mapNotesView(g, pj, level?.id || 'ground', visible),
    journey: journeyView(g, pj),
    initiative: initiativeView(g, pj),
    revision,
    pendingActions,
    archivedMembers: pj
      ? g.members
          .filter((m) => m.archived)
          .map((m) => ({ id: m.id, name: m.name }))
      : [],
    exploration,
    monsters: monsterViews(g, pj, level?.id || 'ground'),
    notes: pj ? g.notes : '',
    dungeon: pj ? map : visible,
    canUndoMap: pj && Boolean((level?.history || mapHistory)?.length),
    cells: Object.fromEntries(
      (pj ? map : visible).floors.map((k) => [k, 'floor']),
    ),
    fog: pj
      ? Array.from({ length: MAP_WIDTH * MAP_HEIGHT }, (_, i) =>
          cellKey(i % MAP_WIDTH, Math.floor(i / MAP_WIDTH)),
        ).filter((k) => !seen.has(k))
      : [],
    members: g.members
      .filter(
        (m) =>
          !m.archived &&
          (exploration ||
            pj ||
            seen.has(cellKey(m.x, m.y)) ||
            m.id === id ||
            m.role === 'pj'),
      )
      .map(member => {
        const ownSheet = pj || member.id === id;
        const {
          id: memberId, name, role, hp, maxHp, experience, race, profession,
          level, x, y, color, seen, archived,
        } = member;
        return {
          id: memberId, name, role, hp, maxHp, experience, race, profession,
          level, x, y, color, seen, archived,
          stats: ownSheet ? member.stats : '',
          inventory: ownSheet ? member.inventory : '',
          life: lifeView(member, ownSheet),
          ...(ownSheet && {
            abilities: member.abilities,
            combat: member.combat,
            equipmentRevision: member.equipmentRevision ?? 0,
            purse: member.purse || emptyCoins(),
            possessions: member.possessions || [],
            powers: member.powers || [],
            mana: member.mana || { current: 0, max: 0, revision: 0 },
          }),
          conditions: visibleConditions(member.conditions, pj),
        };
      }),
    messages: g.messages.filter((m) => canReadMessage(m, id)),
    me: id,
  };
}
export type GameView = ReturnType<typeof gameView>;
export type MemberView = GameView['members'][number];
