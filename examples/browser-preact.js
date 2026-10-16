// Assumes Preact + @preact/signals are loaded (e.g. via CDN or bundler)
import { signal } from '@preact/signals'
import { useEffect } from 'preact/hooks'
import { flite } from 'uflite/nano'

export const app = flite()

app.get('/', () => <h1>🏠 Preact Home</h1>)
app.get('/about', () => <h1>ℹ️ Preact About</h1>)

export function useRouter(InitialComponent) {
  // Store the active component inside a native Preact Signal primitive
  const view = signal(InitialComponent)

  const navigate = (path) => {
    app.fetch(new Request(window.location.origin + path))
      .then((res) => { view.value = res })
      .catch(() => { view.value = <h1>404 - Not Found</h1> })
  }

  useEffect(() => {
    const sync = () => navigate(window.location.pathname + window.location.search)
    window.addEventListener('popstate', sync)
    sync()
    return () => window.removeEventListener('popstate', sync)
  }, [])

  const linkProps = {
    onClick: (e) => {
      const a = e.target.closest('a')
      if (!a || a.getAttribute('href')?.startsWith('http')) return
      e.preventDefault()
      window.history.pushState(null, '', a.getAttribute('href'))
      navigate(a.getAttribute('href'))
    }
  }

  return [view, linkProps]
}
