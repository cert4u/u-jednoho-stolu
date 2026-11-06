import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Keep the development table separate from the native hosting database.
process.env.STUL_RUNTIME = 'node';
process.env.STUL_DATA_DIR = resolve('.stul-dev-data');

const cli = new URL('../node_modules/vinext/dist/cli.js', import.meta.url);
process.argv = [
  process.execPath,
  fileURLToPath(cli),
  'dev',
  '--hostname',
  '127.0.0.1',
  '--port',
  '5174',
];
await import(cli.href);
