import { readdir, readFile, writeFile } from 'node:fs/promises';

const categories = ['bestiary', 'dungeon-presets', 'adventures'];
const check = process.argv.includes('--check');

for (const category of categories) {
  const dir = new URL(`../content/${category}/`, import.meta.url);
  const files = (await readdir(dir)).filter(name => name.endsWith('.json')).sort();
  const entries = [];
  for (const file of files) {
    const path = `content/${category}/${file}`;
    let value;
    try {
      value = JSON.parse(await readFile(new URL(file, dir), 'utf8'));
    } catch (error) {
      throw new Error(`${path}: neplatný JSON (${error.message}).`);
    }
    entries.push({ file, path, id: value?.id });
  }
  const seen = new Set();
  for (const { path, id } of entries) {
    if (seen.has(id)) throw new Error(`${path}: duplicitní ID „${id}“.`);
    if (typeof id === 'string') seen.add(id);
  }
  for (const { file, path, id } of entries) {
    if (!/^[a-z][a-z0-9-]{0,49}\.json$/.test(file) || file !== `${id}.json`)
      throw new Error(`${path}: pole id musí odpovídat názvu souboru a používat malá písmena bez diakritiky, číslice nebo pomlčky.`);
  }
  const output = [
    '// Vygenerováno příkazem npm run content:sync.',
    ...entries.map(({ file, id }) => `import entry_${id.replaceAll('-', '_')} from './${file}' with { type: 'json' };`),
    '',
    'export default [',
    ...entries.map(({ path, id }) => `  { path: '${path}', data: entry_${id.replaceAll('-', '_')} },`),
    '];',
    '',
  ].join('\n');
  const index = new URL('index.ts', dir);
  if (!check) {
    await writeFile(index, output);
  } else {
    const current = await readFile(index, 'utf8').catch(error => {
      if (error.code !== 'ENOENT') throw error;
      return '';
    });
    if (current !== output)
      throw new Error(`content/${category}/index.ts: seznam souborů není aktuální. Spusť npm run content:sync.`);
  }
}
