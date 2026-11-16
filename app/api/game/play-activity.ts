import type { Game, Member } from '../../../lib/game';

// Compare a marker before and after the action so replayed or unchanged moves
// do not add another day to the statistics.
export function playMarker(
  game: Game,
  member: Member,
  body: Record<string, unknown>,
) {
  if (member.role !== 'player') return;
  switch (body.action) {
    case 'chat':
    case 'roll':
      return game.messages.at(-1)?.id || '';
    case 'move':
      return member.x + ',' + member.y;
    case 'explore':
      if (['move', 'door', 'travel', 'battle-move'].includes(String(body.op)))
        return game.atlas?.operations.at(-1) || '';
      return;
    case 'mechanics':
      return game.mechanicsOperations?.at(-1) || '';
    case 'challenge':
      return body.op === 'roll'
        ? game.challengeOperations?.at(-1) || ''
        : undefined;
    case 'power':
      return body.op === 'use' ? game.powerOperations?.at(-1) || '' : undefined;
    default:
      return;
  }
}
