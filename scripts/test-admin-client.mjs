import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Embedded browsers intentionally do not provide these modal JavaScript APIs.
// Guard the compatibility boundary that API-only integration tests cannot cover.
for (const file of [
  'server/admin.js',
  'server/admin-catalogs.js',
  'server/admin-catalog-presentation.js',
  'server/admin-catalog-state.js',
  'server/admin-catalog-editor.js',
  'server/admin-catalog-view.js',
  'server/admin-catalog-api.js',
  'server/admin-catalog-operations.js',
  'server/admin-dialog.js',
]) {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const call = node.expression;
      const direct =
        ts.isIdentifier(call) &&
        ['prompt', 'confirm', 'alert'].includes(call.text);
      const browser =
        ts.isPropertyAccessExpression(call) &&
        ts.isIdentifier(call.expression) &&
        ['window', 'globalThis'].includes(call.expression.text) &&
        ['prompt', 'confirm', 'alert'].includes(call.name.text);
      assert(
        !direct && !browser,
        `${file}: native dialog ${call.getText(source)} is unsupported; use the in-page dialog.`,
      );
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
console.log(
  'PASS: administrator clients do not call unsupported native browser dialogs.',
);
