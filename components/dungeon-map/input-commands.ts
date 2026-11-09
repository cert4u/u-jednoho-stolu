import type { RefObject, Dispatch, SetStateAction } from 'react';
import type { MapCommand, Point } from '../../lib/dungeon';
import type { MapInput } from './input-types';

type InputCommands = Pick<
  MapInput,
  | 'onAction'
  | 'exploration'
  | 'members'
  | 'pj'
  | 'me'
  | 'selected'
  | 'canLead'
  | 'busy'
> & {
  lock: RefObject<boolean>;
  retry: Record<string, unknown> | null;
  setRetry: Dispatch<SetStateAction<Record<string, unknown> | null>>;
};

export function createMapCommands({
  onAction,
  exploration,
  members,
  pj,
  me,
  selected,
  canLead,
  busy,
  lock,
  retry,
  setRetry,
}: InputCommands) {
  async function runCommand(run: () => Promise<boolean | undefined>) {
    if (busy || lock.current) return false;
    lock.current = true;
    try {
      return await run();
    } finally {
      lock.current = false;
    }
  }

  function sendMap(command: MapCommand | Record<string, unknown>) {
    return runCommand(async () => {
      const payload = {
        levelId: exploration?.levelId,
        ...command,
        requestId: crypto.randomUUID(),
      };
      setRetry(null);
      const ok = await onAction('map', payload);
      if (!ok) setRetry(payload);
      return ok;
    });
  }

  function retryMap() {
    if (!retry) return;
    // Retrying a drawing edit resends the original payload and operation ID.
    return runCommand(async () => {
      const ok = await onAction('map', retry);
      if (ok) setRetry(null);
      return ok;
    });
  }

  function sendReplayable(action: string, values: Record<string, unknown>) {
    return runCommand(() =>
      onAction(action, { ...values, requestId: crypto.randomUUID() }),
    );
  }

  function sendExplore(op: string, values: Record<string, unknown> = {}) {
    return sendReplayable('explore', { op, ...values });
  }

  function moveCharacter([x, y]: Point, token?: string) {
    const id = token || selected || (!pj ? me : '');
    if (exploration?.enabled) {
      if (exploration.battle) {
        const who = members.find((member) => member.id === id);
        if (!who || (!pj && id !== me)) return;
        return sendExplore('battle-move', {
          battleId: exploration.battle.id,
          memberId: id,
          x,
          y,
          expected: { x: who.x, y: who.y },
        });
      }
      if (canLead) return sendExplore('move', { x, y });
    } else if (id) {
      return runCommand(() => onAction('move', { id, x, y }));
    }
  }

  function moveMonster(monsterId: string, [x, y]: Point) {
    return sendReplayable('monster', { op: 'move', monsterId, x, y });
  }

  function placeParty([x, y]: Point) {
    return sendExplore('place', { x, y });
  }

  function toggleDoor(edge: string) {
    return sendExplore('door', { edge });
  }

  return {
    sendMap,
    sendExplore,
    moveCharacter,
    moveMonster,
    placeParty,
    toggleDoor,
    moveNote: (values: Record<string, unknown>) =>
      sendReplayable('map-note', { ...values, op: 'move' }),
    retryMap,
  };
}
