# uflite

**A lightweight, Fetch-first router and Feathers-inspired service framework for JavaScript.**
Use `nano` for routing, `lite` for request hooks, or the full entry for response formatting,
a service registry, automatic REST routes, global and per-service hooks, service events,
channels, reusable data hooks, predicates, transformers, resolvers, and optional database,
authentication, ACL, and storage integrations.

The core has **zero mandatory runtime dependencies**. Use the layers you need; the full
service and integration features do not force every application to install every adapter.

[![Tests](https://github.com/kethan/uflite/actions/workflows/node.js.yml/badge.svg)](https://github.com/kethan/uflite/actions/workflows/node.js.yml) [![npm](https://img.shields.io/npm/v/uflite?style=flat-square)](https://www.npmjs.com/package/uflite) [![License: ISC](https://img.shields.io/badge/license-ISC-blue?style=flat-square)](#license-and-contributing)

## Contents

- [Installation](#installation)
- [Choose an entry point](#choose-an-entry-point)
- [Size comparison](#size-comparison)
- [Core concepts and API surface](#core-concepts-and-api-surface)
- [Quick start](#quick-start)
- [Build a REST API](#build-a-rest-api)
- [Features](#features)
- [Routing, dispatch, and request hooks](#routing-dispatch-and-request-hooks)
- [Custom matchers](#custom-matchers)
- [Fetch runtimes and server adapters](#fetch-runtimes-and-server-adapters)
- [Browser SPA and React SPA](#browser-spa-and-react-spa)
- [Core API at a glance](#core-api-at-a-glance)
- [Feathers-like service layer](#feathers-like-service-layer)
  - [Register a service](#register-a-service)
  - [Beginner example: Notes CRUD](#beginner-example-notes-crud)
  - [Write your own service](#write-your-own-service)
  - [Automatic REST routes](#automatic-rest-routes)
  - [Global and per-service hooks](#global-and-per-service-hooks)
  - [Lifecycle order and error behavior](#lifecycle-order-and-error-behavior)
  - [Service events and custom methods](#service-events-and-custom-methods)
- [Built-in services and integrations](#built-in-services-and-integrations)
  - [DBService](#dbservice)
  - [Authentication and ACL](#authentication-and-acl)
  - [Table service](#table-service)
  - [Local and S3-compatible storage](#local-and-s3-compatible-storage)
- [Reusable hooks, transformers, predicates, and resolvers](#reusable-hooks-transformers-predicates-and-resolvers)
- [HTTP middleware](#http-middleware)
- [Write your own middleware and hooks](#write-your-own-middleware-and-hooks)
- [DBService without UMOSQL: a plain JavaScript alternative](#dbservice-without-umosql-a-plain-javascript-alternative)
- [Events and channels](#events-and-channels)
- [Example coverage](#example-coverage)
- [Additional patterns and edge cases](#additional-patterns-and-edge-cases)
- [Production checklist](#production-checklist)
- [Security and limitations](#security-and-limitations)
- [Development and bundle size](#development-and-bundle-size)
- [License and contributing](#license-and-contributing)

## Installation

```bash
bun add uflite
# Or, in another Fetch-compatible runtime:
npm install uflite
```

uflite uses Web `Request` and `Response`. The core needs **no Hono, Node server adapter, or HTTP
listener**. Bun, Deno, and Cloudflare Workers provide Fetch hosts; Node applications can choose a
Fetch-compatible host such as Hono with `@hono/node-server`. Database, authentication, ACL, and
storage integrations are opt-in; install only the packages required by the features you use.

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

Do not put secrets in deliberate 4xx errors, either. The corresponding runnable repository sample uses the introductory wrapper and links back
to this alternative.

</details>


## Size comparison

Measured with `bun run bench:size` using Bun 1.4.3: browser-target, minified, bundled single-route fixtures (one `GET /hello` route returning a `Response`), then gzip. These are **fixture sizes**, not whole-app sizes or throughput claims.

| Entry / router | Minified | Gzip | Included in fixture |
| :--- | ---: | ---: | :--- |
| `uflite/nano` | 1,363 B | 797 B | Routing only |
| `uflite/lite` | 2,442 B | 1,249 B | Routing + global request hooks |
| `uflite` | 6,330 B | 2,764 B | Full router + response/service framework |
| Hono 4.10.6 | 19,026 B | 7,623 B | Same one-route fixture |
| itty-router 4.2.2 | 1,122 B | 689 B | Same one-route fixture |

Nano is 108 B larger gzip than itty-router in this fixture. Lite/full are smaller than Hono in this fixture. These comparisons are only meaningful for the same benchmark and toolchain; importing `json` from full alongside nano/lite increases the resulting bundle. Reproduce the numbers with `bun run bench:size`.

## Core concepts and API surface

Start with the router; add the optional service factories only when you need them. All three entry
points expose the same core routing model and work with Fetch `Request` objects.

### Route registration and dispatch

```js
import { flite } from 'uflite' // or 'uflite/lite' / 'uflite/nano'

const app = flite()
app.get('/health', request => ({ ok: true }))
app.get('/users/:id', request => ({ id: request.params.id }))
app.post('/users', async request => ({ created: await request.json() }))
app.all('/debug/*', request => ({ method: request.method, path: new URL(request.url).pathname }))

const response = await app.fetch(new Request('https://example.test/users/42'))
```

Available route methods are `get`, `post`, `put`, `patch`, `delete`, `head`, `options`, and `all`
(uppercase aliases also work). `app.use(handlerOrRouter)` adds middleware or mounts a child router;
`app.use('/api', child)` mounts child routes under a prefix. Route params are on `request.params`.
Query parameters are exposed as a flat `request.query` object; repeated keys can become arrays.
A custom `match({ method, path })` callback returns `{ handlers, params? }`; see the examples below.

### Execution modes

| | `mode: 0` (default) | `mode: 1` |
| :--- | :--- | :--- |
| Flow | Sequential; first non-`null`/non-`undefined` result stops | Onion-style; handlers explicitly call `next()` |
| Handler shape | `(request, ...hostArgs) => result` | `(request, ...hostArgs, next) => result` |
| Best for | Simple endpoints and fall-through handlers | Middleware that runs before and after downstream work |

```js
import { flite, json } from 'uflite'
const app = flite({ mode: 1 })
app.get('/private', async (request, next) => {
  if (!request.headers.get('authorization')) return json({ error: 'Unauthorized' }, { status: 401 })
  await next()
}, () => json({ ok: true }))
```

### Response and error helpers (full entry only)

```js
import { flite, json, text, html, response, error, status } from 'uflite'

const app = flite()
app.get('/json', () => json({ ok: true }))
app.get('/text', () => text('Hello'))
app.get('/html', () => html('<strong>Hello</strong>'))
app.get('/missing', () => error(404, 'Not found'))
app.get('/invalid', () => { throw new status(400, 'Invalid input') })
```

Full uflite formats plain values as JSON and supplies default missing-route/error handling. Nano and
lite return raw values (or `undefined` on a miss); use native `Response` values or add a wrapper when
you need HTTP responses. The full entry's default error response includes `err.message`, even for
5xx errors—replace it with a redacting error hook before production.

## Quick start

Install uflite:

```bash
bun add uflite
# or
npm install uflite
```

Create one file named `app.js`:

```js
import { flite } from 'uflite'

const app = flite()

app.get('/api/health', () => ({ ok: true }))
app.get('/api/hello/:name', req => ({
  message: `Hello, ${req.params.name}`,
  query: req.query
}))

Bun.serve({
  port: Number(Bun.env.PORT || 3000),
  fetch: app.fetch
})

console.log('Listening on http://localhost:3000')
```

Run and test it:

```bash
bun app.js
curl -i http://localhost:3000/api/health
curl 'http://localhost:3000/api/hello/Ada?from=docs'
```

The full entry automatically formats plain values as JSON and provides a default JSON 404.
The same Fetch handler can be deployed to a compatible runtime; Bun is only the local HTTP
server in this quick start.


## Build a REST API

For a small API without a database dependency, **replace `app.js`** with the following. The
in-memory `Map` is application data, not a uflite service. It resets when the server restarts.
Append the `Bun.serve` call below to the same `app.js` file.

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

Bun.serve({
  port: Number(Bun.env.PORT || 3000),
  fetch: app.fetch
})
```

| Method | Resource | This starter does |
| :--- | :--- | :--- |
| `GET` | `/api/tasks` | List; optional `?done=true` or `false` |
| `GET` | `/api/tasks/:id` | Get one task |
| `POST` | `/api/tasks` | Create; **201**, JSON and `Location` |
| `PATCH` | `/api/tasks/:id` | Change `title` and/or `done`; **200** |
| `DELETE` | `/api/tasks/:id` | Delete; **204**, no body |

Try it in another terminal after `bun app.js`:

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
register `PUT`; use [DBService](#dbservice) when you need its built-in filtering, sorting,
projection, and pagination behavior.

## Features

uflite is intentionally layered. It can be a tiny router, or the HTTP and service layer for a
larger application.

| Capability | Included | Where it lives |
| --- | --- | --- |
| Fetch-first routing | Path parameters, query parsing, method routes, route mounting, custom matchers | `uflite/nano`, `uflite/lite`, `uflite` |
| Dispatch modes | Simple first-result dispatch or explicit `next()` onion flow | All three router entries |
| Request lifecycle | Global `before`, `after`, and `error` hooks | `uflite/lite`, `uflite` |
| Response handling | JSON, text, HTML, status-aware errors, default 404 and formatting | `uflite` |
| Feathers-like services | Service registry, standard CRUD methods, automatic REST routes, custom methods | `uflite` |
| Service lifecycle | Global and per-service before/after/error hooks, setup/teardown, mutation events | `uflite` |
| Data/business hooks | Validation, defaults, field filtering, auth checks, ownership, rate limits, side effects, audit fields | `uflite/hooks` |
| Data transformation | Normalize strings, email, whitespace, numbers, booleans, arrays, object fields and paths | `uflite/transformers` |
| Field resolution | Resolve paths/context, relations, arrays, fallbacks, redaction, aggregates | `uflite/resolvers` |
| Predicates | Type checks, comparisons, string/array checks, path checks, async combinators | `uflite/predicates` |
| HTTP middleware | CORS, logging, bearer/basic auth, rate limiting, body limits, security headers, request IDs | `uflite/middlewares` |
| Database service | Feathers-style find/get/create/update/patch/remove and pagination | `uflite/services/db` |
| Authentication | Better Auth integration and adapter factory | `uflite/services/auth` |
| Access control | Role/resource/method permission rules | `uflite/services/acl` |
| Table management | List tables, inspect schemas, create tables, alter columns, drop tables | `uflite/services/table` |
| File storage | `createLocalStorageService` (no AWS SDK) and `createStorageService` (local/S3-compatible uploads, downloads, and presigning) | `uflite/services/local-storage`, `uflite/services/storage` |
| Events and channels | In-process application events, service mutation events, connection groups | Full `uflite` entry |

The following sections show the service model and reusable feature modules directly. You do not need
to learn every layer before building a useful app.

## Routing, dispatch, and request hooks

All entries support route registration and mounting. `:param` captures a path segment; query
parameters are available as a flat `request.query` object. Repeated non-empty query keys may
become arrays.

```js
import { flite, json } from 'uflite'

const app = flite()

app.get('/api/users/:id', req => json({
  id: req.params.id,
  tag: req.query.tag
}))

const v1 = flite().get('/users', () => [{ id: '1' }])
app.use('/api/v1', v1)
```

`app.use('/api/v1', child)` mounts a router under a prefix. `app.use('/private/*', guard)` adds
an all-method route; register guards before the protected routes.

| Behavior | `mode: 0` (default) | `mode: 1` |
| --- | --- | --- |
| Handler signature | `(request, ...adapterArgs)` | `(request, ...adapterArgs, next)` |
| Continue dispatch | A `null`/`undefined` result lets dispatch continue | Call `await next()` explicitly |
| Best for | Compact route handlers and simple guards | Middleware that needs code before and after downstream handlers |

In mode 1, `next` is the **last** argument. When a Fetch host supplies extra arguments, do not
mistake an adapter argument for `next`. For middleware that accepts optional `next`, wrap it as
`req => middleware(req)` when registering it in mode 0.

Lite and full request hooks use method keys such as `all`, `get`, and `post`:

```js
import { flite } from 'uflite/lite'
import { json, error } from 'uflite'

const app = flite({
  before: {
    all: [req => { req.startedAt = Date.now() }]
  },
  after: {
    all: [(result, req) => {
      if (!(result instanceof Response)) return result
      const headers = new Headers(result.headers)
      headers.set('x-duration-ms', String(Date.now() - req.startedAt))
      return new Response(result.body, {
        status: result.status,
        statusText: result.statusText,
        headers
      })
    }]
  },
  error: {
    all: [err => error(err.status || 500, err.status >= 500
      ? 'Internal Server Error'
      : err.message)]
  }
})

app.get('/health', () => json({ ok: true }))
```

Request hooks operate on the HTTP request/response flow. They are different from service hooks,
which receive a mutable service context and are described next.

## Custom matchers

Use `flite({ match })` when you want to keep uflite's handler execution and hooks but supply your
own path-matching logic. The callback receives only `{ method, path }` and returns either
`{ handlers, params? }` or no match. `params` is copied to `request.params`; each handler receives
the request first. No external router is required.

### 1. A small custom matcher with path parameters

```js
import { flite, json } from 'uflite'

const match = ({ method, path }) => {
  if (method === 'GET' && path === '/health') {
    return { handlers: [() => json({ ok: true })] }
  }

  const user = method === 'GET' && /^\/users\/([^/]+)$/.exec(path)
  if (user) {
    return {
      params: { id: decodeURIComponent(user[1]) },
      handlers: [request => json({ id: request.params.id })]
    }
  }

  return undefined
}

const app = flite({ match })
export default app
```

Test directly without opening a port:

```js
const response = await app.fetch(new Request('https://example.test/users/42'))
console.log(await response.json()) // { id: '42' }
```

**Important fallback difference:** nano bypasses its registered-route loop whenever `match` is set—even
when the custom matcher returns no handlers. Lite and full fall back to registered routes when the
custom matcher has no handlers. Keep all routing in the custom matcher when using nano, or choose
lite/full if you intentionally want fallback routes.

### 2. Adapt a Hono router matcher

This example uses Hono's `PatternRouter` as the matcher only; it does **not** run Hono as the HTTP
server. Hono is an optional dependency in your application:

```sh
bun add hono
```

```js
import { PatternRouter } from 'hono/router/pattern-router'
import { flite, json } from 'uflite'

const external = new PatternRouter()
external.add('GET', '/users/:id', request => json({ id: request.params.id }))

const match = ({ method, path }) => {
  const [matches, stash = []] = external.match(method, path)
  if (!matches.length) return undefined

  return {
    handlers: matches.map(([handler, paramMap = {}]) => request => {
      request.params = Object.fromEntries(Object.entries(paramMap).map(([key, value]) => [
        key, typeof value === 'number' ? stash[value] : value
      ]))
      return handler(request)
    })
  }
}

const app = flite({ match })
export default app
```

The repository tests the same normalization approach against Hono's `PatternRouter`, `RegExpRouter`,
and `TrieRouter`. Hono's matcher result shape is an integration detail; pin/test your Hono version
when depending on it. The built-in uflite matcher remains the default and has no Hono dependency.

### Browser routing

`uflite/nano` can also match browser URLs for a client-side SPA, but that is distinct from server-side
HTTP handling. Bundle the browser entry with Vite/Bun or use an import map, and render untrusted
route parameters with `textContent`, not `innerHTML`. The repository includes vanilla SPA, React SPA,
service-worker, and middleware samples; these are examples, not server-runtime adapters.



## Fetch runtimes and server adapters

uflite exposes `app.fetch(request, ...args)` and uses the Web `Request`/`Response` API. The router is
not an HTTP listener. Bun, Deno, and Cloudflare Workers provide a Fetch host directly. For Node.js,
use a host such as Hono with `@hono/node-server`, or another Fetch-compatible adapter you choose.

### Hono adapter: forward requests into uflite

If your application already uses Hono, register a catch-all bridge and let uflite handle those
requests. This is a small adapter pattern, **not** a separate package exported by uflite.

```sh
bun add uflite hono
```

```js
// app.js
import { Hono } from 'hono'
import { flite } from 'uflite'

const api = flite()
api.get('/api/hello/:name', request => ({ hello: request.params.name }))

const hono = new Hono()
// Register Hono-specific routes before this catch-all if you want Hono to handle some paths.
hono.all('*', context => api.fetch(context.req.raw))

export default hono
```

The raw Hono `Request` preserves the URL, headers, and body for uflite. The full uflite entry formats
plain route values as JSON. If the app uses nano/lite, add your own response/error wrapper because
those entries do not auto-format plain values.

### Node.js with `@hono/node-server`

This starts the Hono app above on Node.js. `@hono/node-server` belongs to the host application; it
is not a uflite dependency.

```sh
npm install uflite hono @hono/node-server
```

```js
// server.js (Node.js ESM)
import { serve } from '@hono/node-server'
import hono from './app.js'

serve({
  fetch: hono.fetch,
  port: Number(process.env.PORT || 3000),
  hostname: '0.0.0.0'
})
```

Run `node server.js`, then request `http://localhost:3000/api/hello/Ada`. To use uflite directly
without Hono on Node, choose a Node HTTP-to-Fetch adapter; uflite intentionally does not ship its
own Node listener.

### Deno

Deno provides `Deno.serve`, so no Hono or Node adapter is needed:

```js
// main.js
import { flite } from 'npm:uflite'

const app = flite()
app.get('/hello', () => ({ hello: 'Deno' }))

Deno.serve(request => app.fetch(request))
```

Run `deno run --allow-net main.js`, then request `http://localhost:8000/hello`.

### Cloudflare Workers

Export the Fetch handler from the Worker module. Build/bundle the Worker with your usual Wrangler
workflow; do not start a local server inside the Worker.

```js
// src/index.js
import { flite } from 'uflite'

const app = flite()
app.get('/hello/:name', request => ({ hello: request.params.name }))

export default {
  fetch(request, env, ctx) {
    // Forward env/ctx as optional adapter arguments if your handlers use them.
    return app.fetch(request, env, ctx)
  }
}
```

Example `wrangler.toml`:

```toml
name = "uflite-worker"
main = "src/index.js"
compatibility_date = "2026-10-13"
```

### Bun

```js
import app from './app.js'

Bun.serve({
  port: Number(Bun.env.PORT || 3000),
  fetch: request => app.fetch(request)
})
```

### Runtime notes

- The full entry's formatter checks `result instanceof Response`. Prefer the runtime's standard Web
  `Response`; if using a foreign `Response` implementation, test it or use `flite({ format: false })`
  only when every route already returns a compatible `Response`.
- `app.fetch(request, ...args)` forwards extra host arguments to route handlers. In mode 1, uflite's
  `next` callback is appended **after** those arguments.
- The repository's local HTTP example suite uses Bun. The Deno, Worker, Hono, and Node snippets above
  are source-based integration examples; validate them in the deployment environment and pin adapter
  versions for production.


## Core API at a glance

### Router and response APIs

```js
import { flite, response, text, html, json, error, status, run } from 'uflite'
```

- `flite(config?)` creates the full app. The `uflite/lite` and `uflite/nano` subpaths export
  their own smaller `flite` constructors.
- `app.get/post/put/patch/delete/head/options/all(path, ...handlers)` registers a route.
  Uppercase aliases are also available.
- `app.use(handlerOrRouter)` or `app.use(path, ...handlersOrRouters)` adds middleware or mounts
  a child router.
- `app.fetch(request, ...adapterArgs)` dispatches a Fetch request.
- `app.routes` exposes registered route tuples.
- `json`, `text`, `html`, and `response` create `Response` values; `error` creates an HTTP error
  response; `new status(code, message?, data?)` creates an error carrying an HTTP status.
- `run(mode?)(...handlers)(...args)` is exported by the full entry for handler-chain execution.

### Service APIs

```text
app.service(name, implementation) → ServiceWrapper
app.service(name)                  → registered ServiceWrapper
app.hooks({ before?, after?, error? }) → app
app.setup()                        → Promise<app>
app.teardown()                     → Promise<app>

service.hooks({ before?, after?, error? }) → service
service.on(event, listener)         → service
service.setup(...args)              → Promise<void>
service.teardown(...args)           → Promise<void>

service.find(params?)
service.get(id, params?)
service.create(data, params?)
service.update(id, data, params?)
service.patch(id, data, params?)
service.remove(id, params?)
```

A service implementation can also expose custom methods. They are available on the wrapper and
can have service hooks, but do not receive generated REST routes unless you register those routes.
For custom methods, a supplied `params` object is the final argument; pass `{}` when a method has
business arguments but no additional params, so hooks receive an empty context object.

For hook signatures and longer worked examples, see `docs/HOOK_SPEC.md` and
`docs/REAL_WORLD_HOOKS.md`. The public declarations live beside the source modules under `src/`.



## Feathers-like service layer

The full `uflite` entry includes a service registry inspired by the Feathers service model. A
service is an object of methods that operate on application data. Register it once and uflite can
expose its standard methods as REST endpoints, while the same methods remain callable directly
from application code.

This gives you a reusable application layer instead of implementing CRUD twice—once for HTTP
and again for internal calls.

### Register a service

```js
import { flite, status } from 'uflite'

const app = flite()
const records = new Map()
let nextId = 1

const tasks = app.service('tasks', {
  async find(params = {}) {
    return [...records.values()]
  },

  async get(id, params = {}) {
    const task = records.get(String(id))
    if (!task) throw new status(404, 'Task not found')
    return task
  },

  async create(data, params = {}) {
    const task = {
      id: String(nextId++),
      title: data.title,
      done: false
    }
    records.set(task.id, task)
    return task
  },

  async update(id, data, params = {}) {
    if (!records.has(String(id))) throw new status(404, 'Task not found')
    const task = { id: String(id), title: data.title, done: data.done }
    records.set(task.id, task)
    return task
  },

  async patch(id, data, params = {}) {
    const current = await this.get(id, params)
    const task = { ...current, ...data }
    records.set(String(id), task)
    return task
  },

  async remove(id, params = {}) {
    const task = await this.get(id, params)
    records.delete(String(id))
    return task
  },

  // Custom methods are callable from code but are not automatically REST routes.
  async count() {
    return records.size
  }
})

export default app
```

The wrapper follows a Feathers-inspired method shape: `find(params)`, `get(id, params)`,
`create(data, params)`, `update(id, data, params)`, `patch(id, data, params)`, and
`remove(id, params)`. The service wrapper normalizes those call signatures for both direct and
HTTP use. It also accepts custom implementation methods.

The service wrapper supports direct method calls as well as REST access:

```js
const allTasks = await tasks.find()
const oneTask = await tasks.get('1')
const created = await tasks.create({ title: 'Write the API' })
const updated = await tasks.patch(created.id, { done: true })
const removed = await tasks.remove(created.id)
const total = await tasks.count()
```

The sample is deliberately in-memory and does not validate inputs; add validation hooks and
persistent storage before using it for real data. The `DBService` section shows the built-in
database-backed service.

### Automatic REST routes

Only standard methods implemented by a registered service are exposed as routes:

| Service method | HTTP method | Route |
| --- | --- | --- |
| `find(params)` | `GET` | `/tasks` |
| `get(id, params)` | `GET` | `/tasks/:id` |
| `create(data, params)` | `POST` | `/tasks` |
| `update(id, data, params)` | `PUT` | `/tasks/:id` |
| `patch(id, data, params)` | `PATCH` | `/tasks/:id` |
| `remove(id, params)` | `DELETE` | `/tasks/:id` |

For a service named `users`, the same route pattern becomes `/users` and `/users/:id`. These
routes use the service methods; they do not create a separate CRUD implementation.

Important behavior to design for:

- Only methods implemented on the service create their corresponding REST routes.
- Custom methods such as `count()` remain direct-call methods unless you register a route yourself.
- Generated service routes do **not** automatically authenticate or authorize requests.
- Generated `POST` and `DELETE` routes use the normal JSON response behavior; they do not
  automatically change success status codes to `201` or `204`.
- The REST adapter passes the URL query as a flat params object. It does not automatically
  convert `?limit=...` into `params.query` for `DBService` pagination. Add an explicit mapping
  if your HTTP API needs that contract.
- If your API requires specific status codes or a custom response shape, add an explicit route
  or configure response/error behavior.

### Global and per-service hooks

Hooks let you implement cross-cutting behavior without duplicating it inside every method:
authorization, validation, normalization, audit fields, output shaping, metrics, and side effects.

`app.hooks(...)` applies global **service** hooks. `service.hooks(...)` applies hooks to one
service. Hook maps can use `all` and/or method names such as `find`, `get`, `create`, `patch`,
`remove`, or a custom method name.

```js
import { flite, status } from 'uflite'
import { requireFields, transformData } from 'uflite/hooks'
import { trimStrings } from 'uflite/transformers'
import { isNonEmptyString } from 'uflite/predicates'

const app = flite()
const rows = new Map()

const users = app.service('users', {
  async find() { return [...rows.values()] },
  async create(data) {
    const user = { id: String(rows.size + 1), ...data }
    rows.set(user.id, user)
    return user
  }
})

// Runs for service calls across the application.
app.hooks({
  before: {
    all: [ctx => {
      // A convenient place for service-wide logging/metrics.
      console.log('service call:', ctx.path, ctx.method)
    }]
  }
})

// Runs only for create calls to this service.
users.hooks({
  before: {
    create: [
      requireFields(['name']),
      transformData(trimStrings({ fields: ['name'] })),
      ctx => {
        if (!isNonEmptyString(ctx.data.name)) {
          throw new status(400, 'name is required')
        }
      }
    ]
  },
  after: {
    create: [ctx => {
      ctx.result.label = ctx.result.name.toUpperCase()
    }]
  },
  error: {
    all: [ctx => {
      // Service error hooks are useful for logging/metrics.
      console.warn('Service failed:', ctx.method, ctx.error?.message)
    }]
  }
})
```

A service hook receives a mutable context with fields such as
`{ app, service, path, method, params, id, data, result, error }`. It does **not** receive the
raw HTTP `Request`. The `params` object is supplied to direct service calls and REST calls; derive
authorization identity from trusted session/token validation, never from a client-controlled
role or user ID.

### Beginner example: Notes CRUD

This small CRUD service stores notes in a JavaScript `Map`. It uses the full `uflite` entry, so
implemented standard service methods become REST routes automatically. No database package is needed.

```js
import { flite, status } from 'uflite'

const app = flite()
const notes = new Map()
let nextId = 1

app.service('notes', {
  async find() {
    return [...notes.values()]
  },
  async get(id) {
    const note = notes.get(String(id))
    if (!note) throw new status(404, 'Note not found')
    return note
  },
  async create(data) {
    if (typeof data?.title !== 'string' || !data.title.trim()) {
      throw new status(400, 'title is required')
    }
    const note = {
      id: String(nextId++),
      title: data.title.trim(),
      body: typeof data.body === 'string' ? data.body : '',
      pinned: Boolean(data.pinned),
      createdAt: new Date().toISOString()
    }
    notes.set(note.id, note)
    return note
  },
  async patch(id, data) {
    const note = notes.get(String(id))
    if (!note) throw new status(404, 'Note not found')
    if (typeof data?.title === 'string') note.title = data.title.trim()
    if (typeof data?.body === 'string') note.body = data.body
    if (typeof data?.pinned === 'boolean') note.pinned = data.pinned
    return note
  },
  async remove(id) {
    const key = String(id)
    const note = notes.get(key)
    if (!note) throw new status(404, 'Note not found')
    notes.delete(key)
    return note
  }
})

export default app
```

Run it with Bun:

```js
// server.js
import app from './app.js'
Bun.serve({ port: 3000, fetch: request => app.fetch(request) })
```

Try these requests:

```sh
curl http://localhost:3000/notes
curl -X POST http://localhost:3000/notes -H 'content-type: application/json' \
  -d '{"title":"Read chapter 3","body":"Make summary notes","pinned":true}'
curl http://localhost:3000/notes/1
curl -X PATCH http://localhost:3000/notes/1 -H 'content-type: application/json' \
  -d '{"pinned":false}'
curl -X DELETE http://localhost:3000/notes/1
```

This is in-memory storage, so data resets when the process restarts. `patch` changes only supplied
fields; `update` is intended for full replacement.

### Write your own service

A service is just an object with methods. Register it with `app.service(name, implementation)`.
uflite wraps it with hooks/events and creates REST routes for the standard methods that exist.

```js
import { flite } from 'uflite'
const app = flite()

app.service('greetings', {
  async find() {
    return [{ message: 'Hello!' }]
  },
  async get(id) {
    return { id: String(id), message: `Hello, ${id}!` }
  }
})

export default app
```

This creates `GET /greetings` and `GET /greetings/:id`. No create/patch/remove routes are generated
because those methods were not implemented. You can look up and call the service directly:

```js
const greetings = app.service('greetings')
const greeting = await greetings.get('Kethan')
```

Custom methods are direct-call only unless you add a route explicitly:

```js
app.get('/greetings/count', async () => ({
  count: (await app.service('greetings').find()).length
}))
```

### Lifecycle order and error behavior

For a successful service method, the order is:

```text
app.before.all
  → app.before.<method>
    → service.before.all
      → service.before.<method>
        → service implementation
      ← service.after.<method>
    ← service.after.all
  ← app.after.<method>
← app.after.all
→ mutation event (for successful create/update/patch/remove)
```

Within `before` hooks, `all` runs before the method-specific hook. Within `after` hooks,
method-specific hooks run before `all`.

Implementation errors go through:

```text
service.error.<method>
  → service.error.all
    → app.error.<method>
      → app.error.all
        → original error is rethrown
```

Service error hooks observe and can log errors; setting `context.result` in an error hook does not
turn the failed call into a successful result. Exceptions thrown by before/after hooks or event
listeners do not enter the service error-hook path described above. A REST request may separately
be handled by the router's request-level error hook.

In default `mode: 0`, hooks advance automatically. In `mode: 1`, each hook must call `next()` to
continue. Call `await app.setup()` after registering services and before accepting requests; it
awaits service setup in registration order. `await app.teardown()` awaits cleanup in that order.

### Service events and custom methods

A service wrapper emits mutation events after successful changes. Register listeners with
`service.on(...)`:

```js
const tasks = app.service('tasks', implementation)

tasks.on('created', task => console.log('created', task.id))
tasks.on('updated', task => console.log('updated', task.id))
tasks.on('patched', task => console.log('patched', task.id))
tasks.on('removed', task => console.log('removed', task.id))
```

The app also provides a simple in-process event emitter:

```js
app.on('cache:refresh', payload => console.log('refresh', payload))
app.emit('cache:refresh', { source: 'admin' })
```

Custom service methods are useful for application operations that do not map neatly to CRUD.
They still go through the service wrapper and can use service hooks, but they are not exposed as
HTTP endpoints automatically:

```js
const reports = app.service('reports', {
  async find() { return [] },
  async countByStatus() { return { open: 4, closed: 9 } }
})

app.get('/reports/count-by-status', async () => reports.countByStatus())
```

Events and channels are in-process features; they are not a WebSocket server or a distributed
message bus.

## Built-in services and integrations

Optional service factories are imported from their individual subpaths. Install only the
dependencies needed by the integration you use. There is **no `uflite/services` barrel**; importing
a specific provider keeps unrelated optional packages out of your installation and bundle.

### DBService

`createDBService` supplies a Feathers-like data service with `find`, `get`, `create`, `update`,
`patch`, and `remove`. Install the optional `umosql` dependency when using it:

```bash
bun add umosql@0.3.1
```

```js
import { flite } from 'uflite'
import { createDBService } from 'uflite/services/db'

const app = flite()
const tasks = app.service('tasks', createDBService())

// Call the service directly. DBService handles filtering, sort, projection and pagination.
const page = await tasks.find({
  query: {
    done: false,
    $limit: 5,
    $skip: 0,
    $sort: { title: 1 },
    $select: ['_id', 'title', 'done']
  }
})

// { total, limit, skip, data }
```

`createDBService(getCollection?, options?)` accepts:

- `getCollection`: optional function that returns the collection for the supplied params.
  When omitted, it creates an isolated in-memory collection.
- `idField`: identifier field; defaults to `_id`.
- `paginate.default`: default page size; defaults to `10`.
- `paginate.max`: maximum page size; defaults to `100`.
- `multi`: whether bulk operations are allowed (`true`, a method-name array, or a per-method map).
- `initialData`: seed records for the default in-memory collection.

Supported query options include:

| Option | Behavior |
| --- | --- |
| ordinary fields | Filter records using the underlying collection query syntax |
| `$limit` | Set page size; clamped to the configured maximum |
| `$skip` | Skip records |
| `$sort` | Sort fields ascending (`1`) or descending (`-1`) |
| `$select` | Project selected fields; accepts a string, array, or projection object |
| `paginate: false` | Return an array instead of `{ total, limit, skip, data }` |
| `$limit: 0` | Return no rows while preserving the total count |

With pagination enabled, `find()` returns `{ total, limit, skip, data }`. The default in-memory
collection is not persistent and is lost when the process exits. Pass a `getCollection` function
to connect the service to a collection supplied by your chosen adapter.

DBService marks missing records with both `code: 404` and `status: 404`, so the default REST
error handler returns HTTP 404. Also note that service REST query params are flat by default;
the direct call above passes the nested `params.query` structure DBService expects.

### Authentication and ACL

`createAuth` integrates Better Auth. It requires the `better-auth` package and a compatible
adapter; `sqlAdapterFactory` is also exported from the same subpath. Configuration accepts an
adapter, `baseURL`, `secret`, trusted origins, email/password options, secondary storage, logging,
plugins, and additional Better Auth options.

```bash
bun add better-auth
```

```js
import { createAuth } from 'uflite/services/auth'

// Supply a real, compatible adapter and a secret from your environment.
const auth = await createAuth({
  adapter,
  baseURL: process.env.AUTH_BASE_URL,
  secret: process.env.AUTH_SECRET
})

// Mount Better Auth's real Fetch handler in your app.
app.all('/api/auth/*', req => auth.handler(req))
```

`createACL` provides permission checks with `role:resource:method` strings and wildcard matching
for each segment. Rules can also include a `check` filter evaluated against the context:

```bash
bun add uqry
```

```js
import { createACL } from 'uflite/services/acl'

const acl = createACL({
  enabled: true,
  rules: [{
    id: 'members-can-read-tasks',
    permissions: ['member:tasks:find', 'member:tasks:get']
  }]
})

// Use an identity returned by your verified authentication layer; never trust a query parameter.
const verifiedUser = { id: 'user-123', role: 'member' } // illustrative server-side value
const allowed = acl.can(
  { user: verifiedUser, role: verifiedUser.role },
  'member:tasks:find'
)
```

The application must derive `session` and roles from trusted authentication state. ACL is a
policy helper; you must call it from middleware/hooks and protect each generated service route.

### Table service

`createTableService(dbAdapter)` is the schema-administration service. It is **not** the same as
`createDBService`: DBService reads and writes records; TableService lists tables, reads schemas,
creates tables, changes columns, and drops tables. It requires a database adapter with the schema
capabilities for each operation (`listCollections`, `getTableSchema`, `createTableWithSchema`,
`addColumn`, `renameColumn`, `modifyColumn`, `dropColumn`, and `dropCollection`). Unsupported
capabilities fail explicitly rather than being silently emulated.

#### Working example: SQLite + umosql + automatic REST routes

This example uses Bun's built-in SQLite driver and umosql's schema-capable SQL adapter. Install:

```sh
bun add uflite umosql@0.3.1
```

```js
// app.js — Bun + SQLite
import { flite } from 'uflite'
import { createTableService } from 'uflite/services/table'
import { Database } from 'bun:sqlite'
import {
  createQueryBuilder, exprOps, filterOps, stageHandlers, updateOps
} from 'umosql'
import { createSQLAdapter } from 'umosql/schemaless'

const sqlite = new Database('./app.sqlite')
const queryBuilder = createQueryBuilder({ filterOps, exprOps, updateOps, stageHandlers })
const db = createSQLAdapter({
  database: 'sqlite',
  queryBuilder,
  execute: async (sql, params = []) => {
    const statement = sqlite.query(sql)
    if (/^(SELECT|PRAGMA)/i.test(sql.trim())) {
      return { rows: statement.all(...params) }
    }
    const result = statement.run(...params)
    return { rows: [], rowCount: result.changes, lastInsertRowid: result.lastInsertRowid }
  }
})

const app = flite()
app.service('tables', createTableService(db))

export default app
```

Save this as `app.js`. For local requests, create `server.js`:

```js
import app from './app.js'

Bun.serve({ port: 3000, fetch: request => app.fetch(request) })
```

Start it with `bun server.js`. The full entry automatically maps the standard service methods to REST routes:

| Request | Service operation | Purpose |
| :--- | :--- | :--- |
| `GET /tables` | `find()` | List tables/collections |
| `GET /tables/:id` | `get(tableName)` | Read a table schema |
| `POST /tables` | `create(data)` | Create a table from `{ name, schema }` |
| `PATCH /tables/:id` | `patch(tableName, data)` | Add, rename, modify, or drop a column |
| `DELETE /tables/:id` | `remove(tableName)` | Drop a table |

Example requests:

```sh
# List tables
curl http://localhost:3000/tables

# Create a table; schema types may use JSON Schema types or safe SQL type names
curl -X POST http://localhost:3000/tables \
  -H 'content-type: application/json' \
  -d '{"name":"notes","schema":{"properties":{"title":{"type":"string"},"pinned":{"type":"boolean","default":false}},"required":["title"]}}'

# Inspect schema
curl http://localhost:3000/tables/notes

# Add a column
curl -X PATCH http://localhost:3000/tables/notes \
  -H 'content-type: application/json' \
  -d '{"operation":"addColumn","columnName":"createdAt","type":"TEXT"}'

# Drop the table
curl -X DELETE http://localhost:3000/tables/notes
```

`PATCH` operations are `addColumn` (`columnName`, `type`, optional `options`), `renameColumn`
(`oldName`, `newName`), `modifyColumn` (`columnName`, `type`, optional `options`), and `dropColumn`
(`columnName`). Table and column names are validated as simple SQL identifiers; column types are
validated to reject SQL fragments. The service code is independent of the HTTP host; the Bun `server.js` above is only for local
requests. See the runtime section for Hono, Node.js, Deno, and Cloudflare Worker hosting examples.

**Security:** TableService is a database-administration API. Do not expose these generated routes
publicly. Add authentication and authorization at the request boundary, or define explicit
protected routes that call the service methods. uflite does not automatically authenticate generated
service routes.

### Expanded server example: a table with multiple data types and sample rows

`TableService` manages table schemas; it does **not** insert or query application records itself.
The example below creates a table with text, integer, real, boolean, date-time, and JSON-text columns,
then uses Bun's SQLite driver to insert and read sample rows. Explicit SQL type names make the intended
storage types easy to see.

```js
// app.js — Bun + SQLite + UMOSQL
import { flite, json, status } from 'uflite'
import { createTableService } from 'uflite/services/table'
import { Database } from 'bun:sqlite'
import {
  createQueryBuilder, exprOps, filterOps, stageHandlers, updateOps
} from 'umosql'
import { createSQLAdapter } from 'umosql/schemaless'

const sqlite = new Database('./app.sqlite')
const queryBuilder = createQueryBuilder({ filterOps, exprOps, updateOps, stageHandlers })
const db = createSQLAdapter({
  database: 'sqlite',
  queryBuilder,
  execute: async (sql, params = []) => {
    const statement = sqlite.query(sql)
    if (/^(SELECT|PRAGMA)/i.test(sql.trim())) return { rows: statement.all(...params) }
    const result = statement.run(...params)
    return { rows: [], rowCount: result.changes, lastInsertRowid: result.lastInsertRowid }
  }
})

const app = flite()
app.service('tables', createTableService(db))

// Demo-only endpoint: create the table once and insert a sample row.
app.post('/demo/seed', async () => {
  const names = await db.listCollections()
  if (!names.includes('demo_records')) {
    await app.service('tables').create({
      name: 'demo_records',
      schema: {
        properties: {
          title: 'TEXT',
          quantity: 'INTEGER',
          price: 'REAL',
          active: 'BOOLEAN',
          created_at: 'DATETIME',
          metadata: 'TEXT'
        },
        required: ['title', 'quantity']
      }
    })
  }

  sqlite.query(`INSERT INTO demo_records
    (title, quantity, price, active, created_at, metadata)
    VALUES (?, ?, ?, ?, ?, ?)`
  ).run('Notebook', 3, 49.95, 1, new Date().toISOString(),
    JSON.stringify({ color: 'blue', tags: ['work', 'ideas'] }))

  return json({ ok: true, message: 'Inserted one demo row' }, { status: 201 })
})

app.get('/demo/records', () => {
  const rows = sqlite.query('SELECT rowid AS id, * FROM demo_records').all()
  return json(rows.map(row => ({
    ...row,
    active: Boolean(row.active),
    metadata: row.metadata ? JSON.parse(row.metadata) : null
  })))
})

app.get('/demo/records/:id', req => {
  const row = sqlite.query('SELECT rowid AS id, * FROM demo_records WHERE rowid = ?')
    .get(Number(req.params.id))
  if (!row) throw new status(404, 'Record not found')
  return json({
    ...row,
    active: Boolean(row.active),
    metadata: row.metadata ? JSON.parse(row.metadata) : null
  })
})

export default app
```

```js
// server.js
import app from './app.js'
Bun.serve({ port: 3000, fetch: request => app.fetch(request) })
```

Run `bun server.js`, then call:

```sh
# Create the table if needed and insert one example row
curl -X POST http://localhost:3000/demo/seed

# Inspect the schema through TableService
curl http://localhost:3000/tables/demo_records

# Read the sample rows
curl http://localhost:3000/demo/records
```

| Field | Example | Meaning |
| --- | --- | --- |
| `title` (`TEXT`) | `"Notebook"` | Text |
| `quantity` (`INTEGER`) | `3` | Whole number |
| `price` (`REAL`) | `49.95` | Floating-point number |
| `active` (`BOOLEAN`) | `1` in SQLite | Boolean-like flag |
| `created_at` (`DATETIME`) | ISO date-time string | Date/time text |
| `metadata` (`TEXT`) | JSON string | Structured JSON stored as text |

SQLite uses dynamic typing, so `BOOLEAN` and `DATETIME` are declared affinities rather than strict
native storage types. The example converts the flag and JSON text when returning HTTP responses.
`TableService` performs schema operations; the sample data routes use Bun SQLite directly. This seed
endpoint is for local demonstration only and should not be exposed unauthenticated in production.

### Local and S3-compatible storage

`uflite/services/local-storage` offers local filesystem storage without the AWS SDK.
`uflite/services/storage` offers local or S3-compatible storage and requires both
`@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`, including when using its local mode.

Storage service operations include metadata listing and lookup, upload/download, removal, and
presign helpers. The local service supports file-size limits and prefix/cursor listing. The
S3-compatible service can create presigned upload/download URLs for direct browser-to-object-store
transfers.

### Storage factory examples

Local filesystem storage without AWS packages:

```js
import { createLocalStorageService } from 'uflite/services/local-storage'

const files = createLocalStorageService({
  basePath: './uploads',
  publicUrl: undefined,
  maxFileSize: 5 * 1024 * 1024
})

app.service('files', files)
```

S3-compatible storage requires the AWS SDK packages:

```bash
bun add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

```js
import { createStorageService } from 'uflite/services/storage'

const files = createStorageService({
  type: 's3',
  bucket: process.env.S3_BUCKET,
  region: process.env.S3_REGION,
  endpoint: process.env.S3_ENDPOINT, // optional for MinIO/compatible providers
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  forcePathStyle: true // commonly needed by local S3-compatible endpoints
})

app.service('files', files)
```

The `createStorageService` options also support `sessionToken`, a custom S3 `client`, custom
presign behavior, and separate upload/download URL expiry settings. For a local backend through
`createStorageService({ type: 'local', ... })`, the AWS SDK packages are still required by that
module; use `createLocalStorageService` if you specifically want local storage without them.

Storage service operations include `find`, `get`, `create`, `remove`, `upload`, `download`,
`presignUpload`, and `presignDownload`. The local storage implementation supports file-size
limits and prefix/cursor listing. The S3-compatible implementation can issue presigned URLs for
direct browser-to-object-store transfers.

Security notes:

- Protect upload, download, metadata, delete, and presign operations with authentication and ACL.
- Local presign URLs are ordinary application URLs, **not authorization tokens**.
- An S3 presigned PUT URL does not itself enforce a maximum upload size.
- Configure bucket, region, credentials, endpoint, and path-style behavior to match your provider.
- Do not assume a live S3 provider has been tested just because the adapter is available.

## Write your own middleware and hooks

Request middleware and hooks operate at different layers. Middleware receives the HTTP `Request`
and is useful for request-wide checks. Service hooks receive a mutable service `context` and are
useful for validation, data changes, authorization, audit fields, and result shaping.

### Custom route middleware in mode 0

In mode 0 (the default), a `null` or `undefined` result continues dispatch; a non-nullish result
short-circuits it. A guard can return a response to reject a request or return nothing to continue.

```js
import { flite, json } from 'uflite'
const app = flite() // mode 0

const requireApiKey = req => {
  if (req.headers.get('x-api-key') !== 'demo-key') {
    return json({ error: 'Invalid API key' }, { status: 401 })
  }
  // undefined means continue in mode 0
}

app.use('/private/*', req => requireApiKey(req))
app.get('/private/profile', () => json({ id: 'u1', name: 'Demo user' }))
```

The wrapper `req => requireApiKey(req)` is deliberate: some Fetch hosts pass extra adapter
arguments. Do not register an optional-`next` middleware directly in mode 0 unless you know what
arguments the host supplies.

### Custom route middleware in mode 1

In mode 1, the handler must call `next()` to continue. `next` is the last handler argument. This
makes short-circuiting explicit:

```js
import { flite, json } from 'uflite'
const app = flite({ mode: 1 })

const requireApiKey = async (req, next) => {
  if (req.headers.get('x-api-key') !== 'demo-key') {
    return json({ error: 'Invalid API key' }, { status: 401 })
  }
  return await next()
}

app.get('/private/profile', requireApiKey, () => json({ name: 'Demo user' }))
```

### Write your own request hooks

`uflite/lite` and full `uflite` support request-level `before`, `after`, and `error` hooks. In
mode 0, hooks advance automatically and can return a replacement value:

```js
import { flite } from 'uflite/lite'
import { json, error } from 'uflite'

const app = flite({
  before: { all: [req => { req.startedAt = Date.now() }] },
  after: { all: [(result, req) => {
    if (!(result instanceof Response)) return result
    const headers = new Headers(result.headers)
    headers.set('x-duration-ms', String(Date.now() - req.startedAt))
    return new Response(result.body, {
      status: result.status, statusText: result.statusText, headers
    })
  }] },
  error: { all: [err => error(err.status || 500,
    err.status >= 500 ? 'Internal Server Error' : err.message)] }
})

app.get('/health', () => json({ ok: true }))
```

In mode 1, each request hook must call `next()` when the next hook/phase should run. For example:

```js
import { flite } from 'uflite/lite'
import { json } from 'uflite'

const app = flite({
  mode: 1,
  before: {
    all: [async (req, next) => {
      req.requestId = crypto.randomUUID()
      await next()
    }]
  }
})
app.get('/health', req => json({ ok: true, requestId: req.requestId }))
```

The phase signatures are `before(request, ...args)`, `after(result, request, ...args)`, and
`error(error, request, ...args)`. In mode 1, `next` is the final argument. Request hooks are
separate from service hooks.

### Write your own service hooks

Service hooks receive a mutable context. In mode 0, mutate the context and return; the framework
continues automatically:

```js
const notes = app.service('notes')
notes.hooks({
  before: { create: [context => {
    context.data.createdAt = new Date().toISOString()
  }] },
  after: { create: [context => {
    context.result.label = 'Created note'
  }] }
})
```

In mode 1, each hook must call `next()` to continue to the next hook or implementation:

```js
notes.hooks({
  before: { create: [async (context, next) => {
    if (!context.data?.title?.trim()) throw new Error('title is required')
    context.data.title = context.data.title.trim()
    await next()
  }] },
  after: { create: [async (context, next) => {
    context.result.label = 'Created note'
    await next()
  }] }
})
```

A mode-1 hook that deliberately does not call `next()` short-circuits the remaining lifecycle.
See [Lifecycle order and error behavior](#lifecycle-order-and-error-behavior) for execution order
and error-path details.

### Make a reusable middleware factory

```js
// middleware.js
import { json } from 'uflite'

export const requireHeader = (headerName, expectedValue) => req => {
  if (req.headers.get(headerName) === expectedValue) return undefined
  return json({ error: `Missing or invalid ${headerName}` }, { status: 401 })
}
```

In mode 0, use it as `app.use('/admin/*', req => requireHeader('x-admin-key', 'demo')(req))`.
For mode 1, write a separate `(req, next) => { ...; return next() }` middleware or adapt the
factory to call `next()` explicitly. Do not mix mode-0 return-to-continue behavior with mode-1
explicit continuation.

## DBService without UMOSQL: a plain JavaScript alternative

`createDBService` itself **requires `umosql`**, even with its default in-memory collection, because
it imports `umosql/memory`. There is no supported way to use that factory without the dependency.
If you want a tiny database-like service without a database package, use a `Map` and implement the
CRUD methods directly. This is a custom service, not the `createDBService` factory.

```js
import { flite, status } from 'uflite'
const app = flite()
const rows = new Map()
let nextId = 1

app.service('records', {
  async find({ query = {} } = {}) {
    let result = [...rows.values()]
    if (query.active !== undefined) {
      const active = query.active === true || query.active === 'true'
      result = result.filter(row => row.active === active)
    }
    if (query.q) {
      const term = String(query.q).toLowerCase()
      result = result.filter(row => row.name.toLowerCase().includes(term))
    }
    return result
  },
  async get(id) {
    const row = rows.get(String(id))
    if (!row) throw new status(404, 'Record not found')
    return row
  },
  async create(data) {
    if (typeof data?.name !== 'string' || !data.name.trim()) {
      throw new status(400, 'name is required')
    }
    const row = { id: String(nextId++), name: data.name.trim(), active: data.active ?? true }
    rows.set(row.id, row)
    return row
  },
  async patch(id, data) {
    const row = rows.get(String(id))
    if (!row) throw new status(404, 'Record not found')
    if (typeof data?.name === 'string') row.name = data.name.trim()
    if (typeof data?.active === 'boolean') row.active = data.active
    return row
  },
  async remove(id) {
    const key = String(id)
    const row = rows.get(key)
    if (!row) throw new status(404, 'Record not found')
    rows.delete(key)
    return row
  }
})

export default app
```

This creates `GET /records`, `GET /records/:id`, `POST /records`, `PATCH /records/:id`, and
`DELETE /records/:id`. It does not provide DBService pagination, sorting, projection, adapter
support, or persistence. Use `createDBService` when you need those features and can install `umosql`.

## Reusable hooks, transformers, predicates, and resolvers

These modules are standalone utilities designed to compose with service hooks. A factory returns
a hook/resolver/transformer; it is not automatically applied to every request. Choose the
utility, configure it, and register it on the relevant service or use it in application code.

### Service hook catalog

Import from `uflite/hooks` (or use the corresponding named exports from full `uflite`).

| Category | Utilities |
| --- | --- |
| Flow control | `iff`, `unless`, `throwIf`, `disallow`, `setData`, `setResult` |
| Input and data | `requireFields`, `setDefaults`, `preventChanges`, `removeFields`, `transformData`, `setField`, `pickDataFields`, `validateData`, `preventEmptyData` |
| Query | `setQueryDefaults`, `pickQueryFields`, `transformQuery` |
| Authentication and authorization | `requireAuth`, `requireRole`, `requirePermission`, `requireOwner`, `scopeToActor`, `requireMethod`, `rateLimit` |
| Results | `transformResult`, `pickResultFields`, `omitResultFields`, `mapResult` |
| Lifecycle and operations | `auditFields`, `publishEvent`, `sideEffect`, `debug` |

Example: compose validation, normalization, and output shaping in the service lifecycle:

```js
import { requireFields, transformData, pickResultFields } from 'uflite/hooks'
import { trimStrings } from 'uflite/transformers'

users.hooks({
  before: {
    create: [
      requireFields(['name', 'email']),
      transformData(trimStrings({ fields: ['name', 'email'] }))
    ]
  },
  after: {
    create: [pickResultFields(['id', 'name', 'email'])]
  }
})
```

The utilities target service context data by default where appropriate (for example `data`, `result`,
or `params.query`); consult the utility's options when changing the target. They receive a service
context, **not** an HTTP `Request`.

### Transformers

Import from `uflite/transformers`. Transformers operate on values and can be composed with
`compose`/`pipe`.

| Purpose | Utilities |
| --- | --- |
| Composition | `identity`, `compose`, `pipe` |
| Strings | `trimString`, `lowercase`, `uppercase`, `normalizeEmail`, `normalizeWhitespace`, `slugify` |
| Parsing | `toNumber`, `toInteger`, `parseJSON`, `toBoolean` |
| Object fields | `pick`, `omit`, `renameFields`, `mapFields`, `trimStrings`, `removeEmpty`, `setDefaults`, `updatePath` |
| Arrays | `mapArray` |

```js
import { pipe, trimString, lowercase, normalizeEmail } from 'uflite/transformers'

const cleanEmail = pipe(trimString, lowercase, normalizeEmail)
const email = await cleanEmail('  ADA@EXAMPLE.COM  ')
```

Some transformations are asynchronous. `compose` and `pipe` return an async function, so `await`
the result.

### Predicates

Import from `uflite/predicates`. Predicates are reusable value checks and can be combined:

```js
import { isNonEmptyString, isEmail, all, hasPath, pathEquals } from 'uflite/predicates'

const validEmail = all(isNonEmptyString, isEmail)
const validUser = value => validEmail(value.email) && pathEquals('role', 'member')(value)
```

Available predicates include type checks (`isString`, `isNumber`, `isInteger`, `isBoolean`,
`isArray`, `isObject`, `isPlainObject`), presence/empty checks (`isPresent`, `isNil`,
`isDefined`, `isEmpty`, `isNonEmptyString`), format checks (`isEmail`, `isURL`, `isUUID`),
comparison checks (`equals`, `notEquals`, `oneOf`, `includes`, `matches`, `greaterThan`,
`atLeast`, `lessThan`, `atMost`, `between`), length and collection checks (`lengthAtLeast`,
`lengthAtMost`, `hasAny`, `hasAll`), path checks (`hasPath`, `pathEquals`, `pathMatches`), and
combinators (`all`, `any`, `not`, `when`, `contextPredicate`, `truthy`, `falsy`).

### Resolvers

Import from `uflite/resolvers`. Resolvers compute or enrich fields from an object, related data,
or context. They can be useful for shaping service results without embedding presentation logic in
the data service.

| Purpose | Utilities |
| --- | --- |
| Field/context | `value`, `fromPath`, `fromContext`, `fallback`, `mapValue` |
| Conditional/redaction | `resolveIf`, `omitIf`, `redactIf` |
| Relations and arrays | `lookup`, `mapArray`, `relation`, `relationMany` |
| Aggregates and formatting | `join`, `count`, `sum`, `pluck` |

```js
import { fromPath, redactIf } from 'uflite/resolvers'

const displayName = fromPath('profile.displayName', { fallback: 'Anonymous' })
const privateEmail = redactIf((value, object, context) => !context?.isOwner)
```

Resolvers are functions: connect them to the resolution flow your application uses. They do not
automatically run for every service response unless you register/apply them.

## HTTP middleware

Import HTTP middleware from `uflite/middlewares`. Middleware operates on the HTTP request/response
flow; it is separate from service-context hooks.

| Middleware | What it helps with | Response-phase companion |
| --- | --- | --- |
| `cors(options?)` | Configure cross-origin request policy | `corsAfter` |
| `logger(options?)` | Request/response logging (`dev`, `combined`, or `json`) | `loggerAfter` |
| `rateLimit(options?)` | In-process request limiting | `rateLimitAfter` |
| `bearerAuth(options?)` | Static token or custom token verifier | — |
| `basicAuth(options)` | Username/password map | — |
| `bodyLimit(options?)` | Request body byte limit | — |
| `secureHeaders(options?)` | Security response headers | `secureHeadersAfter` |
| `requestId(options?)` | Request ID generation | `requestIdAfter` |

`basicAuth` uses the Web API global `atob`; check that it is available in legacy or custom Fetch
runtimes before enabling this middleware. It is available in Bun, Node 18+, and common modern
browser/worker runtimes.

Example: request ID generation and response headers:

```js
import { flite, json } from 'uflite'
import { requestId, requestIdAfter } from 'uflite/middlewares'

const addRequestId = requestId()
const app = flite({
  before: { all: [req => addRequestId(req)] },
  after: {
    all: [(response, req) =>
      response?.headers ? requestIdAfter(response, req) : response]
  }
})
app.get('/health', () => json({ ok: true }))
```

Notes:

- `rateLimit` is in-process. For multi-instance deployments, use a trusted key and shared or
  upstream enforcement.
- Do not trust forwarded IP headers unless your proxy configuration makes them trustworthy.
- `bodyLimit` counts streamed bytes, but an upstream connection/body cap is still recommended.
- In mode 0, wrap optional-next middleware as `req => middleware(req)` if the runtime passes
  extra Fetch handler arguments.

## Events and channels

The full entry has an in-process event emitter and channels. Service wrappers also emit mutation
events (`created`, `updated`, `patched`, `removed`) after successful mutations.

```js
import { flite } from 'uflite'

const app = flite()

app.on('cache:refresh', payload => {
  console.log('refresh requested by', payload.source)
})
app.emit('cache:refresh', { source: 'admin' })

const connection = {
  send(message) {
    console.log('deliver to connection:', message)
  }
}
app.channel('updates').join(connection, { room: 'tasks' })
app.channel('updates').send('task-created', { id: '1' })
```

Channels require the application to supply a connection object with the expected `send` behavior.
They are not WebSocket upgrades and do not provide distributed delivery. Use a real transport and
shared event infrastructure if your app needs cross-process or cross-instance messages.

## Example coverage

The repository contains five runnable projects, and their core patterns are documented directly
above rather than requiring you to open another file to understand the framework:

1. **Nano CRUD:** in-memory REST endpoints, validation, explicit status codes, and safe error handling.
2. **Nano practical:** query filters, request guards, and mounted/versioned routers.
3. **Lite notes:** global request `before`/`after`/`error` hooks.
4. **Full services:** `DBService`, Better Auth, ACL, and local or optional S3-compatible storage.
5. **Full lifecycle:** middleware, service hooks, transformers, predicates, resolvers, and mutation events.

To run the repository's versions, build the checkout first:

```bash
bun install
bun run build
bun run test:examples
```

The example projects use the built local package via `file:../..`; their HTTP server is Bun, and
they do not require Hono or a Node HTTP adapter. The inline sections above explain the API and
common patterns independently of those project files.

## Additional patterns and edge cases

<details>
<summary>Service hooks, events and channels</summary>

A full service hook receives `{app,service,path,method,params,id?,data?,result?,error?}`, not
a Request. On success: app.before → service.before → implementation → service.after →
app.after → mutation event. Within before hooks `all` precedes the method; within after hooks
the method precedes `all`.

Implementation failures enter service.error.method → service.error.all → app.error.method →
app.error.all and are rethrown. Before/after-hook failures bypass **service** error hooks;
request-level hooks may handle a failed REST route. In mode 1, hooks must call `next()` to
continue. Service `setup` runs through `await app.setup()` after registration; `await app.teardown()`
waits for service cleanup.

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

Events and channels are in-process, not WebSocket upgrades or cross-instance delivery. The
service lifecycle and helper composition are documented in the sections above.

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
Transformers, predicates, and field resolvers are standalone helpers; their feature groups and
usage are documented above. The repository also includes deeper API and hook specifications for
maintainers who need exact declarations and edge-case ordering.

</details>

## Browser SPA and React SPA

`uflite/nano` can also match browser-side routes. In a browser SPA, the router runs in the user's
browser; it is **not** a security boundary and does not replace your server API. These examples
use the small `nano` entry and native History API, so no additional routing library is needed.

### Plain browser SPA (vanilla JavaScript)

Create `index.html` and `app.js`. This example has Home, About, and a parameterized Note page.
The renderer uses `textContent` rather than inserting untrusted strings as HTML.

```html
<!-- index.html -->
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>uflite SPA</title>
</head>
<body>
  <nav>
    <a href="/" data-link>Home</a>
    <a href="/about" data-link>About</a>
    <a href="/notes/42" data-link>Example note</a>
  </nav>
  <main id="app" aria-live="polite">Loading…</main>
  <script type="module" src="/app.js"></script>
</body>
</html>
```

```js
// app.js
import { flite } from 'uflite/nano'

const router = flite()
router.get('/', () => ({ title: 'Home', message: 'Welcome to the SPA.' }))
router.get('/about', () => ({ title: 'About', message: 'This page is handled in the browser.' }))
router.get('/notes/:id', request => ({
  title: `Note ${request.params.id}`,
  message: `You are viewing note ${request.params.id}.`
}))
router.all('*', () => ({ title: 'Not found', message: 'That page does not exist.' }))

const root = document.querySelector('#app')

async function render() {
  const page = await router.fetch(new Request(window.location.href))
  root.replaceChildren()
  const heading = document.createElement('h1')
  heading.textContent = page.title
  const message = document.createElement('p')
  message.textContent = page.message
  root.append(heading, message)
}

function navigate(url) {
  history.pushState({}, '', url)
  void render()
}

document.addEventListener('click', event => {
  const link = event.target.closest('a[data-link]')
  if (!link || event.defaultPrevented || event.button !== 0 ||
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const url = new URL(link.href, window.location.href)
  if (url.origin !== window.location.origin) return
  event.preventDefault()
  navigate(url.pathname + url.search + url.hash)
})

window.addEventListener('popstate', () => { void render() })
void render()
```

Install a browser bundler such as Vite (`npm install uflite` and `npm install -D vite`), add a
`dev` script that runs `vite`, and serve the folder with `npm run dev`. The browser cannot resolve
bare package imports such as `uflite/nano` without a bundler or import map.

### React SPA

Create a React app with Vite, install `uflite`, and use this as `src/App.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { flite } from 'uflite/nano'

const router = flite()
router.get('/', () => ({ page: 'home' }))
router.get('/about', () => ({ page: 'about' }))
router.get('/notes/:id', request => ({ page: 'note', id: request.params.id }))
router.all('*', () => ({ page: 'not-found' }))

function getUrl() {
  return window.location.pathname + window.location.search + window.location.hash
}

export default function App() {
  const [url, setUrl] = useState(getUrl)
  const [route, setRoute] = useState({ page: 'loading' })

  useEffect(() => {
    const onPopState = () => setUrl(getUrl())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    let cancelled = false
    router.fetch(new Request(new URL(url, window.location.origin).href))
      .then(result => { if (!cancelled) setRoute(result) })
      .catch(() => { if (!cancelled) setRoute({ page: 'not-found' }) })
    return () => { cancelled = true }
  }, [url])

  function navigate(event) {
    const link = event.target.closest('a[data-link]')
    if (!link || event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const next = new URL(link.href, window.location.href)
    if (next.origin !== window.location.origin) return
    event.preventDefault()
    history.pushState({}, '', next.pathname + next.search + next.hash)
    setUrl(getUrl())
  }

  return (
    <div onClick={navigate}>
      <nav>
        <a href="/" data-link>Home</a>{' | '}
        <a href="/about" data-link>About</a>{' | '}
        <a href="/notes/42" data-link>Example note</a>
      </nav>
      <main>
        {route.page === 'home' && <><h1>Home</h1><p>Welcome to the React SPA.</p></>}
        {route.page === 'about' && <><h1>About</h1><p>Routes are matched by uflite.</p></>}
        {route.page === 'note' && <><h1>Note {route.id}</h1><p>Example note page.</p></>}
        {route.page === 'not-found' && <><h1>Not found</h1><p>That page does not exist.</p></>}
        {route.page === 'loading' && <p>Loading…</p>}
      </main>
    </div>
  )
}
```

This is intentionally a minimal routing example, not a complete React routing library. It does not
implement nested layouts, route loaders, code splitting, or scroll restoration.

**SPA hosting requirement:** configure your static host to serve `index.html` for client-side paths
such as `/about` and `/notes/42`; otherwise refreshing a nested URL may return a server 404. Keep
API routes on the server and configure the SPA fallback so it does not swallow API 404s.

## Production checklist

Before releasing an application built with uflite, check these items against your deployment:

- [ ] **Run the repository checks:** `bun install --frozen-lockfile`, `bun run build`, `bun test`,
  `bun run test:types`, `bun run test:package`, and `bun run test:examples`.
- [ ] **Redact internal errors.** Replace the full entry's default error behavior with a production
  error hook that logs details privately and returns a generic message for 5xx responses.
- [ ] **Validate every input at the server.** Check request bodies, path parameters, query values,
  content types, and body sizes; do not rely on browser-side validation.
- [ ] **Authorize every protected route.** Generated service routes do not automatically authenticate
  users. Check both authentication and resource-level authorization for reads and writes.
- [ ] **Configure CORS intentionally.** Allow only required origins, methods, and headers. CORS is
  a browser policy, not authentication or authorization.
- [ ] **Use persistent, shared infrastructure where required.** In-memory records, rate limits,
  events, and channels are process-local and reset or diverge across instances.
- [ ] **Set operational limits.** Configure request/body limits, timeouts, rate limits, and upstream
  limits at the server or platform. A middleware byte limit does not replace transport-level caps.
- [ ] **Keep secrets in environment/secret management.** Never ship server credentials or private
  API keys in a browser SPA bundle.
- [ ] **Verify deployment behavior.** Test real HTTP success and failure paths, browser deep-link
  refreshes, CORS preflight, shutdown behavior, and the chosen runtime (Bun, Node host, Deno, or Worker).
- [ ] **Pin and audit dependencies.** Install only optional adapters you actually use and keep the
  lockfile committed.

These checks are a release checklist, not a claim that every runtime/provider has been tested by the
project. Confirm your actual deployment target and integrations in CI/staging before shipping.

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

The implementation is organized under `src/`: `src/nano/`, `src/lite/`, and `src/index.js`
implement the three tiers; `src/runtime.js` contains their shared router primitives. Feature
modules live in `src/hooks/`, `src/predicates/`, `src/transformers/`, and `src/resolvers/`, with
optional integrations isolated under `src/services/`. Middleware ships from `src/middlewares.js`;
shared utilities are in `src/utils/`. Multiword source files use kebab-case. `dist/` is generated
build output; consumers should use the public package subpaths, not private source paths.

The benchmark fixture is one browser-target, minified GET route returning a Response (Bun 1.4.3).
It is **not** an application size or throughput guarantee. See [Size comparison](#size-comparison)
for the measurements; reproduce them with `bun run bench:size`. Importing full `json` beside nano
adds to a consumer bundle, so benchmark your actual imports for a meaningful comparison.

## Framework routers (SPA)

A single, signal-agnostic SPA router lives in `routers/` (powered by `uele/reactive` + `uflite/nano`).
It works with any signal preset (Preact, Solid, Vue, Svelte, Angular, ...).

```js
import { usePreactSignals } from 'uele/adapters/preact'
import { h } from 'uele'
import { flite } from 'uflite/nano'
import { createRouter, useRouter } from '../routers'

usePreactSignals()

export const app = flite()
app.get('/', () => h('h1', null, 'Home'))
app.get('/about', () => h('h1', null, 'About'))

export function App() {
  const [view, linkProps] = useRouter(app, h('h1', null, 'Loading...'))
  return h('main', linkProps(), view)
}
```

See `examples/browser-uele.js` for a complete example.

## License and contributing

Package metadata identifies [Kethan Surana](https://github.com/kethan) as author and declares
**ISC**. A matching top-level license file still needs maintainer confirmation; third-party
texts are in [`licenses/`](licenses/). Report defects via
[GitHub issues](https://github.com/kethan/uflite/issues). Please run the build, tests, type
and package checks before contributing.

Inspired by [itty-router](https://github.com/kwhitley/itty-router), [Hono](https://hono.dev),
and [FeathersJS](https://feathersjs.com). Inspiration is not a runtime dependency.
