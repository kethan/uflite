import { Hono } from 'hono'

const app = new Hono()
app.get('/hello', context => context.text('ok'))
export default app
