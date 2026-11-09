import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const entry = 'app/page.tsx';
const directories = ['components/game-table', 'components/dungeon-map'];
const sources = [
  entry,
  'components/dungeon-map.tsx',
  ...directories.flatMap((directory) =>
    readdirSync(join(root, directory), { recursive: true })
      .filter((file) => /\.tsx?$/.test(file) && !file.endsWith('.d.ts'))
      .map((file) => join(directory, file)),
  ),
];
const graph = new Map(sources.map((file) => [file, []]));
const boundaries = new Map([
  [entry, []],
  ['components/game-table/table-workspace.tsx', [entry]],
  ['components/game-table/use-table-session.ts', [entry]],
]);

const config = ts.readConfigFile(join(root, 'tsconfig.json'), ts.sys.readFile);
if (config.error)
  throw new Error(
    ts.flattenDiagnosticMessageText(config.error.messageText, '\n'),
  );
const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, root);

function isTypeOnlyList(bindings) {
  return (
    bindings?.elements?.length &&
    bindings.elements.every((element) => element.isTypeOnly)
  );
}

for (const [file, dependencies] of graph) {
  const filename = join(root, file);
  const source = ts.createSourceFile(
    filename,
    readFileSync(filename, 'utf8'),
    ts.ScriptTarget.Latest,
  );
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      if (
        clause?.isTypeOnly ||
        (!clause?.name && isTypeOnlyList(clause?.namedBindings))
      )
        continue;
    } else if (ts.isExportDeclaration(statement)) {
      if (statement.isTypeOnly || isTypeOnlyList(statement.exportClause))
        continue;
    } else continue;
    if (
      !statement.moduleSpecifier ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    )
      continue;
    const specifier = statement.moduleSpecifier.text;
    if (!specifier.startsWith('.') && !specifier.startsWith('@/')) continue;
    const { resolvedModule } = ts.resolveModuleName(
      specifier,
      filename,
      options,
      ts.sys,
    );
    if (!resolvedModule) continue; // TypeScript reports missing imports.
    const target = relative(root, resolvedModule.resolvedFileName);
    const allowed = boundaries.get(target);
    if (allowed && !allowed.includes(file)) {
      throw new Error(
        `Zakázaný import směrem k řídicímu modulu: ${file} → ${target}`,
      );
    }
    if (graph.has(target)) dependencies.push(target);
  }
}

const visited = new Set();
const chain = [];
function visit(file) {
  const start = chain.indexOf(file);
  if (start !== -1) {
    throw new Error(
      `Cyklus v herním UI: ${[...chain.slice(start), file].join(' → ')}`,
    );
  }
  if (visited.has(file)) return;
  chain.push(file);
  for (const dependency of graph.get(file)) visit(dependency);
  chain.pop();
  visited.add(file);
}

for (const file of graph.keys()) visit(file);
console.log(
  `PASS: ${graph.size} modulů herního stolu a mapy bez cyklů a zpětných importů.`,
);
