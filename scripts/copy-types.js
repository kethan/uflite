import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

for (const [source, destination] of [
  ['src/index.d.ts', 'dist/index.d.ts'],
  ['src/nano/index.d.ts', 'dist/nano/index.d.ts'],
  ['src/lite/index.d.ts', 'dist/lite/index.d.ts']
]) {
  mkdirSync(destination.slice(0, destination.lastIndexOf('/')), { recursive: true });
  cpSync(source, destination);
}

// The full declaration lives in dist/, while shared type-only hooks stay in src/.
const fullTypes = 'dist/index.d.ts';
writeFileSync(fullTypes, readFileSync(fullTypes, 'utf8').replaceAll("'./hooks/types.js'", "'../src/hooks/types.js'"));
