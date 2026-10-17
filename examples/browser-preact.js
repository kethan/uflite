import { app, useRouter } from './useRouter-preact'

app.get('/', () => 'Home View')
app.get('/about', () => 'About View')

export default function App() {
  const [view, linkProps] = useRouter('Loading...')
  return { view, linkProps }
}
