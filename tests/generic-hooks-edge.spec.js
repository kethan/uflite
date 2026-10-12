import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { status as UfliteError } from '../src/index.js';
import * as hooks from '../src/index.js';
import * as p from '../src/predicates/index.js';
import * as t from '../src/transformers/index.js';
import * as r from '../src/resolvers/index.js';

const rejectedWith = (status, code) => error =>
  error instanceof UfliteError && error.status === status && error.code === code;

test('all flow hooks: predicates, async values, no-op branches, nested arrays, and errors', async () => {
  const ctx = { data: { run: false } };
  let nextCalls = 0;
  await hooks.iff(() => false, () => { throw new Error('must not run'); })(ctx, () => { nextCalls++; });
  await hooks.iff(async () => true, [[async c => { c.hit = true; }]])(ctx);
  await hooks.unless(() => false, c => { c.unlessHit = true; })(ctx);
  assert.equal(ctx.hit, true);
  assert.equal(ctx.unlessHit, true);
  assert.equal(nextCalls, 1);

  await hooks.throwIf(() => false)(ctx, () => { nextCalls++; });
  await assert.rejects(hooks.throwIf(() => true, { error: { message: async () => 'dynamic', status: 409, code: 'DYNAMIC' } })(ctx), rejectedWith(409, 'DYNAMIC'));
  await assert.rejects(hooks.disallow()(ctx), rejectedWith(400, 'BAD_REQUEST'));
  await hooks.setData(async c => ({ run: c.hit }))(ctx);
  await hooks.setResult(async c => ({ ok: c.data.run }))(ctx);
  assert.deepEqual(ctx.data, { run: true });
  assert.deepEqual(ctx.result, { ok: true });
  assert.equal(nextCalls, 2);
});

test('data hooks: required paths, defaults, immutable checks, and path safety', async () => {
  const ctx = { data: { profile: { name: undefined }, explicit: null } };
  await assert.rejects(hooks.requireFields(['profile.name', 'id'])(ctx), error =>
    error instanceof UfliteError && error.fields.join(',') === 'profile.name,id'
  );
  await hooks.requireFields(['empty'], { allowEmpty: true })({ data: { empty: '' } });
  await assert.rejects(hooks.requireFields(['x'], { error: { status: 422 } })({ data: {} }), rejectedWith(422, 'REQUIRED_FIELDS'));

  await hooks.setDefaults(async () => ({ 'profile.name': 'N', explicit: 'ignored', active: async () => true }))(ctx);
  assert.deepEqual(ctx.data.profile, { name: 'N' });
  assert.equal(ctx.data.explicit, null);
  assert.equal(ctx.data.active, true);
  await hooks.setDefaults(null)({ data: {} });
  const missingData = {}; await hooks.setDefaults({ a: 1 })(missingData); assert.deepEqual(missingData.data, { a: 1 });
  await hooks.setDefaults({ ok: true })({ data: [] });
  await assert.rejects(hooks.setField('__proto__.polluted', 1)({ data: {} }), /Unsafe property path/);
  await assert.rejects(hooks.setField('', 1)({ data: {} }), /Unsafe property path/);

  await hooks.preventChanges(['id'])({ original: { id: 1 }, data: { title: 'new' } });
  await hooks.preventChanges(['id'])({ original: { id: 1 }, data: { id: 1 } });
  await assert.rejects(hooks.preventChanges(['id'])({ original: { id: 1 }, data: { id: 2 } }), rejectedWith(400, 'IMMUTABLE_FIELDS'));
  await hooks.preventChanges(['id'])({ data: { id: 2 } });
  await hooks.preventChanges(['id'])({ original: { id: 1 }, data: null });
  await assert.rejects(hooks.removeFields(['constructor.prototype.x'])({ data: { constructor: {} } }), /Unsafe property path/);
  await hooks.removeFields(['profile.name', 'missing.x'])({ data: { profile: { name: 'x' } } });
  await hooks.removeFields(['x'])({ data: null });
  await hooks.transformData(value => ({ value }), { target: 'meta.data' })({ meta: { data: 1 } });
  await hooks.setField('nested.value', 2)({ data: null });
  await hooks.setField('nested.value', 3)({ data: { nested: { existing: true } } });
  await hooks.setField('nested.value', 3)({ data: { nested: [] } });
  assert.deepEqual(ctx.data.profile, { name: 'N' });
});

