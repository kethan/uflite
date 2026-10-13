# 05 — Full service lifecycle and resolvers

From the repository root: `bun install && bun run build`. Then:

```sh
cd examples/05-full-middleware-resolvers && npm install && npm start
```

Bun with no HTTP adapter dependency. `uflite` supplies `flite/json/status`; middleware, hooks, transformers, resolvers and predicates use their exported subpaths. No DB, auth service, or external account required; the **demo-only** token is `demo-token`. Data resets on restart. Protect real tokens and use verified identities in production.

```sh
curl -si localhost:3000/items                                     # 401
curl -si localhost:3000/items -H 'authorization: Bearer demo-token' # 200 [] and X-Request-ID
curl -si -X POST localhost:3000/items -H 'authorization: Bearer demo-token' -H 'content-type: application/json' -d '{"name":"  apple  "}' # 200 {"id":"1","name":"apple","label":"APPLE"}
curl -s localhost:3000/items/1 -H 'authorization: Bearer demo-token' # item 1
curl -s localhost:3000/item-count -H 'authorization: Bearer demo-token' # {"count":1}
curl -si -X POST localhost:3000/items -H 'authorization: Bearer demo-token' -H 'content-type: application/json' -d '{}' # 400 missing name
curl -si localhost:3000/items/nope -H 'authorization: Bearer demo-token' # 404; service error hook logs
curl -s -X DELETE localhost:3000/items/1 -H 'authorization: Bearer demo-token' # removed item
```

Order: global request ID and bearer middleware → registered REST route → service `before.create` validation and name trimming → service method → `after.create` label using `fromPath('name')` → service `created` event → global after response header. The service's `count()` is a custom direct-call method exposed via `/item-count`. Mode 0 is used; hooks in mode 1 must call `next()` to continue.

`index.js` exports the Fetch handler; the tiny `server.js` wires it to `Bun.serve`. Neither Hono nor a Node HTTP adapter is installed.
