import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { flite, status as UfliteError } from '../src/index.js';
import {
  setDefaults, requireFields, auditFields, transformResult,
  requireAuth, throwIf, requireMethod
} from '../src/index.js';

for (const mode of [0, 1]) {
  test(`real uflite service hooks: mode ${mode} executes before/core/after hooks`, async () => {
    const app = flite({ mode });
    const stored = [];
    const service = app.service('items', {
      async create(data) { stored.push({ ...data }); return { ...data, id: '1', secret: 'hide' }; },
      async find() { return [{ id: '1', name: ' Alice ', secret: 'hide' }]; },
      async patch(id, data) { return { id, ...data, secret: 'hide' }; }
    });

    service.hooks({
      before: {
        create: [
          requireAuth(),
          requireFields(['name']),
          setDefaults({ active: true }),
          auditFields({ now: () => 'fixed-time' })
        ],
        patch: [requireAuth()]
      },
      after: {
        find: [transformResult(rows => rows.map(row => ({ id: row.id, name: row.name.trim() })))],
        patch: [transformResult(result => ({ id: result.id, name: result.name }))]
      }
    });

    const created = await service.create({ name: 'Example' }, { user: { id: 'u1' } });
    assert.equal(created.active, true);
    assert.equal(created.createdBy, 'u1');
    assert.equal(created.updatedBy, 'u1');
    assert.equal(created.updatedAt, 'fixed-time');
    assert.equal(stored[0].createdBy, 'u1');

    assert.deepEqual(await service.find(), [{ id: '1', name: 'Alice' }]);
    assert.deepEqual(await service.patch('1', { name: 'Updated' }, { user: { id: 'u1' } }), { id: '1', name: 'Updated' });
  });

  test(`real uflite service hooks: mode ${mode} propagates uflite status errors`, async () => {
    const app = flite({ mode });
    const service = app.service('secure', { async create(data) { return data; } });
    service.hooks({ before: { create: [requireAuth()] } });
    await assert.rejects(service.create({ name: 'x' }), error =>
      error instanceof UfliteError && error.status === 401 && error.code === 'UNAUTHENTICATED'
    );
  });

  test(`real uflite service hooks: mode ${mode} blocks rejected operations before core`, async () => {
    const app = flite({ mode });
    let calls = 0;
    const service = app.service('blocked', { async create(data) { calls++; return data; } });
    service.hooks({ before: { create: [throwIf(ctx => ctx.data.blocked, { error: { message: 'blocked', status: 403, code: 'BLOCKED' } })] } });
    await assert.rejects(service.create({ blocked: true }), error => error.status === 403 && error.code === 'BLOCKED');
    assert.equal(calls, 0);
  });
}

test('real uflite hook methods and mode 1 next ordering', async () => {
  const app = flite({ mode: 1 });
  const order = [];
  const service = app.service('ordered', { async create(data) { order.push('core'); return data; } });
  service.hooks({ before: { create: [
    async (ctx, next) => { order.push('first-before'); await next(); order.push('first-after'); },
    async (ctx, next) => { order.push('second-before'); await next(); order.push('second-after'); }
  ] } });
  await service.create({ ok: true });
  assert.deepEqual(order, ['first-before', 'second-before', 'second-after', 'first-after', 'core']);
});

test('requireMethod uses uflite error type', async () => {
  const app = flite({ mode: 0 });
  const service = app.service('method-check', { async create(data) { return data; } });
  service.hooks({ before: { create: [requireMethod('patch')] } });
  await assert.rejects(service.create({}), error => error instanceof UfliteError && error.status === 405);
});

// Every middleware export is exercised through the actual uflite service pipeline
// in both supported modes. Pure predicates/transformers/resolvers are tested separately.
import {
  iff, unless, disallow, setData, setResult, preventChanges, removeFields, transformData,
  setField, pickDataFields, validateData, preventEmptyData, setQueryDefaults,
  pickQueryFields, transformQuery, requireRole, requirePermission, requireOwner,
  scopeToActor, rateLimit, publishEvent, sideEffect, debug, pickResultFields,
  omitResultFields, mapResult
} from '../src/index.js';

const modeCases = [
  ['iff', iff(() => true, ctx => { ctx.data.conditional = true; })],
  ['unless', unless(() => false, ctx => { ctx.data.conditional = true; })],
  ['throwIf allowed', throwIf(() => false)],
  ['setData', setData(ctx => ({ ...ctx.data, setData: true }))],
  ['requireFields', requireFields(['name'])],
  ['setDefaults', setDefaults({ enabled: true })],
  ['preventChanges', preventChanges(['ownerId'], { original: () => ({ ownerId: 'u1' }) })],
  ['removeFields', removeFields(['secret'])],
  ['transformData', transformData(data => ({ ...data, transformed: true }))],
  ['setField', setField('setField', true)],
  ['pickDataFields', pickDataFields(['name', 'picked'])],
  ['validateData', validateData(() => true)],
  ['preventEmptyData', preventEmptyData()],
  ['setQueryDefaults', setQueryDefaults({ active: true })],
  ['pickQueryFields', pickQueryFields(['active'])],
  ['transformQuery', transformQuery(query => ({ ...query, transformed: true }))],
  ['requireAuth', requireAuth()],
  ['requireRole', requireRole('admin')],
  ['requirePermission', requirePermission('items:write')],
  ['requireOwner', requireOwner({ getActor: () => 'u1', getRecord: () => ({ userId: 'u1' }) })],
  ['scopeToActor', scopeToActor({ getActor: () => 'u1' })],
  ['requireMethod', requireMethod('create')],
  ['rateLimit', rateLimit(() => true)],
  ['auditFields', auditFields({ now: () => 'fixed', getActor: () => 'u1' })],
  ['publishEvent', publishEvent(async () => {}, 'item.created')],
  ['sideEffect', sideEffect(async () => {})],
  ['debug', debug({ debug() {} })]
];

