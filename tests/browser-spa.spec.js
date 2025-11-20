import { describe, test, expect } from 'bun:test'
import { flite } from '../lite/index.js'

describe('Browser SPA (lite) - direct values', () => {
  test('root returns HTML string', async () => {
    const app = flite()
    app.get('/', () => '<h1>Home</h1>')
    const res = await app.fetch(new Request('http://localhost/'))
    expect(typeof res).toBe('string')
    expect(res.includes('Home')).toBe(true)
  })

  test('path params render in string', async () => {
    const app = flite()
    app.get('/user/:id', (req) => `<h1>User ${req.params.id}</h1>`)
    const res = await app.fetch(new Request('http://localhost/user/42'))
    expect(res.includes('User 42')).toBe(true)
  })

  test('unknown path returns undefined by default', async () => {
    const app = flite()
    const res = await app.fetch(new Request('http://localhost/unknown'))
    expect(res).toBeUndefined()
  })
})

describe('Browser SPA (lite) - wildcard fallback and precedence', () => {
  test('wildcard fallback returns string for unknown path', async () => {
    const app = flite()
    app.get('/known', () => 'known')
    app.all('*', () => 'fallback')
    const res1 = await app.fetch(new Request('http://localhost/known'))
    const res2 = await app.fetch(new Request('http://localhost/other'))
    expect(res1).toBe('known')
    expect(res2).toBe('fallback')
  })
})

describe('Browser SPA (lite) - mixed return types', () => {
  test('string, Response, and object pass through', async () => {
    const app = flite()
    app.get('/str', () => 'plain')
    app.get('/resp', () => new Response('ok'))
    app.get('/obj', () => ({ a: 1 }))
    const s = await app.fetch(new Request('http://localhost/str'))
    const r = await app.fetch(new Request('http://localhost/resp'))
    const o = await app.fetch(new Request('http://localhost/obj'))
    expect(s).toBe('plain')
    expect(r instanceof Response).toBe(true)
    expect(await r.text()).toBe('ok')
    expect(o).toEqual({ a: 1 })
  })
})

describe('Browser SPA (lite) - hooks and errors', () => {
  test('before hook short-circuits with string', async () => {
    const app = flite({ before: { all: [() => 'early'] } })
    app.get('/x', () => 'late')
    const res = await app.fetch(new Request('http://localhost/x'))
    expect(res).toBe('early')
  })

  test('after hook transforms string', async () => {
    const app = flite({ after: { all: [(res) => typeof res === 'string' ? `<main>${res}</main>` : res] } })
    app.get('/x', () => 'body')
    const res = await app.fetch(new Request('http://localhost/x'))
    expect(res).toBe('<main>body</main>')
  })

  test('error hook converts thrown error to string', async () => {
    const app = flite({ error: { all: [() => 'handled'] } })
    app.get('/x', () => { throw new Error('boom') })
    const res = await app.fetch(new Request('http://localhost/x'))
    expect(res).toBe('handled')
  })
})

describe('Browser SPA (lite) - mode 1 onion with strings', () => {
  test('middleware pattern with string response', async () => {
    const app = flite({ mode: 1, after: { all: [async (res) => typeof res === 'string' ? res.toUpperCase() : res] } })
    app.get('/x', async () => 'spa')
    const res = await app.fetch(new Request('http://localhost/x'))
    expect(res).toBe('SPA')
  })
})

describe('Browser SPA (lite) - query and multi-handlers', () => {
  test('query parsing available in request', async () => {
    const app = flite()
    app.get('/q/:id', (req) => `${req.params.id}:${req.query.q}`)
    const res = await app.fetch(new Request('http://localhost/q/10?q=hello%20world'))
    expect(res).toBe('10:hello world')
  })

  test('multiple handlers: null then string', async () => {
    const app = flite()
    app.get('/multi', () => null, () => 'ok')
    const res = await app.fetch(new Request('http://localhost/multi'))
    expect(res).toBe('ok')
  })
})