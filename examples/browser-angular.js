import { app, useRouter } from './useRouter-angular'

app.get('/', () => 'Home View')
app.get('/about', () => 'About View')

export default function App() {
  const [view, linkProps] = useRouter('Loading...')
  return { view, linkProps }
}
