import { test } from 'bun:test';
import assert from 'node:assert/strict';
import {
  iff, unless, throwIf, disallow, setResult, setData,
  requireFields, setDefaults, preventChanges, removeFields, transformData, setQueryDefaults,
  setField, pickDataFields, validateData, pickQueryFields, transformQuery, preventEmptyData,
  requireAuth, requireRole, requirePermission, requireOwner, scopeToActor, requireMethod, rateLimit,
  auditFields, publishEvent, sideEffect
} from '../src/index.js';

test('mode-0 style: hooks work when next is absent', async () => {
  const ctx = { data: { email: 'a@b.c' }, params: {} };
  await requireFields(['email'])(ctx);
  await setDefaults({ active: true })(ctx);
  assert.equal(ctx.data.active, true);
});

test('mode-1 style: continuing hooks call next exactly once', async () => {
  const ctx = { data: {} };
  let calls = 0;
  await setDefaults({ active: true })(ctx, async () => { calls++; });
  assert.equal(ctx.data.active, true);
  assert.equal(calls, 1);
});

test('conditional hooks', async () => {
  const ctx = { data: {} };
  await iff(() => true, setData({ ok: true }))(ctx);
  assert.deepEqual(ctx.data, { ok: true });
  await unless(() => true, setData({ no: true }))(ctx);
  assert.deepEqual(ctx.data, { ok: true });
});

test('throwIf and disallow use native errors with status/code', async () => {
  await assert.rejects(throwIf(() => true, { error: { message: 'nope' } })( {} ), e => e.message === 'nope' && e.status === 400);
  await assert.rejects(disallow({ error: { message: 'blocked' } })({}), e => e.code === 'BAD_REQUEST');
});

test('requireFields catches absent values', async () => {
  await assert.rejects(requireFields(['email'])({ data: {} }), e => e.code === 'REQUIRED_FIELDS');
});

test('preventChanges rejects modified immutable fields', async () => {
  await assert.rejects(preventChanges(['ownerId'])({
    original: { ownerId: 'a' }, data: { ownerId: 'b' }
  }), e => e.code === 'IMMUTABLE_FIELDS');
});

test('removeFields, transformData and query defaults', async () => {
  const ctx = { data: { secret: 'x', name: ' a ' }, params: { query: { limit: 5 } } };
  await removeFields(['secret'])(ctx);
  await transformData(data => ({ ...data, name: data.name.trim() }))(ctx);
  await setQueryDefaults({ limit: 10, active: true })(ctx);
  assert.deepEqual(ctx.data, { name: 'a' });
  assert.deepEqual(ctx.params.query, { limit: 5, active: true });
});

test('authorization hooks', async () => {
  const ctx = { params: { user: { id: 'u1', role: 'admin', permissions: ['read'] }, query: { userId: 'spoofed' } }, original: { userId: 'u1' } };
  await requireAuth()(ctx);
  await requireRole('admin')(ctx);
  await requirePermission('read')(ctx);
  await requireOwner()(ctx);
  await scopeToActor()(ctx);
  assert.equal(ctx.params.query.userId, 'u1');
});

test('audit fields preserve original creation metadata on update', async () => {
  const ctx = { method: 'patch', data: { createdAt: 'spoof', createdBy: 'spoof', title: 'x' }, params: { user: { id: 'u1' } } };
  await auditFields({ now: () => 'fixed' })(ctx);
  assert.equal(ctx.data.createdAt, undefined);
  assert.equal(ctx.data.createdBy, undefined);
  assert.equal(ctx.data.updatedAt, 'fixed');
  assert.equal(ctx.data.updatedBy, 'u1');
});

test('publishEvent and sideEffect', async () => {
  const calls = [];
  const ctx = { result: { id: 1 } };
  await publishEvent(async (...args) => calls.push(args), 'created')(ctx);
  assert.equal(calls[0][0], 'created');
  await assert.rejects(sideEffect(() => { throw new Error('boom'); })({}), /boom/);
});

test('setResult and setData', async () => {
  const ctx = {};
  await setResult({ ok: true })(ctx);
  await setData(c => ({ seen: c.result.ok }))(ctx);
  assert.deepEqual(ctx.result, { ok: true });
  assert.deepEqual(ctx.data, { seen: true });
});


test('setField and pickDataFields', async () => {
  const ctx = { data: { title: 'ok', admin: true } };
  await setField('createdBy', () => 'u1')(ctx);
  await pickDataFields(['title', 'createdBy'])(ctx);
  assert.deepEqual(ctx.data, { title: 'ok', createdBy: 'u1' });
});

test('validateData accepts true and rejects false or error details', async () => {
  await validateData(() => true)({ data: {} });
  await assert.rejects(validateData(() => false)({ data: {} }), e => e.code === 'VALIDATION_FAILED');
  await assert.rejects(validateData(() => ['email invalid'])({ data: {} }), e => e.details[0] === 'email invalid');
});

test('query allowlist and transformation', async () => {
  const ctx = { params: { query: { status: 'active', secret: 'x' } } };
  await pickQueryFields(['status'])(ctx);
  await transformQuery(query => ({ ...query, status: query.status.toUpperCase() }))(ctx);
  assert.deepEqual(ctx.params.query, { status: 'ACTIVE' });
});

test('preventEmptyData rejects empty payloads', async () => {
  await assert.rejects(preventEmptyData()({ data: {} }), e => e.code === 'EMPTY_DATA');
  await preventEmptyData()({ data: { name: 'x' } });
});

test('requireMethod and injected rateLimit', async () => {
  await requireMethod(['create'])({ method: 'create' });
  await assert.rejects(requireMethod(['create'])({ method: 'remove' }), e => e.status === 405);
  let consumed;
  await rateLimit(async (key, options) => { consumed = { key, options }; return { allowed: true }; }, {
    key: () => 'u1', limit: 3
  })({ params: {} });
  assert.equal(consumed.key, 'u1');
  await assert.rejects(rateLimit(async () => ({ allowed: false, retryAfter: 10 }))({}), e => e.status === 429 && e.retryAfter === 10);
});


test('result transformers support object and array results', async () => {
  const { transformResult, pickResultFields, omitResultFields, mapResult } = await import('../src/hooks/result.js');
  const ctx = { result: { id: 1, secret: 'x', name: ' alice ' } };
  await pickResultFields(['id', 'name'])(ctx);
  assert.deepEqual(ctx.result, { id: 1, name: ' alice ' });
  await transformResult(result => ({ ...result, name: result.name.trim() }))(ctx);
  assert.deepEqual(ctx.result, { id: 1, name: 'alice' });
  ctx.result = [{ id: 1 }, { id: 2 }];
  await mapResult(item => ({ ...item, ok: true }))(ctx);
  assert.deepEqual(ctx.result, [{ id: 1, ok: true }, { id: 2, ok: true }]);
  ctx.result = { id: 1, secret: 'x' };
  await omitResultFields(['secret'])(ctx);
  assert.deepEqual(ctx.result, { id: 1 });
});
