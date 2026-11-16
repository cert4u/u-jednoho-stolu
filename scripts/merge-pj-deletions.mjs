import { mergePjDeletions } from '../server/hosting/pj-deletions.mjs';

const [sourceFile, targetDirectory] = process.argv.slice(2);
if (process.argv.length !== 4 || !sourceFile || !targetDirectory) {
  console.error(
    'Použití: node scripts/merge-pj-deletions.mjs <zdrojový pj-deletions.sqlite> <cílový datový adresář>',
  );
  process.exitCode = 1;
} else {
  mergePjDeletions(sourceFile, targetDirectory);
}
