import { app, useRouter } from './useRouter-ulive'

app.get('/', () => 'Home View')
app.get('/about', () => 'About View')

const [view, linkProps] = useRouter('Loading...')
export { view, linkProps }
