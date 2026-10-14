import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';

test('public hook, utility, resolver, and middleware subpaths resolve', async () => {
  const [hooks, flow, data, authHooks, lifecycle, result, predicates, transformers, resolvers, middlewares, utils] = await Promise.all([
    import('uflite/hooks'),
    import('uflite/hooks/flow'),
    import('uflite/hooks/data'),
    import('uflite/hooks/auth'),
    import('uflite/hooks/lifecycle'),
    import('uflite/hooks/result'),
    import('uflite/predicates'),
    import('uflite/transformers'),
    import('uflite/resolvers'),
    import('uflite/middlewares'),
    import('uflite/utils')
  ]);

  expect(typeof hooks.requireAuth).toBe('function');
  expect(typeof flow.throwIf).toBe('function');
  expect(typeof data.requireFields).toBe('function');
  expect(typeof authHooks.rateLimit).toBe('function');
  expect(typeof lifecycle.auditFields).toBe('function');
  expect(typeof result.transformResult).toBe('function');
  expect(typeof predicates.isPresent).toBe('function');
  expect(typeof transformers.trimString).toBe('function');
  expect(typeof resolvers.fromPath).toBe('function');
  expect(typeof middlewares.cors).toBe('function');
  expect(typeof middlewares.requestId).toBe('function');
  expect(typeof middlewares.basicAuth).toBe('function');
  expect(typeof utils.isObject).toBe('function');
});

test('individual service subpaths preserve their named and default exports', async () => {
  const [db, table, storage, local] = await Promise.all([
    import('uflite/services/db'),
    import('uflite/services/table'),
    import('uflite/services/storage'),
    import('uflite/services/local-storage')
  ]);
  expect(typeof db.createDBService).toBe('function');
  expect(db.default).toBe(db.createDBService);
  expect(typeof table.createTableService).toBe('function');
  expect(table.default).toBe(table.createTableService);
  expect(typeof storage.createStorageService).toBe('function');
  expect(storage.default).toBe(storage.createStorageService);
  expect(storage.createStorage).toBe(storage.createStorageService);
  expect(typeof local.createLocalStorageService).toBe('function');
  expect(local.default).toBe(local.createLocalStorageService);
});

test('standalone middleware example uses resolvable public entries', async () => {
  const { default: example } = await import('../examples/middleware-example.js');
  expect(typeof example.fetch).toBe('function');
});

test('service worker example uses lite and returns native JSON Responses', async () => {
  const previousSelf = globalThis.self;
  let handler;
  globalThis.self = { addEventListener: (event, callback) => {
    expect(event).toBe('fetch');
    handler = callback;
  } };
  try {
    await import('../examples/service-worker.js');
    let response;
    handler({
      request: new Request('https://example.test/users/42'),
      respondWith: promise => { response = promise; }
    });
    expect(await (await response).json()).toEqual({ id: '42' });
  } finally {
    if (previousSelf === undefined) delete globalThis.self;
    else globalThis.self = previousSelf;
  }
});

test('no eager optional-service barrel is exported', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  expect(pkg.exports['./services']).toBeUndefined();
});

test('optional auth and ACL service entries resolve separately', async () => {
  const [auth, acl] = await Promise.all([import('uflite/services/auth'), import('uflite/services/acl')]);
  expect(typeof auth.createAuth).toBe('function');
  expect(auth.default).toBe(auth.createAuth);
  expect(typeof auth.sqlAdapterFactory).toBe('function');
  expect(typeof acl.createACL).toBe('function');
});

test('Better Auth remains development-only', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  expect(pkg.devDependencies['better-auth']).toBeTruthy();
  expect(pkg.dependencies['better-auth']).toBeUndefined();
});

test('root, lite and nano expose only their actual runtime exports', async () => {
  const [root, lite, nano] = await Promise.all([
    import('uflite'), import('uflite/lite'), import('uflite/nano')
  ]);
  expect(typeof root.flite).toBe('function');
  expect(typeof root.run).toBe('function');
  expect(typeof root.requireAuth).toBe('function');
  expect(typeof root.trimString).toBe('undefined');
  expect(typeof root.transformers.trimString).toBe('function');
  for (const name of ['events', 'channels', 'services']) {
    expect(name in root).toBe(false);
  }
  expect('run' in nano).toBe(false);
  expect('run' in lite).toBe(false);
});
