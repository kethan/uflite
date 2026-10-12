import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';

test('public hook, utility, resolver, and service subpaths resolve', async () => {
  const [hooks, flow, data, authHooks, lifecycle, result, predicates, transformers, resolvers, services, middlewares, utils] = await Promise.all([
    import('uflite/hooks'),
    import('uflite/hooks/flow'),
    import('uflite/hooks/data'),
    import('uflite/hooks/auth'),
    import('uflite/hooks/lifecycle'),
    import('uflite/hooks/result'),
    import('uflite/predicates'),
    import('uflite/transformers'),
    import('uflite/resolvers'),
    import('uflite/services'),
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
  expect(typeof services.createDBService).toBe('function');
  expect(typeof services.createTableService).toBe('function');
  expect(typeof services.createStorageService).toBe('function');
  expect(typeof services.createStorage).toBe('function');
  expect(typeof middlewares.cors).toBe('function');
  expect(typeof middlewares.requestId).toBe('function');
  expect(typeof middlewares.basicAuth).toBe('function');
  expect(typeof utils.isObject).toBe('function');
});

test('optional auth and ACL service entries resolve separately', async () => {
  const [auth, acl] = await Promise.all([import('uflite/services/auth'), import('uflite/services/acl')]);
  expect(typeof auth.createAuth).toBe('function');
  expect(typeof auth.sqlAdapterFactory).toBe('function');
  expect(typeof acl.createACL).toBe('function');
});

test('Better Auth remains development-only', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  expect(pkg.devDependencies['better-auth']).toBeTruthy();
  expect(pkg.dependencies['better-auth']).toBeUndefined();
});

test('the root package export includes generic helpers after build', async () => {
  const root = await import('uflite');
  expect(typeof root.flite).toBe('function');
  expect(typeof root.requireAuth).toBe('function');
  expect(typeof root.trimString).toBe('undefined');
  expect(typeof root.transformers.trimString).toBe('function');
});
