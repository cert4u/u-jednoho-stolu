import { readdir, readFile, writeFile } from 'node:fs/promises';

const categories = ['bestiary', 'dungeon-presets', 'adventures', 'scenery'];
const check = process.argv.includes('--check');

for (const category of categories) {
  const dir = new URL(`../content/${category}/`, import.meta.url);
  const files = (await readdir(dir)).filter(name => name.endsWith('.json')).sort();
  if (files.length === 0) throw new Error(`content/${category}: přidej alespoň jednu předlohu JSON.`);
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
    'const entries = [',
    ...entries.map(({ path, id }) => `  { path: '${path}', data: entry_${id.replaceAll('-', '_')} },`),
    '];',
    'export default entries;',
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

// Fingerprint the distributed definitions and portraits, without a database import.
const {createHash}=await import('node:crypto');
const builtinHash=createHash('sha256');
for(const category of categories)for(const file of (await readdir(new URL(`../content/${category}/`,import.meta.url))).filter(n=>n.endsWith('.json')).sort()){
  builtinHash.update(category+'/'+file+'\0');builtinHash.update(await readFile(new URL(`../content/${category}/${file}`,import.meta.url)));
}
for(const file of (await readdir(new URL('../public/monsters/',import.meta.url))).filter(n=>n.endsWith('.webp')).sort()){
  builtinHash.update('monsters/'+file+'\0');builtinHash.update(await readFile(new URL('../public/monsters/'+file,import.meta.url)));
}
const fingerprint=new URL('../content/builtin-digest.ts',import.meta.url);
const fingerprintSource=`// Vygenerováno příkazem npm run content:sync.\nconst digest = '${builtinHash.digest('hex')}';\nexport default digest;\n`;
if(check){if(await readFile(fingerprint,'utf8').catch(()=> '')!==fingerprintSource)throw new Error('content/builtin-digest.ts: spusť npm run content:sync.');}
else await writeFile(fingerprint,fingerprintSource);
