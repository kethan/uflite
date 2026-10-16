// Minimal uele router example using uflite/nano
import { flite } from "uflite/nano"

export const app = flite()

const Home = () => ({ type: 'div', children: ['Home'] })
const User = ({ id }) => ({ type: 'div', children: ['User ' + id] })
const NotFound = () => ({ type: 'div', children: ['404'] })

app.get('/', () => Home)
app.get('/user/:id', (req) => {
  const Bound = () => User({ id: req.params.id })
  return Bound
})
app.all('*', () => NotFound)

export function useRouter(initial) {
  const state = { view: initial }
  const setView = (v) => { state.view = v }
  const navigate = async (path) => {
    try { setView(await app.fetch(new Request(location.origin + path))) }
    catch { setView(NotFound) }
  }
  const linkProps = {
    onClick: (e) => {
      const a = e.target.closest('a')
      if (!a) return
      const href = a.getAttribute('href')
      if (!href || href.startsWith('http')) return
      e.preventDefault()
      history.pushState(null, '', href)
      navigate(href)
    }
  }
  navigate(location.pathname + location.search)
  window.addEventListener('popstate', () => navigate(location.pathname + location.search))
  return [() => state.view, linkProps]
}
