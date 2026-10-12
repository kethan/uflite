import { bench, group, run } from 'mitata'
import { flite as nano } from '../nano/index.js'
import { flite as lite } from '../lite/index.js'
import { Hono } from 'hono'
import { Router } from 'itty-router'
import { json, compile, lead, mount } from '../plugins.js'

const setupNano = () => {
  const app = nano()
  for (let i = 0; i < 1000; i++) app.get('/r' + i, () => json({ i }))
  app.all('*', () => json({ status: 404 }, { status: 404 }))
  return { fetch: (req) => app.fetch(req) }
}

const setupLite = () => {
  const app = lite()
  for (let i = 0; i < 1000; i++) app.get('/r' + i, () => json({ i }))
  app.all('*', () => json({ status: 404 }, { status: 404 }))
  return { fetch: (req) => app.fetch(req) }
}

const setupHono = () => {
  const app = new Hono()
  for (let i = 0; i < 1000; i++) app.get('/r' + i, (c) => c.json({ i }))
  app.all('*', (c) => c.json({ status: 404 }, 404))
  return { fetch: (req) => app.fetch(req) }
}

const setupItty = () => {
  const router = Router()
  for (let i = 0; i < 1000; i++) router.get('/r' + i, () => new Response(JSON.stringify({ i }), { headers: { 'content-type': 'application/json; charset=utf-8' } }))
  router.all('*', () => new Response(JSON.stringify({ status: 404 }), { status: 404, headers: { 'content-type': 'application/json; charset=utf-8' } }))
  return { fetch: (req) => router.handle(req) }
}

const u = setupNano()
const l = setupLite()
const h = setupHono()
const i = setupItty()

const scenarios = [
  { name: 'short static', method: 'GET', path: '/user' },
  { name: 'static with same radix', method: 'GET', path: '/user/comments' },
  { name: 'dynamic route', method: 'GET', path: '/user/lookup/username/hey' },
  { name: 'mixed static dynamic', method: 'GET', path: '/event/abcd1234/comments' },
  { name: 'post', method: 'POST', path: '/event/abcd1234/comment' },
  { name: 'long static', method: 'GET', path: '/very/deeply/nested/route/hello/there' },
  { name: 'wildcard', method: 'GET', path: '/static/index.html' },
]

const setupNanoScenarios = () => {
  const app = nano()
  app.get('/user', () => json({ ok: true }))
  app.get('/user/comments', () => json({ ok: true }))
  app.get('/user/lookup/username/:u', () => json({ ok: true }))
  app.get('/event/:id/comments', () => json({ ok: true }))
  app.post('/event/:id/comment', () => json({ ok: true }))
  app.get('/very/deeply/nested/route/hello/there', () => json({ ok: true }))
  app.get('/static/*', () => json({ ok: true }))
  app.all('*', () => json({ status: 404 }, { status: 404 }))
  app.get('/q', r => json({ v: (r.headers.get('x-k') ? (r.query[r.headers.get('x-k')] ?? null) : Object.keys(r.query).length) }))
  return { fetch: (req) => app.fetch(req) }
}

const setupLiteScenarios = () => {
  const app = lite()
  app.get('/user', () => json({ ok: true }))
  app.get('/user/comments', () => json({ ok: true }))
  app.get('/user/lookup/username/:u', () => json({ ok: true }))
  app.get('/event/:id/comments', () => json({ ok: true }))
  app.post('/event/:id/comment', () => json({ ok: true }))
  app.get('/very/deeply/nested/route/hello/there', () => json({ ok: true }))
  app.get('/static/*', () => json({ ok: true }))
  app.all('*', () => json({ status: 404 }, { status: 404 }))
  app.get('/q', r => json({ v: (r.headers.get('x-k') ? (r.query[r.headers.get('x-k')] ?? null) : Object.keys(r.query).length) }))
  return { fetch: (req) => app.fetch(req) }
}

