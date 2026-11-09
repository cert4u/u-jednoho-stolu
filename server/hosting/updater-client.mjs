export function createUpdaterClient(token) {
  return async function updater(
    endpoint,
    method = 'GET',
    data,
    refresh = false,
  ) {
    const url = new URL(process.env.STUL_UPDATER_URL || 'http://updater:8090');
    if (url.protocol !== 'http:' || url.username || url.password)
      throw new Error('Neplatná adresa aktualizátoru.');
    url.pathname = endpoint;
    url.search = refresh ? '?refresh' : '';
    let response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        ...(data ? { body: JSON.stringify(data) } : {}),
        signal: AbortSignal.timeout(45000),
      });
    } catch {
      throw new Error(
        'Aktualizační služba není dostupná. Ověř, že běží Docker updater.',
      );
    }
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || 'Aktualizační služba není dostupná.');
    return result;
  };
}
