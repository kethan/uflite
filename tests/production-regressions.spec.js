import { describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { flite, status } from '../src/index.js';
import { flite as nano } from '../nano/index.js';
import { createLocalStorageService } from '../services/localStorage.js';
import { bodyLimit, rateLimit } from '../middlewares.ts';

describe('production error responses', () => {
  test('default handler returns error messages and statuses', async () => {
    const app = flite();
    app.get('/internal', () => { throw new Error('private database secret'); });
    app.get('/upstream', () => { throw new status(503, 'upstream token'); });
    for (const [path, code] of [['/internal', 500], ['/upstream', 503]]) {
      const response = await app.fetch(new Request(`https://example.test${path}`));
      expect(response.status).toBe(code);
      expect(await response.json()).toEqual({ status: code, error: code === 503 ? 'upstream token' : 'private database secret' });
    }
  });

  test('preserves expected client errors and allows custom error hooks', async () => {
    const app = flite();
    app.get('/bad', () => { throw new status(400, 'Bad request'); });
    expect(await (await app.fetch(new Request('https://example.test/bad'))).json())
      .toEqual({ status: 400, error: 'Bad request' });

    const custom = flite({ error: { all: [err => Response.json({ message: err.message }, { status: 500 })] } });
    custom.get('/oops', () => { throw new Error('custom policy'); });
    expect(await (await custom.fetch(new Request('https://example.test/oops'))).json())
      .toEqual({ message: 'custom policy' });
  });
});

describe('local storage symlinks', () => {
  test('rejects symlinked parents and file targets for reading, writing and deleting', async () => {
    const root = await mkdtemp(join(tmpdir(), 'uflite-safe-storage-'));
    try {
      const store = join(root, 'store');
      const outside = join(root, 'outside');
      await mkdir(store);
      await mkdir(outside);
      await writeFile(join(outside, 'keep.txt'), 'private');
      await symlink(outside, join(store, 'link'));
      await symlink(join(outside, 'keep.txt'), join(store, 'file.txt'));
      const service = createLocalStorageService({ basePath: store });
      for (const key of ['link/keep.txt', 'file.txt']) {
        await expect(service.upload({ key, body: 'changed' })).rejects.toThrow();
        await expect(service.download(key)).rejects.toThrow();
        await expect(service.get(key)).rejects.toThrow();
        await expect(service.remove(key)).rejects.toThrow();
      }
      expect(await readFile(join(outside, 'keep.txt'), 'utf8')).toBe('private');
      await expect(readFile(join(outside, 'escaped.txt'))).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe('nano matching middleware', () => {
  test('a matching use() handler may continue to the next matching route', async () => {
    const app = nano();
    app.use('/tasks/*', () => undefined);
    app.get('/tasks', () => new Response('tasks'));
    const res = await app.fetch(new Request('https://example.test/tasks'));
    expect(await res.text()).toBe('tasks');
  });
});

describe('custom matcher lifecycle', () => {
  test('runs after hooks and full-app formatting on matched handlers', async () => {
    const app = flite({
      match: () => ({ handlers: [() => ({ matched: true })] }),
      after: { all: [res => ({ ...res, finalized: true })] }
    });
    const response = await app.fetch(new Request('https://example.test/custom'));
    expect(await response.json()).toEqual({ matched: true, finalized: true });
  });
});

describe('rate limiter identity', () => {
  test('does not trust spoofable forwarding headers by default', async () => {
    const limiter = rateLimit({ max: 1, windowMs: 1000 });
    expect(await limiter(new Request('https://example.test/', { headers: { 'x-forwarded-for': '1.1.1.1' } }))).toBeUndefined();
    const blocked = await limiter(new Request('https://example.test/', { headers: { 'x-forwarded-for': '2.2.2.2' } }));
    expect(blocked.status).toBe(429);
  });
});

describe('bodyLimit measures received bytes', () => {
  const app = flite({ before: { all: [bodyLimit({ max: 4 })] } });
  app.post('/body', async req => ({ body: await req.text() }));

  test('allows an exact-length body without consuming it for the handler', async () => {
    const response = await app.fetch(new Request('https://example.test/body', { method: 'POST', body: 'four' }));
    expect(await response.json()).toEqual({ body: 'four' });
  });

  test('blocks an oversized body without a Content-Length', async () => {
    const response = await app.fetch(new Request('https://example.test/body', { method: 'POST', body: 'five!' }));
    expect(response.status).toBe(413);
  });

  test('blocks an oversized body with a forged short Content-Length', async () => {
    const response = await app.fetch(new Request('https://example.test/body', {
      method: 'POST', body: 'five!', headers: { 'content-length': '1' }
    }));
    expect(response.status).toBe(413);
  });

  test('checks streaming bodies and rejects malformed declared lengths', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('123'));
        controller.enqueue(new TextEncoder().encode('45'));
        controller.close();
      }
    });
    const response = await app.fetch(new Request('https://example.test/body', {
      method: 'POST', body: stream, duplex: 'half'
    }));
    expect(response.status).toBe(413);
    const invalid = await app.fetch(new Request('https://example.test/body', {
      method: 'POST', headers: { 'content-length': '1garbage' }
    }));
    expect(invalid.status).toBe(400);
  });
});
