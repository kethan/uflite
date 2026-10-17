import { ref, onMounted, onUnmounted } from 'vue'
import { flite } from './nano/index.js'

export const app = flite()

export function useRouter(initial) {
  const view = ref(initial)

  const navigate = async (path) => {
    try { view.value = await app.fetch(new Request(window.location.origin + path)) }
    catch { view.value = '404 - Not Found' }
  }

  const sync = () => navigate(window.location.pathname + window.location.search)
  onMounted(() => {
    window.addEventListener('popstate', sync)
    sync()
  })
  onUnmounted(() => window.removeEventListener('popstate', sync))

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
