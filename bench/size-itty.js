import { Router } from 'itty-router'

const app = Router()
app.get('/hello', () => new Response('ok'))
export default app
