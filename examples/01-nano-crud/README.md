# 01 — Nano CRUD

From the repository root, run `bun install && bun run build`. Then:

```sh
cd examples/01-nano-crud
npm install
npm start                   # http://localhost:3000; PORT overrides the port
```

This standalone project installs the checked-out `uflite` package via `file:../..` and uses Node 22+ plus the optional `@hono/node-server` adapter. It imports `flite` from `uflite/nano` and `json`, `error`, `status` from `uflite` (helpers are **not** nano exports). Using full-package helpers increases bundle size; nano's router stays tiny. Data resets on restart.

```sh
curl -s localhost:3000/tasks                                      # []
curl -s -X POST localhost:3000/tasks -H 'content-type: application/json' -d '{"title":"Ship docs"}' # 201; {"id":"1","title":"Ship docs","done":false}
curl -s localhost:3000/tasks/1                                    # same task
curl -s -X PATCH localhost:3000/tasks/1 -H 'content-type: application/json' -d '{"title":"Ship examples","done":true}' # updated task
curl -s -X DELETE localhost:3000/tasks/1                          # removed task
curl -si localhost:3000/tasks/1                                   # 404 Task not found
curl -si -X POST localhost:3000/tasks -H 'content-type: application/json' -d '{}' # 400
curl -si localhost:3000/missing                                   # 404 Route not found
curl -si localhost:3000/test-error                                # 500 Internal Server Error (demo route)
```

`nano.fetch` returns handler values directly (or `undefined` for no match); the wrapper converts plain objects to JSON and catches thrown errors. Full `uflite` provides automatic formatting and missing/error handling without this wrapper. On 5xx the wrapper hides internal messages; customize it for your logging policy.
