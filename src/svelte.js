import { writable } from 'svelte/store'
import { onMount, onDestroy } from 'svelte'
import { flite } from './nano/index.js'

export const app = flite()

export function useRouter(initial) {
  const view = writable(initial)

  const navigate = async (path) => {
    try { view.set(await app.fetch(new Request(window.location.origin + path))) }
    catch { view.set('404 - Not Found') }
  }

  const sync = () => navigate(window.location.pathname + window.location.search)
  onMount(() => {
    window.addEventListener('popstate', sync)
    sync()
  })
  onDestroy(() => window.removeEventListener('popstate', sync))

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
