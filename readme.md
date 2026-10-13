# 🪶 μflite

**A byte-minded Fetch router that grows with your application.** Start with `nano`, add request hooks with `lite`, or use the full entry for response helpers, services, events and channels. **No mandatory runtime dependencies or HTTP adapter.**

[![Tests](https://github.com/kethan/uflite/actions/workflows/node.js.yml/badge.svg)](https://github.com/kethan/uflite/actions/workflows/node.js.yml) [![npm](https://img.shields.io/npm/v/uflite?style=flat-square)](https://www.npmjs.com/package/uflite) [![License: ISC](https://img.shields.io/badge/license-ISC-blue?style=flat-square)](#user-content-testing-security-and-license) [![Dependencies: 0](https://img.shields.io/badge/mandatory_dependencies-0-brightgreen?style=flat-square)](#user-content-install-and-optional-integrations)

| 🎯 Pick your size | 🪝 Keep control | 🧩 Add only what you use |
| :--- | :--- | :--- |
| Three independently importable entry points | Sequential or onion-style handlers, request and service hooks | Database, auth and storage are optional integrations |

> [!TIP]
> **Fastest start:** `bun add uflite` → copy the [Bun + Fetch quickstart](#user-content-quick-start-skeletons) → `bun server.js`. The same exported Fetch handler is usable in a Worker; Bun's server is a five-line convenience, not a uflite requirement.

<a id="contents"></a>
## 🧭 Contents

| Start here | Build an app | Reference & operations |
| :--- | :--- | :--- |
| [Choose an entry point](#user-content-choose-an-entry-point) | [Quick-start skeletons](#user-content-quick-start-skeletons) | [API at a glance](#user-content-api-at-a-glance) |
| [Size comparison](#user-content-size-comparison) | [Five tested examples](#user-content-five-runnable-examples) | [Runtime integrations](#user-content-runtime-adapters) |
| [Install & optional integrations](#user-content-install-and-optional-integrations) | [Practical patterns](#user-content-practical-patterns) | [Test, security & license](#user-content-testing-security-and-license) |
| [Routing, hooks & services](#user-content-routing-hooks-and-services) | [Browser SPA / React](#user-content-browser-routing) | [Custom matchers](#user-content-custom-matchers) |
| [Hook cookbook](docs/HOOK_SPEC.md) | [Worked hook recipes](docs/REAL_WORLD_HOOKS.md) | [Complete API reference](docs/API_REFERENCE.md) |

<a id="choose-an-entry-point"></a>
## 🎯 Choose an entry point

| Capability | `uflite/nano` | `uflite/lite` | `uflite` (full) |
| :--- | :---: | :---: | :---: |
| `flite`, HTTP routes, `use`, `fetch`, custom matcher | ✓ | ✓ | ✓ |
| Mode `0` sequential / mode `1` onion handlers | ✓ | ✓ | ✓ |
| Global request `before` / `after` / `error` hooks | — | ✓ | ✓ |
| Automatic JSON, default 404 and error handler | — | — | ✓ |
| Service registry, service hooks & REST routes | — | — | ✓ |
| In-process events & channels | — | — | ✓ |
| `json`, `text`, `html`, `error`, `status` helpers | — | — | ✓ |

```js
import { flite as nano } from 'uflite/nano' // routing only
import { flite as lite } from 'uflite/lite' // routing + global request hooks
import { flite, json, error } from 'uflite' // full features + response helpers
```

> [!IMPORTANT]
> `json` and `error` belong to **`uflite`**, not `uflite/nano` or `uflite/lite`. Importing the helpers from full alongside a nano/lite router works, but increases the bundle. For the smallest possible build, return native `Response` objects instead. Nano/lite return raw values or `undefined` on misses; only full formats responses and registers services.

<a id="size-comparison"></a>
## 📊 Size comparison

Measured with `bun run bench:size` (Bun **1.4.3**; browser-target, minified, bundled **one GET `/hello` route returning a Response**, then gzip):

| Entry | Minified | Gzip | What it includes |
| :--- | ---: | ---: | :--- |
| `uflite/nano` | **1,385 B** | **799 B** | Routing only |
| `uflite/lite` | **2,470 B** | **1,251 B** | Routing + request hooks |
| `uflite` | **6,134 B** | **2,690 B** | Full framework |
| `hono` 4.10.6 | 19,026 B | 7,623 B | Same one-route benchmark fixture |
| `itty-router` 4.2.2 | 1,122 B | 689 B | Same one-route benchmark fixture |

Nano is **110 B larger gzip** than itty-router in this fixture; lite/full are smaller than Hono. The comparisons are *benchmarks*, not dependencies or throughput claims. Importing full `json` into nano changes the resulting bundle. Reproduce with `bun run bench:size`; `bun run bench`, `bench:cmp`, `bench:mitata` and `bench:url` test other performance questions.

<a id="install-and-optional-integrations"></a>
## 📦 Install & optional integrations

```sh
bun add uflite       # use Bun.serve or export a Fetch handler
# or: npm install uflite  (on another Fetch-compatible runtime)
```

**No Hono, Node adapter or web server package is needed by uflite.** A Fetch runtime such as Bun, Cloudflare Workers or Deno supplies the HTTP host. The five local HTTP projects below run with Bun. Optional peer packages are installed **by your application** when used:

| Import | Install in your application | Why |
| :--- | :--- | :--- |
| `uflite`, `/nano`, `/lite`, `/middlewares`, `/hooks`, `/predicates`, `/transformers`, `/resolvers`, `/utils` | Nothing else | Core / standalone helpers |
| `uflite/services/db` | `umosql@0.3.1` | In-memory or supplied DB collection |
| `uflite/services/table`, `/localStorage` | Nothing else | Supply a table adapter / local directory |
| `uflite/services/auth` | `better-auth` and a compatible adapter (e.g. `umosql`) | Real authentication |
| `uflite/services/acl` | `uqry` | Permission-rule filtering |
| `uflite/services/storage` | `@aws-sdk/client-s3 @aws-sdk/s3-request-presigner` | Factory imports both even in local mode |
| `uflite/services` | `umosql` **and** both AWS packages | Eager DB + storage barrel; prefer individual subpaths |

`better-auth` and `uqry` are imported separately, not by the services barrel. Import paths and signatures are indexed [in the API reference](docs/API_REFERENCE.md).

<a id="quick-start-skeletons"></a>
## 🚀 Quick-start skeletons

**The Fetch handler is the app.** This is the introductory **nano** pattern for formatting plain handler values and catching errors; `json` and `error` are imported from full `uflite`:

```js
export default {
  fetch: (request, ...args) =>
    router
      .fetch(request, ...args)
      .then(json)
      .catch(error)
}
```

This wrapper is for **learning nano**, not production error policy. Nano returns `undefined` on a miss, so `json(undefined)` is also `undefined`: register a last `all('*', () => error(404, 'Not found'))` route or supply an explicit fallback. `.catch(error)` reflects thrown error messages even on 500. Lite has configurable request hooks for errors and misses; full has built-in formatting, fallback and an error hook. Neither needs this nano wrapper. A [safe nano wrapper](#user-content-production-safe-nano-errors) appears below.

### 1 · Worker-ready nano Fetch module

Save as `index.js` after `bun add uflite` (or install `uflite` in your Worker project). This module itself uses no Bun or Hono APIs:

```js
import { flite } from 'uflite/nano'
import { json, error } from 'uflite'

const router = flite()
router.get('/hello/:name', req => ({ hello: req.params.name }))
router.all('*', () => error(404, 'Not found'))

export default {
  fetch: (request, ...args) =>
    router.fetch(request, ...args).then(json).catch(error)
}
```

<a id="production-safe-nano-errors"></a>
### Production-safe nano error policy

For a deployed nano app, **replace** the introductory wrapper (do not use both defaults). This version guarantees a Response for unmatched routes, logs internal failures on the server, keeps deliberate 4xx messages, and never sends a 5xx exception message to the client:

```js
import { json, error } from 'uflite'
// router is the nano instance with your routes registered above.
export default {
  fetch: (request, ...args) => router.fetch(request, ...args)
    .then(value => value ?? error(404, 'Not found'))
    .then(json)
    .catch(err => {
      const code = Number.isInteger(err?.status) && err.status >= 400 && err.status < 500
        ? err.status : 500
      if (code === 500) {
        console.error('Request failed:', err) // server-side log; configure your logger
        return error(500, 'Internal Server Error')
      }
      return error(code, err.message || 'Request rejected')
    })
}
```

The 404 is explicit: nano has **no** built-in missing-route handler. Do not put sensitive data in deliberate 4xx messages either. A configured request error hook is the equivalent customization for lite/full; the full entry's **default** error hook exposes 5xx messages unless you replace it.

### 2 · Bun — serve that same module

For **any** exported handler here, use a separate tiny `server.js` (Bun auto-serves a default `{ fetch }` from a CLI entrypoint, so do not call `Bun.serve` again *inside* `index.js`):

```js
import app from './index.js'

Bun.serve({
  port: Number(Bun.env.PORT || 3000),
  fetch: request => app.fetch(request)
})
```

Run `bun server.js` and `curl localhost:3000/hello/Ada` → `{"hello":"Ada"}`; `GET /missing` → JSON 404. `index.js` can instead be exported directly as the module Worker handler without the Bun file.

### 3 · Lite — global before/after request hooks

Replace the nano import and route configuration in `index.js` with this (use the same `server.js` for Bun):

```js
import { flite } from 'uflite/lite'
import { json, error } from 'uflite'

const router = flite({
  before: { all: [req => { req.started = Date.now() }] },
  after: { all: [(response, req) => {
    response?.headers?.set('x-time-ms', String(Date.now() - req.started))
    return response
  }] }
})
router.get('/notes', () => json([{ id: '1', text: 'Hello' }]))
router.all('*', () => error(404, 'Not found'))
export default router // lite has its own request hook pipeline; no nano wrapper needed
```

`curl -i localhost:3000/notes` → JSON plus `x-time-ms`. Lite has **global request hooks**, not a service registry. Use [example 03](examples/03-lite-notes/README.md) for CRUD, error hooks, and a separate notes module.

### 4 · Full — in-memory DBService (optional `umosql`)

After `bun add uflite umosql@0.3.1`, save this as `index.js` and use the same Bun `server.js`. The service automatically creates REST routes; no second CRUD implementation is needed:

```js
import { flite, status } from 'uflite'
import { createDBService } from 'uflite/services/db'

const router = flite()
const tasks = router.service('tasks', createDBService())
tasks.hooks({ before: { create: [ctx => {
  if (!ctx.data?.title) throw new status(400, 'title is required')
}] } })
// Local learning only: authenticate these generated routes before exposing real data.
export default router // full already formats values and handles missing/error responses
```

`curl -X POST localhost:3000/tasks -H 'content-type: application/json' -d '{"title":"Ship it"}'` creates a record; `curl localhost:3000/tasks` lists it. For **real Better Auth sessions, ACL and storage**, use [example 04](examples/04-full-services/README.md); it is tested end-to-end with Bun and never installs an HTTP adapter.

<a id="five-runnable-examples"></a>
## 🧪 Five runnable examples

In a checkout, first run **`bun install && bun run build`** at the root. Each project has its own `package.json`, uses `file:../..` for the built checkout, and has documented `curl` success/error flows. Each exports a Fetch handler from `index.js`; its tiny `server.js` calls `Bun.serve` on port 3000 (`PORT` overrides it). **None installs Hono or a Node adapter.**

| Project | Learn by doing | Run from repository root |
| :--- | :--- | :--- |
| [01 · Nano CRUD](examples/01-nano-crud/README.md) | In-memory CRUD, wrapper, 400/404/500 | `cd examples/01-nano-crud && npm install && npm start` |
| [02 · Nano practical](examples/02-nano-practical/README.md) | Query filters, API key, mounted router, `use` | `cd examples/02-nano-practical && npm install && npm start` |
| [03 · Lite notes](examples/03-lite-notes/README.md) | Before/after/error hooks, separate notes module | `cd examples/03-lite-notes && npm install && npm start` |
| [04 · Full services](examples/04-full-services/README.md) | DBService, Better Auth, ACL, local / optional S3 storage | `cd examples/04-full-services && npm install && npm start` |
| [05 · Full lifecycle](examples/05-full-middleware-resolvers/README.md) | HTTP middleware → service hooks → resolver → event | `cd examples/05-full-middleware-resolvers && npm install && npm start` |

> [!NOTE]
> **StackBlitz:** these local projects depend on `file:../..` and a built checkout. No StackBlitz run or standalone-folder import has been verified; there are no fabricated launch links. Replace the local dependency with a published version only after verifying the exact example on StackBlitz.

<a id="routing-hooks-and-services"></a>
## 🏗️ Routing, hooks & services

```text
Request → nano router (route matching / handlers)
            └─ lite (global before → route → after / error)
                 └─ full (format / missing + services + events + channels)
```

**Routes.** `app.get('/tasks/:id', req => json({ id: req.params.id, tag: req.query.tag }))` matches a segment; `req.query` is flat; repeated keys with a nonempty first value become arrays (a leading empty value can be overwritten). `app.get('/files/*', ...)` matches descendants. `app.use('/api', child)` mounts registered child routes; `app.use('/api/*', handler)` adds an ALL middleware route (register guards **before** protected routes). A `match({method,path})` callback may return `{handlers,params?}` instead of registered lookup. The deliberately compact route compiler treats literal regexp punctuation such as `.` as regex syntax; it **does not escape** literal paths.

**Two execution modes.** Handler args start with the Web Request (`req.params`, `req.query`), followed by any adapter args. Mode 1's `next` comes **last**.

| | `mode: 0` (default) | `mode: 1` |
| :--- | :--- | :--- |
| Handler | `(req, ...adapterArgs) => value` | `(req, ...adapterArgs, next) => value` |
| Flow | First non-nullish result stops the chain | Explicit `await next()` for onion-style traversal |
| Typical use | Small REST endpoints | Pre/post logic around downstream handlers |

```js
import { flite, json } from 'uflite'
const app = flite({ mode: 1 })
app.get('/private',
  async (req, next) => {
    if (!req.headers.get('authorization')) return json({ error: 'Unauthorized' }, { status: 401 })
    await next()  // run the next handler; code here runs on the way back
  },
  () => json({ secret: 'only with an auth header' })
)
// Direct invocation: await app.fetch(new Request('https://example.test/private'))
```

**Request hooks** (lite/full) accept `{ before: {all, get, post, ...}, after: {...}, error: {...} }` in `flite`. `before` receives `req`, `after` receives `(result, req)`, `error` receives `(err, req)`; each can access adapter args. They are **not** service-context hooks.

**Service hooks** (full only) use `app.service(name, implementation)` and `service.hooks({before,after,error})` or `app.hooks(...)`. A service hook receives mutable `{app,service,path,method,params,id?,data?,result?,error?}`. On success: app.before.all → app.before.method → service.before.all → service.before.method → implementation → service.after.method → service.after.all → app.after.method → app.after.all. Implementation exceptions enter service.error.method → service.error.all → app.error.method → app.error.all, then rethrow; these hooks observe errors, they do not recover the call. Failures in **before or after hooks** bypass the service error hooks (though request-level error hooks can handle a rejected REST request). In mode 1 each hook must call `next()` for the next hook to run, including error hooks. `created`, `updated`, `patched`, `removed` events fire on successful mutations. `setup` at registration and `app.teardown()` do **not await** async lifecycle operations.

Only implemented standard service methods auto-register REST routes (`GET /name`, `GET /name/:id`, `POST /name`, `PUT /name/:id`, `PATCH /name/:id`, `DELETE /name/:id`); custom methods are direct-call only unless you write a route. **Protect generated routes** before registration if data is sensitive. See [example 05](examples/05-full-middleware-resolvers/index.js) for a complete lifecycle.

<a id="practical-patterns"></a>
## 🧰 Practical patterns

These restore the original README's **mounted routers, middleware, service lifecycle, custom matcher and storage recipes**, with imports corrected to the real exports. They are independent patterns, not mandatory layers.

### Response helpers · no `Response.json` needed

```js
import { flite, json, text, html, error, status } from 'uflite'
const app = flite()
app.get('/json', () => json({ ok: true }, { status: 201 }))
app.get('/text', () => text('Hello'))
app.get('/html', () => html('<strong>Hello</strong>'))
app.get('/missing', () => error(404, 'Not found'))
app.get('/private', () => { throw new status(401, 'Sign in first') })
```

Full uflite also converts plain objects to JSON and supplies its own unmatched-route 404. Nano needs an explicit formatter or wrapper when handlers return plain values; lite can use its `after` hook for formatting (or explicitly return `json(...)`). Returning a `Response` from `json` is safe to pass through `json` again; a 5xx `error` response can reveal its original message.

### Global request hooks · before / after / error

```js
import { flite } from 'uflite/lite'
import { json, error } from 'uflite'
const router = flite({
  before: { all: [req => { req.startedAt = Date.now() }] },
  after: { all: [(response, req) => {
    response?.headers.set('x-duration-ms', String(Date.now() - req.startedAt))
    return response
  }] },
  error: { all: [err => error(err.status || 500, err.message)] }
})
router.get('/health', () => json({ ok: true }))
```

Request hooks receive a Request or Response, **not** a service context. A custom error hook replaces the default in full; this sample preserves error messages to demonstrate the API, not as production redaction policy. The [lite notes app](examples/03-lite-notes/index.js) shows CRUD and 4xx/5xx handling.

### Nested routers · versioned APIs

```js
import { flite } from 'uflite/nano'
import { json, error } from 'uflite'
const v1 = flite().get('/users', () => [{ id: 1 }])
const v2 = flite().get('/users', () => [{ id: 1, name: 'Ada' }])
const router = flite()
router.use('/api/v1', v1).use('/api/v2', v2)
router.all('*', () => error(404, 'Not found'))
export default { fetch: (request, ...args) => router.fetch(request, ...args).then(json).catch(error) }
// /api/v1/users and /api/v2/users; tested mounting also in example 02
```

### Middleware templates · mode 1 and paired phases

```js
import { flite, json } from 'uflite'
import { cors, corsAfter, requestId, requestIdAfter } from 'uflite/middlewares'
const router = flite({ mode: 1,
  before: { all: [cors({ origin: 'https://app.example' }), requestId()] },
  after: { all: [corsAfter, requestIdAfter] }
})
router.get('/health', () => json({ ok: true }))
// Supply a verified auth identity and your own CORS policy before exposing real data.
```

For your own mode-1 middleware: `(req, next) => { /* before */ await next(); /* after */ }`. For cross-phase data in separate before/after hooks, store metadata in a `WeakMap` keyed by the Request rather than trusting client headers. HTTP middleware is **not** the same as service hooks. See [middleware option signatures](docs/API_REFERENCE.md).

### Service hooks, events and custom methods

```js
import { flite, json, status } from 'uflite'
const app = flite()
const rows = []
const users = app.service('users', {
  async find() { return rows },
  async create(data) { const user = { id: String(rows.length + 1), ...data }; rows.push(user); return user },
  async count() { return rows.length } // direct-call only; no generated /users/count
})
app.hooks({ before: { all: [ctx => console.log(ctx.method, ctx.path)] } })
users.hooks({
  before: { create: [ctx => { if (!ctx.data?.name) throw new status(400, 'name required') }] },
  after: { create: [ctx => { ctx.result.label = ctx.result.name.toUpperCase() }] }
})
users.on('created', user => console.log('created', user.id))
app.get('/user-count', async () => json({ count: await users.count() }))
```

`POST /users` calls the standard `create`; `users.count()` is hookable but not auto-routed, so `/user-count` is explicit. Before-hooks, implementation, after-hooks, then the `created` event run in that order; generated service HTTP routes need access control. [Example 05](examples/05-full-middleware-resolvers/index.js) combines this with resolvers and predicates.

### Database, schema and auth adapters

```js
import { createDBService } from 'uflite/services/db'      // bun add umosql@0.3.1
import { createTableService } from 'uflite/services/table' // supply a real DDL-capable adapter
import { createAuth } from 'uflite/services/auth'         // bun add better-auth umosql@0.3.1
import { createACL } from 'uflite/services/acl'           // bun add uqry
import { createSchemalessAdapter } from 'umosql/schemaless'

const tasks = createDBService() // isolated memory; not persistent
// app.service('tasks', createDBService(() => database.collection('tasks'))) // supply your database
// const tables = createTableService(dbAdapter) // requires listCollections/getTableSchema/createTableWithSchema/dropCollection
const { adapter } = createSchemalessAdapter(undefined, 'memory')
const auth = await createAuth({ adapter, baseURL: 'http://localhost:3000', secret: Bun.env.AUTH_SECRET })
const acl = createACL({ enabled: true, rules: [{ id: 'members', permissions: ['member:tasks:find'] }] })
// Mount auth.handler(request) at /api/auth/*; use auth.api.getSession({headers:req.headers})
// and a trusted role before calling acl.can({user:session.user}, 'member:tasks:find').
```

The snippet above is **wiring**, not a standalone server: `tasks`, `auth` and `acl` need protected routes. Set a real secret; the [runnable full example](examples/04-full-services/index.js) includes the session guard, ACL hook and HTTP verification. UMOSQL memory resets on restart. DBService REST passes flat query params while its direct `find({query:{$limit,$skip}})` expects nested `query`; missing-record errors set `code:404`, not HTTP `status`.

### Local storage and optional S3

```js
import { createLocalStorageService } from 'uflite/services/localStorage' // no AWS SDK
const local = createLocalStorageService({ basePath: './uploads', maxFileSize: 1024 * 1024 })
// app.service('storage', local) // protect raw upload/download routes first

// S3-compatible provider (install both @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner):
import { createStorageService } from 'uflite/services/storage'
const s3 = createStorageService({ type: 's3', bucket: 'uploads', region: 'us-east-1',
  endpoint: 'http://localhost:9000', // omit for AWS S3
  accessKeyId: Bun.env.S3_ACCESS_KEY_ID, secretAccessKey: Bun.env.S3_SECRET_ACCESS_KEY })
```

Local storage's raw routes include `PUT /storage?key=folder/file.txt` and `GET /storage/download?key=folder/file.txt`. S3: `POST /storage/presign` with `{key,contentType}` returns a signed PUT URL and headers; `POST /storage/presign-download` with `{key}` signs a GET. Configure bucket CORS. Signed PUT does not enforce file size; local presign URLs are **not** authorization tokens. Restrict both HTTP and direct service access. [Example 04](examples/04-full-services/README.md) runs local storage by default.

<a id="api-at-a-glance"></a>
## 📖 API at a glance

| Entry | Constructor | `fetch()` on a miss | Features |
| :--- | :--- | :--- | :--- |
| `uflite/nano` | `flite({ routes?, mode?, match? }?)` | `Promise<undefined>` | Matching and raw handler results |
| `uflite/lite` | `flite({ routes?, mode?, match?, before?, after?, error? }?)` | `Promise<undefined>` unless an after hook supplies a value | Global **request** hooks, no services |
| `uflite` | `flite({ ..., format?, missing?, error? }?)` | JSON 404 `Response` by default | JSON formatting, services, in-process events and channels |

Routes: `app.get/post/put/patch/delete/head/options/all(path, ...handlers)`, `app.use(path?, ...handlersOrRouters)` and `app.fetch(request, ...args)`. Mode 0 handlers receive `(request, ...adapterArgs)` and stop on a non-nullish result; mode 1 receives `(request, ...adapterArgs, next)` and requires `await next()` to continue. `json(body, options?)`, `text`, `html`, `error(code, message?)` and `new status(code, message?)` are exported from **full** `uflite`. Full's default error hook returns `err.message`, even for 5xx.

Full-only `app.service(name, implementation)` exposes standard `find/get/create/update/patch/remove` methods and auto-routes **only implemented** methods. Hooks are registered with `service.hooks({before?,after?,error?})` or `app.hooks(...)`. Service hook context, ordering, factory options, HTTP middleware signatures, all predicate/transformer/resolver exports, channel methods and package subpaths are in the **[complete API reference](docs/API_REFERENCE.md)**. For hook recipes and error configuration, see [HOOK_SPEC](docs/HOOK_SPEC.md) and [REAL_WORLD_HOOKS](docs/REAL_WORLD_HOOKS.md).

<a id="custom-matchers"></a>
## 🔌 Custom matchers (optional)

`flite({ match: ({method,path}) => ({handlers,params?}) })` lets you use another matcher without replacing uflite's hook runner. **No external router is necessary**; the built-in matcher is the default. As in the original README, Hono's PatternRouter is one optional example (install `hono` yourself):

```js
import { PatternRouter } from 'hono/router/pattern-router'
import { flite } from 'uflite'
const external = new PatternRouter()
external.add('GET', '/users/:id', req => ({ id: req.params.id }))
const router = flite({ match: ({ method, path }) => {
  const [matches, stash = []] = external.match(method, path)
  if (!matches.length) return null
  return { handlers: matches.map(([handler, params = {}]) => req => {
    req.params = Object.fromEntries(Object.entries(params).map(([key, value]) =>
      [key, typeof value === 'number' ? stash[value] : value]))
    return handler(req)
  }) }
} })
export default router // full formats the matcher result and supplies a 404
```

This normalization is verified for Hono 4's PatternRouter, RegExpRouter and TrieRouter in [matcher tests](tests/hono-router.spec.js); their internal match shapes may change with Hono versions. `trouter`/`itty-router` can also be adapted to the same `{handlers,params?}` contract. The `match` option does **not** make Hono a dependency.

<a id="browser-routing"></a>
## 🖥️ Browser SPA and React routing

The original README showed client-side routing; it is **not** server-side rendering or a Fetch HTTP server. Use a bundler (Vite, Bun build, etc.) or an import map to resolve bare `uflite/...` imports in the browser. These are small `main.js` examples, not untested copy-paste raw `<script>` imports.

**Vanilla browser SPA:** nano can return data rather than a Response. Render untrusted route params with `textContent`, not `innerHTML`.

```js
// main.js, bundled for a page containing <div id="root"></div>
import { flite } from 'uflite/nano'
const router = flite()
router.get('/', () => ({ title: 'Home' }))
router.get('/user/:id', req => ({ title: 'User ' + req.params.id }))
const root = document.querySelector('#root')
async function render() {
  const view = await router.fetch(new Request(location.href))
  const heading = document.createElement('h1')
  heading.textContent = view?.title ?? 'Not found'
  const link = document.createElement('a')
  link.href = location.pathname === '/' ? '/user/42' : '/'
  link.textContent = location.pathname === '/' ? 'Go to user' : 'Home'
  root.replaceChildren(heading, link)
}
document.addEventListener('click', event => {
  const a = event.target.closest('a')
  if (!a || a.origin !== location.origin || event.defaultPrevented || event.button !== 0 ||
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  history.pushState(null, '', a.href)
  render()
})
window.addEventListener('popstate', render)
render()
```

**React SPA:** install `react` and `react-dom` in *your app* (`npm install uflite react react-dom`) and bundle `main.jsx`. Create the React root **once**, not on every navigation.

```jsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import { flite } from 'uflite/nano'
const router = flite()
router.get('/', () => ({ title: 'Home', next: '/user/42' }))
router.get('/user/:id', req => ({ title: `User ${req.params.id}`, next: '/' }))
const root = createRoot(document.getElementById('root'))
const go = path => { history.pushState(null, '', path); render() }
async function render() {
  const view = await router.fetch(new Request(location.href))
  root.render(<main><h1>{view?.title ?? 'Not found'}</h1>
    <a href={view?.next ?? '/'} onClick={event => {
      event.preventDefault(); go(event.currentTarget.getAttribute('href'))
    }}>Navigate</a></main>)
}
window.addEventListener('popstate', render)
render()
```

Browser examples are illustrative, not part of the HTTP smoke test. Existing repository samples: [vanilla](examples/browser-spa.js), [React](examples/browser-react.js), [service worker](examples/service-worker.js), and [middleware](examples/example.middleware.js).

<a id="runtime-adapters"></a>
## 🌐 Fetch runtimes & optional integrations

The exported Fetch handler **is enough** for Workers; Bun and Deno can call it directly. Only the Bun projects are HTTP-smoke-tested in this repository. No HTTP adapter belongs to the core package:

| Runtime | Minimal integration | Additional package |
| :--- | :--- | :--- |
| Cloudflare Workers | `export default router` for full; nano can use the [introductory Fetch wrapper](#user-content-quick-start-skeletons) | None (bundle your code) |
| Bun | `Bun.serve({fetch: request => handler.fetch(request),port:3000})` | None |
| Deno | `Deno.serve(request => handler.fetch(request))` (import from `npm:uflite`) | None |
| Hono composition | `hono.all('*', c => handler.fetch(c.req.raw))` | `hono` in **your** app |
| Node | Provide a Fetch-compatible server/adapter of your choice | Adapter in **your** app only |

**Hono is an optional combination**, not the uflite server and not part of any quickstart. If your app *already uses Hono*, you can forward its raw Request:

```js
// Only for apps that choose Hono (npm install hono).
import { Hono } from 'hono'
import { flite } from 'uflite'
const router = flite()
router.get('/hello', () => ({ hello: 'uflite' }))
const hono = new Hono()
hono.all('*', c => router.fetch(c.req.raw))
export default hono
```

Hono on Node may itself use `@hono/node-server`, but that is **Hono/Node application wiring**, never a uflite requirement. For mode 1, be careful when a host passes extra `fetch` arguments: `next` is last. The full formatter uses `instanceof Response`; with a foreign Response implementation it can serialize a Response to `{}`. Only use `flite({format:false})` when routes already return Responses, and test the host you deploy.

<a id="testing-security-and-license"></a>
## 🛡️ Testing, security & license

```sh
bun install --frozen-lockfile
bun run build          # dist is required before package/example checks
bun test               # unit/integration tests
bun run test:types     # public NodeNext declarations + middleware
bun run test:package   # packed ESM, CommonJS, TypeScript consumers
bun run test:examples  # installs/starts five Bun projects; tests success and error HTTP flows
bun run bench:size     # reproduce the size table for this toolchain
```

A tiny `bun:test` example, using the Fetch handler without starting a server:

```js
import { test, expect } from 'bun:test'
import { flite, json } from 'uflite'
test('GET /users/:id', async () => {
  const router = flite().get('/users/:id', req => json({ id: req.params.id }))
  const response = await router.fetch(new Request('https://example.test/users/42'))
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ id: '42' })
})
```

> [!WARNING]
> **Production defaults are intentionally small, not a security policy.** Full's default error hook includes `err.message` even for 5xx; install an error hook that redacts internal details. The compact compiler interprets regex punctuation in paths. Generated service REST endpoints need authentication and authorization. Never trust user-controlled query params as an authenticated identity.

- **Database:** an in-memory DBService is not durable; missing records have `code:404` but not HTTP `status:404`. REST queries are flat, so `$limit` is not automatically nested for DBService pagination.
- **Storage:** local URLs are not authorization tokens. Keep a trusted, private directory; protect raw upload/download routes. For S3 configure provider credentials/CORS and understand that signed PUT does not enforce upload size.
- **Rate/body limits:** process-local rate limiting needs a trusted key and shared/upstream enforcement for multiple instances; body limits need an upstream transport cap.
- **Runtime gaps:** persistent DB, S3 provider, Workers, Deno and browser UI were not deployed in these tests. See the [production follow-up](PRODUCTION_READINESS_REVIEW.md).
- **Contributing:** add regression tests for behavior changes, run the commands above and review optional-integration imports. File defects in [GitHub issues](https://github.com/kethan/uflite/issues).
- **Maintainer & license:** package metadata names [Kethan Surana](https://github.com/kethan) and declares **ISC**. A matching top-level license file still needs maintainer confirmation; third-party license texts are under [`licenses/`](licenses/).
- **Acknowledgments:** inspired by [itty-router](https://github.com/kwhitley/itty-router) (routing), [Hono](https://hono.dev) (middleware ideas) and [FeathersJS](https://feathersjs.com) (services). Inspiration is not a runtime dependency.
