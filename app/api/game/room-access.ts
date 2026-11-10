import { claimRecovery, issueRecovery } from '../../../lib/access';
import { initialGame, type Game } from '../../../lib/game';
import { cellKey } from '../../../lib/dungeon';
import { MAP_WIDTH } from '../../../lib/map-limits';
import { fail } from './responses';

const JOIN_START_Y = 6;

function startingPosition(game: Game, activeBefore: number) {
  const location = game.atlas?.location;
  if (location) return { x: location.x, y: location.y };
  return { x: 5 + activeBefore, y: JOIN_START_Y };
}

export function repairLegacyMemberPositions(game: Game) {
  const battle = game.atlas?.battle;
  const battleFloor =
    battle &&
    game.atlas?.levels.find((level) => level.id === battle.levelId)?.map.floors;
  const battleCells = battleFloor && new Set(battleFloor);
  const validBattleOrigin =
    battle && battleCells?.has(cellKey(...battle.origin))
      ? battle.origin
      : undefined;

  // Older rooms used 5 + the number of members, including archived characters.
  const lastPossibleJoinX = 5 + game.members.length - 1;
  let activeBefore = 0;
  for (const member of game.members) {
    if (
      member.role === 'player' &&
      member.y === JOIN_START_Y &&
      Number.isInteger(member.x) &&
      member.x >= MAP_WIDTH &&
      member.x <= lastPossibleJoinX
    ) {
      Object.assign(member, startingPosition(game, activeBefore));
    }
    if (
      validBattleOrigin &&
      battleCells &&
      member.role === 'player' &&
      !member.archived &&
      !battleCells.has(cellKey(member.x, member.y))
    ) {
      [member.x, member.y] = validBattleOrigin;
    }
    if (!member.archived) activeBefore++;
  }
  return game;
}

export function authenticatedMember(game: Game, request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  return game.members.find(
    (member) => !member.archived && member.token === token,
  );
}

export async function resolveActionMember(
  game: Game,
  roomId: string,
  request: Request,
  body: Record<string, unknown>,
) {
  if (body.action === 'recover') {
    try {
      const { member, recoveryCode } = await claimRecovery(
        game,
        roomId,
        body.recoveryCode,
        body.requestId,
      );
      return { member, token: member.token, recoveryCode };
    } catch (error) {
      return fail(
        error instanceof Error ? error.message : 'Neplatný klíč.',
        401,
      );
    }
  }

  if (body.action === 'join') {
    if (game.members.length >= 200)
      return fail(
        'Místnost má příliš mnoho archivovaných postav. Založ další kampaň.',
      );
    const activeCount = game.members.filter(
      (member) => !member.archived,
    ).length;
    if (activeCount >= 12) return fail('Stůl už má 12 hráčů.');

    const token = crypto.randomUUID();
    const member = {
      ...initialGame(String(body.name || 'Dobrodruh').slice(0, 30), token)
        .members[0],
      role: 'player' as const,
      color: ['#698675', '#7789a8', '#b28c47', '#a67887'][
        game.members.length % 4
      ],
      ...startingPosition(game, activeCount),
    };
    game.members.push(member);
    const recoveryCode = await issueRecovery(member, roomId);
    return { member, token, recoveryCode };
  }

  const member = authenticatedMember(game, request);
  return member ? { member } : fail('Připoj se k místnosti.', 401);
}
