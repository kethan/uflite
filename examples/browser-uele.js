import { h } from 'uele'
import { app, useRouter } from './useRouter-uele'

// --- ROUTE DEFINITIONS ---
app.get('/', () => h('h1', null, '🏠 Home View'))
app.get('/about', () => h('h1', null, 'ℹ️ About View'))
app.get('/user/:id', (req) => h('h1', null, `👤 User: ${req.params.id}`))

// Guard Middleware
app.use('/admin', (req, res, next) => {
  const isLoggedOut = true
  return isLoggedOut ? h('h1', { style: { color: 'red' } }, '🔒 403 Forbidden') : next()
})
app.get('/admin/dashboard', () => h('h1', null, 'Admin Area'))

// --- MAIN COMPONENT ---
export function App() {
  const [view, linkProps] = useRouter(h('h1', null, 'Loading...'))

  return h('div', { ...linkProps, style: 'display: flex; font-family: sans-serif; gap: 20px;' },
    h('nav', { style: 'width: 150px; background: #eee; padding: 10px;' },
      h('a', { href: '/', style: 'display: block;' }, 'Home'),
      h('a', { href: '/about', style: 'display: block;' }, 'About'),
      h('a', { href: '/user/99', style: 'display: block;' }, 'User 99'),
      h('a', { href: '/admin/dashboard', style: 'display: block;' }, 'Admin')
    ),
    h('main', { style: 'padding: 10px;' }, view)
  )
}