test('data hooks: filtering, validation, query edge cases and empty payloads', async () => {
  const ctx = { data: { keep: 1, drop: 2 }, params: { query: { keep: 1, drop: 2 } } };
  await hooks.pickDataFields(['keep'])(ctx);
  await hooks.pickDataFields(['keep'])({ data: [] });
  await hooks.pickDataFields(['keep'])({ data: null });
  await hooks.setField('x', 1)({ data: [] });
  assert.deepEqual(ctx.data, { keep: 1 });
  await hooks.validateData(() => undefined)(ctx);
  await hooks.validateData(() => [])(ctx);
  await assert.rejects(hooks.validateData(() => ['bad'], { error: { message: async () => 'custom' } })(ctx), error => error.message === 'custom' && error.details[0] === 'bad');
  await hooks.setQueryDefaults(async () => ({ limit: async () => 10, offset: 0 }))(ctx);
  const newQuery = {}; await hooks.setQueryDefaults({ limit: 10 })(newQuery); assert.deepEqual(newQuery.params.query, { limit: 10 });
  await assert.rejects(hooks.setQueryDefaults({ x: 1 })({ params: { query: [] } }), /must be an object/);
  assert.deepEqual(ctx.params.query, { keep: 1, drop: 2, limit: 10, offset: 0 });
  await hooks.pickQueryFields(['keep'])(ctx);
  assert.deepEqual(ctx.params.query, { keep: 1 });
  await assert.rejects(hooks.pickQueryFields(['x'])({ params: { query: [] } }), /must be an object/);
  await hooks.transformQuery(query => ({ ...query, ok: true }))(ctx);
  const noParams = {}; await hooks.transformQuery(query => ({ ...query, x: 1 }))(noParams); assert.deepEqual(noParams.params.query, { x: 1 });
  await assert.rejects(hooks.transformQuery(() => null)(ctx), /must return an object/);
  await assert.rejects(hooks.preventEmptyData()({ data: null }), rejectedWith(400, 'EMPTY_DATA'));
  await assert.rejects(hooks.preventEmptyData()({ data: [] }), rejectedWith(400, 'EMPTY_DATA'));
  await assert.rejects(hooks.preventEmptyData()({ data: '' }), rejectedWith(400, 'EMPTY_DATA'));
  await hooks.preventEmptyData()({ data: { x: 1 } });
});

