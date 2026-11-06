import { saveSessionRecap } from '../../../lib/session-recap';
import { generationAction } from '../../../lib/generation';
import { lifeAction } from '../../../lib/life';
import { equipmentAction } from '../../../lib/equipment';
import { lootAction } from '../../../lib/loot';
import { challengeAction } from '../../../lib/challenges';
import { mapNoteAction } from '../../../lib/map-notes';
import { journeyAction } from '../../../lib/journey';
import { recoveryAction } from '../../../lib/recovery';
import { powerAction } from '../../../lib/powers';
import { conditionAction } from '../../../lib/conditions';
import { initiativeAction } from '../../../lib/initiative';
import { issueRecovery } from '../../../lib/access';
import { updateCharacter, guardPatch, EditConflict } from '../../../lib/sheets';
import { mechanicsAction, die } from '../../../lib/mechanics';
import { monsterAction } from '../../../lib/monsters';
import {
  ensureAtlas,
  getLevel,
  explorationAction,
  refreshSight,
  remember,
} from '../../../lib/exploration';
import { applyMap, playerDungeon, cellKey } from '../../../lib/dungeon';
import { awardExperience } from '../../../lib/experience';
import type { Game, Member } from '../../../lib/game';
import { fail } from './responses';

export async function applyGameAction(
  g: Game,
  me: Member,
  roomId: string,
  b: Record<string, unknown>,
) {
  const pj = me.role === 'pj';
  let recoveryCode: string | undefined;
  let generatedLevels: string[] | undefined;
  switch (b.action) {
    case 'recover':
    case 'join':
      break;
    case 'chat':
    case 'roll': {
      let text = String(b.text || '')
        .trim()
        .slice(0, 2000);
      if (b.action === 'roll') {
        const match = /^(\d{1,2})[kd](4|6|8|10|12|20|100)([+-]\d{1,3})?$/i.exec(
          text.replaceAll(' ', ''),
        );
        if (!match || +match[1] > 20 || +match[1] < 1)
          return fail('Použij například 2k6+1 (nejvýše 20 kostek).');
        const sides = +match[2];
        const rolls = Array.from({ length: +match[1] }, () => die(sides));
        text = `${text} → ${rolls.reduce((a, c) => a + c, 0) + Number(match[3] || 0)} (${rolls.join(' + ')}${match[3] || ''})`;
      }
      if (!text) return fail('Napiš zprávu.');
      const to = String(b.to || 'all');
      if (to !== 'all' && !g.members.some((m) => m.id === to))
        return fail('Příjemce není u stolu.');
      g.messages.push({
        id: crypto.randomUUID(),
        from: me.id,
        name: me.name,
        text,
        to,
        time: Date.now(),
        roll: b.action === 'roll',
      });
      g.messages = g.messages.slice(-500);
      break;
    }
    case 'mechanics':
      try {
        mechanicsAction(g, me, b);
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Hod se nepodařil.');
      }
      break;
    case 'map':
      if (!pj) return fail('Mapu připravuje a odkrývá pouze Pán jeskyně.', 403);
      try {
        if (g.atlas) {
          const a = ensureAtlas(g),
            level = getLevel(a, b.levelId);
          const proxy = { ...g, dungeon: level.map, mapHistory: level.history };
          applyMap(proxy, b);
          if (
            a.battle?.levelId === level.id &&
            g.members.some(
              (m) =>
                m.role === 'player' &&
                !m.archived &&
                !proxy.dungeon!.floors.includes(cellKey(m.x, m.y)),
            )
          )
            return fail('Nejdřív přemísti postavy z upravovaného políčka.');
          if (
            a.location?.levelId === level.id &&
            !proxy.dungeon!.floors.includes(cellKey(a.location.x, a.location.y))
          )
            return fail('Nejdřív přemísti družinu z upravovaného políčka.');
          level.map = proxy.dungeon!;
          level.history = proxy.mapHistory || [];
          g.mapOperations = proxy.mapOperations;
          if (b.tool === 'reveal') remember(level, level.map.revealed);
          else if (b.tool === 'hide' || b.tool === 'undo')
            level.memory = playerDungeon({
              ...level.memory,
              revealed: level.map.revealed,
            });
          if (!a.location) remember(level, level.map.revealed);
          refreshSight(g);
        } else applyMap(g, b);
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Tah mapy se nepodařil.');
      }
      break;
    case 'cell':
      return fail('Použij nový editor mapy.', pj ? 400 : 403);
    case 'explore': {
      if (
        me.role !== 'pj' &&
        [
          'enable',
          'level-add',
          'level-rename',
          'settings',
          'place',
          'stairs-add',
          'stairs-remove',
          'battle-start',
          'battle-end',
          'lighting',
        ].includes(String(b.op))
      )
        return fail('Tuto změnu může provést pouze PJ.', 403);
      if (
        me.role !== 'pj' &&
        ['move', 'door', 'travel'].includes(String(b.op)) &&
        g.atlas?.leaderId !== me.id
      )
        return fail('Družinu ovládá pouze vedoucí nebo PJ.', 403);
      try {
        explorationAction(g, me, b);
      } catch (e) {
        return fail(
          e instanceof Error ? e.message : 'Akce průzkumu se nepodařila.',
        );
      }
      break;
    }
    case 'move':
      {
        if (g.atlas?.location)
          return fail('Použij společný pohyb družiny.', 403);
        const member = g.members.find((m) => m.id === b.id);
        const x = Number(b.x),
          y = Number(b.y);
        if (!member || (!pj && member.id !== me.id))
          return fail('Tuto postavu nelze posunout.', 403);
        if (
          !Number.isInteger(x) ||
          !Number.isInteger(y) ||
          x < 0 ||
          x >= 28 ||
          y < 0 ||
          y >= 20
        )
          return fail('Mimo mapu.');
        member.x = x;
        member.y = y;
      }
      break;
    case 'character': {
      try {
        updateCharacter(me, b);
      } catch (e) {
        return fail(
          e instanceof Error ? e.message : 'Neplatný deník.',
          e instanceof EditConflict ? 409 : 400,
        );
      }
      break;
    }
    case 'access-key': {
      const target = g.members.find((m) => m.id === b.memberId && !m.archived);
      if (!target || (target.id !== me.id && (!pj || target.role === 'pj')))
        return fail('Tento přístup nemůžeš obnovit.', 403);
      recoveryCode = await issueRecovery(target, roomId);
      break;
    }
    case 'member-archive':
    case 'member-restore': {
      if (!pj) return fail('Postavy spravuje pouze PJ.', 403);
      const target = g.members.find(
        (m) => m.id === b.memberId && m.role === 'player',
      );
      if (!target) return fail('Postava neexistuje.');
      if (
        b.action === 'member-restore' &&
        g.members.filter((m) => !m.archived).length >= 12
      )
        return fail('U stolu už je 12 účastníků.');
      target.archived = b.action === 'member-archive';
      target.token = crypto.randomUUID();
      target.recoveryHash = undefined;
      target.recoveryReplay = undefined;
      if (!target.archived) recoveryCode = await issueRecovery(target, roomId);
      break;
    }
    case 'experience':
      if (!pj)
        return fail('Zkušenosti může přidělovat pouze Pán jeskyně.', 403);
      try {
        awardExperience(g, me, b);
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Neplatná odměna.');
      }
      break;
    case 'generate':
      if (!pj) return fail('Jeskyni generuje pouze PJ.', 403);
      try {
        generatedLevels = generationAction(g, me, b);
      } catch (e) {
        return fail(
          e instanceof Error ? e.message : 'Jeskyni se nepodařilo vytvořit.',
          e instanceof EditConflict ? 409 : 400,
        );
      }
      break;
    case 'life':
      if (!pj) return fail('O vyřazení rozhoduje pouze PJ.', 403);
      try {
        lifeAction(g, me, b);
      } catch (e) {
        return fail(
          e instanceof Error ? e.message : 'Stav se nepodařilo uložit.',
          e instanceof EditConflict ? 409 : 400,
        );
      }
      break;
    case 'equipment':
      if (!pj && b.op === 'use-healing')
        return fail('Léčení předmětem potvrzuje pouze Pán jeskyně.', 403);
      if (!pj && b.memberId !== me.id)
        return fail('Upravovat můžeš jen vlastní výbavu.', 403);
      try {
        equipmentAction(g, me, b);
      } catch (e) {
        return fail(
          e instanceof Error ? e.message : 'Výbavu se nepodařilo změnit.',
          e instanceof EditConflict ? 409 : 400,
        );
      }
      break;
    case 'loot':
      if (
        !pj &&
        ['save', 'remove', 'close', 'reopen', 'split-coins'].includes(
          String(b.op),
        )
      )
        return fail(
          'Přípravu a společné dělení kořisti spravuje pouze PJ.',
          403,
        );
      try {
        lootAction(g, me, b);
      } catch (e) {
        return fail(
          e instanceof Error ? e.message : 'Kořist se nepodařilo upravit.',
          e instanceof EditConflict ? 409 : 400,
        );
      }
      break;
    case 'challenge':
      if (!pj && ['create', 'resolve', 'cancel'].includes(String(b.op)))
        return fail('Výzvy a následky zkoušek spravuje pouze PJ.', 403);
      try {
        challengeAction(g, me, b);
      } catch (e) {
        return fail(
          e instanceof Error ? e.message : 'Zkoušku se nepodařilo provést.',
          e instanceof EditConflict ? 409 : 400,
        );
      }
      break;
    case 'map-note':
      if (!pj) return fail('Poznámky na mapě spravuje pouze Pán jeskyně.', 403);
      try {
        mapNoteAction(g, me, b);
      } catch (e) {
        return fail(
          e instanceof Error ? e.message : 'Poznámku se nepodařilo uložit.',
          e instanceof EditConflict ? 409 : 400,
        );
      }
      break;
    case 'journey':
      if (!pj) return fail('Čas a světla spravuje pouze Pán jeskyně.', 403);
      try {
        journeyAction(g, me, b);
      } catch (e) {
        return fail(
          e instanceof Error ? e.message : 'Akce průzkumu se nepodařila.',
          e instanceof EditConflict ? 409 : 400,
        );
      }
      break;
    case 'recovery':
      if (!pj)
        return fail('Odpočinek a léčení potvrzuje pouze Pán jeskyně.', 403);
      try {
        recoveryAction(g, me, b);
      } catch (e) {
        return fail(
          e instanceof Error ? e.message : 'Obnovu se nepodařilo provést.',
          e instanceof EditConflict ? 409 : 400,
        );
      }
      break;
    case 'power':
      if (me.role !== 'pj' && b.memberId !== me.id)
        return fail('Kouzla a magenergii spravuje jejich hráč nebo PJ.', 403);
      try {
        powerAction(g, me, b);
      } catch (e) {
        return fail(
          e instanceof Error ? e.message : 'Akce se nepodařila.',
          e instanceof EditConflict ? 409 : 400,
        );
      }
      break;
    case 'condition':
      if (!pj) return fail('Stavy spravuje pouze Pán jeskyně.', 403);
      try {
        conditionAction(g, me, b);
      } catch (e) {
        return fail(
          e instanceof Error ? e.message : 'Stav se nepodařilo změnit.',
          e instanceof EditConflict ? 409 : 400,
        );
      }
      break;
    case 'initiative':
      if (!pj) return fail('Souboj řídí pouze Pán jeskyně.', 403);
      try {
        initiativeAction(g, me, b);
      } catch (e) {
        return fail(
          e instanceof Error ? e.message : 'Souboj se nepodařilo změnit.',
          e instanceof EditConflict ? 409 : 400,
        );
      }
      break;
    case 'monster':
      if (!pj) return fail('Příšery spravuje pouze Pán jeskyně.', 403);
      try {
        monsterAction(g, me, b);
      } catch (e) {
        return fail(
          e instanceof Error ? e.message : 'Příšeru se nepodařilo uložit.',
          e instanceof EditConflict ? 409 : 400,
        );
      }
      break;
    case 'session-recap':
      if (!pj) return fail('Zápis ze sezení upravuje pouze PJ.', 403);
      try {
        saveSessionRecap(g, b);
      } catch (error) {
        return fail(
          error instanceof Error
            ? error.message
            : 'Zápis se nepodařilo uložit.',
          error instanceof EditConflict ? 409 : 400,
        );
      }
      break;
    case 'notes':
      if (!pj) return fail('Poznámky jsou pouze pro PJ.', 403);
      try {
        guardPatch(b, { notes: g.notes, scene: g.scene, title: g.title });
        if (b.notes !== undefined) g.notes = String(b.notes).slice(0, 20000);
        if (b.scene !== undefined) g.scene = String(b.scene).slice(0, 100);
        if (b.title !== undefined) g.title = String(b.title).slice(0, 100);
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Neplatná příprava.', 409);
      }
      break;
    default:
      return fail('Neznámá akce.');
  }
  return { recoveryCode, generatedLevels };
}
