import { app, useRouter } from './useRouter-qwik'

app.get('/', () => 'Home View')
app.get('/about', () => 'About View')

export default function App() {
  const [view, linkProps] = useRouter('Loading...')
  return { view, linkProps }
}
