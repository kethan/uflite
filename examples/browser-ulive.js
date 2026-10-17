import { app, useRouter } from './useRouter-ulive'

// --- ROUTE DEFINITIONS ---
app.get('/', () => '🏠 Home View')
app.get('/about', () => 'ℹ️ About View')
app.get('/user/:id', (req) => `👤 User: ${req.params.id}`)

// Guard Middleware
app.use('/admin', (req, res, next) => {
  const isLoggedOut = true
  return isLoggedOut ? '🔒 403 Forbidden' : next()
})
app.get('/admin/dashboard', () => 'Admin Area')

// --- MAIN ---
export default function App() {
  const [view, linkProps] = useRouter('Loading...')
  return { view, linkProps }
}
