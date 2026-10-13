# 01 — Nano CRUD

From the repository root, run `bun install && bun run build`. Then:

```sh
cd examples/01-nano-crud
npm install
npm start                   # bun server.js → http://localhost:3000; PORT overrides the port
```

This standalone project installs the checked-out `uflite` package via `file:../..` and uses Bun (no HTTP adapter package). It imports `flite` from `uflite/nano` and `json`, `error`, `status` from `uflite` (helpers are **not** nano exports). Using full-package helpers increases bundle size; nano's router stays tiny. Data resets on restart.

```bash
curl -s localhost:3000/tasks # []

curl -si -X POST localhost:3000/tasks \
  -H 'content-type: application/json' -d '{"title":"Ship docs"}'
# 201; {"id":"1","title":"Ship docs","done":false}

curl -s localhost:3000/tasks/1 # same task
curl -s -X PATCH localhost:3000/tasks/1 \
  -H 'content-type: application/json' \
  -d '{"title":"Ship examples","done":true}' # updated task
curl -s -X DELETE localhost:3000/tasks/1 # removed task (200, body)

curl -si localhost:3000/tasks/1 # 404 Task not found
curl -si -X POST localhost:3000/tasks \
  -H 'content-type: application/json' -d '{}' # 400
curl -si localhost:3000/missing # 404 Route not found
curl -si localhost:3000/test-error # 500 Internal Server Error (demo route)
```

`nano.fetch` returns handler values directly (or `undefined` for no match); the wrapper uses `.then(json).catch(error)` to format plain objects and catch thrown errors. Full `uflite` provides automatic formatting and missing/error handling without this wrapper. The exact `.then(json).catch(error)` wrapper returns exception messages (including 5xx); for a deployed app, replace it with the [production-safe nano error policy](../../README.md#production-safe-nano-errors), which logs internal errors privately and returns a generic 500. `router.all('*', ...)` supplies the fallback because nano itself returns `undefined` on a miss.

`index.js` is a Fetch handler; `server.js` is a tiny `Bun.serve` runner. Neither Hono nor a Node HTTP adapter is installed.
