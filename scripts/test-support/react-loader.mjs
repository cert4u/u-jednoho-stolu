import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

export function registerReactTestLoader() {
  return registerHooks({
    resolve(specifier, context, next) {
      try { return next(specifier, context); }
      catch (error) {
        if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier))
          return next(specifier + '.tsx', context);
        throw error;
      }
    },
    load(url, context, next) {
      if (!url.endsWith('.tsx')) return next(url, context);
      return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText };
    },
  });
}
