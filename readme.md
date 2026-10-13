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
| [Choose an entry point](#user-content-choose-an-entry-point) | [Quick-start skeletons](#user-content-quick-start-skeletons) | [Complete API signatures](#user-content-complete-api-signatures) |
| [Size comparison](#user-content-size-comparison) | [Five tested examples](#user-content-five-runnable-examples) | [Runtime integrations](#user-content-runtime-adapters) |
| [Install & optional integrations](#user-content-install-and-optional-integrations) | [Practical patterns](#user-content-practical-patterns) | [Test, security & license](#user-content-testing-security-and-license) |
| [Routing, hooks & services](#user-content-routing-hooks-and-services) | [Browser SPA / React](#user-content-browser-routing) | [Custom matchers](#user-content-custom-matchers) |

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

`better-auth` and `uqry` are imported separately, not by the services barrel. Import paths and signatures are indexed [below](#user-content-complete-api-signatures).

<a id="quick-start-skeletons"></a>
## 🚀 Quick-start skeletons

**The Fetch handler is the app.** This is the exact nano/lite pattern for formatting plain handler values and catching errors; `json` and `error` are imported from full `uflite`:

```js
export default {
  fetch: (request, ...args) =>
    router
      .fetch(request, ...args)
      .then(json)
      .catch(error)
}
```

On nano/lite, a miss resolves to `undefined`, so `json(undefined)` is also `undefined`: register a last `all('*', () => error(404, 'Not found'))` route or add your own fallback before returning from a real HTTP server. `.catch(error)` returns the **error message even for a 500**, so redact sensitive exceptions in production. Full already formats and handles errors, but can use the same wrapper when a uniform Fetch export is desired.

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

export default {
  fetch: (request, ...args) =>
    router.fetch(request, ...args).then(json).catch(error)
}
```

`curl -i localhost:3000/notes` → JSON plus `x-time-ms`. Lite has **global request hooks**, not a service registry. Use [example 03](examples/03-lite-notes/README.md) for CRUD, error hooks, and a separate notes module.

### 4 · Full — in-memory DBService (optional `umosql`)

After `bun add uflite umosql@0.3.1`, save this as `index.js` and use the same Bun `server.js`. The service automatically creates REST routes; no second CRUD implementation is needed:

```js
import { flite, json, error, status } from 'uflite'
import { createDBService } from 'uflite/services/db'

const router = flite()
const tasks = router.service('tasks', createDBService())
tasks.hooks({ before: { create: [ctx => {
  if (!ctx.data?.title) throw new status(400, 'title is required')
}] } })
// Local learning only: authenticate these generated routes before exposing real data.
export default {
  fetch: (request, ...args) =>
    router.fetch(request, ...args).then(json).catch(error)
}
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

**Routes.** `app.get('/tasks/:id', req => json({ id: req.params.id, tag: req.query.tag }))` matches a segment; `req.query` is a flat object and repeated keys become arrays. `app.get('/files/*', ...)` matches descendants. `app.use('/api', child)` mounts registered child routes; `app.use('/api/*', handler)` adds an ALL middleware route (register guards **before** protected routes). A `match({method,path})` callback may return `{handlers,params?}` instead of registered lookup. The deliberately compact route compiler treats literal regexp punctuation such as `.` as regex syntax; it **does not escape** literal paths.

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

**Service hooks** (full only) use `app.service(name, implementation)` and `service.hooks({before,after,error})` or `app.hooks(...)`. A service hook receives mutable `{app,service,path,method,params,id?,data?,result?,error?}`. On success: app.before.all → app.before.method → service.before.all → service.before.method → implementation → service.after.method → service.after.all → app.after.method → app.after.all. Implementation exceptions run service.error.method/all, then app.error.method/all, and rethrow; errors from *before* hooks bypass those method-error hooks. In mode 1 call `next()` to continue. `created`, `updated`, `patched`, `removed` events fire on successful mutations. `setup` at registration and `app.teardown()` do **not await** async lifecycle operations.

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

Full uflite also converts plain objects to JSON and supplies its own unmatched-route 404. Nano and lite need the explicit `.then(json).catch(error)` wrapper above when handlers return plain values. Returning a `Response` from `json` is safe to pass through `json` again; a 5xx `error` response can reveal its original message.

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

For your own mode-1 middleware: `(req, next) => { /* before */ await next(); /* after */ }`. For cross-phase data in separate before/after hooks, store metadata in a `WeakMap` keyed by the Request rather than trusting client headers. HTTP middleware is **not** the same as service hooks. See [middleware option signatures](#user-content-complete-api-signatures).

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

<a id="complete-api-signatures"></a>
## 📖 Complete API signatures

This is the **in-README reference for public package exports** (including helper subpaths). `?` means optional; `→` indicates a returned function or value. JavaScript signatures are intentionally compact; the linked [declaration files](src/index.d.ts) provide types. The examples above show real invocation, not invented entry points.

### Entry points · routes · hooks

| Import | Constructor | What `fetch` returns |
| :--- | :--- | :--- |
| `uflite/nano` | `flite({ routes?, mode?: 0 \| 1, match? }?)` | `Promise<raw value \| undefined>` (declaration narrows to Response) |
| `uflite/lite` | `flite({ routes?, mode?, match?, before?, after?, error? }?)` | Result after global request hooks, or `undefined` |
| `uflite` | `flite({ routes?, mode?, match?, before?, after?, error?, format?, missing? }?)` | Usually a Response; default 404/format/error hook |

Each entry point also exports **default `flite`**. `routes` can be supplied as the app's route array; nano exposes it on `app.routes` (lite/full inherit this property).

```text
app.get/post/put/patch/delete/head/options/all(path, ...handlers) → app
app.GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS/ALL(path, ...handlers) → app
app.use(handler | router) / app.use(path, ...handlersOrRouters) → app
app.fetch(request: Request, ...adapterArgs) → Promise<result | undefined>
app.routes → registered route tuples
match({ method, path }) → { handlers, params? } | undefined
run(mode?: 0 | 1)(...handlers)(...args) → Promise<result | undefined>  // full export
```

`before` / `after` / `error` are dictionaries keyed by `all` or a **lowercase HTTP method**. Their handlers are `(req, ...args)`, `(result, req, ...args)`, `(err, req, ...args)`. `format(result)` controls full auto-formatting (`false` disables it); `missing()` controls the full fallback. If custom full `error` hooks are supplied, they replace the default.

### Responses · `uflite`

| Export | Signature | Behavior |
| :--- | :--- | :--- |
| `response` | `response(contentType?, transform?)(body, options?) → Response \| undefined` | Type + optional body transform; defaults to text/plain |
| `text` | `text(body, options?) → Response \| undefined` | Text content type |
| `html` | `html(body, options?) → Response \| undefined` | HTML content type |
| `json` | `json(body, options?) → Response \| undefined` | JSON stringify; `json(undefined)` returns `undefined` |
| `error` | `error(statusCode, messageOrObject?) → Response` or `error(err: Error) → Response` | JSON `{status,error}` / object details |
| `status` | `new status(code, message?, data?) → Error` | Throw for status-aware full error handling |

`options` accepts Fetch `ResponseInit` fields such as `status` and `headers`. Response helpers pass an existing **same-realm** `Response` through. Full defaults to `error(err.status || 500, err.message)`, **including 5xx messages**. Install an application error hook to redact internal errors.

### HTTP middleware · `uflite/middlewares`

Request factories return `Middleware(request, next?) → Response | void | Promise<…>`; named companions are response-phase functions `(response, request, next?) → Response | Promise<Response>` for `after.all`. In mode 0, wrap optional-next middleware as `req => middleware(req)` if a Fetch host supplies extra arguments; otherwise it may mistake an environment/server value for `next` (see [example 05](examples/05-full-middleware-resolvers/index.js)).

| Factory signature | Main options | After companion |
| :--- | :--- | :--- |
| `cors({origin?,methods?,credentials?,maxAge?,allowedHeaders?,exposedHeaders?}?)` | Origin may be string, array or RegExp | `corsAfter` |
| `logger({format?,skip?}?)` | `format: 'dev' \| 'combined' \| 'json'`; `skip(req)` | `loggerAfter` |
| `rateLimit({windowMs?,max?,keyGenerator?,standardHeaders?}?)` | In-process limits; explicit trusted `keyGenerator(req)` | `rateLimitAfter` |
| `bearerAuth({token?,verify?,realm?}?)` | Static token or sync/async `verify(token)` | — |
| `basicAuth({users,realm?})` | Username→password record | — |
| `bodyLimit({max?}?)` | Number of bytes or size string e.g. `'10mb'` | — |
| `secureHeaders({contentSecurityPolicy?,xFrameOptions?,strictTransportSecurity?,xContentTypeOptions?,referrerPolicy?}?)` | Header policy | `secureHeadersAfter` |
| `requestId({header?,generator?}?)` | Request ID generation | `requestIdAfter` |

`rateLimit` uses one `unknown` bucket by default rather than trusting forwarded headers; use a trusted key and shared store for multi-instance deployments. `bodyLimit` counts streamed bytes from a cloned request; use an upstream connection/body cap too.

### Service registry · `uflite` (full only)

```text
app.service(name: string, implementation) → ServiceWrapper
app.service(name: string) → ServiceWrapper                 // lookup; throws if missing
app.hooks({ before?, after?, error? }) → app              // global SERVICE hooks
app.teardown() → app                                      // does not await cleanup
service.hooks({ before?, after?, error? }) → service
service.on('created'|'updated'|'patched'|'removed', handler) → service
service.setup(...args) / service.teardown(...args) → Promise<void>
service.find(params?) / service.get(id, params?)
service.create(data, params?) / service.update(id, data, params?)
service.patch(id, data, params?) / service.remove(id, params?) → Promise<result>
```

`implementation` can define those standard methods, custom functions, `setup(app,name)` and `teardown(app,name)`. Hooks use `all` and/or method names (`find`, `get`, `create`, `update`, `patch`, `remove`, custom). Auto-REST passes the **flat** request query as params. DBService direct `find` expects `params.query` for pagination; add a mapping layer if you require `$limit` via HTTP.

### Built-in service factories · individual imports

| Export / import | Signature & required option shape | Additional install |
| :--- | :--- | :--- |
| `createDBService` · `uflite/services/db` | `createDBService(getCollection?, {idField?,paginate?:{default,max},multi?,initialData?}?)` | `umosql@0.3.1` |
| `createTableService` · `uflite/services/table` | `createTableService(dbAdapter)` | Supply an adapter with table/DDL operations |
| `createLocalStorageService` · `uflite/services/localStorage` | `createLocalStorageService({basePath?,publicUrl?,maxFileSize?}?)` | No AWS SDK |
| `createStorageService`, alias `createStorage` · `uflite/services/storage` | `createStorageService({type?:'local'\|'s3',basePath?,publicUrl?,maxFileSize?,bucket?,region?,accessKeyId?,secretAccessKey?,sessionToken?,endpoint?,forcePathStyle?,uploadExpiresIn?,downloadExpiresIn?,client?,presign?}?)` | Both AWS SDK packages, including local mode |
| `createAuth` · `uflite/services/auth` | `await createAuth({adapter,baseURL,secret,trustedOrigins?,emailAndPassword?,secondaryStorage?,logger?,adapterConfig?,plugins?,extraPlugins?,...betterAuthOptions})` | `better-auth`; supply adapter (e.g. UMOSQL) |
| `sqlAdapterFactory` · `uflite/services/auth` | `sqlAdapterFactory(base, config?) → Better Auth adapter factory` | `better-auth`; adapter integration |
| `createACL` · `uflite/services/acl` | `createACL({enabled:boolean,rules:[{id,name?,permissions:['role:resource:method'],check?}]}) → {can(context,permission)}` | `uqry` |

`createAuth`, `createACL` and `createLocalStorageService` are also the **default exports** of their individual subpaths. `uflite/services` re-exports the DB, table and storage factories (**not** Auth/ACL/localStorage) and eagerly loads UMOSQL and AWS; prefer subpaths. `createDBService()` creates an isolated in-memory collection. Standard CRUD `find({query:{$limit?,$skip?,$select?,$sort?},paginate?})` returns `{total,limit,skip,data}` unless `paginate:false`; its missing-record error has `code:404` but **not** HTTP `status:404`. `createTableService` implements `find/get/create/patch/remove` for authorized schema changes. Storage methods include `find/get/create/remove`, `upload/download`, `presignUpload/presignDownload`. Local upload/download HTTP routes must be protected; local presign links are **not** signed authorization tokens. S3 presigned PUT cannot enforce file size. [Example 04](examples/04-full-services/index.js) runs real Auth + ACL + DBService + StorageService.

### Generic service hooks · `uflite/hooks` (also re-exported by full `uflite`)

Every factory returns `(context, next?) → value | Promise<value>`, **not** a request middleware. `HookErrorOptions` is `{error?: {status?,message?,code?}, errors?: {reason: {status?,message?,code?}}}`. `options.target` usually defaults to `data`, `result` or `params.query` as indicated; it is **not** a raw HTTP field. Full argument signatures, grouped for scanning:

| Flow | Data and query | Auth and result | Lifecycle |
| :--- | :--- | :--- | :--- |
| `iff(predicate, ...hooks)` | `requireFields(fields, options?)` | `requireAuth(options?)` | `auditFields(options?)` |
| `unless(predicate, ...hooks)` | `setDefaults(defaults, options?)` | `requireRole(roles, options?)` | `publishEvent(publish, eventName, options?)` |
| `throwIf(predicate, options?)` | `setField(field, value, options?)` | `requirePermission(permissions, options?)` | `sideEffect(effect, options?)` |
| `disallow(options?)` | `preventChanges(fields, options?)` | `requireOwner(options?)` | `debug(logger?, options?)` |
| `setData(valueOrFn)` | `removeFields(fields, options?)` | `scopeToActor(options?)` | |
| `setResult(valueOrFn)` | `pickDataFields(fields, options?)` | `requireMethod(methods, options?)` | |
| | `validateData(validator, options?)` | `rateLimit(consume, options?)` | |
| | `transformData(transform, options?)` | `transformResult(transform, options?)` | |
| | `preventEmptyData(options?)` | `pickResultFields(fields, options?)` | |
| | `setQueryDefaults(defaults, options?)` | `omitResultFields(fields, options?)` | |
| | `pickQueryFields(fields, options?)` | `mapResult(mapper)` | |
| | `transformQuery(transform, options?)` | | |

**Full typed hook signatures** (public declaration shapes, included here so the README stands alone):

```ts
export type UfliteContext = {
  app?: unknown;
  service?: unknown;
  method?: string;
  path?: string;
  id?: unknown;
  data?: unknown;
  result?: unknown;
  params?: Record<string, any>;
  [key: string]: any;
};
export type Hook = (context: UfliteContext, next?: (error?: unknown) => unknown) => unknown | Promise<unknown>;
export type Predicate<T = any> = (value: T, ...args: any[]) => boolean | Promise<boolean>;
export type Transformer<T = any, R = any> = (value: T, ...args: any[]) => R | Promise<R>;
export type FieldResolver = (value: any, object: Record<string, any>, context?: any) => any | Promise<any>;
export type HookErrorConfig = {
  message?: string | ((context: UfliteContext, details?: Record<string, any>) => string | Promise<string>);
  status?: number;
  code?: string;
};
export type HookErrorOptions = {
  /** Shared error defaults. */
  error?: HookErrorConfig;
  /** Per-failure overrides for hooks with distinct failure reasons. */
  errors?: Record<string, HookErrorConfig>;
};

export function iff(predicate: Predicate<UfliteContext>, ...hooks: Hook[]): Hook;
export function unless(predicate: Predicate<UfliteContext>, ...hooks: Hook[]): Hook;
export function throwIf(predicate: Predicate<UfliteContext>, options?: HookErrorOptions): Hook;
export function disallow(options?: HookErrorOptions): Hook;
export function setData(value: any | ((context: UfliteContext) => any)): Hook;
export function setResult(value: any | ((context: UfliteContext) => any)): Hook;
export function requireFields(fields: string[], options?: { target?: string; allowEmpty?: boolean } & HookErrorOptions): Hook;
export function setDefaults(defaults: Record<string, any> | ((context: UfliteContext) => any), options?: { target?: string }): Hook;
export function setField(field: string, value: any | ((context: UfliteContext) => any), options?: { target?: string }): Hook;
export function preventChanges(fields: string[], options?: { target?: string; original?: (context: UfliteContext) => any } & HookErrorOptions): Hook;
export function removeFields(fields: string[], options?: { target?: string }): Hook;
export function pickDataFields(fields: string[], options?: { target?: string }): Hook;
export function validateData(validator: Transformer, options?: { target?: string } & HookErrorOptions): Hook;
export function transformData(transform: Transformer, options?: { target?: string }): Hook;
export function preventEmptyData(options?: { target?: string } & HookErrorOptions): Hook;
export function setQueryDefaults(defaults: Record<string, any> | Function, options?: { target?: string }): Hook;
export function pickQueryFields(fields: string[], options?: { target?: string }): Hook;
export function transformQuery(transform: Transformer, options?: { target?: string }): Hook;
export function requireAuth(options?: HookErrorOptions & { getUser?: (context: UfliteContext) => any }): Hook;
export function requireRole(roles: string | string[], options?: HookErrorOptions & { getUser?: (context: UfliteContext) => any; roleField?: string }): Hook;
export function requirePermission(permissions: string | string[], options?: HookErrorOptions & { getPermissions?: (context: UfliteContext) => any; match?: 'any' | 'all' }): Hook;
export function requireOwner(options?: HookErrorOptions & { ownerField?: string; getActor?: (context: UfliteContext) => any; getRecord?: (context: UfliteContext) => any }): Hook;
export function scopeToActor(options?: HookErrorOptions & { field?: string; getActor?: (context: UfliteContext) => any; getQuery?: (context: UfliteContext) => any }): Hook;
export function requireMethod(methods: string | string[], options?: HookErrorOptions): Hook;
export function rateLimit(consume: Function, options?: HookErrorOptions & { key?: Function; limit?: number; windowMs?: number }): Hook;
export function transformResult(transform: Transformer, options?: { target?: string }): Hook;
export function pickResultFields(fields: string[], options?: { target?: string }): Hook;
export function omitResultFields(fields: string[], options?: { target?: string }): Hook;
export function mapResult(mapper: Transformer): Hook;
export function auditFields(options?: Record<string, any>): Hook;
export function publishEvent(publish: Function, eventName: string, options?: Record<string, any>): Hook;
export function sideEffect(effect: Function, options?: Record<string, any>): Hook;
export function debug(logger?: any, options?: Record<string, any>): Hook;
```

`uflite/hooks/flow`, `/data`, `/auth`, `/lifecycle`, `/result` re-export the respective columns. `rateLimit(consume, options?)` here is a **service hook**, unlike HTTP `rateLimit(options?)`. Hooks can mutate `context.data` or `context.result`; [example 05](examples/05-full-middleware-resolvers/index.js) uses `requireFields` + `transformData`. For longer worked recipes see [HOOK_SPEC.md](docs/HOOK_SPEC.md) and [REAL_WORLD_HOOKS.md](docs/REAL_WORLD_HOOKS.md).

### Predicates · `uflite/predicates`

Direct predicates return booleans; curried predicates return `(value) → boolean`. `all`, `any`, `not`, `when` and `contextPredicate` can be asynchronous. Nothing here automatically attaches to a route.

| Values & types | Comparison & sets | Paths & composition |
| :--- | :--- | :--- |
| `isPresent(value)` | `equals(expected)(value)` | `hasPath(path)(object)` |
| `isNil(value)` | `notEquals(expected)(value)` | `pathEquals(path,expected)(object)` |
| `isDefined(value)` | `oneOf(values)(value)` | `pathMatches(path,predicate)(object)` |
| `isEmpty(value)` | `includes(expected)(value)` | `all(...predicates)(value)` |
| `isString(value)` | `matches(pattern,flags?)(value)` | `any(...predicates)(value)` |
| `isNumber(value)` | `greaterThan(threshold)(value)` | `not(predicate)(value)` |
| `isInteger(value)` | `atLeast(threshold)(value)` | `when(predicate,yes,no?)(value)` |
| `isBoolean(value)` | `lessThan(threshold)(value)` | `contextPredicate(predicate,{select?}?)(context)` |
| `isArray(value)` | `atMost(threshold)(value)` | |
| `isObject(value)` | `between(min,max,{inclusive?}?)(value)` | |
| `isPlainObject(value)` | `lengthAtLeast(length)(value)` | |
| `isNonEmptyString(value)` | `lengthAtMost(length)(value)` | |
| `isEmail(value)` | `hasAny(values)(value)` | |
| `isURL(value)` | `hasAll(values)(value)` | |
| `isUUID(value)` | `truthy(value)` | |
| | `falsy(value)` | |

### Transformers · `uflite/transformers`

Transformers return new values rather than mutating input objects; `compose`, `pipe`, `mapFields`, `setDefaults`, `mapArray` and `updatePath` may be async. The `setDefaults` name here is a **value transformer**, not the service hook of the same name.

| Direct value functions | Factory → value transformer |
| :--- | :--- |
| `identity(value)` | `compose(...transformers)(value)`; `pipe` is an alias |
| `trimString(value)` | `pick(keys)(value)`; `omit(keys)(value)` |
| `lowercase(value)` | `renameFields(mapping)(value)` |
| `uppercase(value)` | `mapFields(mapping)(value)` |
| `normalizeEmail(value)` | `trimStrings({fields?,recursive?}?)(value)` |
| `normalizeWhitespace(value)` | `removeEmpty({removeNull?,removeEmptyStrings?,removeEmptyArrays?,removeEmptyObjects?}?)(value)` |
| `slugify(value)` | `setDefaults(defaults)(value)` |
| `toNumber(value,{strict?}?)` | `mapArray(transformer)(value)` |
| `toInteger(value,{strict?}?)` | `updatePath(path,transformer)(value)` |
| `parseJSON(value,{strict?}?)` | |
| `toBoolean(value,{strict?}?)` | |

### Field resolvers · `uflite/resolvers`

Each factory returns a field resolver `(current, object, context?) → value | Promise<value>`. Call it yourself in a route or service hook (or pass to your own mapping layer); these helpers do **not** implement `uresolver.resolve` or `virtual`.

| Read / lookup | Decide / redact | Arrays / aggregate |
| :--- | :--- | :--- |
| `value()` | `resolveIf(predicate,resolver,{otherwise?}?)` | `mapArray(resolver)` |
| `fromPath(path,{fallback?}?)` | `omitIf(predicate)` | `relationMany(fetchMany,{key?}?)` |
| `fromContext(path,{fallback?}?)` | `redactIf(predicate,replacement?)` | `join(separator?)` |
| `fallback(defaultValue)` | `mapValue(mapper)` | `count()` |
| `lookup(fetchOne,{key?,fallback?}?)` | `relation(fetchOne,{key?,fallback?}?)` | `sum()` |
| | | `pluck(field)` |

```js
import { fromPath } from 'uflite/resolvers'
import { trimStrings } from 'uflite/transformers'
import { isNonEmptyString } from 'uflite/predicates'

const cleaned = trimStrings({ fields: ['name'] })({ name: '  Ada  ' })
const valid = isNonEmptyString(cleaned.name) // true
const label = fromPath('profile.name', { fallback: 'Anonymous' })(null, { profile: cleaned })
```

### In-process events · channels · other exports

| Import | Signature | Notes |
| :--- | :--- | :--- |
| `uflite` | `app.on(event, fn) → app`, `app.off(event, fn) → app`, `app.emit(event, ...args) → app` | Synchronous local events |
| `uflite` | `app.channel(name) → channel` | Local connection set, not a socket server |
| `uflite` | `channel.join(conn, data?) → channel`, `channel.leave(conn) → channel` | `conn.send(string)` is application-supplied |
| `uflite` | `channel.send(event,data) → channel`, `channel.filter(fn).send(event,data)` | Sends JSON `{event,data}` to connections; filter receives `(connectionData,eventData)` |
| `uflite/utils` | `isObject(value) → boolean` | Object guard (also exported via predicates) |
| `uflite` | `predicates`, `transformers`, `resolvers` namespaces | Same helpers as individual subpaths |
| `uflite/package.json` | Package metadata | Exported JSON subpath |

```js
import { flite } from 'uflite'
const app = flite()
app.on('ready', count => console.log(count)).emit('ready', 1)
const socket = { send: message => console.log(message) } // replace with a real connection
app.channel('updates').join(socket, { room: 'demo' })
app.channel('updates').filter(meta => meta.room === 'demo').send('created', { id: 1 })
app.channel('updates').leave(socket)
```

<a id="custom-matchers"></a>
## 🔌 Custom matchers (optional)

`flite({ match: ({method,path}) => ({handlers,params?}) })` lets you use another matcher without replacing uflite's hook runner. **No external router is necessary**; the built-in matcher is the default. As in the original README, Hono's PatternRouter is one optional example (install `hono` yourself):

```js
import { PatternRouter } from 'hono/router/pattern-router'
import { flite } from 'uflite/lite'
import { json, error } from 'uflite'
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
export default { fetch: (request, ...args) => router.fetch(request, ...args)
  .then(value => value ?? error(404, 'Not found')).then(json).catch(error) }
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
| Cloudflare Workers | `export default { fetch: (request, ...args) => router.fetch(request, ...args).then(json).catch(error) }` | None (bundle your code) |
| Bun | `Bun.serve({fetch: request => handler.fetch(request),port:3000})` | None |
| Deno | `Deno.serve(request => handler.fetch(request))` (import from `npm:uflite`) | None |
| Hono composition | `hono.all('*', c => handler.fetch(c.req.raw))` | `hono` in **your** app |
| Node | Provide a Fetch-compatible server/adapter of your choice | Adapter in **your** app only |

**Hono is an optional combination**, not the uflite server and not part of any quickstart. If your app *already uses Hono*, you can forward its raw Request:

```js
// Only for apps that choose Hono (npm install hono).
import { Hono } from 'hono'
import { flite, json, error } from 'uflite'
const router = flite()
router.get('/hello', () => ({ hello: 'uflite' }))
const handler = { fetch: (request, ...args) =>
  router.fetch(request, ...args).then(json).catch(error) }
const hono = new Hono()
hono.all('*', c => handler.fetch(c.req.raw))
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
- **License:** `package.json` declares **ISC**. A matching top-level license file still needs maintainer confirmation; third-party license texts are under [`licenses/`](licenses/).
- **Acknowledgments:** inspired by [itty-router](https://github.com/kwhitley/itty-router) (routing), [Hono](https://hono.dev) (middleware ideas) and [FeathersJS](https://feathersjs.com) (services). Inspiration is not a runtime dependency.
