import { claimRecovery, issueRecovery } from '../../../lib/access';
import { initialGame, type Game } from '../../../lib/game';
import { fail } from './responses';

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
    if (game.members.filter((member) => !member.archived).length >= 12)
      return fail('Stůl už má 12 hráčů.');

    const token = crypto.randomUUID();
    const location = game.atlas?.location;
    const member = {
      ...initialGame(String(body.name || 'Dobrodruh').slice(0, 30), token)
        .members[0],
      role: 'player' as const,
      color: ['#698675', '#7789a8', '#b28c47', '#a67887'][
        game.members.length % 4
      ],
      x: location ? location.x : 5 + game.members.length,
      y: location ? location.y : 6,
    };
    game.members.push(member);
    const recoveryCode = await issueRecovery(member, roomId);
    return { member, token, recoveryCode };
  }

  const member = authenticatedMember(game, request);
  return member ? { member } : fail('Připoj se k místnosti.', 401);
}
