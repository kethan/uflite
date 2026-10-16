import { flite } from 'uflite/nano'

export const app = flite()

export function useRouter(root, initial) {
  const state = { view: initial }
  const render = () => { root.replaceChildren(); const n = document.createElement('div'); n.textContent = String(state.view); root.append(n) }
  const navigate = async (path) => {
    try { state.view = await app.fetch(new Request(window.location.origin + path)); render() }
    catch { state.view = '404 - Not Found'; render() }
  }
  const sync = () => navigate(window.location.pathname + window.location.search)
  window.addEventListener('popstate', sync)
  sync()

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a')
    if (!a) return
    const href = a.getAttribute('href')
    if (!href || href.startsWith('http')) return
    e.preventDefault()
    history.pushState(null, '', href)
    navigate(href)
  })

  return { navigate }
}
