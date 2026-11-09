export type Session = { room: string; token: string };
export type SessionScope = {
  session: Session | null;
  id: number;
  openAccount: boolean;
};
export type ViewRequest = { readonly levelId: string };
export type ChatTab = 'chat' | 'dice';
export type GameAction = (
  action: string,
  values?: Record<string, unknown>,
) => Promise<boolean>;
