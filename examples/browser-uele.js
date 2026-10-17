// Generic, signal-agnostic SPA router using uele/reactive + uflite/nano.
// Works with any signal preset: preact, solid, vue, svelte, angular, ...
import { usePreactSignals } from 'uele/adapters/preact'
import { h } from 'uele'
import { flite } from 'uflite/nano'
import { createRouter, useRouter } from '../routers'

usePreactSignals()

export const app = flite()
app.get('/', () => h('h1', null, 'Home'))
app.get('/about', () => h('h1', null, 'About'))

export function App() {
  const [view, linkProps] = useRouter(app, h('h1', null, 'Loading...'))
  return h('main', linkProps(), view)
}
