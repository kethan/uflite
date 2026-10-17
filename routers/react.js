import { useState, useEffect } from 'react'
import { flite } from 'uflite/nano'

export const app = flite()


export function useRouter(InitialComponent) {
  const [view, setView] = useState(InitialComponent)

  const navigate = (path) => {
    app.fetch(new Request(window.location.origin + path))
      .then(setView)
      .catch(() => setView(<h1>404 - Not Found</h1>))
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