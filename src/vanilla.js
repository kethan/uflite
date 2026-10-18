import { flite } from './nano/index.js'

export const app = flite()

export function useRouter(root, initial) {
  const state = { view: initial }
  const render = () => {
    if (!root) return
    root.textContent = String(state.view)
  }
  const navigate = async (path) => {
    try { state.view = await app.fetch(new Request(window.location.origin + path)); render() }
    catch { state.view = '404 - Not Found'; render() }
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
  return [() => state.view, linkProps]
}

export default useRouter
