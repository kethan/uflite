import { expect, test } from 'bun:test';
import { flite as nano } from '../src/nano/index.js';
import { flite as lite } from '../src/lite/index.js';
import { flite as full } from '../src/index.js';

for (const [name, create] of [['nano', nano], ['lite', lite], ['full', full]]) {
  test(`${name} keeps repeated and special query keys on a null-prototype object`, async () => {
    const app = create();
    app.get('/items', request => new Response('ok'));
    const request = new Request('https://example.test/items?tag=one&tag=two&empty=&__proto__=safe&constructor=own');
    expect((await app.fetch(request)).status).toBe(200);
    expect(Object.getPrototypeOf(request.query)).toBe(null);
    expect(request.query.tag).toEqual(['one', 'two']);
    expect(request.query.empty).toBe('');
    expect(request.query.__proto__).toBe('safe');
    expect(request.query.constructor).toBe('own');
  });
}

test('nano custom matcher still returns the result and propagates async failures', async () => {
  const matched = nano({ match: () => ({ handlers: [async () => new Response('matched')] }) });
  expect(await (await matched.fetch(new Request('https://example.test/item'))).text()).toBe('matched');

  const failed = nano({ match: () => ({ handlers: [async () => { throw new Error('matcher failed'); }] }) });
  await expect(failed.fetch(new Request('https://example.test/item'))).rejects.toThrow('matcher failed');
});
