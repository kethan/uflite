# 03 — Lite notes with global hooks

From the repository root: `bun install && bun run build`. Then:

```sh
cd examples/03-lite-notes && npm install && npm start
```

Bun with no HTTP adapter dependency. `flite` is imported from `uflite/lite`; `json`, `error`, `status` are imported from full `uflite` because lite does not export response helpers. `notes.js` is a plain in-memory module; lite does **not** implement `app.service()`. The before hooks time requests and validate POST via `req.clone()`, the after hook adds `x-duration-ms` and handles misses, and the error hook formats thrown 4xx/5xx errors. Full uflite adds the service registry and service lifecycle hooks.

```sh
curl -si localhost:3000/notes                                     # 200 [] and x-duration-ms
curl -s -X POST localhost:3000/notes -H 'content-type: application/json' -d '{"title":"  Hello  "}' # 201, id 1, title Hello
curl -s localhost:3000/notes/1                                    # note 1
curl -s -X PATCH localhost:3000/notes/1 -H 'content-type: application/json' -d '{"title":"Updated"}' # updated note
curl -s -X DELETE localhost:3000/notes/1                           # removed note
curl -si localhost:3000/notes/1                                   # 404 Note not found (error hook)
curl -si -X POST localhost:3000/notes -H 'content-type: application/json' -d '{}' # 400 title is required
curl -si localhost:3000/unknown                                   # 404 Route not found (after hook)
```

Data resets on restart; no external DB or credentials.

`index.js` exports a Fetch handler with `.then(json).catch(error)`; the lite after hook supplies 404 on misses.

`index.js` is a Fetch handler; `server.js` is a tiny `Bun.serve` runner. Neither Hono nor a Node HTTP adapter is installed.