test('authorization hooks: roles, permissions, owners, query scoping, methods, and limits', async () => {
  await hooks.requireAuth({ getUser: async () => ({ id: 1 }) })({});
  await assert.rejects(hooks.requireAuth()({ params: {} }), rejectedWith(401, 'UNAUTHENTICATED'));
  await hooks.requireRole(['admin', 'editor'], { roleField: 'roles', getUser: () => ({ roles: ['reader', 'editor'] }) })({});
  await assert.rejects(hooks.requireRole('admin')({ params: { user: { role: 'reader' } } }), rejectedWith(403, 'FORBIDDEN'));
  await assert.rejects(hooks.requireRole('admin')({}), rejectedWith(401, 'UNAUTHENTICATED'));
  await hooks.requirePermission(['read', 'write'], { match: 'all', getPermissions: () => new Set(['read', 'write']) })({});
  await hooks.requirePermission([], { match: 'all', getPermissions: () => [] })({});
  await assert.rejects(hooks.requirePermission([], { match: 'any', getPermissions: () => [] })({}), rejectedWith(403, 'FORBIDDEN'));
  await hooks.requirePermission('read', { getPermissions: () => ['read'] })({});
  await hooks.requirePermission('read')({ params: { permissions: ['read'] } });
  await assert.rejects(hooks.requirePermission(['read', 'write'], { match: 'all', getPermissions: () => ['read'] })({}), rejectedWith(403, 'FORBIDDEN'));
  assert.throws(() => hooks.requirePermission('read', { match: 'sometimes' }), /match must be 'any' or 'all'/);
  await assert.rejects(hooks.requirePermission('read', { getPermissions: () => 'read' })({}), rejectedWith(403, 'FORBIDDEN'));
  await hooks.requireOwner({ getActor: () => 'u1', getRecord: () => ({ userId: 'u1' }) })({});
  await assert.rejects(hooks.requireOwner({ getActor: () => 'u1', getRecord: () => ({ userId: 'u2' }) })({}), rejectedWith(403, 'FORBIDDEN'));
  await hooks.requireOwner({ getActor: () => 'u1', ownerField: 'owner', getRecord: () => ({ owner: 'u1' }) })({});
  await hooks.requireOwner()({ params: { user: { _id: 'u1' } }, result: { userId: 'u1' } });
  await hooks.requireOwner()({ params: { user: { id: 'u1' } }, original: { userId: 'u1' } });
  await assert.rejects(hooks.requireOwner({ getActor: () => null })({}), rejectedWith(401, 'UNAUTHENTICATED'));
  await assert.rejects(hooks.requireOwner({ getActor: () => 'u1', getRecord: () => null })({}), rejectedWith(403, 'FORBIDDEN'));
  const ctx = { params: { user: { id: 'u2' }, query: { userId: 'spoof' } } };
  await hooks.scopeToActor()(ctx);
  await hooks.scopeToActor({ getActor: c => c.params.user._id })( { params: { user: { _id: 'u3' } } } );
  await assert.rejects(hooks.scopeToActor({ getActor: () => null })({}), rejectedWith(401, 'UNAUTHENTICATED'));
  assert.equal(ctx.params.query.userId, 'u2');
  await assert.rejects(hooks.scopeToActor({ getActor: () => 'u', getQuery: () => null })({}), /must return an object/);
  await hooks.requireMethod(['create', 'patch'])({ method: 'patch' });
  await assert.rejects(hooks.requireMethod('create', { error: { message: 'no' } })({ method: 'remove' }), rejectedWith(405, 'METHOD_NOT_ALLOWED'));
  await hooks.rateLimit(async () => true)({});
  await hooks.rateLimit(async (key, options) => { assert.equal(key, 'anonymous'); assert.equal(options.limit, 100); return true; })({});
  await hooks.rateLimit(async (key) => { assert.equal(key, 'u'); return true; })({ params: { user: { id: 'u' } } });
  await hooks.rateLimit(async key => { assert.equal(key, 'ip'); return true; })({ params: { ip: 'ip' } });
  await hooks.rateLimit(async () => ({ allowed: true }))({});
  await assert.rejects(hooks.rateLimit(async () => false)({}), rejectedWith(429, 'RATE_LIMITED'));
  await assert.rejects(hooks.rateLimit(async () => ({ allowed: false, retryAfter: 5 }))({}), error => error instanceof UfliteError && error.retryAfter === 5);
});

test('lifecycle and result hooks: all policy branches', async () => {
  const created = { data: {}, method: 'create', params: {} };
  await hooks.auditFields({ now: () => 'time' })(created);
  assert.equal(created.data.createdAt, 'time');
  assert.equal(created.data.createdBy, null);
  const updated = { data: { createdAt: 'spoof', createdBy: 'spoof' }, method: 'patch' };
  await hooks.auditFields({ createdBy: false, updatedBy: false, createdAt: 'created', updatedAt: 'updated', now: () => 1 })(updated);
  await hooks.auditFields({ createdAt: false, updatedAt: false, createdBy: false, updatedBy: false })( { method: 'create', data: {} } );
  await hooks.auditFields()({ data: [] });
  await hooks.auditFields()({});
  const idActorAudit = { method: 'create', data: {}, params: { user: { _id: 'legacy-id' } } }; await hooks.auditFields({ now: () => 'fixed' })(idActorAudit); assert.equal(idActorAudit.data.createdBy, 'legacy-id');
  const defaultAudit = { method: 'create', data: {} }; await hooks.auditFields()(defaultAudit); assert.equal(typeof defaultAudit.data.createdAt, 'string'); assert.equal(defaultAudit.data.createdBy, null);
  await hooks.publishEvent(async () => {}, 'default-payload')({ result: { ok: true } });
  assert.equal(updated.data.createdAt, undefined);
  assert.equal(updated.data.createdBy, undefined);
  assert.equal(updated.data.updated, 1);

  let published = 0;
  await hooks.publishEvent(() => { published++; }, 'skip', { when: () => false })({ result: {} });
  await hooks.publishEvent(async (name, payload, context) => { published++; assert.equal(name, 'event'); assert.equal(payload.id, context.result.id); }, 'event', { payload: c => ({ id: c.result.id }) })({ result: { id: 1 } });
  assert.equal(published, 1);
  let handled = false;
  await hooks.sideEffect(() => { throw new Error('ignored'); }, { ignoreError: true })({});
  await hooks.sideEffect(() => { throw new Error('handled'); }, { onError: error => { handled = error.message === 'handled'; } })({});
  assert.equal(handled, true);
  await assert.rejects(hooks.sideEffect(() => { throw new Error('handler'); }, { onError: () => { throw new Error('onError'); } })({}), /onError/);

  const logs = [];
  await hooks.debug({ debug: (...args) => logs.push(args) }, { label: 'x', select: c => c.value })({ value: 3 });
  await hooks.debug({})({});
  await hooks.debug()({ method: 'find', path: 'default-logger-test' });
  await hooks.debug({ debug: (...args) => logs.push(args) })({ method: 'find', path: 'items' });
  assert.deepEqual(logs, [['x', 3], ['hook', { method: 'find', path: 'items' }]]);
  const result = { result: [{ id: 1, secret: 2 }, { id: 2, secret: 3 }] };
  await hooks.mapResult(async (item, context, index) => ({ id: item.id + index }))(result);
  assert.deepEqual(result.result, [{ id: 1 }, { id: 3 }]);
  await hooks.transformResult(value => value + 1)({ result: 1 });
  await hooks.pickResultFields(['id'])({ result: ['leave array alone'] });
  await hooks.omitResultFields(['secret'])({ result: 'primitive' });
  await hooks.pickResultFields(['id'])({ result: ['array'] });
  await hooks.omitResultFields(['secret'])({ result: ['array'] });
  await hooks.mapResult(item => item)({ result: { id: 1 } });
});

