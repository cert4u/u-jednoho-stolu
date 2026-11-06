export function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export const gameHeaders = { 'Cache-Control': 'no-store' };
