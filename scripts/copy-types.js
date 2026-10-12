import { cpSync, mkdirSync } from 'node:fs';

for (const [source, destination] of [
  ['src/index.d.ts', 'dist/index.d.ts'],
  ['nano/index.d.ts', 'nano/dist/index.d.ts'],
  ['lite/index.d.ts', 'lite/dist/index.d.ts']
]) {
  mkdirSync(destination.slice(0, destination.lastIndexOf('/')), { recursive: true });
  cpSync(source, destination);
}
