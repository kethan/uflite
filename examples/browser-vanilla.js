import { app, useRouter } from './useRouter-vanilla'

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
const root = document.getElementById('app')
const { navigate } = useRouter(root, 'Loading...')
export { navigate }
