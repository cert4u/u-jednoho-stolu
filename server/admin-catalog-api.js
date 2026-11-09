export function createCatalogApi(generationForSession) {
  return async function api(action, data, options = {}) {
    const generation = generationForSession();
    const response = await fetch(
      '/admin/api/catalogs' + (action ? '/' + action : ''),
      data === undefined
        ? options
        : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            ...options,
          },
    );
    const value = await response.json();
    if (generation !== generationForSession())
      throw new Error('Přihlášení se mezitím změnilo.');
    if (!response.ok) {
      throw new Error(
        value.error || 'Katalogovou operaci se nepodařilo dokončit.',
      );
    }
    return value;
  };
}
