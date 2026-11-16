export type GameInvitation = { room: string; token: string };
export type InvitationSettings = { token: string | null; paused: boolean };

export function gameInvitationUrl(
  origin: string,
  room: string,
  token?: string | null,
) {
  const url = new URL('/', origin);
  url.searchParams.set('room', room);
  if (token) url.hash = new URLSearchParams({ invite: token }).toString();
  return url.href;
}
