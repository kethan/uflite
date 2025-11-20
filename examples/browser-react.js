// Assumes React & ReactDOM are loaded globally via CDN
import { flite } from "uflite/lite"

const app = flite()

const Home = () => React.createElement('div', null, [
  React.createElement('h1', { key: 1 }, 'Home'),
  React.createElement('p', { key: 2 }, React.createElement('a', { href: '/user/42' }, 'Go to user'))
])

const User = ({ id }) => React.createElement('div', null, [
  React.createElement('h1', { key: 1 }, 'User ' + id),
  React.createElement('p', { key: 2 }, React.createElement('a', { href: '/' }, 'Back'))
])

app.get('/', () => Home)
app.get('/user/:id', (req) => {
  const Bound = () => React.createElement(User, { id: req.params.id })
  return Bound
})

const mount = (Comp) => {
  const rootEl = document.getElementById('root')
  const el = React.createElement(Comp)
  // React 18: createRoot if available, else render
  if (ReactDOM.createRoot) ReactDOM.createRoot(rootEl).render(el)
  else ReactDOM.render(el, rootEl)
}

const ErrorView = () => React.createElement('div', null, 'Error')

document.addEventListener('click', (e) => {
  const a = e.target.closest('a')
  if (!a) return
  const href = a.getAttribute('href')
  if (!href || href.startsWith('http')) return
  e.preventDefault()
  history.pushState(null, '', href)
  app.fetch(new Request(location.origin + href)).then((Comp) => mount(Comp)).catch(() => mount(ErrorView))
})

window.addEventListener('popstate', () => app.fetch(new Request(location.origin + location.pathname)).then((Comp) => mount(Comp)).catch(() => mount(ErrorView)))

app.fetch(new Request(location.origin + location.pathname)).then((Comp) => mount(Comp)).catch(() => mount(ErrorView))