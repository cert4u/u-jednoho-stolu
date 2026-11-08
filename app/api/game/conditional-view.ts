import { gameHeaders } from './responses';

/** Hash the authorized projection, including time-dependent presence, never the private room. */
export async function conditionalView(request: Request, value: unknown) {
  const body = JSON.stringify(value);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
  const etag = '"' + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('') + '"';
  const headers = { ...gameHeaders, ETag: etag, Vary: 'Authorization', 'Content-Type': 'application/json' };
  return request.headers.get('if-none-match') === etag
    ? new Response(null, { status: 304, headers })
    : new Response(body, { headers });
}
