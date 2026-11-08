import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--write'))
  throw new Error('Použij npm run format nebo npm run format:check.');
const files = JSON.parse(
  readFileSync(new URL('./format-scope.json', import.meta.url), 'utf8'),
);
const result = spawnSync(
  process.execPath,
  [
    fileURLToPath(
      new URL('../node_modules/prettier/bin/prettier.cjs', import.meta.url),
    ),
    args.includes('--write') ? '--write' : '--check',
    ...files,
  ],
  { cwd: fileURLToPath(new URL('../', import.meta.url)), stdio: 'inherit' },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
