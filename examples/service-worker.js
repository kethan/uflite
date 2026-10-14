import { flite } from 'uflite/lite'

// Lite returns raw values, so keep this worker's JSON responses native and small.
const jsonResponse = body => new Response(JSON.stringify(body), {
  headers: { 'content-type': 'application/json' }
})

const app = flite()

app.get('/ping', () => jsonResponse({ ok: true }))
app.get('/users/:id', req => jsonResponse({ id: req.params.id }))

self.addEventListener('fetch', event => {
  event.respondWith((async () => {
    const res = await app.fetch(event.request)
    return res || fetch(event.request)
  })())
})
