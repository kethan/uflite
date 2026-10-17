import { app, useRouter } from './browser-preact'

app.get('/', () => 'Home View')
app.get('/about', () => 'About View')

// Example usage of useRouter
const [view, linkProps] = useRouter('Loading...')
export default { view, linkProps }