test('predicates: exported predicates and every significant edge branch', async () => {
  assert.equal(p.isPresent(0), true); assert.equal(p.isNil(undefined), true); assert.equal(p.isDefined(null), true);
  assert.equal(p.isString(''), true); assert.equal(p.isNumber(Infinity), false); assert.equal(p.isInteger(2), true);
  assert.equal(p.isBoolean(false), true); assert.equal(p.isArray([]), true); assert.equal(p.isObject(new Date()), true);
  assert.equal(p.isPlainObject(null), false); assert.equal(p.isPlainObject(Object.create(null)), true);
  assert.equal(p.isNonEmptyString('  '), false); assert.equal(p.isEmail('x'), false);
  assert.equal(p.isURL(1), false); assert.equal(p.isURL('not url'), false); assert.equal(p.isURL('ftp://example.com'), false);
  assert.equal(p.isUUID('bad'), false); assert.equal(p.isUUID(7), false); assert.equal(p.isEmail(7), false); assert.equal(p.isNonEmptyString(7), false);
  assert.equal(p.isEmpty(null), true); assert.equal(p.isEmpty(''), true); assert.equal(p.isEmpty([]), true);
  assert.equal(p.isEmpty(new Map()), true); assert.equal(p.isEmpty(new Set()), true); assert.equal(p.isEmpty(new Date()), false);
  assert.equal(p.isEmpty({ a: 1 }), false); assert.equal(p.isEmpty(/x/), true);
  assert.equal(p.isEmpty(new Map([['x', 1]])), false); assert.equal(p.isEmpty(new Set(['x'])), false);
  assert.equal(p.equals(NaN)(NaN), true); assert.equal(p.notEquals(1)(2), true); assert.equal(p.oneOf([1, 2])(2), true);
  assert.equal(p.includes('x')(new Set(['x'])), true); assert.equal(p.includes('x')(4), false); assert.equal(p.includes('a')(['a']), true);
  const globalRegex = p.matches(/a/g); assert.equal(globalRegex('a'), true); assert.equal(globalRegex('a'), true);
  assert.equal(p.matches('^x')('x'), true); assert.equal(p.matches('^x')(null), false); assert.equal(p.greaterThan(1)('2'), false); assert.equal(p.atLeast(2)(2), true);
  assert.equal(p.lessThan(3)(2), true); assert.equal(p.atMost(2)(2), true); assert.equal(p.between(1, 3, { inclusive: false })(1), false);
  assert.equal(p.lengthAtLeast(2)('ab'), true); assert.equal(p.between(1, 3)('2'), false); assert.equal(p.lengthAtLeast(2)(2), false); assert.equal(p.lengthAtMost(2)([]), true);
  assert.equal(p.hasAny(['a'])(new Set(['a'])), true); assert.equal(p.hasAny(['a'])(['a']), true); assert.equal(p.hasAny(['a'])(null), false);
  assert.equal(p.hasAll(['a'])(['a']), true); assert.equal(p.hasAll(['a'])(null), false); assert.equal(p.hasAll([])(null), true);
  assert.equal(p.truthy('x'), true); assert.equal(p.falsy(0), true); assert.equal(p.hasPath('a.b')({ a: { b: null } }), true);
  assert.equal(p.hasPath('a.c')({ a: {} }), false); assert.equal(p.pathEquals('a', undefined)({}), true);
  assert.equal(p.pathMatches('a', (value, obj) => value === obj.a)({ a: 1 }), true);
  assert.equal(await p.all()({}), true); assert.equal(await p.all(() => true, () => false)({}), false);
  assert.equal(await p.any()({}), false); assert.equal(await p.any(() => false, () => true)({}), true);
  assert.equal(await p.not(async () => false)({}), true); assert.equal(await p.when(() => true, value => value.x, () => 0)({ x: 3 }), 3);
  assert.equal(await p.when(() => false, () => 1, () => 2)({}), 2);
  assert.equal(await p.when(() => false, () => 1)({}), false);
  assert.equal(await p.contextPredicate(value => value.ok)({ ok: true }), true);
  assert.equal(await p.contextPredicate(value => value.ok, { select: c => c.selected })({ selected: { ok: true } }), true);
});

