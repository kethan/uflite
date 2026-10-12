import { flite } from 'uflite/lite'

const app = flite()
app.get('/hello', () => new Response('ok'))
export default app
