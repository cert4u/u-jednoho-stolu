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
const withoutComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const entry = sources.find(({ path }) => path === join('app', 'globals.css'));
const importLine = /^@import\s+(?:url\((['"])[^'"]+\1\)|(['"])[^'"]+\2);$/;
if (
  !entry ||
  withoutComments(entry.css)
    .split('\n')
    .map((line) => line.trim())
    .some((line) => line && !importLine.test(line))
) {
  console.error(
    'app/globals.css: pravidla patří do app/styles; zde ponech jen importy.',
  );
  process.exitCode = 1;
}

const admin = 'server/admin.html';
for (const [, css] of readFileSync(admin, 'utf8').matchAll(
  /<style\b[^>]*>([\s\S]*?)<\/style>/gi,
)) {
  sources.push({ path: admin, css });
}

let total = 0;
for (const { path, css } of sources) {
  const declarations = withoutComments(css).match(/!\s*important\b/gi);
  if (!declarations) continue;
  total += declarations.length;
  console.error(`${path}: ${declarations.length} deklarací !important`);
}
if (total) process.exitCode = 1;
else if (!process.exitCode)
  console.log(
    'Vlastní CSS: 0 deklarací !important; globals.css obsahuje jen importy.',
  );
