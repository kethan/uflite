import { createSignal, onMount, onCleanup } from 'solid-js'
import { flite } from 'uflite/nano'

export const app = flite()

export function useRouter(InitialComponent) {
  const [view, setView] = createSignal(InitialComponent)

  const navigate = async (path) => {
    try { setView(await app.fetch(new Request(window.location.origin + path))) }
    catch { setView(() => <h1>404 - Not Found</h1>) }
  }

  const sync = () => navigate(window.location.pathname + window.location.search)
  onMount(() => {
    window.addEventListener('popstate', sync)
    sync()
  })
  onCleanup(() => window.removeEventListener('popstate', sync))

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
