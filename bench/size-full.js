import { flite } from 'uflite'

const app = flite()
app.get('/hello', () => new Response('ok'))
export default app
