export type Session = { room: string; token: string };
export type SessionScope = { session: Session | null };
export type ChatTab = 'chat' | 'dice';
export type GameAction = (
  action: string,
  values?: Record<string, unknown>,
) => Promise<boolean>;
