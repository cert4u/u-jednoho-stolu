// @ts-check

/** @param {() => number} generationForSession */
export function createCatalogApi(generationForSession) {
  /**
   * @template {import('./catalog-admin-contract').CatalogAction} Action
   * @param {Action | `${Action}?${string}`} action
   * @param {import('./catalog-admin-contract').CatalogArguments<Action>} args
   * @returns {Promise<import('./catalog-admin-contract').CatalogResponses[Action]>}
   */
  return async function api(action, ...[data, options = {}]) {
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
    /** @type {unknown} */
    const value = await response.json();
    if (generation !== generationForSession())
      throw new Error('Přihlášení se mezitím změnilo.');
    if (!response.ok) {
      const error =
        value && typeof value === 'object' && 'error' in value
          ? value.error
          : undefined;
      throw new Error(
        error ? String(error) : 'Katalogovou operaci se nepodařilo dokončit.',
      );
    }
    // The authenticated same-origin server determines the JSON shape by action.
    return /** @type {import('./catalog-admin-contract').CatalogResponses[Action]} */ (
      value
    );
  };
}
