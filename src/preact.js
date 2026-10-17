import { signal } from '@preact/signals'
import { useEffect } from 'preact/hooks'
import { flite } from './nano/index.js'

export const app = flite()

export function useRouter(InitialComponent) {
  const view = signal(InitialComponent)

  const navigate = (path) => {
    app.fetch(new Request(window.location.origin + path))
      .then((res) => { view.value = res })
      .catch(() => { view.value = '404 - Not Found' })
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

export default useRouter
