import { MAP_WIDTH, MAP_HEIGHT } from '../map-limits';
import type { Game, Member } from '../game';
import {
  emptyDungeon,
  hiddenDoor,
  cellKey,
  edgeCells,
  type Point,
} from '../dungeon';
import { defaultLighting, type LightingSettings } from '../lighting';
import { recordNoteProximity } from '../map-note-alerts';
import { trackRoomEntries } from '../room-parchments';
import type { Location } from './model';
import { ensureAtlas, getLevel } from './atlas';
import { knownPath } from './geometry';
import { refreshSight } from './visibility';

function coordinate(x: unknown, y: unknown): Point {
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    x >= MAP_WIDTH ||
    y < 0 ||
    y >= MAP_HEIGHT
  )
    throw new Error('Vyber políčko uvnitř mapy.');
  return [x, y];
}

function requirePJ(m: Member) {
  if (m.role !== 'pj') throw new Error('Tuto změnu může provést pouze PJ.');
}

export function explorationAction(
  g: Game,
  m: Member,
  b: Record<string, unknown>,
) {
  const a = ensureAtlas(g);
  const op = b.op;
  const leader = m.role === 'pj' || a.leaderId === m.id;
  const id = b.requestId;
  if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(id))
    throw new Error('Chybí identifikátor akce.');
  if (a.operations.includes(id)) return;
  switch (op) {
    case 'enable':
      requirePJ(m);
      break;
    case 'level-add': {
      requirePJ(m);
      if (a.levels.length >= 8)
        throw new Error('MVP podporuje nejvýše 8 pater.');
      const name = String(b.name || '')
        .trim()
        .slice(0, 50);
      if (!name) throw new Error('Zadej název patra.');
      a.levels.push({
        id: crypto.randomUUID(),
        name,
        map: emptyDungeon(),
        history: [],
        memory: emptyDungeon(),
        visible: [],
      });
      break;
    }
    case 'level-rename': {
      requirePJ(m);
      const name = String(b.name || '')
        .trim()
        .slice(0, 50);
      if (!name) throw new Error('Zadej název patra.');
      getLevel(a, b.levelId).name = name;
      break;
    }
    case 'settings': {
      requirePJ(m);
      if (
        typeof b.leaderId !== 'string' ||
        !g.members.some(
          (member) => member.id === b.leaderId && member.role === 'player',
        )
      )
        throw new Error('Vyber hráče jako vedoucího.');
      const radius = Number(b.radius);
      if (!Number.isInteger(radius) || radius < 1 || radius > 12)
        throw new Error('Dohled musí být 1 až 12 polí.');
      a.leaderId = b.leaderId;
      a.radius = radius;
      break;
    }
    case 'lighting': {
      requirePJ(m);
      const previous = a.lighting || defaultLighting(),
        expected = b.expected as LightingSettings;
      if (
        !expected ||
        expected.enabled !== previous.enabled ||
        expected.darkRadius !== previous.darkRadius
      )
        throw new Error(
          'Nastavení světla se mezitím změnilo. Otevři panel znovu.',
        );
      if (
        typeof b.enabled !== 'boolean' ||
        typeof b.darkRadius !== 'number' ||
        !Number.isInteger(b.darkRadius) ||
        b.darkRadius < 0 ||
        b.darkRadius > 12
      )
        throw new Error('Dohled bez světla nastav na 0 až 12 polí.');
      a.lighting = { enabled: b.enabled, darkRadius: b.darkRadius };
      break;
    }
    case 'order': {
      if (m.role !== 'pj' && m.role !== 'player')
        throw new Error('Neplatný hráč.');
      if (
        !Array.isArray(b.order) ||
        b.order.length !== a.order.length ||
        new Set(b.order).size !== a.order.length ||
        !b.order.every((id) => a.order.includes(id))
      )
        throw new Error('Pořadí musí obsahovat všechny hráče právě jednou.');
      a.order = b.order;
      break;
    }
    case 'place': {
      requirePJ(m);
      if (a.battle) throw new Error('Nejdřív ukonči bojové rozestavení.');
      const level = getLevel(a, b.levelId);
      const [x, y] = coordinate(b.x, b.y);
      if (!level.map.floors.includes(cellKey(x, y)))
        throw new Error('Umísti družinu na podlahu.');
      const previous = a.location;
      a.location = { levelId: level.id, x, y };
      recordNoteProximity(g, previous);
      break;
    }
    case 'move': {
      if (a.battle) throw new Error('V boji posouvej jednotlivé postavy.');
      if (!leader) throw new Error('Družinu vede určený vedoucí nebo PJ.');
      if (!a.location) throw new Error('PJ nejdřív umístí družinu.');
      if (b.levelId && b.levelId !== a.location.levelId)
        throw new Error('Pro pohyb zobraz aktuální patro družiny.');
      const [x, y] = coordinate(b.x, b.y),
        level = getLevel(a, a.location.levelId);
      const start: Point = [a.location.x, a.location.y];
      const path = knownPath(
        level,
        start,
        [x, y],
        'Do cíle nevede známá průchozí cesta. Postupuj blíž nebo otevři dveře.',
      );
      const notified = new Set<string>(),
        recordEntry = trackRoomEntries(g, level);
      for (const p of path) {
        const previous = a.location;
        a.location = { levelId: level.id, x: p[0], y: p[1] };
        recordNoteProximity(g, previous, notified);
        recordEntry(previous, a.location);
        refreshSight(g);
      }
      break;
    }
    case 'door': {
      if (!leader) throw new Error('Dveře ovládá vedoucí nebo PJ.');
      const level = getLevel(a, b.levelId);
      const key = String(b.edge);
      if (
        level.map.edges[key] !== 'door' ||
        (m.role !== 'pj' && hiddenDoor(level.map, key))
      )
        throw new Error('Vyber dveře.');
      if (m.role !== 'pj') {
        if (
          a.location?.levelId !== level.id ||
          !edgeCells(key).includes(
            a.battle ? cellKey(m.x, m.y) : cellKey(a.location.x, a.location.y),
          )
        )
          throw new Error('Ke dveřím musí družina nejprve dojít.');
      }
      if (hiddenDoor(level.map, key))
        throw new Error('Nejdřív dveře odhal družině.');
      if (level.map.doorSettings?.[key]?.locked)
        throw new Error('Dveře jsou zamčené. Odemknutí potvrdí PJ.');
      const open = new Set(level.map.openDoors || []);
      if (open.has(key)) open.delete(key);
      else open.add(key);
      level.map.openDoors = [...open];
      break;
    }
    case 'battle-start': {
      requirePJ(m);
      if (a.battle) throw new Error('Bojové rozestavení už probíhá.');
      if (!a.location) throw new Error('Nejdřív umísti družinu.');
      if (b.levelId && b.levelId !== a.location.levelId)
        throw new Error('Zobraz aktuální patro družiny.');
      a.battle = {
        id: crypto.randomUUID(),
        levelId: a.location.levelId,
        origin: [a.location.x, a.location.y],
        revision: 0,
      };
      for (const member of g.members.filter(
        (p) => p.role === 'player' && !p.archived,
      )) {
        member.x = a.location.x;
        member.y = a.location.y;
      }
      break;
    }
    case 'battle-move': {
      if (!a.battle || !a.location)
        throw new Error('Bojové rozestavení neprobíhá.');
      if (b.battleId !== a.battle.id)
        throw new Error('Bojové rozestavení se mezitím změnilo.');
      if (b.levelId && b.levelId !== a.battle.levelId)
        throw new Error('Zobraz patro souboje.');
      const who = g.members.find(
        (p) => p.id === b.memberId && p.role === 'player' && !p.archived,
      );
      if (!who || (m.role !== 'pj' && who.id !== m.id))
        throw new Error('Posouvat můžeš jen vlastní postavu.');
      const expected = b.expected as { x: number; y: number };
      if (!expected || expected.x !== who.x || expected.y !== who.y)
        throw new Error('Postava se mezitím přesunula.');
      const to = coordinate(b.x, b.y),
        level = getLevel(a, a.battle.levelId),
        path = knownPath(level, [who.x, who.y], to),
        notified = new Set<string>();
      for (const p of path) {
        const previous = { levelId: level.id, x: who.x, y: who.y };
        who.x = p[0];
        who.y = p[1];
        recordNoteProximity(
          g,
          previous,
          notified,
          { levelId: level.id, x: who.x, y: who.y },
          who.id,
        );
        refreshSight(g);
      }
      a.battle.revision++;
      break;
    }
    case 'battle-end': {
      requirePJ(m);
      if (a.battle && b.levelId && b.levelId !== a.battle.levelId)
        throw new Error('Seskupení vyber na patře bojiště.');
      if (!a.battle || !a.location)
        throw new Error('Bojové rozestavení neprobíhá.');
      if (b.battleId !== a.battle.id)
        throw new Error('Bojové rozestavení se mezitím změnilo.');
      if (b.expectedRevision !== a.battle.revision)
        throw new Error('Rozestavení se mezitím změnilo.');
      const [x, y] = coordinate(b.x, b.y),
        level = getLevel(a, a.battle.levelId);
      if (
        !level.map.floors.includes(cellKey(x, y)) ||
        !level.memory.floors.includes(cellKey(x, y))
      )
        throw new Error('Seskup družinu na známé podlaze.');
      a.location = { levelId: level.id, x, y };
      delete a.battle;
      break;
    }
    case 'stairs-add': {
      requirePJ(m);
      const level = getLevel(a, b.levelId),
        destination = getLevel(a, b.destinationLevelId);
      if (level.id === destination.id)
        throw new Error('Schodiště musí propojit různá patra.');
      const [x, y] = coordinate(b.x, b.y),
        [tx, ty] = coordinate(b.destinationX, b.destinationY);
      if (
        !level.map.floors.includes(cellKey(x, y)) ||
        !destination.map.floors.includes(cellKey(tx, ty))
      )
        throw new Error('Oba konce schodiště musí ležet na podlaze.');
      if (
        a.stairs.some((s) =>
          [s.a, s.b].some(
            (p) =>
              (p.levelId === level.id && p.x === x && p.y === y) ||
              (p.levelId === destination.id && p.x === tx && p.y === ty),
          ),
        )
      )
        throw new Error('Na tomto políčku už schodiště je.');
      a.stairs.push({
        id: crypto.randomUUID(),
        a: { levelId: level.id, x, y },
        b: { levelId: destination.id, x: tx, y: ty },
      });
      break;
    }
    case 'stairs-remove': {
      requirePJ(m);
      a.stairs = a.stairs.filter((s) => s.id !== b.stairId);
      break;
    }
    case 'travel': {
      if (a.battle) throw new Error('Nejdřív seskup družinu po boji.');
      if (!leader) throw new Error('Přechod potvrzuje vedoucí nebo PJ.');
      if (!a.location) throw new Error('Družina ještě není na mapě.');
      const here = a.location;
      const stair = a.stairs.find((s) => s.id === b.stairId);
      const match = (p: Location) =>
        p.levelId === here.levelId && p.x === here.x && p.y === here.y;
      if (!stair || (!match(stair.a) && !match(stair.b)))
        throw new Error('Družina musí stát přímo na schodišti.');
      const dest = match(stair.a) ? stair.b : stair.a;
      if (
        !getLevel(a, dest.levelId).map.floors.includes(cellKey(dest.x, dest.y))
      )
        throw new Error(
          'Cíl schodiště už nemá podlahu. PJ musí opravit propojení.',
        );
      a.location = { ...dest };
      recordNoteProximity(g, here);
      trackRoomEntries(g, getLevel(a, dest.levelId))(here, a.location);
      break;
    }
    default:
      throw new Error('Neznámá akce průzkumu.');
  }
  refreshSight(g);
  a.operations = [...a.operations, id].slice(-256);
}