test('transformers: all exports, non-record inputs, strict failures, and recursive options', async () => {
  assert.equal(t.identity(3), 3); assert.equal(await t.compose()(3), 3); assert.equal(await t.pipe(x => x + 1)(1), 2);
  assert.equal(t.trimString(1), 1); assert.equal(t.lowercase('A'), 'a'); assert.equal(t.uppercase('a'), 'A');
  assert.equal(t.normalizeEmail(2), 2); assert.equal(t.normalizeWhitespace(2), 2); assert.equal(t.slugify(2), 2);
  assert.equal(t.toNumber(null), null); assert.equal(t.toNumber(''), ''); assert.equal(t.toNumber('x'), 'x'); assert.equal(Number.isNaN(t.toNumber(NaN)), true);
  assert.throws(() => t.toNumber('x', { strict: true }), TypeError); assert.equal(t.toNumber('Infinity'), Infinity);
  assert.equal(t.toInteger(''), ''); assert.equal(t.toInteger('2.2'), '2.2'); assert.throws(() => t.toInteger('2.2', { strict: true }), TypeError);
  assert.equal(t.parseJSON(2), 2); assert.throws(() => t.parseJSON('bad', { strict: true }), SyntaxError);
  assert.equal(t.toBoolean(true), true); assert.equal(t.toBoolean(1), true); assert.equal(t.toBoolean('1'), true); assert.equal(t.toBoolean('TRUE'), true); assert.equal(t.toBoolean(0), false); assert.equal(t.toBoolean('0'), false); assert.equal(t.toBoolean('FALSE'), false); assert.equal(t.toBoolean('unknown'), 'unknown');
  assert.equal(t.pick(['x'])(null), null); assert.deepEqual(t.pick(['x'])(['x']), ['x']); assert.deepEqual(t.pick(['x'])({ x: 1, y: 2 }), { x: 1 });
  assert.deepEqual(t.omit(['x'])({ x: 1, y: 2 }), { y: 2 }); assert.deepEqual(t.omit(['x'])([]), []);
  assert.deepEqual(t.renameFields({ x: 'y' })([]), []);
  assert.deepEqual(t.renameFields({ x: 'y', missing: 'z', y: 'y' })({ x: 1, y: 2 }), { y: 1 });
  assert.deepEqual(await t.mapFields({ x: async v => v + 1 })({ x: 1 }), { x: 2 });
  assert.deepEqual(await t.mapFields({ missing: v => v })({ x: 1 }), { x: 1 });
  assert.equal(await t.mapFields({})('primitive'), 'primitive'); assert.deepEqual(await t.mapFields({})([]), []);
  assert.deepEqual(t.trimStrings()([' a ', { b: ' b ' }]), ['a', { b: 'b'}]);
  assert.deepEqual(t.trimStrings({ fields: ['a'] })({ a: ' x ', b: ' y ' }), { a: 'x', b: ' y ' });
  assert.deepEqual(t.trimStrings({ recursive: true })({ a: { b: ' x ' } }), { a: { b: 'x' } });
  const date = new Date(); assert.equal(t.trimStrings()(date), date);
  assert.deepEqual(t.removeEmpty({ removeNull: true, removeEmptyStrings: true, removeEmptyArrays: true, removeEmptyObjects: true })({ a: null, b: '', c: [], d: {}, e: 1 }), { e: 1 });
  assert.deepEqual(t.removeEmpty({ removeNull: false, removeEmptyStrings: false })({ a: null, b: '' }), { a: null, b: '' });
  assert.equal(t.removeEmpty()([]).length, 0); assert.deepEqual(await t.setDefaults({ x: async value => value.a })({ a: 1 }), { a: 1, x: 1 });
  assert.equal(await t.setDefaults({})('x'), 'x'); assert.deepEqual(await t.mapArray(async x => x * 2)([1, 2]), [2, 4]);
  assert.equal(await t.mapArray(x => x)(null), null); assert.equal(await t.updatePath('x', x => x + 1)(null), null);
  await assert.rejects(t.updatePath('constructor.prototype.x', x => x)({}), /Unsafe property path/);
  assert.deepEqual(await t.updatePath('profile.name', x => x.toUpperCase())({ profile: { name: 'a', keep: 1 } }), { profile: { name: 'A', keep: 1 } });
  assert.deepEqual(await t.updatePath('a.b', () => 1)({}), { a: { b: 1 } });
});

