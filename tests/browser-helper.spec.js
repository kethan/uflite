import { describe, test, expect } from 'bun:test'
import { flite } from '../src/lite/index.js'
import { createSPA, useRouter } from '../src/browser.js'

const React = { createElement: (type, props, ...children) => ({ type, props, children }) }

describe('Browser helper (createSPA)', () => {
  test('navigate returns matched component', async () => {
    const app = flite()
    const Home = () => React.createElement('div', null, 'home')
    app.get('/', () => Home)
    const spa = createSPA(app, { baseUrl: 'http://localhost' })
    const view = await spa.navigate('/')
    expect(typeof view).toBe('function')
    expect(view().children[0]).toBe('home')
  })

  test('navigate 404 fallback', async () => {
    const app = flite()
    const NotFound = () => React.createElement('div', null, '404')
    app.all('*', () => NotFound)
    const spa = createSPA(app, { baseUrl: 'http://localhost' })
    const view = await spa.navigate('/nope')
    expect(view().children[0]).toBe('404')
  })

  test('subscribe receives views', async () => {
    const app = flite()
    app.get('/', () => 'home')
    const spa = createSPA(app, { baseUrl: 'http://localhost' })
    const seen = []
    const unsub = spa.subscribe((v) => seen.push(v))
    await spa.navigate('/')
    unsub()
    expect(seen).toEqual(['home'])
  })

  test('linkProps prevents default and navigates', async () => {
    const app = flite()
    app.get('/', () => 'home')
    app.get('/about', () => 'about')
    const spa = createSPA(app, { baseUrl: 'http://localhost' })
    let prevented = false
    const e = {
      target: { closest: () => ({ getAttribute: () => '/about' }) },
      preventDefault: () => { prevented = true }
    }
    // pushState may not exist; provide fake window via options? linkProps uses internal win (undefined) so no pushState needed
    spa.linkProps.onClick(e)
    // allow async navigate
    await new Promise((r) => setTimeout(r, 10))
    expect(prevented).toBe(true)
  })

  test('useRouter returns helpers', async () => {
    const app = flite()
    app.get('/', () => 'home')
    const set = []
    const r = useRouter(app, 'initial', (v) => set.push(v), { baseUrl: 'http://localhost' })
    await r.navigate('/')
    expect(set).toEqual(['home'])
  })

  test('routes array form', async () => {
    const spa = createSPA([['/', () => 'home']], { baseUrl: 'http://localhost' })
    const view = await spa.navigate('/')
    expect(view).toBe('home')
  })
})
