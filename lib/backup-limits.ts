/** Compact UTF-8 JSON is the portable campaign size, independent of HTTP whitespace. */
export const MAX_BACKUP_BYTES = 3_000_000;
export const MAX_GAME_REQUEST_BYTES = 3_100_000;

export class CampaignSizeError extends Error {
  constructor() {
    super('Kampaň by překročila limit obnovitelné zálohy (3 MB). Změna nebyla uložena.');
  }
}

export function assertBackupSize(value: unknown) {
  if (new TextEncoder().encode(JSON.stringify(value)).length > MAX_BACKUP_BYTES)
    throw new CampaignSizeError();
}

/** Bound bytes while reading, including chunked requests without Content-Length. */
export async function readGameRequest(request: Request) {
  if (Number(request.headers.get('content-length')) > MAX_GAME_REQUEST_BYTES)
    return null;
  const reader = request.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      bytes += value.byteLength;
      if (bytes > MAX_GAME_REQUEST_BYTES) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}
