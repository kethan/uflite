# uflite

A small Fetch router with three entry points: **nano** for minimal routing, **lite** for global request hooks, and **full** for automatic response formatting, services, events, and channels. Built around the Web `Request` and `Response` APIs. Integrations are optional, not hidden core dependencies.

## Contents

- [Overview](#overview)
- [Choose an entry point](#choose-an-entry-point)
- [Installation and requirements](#installation-and-requirements)
- [Quick start](#quick-start)
- [Five runnable examples](#five-runnable-examples)
- [Routing](#routing)
- [Request handlers and responses](#request-handlers-and-responses)
- [Middleware and hook modes](#middleware-and-hook-modes)
- [Services](#services)
- [Built-in services and integrations](#built-in-services-and-integrations)
- [Resolvers, transformers and predicates](#resolvers-transformers-and-predicates)
- [Events and channels](#events-and-channels)
- [Framework and runtime integration](#framework-and-runtime-integration)
- [API reference](#api-reference)
- [Testing](#testing)
- [Troubleshooting and security](#troubleshooting-and-security)
- [Contributing and license](#contributing-and-license)

## Overview

uflite registers method/path handlers and exposes `app.fetch(request, ...args)`. The router supports named parameters, wildcards, mounted routers, and sequential or onion-style handler execution. Pick only the features you need; the nano/lite entry points do **not** import the full service registry. The core has no required third-party runtime packages. Native Fetch APIs are expected from the host runtime.

A route registration is synchronous; `app.fetch` is asynchronous. Data stores, HTTP servers, auth policies, and WebSocket transports remain application responsibilities. See the [five tested local projects](#five-runnable-examples) instead of copying incomplete pseudocode.

## Choose an entry point

| Capability | `uflite/nano` | `uflite/lite` | `uflite` |
| --- | :---: | :---: | :---: |
| `flite()`, route methods, `use()`, `app.fetch()` | ✓ | ✓ | ✓ |
| Mode 0/1 route handler runner | ✓ | ✓ | ✓ |
| Global `before`/`after`/`error` request hooks | — | ✓ | ✓ |
| Auto JSON for plain objects, default 404/error responses | — | — | ✓ |
| `app.service()`, service hooks, events, channels | — | — | ✓ |
| `json`, `text`, `html`, `response`, `error`, `status` helpers | — | — | ✓ |

```js
import { flite as nano } from 'uflite/nano'
import { flite as lite } from 'uflite/lite'
import { flite, json } from 'uflite'
```

Nano and lite return handler values directly (`undefined` when unmatched); they do not have `app.service()` or export `json`. To use the `json` helper with either router, explicitly import it from **`uflite`**; that also brings the full entry point into your bundle. You can instead construct a native `Response` if minimum bytes matter most. The five examples deliberately use uflite's `json` helper.

## Installation and requirements

```sh
npm install uflite
# or
bun add uflite
```

Node 22+ is used for the runnable examples; `@hono/node-server` is an **optional** Node Fetch adapter (`npm install @hono/node-server`). The library uses Web APIs and can be wired to Bun, Deno, or Workers; see [runtime integration](#framework-and-runtime-integration). These examples and CI do not constitute deployments to every runtime.

**Optional peers are not installed by core-only users.** Install them for the entry point you actually import:

| Import | Additional package(s) |
| --- | --- |
| `uflite`, `/nano`, `/lite`, `/middlewares`, `/hooks`, `/resolvers`, `/transformers`, `/predicates`, `/utils` | None |
| `uflite/services/db` | `umosql@0.3.1` |
| `uflite/services/table`, `uflite/services/localStorage` | None |
| `uflite/services/storage` (local or S3 factory) | `@aws-sdk/client-s3 @aws-sdk/s3-request-presigner` |
| `uflite/services/acl` | `uqry` |
| `uflite/services/auth` | `better-auth` and an application-supplied adapter (e.g. `umosql`) |
| `uflite/services` (eager barrel) | `umosql` **and both** AWS SDK packages |

The barrel imports DB and S3 modules even when using only one service. Individual subpaths avoid loading unrelated packages. `better-auth` and `uqry` are separately imported, never pulled in by `uflite/services`.

## Quick start

Create `server.mjs` after `npm install uflite @hono/node-server`:

```js
import { serve } from '@hono/node-server'
import { flite, json } from 'uflite'

const app = flite()
app.get('/hello/:name', req => json({ hello: req.params.name }))
serve({ fetch: app.fetch, port: 3000 })
```

Run `node server.mjs`, then `curl http://localhost:3000/hello/Ada` → `{"hello":"Ada"}`. `GET /missing` returns the full entry point's JSON 404. The Node adapter is not a core dependency.

## Five runnable examples

**Local checkout setup, once:** from the repository root, run `bun install && bun run build`. Each project has its own `package.json` and installs this checkout via `file:../..` plus its listed optional packages. Then run the following commands in separate terminals (all default to port 3000; set `PORT` to change it). The linked READMEs include complete `curl` CRUD/error sequences and expected results.

| Example | Use it for | Run from repository root |
| --- | --- | --- |
| [01 — Nano CRUD](examples/01-nano-crud/README.md) | In-memory CRUD, parameters, JSON wrapper, explicit 400/404/500 handling | `cd examples/01-nano-crud && npm install && npm start` |
| [02 — Nano practical](examples/02-nano-practical/README.md) | Query filtering, API-key guard, `use()` and mounted router | `cd examples/02-nano-practical && npm install && npm start` |
| [03 — Lite notes](examples/03-lite-notes/README.md) | Before/after/error request hooks and standalone in-memory notes module | `cd examples/03-lite-notes && npm install && npm start` |
| [04 — Full services](examples/04-full-services/README.md) | DBService, real Better Auth session, ACL, local/S3 StorageService | `cd examples/04-full-services && npm install && npm start` |
| [05 — Full lifecycle](examples/05-full-middleware-resolvers/README.md) | Middleware → service hooks → resolver → event → response | `cd examples/05-full-middleware-resolvers && npm install && npm start` |

For example, the [Nano CRUD source](examples/01-nano-crud/index.js) registers `router.post('/tasks', async req => { /* validate, store, return json(..., {status:201}) */ })` and wraps `router.fetch(req)` to format plain results and catch errors. The [full services source](examples/04-full-services/index.js) instead calls `app.service('tasks', createDBService())` and leaves CRUD to DBService. These are real projects, not standalone fragments.

**StackBlitz:** each directory has an entry point and `package.json`, but its local `file:../..` dependency requires the whole repository checkout (and a built `dist/`). No StackBlitz project was opened/tested and no direct StackBlitz links are asserted here. Use the local commands above; switch to a published build before importing a single subfolder into StackBlitz. Links can be added once their runnable branch/package setup is verified.

## Routing

Route methods accept `(path, ...handlers)` and return the app for chaining. Methods are case-insensitive at registration; `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`, `ALL`, and lowercase aliases are available. The path is matched against the URL pathname; `req.params` contains named captures, and `req.query` is a flat object with repeated query keys represented as arrays.

```js
import { flite, json } from 'uflite'
const app = flite()
app.get('/tasks/:id', req => json({ id: req.params.id, tag: req.query.tag }))
app.all('/health', () => json({ ok: true }))
app.get('/files/*', () => json({ category: 'files' }))
```

`/tasks/:id` matches one segment; `/files/*` covers deeper paths and the prefix. Use `app.use('/api', child)` to mount another uflite router's registered routes under a prefix, as in [example 02](examples/02-nano-practical/index.js). `app.use('/api/*', handler)` registers an `ALL` middleware route; register it before the protected route. The route compiler is intentionally **small** and interprets regexp punctuation in literal paths (e.g. `.`) as regex syntax; do not use untrusted route definitions or assume regexp-special characters are escaped. Named `:id?` behavior is also regex-derived. See `plugins.js` and tests for exact matching semantics.

Nano/lite can accept an optional `match({method,path})` function returning `{handlers, params?}` instead of registered route lookup. Lite runs matched handlers through its after hooks; nano returns the matcher result directly. [Trouter/Hono adapters](tests/hono-router.spec.js) need to normalize external matcher results to this contract. Do not assume a matcher is a service or HTTP adapter.

## Request handlers and responses

Mode 0 handler: `(request, ...adapterArgs) => value | Promise<value>`. Mode 1 handler: `(request, ...adapterArgs, next) => value | Promise<value>`. A `request` is a Web `Request` augmented with `params`/`query`; construct a `Response` with the full-package helpers:

```js
import { json, text, html, response, error, status } from 'uflite'
json({ ok: true }, { status: 201 })                // application/json Response
text('hello')                                       // text/plain Response
html('<strong>hello</strong>')                     // text/html Response
response('text/csv')('name\nAda')                  // configured content type
error(404, 'Not found')                            // {status:404,error:'Not found'}
throw new status(401, 'Sign in first')             // caught by full default error hook
```

`json`, `text`, `html`, and `response` return an existing `Response` unchanged; `json(undefined)` yields `undefined`. Full uflite converts other values to JSON and makes a 404 when no response is produced. Nano/lite do neither; [example 01's wrapper](examples/01-nano-crud/index.js) demonstrates explicit formatting, missing-route and thrown-error handling. Full's **default error hook includes `err.message`, including 5xx**. If messages can contain secrets, supply your own `error` hook that logs internally and redacts 5xx, as in examples 04/05. A custom matcher, `format: false`, or hook may alter formatting; test your actual configuration.

## Middleware and hook modes

- **Mode 0 (default):** handlers run sequentially until a non-null return; no `next()` is passed by uflite itself. Nano can continue to later matching routes when the earlier handlers return `undefined`.
- **Mode 1:** a runner calls the first handler with `next` appended after any adapter args. A handler must call `await next()` to continue. The handler chain unwinds in onion order; returning a value without calling `next()` short-circuits it. Do not call `next()` twice.
- **Global hooks (lite/full):** `before.all`, then `before[method]` run before route matching; `after[method]`, then `after.all` transform the result; `error[method]`, then `error.all` handle thrown errors. They are **request hooks**, not the `app.hooks()`/`service.hooks()` lifecycle.

```js
import { flite, json } from 'uflite'
const app = flite({
  mode: 1,
  before: { all: [async (req, next) => {
    if (!req.headers.get('authorization')) return json({ error: 'Unauthorized' }, { status: 401 })
    await next()
  }] }
})
app.get('/secret', () => json({ value: 42 }))
// app.fetch(new Request('https://example.test/secret', { headers: { authorization: 'demo' } }))
```

The example above calls `app.fetch(request)` directly with **no extra adapter args**. Some Node adapters supply an extra argument to `app.fetch`, so `next` is then the *last* argument, not necessarily the second one. For mode 0 optional-`next` middleware, wrap the middleware as `req => middleware(req)` so an adapter argument is not mistaken for `next`; see [example 05](examples/05-full-middleware-resolvers/index.js).

`uflite/middlewares` provides paired request/response factories. For example, `requestId()` in `before.all` and `requestIdAfter` in `after.all` attach a response header. Their public factory options are:

| Request factory | Key options | Response-phase companion |
| --- | --- | --- |
| `cors(options?)` | `origin`, `methods`, `credentials`, `allowedHeaders`, `exposedHeaders`, `maxAge` | `corsAfter` |
| `logger(options?)` | `format: 'dev' \| 'combined' \| 'json'`, `skip(req)` | `loggerAfter` |
| `rateLimit(options?)` | `windowMs`, `max`, `keyGenerator(req)`, `standardHeaders` | `rateLimitAfter` |
| `bearerAuth(options?)` | `token` or `verify(token)`, `realm` | — |
| `basicAuth({users,realm?})` | user/password map | — |
| `bodyLimit({max?})` | bytes or e.g. `'10mb'` | — |
| `secureHeaders(options?)` | CSP, frame, HSTS, content-type, referrer settings | `secureHeadersAfter` |
| `requestId(options?)` | `header`, `generator()` | `requestIdAfter` |

The rate limiter is process-local; without `keyGenerator`, all requests share an `unknown` bucket rather than trusting spoofable forwarding headers. `bodyLimit` measures streamed bytes on a clone and should be paired with an upstream transport cap. See [middleware declarations](middlewares.d.ts) and [middleware tests](tests/middleware.spec.js).

## Services

Only the **full** entry point exposes `app.service(name, implementation)` for registration and `app.service(name)` for lookup. Standard methods are `find(params)`, `get(id, params)`, `create(data, params)`, `update(id, data, params)`, `patch(id, data, params)`, `remove(id, params)`. Methods present on the implementation get HTTP routes (`GET /name`, `GET /name/:id`, `POST /name`, `PUT /name/:id`, `PATCH /name/:id`, `DELETE /name/:id`), **automatically**. Authenticate those routes before using the service with sensitive data. Custom implementation methods are hookable direct-call methods; register an HTTP route for them explicitly if desired.

```js
import { flite } from 'uflite'
const app = flite()
const counter = app.service('counters', {
  async find() { return [{ id: 1, value: 2 }] },
  async increment() { return 3 }
})
const rows = await counter.find()                  // direct call; no HTTP required
const value = await counter.increment()             // custom method (not auto-routed)
```

`service.hooks({before, after, error})` and `app.hooks({before, after, error})` receive a mutable `context` with `app`, `service`, `path`, `method`, `params`, optional `id`/`data`, then `result` or `error`. For success, order is app.before.all → app.before.method → service.before.all → service.before.method → implementation → service.after.method → service.after.all → app.after.method → app.after.all. Implementation failures invoke service.error.method/all, then app.error.method/all, and rethrow. A before-hook error does not go through those method-error hooks. In mode 0 service hooks advance automatically; in mode 1 hooks must call `next()` to continue. See [hook specification](docs/HOOK_SPEC.md) and [example 05](examples/05-full-middleware-resolvers/index.js).

`service.on('created'|'updated'|'patched'|'removed', fn)` listens to successful mutating methods. `service.setup()` is invoked at registration; `app.teardown()` invokes service teardown hooks but does **not await** asynchronous cleanup (use `await service.teardown()` directly where you need a completion guarantee). These hooks/events are not a WebSocket transport.

## Built-in services and integrations

| Factory / import | Responsibility, methods and requirements |
| --- | --- |
| `createDBService(provider?, options?)` from `uflite/services/db` | CRUD via a UMOSQL collection; `umosql` required. No provider creates an isolated **in-memory** collection. `find({query:{$limit,$skip,$select,$sort},paginate?})` returns `{total,limit,skip,data}` unless `paginate:false`. `paginate:{default,max}`, `multi`, `idField`, `initialData` configure behavior. Persist with a real collection provider; see [DB tests](tests/db.spec.js). |
| `createAuth({adapter,baseURL,secret,...})` from `uflite/services/auth` | Wraps Better Auth using `sqlAdapterFactory`; `better-auth` and a compatible `adapter.collection()` implementation required. Returns Better Auth's `handler` and API; **not** an automatic uflite service. `trustedOrigins`, `emailAndPassword`, optional built-in `plugins`, `secondaryStorage`, `adapterConfig` can be passed. See [example 04](examples/04-full-services/index.js). |
| `createACL({enabled,rules})` from `uflite/services/acl` | `acl.can(context, 'role:resource:method')` checks policy rules (OR), optional `check` via `uqry`; install `uqry`. Disabling ACL allows everything; authorize from trusted user data, not query strings. |
| `createTableService(db)` from `uflite/services/table` | Schema/DDL management (`find`, `get`, `create`, `patch` add/rename/modify/drop column, `remove`) for an adapter implementing the corresponding table operations. No integration import, but requires a configured DB adapter and strict authorization; backend may not support all DDL. |
| `createStorageService(options?)` or `createStorage(options?)` from `uflite/services/storage` | `type:'local'` (default, `basePath`, `maxFileSize`, `publicUrl`) or `type:'s3'` (`bucket`, `region`, credentials, optional `endpoint`). Factory imports two AWS SDK packages even for local mode; install them. For local-only projects without AWS SDK, import `createLocalStorageService` from `uflite/services/localStorage`. Methods include `find/get/create/remove`, `upload/download`, `presignUpload/presignDownload`. |

Storage's local raw HTTP routes include `PUT /storage?key=...` and `GET /storage/download?key=...` if registered as `storage`. Local presign URLs are convenience links, **not** signed authorization tokens; protect both upload/download routes. For S3, `POST /storage/presign` produces a signed PUT URL and `/presign-download` a signed GET URL; configure bucket CORS, endpoint, bucket, credentials, and provider. Signed PUT cannot enforce file size. Local files are single-instance storage; keep the directory private. See [storage tests](tests/storage.spec.js) and [example 04](examples/04-full-services/README.md).

Note: built-in service HTTP routes currently pass the **flat** `request.query` as `params`, while direct DBService `find` expects `params.query` for its pagination operators. Do not assume REST `$limit` maps to DBService pagination without an adapter. DBService's missing-record errors set `code:404`, not HTTP `status`; supply a mapping error hook if you need HTTP 404 for that case. These are known integration limits, not example-specific pagination rewrites.

## Resolvers, transformers and predicates

These helpers are exported through `uflite/resolvers`, `uflite/transformers`, and `uflite/predicates` (and as namespaces from full `uflite`). They do **not** automatically run: call them in a route, in a service hook, or from your own field mapping.

```js
import { fromPath } from 'uflite/resolvers'
import { trimStrings } from 'uflite/transformers'
import { isNonEmptyString } from 'uflite/predicates'

const name = fromPath('profile.name', { fallback: 'Anonymous' })(null, { profile: { name: 'Ada' } })
const cleaned = trimStrings({ fields: ['name'] })({ name: '  Ada  ' })
const valid = isNonEmptyString(cleaned.name) // true
```

Resolvers have field signature `(current, object, context?)`; `fromPath`, `fromContext`, `fallback`, `lookup`, `resolveIf`, `mapArray`, `join`, `count`, `sum`, and relation helpers are implemented. This is **not** a wrapper for `uresolver.resolve`/`virtual`. Transformers (e.g. `trimString`, `normalizeEmail`, `pick`, `omit`, `mapFields`, `trimStrings`, `setDefaults`) transform values; predicates (e.g. `isPresent`, `isEmail`, `hasPath`, `all`, `any`) return booleans, sometimes asynchronously. [Example 05](examples/05-full-middleware-resolvers/index.js) uses all three families in a service lifecycle.

Generic service hooks are public at `uflite/hooks` (also re-exported by full `uflite`): flow `iff`, `unless`, `throwIf`, `disallow`, `setData`, `setResult`; data `requireFields`, `setDefaults`, `transformData`, `validateData`, `preventChanges`, field/query helpers; auth `requireAuth`, `requireRole`, `requirePermission`, `requireOwner`, `scopeToActor`, `requireMethod`, `rateLimit`; lifecycle `auditFields`, `publishEvent`, `sideEffect`, `debug`; result `transformResult`, `pickResultFields`, `omitResultFields`, `mapResult`. They take a **service context**, not a raw Request. The auth-hook `rateLimit(consume, options?)` is different from HTTP middleware `rateLimit(options?)`. Full signatures and error options are in [HOOK_SPEC.md](docs/HOOK_SPEC.md), with [worked patterns](docs/REAL_WORLD_HOOKS.md).

## Events and channels

Full `app.on(event, fn)`, `app.off(event, fn)`, `app.emit(event, ...args)` are synchronous in-process events. `app.channel(name)` returns an in-process connection set with `join(connection, data?)`, `leave(connection)`, `send(event, data)`, and `filter(predicate).send(event, data)`. Connections must supply `.send(string)`; uflite JSON-encodes `{event,data}`. It does not upgrade sockets or persist/broadcast across instances.

```js
import { flite } from 'uflite'
const app = flite()
app.on('ready', count => console.log(count))
app.emit('ready', 1)
const socket = { send: value => console.log(value) } // supply a real socket in production
app.channel('updates').join(socket, { room: 'demo' }).send('created', { id: 1 })
app.channel('updates').filter(meta => meta.room === 'demo').send('tick', { n: 2 })
app.channel('updates').leave(socket)
```

## Framework and runtime integration

These snippets show **adapter wiring**, not claims of CI coverage on every runtime. Register handlers first and use `app.fetch` with a Web Request:

```js
// Cloudflare Workers / Fetch-compatible worker; full app returns a Response
import { flite, json } from 'uflite'
const app = flite()
app.get('/', () => json({ ok: true }))
export default { fetch: request => app.fetch(request) }
```

```js
// Bun (install uflite; Bun provides Bun.serve)
import { flite, json } from 'uflite'
const app = flite()
app.get('/', () => json({ ok: true }))
Bun.serve({ port: 3000, fetch: request => app.fetch(request) })
```

```js
// Deno (npm: package specifier)
import { flite, json } from 'npm:uflite'
const app = flite()
app.get('/', () => json({ ok: true }))
Deno.serve(request => app.fetch(request))
```

```js
// Node 22+: npm install uflite @hono/node-server
import { serve } from '@hono/node-server'
import { flite, json } from 'uflite'
const app = flite()
app.get('/', () => json({ ok: true }))
serve({ fetch: app.fetch, port: 3000 })
```

For a Hono wrapper (`npm install hono`), register Hono middleware first, then forward its raw Fetch Request:

```js
import { Hono } from 'hono'
import { flite, json } from 'uflite'
const api = flite()
api.get('/hello', () => json({ hello: 'uflite' }))
const hono = new Hono()
hono.use('*', async (c, next) => { console.log(c.req.path); await next() })
hono.all('*', c => api.fetch(c.req.raw))
export default hono
```

No built-in Express/Fastify adapter is exported. If an adapter passes extra arguments to `app.fetch`, see [mode signatures](#middleware-and-hook-modes) before using `(req, next)` middleware.

## API reference

Public `package.json` exports and their entry points (names below are checked against source and declarations):

| Import path | Main public API / shape |
| --- | --- |
| `uflite/nano` | `flite({routes?,mode?,match?})`, default `flite`; `app.fetch(request,...args)` returns the raw result or `undefined` |
| `uflite/lite` | `flite({routes?,mode?,before?,after?,error?,match?})`, default `flite`; raw result + global request hooks |
| `uflite` | `flite({format?,missing?,before?,after?,error?,...})`, default `flite`; response helpers, `run`, generic hooks and helper namespaces, services/events/channels |
| `uflite/middlewares` | `cors/corsAfter`, `logger/loggerAfter`, `rateLimit/rateLimitAfter`, `bearerAuth`, `basicAuth`, `bodyLimit`, `secureHeaders/secureHeadersAfter`, `requestId/requestIdAfter` |
| `uflite/hooks` and `/flow`, `/data`, `/auth`, `/lifecycle`, `/result` | Service-context hook factories; see [hook specification](docs/HOOK_SPEC.md) |
| `uflite/predicates`, `/transformers`, `/resolvers`, `/utils` | Value helpers (e.g. `isEmail(value)`, `trimString(value)`, `fromPath(path)(current,object,context)`, `isObject(value)`); see [helpers](#resolvers-transformers-and-predicates) |
| `uflite/services` | Barrel: `createDBService`, `createTableService`, `createStorageService`, `createStorage`; eager DB + AWS imports |
| `uflite/services/db`, `/table`, `/storage`, `/localStorage` | Individual factories (respectively `createDBService`, `createTableService`, `createStorageService`/`createStorage`, `createLocalStorageService`) |
| `uflite/services/auth`, `/acl` | `createAuth({adapter,baseURL,secret,...})`, `sqlAdapterFactory(base,config?)`; `createACL({enabled,rules})` |
| `uflite/package.json` | Published package metadata |

`run(mode?)(...handlers)(...args)` is the full entry's low-level Promise-returning handler runner; most apps should register routes rather than call it directly. `response(contentType, transform?)(body, responseOptions?)` builds typed responses; `status(statusCode, message?, data?)` is the thrown error class. The [response section](#request-handlers-and-responses) shows calls.

Route methods: `app.get/post/put/patch/delete/head/options/all(path, ...handlers)` (uppercase aliases too), `app.use(handler | path, ...handlers | router)`, `app.fetch(request,...args)`. `nano` exposes `routes`; lite/full also use `before/after/error` configuration. Full additionally has `app.service(name, service?)`, `app.hooks({before?,after?,error?})`, `app.teardown()`, `app.on/off/emit`, and `app.channel(name)`. See [routing](#routing), [service context](#services), and [events](#events-and-channels) for signatures and working calls. Type declarations are published with each subpath; `bun run test:types` checks a NodeNext consumer. Supported runtime return values can include non-Response values for nano/lite, even though the minimal `FliteApp.fetch` declaration is narrower.

## Testing

```sh
bun install --frozen-lockfile
bun run build          # creates ignored dist/; required before export tests
bun test               # unit/integration suite
bun run test:types     # source + public NodeNext type checks
bun run test:package   # packed ESM/CommonJS/TS consumer
bun run test:examples  # installs each example, launches its server, checks HTTP success/error flows
```

`check-examples.js` launches each project's **documented** Node command and exercises HTTP success/error requests, CRUD where applicable, Better Auth signup, ACL-protected DBService and local storage. To add a service test, add a `tests/*.spec.js` using `bun:test` and a small in-memory implementation; for middleware test both allowed and denied flows and verify response headers. Do not run the export tests before `build` on a fresh checkout. Bundle size and throughput can be measured separately with `bun run bench:size` / `bun run bench`; numbers vary by toolchain and fixture.

## Troubleshooting and security

- **`uflite/lite` has no `json` export:** import `json` from `uflite`, or use a native Response. Only full `uflite` has `app.service()` and automatic 404/formatting.
- **Unexpected missing route:** nano/lite return `undefined` without a fallback; full returns a 404 by default. Register `use()` guards before routes. Avoid regexp-special characters in literal route paths with the deliberately compact compiler.
- **`next is not a function`:** in mode 0 uflite does not inject `next`; adapters can still pass an extra argument. Wrap optional-next middleware as `req => middleware(req)`, or use mode 1 and handle `next` as the last argument.
- **Security defaults:** full's default error hook returns `err.message`, including 500s. Redact 5xx with an application hook if sensitive errors are possible. Service REST routes are created automatically; add authentication and authorization. Never authorize from arbitrary query fields. Example API keys/secrets are for local demonstrations only.
- **Production storage/rate limits:** local files and in-memory data are not multi-instance persistence. Use trusted storage roots, access controls, shared rate limits, upstream body caps, and provider CORS/credentials for S3. `rateLimit`'s default shared bucket is not an IP identity.
- **Missing integration package:** import individual `/services/*` subpaths and install their [optional peers](#installation-and-requirements). The `uflite/services` barrel requires both DB and AWS SDK packages to load.
- **HTTP adapter and Response realms:** some Node adapters/auth integrations may return Response objects from different implementations. If your app's routes all return Responses, `flite({format:false})` prevents full's default `instanceof Response` formatter from serializing a foreign Response to `{}` (see [example 04](examples/04-full-services/index.js)). Test your actual adapter.

## Contributing and license

Contributions: build, run the suite and packed/example checks above, and add regression tests for behavior changes. The package declares **ISC** in `package.json`; confirm the intended project license with the maintainer and add a matching top-level license file before publishing. Third-party hooks licensing text lives under [`licenses/`](licenses/). Report defects at [GitHub issues](https://github.com/kethan/uflite/issues).
