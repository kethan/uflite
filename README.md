# uflite

**A small, Fetch-first router.** Use `nano` for routing, `lite` for request hooks, or the full
entry for response formatting, services, events, and channels. The core has **zero mandatory
runtime dependencies**.

[![Tests](https://github.com/kethan/uflite/actions/workflows/node.js.yml/badge.svg)](https://github.com/kethan/uflite/actions/workflows/node.js.yml) [![npm](https://img.shields.io/npm/v/uflite?style=flat-square)](https://www.npmjs.com/package/uflite) [![License: ISC](https://img.shields.io/badge/license-ISC-blue?style=flat-square)](#license-and-contributing)

## Contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [Build a REST API](#build-a-rest-api)
- [Choose an entry point](#choose-an-entry-point)
- [Features](#features)
  - [Routing and hooks](#routing-and-hooks)
  - [Services and optional integrations](#services-and-optional-integrations)
- [Five runnable examples](#five-runnable-examples)
- [Advanced usage](#advanced-usage)
- [Fetch runtimes](#fetch-runtimes)
- [API reference](#api-reference)
- [Security and limitations](#security-and-limitations)
- [Development and bundle size](#development-and-bundle-size)
- [License and contributing](#license-and-contributing)

## Installation

```bash
bun add uflite
# Or, in another Fetch-compatible runtime:
npm install uflite
```

uflite uses Web `Request` and `Response`. It needs **no Hono or Node server adapter**; Bun
supplies the local HTTP server in the examples below. Database, authentication, and storage
integrations are opt-in—see [optional packages](#services-and-optional-integrations).

## Quick start

Make a tiny API with **two files**. Save this as `app.js`:

```js
import { flite, json } from 'uflite'

const app = flite()
app.get('/api/health', () => json({ ok: true }))

export default app
```

Start it with `server.js`:

```js
import app from './app.js'

Bun.serve({
  port: Number(Bun.env.PORT || 3000),
  hostname: '0.0.0.0',
  fetch: request => app.fetch(request)
})
```

```bash
bun server.js
curl -i http://localhost:3000/api/health
# HTTP/1.1 200 OK
# {"ok":true}
```

The full entry converts plain values to JSON and supplies a default 404. The `app.js` module
also has the Fetch handler shape expected by Workers; the Bun server file is only for local
HTTP.

## Build a REST API

For a small API without a database dependency, **replace `app.js`** with the following. The
in-memory `Map` is application data, not a uflite service. It resets when the server restarts.
Keep the same `server.js` above.

```js
import { flite, json, error, status } from 'uflite'

const tasks = new Map()
let nextId = 1

const app = flite({
  error: { all: [err => {
    const code = Number.isInteger(err?.status) &&
      err.status >= 400 && err.status <= 599 ? err.status : 500
    if (code >= 500) console.error(err) // log privately
    return error(code, code >= 500 ? 'Internal Server Error' : err.message)
  }] }
})

const find = id => {
  const task = tasks.get(id)
  if (!task) throw new status(404, 'Task not found')
  return task
}

const body = async request => {
  try { return await request.json() }
  catch { throw new status(400, 'Invalid JSON') }
}

const title = value => {
  if (typeof value !== 'string' || !value.trim())
    throw new status(400, 'title is required')
  return value.trim()
}

app.get('/api/tasks', request => {
  const done = request.query.done
  if (done !== undefined && done !== 'true' && done !== 'false')
    throw new status(400, 'done must be true or false')
  const list = [...tasks.values()]
  return json(done === undefined
    ? list
    : list.filter(task => task.done === (done === 'true')))
})

app.get('/api/tasks/:id', request => json(find(request.params.id)))

app.post('/api/tasks', async request => {
  const data = await body(request)
  const cleanTitle = title(data?.title)
  const task = { id: String(nextId++), title: cleanTitle, done: false }
  tasks.set(task.id, task)
  return json(task, {
    status: 201,
    headers: { location: `/api/tasks/${task.id}` }
  })
})

app.patch('/api/tasks/:id', async request => {
  const task = find(request.params.id)
  const data = await body(request)
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      !Object.keys(data).length ||
      Object.keys(data).some(key => !['title', 'done'].includes(key)))
    throw new status(400, 'Send title and/or done')
  const newTitle = 'title' in data ? title(data.title) : task.title
  const newDone = 'done' in data ? data.done : task.done
  if (typeof newDone !== 'boolean') throw new status(400, 'done must be boolean')
  Object.assign(task, { title: newTitle, done: newDone })
  return json(task)
})

app.delete('/api/tasks/:id', request => {
  tasks.delete(find(request.params.id).id)
  return new Response(null, { status: 204 })
})

export default app
```

| Method | Resource | This starter does |
| :--- | :--- | :--- |
| `GET` | `/api/tasks` | List; optional `?done=true` or `false` |
| `GET` | `/api/tasks/:id` | Get one task |
| `POST` | `/api/tasks` | Create; **201**, JSON and `Location` |
| `PATCH` | `/api/tasks/:id` | Change `title` and/or `done`; **200** |
| `DELETE` | `/api/tasks/:id` | Delete; **204**, no body |

Try it in another terminal after `bun server.js`:

```bash
curl http://localhost:3000/api/tasks
# []

curl -i -X POST http://localhost:3000/api/tasks \
  -H 'content-type: application/json' \
  -d '{"title":"Ship docs"}'
# 201 Created; Location: /api/tasks/1
# {"id":"1","title":"Ship docs","done":false}

curl http://localhost:3000/api/tasks/1
# {"id":"1","title":"Ship docs","done":false}

curl 'http://localhost:3000/api/tasks?done=false'
# [{"id":"1","title":"Ship docs","done":false}]

curl -X PATCH http://localhost:3000/api/tasks/1 \
  -H 'content-type: application/json' -d '{"done":true}'
# {"id":"1","title":"Ship docs","done":true}

curl -i -X DELETE http://localhost:3000/api/tasks/1
# 204 No Content
```

**Errors are JSON, too.** `POST` with `{}` returns 400
`{"status":400,"error":"title is required"}`. Reading `/api/tasks/999` returns 404
`{"status":404,"error":"Task not found"}`. Unmatched routes get the full entry's default 404.

The error hook logs unexpected exceptions and returns
`{"status":500,"error":"Internal Server Error"}` rather than revealing internals. To exercise
that path locally, temporarily add
`app.get('/api/demo-error', () => { throw new Error('private detail') })` before
`export default app`, then `curl -i http://localhost:3000/api/demo-error`. **Remove that
diagnostic route before deployment.**

This starter explicitly supports `done` filtering, **not pagination or sorting**. It does not
register `PUT`; use full [DBService](#dbservice) when replacement and database-backed
pagination are needed. The [Nano CRUD example](examples/01-nano-crud/README.md) shows the
lighter entry point with a similar in-memory API.

## Choose an entry point

| Import | Adds | Default unmatched result |
| :--- | :--- | :--- |
| `uflite/nano` | Small router and raw handler values | `undefined` |
| `uflite/lite` | Global request `before`/`after`/`error` hooks | `undefined` unless a hook responds |
| `uflite` | Formatting, 404/error defaults, services, events, channels | JSON 404 `Response` |

All three support route methods, `use`, mounting, custom matchers, and mode 0/1 handlers. Only
the **full** entry exports `json`, `text`, `html`, `error`, and `status`; importing these
helpers beside nano/lite increases their bundle. Nano/lite do not register services or
automatically format raw results.

The familiar nano learning pattern is:

```js
import { flite } from 'uflite/nano'
import { json, error } from 'uflite'

const router = flite()
router.get('/hello', () => ({ hello: 'world' }))
router.all('*', () => error(404, 'Not found'))

export default {
  fetch: (request, ...args) =>
    router.fetch(request, ...args).then(json).catch(error)
}
```

This `.catch(error)` **exposes thrown 5xx messages** and is for learning. Nano itself returns
`undefined` on a miss, hence the explicit fallback. For a deployed nano API, use the
[redacting wrapper](#production-safe-nano-errors) instead. Lite can handle errors with request
hooks; full has a default error hook, but **its 5xx messages are also not redacted**.

<details>
<summary>Production-safe nano error handling</summary>

### Production-safe nano errors

Replace the demo wrapper—not the router—with one that explicitly handles misses and logs
internal failures:

```js
import { json, error } from 'uflite'

export default {
  fetch: (request, ...args) => router.fetch(request, ...args)
    .then(value => value ?? error(404, 'Not found'))
    .then(json)
    .catch(err => {
      const code = Number.isInteger(err?.status) &&
        err.status >= 400 && err.status < 500 ? err.status : 500
      if (code === 500) {
        console.error('Request failed:', err)
        return error(500, 'Internal Server Error')
      }
      return error(code, err.message || 'Request rejected')
    })
}
```

Do not put secrets in deliberate 4xx errors, either. The runnable
[Nano example](examples/01-nano-crud/README.md) intentionally uses the introductory wrapper
and links back to this alternative.

</details>

## Features

Use only the layers you need: route requests, add request hooks, or register services and
in-process events. Optional adapters remain separate imports.

### Routing and hooks

`app.get('/api/tasks/:id', handler)` captures `request.params.id`. `request.query` is flat;
repeated nonempty keys usually become arrays. A leading empty value can be overwritten.
`app.use('/api', child)` mounts registered routes, while `app.use('/api/*', guard)` adds an
`ALL` middleware route before protected routes.

| | Mode 0 (default) | Mode 1 |
| :--- | :--- | :--- |
| Handler | `(request, ...args)` | `(request, ...args, next)` |
| Continuation | Next handler runs after `undefined`/`null` | Explicit `await next()` |

In mode 0, the first non-nullish route result stops dispatch. Mode 1 supports onion-style
logic; `next` is the **last** argument, including when a Fetch host supplies extra arguments.
Lite/full request hooks are `before: {all, get, ...}`, `after: {...}`, and `error: {...}`.
Their signatures differ from full **service hooks**, which receive a mutable service context.
See the [hook cookbook](docs/HOOK_SPEC.md) and
[worked hook recipes](docs/REAL_WORLD_HOOKS.md).

The compact route compiler treats regex punctuation in literal paths (for example `.`) as
regex syntax. Do not assume those characters are escaped. A custom `match({method,path})` may
return `{handlers,params?}`; nano then bypasses its built-in route loop, whereas lite/full
fall back to registered routes when the matcher has no handlers.
[Custom matcher tests](tests/hono-router.spec.js) cover optional Hono router integration.

### Services and optional integrations

Only `uflite` (full) has `app.service(name, implementation)`. Standard methods implemented on
a service automatically receive routes: `find` → `GET /name`, `get` → `GET /name/:id`,
`create` → `POST /name`, `update` → `PUT /name/:id`, `patch` → `PATCH /name/:id`, `remove` →
`DELETE /name/:id`. **Generated routes do not automatically authenticate callers.**

When a generated service call returns a value, POST/DELETE routes use `json` with the default
**200**, not automatic 201/204. Add an explicit route if your API requires different statuses.
Service routes pass the **flat** URL query as params; they do not build `params.query` for
DBService pagination. The starter above implements explicit HTTP statuses without changing the
service registry.

#### DBService

Install `umosql@0.3.1` only when you import `uflite/services/db`:

```bash
bun add umosql@0.3.1
```

```js
import { flite } from 'uflite'
import { createDBService } from 'uflite/services/db'

const app = flite()
const tasks = app.service('tasks', createDBService())

// Direct service call: DBService owns filtering, pagination and sorting.
const page = await tasks.find({
  query: { done: false, $limit: 5, $skip: 0, $sort: { title: 1 } }
})
// { total, limit, skip, data }
```

The default collection is isolated, in-memory, and lost on restart. Direct
`find({paginate:false})` returns an array instead of a page. `$limit:0` preserves the total
with empty data. A missing record throws with `code:404`, **not** HTTP `status:404`; the
default REST error response can therefore be 500. Map that error explicitly if your API
promises a 404. Do not claim that `GET /tasks?$limit=5` paginates until you add an HTTP query
adapter.

Other opt-in integrations:

- **Auth:** `uflite/services/auth` requires `better-auth` and an application-supplied
  compatible adapter (e.g. UMOSQL). [Example 04](examples/04-full-services/README.md) runs
  real signup/session flows.
- **ACL:** `uflite/services/acl` requires `uqry`; derive roles from trusted session state, not
  query strings.
- **Table schemas:** `uflite/services/table` requires a configured DDL-capable adapter, but no
  additional import dependency.
- **Local storage:** `uflite/services/localStorage` needs no AWS SDK. Guard raw
  `PUT /storage?key=...` and `GET /storage/download?key=...` routes. Local presign URLs are
  *not* authorization tokens.
- **S3-compatible storage:** `uflite/services/storage` requires `@aws-sdk/client-s3` and
  `@aws-sdk/s3-request-presigner`, even in its local mode. Use signed URLs for direct provider
  transfers; presigned PUT cannot enforce file size. Live S3 was not tested here.

The `uflite/services` barrel eagerly imports the DB **and** AWS SDK packages. Prefer
individual subpaths. The core still has no mandatory runtime packages.
[Factory signatures](docs/API_REFERENCE.md) and
[example 04](examples/04-full-services/README.md) show concrete configuration and
authorization.

## Five runnable examples

These independent projects use the **built checkout** via `file:../..`. From the repository
root, first run:

```bash
bun install
bun run build
```

Then choose a project, run `npm install && npm start` inside its directory, and follow its
README's tested `curl` sequence. Bun hosts each project without a Hono/Node adapter; `PORT`
changes the default port 3000.

- [01 — Nano CRUD](examples/01-nano-crud/README.md): validation, CRUD, and error wrapper.
- [02 — Nano practical](examples/02-nano-practical/README.md): filtering, API key, mounted
  router.
- [03 — Lite notes](examples/03-lite-notes/README.md): request hooks and a separate notes
  module.
- [04 — Full services](examples/04-full-services/README.md): DBService, real Better Auth, ACL,
  local storage; S3 is optional.
- [05 — Full lifecycle](examples/05-full-middleware-resolvers/README.md): middleware, service
  hooks, resolver, event.

**StackBlitz has not been tested.** A single example folder cannot currently resolve its
`file:../..` dependency without the entire built checkout; there are no unverified launch
links.

## Advanced usage

<details>
<summary>Service hooks, events and channels</summary>

A full service hook receives `{app,service,path,method,params,id?,data?,result?,error?}`, not
a Request. On success: app.before → service.before → implementation → service.after →
app.after → mutation event. Within before hooks `all` precedes the method; within after hooks
the method precedes `all`.

Implementation failures enter service.error.method → service.error.all → app.error.method →
app.error.all and are rethrown. Before/after-hook failures bypass **service** error hooks;
request-level hooks may handle a failed REST route. In mode 1, hooks must call `next()` to
continue. Async service `setup`/`teardown` are not awaited by registration/`app.teardown()`.

```js
import { flite, json } from 'uflite'

const app = flite()
app.on('ready', count => console.log(count))
app.emit('ready', 1)

// Supply an actual socket/connection when using channels.
const connection = { send: message => console.log(message) }
app.channel('updates').join(connection, { room: 'demo' })
app.channel('updates').send('created', { id: 1 })
app.get('/health', () => json({ ok: true }))
```

Events and channels are in-process, not WebSocket upgrades or cross-instance delivery.
[Example 05](examples/05-full-middleware-resolvers/README.md) shows the real service
lifecycle.

</details>

<details>
<summary>Middleware, nested routers and data helpers</summary>

`uflite/middlewares` offers request/response pairs such as `cors`/`corsAfter`,
`requestId`/`requestIdAfter`, and `rateLimit`/`rateLimitAfter`. A rate limit is process-local;
use a trusted `keyGenerator` and shared/upstream enforcement for distributed apps.
`bodyLimit` measures bytes, but still needs an upstream transport cap.

```js
import { flite, json } from 'uflite'
import { requestId, requestIdAfter } from 'uflite/middlewares'

const app = flite({
  before: { all: [request => requestId()(request)] },
  after: { all: [(res, req) => res?.headers ? requestIdAfter(res, req) : res] }
})
app.get('/health', () => json({ ok: true }))
```

The `request => ...` wrapper forwards only the Request: in mode 0, an extra host argument must
not be mistaken for an optional `next`. Mount a child with `app.use('/api/v1', child)`.
Transformers, predicates, and field resolvers are standalone helpers;
[example 05](examples/05-full-middleware-resolvers/index.js) uses them inside service hooks.
Full signatures and examples are in the [API reference](docs/API_REFERENCE.md) and
[hook cookbook](docs/HOOK_SPEC.md).

</details>

<details>
<summary>Custom matchers and browser routing</summary>

You can supply a `match({method,path})` callback instead of the built-in matcher. Normalize an
external router's result to `{handlers,params?}`. Hono's matcher integration is
[tested here](tests/hono-router.spec.js), but Hono is **not** a core dependency.

Nano can also return raw values for client-side routing. A browser needs a bundler or import
map for `uflite/nano`; render untrusted route params with `textContent`, not `innerHTML`.
Existing samples: [vanilla SPA](examples/browser-spa.js),
[React SPA](examples/browser-react.js), [service worker](examples/service-worker.js), and
[middleware](examples/example.middleware.js). These browser samples were not
HTTP-smoke-tested.

</details>

## Fetch runtimes

The exported full `app` has `fetch(request, ...args)`. Bun, Deno, and Workers can supply a
Fetch Request; only **Bun** is covered by the example HTTP smoke test. No HTTP adapter is
built into uflite.

- **Bun:** use the `Bun.serve` runner in [Quick start](#quick-start).
- **Cloudflare Workers:** export the full app as the module's default Fetch handler; bundle
  the project first.
- **Deno:** import from `npm:uflite`, then use `Deno.serve(request => app.fetch(request))`.
- **Node.js:** supply a Fetch-compatible HTTP adapter in *your application* if needed; uflite
  does not install one.
- **Hono:** if your app already uses it, `hono.all('*', c => app.fetch(c.req.raw))` forwards
  the raw Request. Hono and its Node server are optional application dependencies, not uflite
  requirements.

Test the actual deployment runtime: foreign `Response` implementations may not pass full's
`instanceof Response` formatter. `flite({format:false})` is appropriate **only** if every
route already returns a Response (as in [example 04](examples/04-full-services/index.js)).

## API reference

Common calls: `flite(config?)`, `app.get(path, ...handlers)`, `app.use(path?, ...handlers)`,
`app.fetch(request, ...args)`, `json(body, options?)`, `new status(code, message?)`, and (full
only) `app.service(name, implementation)`. See the
[complete, grouped public API reference](docs/API_REFERENCE.md) for export paths, helper
signatures, options, and return types.

For deeper hook behavior, keep the [hook specification](docs/HOOK_SPEC.md) and
[real-world hook recipes](docs/REAL_WORLD_HOOKS.md) alongside that reference.

## Security and limitations

- The full entry's **default** error hook returns `err.message`, including for 5xx. Install a
  redacting hook for production. The nano `.catch(error)` learning wrapper has the same
  disclosure risk.
- The route compiler is deliberately compact: literal regex punctuation such as `.` is
  interpreted as regex syntax.
- Authenticate and authorize generated REST routes and storage's raw upload/download routes. A
  local presign URL grants **no** authorization by itself. Storage's direct service calls need
  their own policy.
- In-memory DB, channels, and rate-limit counters are single-process. Persistent DB, a live S3
  provider, Workers, Deno, and browser UI have **not** been deployed in this test suite.
- The example projects depend on the built checkout through `file:../..`; **StackBlitz has not
  been verified**. No one-click launch link is claimed.

See [production readiness notes](PRODUCTION_READINESS_REVIEW.md) for additional release checks.

## Development and bundle size

From a repository checkout:

```bash
bun install --frozen-lockfile
bun run build
bun test
bun run test:types
bun run test:package
bun run test:examples
bun run bench:size
```

`test:examples` runs each project's documented `npm install` and `npm start`, then checks real
success and error HTTP requests. Build first so the local `file:../..` dependency has its
package entry points.

The size fixture is one browser-target, minified GET route returning a Response (Bun 1.4.3).
It is **not** an application size or throughput guarantee:

| Entry | Minified | Gzip |
| :--- | ---: | ---: |
| `uflite/nano` | 1,385 B | 799 B |
| `uflite/lite` | 2,470 B | 1,251 B |
| `uflite` | 6,134 B | 2,690 B |
| Hono 4.10.6 | 19,026 B | 7,623 B |
| itty-router 4.2.2 | 1,122 B | 689 B |

Importing full `json` beside nano adds to a consumer bundle; run the benchmark with your own
imports for a meaningful comparison.

## License and contributing

Package metadata identifies [Kethan Surana](https://github.com/kethan) as author and declares
**ISC**. A matching top-level license file still needs maintainer confirmation; third-party
texts are in [`licenses/`](licenses/). Report defects via
[GitHub issues](https://github.com/kethan/uflite/issues). Please run the build, tests, type
and package checks before contributing.

Inspired by [itty-router](https://github.com/kwhitley/itty-router), [Hono](https://hono.dev),
and [FeathersJS](https://feathersjs.com). Inspiration is not a runtime dependency.
