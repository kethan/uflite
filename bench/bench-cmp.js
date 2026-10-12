import { flite as nano } from "../nano/index.js";
import { flite as lite } from "../lite/index.js";
import { compile, lead, mount, json } from "../plugins.js";
import { Hono } from "hono";
import { Router } from "itty-router";

const now = () => performance.now();
const print = (label, ms, ops) => console.log(label + " " + ms.toFixed(2) + "ms " + Math.round(ops) + "/s");
const group = async (label, fn) => { console.log("\n== " + label + " =="); await fn(); };

const setupNano = () => {
  const app = nano();
  for (let i = 0; i < 1000; i++) app.get("/r" + i, () => json({ i }));
  app.all("*", () => json({ status: 404 }, { status: 404 }));
  return { fetch: (req) => app.fetch(req) };
};

const setupLite = () => {
  const app = lite();
  for (let i = 0; i < 1000; i++) app.get("/r" + i, () => json({ i }));
  app.all("*", () => json({ status: 404 }, { status: 404 }));
  return { fetch: (req) => app.fetch(req) };
};

const setupHono = () => {
  const app = new Hono();
  for (let i = 0; i < 1000; i++) app.get("/r" + i, (c) => c.json({ i }));
  app.all("*", (c) => c.json({ status: 404 }, 404));
  return { fetch: (req) => app.fetch(req) };
};

const setupItty = () => {
  const router = Router();
  for (let i = 0; i < 1000; i++) router.get("/r" + i, () => new Response(JSON.stringify({ i }), { headers: { 'content-type': 'application/json; charset=utf-8' } }));
  router.all("*", () => new Response(JSON.stringify({ status: 404 }), { status: 404, headers: { 'content-type': 'application/json; charset=utf-8' } }));
  return { fetch: (req) => router.handle(req) };
};

const run = async (label, app, path, n = 20000) => {
  const req = new Request("http://localhost" + path);
  const t0 = now();
  for (let i = 0; i < n; i++) await app.fetch(req);
  const ms = now() - t0;
  print(label + " " + path, ms, n / (ms / 1000));
  return { ms, ops: n / (ms / 1000) };
};

const u = setupNano();
const l = setupLite();
const h = setupHono();
const i = setupItty();

await group("Baseline", async () => {
  await run("nano", u, "/r500");
  await run("lite", l, "/r500");
  await run("hono", h, "/r500");
  await run("itty", i, "/r500");
  await run("nano", u, "/not-found");
  await run("lite", l, "/not-found");
});

// Legacy linear scan comparator
const legacy = (() => {
  const routes = [];
  const add = (m, p, ...hs) => (routes.push([m, compile(lead(p)), hs.map(mount), lead(p)]), null);
  return {
    get: (p, ...hs) => (add('GET', p, ...hs), null),
    all: (p, ...hs) => (add('ALL', p || '*', ...hs), null),
    fetch: async (req, ...args) => {
      const url = new URL(req.url);
      let res, match;
      const h = [];
      routes.some(([mt, rx, hs]) => (
        (mt == req.method || mt == 'ALL') && (match = url.pathname.match(rx)) &&
        (mt != 'ALL' && (req.params = match.groups || {}), h.push(...hs), mt != 'ALL')
      ));
      if (h.length) {
        for (const f of h) { const t = await f(req, ...args); if (t != null) { res = t; break; } }
      }
      return res;
    }
  };
})();

for (let i = 0; i < 1000; i++) legacy.get("/r" + i, () => json({ i }));
legacy.all("*", () => json({ status: 404 }, { status: 404 }));

await group("Legacy", async () => {
  await run("legacy", legacy, "/r500");
  await run("legacy", legacy, "/not-found");
  await run("hono", h, "/not-found");
  await run("itty", i, "/not-found");
});

// Scenario comparison inspired by Hono benchmarks
const scenarios = [
  { name: 'short static', method: 'GET', path: '/user' },
  { name: 'static with same radix', method: 'GET', path: '/user/comments' },
  { name: 'dynamic route', method: 'GET', path: '/user/lookup/username/hey' },
  { name: 'mixed static dynamic', method: 'GET', path: '/event/abcd1234/comments' },
  { name: 'post', method: 'POST', path: '/event/abcd1234/comment' },
  { name: 'long static', method: 'GET', path: '/very/deeply/nested/route/hello/there' },
  { name: 'wildcard', method: 'GET', path: '/static/index.html' },
];

