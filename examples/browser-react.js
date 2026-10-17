import React from 'react'
import { app, useRouter } from './useRouter-react'

// --- ROUTE DEFINITIONS ---
app.get('/', () => <h1>🏠 Home View</h1>)
app.get('/about', () => <h1>ℹ️ About View</h1>)
app.get('/user/:id', (req) => (
  <h1>👤 User: {req.params.id} (Theme: {req.query?.theme || 'light'})</h1>
))

// Guard Middleware
app.use('/admin', (req, res, next) => {
  const isLoggedOut = true
  return isLoggedOut ? <h1 style={{ color: 'red' }}>🔒 403 Forbidden</h1> : next()
})
app.get('/admin/dashboard', () => <h1>Admin Area</h1>)

// --- MAIN COMPONENT ---
export default function App() {
  // Pass the default fallback component to the hook
  const [view, linkProps] = useRouter(<h1>Loading...</h1>)

  return (
    // Spreading linkProps onto a wrapper handles intercepting all internal anchor clicks automatically
    <div {...linkProps} style={{ display: 'flex', fontFamily: 'sans-serif', gap: '20px' }}>
      <nav style={{ width: '150px', background: '#eee', padding: '10px' }}>
        <a href="/" style={{ display: 'block' }}>Home</a>
        <a href="/about" style={{ display: 'block' }}>About</a>
        <a href="/user/99?theme=dark" style={{ display: 'block' }}>User 99</a>
        <a href="/admin/dashboard" style={{ display: 'block' }}>Admin</a>
      </nav>

      <main style={{ padding: '10px' }}>
        {view}
      </main>
    </div>
  )
}