const setupHonoScenarios = () => {
  const app = new Hono()
  app.get('/user', c => c.json({ ok: true }))
  app.get('/user/comments', c => c.json({ ok: true }))
  app.get('/user/lookup/username/:u', c => c.json({ ok: true }))
  app.get('/event/:id/comments', c => c.json({ ok: true }))
  app.post('/event/:id/comment', c => c.json({ ok: true }))
  app.get('/very/deeply/nested/route/hello/there', c => c.json({ ok: true }))
  app.get('/static/*', c => c.json({ ok: true }))
  app.all('*', c => c.json({ status: 404 }, 404))
  app.get('/q', c => {
    const k = c.req.header('x-k')
    const v = k ? c.req.query(k) : Object.keys(Object.fromEntries(new URL(c.req.url).searchParams)).length
    return c.json({ v: v ?? null })
  })
  return { fetch: (req) => app.fetch(req) }
}

const setupIttyScenarios = () => {
  const router = Router()
  const j = o => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json; charset=utf-8' } })
  router.get('/user', () => j({ ok: true }))
  router.get('/user/comments', () => j({ ok: true }))
  router.get('/user/lookup/username/:u', () => j({ ok: true }))
  router.get('/event/:id/comments', () => j({ ok: true }))
  router.post('/event/:id/comment', () => j({ ok: true }))
  router.get('/very/deeply/nested/route/hello/there', () => j({ ok: true }))
  router.get('/static/*', () => j({ ok: true }))
  router.all('*', () => new Response(JSON.stringify({ status: 404 }), { status: 404, headers: { 'content-type': 'application/json; charset=utf-8' } }))
  router.get('/q', req => {
    const k = req.headers.get('x-k')
    const u = new URL(req.url)
    const v = k ? u.searchParams.get(k) : Array.from(u.searchParams.keys()).length
    return j({ v: v ?? null })
  })
  return { fetch: (req) => router.handle(req) }
}

const baseReq = (p, m = 'GET') => new Request('http://localhost' + p, { method: m })

group('Baseline', () => {
  const reqHit = baseReq('/r500')
  const reqMiss = baseReq('/not-found')
  bench('nano /r500', async () => { await u.fetch(reqHit) })
  bench('lite /r500', async () => { await l.fetch(reqHit) })
  bench('hono /r500', async () => { await h.fetch(reqHit) })
  bench('itty /r500', async () => { await i.fetch(reqHit) })
  bench('nano /not-found', async () => { await u.fetch(reqMiss) })
  bench('lite /not-found', async () => { await l.fetch(reqMiss) })
})

const n2 = setupNanoScenarios()
const l2 = setupLiteScenarios()
const h2 = setupHonoScenarios()
const i2 = setupIttyScenarios()

group('Scenarios', () => {
  for (const s of scenarios) {
    const req = baseReq(s.path, s.method)
    bench('nano ' + s.name, async () => { await n2.fetch(req) })
    bench('lite ' + s.name, async () => { await l2.fetch(req) })
    bench('hono ' + s.name, async () => { await h2.fetch(req) })
    bench('itty ' + s.name, async () => { await i2.fetch(req) })
  }
})

const queries = [
  { url: 'http://example.com/?page=1', key: 'page' },
  { url: 'http://example.com/?url=http://example.com&page=1', key: 'page' },
  { url: 'http://example.com/?page=1', key: undefined },
  { url: 'http://example.com/?url=http://example.com&page=1', key: undefined },
  { url: 'http://example.com/?url=http://example.com/very/very/deep/path/to/something&search=very-long-search-string', key: undefined },
  { url: 'http://example.com/?search=Hono+is+a+small,+simple,+and+ultrafast+web+framework+for+the+Edge.&page=1', key: undefined },
  { url: 'http://example.com/?a=1&b=2&c=3&d=4&e=5&f=6&g=7&h=8&i=9&j=10', key: undefined },
]

group('Queries', () => {
  for (let idx = 0; idx < queries.length; idx++) {
    const q = queries[idx]
    const url = q.url.replace('http://example.com', 'http://localhost/q')
    const headers = q.key ? { 'x-k': q.key } : undefined
    const req = new Request(url, { headers })
    bench('nano query ' + idx, async () => { await n2.fetch(req) })
    bench('lite query ' + idx, async () => { await l2.fetch(req) })
    bench('hono query ' + idx, async () => { await h2.fetch(req) })
    bench('itty query ' + idx, async () => { await i2.fetch(req) })
  }
})

await run({ percentiles: false })