const setupNanoScenarios = () => {
  const app = nano();
  app.get('/user', () => json({ ok: true }));
  app.get('/user/comments', () => json({ ok: true }));
  app.get('/user/lookup/username/:u', () => json({ ok: true }));
  app.get('/event/:id/comments', () => json({ ok: true }));
  app.post('/event/:id/comment', () => json({ ok: true }));
  app.get('/very/deeply/nested/route/hello/there', () => json({ ok: true }));
  app.get('/static/*', () => json({ ok: true }));
  app.all('*', () => json({ status: 404 }, { status: 404 }));
  app.get('/q', r => json({ v: (r.headers.get('x-k') ? (r.query[r.headers.get('x-k')] ?? null) : Object.keys(r.query).length) }));
  return { fetch: (req) => app.fetch(req) };
};

const setupLiteScenarios = () => {
  const app = lite();
  app.get('/user', () => json({ ok: true }));
  app.get('/user/comments', () => json({ ok: true }));
  app.get('/user/lookup/username/:u', () => json({ ok: true }));
  app.get('/event/:id/comments', () => json({ ok: true }));
  app.post('/event/:id/comment', () => json({ ok: true }));
  app.get('/very/deeply/nested/route/hello/there', () => json({ ok: true }));
  app.get('/static/*', () => json({ ok: true }));
  app.all('*', () => json({ status: 404 }, { status: 404 }));
  app.get('/q', r => json({ v: (r.headers.get('x-k') ? (r.query[r.headers.get('x-k')] ?? null) : Object.keys(r.query).length) }));
  return { fetch: (req) => app.fetch(req) };
};

const setupHonoScenarios = () => {
  const app = new Hono();
  app.get('/user', c => c.json({ ok: true }));
  app.get('/user/comments', c => c.json({ ok: true }));
  app.get('/user/lookup/username/:u', c => c.json({ ok: true }));
  app.get('/event/:id/comments', c => c.json({ ok: true }));
  app.post('/event/:id/comment', c => c.json({ ok: true }));
  app.get('/very/deeply/nested/route/hello/there', c => c.json({ ok: true }));
  app.get('/static/*', c => c.json({ ok: true }));
  app.all('*', c => c.json({ status: 404 }, 404));
  app.get('/q', c => {
    const k = c.req.header('x-k');
    const v = k ? c.req.query(k) : Object.keys(Object.fromEntries(new URL(c.req.url).searchParams)).length;
    return c.json({ v: v ?? null });
  });
  return { fetch: (req) => app.fetch(req) };
};

const setupIttyScenarios = () => {
  const router = Router();
  const j = o => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json; charset=utf-8' } });
  router.get('/user', () => j({ ok: true }));
  router.get('/user/comments', () => j({ ok: true }));
  router.get('/user/lookup/username/:u', () => j({ ok: true }));
  router.get('/event/:id/comments', () => j({ ok: true }));
  router.post('/event/:id/comment', () => j({ ok: true }));
  router.get('/very/deeply/nested/route/hello/there', () => j({ ok: true }));
  router.get('/static/*', () => j({ ok: true }));
  router.all('*', () => new Response(JSON.stringify({ status: 404 }), { status: 404, headers: { 'content-type': 'application/json; charset=utf-8' } }));
  router.get('/q', req => {
    const k = req.headers.get('x-k');
    const u = new URL(req.url);
    const v = k ? u.searchParams.get(k) : Array.from(u.searchParams.keys()).length;
    return j({ v: v ?? null });
  });
  return { fetch: (req) => router.handle(req) };
};

const n2 = setupNanoScenarios();
const l2 = setupLiteScenarios();
const h2 = setupHonoScenarios();
const i2 = setupIttyScenarios();

let liteWins = 0, ittyWins = 0, ties = 0;
await group("Scenario Routes", async () => {
  for (const s of scenarios) {
    const req = new Request('http://localhost' + s.path, { method: s.method });
    const rNano = await run('nano ' + s.name, { fetch: r => n2.fetch(req) }, s.path);
    const rLite = await run('lite ' + s.name, { fetch: r => l2.fetch(req) }, s.path);
    const rHono = await run('hono ' + s.name, { fetch: r => h2.fetch(req) }, s.path);
    const rItty = await run('itty ' + s.name, { fetch: r => i2.fetch(req) }, s.path);
    const better = rLite.ops > rItty.ops ? 'lite faster than itty' : (rLite.ops < rItty.ops ? 'lite slower than itty' : 'lite == itty');
    const ratio = (rLite.ops / rItty.ops).toFixed(2);
    console.log('compare ' + s.name + ': ' + better + ' x' + ratio);
    if (rLite.ops > rItty.ops) liteWins++; else if (rLite.ops < rItty.ops) ittyWins++; else ties++;
  }
});
console.log('\nSummary lite vs itty: ' + liteWins + ' faster, ' + ittyWins + ' slower, ' + ties + ' ties');

