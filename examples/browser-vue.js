import { h } from 'vue'
import { app, useRouter } from './useRouter-vue'

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
export default function App() {
  const [view, linkProps] = useRouter('Loading...')

  return (
    <div {...linkProps} style={{ display: 'flex', fontFamily: 'sans-serif', gap: '20px' }}>
      <nav style={{ width: '150px', background: '#eee', padding: '10px' }}>
        <a href="/" style={{ display: 'block' }}>Home</a>
        <a href="/about" style={{ display: 'block' }}>About</a>
        <a href="/user/99" style={{ display: 'block' }}>User 99</a>
        <a href="/admin/dashboard" style={{ display: 'block' }}>Admin</a>
      </nav>

      <main style={{ padding: '10px' }}>
        {view.value ?? view}
      </main>
    </div>
  )
}