test('resolvers: all branches and async relation lookups', async () => {
  const object = { nested: { value: 1 } };
  assert.equal(r.value()(5), 5); assert.equal(r.fromPath('nested.value')(null, object), 1);
  assert.equal(r.fromPath('missing')(null, object), undefined); assert.equal(r.fromContext('missing')(null, object, {}), undefined);
  assert.equal(r.fallback(1)(null), 1); assert.equal(r.fallback(() => 2)(undefined), 2); assert.equal(r.fallback(1)(0), 0);
  assert.equal(r.mapValue((v, obj, ctx) => v + obj.nested.value + ctx.n)(2, object, { n: 3 }), 6);
  assert.equal(await r.lookup(async id => ({ id }), { key: v => v })(3, object, {} ).then(v => v.id), 3);
  assert.equal(await r.lookup(async () => undefined, { fallback: 'missing' })(3, object, {}), 'missing');
  assert.equal(await r.lookup(async () => 1, { key: () => null, fallback: 'empty' })(3, object, {}), 'empty');
  assert.equal(await r.lookup(async () => null)(3, object, {}), null);
  assert.equal(await r.lookup(async () => undefined, { fallback: current => `fallback-${current}` })(3, object, {}), 'fallback-3');
  assert.equal(await r.lookup(async () => 1, { key: () => null, fallback: () => 'empty' })(3, object, {}), 'empty');
  assert.equal(await r.resolveIf(() => false, () => 1, { otherwise: () => 2 })(0, object, {}), 2);
  assert.equal(await r.resolveIf(() => false, () => 1, { otherwise: 2 })(0, object, {}), 2);
  assert.equal(await r.resolveIf(() => false, () => 1)(0, object, {}), undefined);
  assert.equal(await r.omitIf(() => false)(3, object, {}), 3);
  assert.equal(await r.redactIf(() => false)(3, object, {}), 3);
  assert.equal(await r.redactIf(() => true, () => 'masked')(3, object, {}), 'masked');
  assert.deepEqual(await r.mapArray((v, obj, ctx) => [v, ctx.index])([1, 2], object, {}), [[1, 0], [2, 1]]);
  assert.equal(await r.mapArray(v => v)(3, object, {}), 3);
  assert.deepEqual(await r.relationMany(async ids => ids.map(id => ({ id })), { key: () => [] })([1], object, {}), []);
  assert.deepEqual(await r.relationMany(async ids => ids.map(id => ({ id })))(null, object, {}), []);
  assert.equal(await r.relation(async id => ({ id }))(7, object, {}).then(v => v.id), 7);
  assert.deepEqual(await r.relationMany(async ids => ids, { key: () => 'not-array' })([1], object, {}), []);
  assert.deepEqual(await r.relationMany(async ids => ids.map(id => ({ id })))([1, 2], object, {}), [{ id: 1 }, { id: 2 }]);
  assert.equal(r.join('-')('x'), 'x'); assert.equal(r.count()('abc'), 3); assert.equal(r.count()(null), 0);
  assert.equal(r.sum()('x'), 0); assert.equal(r.join()([1, 2]), '1 2');
  assert.deepEqual(r.pluck('id')([{ id: 1 }, null]), [1, undefined]); assert.equal(r.pluck('id')('not-array'), 'not-array');
});

