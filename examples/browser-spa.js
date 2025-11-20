import { flite } from "uflite/lite"

const app = flite()

app.get('/', () => `<h1>Home</h1><p><a href="/user/42">Go to user</a></p>`)
app.get('/user/:id', (req) => `<h1>User ${req.params.id}</h1><p><a href="/">Back</a></p>`)

const root = () => document.getElementById('root')
const resolve = async (val) => {
  if (val == null) return
  if (typeof val === 'string') root().innerHTML = val
  else if (val instanceof Response) root().innerHTML = await val.text()
  else root().innerHTML = String(val)
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('a')
  if (!a) return
  const href = a.getAttribute('href')
  if (!href || href.startsWith('http')) return
  e.preventDefault()
  history.pushState(null, '', href)
  app.fetch(new Request(location.origin + href)).then(resolve).catch(() => { root().innerHTML = '<p>Error</p>' })
})

window.addEventListener('popstate', () => app.fetch(new Request(location.origin + location.pathname)).then(resolve).catch(() => { root().innerHTML = '<p>Error</p>' }))

app.fetch(new Request(location.origin + location.pathname)).then(resolve).catch(() => { root().innerHTML = '<p>Error</p>' })