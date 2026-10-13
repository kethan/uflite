# 01 — Nano CRUD

From the repository root, run `bun install && bun run build`. Then:

```bash
cd examples/01-nano-crud
npm install
npm start                   # bun server.js → http://localhost:3000; PORT overrides the port
```

This standalone project installs the checked-out `uflite` package via `file:../..` and uses
Bun (no HTTP adapter package). It imports `flite` from `uflite/nano` and `json`, `error`,
`status` from `uflite` (helpers are **not** nano exports). Using full-package helpers
increases bundle size; nano's router stays tiny. Data resets on restart.

```bash
curl -s localhost:3000/api/tasks # []

curl -si -X POST localhost:3000/api/tasks \
  -H 'content-type: application/json' -d '{"title":"Ship docs"}'
# 201; {"id":"1","title":"Ship docs","done":false}

curl -s localhost:3000/api/tasks/1 # same task
curl -s -X PATCH localhost:3000/api/tasks/1 \
  -H 'content-type: application/json' \
  -d '{"done":true}'
# {"id":"1","title":"Ship docs","done":true}
curl -si -X DELETE localhost:3000/api/tasks/1
# 200, {"id":"1","title":"Ship docs","done":true}

curl -si localhost:3000/api/tasks/1 # 404 Task not found
curl -si -X POST localhost:3000/api/tasks \
  -H 'content-type: application/json' -d '{}' # 400
curl -si localhost:3000/missing # 404 Route not found
curl -si localhost:3000/test-error # 500 Internal Server Error (demo route)
```

This example supports `GET /api/tasks`, `GET /api/tasks/:id`, JSON `POST` (201), partial
`PATCH` (200), and `DELETE` (200 with the removed resource). Invalid JSON, missing title on
create, invalid patch fields, and missing IDs produce 400/404 responses. It does not
implement `PUT`, pagination, or sorting.

`nano.fetch` returns handler values directly (or `undefined` for no match); the wrapper uses
`.then(json).catch(error)` to format plain objects and catch thrown errors. Full `uflite`
provides automatic formatting and missing/error handling without this wrapper. The exact
`.then(json).catch(error)` wrapper returns exception messages (including 5xx); for a
deployed app, replace it with the
[production-safe nano error policy](../../README.md#production-safe-nano-errors), which logs
internal errors privately and returns a generic 500. `router.all('*', ...)` supplies the
fallback because nano itself returns `undefined` on a miss.

`index.js` is a Fetch handler; `server.js` is a tiny `Bun.serve` runner. Neither Hono nor a Node HTTP adapter is installed.
