import { flite } from 'uflite/nano'

const app = flite()
app.get('/hello', () => new Response('ok'))
export default app
