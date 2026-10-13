# 🪶 μflite

**A byte-minded Fetch router that grows with your application.** Start with `nano`, add request
hooks with `lite`, or use the full entry for response helpers, services, events and channels.
**No mandatory runtime dependencies or HTTP adapter.**

[![Tests](https://github.com/kethan/uflite/actions/workflows/node.js.yml/badge.svg)](https://github.com/kethan/uflite/actions/workflows/node.js.yml) [![npm](https://img.shields.io/npm/v/uflite?style=flat-square)](https://www.npmjs.com/package/uflite) [![License: ISC](https://img.shields.io/badge/license-ISC-blue?style=flat-square)](#testing-security-and-license) [![Dependencies: 0](https://img.shields.io/badge/mandatory_dependencies-0-brightgreen?style=flat-square)](#install-and-optional-integrations)

- **Pick your size:** three independently importable entry points.
- **Keep control:** sequential or onion-style handlers; request and service hooks.
- **Add only what you use:** database, auth and storage are optional integrations.

> [!TIP]
> **Fastest start:** `bun add uflite`, copy the [one-file quick start](#quick-start), then run
> `bun index.js`. No HTTP adapter or separate server file is needed for Bun.

## Contents

- [Quick start](#quick-start)
- [Choose an entry point](#choose-an-entry-point)
- [Size comparison](#size-comparison)
- [Install and optional integrations](#install-and-optional-integrations)
- [Five runnable examples](#five-runnable-examples)
- [Routing, hooks and services](#routing-hooks-and-services)
- [Practical patterns](#practical-patterns)
- [API at a glance](#api-at-a-glance)
- [Complete API reference](#complete-api-reference)
- [Custom matchers](#custom-matchers)
- [Browser SPA and React routing](#browser-spa-and-react-routing)
- [Fetch runtimes](#fetch-runtimes-and-optional-integrations)
- [Testing, security and license](#testing-security-and-license)

## Quick start

Install `uflite` and save this **one file** as `index.js`:

```bash
bun add uflite
```

```js
import { flite, json } from 'uflite'

const app = flite()
app.get('/hello', () => json({ hello: 'uflite' }))

export default {
  port: Number(Bun.env.PORT || 3000),
  fetch: request => app.fetch(request)
}
```

Bun 1.4.3 auto-serves a default `{ fetch }` export **from the CLI entry file**:

```bash
bun index.js
curl http://localhost:3000/hello
# {"hello":"uflite"}
```

The full entry also supplies a JSON 404 for unmatched routes. Other Fetch hosts can call
`app.fetch(request)`; see [runtime integration](#fetch-runtimes-and-optional-integrations).
For a CRUD API, start with [Nano CRUD](examples/01-nano-crud/README.md) rather than expanding
this first route into an application.

## Choose an entry point

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
> `json` and `error` belong to **`uflite`**, not `uflite/nano` or `uflite/lite`. Importing the
> helpers from full alongside a nano/lite router works, but increases the bundle. For the
> smallest possible build, return native `Response` objects instead. Nano/lite return raw values
> or `undefined` on misses; only full formats responses and registers services.

## Size comparison

Measured with `bun run bench:size` (Bun **1.4.3**; browser-target, minified, bundled **one GET
`/hello` route returning a Response**, then gzip):

| Entry | Minified | Gzip |
| :--- | ---: | ---: |
| `uflite/nano` | **1,385 B** | **799 B** |
| `uflite/lite` | **2,470 B** | **1,251 B** |
| `uflite` | **6,134 B** | **2,690 B** |
| Hono 4.10.6 | 19,026 B | 7,623 B |
| itty-router 4.2.2 | 1,122 B | 689 B |

Nano is **110 B larger gzip** than itty-router in this fixture; lite/full are smaller than Hono.
The comparisons are *benchmarks*, not dependencies or throughput claims. Importing full `json`
into nano changes the resulting bundle. Reproduce with `bun run bench:size`; `bun run bench`,
`bench:cmp`, `bench:mitata` and `bench:url` test other performance questions.

## Install and optional integrations

```bash
bun add uflite       # use Bun.serve or export a Fetch handler
# or: npm install uflite  (on another Fetch-compatible runtime)
```

**No Hono, Node adapter or web server package is needed by uflite.** A Fetch runtime such as
Bun, Cloudflare Workers or Deno supplies the HTTP host. The five local HTTP projects below run
with Bun. Optional integration packages are installed **by your application** when used:

- **Core:** `uflite`, `/nano`, `/lite`, `/middlewares`, `/hooks`, `/predicates`,
  `/transformers`, `/resolvers`, and `/utils` need nothing else.
- **Database:** `uflite/services/db` needs `umosql@0.3.1`. The optional
  `uflite/services/table` needs a supplied table adapter, not a new package.
- **Auth and access:** `uflite/services/auth` needs `better-auth` plus a compatible
  adapter (such as UMOSQL). `uflite/services/acl` needs `uqry`.
- **Storage:** `uflite/services/localStorage` needs only a local directory;
  `uflite/services/storage` needs both `@aws-sdk/client-s3` and
  `@aws-sdk/s3-request-presigner`, even for its local mode.
- **Barrel:** `uflite/services` eagerly imports UMOSQL and both AWS packages.
  Prefer individual service subpaths.

`better-auth` and `uqry` are imported separately, not by the services barrel. Import paths and
signatures are in the [complete reference](#complete-api-reference).

## Five runnable examples

In a checkout, first run **`bun install && bun run build`** at the root. Each project has its
own `package.json`, uses `file:../..` for the built checkout, and has documented `curl`
success/error flows. Each exports a Fetch handler from `index.js`; its existing `server.js`
calls `Bun.serve` on port 3000 (`PORT` overrides it). **None installs Hono or a Node adapter.**

Run one project, then follow its README's `curl` requests:

```bash
cd examples/01-nano-crud # or choose 02, 03, 04 or 05 below
npm install
npm start
```

1. **[Nano CRUD](examples/01-nano-crud/README.md)** — basic plural REST routing,
   JSON create/update/delete, 400/404/500 responses. `GET /api/tasks` is the starting point.
2. **[Nano practical](examples/02-nano-practical/README.md)** — flat query filters,
   API-key guard and mounted `/api/tasks` router.
3. **[Lite notes](examples/03-lite-notes/README.md)** — global before/after/error request
   hooks and a separate notes module.
4. **[Full services](examples/04-full-services/README.md)** — generated DBService routes,
   real Better Auth sessions, ACL and local storage (S3 optional).
5. **[Full lifecycle](examples/05-full-middleware-resolvers/README.md)** — HTTP middleware,
   service hooks, resolvers, predicates and mutation events.

> [!NOTE]
> **StackBlitz:** these local projects depend on `file:../..` and a built checkout. No
> StackBlitz run or standalone-folder import has been verified; there are no fabricated launch
> links. Replace the local dependency with a published version only after verifying the exact
> example on StackBlitz.

## Routing, hooks and services

```text
Request → nano router (route matching / handlers)
            └─ lite (global before → route → after / error)
                 └─ full (format / missing + services + events + channels)
```

**Routes.** `app.get('/tasks/:id', req => json({ id: req.params.id, tag: req.query.tag }))`
matches a segment; `req.query` is flat; repeated keys with a nonempty first value become arrays
(a leading empty value can be overwritten). `app.get('/files/*', ...)` matches descendants.
`app.use('/api', child)` mounts registered child routes; `app.use('/api/*', handler)` adds an
ALL middleware route (register guards **before** protected routes). A `match({method,path})`
callback may return `{handlers,params?}` instead of registered lookup. The deliberately compact
route compiler treats literal regexp punctuation such as `.` as regex syntax; it **does not
escape** literal paths.

**Two execution modes.** Handler args start with the Web Request (`req.params`, `req.query`),
followed by any adapter args. Mode 1's `next` comes **last**.

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

**Request hooks** (lite/full) accept
`{ before: {all, get, post, ...}, after: {...}, error: {...} }` in `flite`. `before` receives
`req`, `after` receives `(result, req)`, `error` receives `(err, req)`; each can access adapter
args. They are **not** service-context hooks.

**Service hooks** (full only) use `app.service(name, implementation)` and
`service.hooks({before,after,error})` or `app.hooks(...)`. A service hook receives mutable
`{app,service,path,method,params,id?,data?,result?,error?}`. On success: app.before.all →
app.before.method → service.before.all → service.before.method → implementation →
service.after.method → service.after.all → app.after.method → app.after.all. Implementation
exceptions enter service.error.method → service.error.all → app.error.method → app.error.all,
then rethrow; these hooks observe errors, they do not recover the call. Failures in **before or
after hooks** bypass the service error hooks (though request-level error hooks can handle a
rejected REST request). In mode 1 each hook must call `next()` for the next hook to run,
including error hooks. `created`, `updated`, `patched`, `removed` events fire on successful
mutations. `setup` at registration and `app.teardown()` do **not await** async lifecycle
operations.

Only implemented standard service methods auto-register REST routes (`GET /name`,
`GET /name/:id`, `POST /name`, `PUT /name/:id`, `PATCH /name/:id`, `DELETE /name/:id`); custom
methods are direct-call only unless you write a route. `PUT` maps to service `update` when
implemented; the Nano CRUD example deliberately uses only partial `PATCH`. **Protect generated routes** before
registration if data is sensitive. See
[example 05](examples/05-full-middleware-resolvers/index.js) for a complete lifecycle.

The [Nano CRUD example](examples/01-nano-crud/README.md) uses explicit plural resource
routes rather than generated service routes:

| Method | Route | Example response |
| :--- | :--- | :--- |
| `GET` | `/api/tasks` | 200, JSON array |
| `GET` | `/api/tasks/:id` | 200 task, or 404 |
| `POST` | `/api/tasks` | 201 task; invalid data 400 |
| `PATCH` | `/api/tasks/:id` | 200 updated task; partial `done` or `title` |
| `DELETE` | `/api/tasks/:id` | 200 removed task in body, or 404 |

The full DBService example instead exposes generated `/tasks` routes with its actual HTTP
behavior, not implicit 201/204 or flat-query pagination. See
[service registry](#service-registry) for the exact distinction.

## Practical patterns

These **mounted router, middleware, service lifecycle and storage recipes** are independent
patterns, not mandatory layers. Follow the linked runnable projects for complete HTTP flows.

### Nano Fetch wrappers and error policy

Nano returns handler values directly and `undefined` on a miss. Its introductory
`router.fetch(request, ...args).then(json).catch(error)` pattern formats results, but
**exposes thrown 5xx messages**. Register an explicit 404 fallback, as in
[Nano CRUD](examples/01-nano-crud/README.md); use the redacting policy below when deploying.
Lite and full have request error hooks; neither needs this nano wrapper.

<details>
<summary>Production-safe nano error handling</summary>

### Production-safe nano errors

For a deployed nano app, **replace** the introductory wrapper (do not use both defaults). This
version guarantees a Response for unmatched routes, logs internal failures on the server, keeps
deliberate 4xx messages, and never sends a 5xx exception message to the client:

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

The 404 is explicit: nano has **no** built-in missing-route handler. Do not put sensitive data
in deliberate 4xx messages either. A configured request error hook is the equivalent
customization for lite/full; the full entry's **default** error hook exposes 5xx messages unless
you replace it.

</details>

### Response helpers · no `Response.json` needed

```js
import { flite, json, text, html, error, status } from 'uflite'
const app = flite()
app.post('/json', () => json({ ok: true }, { status: 201 }))
app.get('/text', () => text('Hello'))
app.get('/html', () => html('<strong>Hello</strong>'))
app.get('/missing', () => error(404, 'Not found'))
app.get('/private', () => { throw new status(401, 'Sign in first') })
```

Full uflite also converts plain objects to JSON and supplies its own unmatched-route 404. Nano
needs an explicit formatter or wrapper when handlers return plain values; lite can use its
`after` hook for formatting (or explicitly return `json(...)`). Returning a `Response` from
`json` is safe to pass through `json` again; a 5xx `error` response can reveal its original
message.

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

Request hooks receive a Request or Response, **not** a service context. A custom error hook
replaces the default in full; this sample preserves error messages to demonstrate the API, not
as production redaction policy. The [lite notes app](examples/03-lite-notes/index.js) shows CRUD
and 4xx/5xx handling.

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

For your own mode-1 middleware: `(req, next) => { /* before */ await next(); /* after */ }`. For
cross-phase data in separate before/after hooks, store metadata in a `WeakMap` keyed by the
Request rather than trusting client headers. HTTP middleware is **not** the same as service
hooks. See [middleware option signatures](#http-middleware).

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

`POST /users` calls the standard `create`; `users.count()` is hookable but not auto-routed, so
`/user-count` is explicit. Before-hooks, implementation, after-hooks, then the `created` event
run in that order; generated service HTTP routes need access control.
[Example 05](examples/05-full-middleware-resolvers/index.js) combines this with resolvers and
predicates.

### Database, schema and auth adapters

```js
import { flite } from 'uflite'
import { createDBService } from 'uflite/services/db'      // bun add umosql@0.3.1
import { createTableService } from 'uflite/services/table' // supply a real DDL-capable adapter
import { createAuth } from 'uflite/services/auth'         // bun add better-auth umosql@0.3.1
import { createACL } from 'uflite/services/acl'           // bun add uqry
import { createSchemalessAdapter } from 'umosql/schemaless'

const app = flite()
const tasks = app.service('tasks', createDBService()) // isolated memory; generated REST
// For persistence, replace the line above with createDBService(() => yourCollection).
// const tables = createTableService(dbAdapter) // needs a DDL-capable adapter
const { adapter } = createSchemalessAdapter(undefined, 'memory')
const auth = await createAuth({ adapter, baseURL: 'http://localhost:3000', secret: Bun.env.AUTH_SECRET })
const acl = createACL({ enabled: true, rules: [{ id: 'members', permissions: ['member:tasks:find'] }] })
// Mount auth.handler(request) at /api/auth/*; use auth.api.getSession({headers:req.headers})
// and a trusted role before calling acl.can({user:session.user}, 'member:tasks:find').
```

The snippet above is **wiring**, not a standalone server: generated `tasks` routes are public
until you add authorization, and `auth`/`acl` need a trusted session guard. Set a real secret; the
[runnable full example](examples/04-full-services/index.js) includes the session guard, ACL hook
and HTTP verification. UMOSQL memory resets on restart. DBService REST passes flat query params
while its direct `find({query:{$limit,$skip}})` expects nested `query`; missing-record errors
set `code:404`, not HTTP `status`.

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

Local storage's raw routes include `PUT /storage?key=folder/file.txt` and
`GET /storage/download?key=folder/file.txt`. S3: `POST /storage/presign` with
`{key,contentType}` returns a signed PUT URL and headers; `POST /storage/presign-download` with
`{key}` signs a GET. Configure bucket CORS. Signed PUT does not enforce file size; local presign
URLs are **not** authorization tokens. Restrict both HTTP and direct service access.
[Example 04](examples/04-full-services/README.md) runs local storage by default.

## API at a glance

- **Nano:** `flite({ routes?, mode?, match? }?)` handles routes and raw values;
  `fetch()` returns `undefined` on a miss.
- **Lite:** add `before?`, `after?`, `error?` request hooks; a miss remains `undefined`
  unless an after hook responds. No services.
- **Full:** also accepts `format?` and `missing?`; formats JSON, returns a JSON 404 by
  default, and provides services, in-process events and channels.

Routes: `app.get/post/put/patch/delete/head/options/all(path, ...handlers)`,
`app.use(path?, ...handlersOrRouters)` and `app.fetch(request, ...args)`. Mode 0 handlers
receive `(request, ...adapterArgs)` and stop on a non-nullish result; mode 1 receives
`(request, ...adapterArgs, next)` and requires `await next()` to continue.
`json(body, options?)`, `text`, `html`, `error(code, message?)` and `new status(code, message?)`
are exported from **full** `uflite`. Full's default error hook returns `err.message`, even for
5xx.

Full-only `app.service(name, implementation)` exposes standard
`find/get/create/update/patch/remove` methods and auto-routes **only implemented** methods.
Hooks are registered with `service.hooks({before?,after?,error?})` or `app.hooks(...)`. Service
hook context, ordering, factory options, HTTP middleware signatures, all
predicate/transformer/resolver exports, channel methods and package subpaths are in the
**[complete API reference](#complete-api-reference)**. For hook recipes and error configuration,
see [HOOK_SPEC](docs/HOOK_SPEC.md) and [REAL_WORLD_HOOKS](docs/REAL_WORLD_HOOKS.md).

## Complete API reference

The public entry points, signatures, options, and return behavior below are preserved here
rather than being moved to another file. `?` means optional; `→` indicates a returned
function or value. For declaration types see [`src/index.d.ts`](src/index.d.ts).
Expand the relevant group as needed.

<details>
<summary>Core routes, response helpers and HTTP middleware</summary>

### Entry points, routes and hooks

- `uflite/nano`: `flite({ routes?, mode?: 0 | 1, match? }?)` returns raw values or
  `undefined` (the declaration narrows this to Response).
- `uflite/lite`: `flite({ routes?, mode?, match?, before?, after?, error? }?)` returns the
  result after global request hooks, or `undefined`.
- `uflite`: `flite({ routes?, mode?, match?, before?, after?, error?, format?, missing? }?)`
  usually returns a Response, with default 404, formatting and error hook.

Each entry point also exports **default `flite`**. `routes` can be supplied as the app's route
array; nano exposes it on `app.routes` (lite/full inherit this property).

```text
app.get/post/put/patch/delete/head/options/all(path, ...handlers) → app
app.GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS/ALL(path, ...handlers) → app
app.use(handler | router) / app.use(path, ...handlersOrRouters) → app
app.fetch(request: Request, ...adapterArgs) → Promise<result | undefined>
app.routes → registered route tuples
match({ method, path }) → { handlers, params? } | undefined
run(mode?: 0 | 1)(...handlers)(...args) → Promise<result | undefined>  // full export
```

`before` / `after` / `error` are dictionaries keyed by `all` or a **lowercase HTTP method**.
Their handlers are `(req, ...args)`, `(result, req, ...args)`, `(err, req, ...args)`. Lite/full
request hooks run before.all → before.method → route → after.method → after.all; a thrown
request error instead runs error.method → error.all. A before hook can return a value to skip
routing; after hooks can transform a result or supply a response for a miss. In mode 1 each hook
must call `next()` to run the next hook in that phase. Error hooks are request hooks, distinct
from service-context error hooks. `format(result)` controls full auto-formatting (`false`
disables it); `missing()` controls the full fallback. If custom full `error` hooks are supplied,
they replace the default.

When `match({method,path})` is supplied, nano bypasses its registered-route loop even if the
custom matcher returns no handlers; lite/full fall back to registered routes if the matcher
returns no handlers. Both return raw handler results unless full formatting is active.

### Response helpers

- `response(contentType?, transform?)(body, options?) → Response | undefined`:
  configurable content type and body transform; defaults to text/plain.
- `text(body, options?) → Response | undefined`: text content type.
- `html(body, options?) → Response | undefined`: HTML content type.
- `json(body, options?) → Response | undefined`: JSON stringify;
  `json(undefined)` returns `undefined`.
- `error(statusCode, messageOrObject?) → Response` or `error(err: Error) → Response`:
  JSON `{status,error}` or object details.
- `new status(code, message?, data?) → Error`: throw for status-aware handling.

`options` accepts Fetch `ResponseInit` fields such as `status` and `headers`. Response helpers
pass an existing **same-realm** `Response` through. Full defaults to
`error(err.status || 500, err.message)`, **including 5xx messages**. Install an application
error hook to redact internal errors.

### HTTP middleware

Request factories return `Middleware(request, next?) → Response | void | Promise<…>`; named
companions are response-phase functions
`(response, request, next?) → Response | Promise<Response>` for `after.all`. In mode 0, wrap
optional-next middleware as `req => middleware(req)` if a Fetch host supplies extra arguments;
otherwise it may mistake an environment/server value for `next` (see
[example 05](examples/05-full-middleware-resolvers/index.js)).

- `cors({origin?,methods?,credentials?,maxAge?,allowedHeaders?,exposedHeaders?}?)`:
  origin can be a string, array or RegExp; response companion `corsAfter`.
- `logger({format?,skip?}?)`: `format` is `dev`, `combined` or `json`;
  `skip(req)` omits requests; response companion `loggerAfter`.
- `rateLimit({windowMs?,max?,keyGenerator?,standardHeaders?}?)`: in-process,
  use a trusted `keyGenerator(req)`; response companion `rateLimitAfter`.
- `bearerAuth({token?,verify?,realm?}?)`: static token or sync/async `verify(token)`.
- `basicAuth({users,realm?})`: username→password record.
- `bodyLimit({max?}?)`: byte count or size string such as `'10mb'`.
- `secureHeaders({contentSecurityPolicy?,xFrameOptions?,strictTransportSecurity?,
  xContentTypeOptions?,referrerPolicy?}?)`: response companion `secureHeadersAfter`.
- `requestId({header?,generator?}?)`: response companion `requestIdAfter`.

`rateLimit` uses one `unknown` bucket by default rather than trusting forwarded headers; use a
trusted key and shared store for multi-instance deployments. `bodyLimit` counts streamed bytes
from a cloned request; use an upstream connection/body cap too.

</details>

<details>
<summary>Service registry and optional service factories</summary>

### Service registry

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

`implementation` can define those standard methods, custom functions, `setup(app,name)` and
`teardown(app,name)`. Hooks use `all` and/or method names (`find`, `get`, `create`, `update`,
`patch`, `remove`, custom). The wrapper exposes standard method functions even when the
implementation omits one, but **registers an HTTP route only when that method is implemented**.
Service `setup` runs on registration and `app.teardown()` calls teardown without awaiting
asynchronous work.

**Successful service call order:** app.before.all → app.before.method → service.before.all →
service.before.method → implementation → service.after.method → service.after.all →
app.after.method → app.after.all → mutation event. In mode 0 hooks advance automatically; in
mode 1 a hook must call `next()` for subsequent hooks to run. Only an *implementation* exception
enters service.error.method → service.error.all → app.error.method → app.error.all; after those
hooks complete, the original error is rethrown (unless an error hook throws a replacement).
Before-hook, after-hook, and event-listener exceptions do not enter service error hooks. A REST
request may separately reach the router's request-level error hook. Service error hooks
observe/log; setting `context.result` there does not turn failure into success.

Auto-REST passes the **flat** request query as params. DBService direct `find` expects
`params.query` for pagination; add a mapping layer if you require `$limit` via HTTP.

Generated POST and DELETE routes return `json(result)` (normally HTTP **200** when a value
is returned), not automatic 201/204. Missing DB records use `code:404`, not HTTP `status:404`;
the default full error handler can therefore return 500. For conventional 201/204 and 404,
use explicit routes or map the errors/statuses in your application; do not claim flat HTTP
`$limit` query params paginate a DBService list.

### Built-in service factories

- **DB · `uflite/services/db`:**
  `createDBService(getCollection?, {idField?,paginate?:{default,max},multi?,initialData?}?)`.
  Install `umosql@0.3.1`.
- **Table · `uflite/services/table`:** `createTableService(dbAdapter)`; supply an
  adapter with table/DDL operations.
- **Local storage · `uflite/services/localStorage`:**
  `createLocalStorageService({basePath?,publicUrl?,maxFileSize?}?)`; no AWS SDK.
- **Storage · `uflite/services/storage`:** `createStorageService(options?)`, alias
  `createStorage`. Options: `type?: 'local' | 's3'`, `basePath?`, `publicUrl?`,
  `maxFileSize?`, `bucket?`, `region?`, `accessKeyId?`, `secretAccessKey?`,
  `sessionToken?`, `endpoint?`, `forcePathStyle?`, `uploadExpiresIn?`,
  `downloadExpiresIn?`, `client?`, `presign?`. Install both AWS SDK packages,
  including for local mode.
- **Auth · `uflite/services/auth`:** `await createAuth(options)` requires
  `adapter`, `baseURL` and `secret`. Optional: `trustedOrigins?`,
  `emailAndPassword?`, `secondaryStorage?`, `logger?`, `adapterConfig?`,
  `plugins?`, `extraPlugins?` and other Better Auth options. Install
  `better-auth` and supply an adapter (e.g. UMOSQL).
- **Auth adapter · `uflite/services/auth`:** `sqlAdapterFactory(base, config?)`
  returns a Better Auth adapter factory; requires Better Auth and an adapter.
- **ACL · `uflite/services/acl`:**
  `createACL({enabled:boolean,rules:[{id,name?,permissions:['role:resource:method'],check?}]})`
  returns `{can(context,permission)}`. Install `uqry`.

`createAuth`, `createACL` and `createLocalStorageService` are also the **default exports** of
their individual subpaths. `uflite/services` re-exports the DB, table and storage factories
(**not** Auth/ACL/localStorage) and eagerly loads UMOSQL and AWS; prefer subpaths.
`createDBService()` creates an isolated in-memory collection (default page size 10, maximum
100). Direct `find({query:{$limit?,$skip?,$select?,$sort?},paginate?})` returns
`{total,limit,skip,data}`; `$limit` is clamped to the configured maximum, `$limit:0` preserves
`total` with empty `data`, and `paginate:false` returns an unpaginated array. DBService
not-found exceptions from `get` and ID-based mutations have `code:404` but **not** HTTP
`status:404`; a default full-app HTTP response can therefore be 500. `createTableService`
implements `find/get/create/patch/remove` for authorized schema changes. Both storage backends
offer `find/get/create/remove` and `presignUpload/presignDownload`; **only local storage**
implements `upload/download` and raw PUT/download routes. S3 upload/download bytes go directly
to the provider via presigned URLs. Local upload/download HTTP routes must be protected by a
request guard (local raw download does not pass the Request into its service-hook parameters);
local presign links are **not** signed authorization tokens. S3 presigned PUT cannot enforce
file size. [Example 04](examples/04-full-services/index.js) runs real Auth + ACL + DBService +
StorageService.

</details>

<details>
<summary>Generic service hook signatures</summary>

### Generic service hooks

Every factory returns `(context, next?) → value | Promise<value>`, **not** a request middleware.
`HookErrorOptions` is
`{error?: {status?,message?,code?}, errors?: {reason: {status?,message?,code?}}}`.
`options.target` usually defaults to `data`, `result` or `params.query` as indicated; it is
**not** a raw HTTP field. Full argument signatures, grouped for scanning:

The typed signatures below include **flow** (`iff`, `unless`, `throwIf`, `disallow`),
**data/query** validation and transforms, **auth/result** policies, and **lifecycle** helpers
(`auditFields`, `publishEvent`, `sideEffect`, `debug`). None runs automatically.

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
export function requireFields(fields: string[],
  options?: { target?: string; allowEmpty?: boolean } & HookErrorOptions): Hook;
export function setDefaults(defaults: Record<string, any> | ((context: UfliteContext) => any),
  options?: { target?: string }): Hook;
export function setField(field: string, value: any | ((context: UfliteContext) => any),
  options?: { target?: string }): Hook;
export function preventChanges(fields: string[],
  options?: { target?: string; original?: (context: UfliteContext) => any } & HookErrorOptions): Hook;
export function removeFields(fields: string[], options?: { target?: string }): Hook;
export function pickDataFields(fields: string[], options?: { target?: string }): Hook;
export function validateData(validator: Transformer, options?: { target?: string } & HookErrorOptions): Hook;
export function transformData(transform: Transformer, options?: { target?: string }): Hook;
export function preventEmptyData(options?: { target?: string } & HookErrorOptions): Hook;
export function setQueryDefaults(defaults: Record<string, any> | Function, options?: { target?: string }): Hook;
export function pickQueryFields(fields: string[], options?: { target?: string }): Hook;
export function transformQuery(transform: Transformer, options?: { target?: string }): Hook;
export function requireAuth(options?: HookErrorOptions & { getUser?: (context: UfliteContext) => any }): Hook;
export function requireRole(roles: string | string[],
  options?: HookErrorOptions & { getUser?: (context: UfliteContext) => any; roleField?: string }): Hook;
export function requirePermission(permissions: string | string[],
  options?: HookErrorOptions & { getPermissions?: (context: UfliteContext) => any;
    match?: 'any' | 'all' }): Hook;
export function requireOwner(options?: HookErrorOptions & { ownerField?: string;
    getActor?: (context: UfliteContext) => any; getRecord?: (context: UfliteContext) => any }): Hook;
export function scopeToActor(options?: HookErrorOptions & { field?: string;
    getActor?: (context: UfliteContext) => any; getQuery?: (context: UfliteContext) => any }): Hook;
export function requireMethod(methods: string | string[], options?: HookErrorOptions): Hook;
export function rateLimit(consume: Function,
  options?: HookErrorOptions & { key?: Function; limit?: number; windowMs?: number }): Hook;
export function transformResult(transform: Transformer, options?: { target?: string }): Hook;
export function pickResultFields(fields: string[], options?: { target?: string }): Hook;
export function omitResultFields(fields: string[], options?: { target?: string }): Hook;
export function mapResult(mapper: Transformer): Hook;
export function auditFields(options?: Record<string, any>): Hook;
export function publishEvent(publish: Function, eventName: string, options?: Record<string, any>): Hook;
export function sideEffect(effect: Function, options?: Record<string, any>): Hook;
export function debug(logger?: any, options?: Record<string, any>): Hook;
```

`uflite/hooks/flow`, `/data`, `/auth`, `/lifecycle`, `/result` re-export the respective columns.
`rateLimit(consume, options?)` here is a **service hook**, unlike HTTP `rateLimit(options?)`.
Hooks can mutate `context.data` or `context.result`;
[example 05](examples/05-full-middleware-resolvers/index.js) uses `requireFields` +
`transformData`. For longer worked recipes see [HOOK_SPEC.md](docs/HOOK_SPEC.md) and
[REAL_WORLD_HOOKS.md](docs/REAL_WORLD_HOOKS.md).

</details>

<details>
<summary>Predicates, transformers and field resolvers</summary>

### Predicates

Direct predicates return booleans; curried predicates return `(value) → boolean`. `all`, `any`,
`not`, `when` and `contextPredicate` can be asynchronous. Nothing here automatically attaches to
a route.

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

### Transformers

Transformers return new values rather than mutating input objects; `compose`, `pipe`,
`mapFields`, `setDefaults`, `mapArray` and `updatePath` may be async. The `setDefaults` name
here is a **value transformer**, not the service hook of the same name.

**Direct value functions:** `identity`, `trimString`, `lowercase`, `uppercase`,
`normalizeEmail`, `normalizeWhitespace`, `slugify`, `toNumber(value,{strict?}?)`,
`toInteger(value,{strict?}?)`, `parseJSON(value,{strict?}?)`, `toBoolean(value,{strict?}?)`.
The others each take one value.

**Factories returning value transformers:** `compose(...transformers)` (`pipe` alias),
`pick(keys)`, `omit(keys)`, `renameFields(mapping)`, `mapFields(mapping)`,
`trimStrings({fields?,recursive?}?)`,
`removeEmpty({removeNull?,removeEmptyStrings?,removeEmptyArrays?,removeEmptyObjects?}?)`,
`setDefaults(defaults)`, `mapArray(transformer)`, `updatePath(path,transformer)`.
Call a returned transformer with `(value)`.

### Field resolvers

Each factory returns a field resolver `(current, object, context?) → value | Promise<value>`.
Call it yourself in a route or service hook (or pass to your own mapping layer); these helpers
do **not** implement `uresolver.resolve` or `virtual`.

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

</details>

<details>
<summary>Events, channels and remaining exports</summary>

### Events, channels and other exports

- Full `uflite` events: `app.on(event, fn) → app`, `app.off(event, fn) → app`,
  `app.emit(event, ...args) → app`; synchronous and local to this process.
- Channels: `app.channel(name) → channel`; a local connection set, **not** a socket server.
  `channel.join(conn, data?) → channel`, `channel.leave(conn) → channel`;
  your `conn` supplies `send(string)`.
- Delivery: `channel.send(event,data) → channel` sends JSON `{event,data}`;
  `channel.filter(fn).send(event,data)` filters on `(connectionData,eventData)`.
- `uflite/utils`: `isObject(value) → boolean` (also exported via predicates).
- Full `uflite`: `predicates`, `transformers`, `resolvers` namespace exports.
- `uflite/package.json`: exported package metadata JSON subpath.

```js
import { flite } from 'uflite'
const app = flite()
app.on('ready', count => console.log(count)).emit('ready', 1)
const socket = { send: message => console.log(message) } // replace with a real connection
app.channel('updates').join(socket, { room: 'demo' })
app.channel('updates').filter(meta => meta.room === 'demo').send('created', { id: 1 })
app.channel('updates').leave(socket)
```

</details>

## Custom matchers

<details>
<summary>Optional custom matchers (Hono normalization)</summary>

`flite({ match: ({method,path}) => ({handlers,params?}) })` lets you use another matcher without
replacing uflite's hook runner. **No external router is necessary**; the built-in matcher is the
default. Hono's PatternRouter is one optional example (install `hono` yourself):

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

This normalization is verified for Hono 4's PatternRouter, RegExpRouter and TrieRouter in
[matcher tests](tests/hono-router.spec.js); their internal match shapes may change with Hono
versions. `trouter`/`itty-router` can also be adapted to the same `{handlers,params?}` contract.
The `match` option does **not** make Hono a dependency.

</details>

## Browser SPA and React routing

<details>
<summary>Browser SPA and React recipes</summary>

Client-side routing is **not** server-side rendering or a Fetch HTTP server. Use a bundler
(Vite, Bun build, etc.) or an import map to resolve bare `uflite/...` imports in the browser.
These are small `main.js` examples, not untested copy-paste raw `<script>` imports.

**Vanilla browser SPA:** nano can return data rather than a Response. Render untrusted route
params with `textContent`, not `innerHTML`.

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

**React SPA:** install `react` and `react-dom` in *your app*
(`npm install uflite react react-dom`) and bundle `main.jsx`. Create the React root **once**,
not on every navigation.

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

Browser examples are illustrative, not part of the HTTP smoke test. Existing repository samples:
[vanilla](examples/browser-spa.js), [React](examples/browser-react.js),
[service worker](examples/service-worker.js), and [middleware](examples/example.middleware.js).

</details>

## Fetch runtimes and optional integrations

The exported Fetch handler **is enough** for Workers; Bun and Deno can call it directly. Only
the Bun projects are HTTP-smoke-tested in this repository. No HTTP adapter belongs to the core
package:

- **Cloudflare Workers:** export a full app as the default Fetch handler, or use the
  [introductory nano pattern](#nano-fetch-wrappers-and-error-policy). Bundle your code.
- **Bun:** the [one-file quick start](#quick-start) uses CLI auto-serving; the five
  existing projects call `Bun.serve({fetch: request => handler.fetch(request),port:3000})`.
- **Deno:** import from `npm:uflite`, then
  `Deno.serve(request => handler.fetch(request))`.
- **Hono composition (optional):** `hono.all('*', c => handler.fetch(c.req.raw))`;
  install `hono` in **your** app.
- **Node:** supply a Fetch-compatible server/adapter in **your** application.

**Hono is an optional combination**, not the uflite server and not part of any quickstart. If
your app *already uses Hono*, you can forward its raw Request:

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

Hono on Node may itself use `@hono/node-server`, but that is **Hono/Node application wiring**,
never a uflite requirement. For mode 1, be careful when a host passes extra `fetch` arguments:
`next` is last. The full formatter uses `instanceof Response`; with a foreign Response
implementation it can serialize a Response to `{}`. Only use `flite({format:false})` when routes
already return Responses, and test the host you deploy.

## Testing, security and license

```bash
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
> **Production defaults are intentionally small, not a security policy.** Full's default error
> hook includes `err.message` even for 5xx; install an error hook that redacts internal details.
> The compact compiler interprets regex punctuation in paths. Generated service REST endpoints
> need authentication and authorization. Never trust user-controlled query params as an
> authenticated identity.

- **Database:** an in-memory DBService is not durable; missing records have `code:404` but not
  HTTP `status:404`. REST queries are flat, so `$limit` is not automatically nested for
  DBService pagination.
- **Storage:** local URLs are not authorization tokens. Keep a trusted, private directory;
  protect raw upload/download routes. For S3 configure provider credentials/CORS and understand
  that signed PUT does not enforce upload size.
- **Rate/body limits:** process-local rate limiting needs a trusted key and shared/upstream
  enforcement for multiple instances; body limits need an upstream transport cap.
- **Runtime gaps:** persistent DB, S3 provider, Workers, Deno and browser UI were not deployed
  in these tests. See the [production follow-up](PRODUCTION_READINESS_REVIEW.md).
- **Contributing:** add regression tests for behavior changes, run the commands above and review
  optional-integration imports. File defects in
  [GitHub issues](https://github.com/kethan/uflite/issues).
- **Maintainer & license:** package metadata names [Kethan Surana](https://github.com/kethan)
  and declares **ISC**. A matching top-level license file still needs maintainer confirmation;
  third-party license texts are under [`licenses/`](licenses/).
- **Acknowledgments:** inspired by [itty-router](https://github.com/kwhitley/itty-router)
  (routing), [Hono](https://hono.dev) (middleware ideas) and
  [FeathersJS](https://feathersjs.com) (services). Inspiration is not a runtime dependency.
