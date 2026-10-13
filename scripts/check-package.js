import { mkdtempSync, copyFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

// Run after build. Test the *packed* package, not the repository's dev dependencies.
const temp = mkdtempSync(join(tmpdir(), 'uflite-package-'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const run = (command, args, cwd = process.cwd()) =>
  execFileSync(command, args, { cwd, stdio: 'inherit' });

try {
  run(npm, ['pack', '--pack-destination', temp, '--quiet']);
  const { name, version } = JSON.parse(readFileSync('package.json', 'utf8'));
  const tarball = join(temp, `${name}-${version}.tgz`);
  const consumer = join(temp, 'consumer');
  run(npm, ['install', '--prefix', consumer, '--omit=dev', '--ignore-scripts',
    '--no-audit', '--no-fund', '--package-lock=false', tarball]);

  run(process.execPath, ['--input-type=module', '-e', `
    import { strict as assert } from 'node:assert';
    for (const path of ['uflite', 'uflite/lite', 'uflite/nano']) {
      const esm = await import(path);
      const cjs = (await import('node:module')).createRequire(import.meta.url)(path);
      assert.equal(typeof esm.flite, 'function', path + ' ESM');
      assert.equal(typeof cjs.flite, 'function', path + ' CommonJS');
    }
    const { createLocalStorageService } = await import('uflite/services/localStorage');
    const { createTableService } = await import('uflite/services/table');
    assert.equal(typeof createLocalStorageService, 'function');
    assert.equal(typeof createTableService, 'function');
    const { flite } = await import('uflite');
    const app = flite();
    app.get('/health', () => ({ ok: true }));
    assert.deepEqual(await (await app.fetch(new Request('http://localhost/health'))).json(), { ok: true });
    const pkg = (await import('uflite/package.json', { with: { type: 'json' } })).default;
    assert.deepEqual(pkg.dependencies, {});
    for (const name of Object.keys(pkg.peerDependencies)) {
      assert.equal(pkg.peerDependenciesMeta[name]?.optional, true, name);
    }
  `], consumer);

  // A DB-only user should need umosql, not the unrelated S3 peers.
  const dbConsumer = join(temp, 'db-consumer');
  run(npm, ['install', '--prefix', dbConsumer, '--omit=dev', '--ignore-scripts',
    '--no-audit', '--no-fund', '--package-lock=false', tarball, 'umosql@0.3.1']);
  run(process.execPath, ['--input-type=module', '-e', `
    import { strict as assert } from 'node:assert';
    const { createDBService } = await import('uflite/services/db');
    assert.equal(typeof createDBService, 'function');
    assert.deepEqual((await import('uflite/package.json', { with: { type: 'json' } })).default.dependencies, {});
  `], dbConsumer);

  copyFileSync('tests/consumer-smoke.mts', join(consumer, 'consumer-smoke.mts'));
  run(join(process.cwd(), 'node_modules/.bin/tsc'), [
    '--noEmit', '--module', 'nodenext', '--moduleResolution', 'nodenext',
    '--target', 'es2022', '--strict', join(consumer, 'consumer-smoke.mts')
  ], consumer);
  console.log('Packed ESM, CommonJS and NodeNext TypeScript consumers passed.');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
