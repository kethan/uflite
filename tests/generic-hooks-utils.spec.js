import { test } from 'bun:test';
import assert from 'node:assert/strict';
import * as p from '../src/predicates/index.js';
import * as t from '../src/transformers/index.js';
import * as r from '../src/resolvers/index.js';

test('predicates handle presence, emptiness, equality, and membership', () => {
  assert.equal(p.isPresent(0), true);
  assert.equal(p.isPresent(null), false);
  assert.equal(p.isEmpty([]), true);
  assert.equal(p.isEmpty({}), true);
  assert.equal(p.equals(NaN)(NaN), true);
  assert.equal(p.oneOf(['a', 'b'])('b'), true);
  assert.equal(p.includes('x')('text'), true);
  assert.equal(p.greaterThan(2)(3), true);
});

test('path predicates and async composition', async () => {
  const object = { user: { active: true, role: 'admin' } };
  assert.equal(p.hasPath('user.role')(object), true);
  assert.equal(p.pathEquals('user.role', 'admin')(object), true);
  assert.equal(p.pathMatches('user.active', value => value === true)(object), true);
  assert.equal(await p.all(() => true, async () => true)(object), true);
  assert.equal(await p.any(() => false, async () => true)(object), true);
  assert.equal(await p.not(() => false)(object), true);
  assert.equal(await p.contextPredicate(p.pathEquals('user.role', 'admin'))({ params: object }), false);
  assert.equal(await p.contextPredicate(p.pathEquals('user.role', 'admin'), { select: c => c.params })( { params: object } ), true);
});

test('transformers compose and do not mutate flat input records', async () => {
  const input = { name: ' Alice ', email: ' A@EXAMPLE.COM ', extra: 1 };
  const transform = t.compose(
    t.trimStrings(),
    t.mapFields({ email: t.normalizeEmail }),
    t.pick(['name', 'email'])
  );
  const output = await transform(input);
  assert.deepEqual(output, { name: 'Alice', email: 'a@example.com' });
  assert.deepEqual(input, { name: ' Alice ', email: ' A@EXAMPLE.COM ', extra: 1 });
});

test('transformers handle conversions, defaults, and nested updates immutably', async () => {
  assert.equal(t.toNumber('12'), 12);
  assert.equal(t.toNumber('nope'), 'nope');
  assert.equal(t.toBoolean('false'), false);
  assert.throws(() => t.toBoolean('unknown', { strict: true }), /Cannot convert/);
  const original = { profile: { name: 'Alice' } };
  const updated = await t.updatePath('profile.name', t.uppercase)(original);
  assert.deepEqual(updated, { profile: { name: 'ALICE' } });
  assert.deepEqual(original, { profile: { name: 'Alice' } });
  assert.deepEqual(await t.setDefaults({ active: true })({ name: 'A' }), { name: 'A', active: true });
  assert.deepEqual(t.renameFields({ old: 'new' })({ old: 1 }), { new: 1 });
});

test('resolver helpers follow uresolver field signature', async () => {
  const object = { id: 2, profile: { name: 'A' }, relationId: 7 };
  assert.equal(r.fromPath('profile.name')(undefined, object), 'A');
  assert.equal(r.fromPath('missing', { fallback: 'N/A' })(undefined, object), 'N/A');
  assert.equal(r.fromContext('tenant.id')(null, object, { tenant: { id: 't1' } }), 't1');
  assert.equal(r.fallback('fallback')(null), 'fallback');
  assert.equal(r.mapValue(value => value * 2)(3, object, {}), 6);
  assert.equal(await r.lookup(async id => ({ id }), { key: value => value })(7, object, {} ).then(x => x.id), 7);
  assert.equal(await r.resolveIf(value => value > 2, value => value + 1)(3, object, {}), 4);
  assert.equal(await r.omitIf(value => value === 'secret')('secret', object, {}), undefined);
  assert.equal(await r.redactIf(value => value === 'secret')('secret', object, {}), null);
  assert.deepEqual(await r.mapArray(value => value * 2)([1, 2], object, {}), [2, 4]);
  assert.deepEqual(await r.relationMany(async ids => ids.map(id => ({ id })))([1, 2], object, {}), [{ id: 1 }, { id: 2 }]);
});


test('type, format, range and collection predicates', () => {
  assert.equal(p.isPlainObject({ a: 1 }), true);
  assert.equal(p.isPlainObject([]), false);
  assert.equal(p.isEmail('a@example.com'), true);
  assert.equal(p.isEmail('bad'), false);
  assert.equal(p.isURL('https://example.com'), true);
  assert.equal(p.isUUID('550e8400-e29b-41d4-a716-446655440000'), true);
  assert.equal(p.between(1, 5)(3), true);
  assert.equal(p.lengthAtLeast(2)([1, 2]), true);
  assert.equal(p.hasAll(['a', 'b'])(new Set(['a', 'b', 'c'])), true);
});

test('additional normalization transformers and aggregate resolvers', async () => {
  assert.equal(t.normalizeWhitespace('  a   b '), 'a b');
  assert.equal(t.slugify('Crème Brûlée!'), 'creme-brulee');
  assert.equal(t.toInteger('12'), 12);
  assert.deepEqual(t.parseJSON('{"ok":true}'), { ok: true });
  assert.equal(t.parseJSON('not json'), 'not json');
  assert.equal(r.join(',')(['a', 'b']), 'a,b');
  assert.equal(r.count()([1, 2, 3]), 3);
  assert.equal(r.sum()([1, '2', 3]), 4);
  assert.deepEqual(r.pluck('id')([{ id: 1 }, { id: 2 }]), [1, 2]);
});
