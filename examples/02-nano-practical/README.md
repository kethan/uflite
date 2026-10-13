# 02 — Nano middleware and mounted router

From the repository root: `bun install && bun run build`. Then:

```sh
cd examples/02-nano-practical && npm install && npm start
```

Bun and the local `uflite` package are required. `flite` comes from `uflite/nano`; `json`/`error` come from full `uflite`. The `tasks` router is mounted at `/api` and registers `use('/tasks/*', guard)` **before** its routes. In default mode 0, nano visits matching handlers in order until one returns a non-null value. It does not have global before/after/error hooks, services, events, or channels. All data resets on restart.

```sh
curl -si localhost:3000/api/tasks                                    # 401 Missing API key
curl -s localhost:3000/api/tasks -H 'x-api-key: demo-key'             # [{"id":"1","title":"Review PR","done":false}]
curl -s 'localhost:3000/api/tasks?done=false' -H 'x-api-key: demo-key' # same list
curl -s localhost:3000/api/tasks/1 -H 'x-api-key: demo-key'           # task 1
curl -s -X POST localhost:3000/api/tasks -H 'x-api-key: demo-key' -H 'content-type: application/json' -d '{"title":"Review tests"}' # 201, id 2
curl -si 'localhost:3000/api/tasks?done=maybe' -H 'x-api-key: demo-key' # 400
curl -si localhost:3000/api/nope                                     # 404
```

The shared `demo-key` is for learning only. Production auth needs a trusted identity, protected credentials, and appropriate rate limiting.

The exported Fetch handler also uses `.then(json).catch(error)`; the final wildcard route supplies the 404 on misses.

`index.js` is a Fetch handler; `server.js` is a tiny `Bun.serve` runner. Neither Hono nor a Node HTTP adapter is installed.
