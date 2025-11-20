import { flite, json } from "uflite/lite"

const app = flite()

app.get("/ping", () => json({ ok: true }))
app.get("/users/:id", (req) => json({ id: req.params.id }))

self.addEventListener("fetch", (event) => {
  event.respondWith((async () => {
    const res = await app.fetch(event.request)
    return res || fetch(event.request)
  })())
})