for (const mode of [0, 1]) {
  for (const [name, hook] of modeCases) {
    test(`real uflite mode ${mode}: ${name} continues through the service`, async () => {
      const app = flite({ mode });
      let coreCalls = 0;
      const service = app.service(`mode-${mode}-${name.replace(/\W/g, '-')}`, {
        async create(data) { coreCalls++; return { ...data, id: '1', secret: 'private' }; }
      });
      service.hooks({ before: { create: [hook] } });
      const result = await service.create(
        { name: 'Example', ownerId: 'u1', secret: 'remove-me', picked: true },
        { user: { id: 'u1', role: 'admin', permissions: ['items:write'] }, permissions: ['items:write'], query: {} }
      );
      assert.equal(coreCalls, 1, `${name} must not prevent the service method from running`);
      assert.ok(result && typeof result === 'object', `${name} should preserve a valid result`);
    });
  }

  for (const [name, hook] of [
    ['setResult', setResult({ replaced: true })],
    ['transformResult', transformResult(result => ({ ...result, transformed: true }))],
    ['pickResultFields', pickResultFields(['id', 'name'])],
    ['omitResultFields', omitResultFields(['secret'])],
    ['mapResult', mapResult(result => ({ ...result, mapped: true }))]
  ]) {
    test(`real uflite mode ${mode}: after hook ${name} continues and transforms result`, async () => {
      const app = flite({ mode });
      const service = app.service(`after-${mode}-${name}`, {
        async create(data) { return { ...data, id: '1', secret: 'private' }; }
      });
      service.hooks({ after: { create: [hook] } });
      const result = await service.create({ name: 'Example' });
      assert.ok(result && typeof result === 'object');
      if (name === 'setResult') assert.deepEqual(result, { replaced: true });
      if (name === 'transformResult') assert.equal(result.transformed, true);
      if (name === 'pickResultFields') assert.deepEqual(Object.keys(result).sort(), ['id', 'name']);
      if (name === 'omitResultFields') assert.equal('secret' in result, false);
      if (name === 'mapResult') assert.equal(result.mapped, true);
    });
  }

  test(`real uflite mode ${mode}: configured error object is honored`, async () => {
    const app = flite({ mode });
    const service = app.service(`configured-error-${mode}`, { async create(data) { return data; } });
    service.hooks({ before: { create: [requireFields(['email'], {
      error: { message: 'Email is mandatory', status: 422, code: 'EMAIL_REQUIRED' }
    })] } });
    await assert.rejects(service.create({}), error =>
      error instanceof UfliteError && error.status === 422 && error.code === 'EMAIL_REQUIRED' && error.message === 'Email is mandatory'
    );
  });
}

const rejectionCases = [
  ['disallow', disallow()],
  ['requireFields', requireFields(['missing'])],
  ['preventChanges', preventChanges(['ownerId'], { original: () => ({ ownerId: 'old' }) })],
  ['validateData', validateData(() => false)],
  ['preventEmptyData', preventEmptyData()],
  ['requireAuth', requireAuth()],
  ['requireRole unauthenticated', requireRole('admin')],
  ['requireRole forbidden', requireRole('admin')],
  ['requirePermission', requirePermission('items:write')],
  ['requireOwner unauthenticated', requireOwner()],
  ['requireOwner forbidden', requireOwner({ getActor: () => 'u1', getRecord: () => ({ userId: 'u2' }) })],
  ['scopeToActor unauthenticated', scopeToActor()],
  ['requireMethod', requireMethod('patch')],
  ['rateLimit', rateLimit(() => false)]
];

for (const mode of [0, 1]) {
  for (const [name, hook] of rejectionCases) {
    test(`real uflite mode ${mode}: ${name} rejects without calling core`, async () => {
      const app = flite({ mode });
      let coreCalls = 0;
      const service = app.service(`reject-${mode}-${name.replace(/\W/g, '-')}`, {
        async create(data) { coreCalls++; return data; }
      });
      service.hooks({ before: { create: [hook] } });
      const params = name === 'requireRole forbidden'
        ? { user: { id: 'u1', role: 'member' } }
        : name === 'requirePermission'
          ? { user: { id: 'u1' }, permissions: [] }
          : {};
      const data = name === 'preventChanges' ? { ownerId: 'new' }
        : name === 'preventEmptyData' ? {}
          : { name: 'Example' };
      await assert.rejects(service.create(data, params), error =>
        error instanceof UfliteError && Number.isFinite(error.status) && typeof error.code === 'string'
      );
      assert.equal(coreCalls, 0);
    });
  }
}

test('multi-case errors use the same nested error configuration shape', async () => {
  const roleHook = requireRole('admin', {
    error: { status: 403, code: 'ACCESS_DENIED' },
    errors: {
      unauthenticated: { message: 'Sign-in required', status: 401, code: 'LOGIN_REQUIRED' },
      forbidden: { message: 'Admin role required' }
    }
  });
  await assert.rejects(roleHook({ params: {} }), error =>
    error.status === 401 && error.code === 'LOGIN_REQUIRED' && error.message === 'Sign-in required'
  );
  await assert.rejects(roleHook({ params: { user: { role: 'member' } } }), error =>
    error.status === 403 && error.code === 'ACCESS_DENIED' && error.message === 'Admin role required'
  );
});
