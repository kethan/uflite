import { signal } from 'ulive'
import { flite } from 'uflite/nano'

export const app = flite()

export function useRouter(initial) {
  const view = signal(initial)

  const navigate = async (path) => {
    try { view.value = await app.fetch(new Request(window.location.origin + path)) }
    catch { view.value = <h1>404 - Not Found</h1> }
  }

  const sync = () => navigate(window.location.pathname + window.location.search)
  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', sync)
    sync()
  }

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
