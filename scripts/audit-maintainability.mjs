import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const extension = [
  '',
  '.ts',
  '.tsx',
  '.mts',
  '.mjs',
  '.js',
  '/index.ts',
  '/index.tsx',
];
// The updater Dockerfile copies this shared module into the container root.
const deploymentAliases = { 'deploy/updater/http.mjs': 'server/http.mjs' };
const files = (dir) =>
  !existsSync(dir)
    ? []
    : readdirSync(dir).flatMap((name) => {
        const file = path.join(dir, name);
        return statSync(file).isDirectory() ? files(file) : [file];
      });
const source = (file) => /\.[cm]?[jt]sx?$/.test(file);
const optionalRoots = [
  'components/connector-error.tsx',
  'lib/connectors.ts',
  'lib/connector-contract.mts',
  'lib/connector-errors.mts',
  'lib/connector-preview.d.ts',
];
const roots = [
  ...files('app').filter(source),
  ...files('scripts').filter(source),
  'server/start.mjs',
  'deploy/updater/start.mjs',
  'worker/index.ts',
  'vite.config.ts',
  ...optionalRoots,
];
const seen = new Set(),
  packages = new Set(),
  unresolved = new Set();
function visit(file) {
  file = path.normalize(file);
  if (seen.has(file) || !existsSync(file)) return;
  seen.add(file);
  const text = readFileSync(file, 'utf8');
  const imports = ts
    .preProcessFile(text, true, true)
    .importedFiles.map((item) => item.fileName);
  // Styles and framework configuration are package consumers too.
  for (const match of text.matchAll(/@import\s+["']([^"']+)["']/g))
    imports.push(match[1]);
  for (const name of imports) {
    if (name.startsWith('.') || name.startsWith('@/')) {
      const base = name.startsWith('@/')
        ? name.slice(2)
        : path.join(path.dirname(file), name);
      const candidates = [
        deploymentAliases[base],
        ...(base.endsWith('.mjs') ? [base.slice(0, -4) + '.mts'] : []),
        ...extension.map((ext) => base + ext),
      ].filter(Boolean);
      const target = candidates.find(
        (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
      );
      if (target && !target.startsWith('dist/')) visit(target);
      else if (!target) unresolved.add(`${file}: ${name}`);
    } else if (!name.startsWith('node:')) {
      packages.add(
        name.startsWith('@')
          ? name.split('/').slice(0, 2).join('/')
          : name.split('/')[0],
      );
    }
  }
}
roots.forEach(visit);
const ui = files('components/ui').filter(source);
const ownSources = ['components', 'hooks', 'lib'].flatMap(files).filter(source);
const css = readFileSync('app/globals.css', 'utf8');
for (const match of css.matchAll(/@import\s+["']([^"']+)["']/g))
  packages.add(match[1]);
const selectors = new Map();
for (const match of css
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .matchAll(/([^{}]+)\{/g)) {
  const selector = match[1].trim();
  if (!selector.startsWith('@'))
    selectors.set(selector, (selectors.get(selector) ?? 0) + 1);
}
const report = {
  scope:
    'Conservative literal import graph from app, server, worker, scripts and optional connector UI. Unreachable files and package candidates require review of dynamic imports, CSS and framework/tool configuration; nothing is deleted automatically.',
  roots,
  optionalRoots,
  deploymentAliases,
  reachableModules: seen.size,
  ui: {
    total: ui.length,
    reachable: ui.filter((file) => seen.has(file)),
    notReachable: ui.filter((file) => !seen.has(file)),
  },
  unreachableOwnSources: ownSources.filter((file) => !seen.has(file)),
  dependenciesWithoutReachableImport: Object.keys(
    JSON.parse(readFileSync('package.json', 'utf8')).dependencies,
  ).filter((name) => !packages.has(name)),
  unresolvedLiteralImports: [...unresolved].sort(),
  css: {
    bytes: Buffer.byteLength(css),
    important: (css.match(/!important/g) || []).length,
    repeatedSelectors: [...selectors]
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([selector, count]) => ({ selector, count })),
  },
};
const args = process.argv.slice(2);
if (args.length > 1)
  throw Error('Použij node scripts/audit-maintainability.mjs [výstup.json].');
const output = args[0] || 'docs/performance/maintainability-current.json';
writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      output,
      ui: report.ui,
      unreachableOwnSources: report.unreachableOwnSources,
      dependenciesWithoutReachableImport:
        report.dependenciesWithoutReachableImport,
    },
    null,
    2,
  ),
);
