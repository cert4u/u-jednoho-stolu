import {registerHooks} from 'node:module';
// Match the bundler's extensionless local imports when testing the shared TS core in Node.
registerHooks({resolve(specifier,context,next){try{return next(specifier,context);}catch(error){if(error.code==='ERR_MODULE_NOT_FOUND'&&specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return next(specifier+'.ts',context);throw error;}}});
export const {generateDungeon,generatorOptions}=await import('../lib/dungeon-generator.ts');
