import { describe, expect, it } from 'bun:test'
import { PatternRouter } from 'hono/router/pattern-router'
import { RegExpRouter } from 'hono/router/reg-exp-router'
import { TrieRouter } from 'hono/router/trie-router'
import { flite } from '../lite/index.js'
import { json } from '../plugins.js'

const normalizeMatch = router => ({ method, path }) => {
  const [matches, paramStash = []] = router.match(method, path)
  if (!matches.length) return null

  return {
    handlers: matches.map(([handler, paramMap = {}]) => request => {
      request.params = Object.fromEntries(Object.entries(paramMap).map(([name, value]) => [
        name,
        typeof value === 'number' ? paramStash[value] : value
      ]))
      return handler(request)
    })
  }
}

const routerCases = [
  ['PatternRouter', PatternRouter],
  ['RegExpRouter', RegExpRouter],
  ['TrieRouter', TrieRouter]
]

describe('Hono router matchers with uflite', () => {
  for (const [name, Router] of routerCases) {
    it(`${name} routes parameterized requests through uflite`, async () => {
      const router = new Router()
      router.add('GET', '/users/:id', request => json({ id: request.params.id }))

      const app = flite({ match: normalizeMatch(router) })
      const response = await app.fetch(new Request('http://localhost/users/42'))

      expect(await response.json()).toEqual({ id: '42' })
    })

    it(`${name} returns no match for an unknown route`, () => {
      const router = new Router()
      router.add('GET', '/users/:id', request => json({ id: request.params.id }))

      expect(normalizeMatch(router)({ method: 'GET', path: '/missing' })).toBeNull()
    })
  }
})
