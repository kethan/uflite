import { app, useRouter } from './useRouter-ulive'

app.get('/', () => 'Home View')
app.get('/about', () => 'About View')

export default function App() {
  const [view, linkProps] = useRouter('Loading...')
  return { view, linkProps }
}
