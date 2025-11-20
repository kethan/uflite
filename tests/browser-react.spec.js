import { describe, test, expect } from 'bun:test'
import { flite } from '../lite/index.js'

const React = { createElement: (type, props, ...children) => ({ type, props, children }) }

describe('Browser React SPA - direct component returns', () => {
  test('root returns component function', async () => {
    const Home = () => React.createElement('div', null,
      React.createElement('h1', null, 'Home'),
      React.createElement('p', null, React.createElement('a', { href: '/user/42' }, 'Go to user'))
    )
    const app = flite()
    app.get('/', () => Home)
    const Comp = await app.fetch(new Request('http://localhost/'))
    expect(typeof Comp).toBe('function')
    const el = Comp()
    expect(el.type).toBe('div')
    expect(el.children[0].type).toBe('h1')
  })

  test('param binding via Bound component', async () => {
    const User = ({ id }) => React.createElement('div', null,
      React.createElement('h1', null, 'User ' + id),
      React.createElement('p', null, React.createElement('a', { href: '/' }, 'Back'))
    )
    const app = flite()
    app.get('/user/:id', (req) => { const Bound = () => React.createElement(User, { id: req.params.id }); return Bound })
    const Bound = await app.fetch(new Request('http://localhost/user/42'))
    const element = Bound()
    const rendered = element.type(element.props)
    expect(rendered.children[0].children[0]).toBe('User 42')
  })
})

describe('Browser React SPA - unknown and wildcard', () => {
  test('unknown path returns undefined', async () => {
    const app = flite()
    const res = await app.fetch(new Request('http://localhost/unknown'))
    expect(res).toBeUndefined()
  })

  test('wildcard fallback returns component function', async () => {
    const app = flite()
    const NotFound = () => React.createElement('div', null, React.createElement('h1', null, '404'))
    app.all('*', () => NotFound)
    const Comp = await app.fetch(new Request('http://localhost/anything'))
    const el = Comp()
    expect(el.children[0].children[0]).toBe('404')
  })
})

describe('Browser React SPA - mixed returns', () => {
  test('element instance and primitive pass through', async () => {
    const app = flite()
    const Elem = React.createElement('span', null, 'ok')
    app.get('/el', () => Elem)
    app.get('/str', () => 'string')
    const e = await app.fetch(new Request('http://localhost/el'))
    const s = await app.fetch(new Request('http://localhost/str'))
    expect(e.type).toBe('span')
    expect(s).toBe('string')
  })
})

describe('Browser React SPA - hooks and errors', () => {
  test('before short-circuits with component', async () => {
    const Early = () => React.createElement('div', null, React.createElement('h1', null, 'early'))
    const app = flite({ before: { all: [() => Early] } })
    app.get('/x', () => 'late')
    const Comp = await app.fetch(new Request('http://localhost/x'))
    const el = Comp()
    expect(el.children[0].children[0]).toBe('early')
  })

  test('after transforms component', async () => {
    const app = flite({ after: { all: [(res) => typeof res === 'function' ? () => React.createElement('section', null, res()) : res] } })
    const Body = () => React.createElement('div', null, React.createElement('p', null, 'body'))
    app.get('/x', () => Body)
    const Comp = await app.fetch(new Request('http://localhost/x'))
    const el = Comp()
    expect(el.type).toBe('section')
  })

  test('error hook returns component', async () => {
    const app = flite({ error: { all: [() => () => React.createElement('div', null, 'handled')] } })
    app.get('/x', () => { throw new Error('boom') })
    const Comp = await app.fetch(new Request('http://localhost/x'))
    const el = Comp()
    expect(el.children[0]).toBe('handled')
  })
})

describe('Browser React SPA - mode 1 middleware with components', () => {
  test('middleware returns component and stops', async () => {
    const app = flite({ mode: 1 })
    const Early = () => React.createElement('div', null, 'stop')
    app.use(async () => Early)
    app.get('/x', async () => () => React.createElement('div', null, 'late'))
    const Comp = await app.fetch(new Request('http://localhost/x'))
    const el = Comp()
    expect(el.children[0]).toBe('stop')
  })
})

describe('Browser React SPA - query and multi-handlers', () => {
  test('query parsing available to component', async () => {
    const Show = ({ q }) => React.createElement('div', null, React.createElement('p', null, q))
    const app = flite()
    app.get('/q', (req) => () => React.createElement(Show, { q: req.query.q }))
    const Comp = await app.fetch(new Request('http://localhost/q?q=hello'))
    const el = Comp()
    const rendered = el.type(el.props)
    expect(rendered.children[0].children[0]).toBe('hello')
  })

  test('multiple handlers: null then component', async () => {
    const app = flite()
    const Ok = () => React.createElement('div', null, 'ok')
    app.get('/multi', () => null, () => Ok)
    const Comp = await app.fetch(new Request('http://localhost/multi'))
    const el = Comp()
    expect(el.children[0]).toBe('ok')
  })
})