test('runtime error messages and contracts use the canonical options shape', async () => {
  const { requireAuth, requireRole, requirePermission, requireOwner, scopeToActor,
    requireFields, preventChanges, preventEmptyData, requireMethod, rateLimit,
    setQueryDefaults } = await import('../src/index.js');

  await assert.rejects(requireAuth({ error: { message: 'Sign in first', status: 419, code: 'LOGIN_REQUIRED' } })({}),
    error => error.message === 'Sign in first' && error.status === 419 && error.code === 'LOGIN_REQUIRED');

  await assert.rejects(requireRole('admin', {
    errors: {
      unauthenticated: { message: 'Login needed', status: 401, code: 'LOGIN_REQUIRED' },
      forbidden: { message: context => `No access to ${context.path}`, status: 451, code: 'ROLE_DENIED' }
    }
  })({ path: '/reports', params: { user: { role: 'reader' } } }),
  error => error.message === 'No access to /reports' && error.status === 451 && error.code === 'ROLE_DENIED');

  await assert.rejects(requirePermission('write', { error: { message: 'Permission missing', status: 403, code: 'NEED_WRITE' } })({}),
    error => error.message === 'Permission missing' && error.status === 403 && error.code === 'NEED_WRITE');
  await assert.rejects(requireOwner({ errors: { forbidden: { message: 'Not your record' } } })({
    params: { user: { id: 'u1' } }, original: { userId: 'u2' }
  }), error => error.message === 'Not your record');
  await assert.rejects(scopeToActor({ error: { message: 'Actor required' } })({}), error => error.message === 'Actor required');

  await assert.rejects(requireFields(['email'], {
    error: { message: (_context, details) => `Missing: ${details.fields.join('|')}`, status: 422, code: 'EMAIL_REQUIRED' }
  })({ data: {} }), error => error.message === 'Missing: email' && error.status === 422 && error.code === 'EMAIL_REQUIRED');
  await assert.rejects(preventChanges(['owner'], { error: { message: 'Owner is immutable', status: 409, code: 'OWNER_LOCKED' } })(
    { original: { owner: 'a' }, data: { owner: 'b' } }
  ), error => error.message === 'Owner is immutable' && error.status === 409 && error.code === 'OWNER_LOCKED');
  await assert.rejects(preventEmptyData({ error: { message: () => 'Payload required', status: 422, code: 'PAYLOAD_REQUIRED' } })({ data: {} }),
    error => error.message === 'Payload required' && error.status === 422 && error.code === 'PAYLOAD_REQUIRED');
  await assert.rejects(requireMethod('create', { error: { message: 'Use create', status: 400, code: 'WRONG_METHOD' } })({ method: 'patch' }),
    error => error.message === 'Use create' && error.status === 400 && error.code === 'WRONG_METHOD');
  await assert.rejects(rateLimit(async () => false, { error: { message: () => 'Slow down', status: 430, code: 'SLOW_DOWN' } })({}),
    error => error.message === 'Slow down' && error.status === 430 && error.code === 'SLOW_DOWN');

  const ctx = { custom: { query: { existing: true } } };
  await setQueryDefaults({ page: 1 }, { target: 'custom.query' })(ctx);
  assert.deepEqual(ctx.custom.query, { existing: true, page: 1 });
});

test('flow hooks accept the shared error options object without a positional message', async () => {
  await assert.rejects(
    hooks.throwIf(() => true, { error: { message: 'custom rejection', status: 409, code: 'CONFLICT' } })({}),
    error => error.status === 409 && error.code === 'CONFLICT' && error.message === 'custom rejection'
  );
  await assert.rejects(
    hooks.disallow({ error: { message: 'disabled', status: 423, code: 'LOCKED' } })({}),
    error => error.status === 423 && error.code === 'LOCKED' && error.message === 'disabled'
  );
});
