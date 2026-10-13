# 🪶 μflite

**A byte-minded Fetch router that grows with your application.** Start with `nano`, add request hooks with `lite`, or use the full entry for response helpers, services, events and channels. No mandatory runtime dependencies.

[![Tests](https://github.com/kethan/uflite/actions/workflows/node.js.yml/badge.svg)](https://github.com/kethan/uflite/actions/workflows/node.js.yml) [![npm](https://img.shields.io/npm/v/uflite?style=flat-square)](https://www.npmjs.com/package/uflite) [![License: ISC](https://img.shields.io/badge/license-ISC-blue?style=flat-square)](#user-content-testing-security-and-license) [![Dependencies: 0](https://img.shields.io/badge/mandatory_dependencies-0-brightgreen?style=flat-square)](#user-content-install-and-optional-integrations)

| 🎯 Pick your size | 🪝 Keep control | 🧩 Add only what you use |
| :--- | :--- | :--- |
| Three independently importable entry points | Sequential or onion-style handlers, request and service hooks | Database, auth and storage are optional integrations |

> [!TIP]
> **Get running:** `npm install uflite @hono/node-server` → copy the [full Node quickstart](#user-content-quick-start-full-node-server) → `node server.mjs` → `curl localhost:3000/hello/Ada`.

<a id="contents"></a>
## 🧭 Contents

| Start here | Build an app | Reference & operations |
| :--- | :--- | :--- |
| [Choose an entry point](#user-content-choose-an-entry-point) | [Quick-start skeletons](#user-content-quick-start-skeletons) | [Complete API signatures](#user-content-complete-api-signatures) |
| [Size comparison](#user-content-size-comparison) | [Five tested examples](#user-content-five-runnable-examples) | [Runtime adapters](#user-content-runtime-adapters) |
| [Install & optional integrations](#user-content-install-and-optional-integrations) | [Routing, hooks & services](#user-content-routing-hooks-and-services) | [Test, security & license](#user-content-testing-security-and-license) |

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
import { flite, json } from 'uflite'       // full features + response helpers
```

> [!IMPORTANT]
> `json` belongs to **`uflite`**, not `uflite/nano` or `uflite/lite`. You can use it with a nano/lite router by importing from full, as the examples do; that import also affects bundle size. Nano/lite return raw values or `undefined` for misses, not automatic JSON/404 responses. Only full registers services.

<a id="size-comparison"></a>
## 📊 Size comparison

Measured using `bun run bench:size` (Bun **1.4.3**; minified, browser-target, bundled **one GET `/hello` route returning a Response**, gzip with the benchmark's settings):

| Entry | Minified | Gzip | What it includes |
| :--- | ---: | ---: | :--- |
| `uflite/nano` | **1,385 B** | **799 B** | Routing only |
| `uflite/lite` | **2,470 B** | **1,251 B** | Routing + request hooks |
| `uflite` | **6,134 B** | **2,690 B** | Full framework |
| `hono` 4.10.6 | 19,026 B | 7,623 B | Same one-route fixture |
| `itty-router` 4.2.2 | 1,122 B | 689 B | Same one-route fixture |

Nano is **110 B larger gzip** than itty-router in this fixture; lite/full are smaller than Hono. These are fixture sizes, not throughput or a promise about your app (for example, importing full `json` into nano increases its bundle). Rerun the benchmark after changes; `bun run bench`, `bench:cmp`, `bench:mitata` and `bench:url` measure different performance questions.

<a id="install-and-optional-integrations"></a>
## 📦 Install & optional integrations

```sh
npm install uflite
# or: bun add uflite
# Node Fetch adapter for the quickstarts (NOT a uflite dependency):
npm install @hono/node-server
```

The quickstarts use **Node 22+**. Fetch-compatible Bun, Deno and Workers can call `app.fetch`; see [runtime adapters](#user-content-runtime-adapters). Core `dependencies` is `{}`. Optional peer packages are installed **by your application** when needed:

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

The snippets below are **complete single-file Node servers**. In a new folder: `npm install uflite @hono/node-server`, save one as `server.mjs`, run `node server.mjs`. Keep the import paths shown; do not import `json` from lite/nano.

<a id="quick-start-full-node-server"></a>
### 1 · Full Node server — one route and a real response

```js
// server.mjs · npm install uflite @hono/node-server
import { serve } from '@hono/node-server'
import { flite, json } from 'uflite'

const app = flite()
app.get('/hello/:name', req => json({ hello: req.params.name }))
serve({ fetch: request => app.fetch(request), port: 3000 })
```

`node server.mjs` → `curl localhost:3000/hello/Ada` returns `{"hello":"Ada"}`; `GET /missing` returns the full entry's JSON 404. Pass a Request-only adapter wrapper when you use mode 1 to avoid confusing extra adapter arguments with `next`.

### 2 · Nano — explicit API-key guard and JSON fallback

```js
// server.mjs · npm install uflite @hono/node-server
import { serve } from '@hono/node-server'
import { flite } from 'uflite/nano'
import { json } from 'uflite' // helper is exported by full, NOT nano

const app = flite()
app.use('/tasks/*', req => {
  if (req.headers.get('x-api-key') !== 'demo')
    return json({ error: 'Unauthorized' }, { status: 401 })
})
app.get('/tasks', () => json([{ id: '1', title: 'Ship an API' }]))
app.get('/tasks/:id', req => json({ id: req.params.id, tag: req.query.tag ?? null }))
serve({
  fetch: async req => (await app.fetch(req)) ?? json({ error: 'Not found' }, { status: 404 }),
  port: 3000
})
```

`curl -H 'x-api-key: demo' localhost:3000/tasks` → a JSON array; without the key → 401. Nano does **not** create fallback, formatting or error hooks: implement these explicitly. For the tiniest bundle, avoid importing the full `json` helper and return a native `Response` instead. See [complete CRUD example](examples/01-nano-crud/README.md).

### 3 · Lite — global request hooks (not service hooks)

```js
// server.mjs · npm install uflite @hono/node-server
import { serve } from '@hono/node-server'
import { flite } from 'uflite/lite'
import { json } from 'uflite' // helper is exported by full, NOT lite

const app = flite({
  before: { all: [req => {
    if (!req.headers.get('x-api-key')) return json({ error: 'Key required' }, { status: 401 })
  }] },
  after: { all: [(result, req) => {
    if (result?.headers) result.headers.set('x-powered-by', 'uflite/lite')
    return result
  }] },
  error: { all: [err => json({ error: 'Internal Server Error' }, { status: 500 })] }
})
app.get('/notes', () => json([{ id: '1', text: 'Hello' }]))
serve({ fetch: async req => (await app.fetch(req)) ?? json({ error: 'Not found' }, { status: 404 }), port: 3000 })
```

`curl -i -H 'x-api-key: demo' localhost:3000/notes` → 200 with `x-powered-by`; no key → 401. Lite has **request hooks**, not `app.service` or service hooks. See [standalone notes example](examples/03-lite-notes/README.md).

### 4 · Full — real DBService and service hook

```js
// server.mjs · npm install uflite umosql@0.3.1 @hono/node-server
import { serve } from '@hono/node-server'
import { flite, json, status } from 'uflite'
import { createDBService } from 'uflite/services/db'

const app = flite({
  // The auto-created service REST routes already return Responses.
  format: false,
  error: { all: [err => json({
    error: (err.status || 500) >= 500 ? 'Internal Server Error' : err.message
  }, { status: err.status || 500 })] }
})
const tasks = app.service('tasks', createDBService()) // isolated in-memory collection
// Local demonstration only: add authentication/authorization before exposing these routes!
tasks.hooks({ before: { create: [ctx => {
  if (!ctx.data?.title) throw new status(400, 'title is required')
}] } })
tasks.on('created', task => console.log('created', task._id))
serve({ fetch: request => app.fetch(request), port: 3000 })
```

`curl -i -X POST localhost:3000/tasks -H 'content-type: application/json' -d '{"title":"Ship it"}'` creates a record; `curl localhost:3000/tasks` lists it. For **real sessions, ACL and storage**, copy [example 04](examples/04-full-services/README.md), which is HTTP-tested with Better Auth signup and authenticated CRUD.

<a id="five-runnable-examples"></a>
## 🧪 Five runnable examples

In a checkout, first run **`bun install && bun run build`** at the root. Each project has its own `package.json`, uses `file:../..` for the built checkout, and has documented `curl` success/error flows. They default to port 3000 (`PORT` overrides it).

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

Request factories return `Middleware(request, next?) → Response | void | Promise<…>`; named companions are response-phase functions `(response, request, next?) → Response | Promise<Response>` for `after.all`. In mode 0 with a Node adapter that supplies extra fetch args, wrap optional-next middleware as `req => middleware(req)` (see [example 05](examples/05-full-middleware-resolvers/index.js)).

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

<a id="runtime-adapters"></a>
## 🌐 Runtime adapters

uflite speaks Web `Request`/`Response`; the server/transport is yours. **Node is HTTP-tested here.** Other wiring is illustrative, not a deployment certification:

| Runtime | Minimal wiring after registering `app.get('/', () => json({ok:true}))` |
| :--- | :--- |
| Node 22+ (`@hono/node-server`) | `serve({fetch: request => app.fetch(request),port:3000})` |
| Bun | `Bun.serve({port:3000,fetch: request => app.fetch(request)})` |
| Deno | `Deno.serve(request => app.fetch(request))` (import `uflite` via `npm:uflite`) |
| Cloudflare Workers | `export default {fetch: request => app.fetch(request)}` |
| Hono (`hono` installed separately) | `hono.all('*', c => app.fetch(c.req.raw))` |

```js
// Workers/Bun/Node: for other runtimes change only the import/server line above
import { flite, json } from 'uflite'
const app = flite()
app.get('/', () => json({ ok: true }))
export default { fetch: request => app.fetch(request) } // Workers entry point
```

No Express/Fastify/WebSocket adapter is exported. If an adapter passes extra args to `app.fetch`, mode 1's `next` is **last**, not necessarily second. Some adapters/auth packages produce `Response` objects from another implementation; full's default `instanceof Response` formatter can serialize them as `{}`. Use `flite({format:false})` **only when your routes already return Responses**, as in [example 04](examples/04-full-services/index.js), and verify the adapter you deploy.

<a id="testing-security-and-license"></a>
## 🛡️ Testing, security & license

```sh
bun install --frozen-lockfile
bun run build          # dist is required before package/example checks
bun test               # unit/integration tests
bun run test:types     # public NodeNext declarations + middleware
bun run test:package   # packed ESM, CommonJS, TypeScript consumers
bun run test:examples  # installs/starts five Node projects; tests success and error HTTP flows
bun run bench:size     # reproduce the size table for this toolchain
```

> [!WARNING]
> **Production defaults are intentionally small, not a security policy.** Full's default error hook includes `err.message` even for 5xx; install an error hook that redacts internal details. The compact compiler interprets regex punctuation in paths. Generated service REST endpoints need authentication and authorization. Never trust user-controlled query params as an authenticated identity.

- **Database:** an in-memory DBService is not durable; missing records have `code:404` but not HTTP `status:404`. REST queries are flat, so `$limit` is not automatically nested for DBService pagination.
- **Storage:** local URLs are not authorization tokens. Keep a trusted, private directory; protect raw upload/download routes. For S3 configure provider credentials/CORS and understand that signed PUT does not enforce upload size.
- **Rate/body limits:** process-local rate limiting needs a trusted key and shared/upstream enforcement for multiple instances; body limits need an upstream transport cap.
- **Runtime gaps:** persistent DB, S3 provider, Workers, Deno and browser UI were not deployed in these tests. See the [production follow-up](PRODUCTION_READINESS_REVIEW.md).
- **Contributing:** add regression tests for behavior changes, run the commands above and review optional-integration imports. File defects in [GitHub issues](https://github.com/kethan/uflite/issues).
- **License:** `package.json` declares **ISC**. A matching top-level license file still needs maintainer confirmation; third-party license texts are under [`licenses/`](licenses/).
