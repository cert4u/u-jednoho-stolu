import type { RefObject, Dispatch, SetStateAction } from 'react';
import type { MapCommand, Point } from '../../lib/dungeon';
import type { MapInput } from './input-types';

type InputCommands = Pick<
  MapInput,
  'onAction' | 'exploration' | 'members' | 'pj' | 'me'
> & {
  lock: RefObject<boolean>;
  retry: Record<string, unknown> | null;
  setRetry: Dispatch<SetStateAction<Record<string, unknown> | null>>;
};
/** A command keeps its request ID across retries; all tools share one in-flight lock. */
export function createMapCommands({
  onAction,
  exploration,
  members,
  pj,
  me,
  lock,
  retry,
  setRetry,
}: InputCommands) {
  async function sendMap(command: MapCommand | Record<string, unknown>) {
    const payload = {
      levelId: exploration?.levelId,
      ...command,
      requestId: crypto.randomUUID(),
    };
    lock.current = true;
    setRetry(null);
    try {
      if (!(await onAction('map', payload))) setRetry(payload);
    } finally {
      lock.current = false;
    }
  }
  async function moveBattle(id: string, to: Point) {
    const who = members.find((m) => m.id === id);
    if (!who || (!pj && id !== me)) return;
    return sendExplore('battle-move', {
      battleId: exploration?.battle?.id,
      memberId: id,
      x: to[0],
      y: to[1],
      expected: { x: who.x, y: who.y },
    });
  }
  async function sendExplore(op: string, values: Record<string, unknown> = {}) {
    if (lock.current) return false;
    lock.current = true;
    try {
      return await onAction('explore', {
        op,
        ...values,
        requestId: crypto.randomUUID(),
      });
    } finally {
      lock.current = false;
    }
  }
  async function retryMap() {
    if (!retry) return;
    lock.current = true;
    try {
      if (await onAction('map', retry)) setRetry(null);
    } finally {
      lock.current = false;
    }
  }
  return { sendMap, sendExplore, moveBattle, retryMap };
}