const queries = [
  { url: 'http://example.com/?page=1', key: 'page' },
  { url: 'http://example.com/?url=http://example.com&page=1', key: 'page' },
  { url: 'http://example.com/?page=1', key: undefined },
  { url: 'http://example.com/?url=http://example.com&page=1', key: undefined },
  { url: 'http://example.com/?url=http://example.com/very/very/deep/path/to/something&search=very-long-search-string', key: undefined },
  { url: 'http://example.com/?search=Hono+is+a+small,+simple,+and+ultrafast+web+framework+for+the+Edge.&page=1', key: undefined },
  { url: 'http://example.com/?a=1&b=2&c=3&d=4&e=5&f=6&g=7&h=8&i=9&j=10', key: undefined },
];

const runQ = async (label, app, url, key) => {
  const req = new Request(url.replace('http://example.com', 'http://localhost/q'), { headers: key ? { 'x-k': key } : undefined });
  const t0 = now();
  const n = 20000;
  for (let i = 0; i < n; i++) await app.fetch(req);
  const ms = now() - t0; print(label, ms, n / (ms / 1000));
};

await group("Query Parsing", async () => {
  for (const q of queries) {
    await runQ('nano query', n2, q.url, q.key);
    await runQ('lite query', l2, q.url, q.key);
    await runQ('hono query', h2, q.url, q.key);
    await runQ('itty query', i2, q.url, q.key);
  }
});

// Minimal match() function adapters
const honoMatch = (app) => ({ method, path }) => ({ handlers: [ (req) => app.fetch(req) ] });
const ittyMatch = (router) => ({ method, path }) => ({ handlers: [ (req) => router.handle(req) ] });

const setupLiteWithHonoAdapter = () => {
  const app = lite({ match: honoMatch(setupHono()) });
  app.all('*', () => json({ status: 404 }, { status: 404 }));
  return { fetch: (req) => app.fetch(req) };
};

const setupLiteWithIttyAdapter = () => {
  const app = lite({ match: ittyMatch(Router()) });
  app.all('*', () => json({ status: 404 }, { status: 404 }));
  return { fetch: (req) => app.fetch(req) };
};

await group('Adapter Delegation', async () => {
  const lh = setupLiteWithHonoAdapter();
  const li = setupLiteWithIttyAdapter();
  await run('lite+hono-adapter', lh, '/r500');
  await run('lite+itty-adapter', li, '/r500');
  await run('lite+hono-adapter', lh, '/not-found');
});

// Minimal custom routers (add + match) used only to construct match()
const createPatternRouter = () => {
  const R = [];
  const add = (method, path, handler) => {
    const ends = path.endsWith('*');
    if (ends) path = path.slice(0, -2);
    const parts = (path.match(/\/(?:[:\w]+(?:\{[^}]+\})?)|\/?[^\/\?]+/g) || []).map(p => {
      const m = p.match(/^\/:([^\{]+)(?:\{(.*)\})?/);
      return m ? `/(?<${m[1]}>${m[2] || '[^/]+'})` : p.replace(/[\.\\+*\[\]^$()]/g, '\\$&');
    });
    const re = new RegExp(`^${parts.join('')}${ends ? '' : '/?$'}`);
    R.push([re, method, handler]);
  };
  const match = (method, path) => {
    const handlers = [];
    let params = null;
    for (const [rx, mm, h] of R) if (mm === method || mm === 'ALL') {
      const m = rx.exec(path); if (m) { handlers.push(h); params = m.groups || params; }
    }
    return handlers.length ? { handlers, params } : null;
  };
  return { add, match };
};

const setupLiteWithPatternRouter = () => {
  const pr = createPatternRouter();
  for (let i = 0; i < 1000; i++) pr.add('GET', '/r' + i, () => json({ i }));
  const app = lite({ match: ({ method, path }) => pr.match(method, path) });
  app.all('*', () => json({ status: 404 }, { status: 404 }));
  return { fetch: (req) => app.fetch(req) };
};

import Trouter from "trouter";

const setupLiteWithTrouter = () => {
  const tr = new Trouter();
  for (let i = 0; i < 1000; i++) tr.add('GET', '/r' + i, (req) => new Response(JSON.stringify({ i }), { headers: { 'content-type': 'application/json; charset=utf-8' } }));
  const app = lite({ match: ({ method, path }) => {
    const f = tr.find(method, path);
    if (!f.handlers.length) return null;
    return { handlers: f.handlers.map(fn => (req) => fn(req)) };
  } });
  app.all('*', () => json({ status: 404 }, { status: 404 }));
  return { fetch: (req) => app.fetch(req) };
};

await group('Custom Routers (match)', async () => {
  const lp = setupLiteWithPatternRouter();
  const lt = setupLiteWithTrouter();
  await run('lite+pattern /r500', lp, '/r500');
  await run('lite+trouter /r500', lt, '/r500');
});