import type { Game, Member } from '../../../../lib/game';
import { issueRecovery } from '../../../../lib/access';
import { fail } from '../responses';

export async function applyMemberAction(
  game: Game,
  member: Member,
  roomId: string,
  body: Record<string, unknown>,
) {
  const pj = member.role === 'pj';
  let recoveryCode: string | undefined;
  switch (body.action) {
    case 'access-key': {
      const target = game.members.find((m) => m.id === body.memberId && !m.archived);
      if (!target || (target.id !== member.id && (!pj || target.role === 'pj')))
        return fail('Tento přístup nemůžeš obnovit.', 403);
      recoveryCode = await issueRecovery(target, roomId);
      break;
    }
    case 'member-archive':
    case 'member-restore': {
      if (!pj) return fail('Postavy spravuje pouze PJ.', 403);
      const target = game.members.find(
        (m) => m.id === body.memberId && m.role === 'player',
      );
      if (!target) return fail('Postava neexistuje.');
      if (
        body.action === 'member-restore' &&
        game.members.filter((m) => !m.archived).length >= 12
      )
        return fail('U stolu už je 12 účastníků.');
      target.archived = body.action === 'member-archive';
      target.token = crypto.randomUUID();
      target.recoveryHash = undefined;
      target.recoveryReplay = undefined;
      if (!target.archived) recoveryCode = await issueRecovery(target, roomId);
      break;
    }
  }
  return { recoveryCode };
}
