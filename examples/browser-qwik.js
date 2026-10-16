import { useSignal, useVisibleTask$ } from '@builder.io/qwik'
import { flite } from 'uflite/nano'

export const app = flite()

export function useRouter(initial) {
  const view = useSignal(initial)

  const navigate = async (path) => {
    try { view.value = await app.fetch(new Request(window.location.origin + path)) }
    catch { view.value = <h1>404 - Not Found</h1> }
  }

  useVisibleTask$(() => {
    const sync = () => navigate(window.location.pathname + window.location.search)
    window.addEventListener('popstate', sync)
    sync()
    return () => window.removeEventListener('popstate', sync)
  })

  const linkProps = {
    onClick$: (e) => {
      const a = e.target.closest('a')
      if (!a || a.getAttribute('href')?.startsWith('http')) return
      e.preventDefault()
      window.history.pushState(null, '', a.getAttribute('href'))
      navigate(a.getAttribute('href'))
    }
  }

  return [view, linkProps]
}
