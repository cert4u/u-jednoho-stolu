import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function stylesIn(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return stylesIn(path);
    return entry.name.endsWith('.css') ? [path] : [];
  });
}

const sources = ['app', 'components', 'server']
  .flatMap(stylesIn)
  .map((path) => ({
    path,
    css: readFileSync(path, 'utf8'),
  }));
const admin = 'server/admin.html';
for (const [, css] of readFileSync(admin, 'utf8').matchAll(
  /<style\b[^>]*>([\s\S]*?)<\/style>/gi,
)) {
  sources.push({ path: admin, css });
}

let total = 0;
for (const { path, css } of sources) {
  const declarations = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .match(/!\s*important\b/gi);
  if (!declarations) continue;
  total += declarations.length;
  console.error(`${path}: ${declarations.length} deklarací !important`);
}
if (total) process.exitCode = 1;
else console.log('Vlastní CSS: 0 deklarací !important.');
