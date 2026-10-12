# 📁 README.md

# 🪶 μflite

**A small Fetch router with hooks and services.** Choose `nano` for the smallest router, `lite` for indexed routing and lifecycle hooks, or the full entry point for response formatting and services.

[![tests](https://github.com/kethan/uflite/actions/workflows/node.js.yml/badge.svg)](https://github.com/kethan/uflite/actions/workflows/node.js.yml) 
[![Version](https://img.shields.io/npm/v/uflite.svg?color=success&style=flat-square)](https://www.npmjs.com/package/uflite) 
[![Badge size](https://deno.bundlejs.com/badge?q=uflite&treeshake=[*]&config={"compression":"brotli"})](https://unpkg.com/uflite) 
[![Badge size](https://deno.bundlejs.com/badge?q=uflite&treeshake=[*]&config={"compression":"gzip"})](https://unpkg.com/uflite)
---

## ✨ Features

- 🎯 **Small entry points** - nano and lite keep unused services and middleware out of the core entry bundles
- 🔗 **Hono-style middleware** - Proper onion pattern execution
- 🪝 **Global hooks** - Before/after/error lifecycle
- 🦅 **FeathersJS services** - Real-time APIs with hooks
- 🔄 **Two modes** - Sequential (mode 0) or middleware (mode 1)
- 🚀 **Edge-ready** - Works on Cloudflare Workers, Deno, Bun, Node
- 📦 **Dependency-light core** - integrations are isolated to service subpaths
- 💪 **TypeScript** - Full type support

---

## 📦 Installation

```bash
npm install uflite
# or
bun add uflite
```

---

## 🚀 Quick Start

### Basic Routing

```javascript
import { flite, json } from "uflite/lite";

const app = flite();

app.get("/hello", () => json({ message: "Hello World!" }));

app.get("/users/:id", (req) => json({ id: req.params.id }));

export default app;
```

### Hono-Style Middleware (Mode 1)

```javascript
import { flite, json } from "uflite/lite";

const app = flite({ mode: 1 });

// Middleware chain - executes in onion pattern
app.use(
	async (req, next) => {
		console.log("→ auth");
		if (!req.headers.get("authorization")) {
			return json({ error: "Unauthorized" }, { status: 401 });
		}
		await next();
		console.log("← auth");
	},
	async (req, next) => {
		console.log("→ logger");
		const start = Date.now();
		await next();
		console.log(`← logger (${Date.now() - start}ms)`);
	}
);

app.get("/protected", () => json({ secret: "data" }));

// Output:
// → auth
// → logger
// ← logger (5ms)
// ← auth
```

### Auto-Response Formatting

```javascript
import { flite } from "uflite";

const app = flite();

// Returns plain objects - auto-converted to JSON!
app.get("/users", () => [
	{ id: 1, name: "Alice" },
	{ id: 2, name: "Bob" },
]);

// Auto 404 for unmatched routes
app.get("/exists", () => ({ ok: true }));
// /missing → 404 JSON response

// Custom error handling
app.get("/error", () => {
	throw new Error("Oops");
});
// → 500 JSON response
```

---

## 🎯 Core Concepts

### Mode 0 vs Mode 1

| Feature       | Mode 0 (Sequential)           | Mode 1 (Middleware)          |
| ------------- | ----------------------------- | ---------------------------- |
| **Signature** | `(req) => response`           | `(req, next) => response`    |
| **Execution** | Linear, stops at first return | Onion pattern (before/after) |
| **Use case**  | Simple APIs                   | Auth, logging, transforms    |

```javascript
// Mode 0 - Simple
app.get(
	"/test",
	(req) => console.log("1"),
	(req) => json({ done: true }), // ✅ Returns, stops here
	(req) => console.log("3") // ❌ Never runs
);

// Mode 1 - Onion
const app = flite({ mode: 1 });

app.get(
	"/test",
	async (req, next) => {
		console.log("→ 1");
		await next();
		console.log("← 1");
	},
	async (req, next) => {
		console.log("→ 2");
		await next();
		console.log("← 2");
	},
	() => {
		console.log("★ handler");
		return json({ ok: true });
	}
);
// Output: → 1, → 2, ★ handler, ← 2, ← 1
```

---

## 🪝 Global Hooks

```javascript
import { flite, json } from "uflite/lite";

const app = flite({
	mode: 1,
	before: {
		all: [
			async (req, next) => {
				req.startTime = Date.now();
				await next();
			},
		],
		post: [
			async (req, next) => {
				// Runs only for POST requests
				const body = await req.json();
				if (!body.email) {
					return json({ error: "Email required" }, { status: 400 });
				}
				await next();
			},
		],
	},
	after: {
		all: [
			(res, req) => {
				console.log(
					`${req.method} ${req.url} - ${Date.now() - req.startTime}ms`
				);
				return res;
			},
		],
	},
	error: {
		all: [
			(err, req) => {
				console.error(err);
				return json(
					{
						error: err.message,
					},
					{
						status: err.status || 500,
					}
				);
			},
		],
	},
});

app.post("/users", async (req) => {
	const user = await createUser(await req.json());
	return json(user, { status: 201 });
});
```

---

## 🦅 Services (FeathersJS-style)

```javascript
import { flite, json } from "uflite";

const app = flite({ mode: 0 });

// Define a service
app.service("users", {
	async find(params) {
		return db.users.findMany({ where: params.query });
	},
	async get(id, params) {
		return db.users.findById(id);
	},
	async create(data, params) {
		return db.users.create(data);
	},
	async patch(id, data, params) {
		return db.users.update(id, data);
	},
	async remove(id, params) {
		return db.users.delete(id);
	},
});

// Auto-creates REST routes:
// GET    /users       → find()
// GET    /users/:id   → get(id)
// POST   /users       → create(data)
// PATCH  /users/:id   → patch(id, data)
// DELETE /users/:id   → remove(id)

// Or call directly:
const users = app.service("users");
const allUsers = await users.find({ role: "admin" });
const user = await users.get(123);
```

### Middleware Templates

- Prefer single-function middleware for most cases (no request mutation).
- Use paired before/after hooks with a `WeakMap` only when you need cross-phase state.

```javascript
// 1) Single-function middleware (recommended)
export const cors = (opts = {}) => async (req, next) => {
  const origin = req.headers.get('origin') || ''
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': origin } })
  }
  const res = await next()
  const headers = new Headers(res.headers)
  headers.set('Access-Control-Allow-Origin', origin)
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
}

// Usage
const app = flite({ mode: 1 })
app.use(cors())
app.get('/hello', () => json({ ok: true }))
```

```javascript
// 2) Paired before/after hooks using WeakMap for cross-phase state
const MW = new WeakMap()
const getCtx = (req) => { let c = MW.get(req); if (!c) { c = {}; MW.set(req, c) } return c }

export const myBefore = (options = {}) => async (req, next) => {
  getCtx(req).my = { start: Date.now() }
  if (next) await next()
}

export const myAfter = async (res, req, next) => {
  const t = next ? await next() : undefined
  const r = t ?? res
  const data = getCtx(req).my
  if (!data) return r
  const headers = new Headers(r.headers)
  return new Response(r.body, { status: r.status, statusText: r.statusText, headers })
}

// Usage
const app2 = flite({ mode: 1,
  before: { all: [myBefore()] },
  after: { all: [myAfter] }
})
app2.get('/hi', () => json({ ok: true }))
```

### Service Hooks

```javascript
const users = app.service("users", {
	async create(data) {
		return db.users.create(data);
	},
});

// Service-level hooks
users.hooks({
	before: {
		all: [
			(ctx) => {
				console.log(`Called ${ctx.method} on ${ctx.path}`);
			},
		],
		create: [
			(ctx) => {
				// Validate
				if (!ctx.data.email) throw new Error("Email required");
			},
			(ctx) => {
				// Add timestamps
				ctx.data.createdAt = Date.now();
			},
		],
	},
	after: {
		create: [
			(ctx) => {
				// Send welcome email
				sendEmail(ctx.result.email);
			},
		],
	},
});

// App-level hooks (run before service hooks)
app.hooks({
	before: {
		all: [
			(ctx) => {
				// Check authentication
				if (!ctx.params.user) throw new Error("Not authenticated");
			},
		],
	},
});

// Hook execution order:
// 1. app.before.all
// 2. app.before.create
// 3. service.before.all
// 4. service.before.create
// 5. service method
// 6. service.after.create
// 7. service.after.all
// 8. app.after.create
// 9. app.after.all
```

### Service Events

```javascript
const users = app.service("users");

users.on("created", (user) => {
	console.log("User created:", user);
	broadcastToClients({ event: "user-created", data: user });
});

users.on("removed", (user) => {
	console.log("User deleted:", user);
});

await users.create({ name: "Alice" }); // Triggers 'created' event
```

### Custom Service Methods

```javascript
app.service("users", {
	async find() {
		return [];
	},

	// Custom method
	async sendPasswordReset(email) {
		const user = await db.users.findByEmail(email);
		await sendEmail(user.email, resetToken);
		return { sent: true };
	},
});

const users = app.service("users");

// Custom methods also go through hooks
users.hooks({
	before: {
		sendPasswordReset: [
			(ctx) => {
				console.log("Sending reset to:", ctx.params);
			},
		],
	},
});

await users.sendPasswordReset("user@example.com");
```

---

## 🔄 Nested Routers

```javascript
import { flite, json } from "uflite/lite";

// API v1
const v1 = flite();
v1.get("/users", () => json([{ id: 1 }]));

// API v2
const v2 = flite();
v2.get("/users", () => json([{ id: 1, name: "Alice" }]));

// Main app
const app = flite();
app.use("/api/v1", v1);
app.use("/api/v2", v2);

// Routes:
// GET /api/v1/users
// GET /api/v2/users
```

---

## 📡 Real-time Channels

```javascript
import { flite } from "uflite";

const app = flite();

app.service("messages", {
	async create(data) {
		const message = await db.messages.create(data);

		// Broadcast to channel
		app.channel("chat").send("message-created", message);

		return message;
	},
});

// WebSocket handler
app.get("/ws", (req) => {
	const { socket, response } = Deno.upgradeWebSocket(req);

	socket.onopen = () => {
		app.channel("chat").join(socket, { userId: req.query.userId });
	};

	socket.onclose = () => {
		app.channel("chat").leave(socket);
	};

	return response;
});

// Filter broadcasts
app
	.channel("chat")
	.filter((connData, eventData) => connData.userId !== eventData.senderId)
	.send("message-created", { text: "Hello", senderId: 123 });
```

---

## 🎨 Response Helpers

```javascript
import { json, text, html, error, status } from "uflite";

app.get("/json", () => json({ data: "value" }));

app.get("/text", () => text("Plain text"));

app.get("/html", () => html("<h1>Hello</h1>"));

app.get("/custom", () =>
	json(
		{ ok: true },
		{
			status: 201,
			headers: { "X-Custom": "header" },
		}
	)
);

app.get("/error", () => error(404, "Not found"));

app.get("/throw", () => {
	throw new status(401, "Unauthorized", { code: "AUTH_REQUIRED" });
});
```

---

## 🔌 Custom Routers

Provide a minimal `match({ method, path })` to delegate routing to any external library. The function returns `{ handlers, params? }`.

Example (trouter: add + find):

```javascript
import { flite } from "uflite/lite"
import Trouter from "trouter"

const tr = new Trouter()
tr.add('GET', '/users/:id', (req, params) => new Response(JSON.stringify({ id: params.id }), { headers: { 'content-type': 'application/json' } }))

const app = flite({
  match: ({ method, path }) => {
    const found = tr.find(method, path)
    if (!found.handlers.length) return null
    return { handlers: found.handlers.map(fn => (req) => fn(req, found.params)) }
  }
})
```

itty-router:

```javascript
import { Router } from "itty-router"
import { flite } from "uflite/lite"

const itty = Router()
itty.get("/users/:id", req => new Response(JSON.stringify({ id: req.params.id }), { headers: { "content-type": "application/json" } }))

const app = flite({ match: ({ method, path }) => ({ handlers: [ req => itty.handle(req) ] }) })
```

Routers with `add`/`match`:

```javascript
const createMatchFromRoutes = (router, routes) => {
  for (const [method,, hs, path] of routes) if (method !== 'ALL') router.add(method, path, async req => { for (const f of hs) { const t = await f(req); if (t != null) return t } })
  return ({ method, path }) => router.match(method, path)
}
```

Hono's `PatternRouter`, `RegExpRouter`, and `TrieRouter` are tested as custom matchers in `tests/hono-router.spec.js`. Their `match()` result formats are Hono internals and differ between router types; the adapter must normalize the returned handler and parameter stash to uflite's `{ handlers, params? }` contract. These Hono subpath APIs can change between Hono releases, so pin and verify the Hono version when relying on them. The tested examples import from `hono/router/pattern-router`, `hono/router/reg-exp-router`, and `hono/router/trie-router`.

For Hono 4.x, this is the shape of the tested integration (choose one matcher class):

```js
import { PatternRouter } from 'hono/router/pattern-router'
import { flite } from 'uflite/lite'

const router = new PatternRouter()
router.add('GET', '/users/:id', request => new Response(JSON.stringify({ id: request.params.id }), {
  headers: { 'content-type': 'application/json' }
}))

const app = flite({ match: ({ method, path }) => {
  const [matches, stash = []] = router.match(method, path)
  if (!matches.length) return null
  return { handlers: matches.map(([handler, params = {}]) => request => {
    request.params = Object.fromEntries(Object.entries(params).map(([key, value]) => [
      key, typeof value === 'number' ? stash[value] : value
    ]))
    return handler(request)
  }) }
} })
```

## 🧪 Testing

```javascript
import { expect, test } from "bun:test";
import { flite, json } from "uflite/lite";

test("GET /users/:id", async () => {
	const app = flite();

	app.get("/users/:id", (req) => json({ id: req.params.id }));

	const res = await app.fetch(new Request("http://localhost/users/123"));

	expect(await res.json()).toEqual({ id: "123" });
});
```

---

## 📊 Bundle Size

The package has three entry points so an application can choose the smallest feature set it needs: `uflite/nano` for routing, `uflite/lite` for indexed routing and lifecycle hooks, and `uflite` for response formatting, error handling, services, events, and channels. Import only the entry point and helpers used by the app; service adapters and middleware are separate subpaths.

`bun run bench:size` bundles one minimal `GET /hello` route returning a `Response` for every package with the same Bun browser target, minifier, and gzip setting. Measured with Bun 1.4.1, Hono 4.10.6, and itty-router 4.2.2:

| Entry | Minified | Gzip |
| --- | ---: | ---: |
| uflite/nano | 1,377 B | 795 B |
| uflite/lite | 2,457 B | 1,238 B |
| uflite | 6,121 B | 2,679 B |
| Hono | 19,026 B | 7,623 B |
| itty-router | 1,122 B | 689 B |

In this fixture, lite and full uflite are smaller than Hono, while nano is 106 B larger gzip than itty-router. Keep the `nano` entry focused on the smallest route use case; if beating itty-router is a release requirement, this measurement identifies a remaining optimization target. Re-run `bun run bench:size` after changing routing code or dependencies. Runtime throughput is measured separately with `bun run bench`, `bun run bench:cmp`, `bun run bench:mitata`, and `bun run bench:url`.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│  Request                                 │
└────────────────┬────────────────────────┘
                 │
        ┌────────▼────────┐
        │  BEFORE HOOKS   │
        │  1. before.all  │
        │  2. before.get  │
        └────────┬────────┘
                 │
        ┌────────▼────────┐
        │  USE MIDDLEWARE │  ← Collected in order
        │  (ALL routes)   │
        └────────┬────────┘
                 │
        ┌────────▼────────┐
        │  ROUTE HANDLER  │
        │  (GET /path)    │  ← Breaks here
        └────────┬────────┘
                 │
        ┌────────▼────────┐
        │  AFTER HOOKS    │
        │  1. after.get   │
        │  2. after.all   │
        └────────┬────────┘
                 │
        ┌────────▼────────┐
        │  Response        │
        └──────────────────┘

If error thrown at any point:
        ┌────────────────┐
        │  ERROR HOOKS   │
        │  1. error.get  │
        │  2. error.all  │
        └────────────────┘
```

---

## 🔧 API Reference

### Entry points

- `uflite/nano` exports `flite` (also the default export): compact route registration and Fetch-compatible `app.fetch(request)`.
- `uflite/lite` exports `flite` (also default): indexed routing, mode 0 or 1, and global before/after/error hooks.
- `uflite` exports the full app with object-to-JSON formatting, default 404/error responses, service registration, events, channels, and helper namespaces.

Common app methods are `get`, `post`, `put`, `patch`, `delete`, `all`, `use`, `service`, `hooks`, and `teardown`. Route methods take a path followed by handlers. `app.fetch` accepts a standard Web `Request` and returns a `Promise<Response>`, making it usable directly as a Workers/Bun/Deno Fetch handler.

### Public middleware (`uflite/middlewares`)

The middleware package is optional and separate from the core bundle. Request middleware takes `(request, next)`; response middleware takes `(response, request, next)`. Register request handlers with `before.all` and response handlers with `after.all` in mode 1.

```js
import { flite } from 'uflite/lite'
import { cors, corsAfter, requestId, requestIdAfter, rateLimit, rateLimitAfter } from 'uflite/middlewares'

const app = flite({ mode: 1,
  before: { all: [cors({ origin: 'https://app.example' }), requestId(), rateLimit({ max: 60 })] },
  after: { all: [corsAfter, requestIdAfter, rateLimitAfter] }
})
app.get('/health', () => new Response('ok'))
```

| Factory | Options | Response phase |
| --- | --- | --- |
| `cors` | `origin`, `methods`, `credentials`, `maxAge`, `allowedHeaders`, `exposedHeaders` | `corsAfter` |
| `logger` | `format: 'dev' \| 'combined' \| 'json'`, `skip(request)` | `loggerAfter` |
| `rateLimit` | `windowMs`, `max`, `keyGenerator(request)`, `standardHeaders` | `rateLimitAfter` |
| `bearerAuth` | `token` or async/sync `verify(token)`, optional `realm` | — |
| `basicAuth` | required `users` map, optional `realm` | — |
| `bodyLimit` | `max` as bytes or a string such as `'10mb'` | — |
| `secureHeaders` | CSP, frame, HSTS, content-type, and referrer policy settings | `secureHeadersAfter` |
| `requestId` | header name and optional `generator()` | `requestIdAfter` |

The built-in rate limiter stores counters in process memory, so use a shared store for multi-instance deployments.

### Services

`app.service(name, service)` registers a service and creates REST routes for its standard methods; `app.service(name)` returns it. Service hooks can be set with `service.hooks({ before, after, error })`. `app.teardown()` calls service cleanup hooks where implemented.

```js
import { flite } from 'uflite'
import { createDBService } from 'uflite/services'

const app = flite()
const records = createDBService(undefined, { paginate: { default: 20, max: 100 } })
app.service('records', records)
// REST methods: GET /records, GET /records/:id, POST /records,
// PATCH /records/:id, DELETE /records/:id
```

`createDBService(provider?, options?)` adapts a collection provider; with no provider it uses an in-memory collection. `createTableService(db)` exposes table/schema CRUD for adapters that implement the required collection methods. `createStorageService(options?)` uses local files by default; set `type: 's3'` and provide bucket/credentials to use S3. `createStorage` aliases `createStorageService`. See the service-specific examples below for storage configuration and lifecycle hooks.

Register a table service around a database adapter that implements UMOSQL's schema operations:

```js
import { createTableService } from 'uflite/services'

const tables = app.service('tables', createTableService(dbAdapter))
await tables.create({ name: 'users', schema: { name: { type: 'TEXT', notNull: true } } })
const schema = await tables.get('users')
```

ACL is separately importable and uses `uqry` as a peer supplied by the application:

```js
import { createACL } from 'uflite/services/acl'

const acl = createACL({ enabled: true, rules: [
  { id: 'edit-own', permissions: ['user:posts:update'], check: { 'user.id': 'u1' } }
] })
const allowed = acl.can({ user: { id: 'u1' }, userId: 'u1' }, 'user:posts:update')
```

Auth is isolated from the core entry point. Install `better-auth` in the consuming application and pass a UMOSQL-compatible adapter, base URL, and secret to `createAuth`:

```js
import { createSchemalessAdapter } from 'umosql/schemaless'
import { createAuth } from 'uflite/services/auth'

const { adapter } = createSchemalessAdapter(undefined, 'memory')
const auth = await createAuth({
  adapter,
  baseURL: 'http://localhost:3000',
  secret: process.env.AUTH_SECRET
})
// In a Fetch server, forward auth endpoints to Better Auth:
export const handleAuth = request => auth.handler(request)
```

### Hooks, predicates, transformers, and resolvers

Import `uflite/hooks` for service lifecycle hooks. The flow module exports `iff`, `unless`, `throwIf`, `disallow`, `setResult`, and `setData`; the data module exports `requireFields`, `setDefaults`, `preventChanges`, `removeFields`, `transformData`, `setQueryDefaults`, `setField`, `pickDataFields`, `validateData`, `pickQueryFields`, `transformQuery`, and `preventEmptyData`. The auth module exports `requireAuth`, `requireRole`, `requirePermission`, `requireOwner`, `scopeToActor`, `requireMethod`, and `rateLimit`. Lifecycle hooks include `auditFields`, `publishEvent`, `sideEffect`, and `debug`; result hooks include `transformResult`, `pickResultFields`, `omitResultFields`, and `mapResult`. Use `uflite/predicates`, `uflite/transformers`, and `uflite/resolvers` for lower-level helpers. These independent package subpaths are not added to minimal nano imports. See the [hook specification](docs/HOOK_SPEC.md) and [real-world patterns](docs/REAL_WORLD_HOOKS.md) for signatures and options.
## 🌐 Runtime Compatibility

### Cloudflare Workers

```javascript
import { flite } from "uflite";

const app = flite();

app.get("/", () => ({ message: "Hello from Workers!" }));

export default app;
```

### Bun

```javascript
import { flite } from "uflite";

const app = flite();

app.get("/", () => ({ message: "Hello from Bun!" }));

Bun.serve({
	fetch: app.fetch,
	port: 3000,
});
```

### Deno

```javascript
import { flite } from "npm:uflite";

const app = flite();

app.get("/", () => ({ message: "Hello from Deno!" }));

Deno.serve(app.fetch);
```

### Node.js

Install the optional Node.js adapter with `npm install @hono/node-server`.

```javascript
import { flite } from "uflite";
import { serve } from "@hono/node-server";

const app = flite();

app.get("/", () => ({ message: "Hello from Node!" }));

serve({
	fetch: app.fetch,
	port: 3000,
});
```
---

### Hono integration

Use Hono when you want its middleware around requests handled by uflite. Install Hono as an optional dependency with `npm install hono`.

```javascript
import { Hono } from "hono";
import { flite } from "uflite";

const hono = new Hono();
const api = flite();

api.get("/hello", () => ({ message: "Hello from uflite!" }));

// Optional Hono middleware runs before the request is forwarded.
hono.use("*", async (_context, next) => {
	console.log("Request received");
	await next();
});

// Small adapter: forward Hono's native Request to uflite.
export const honoAdapter = (app, uflite) => {
	app.all("*", (context) => uflite.fetch(context.req.raw));
	return app;
};

export default honoAdapter(hono, api);
```

The Node.js and Hono integrations are optional. Neither `@hono/node-server` nor `hono` is a core runtime dependency of uflite.

---
### Browser (SPA)

```html
<div id="root"></div>
<script type="module">
import { flite } from 'uflite/lite'

const app = flite()
const html = (s) => new Response(s, { headers: { 'content-type': 'text/html; charset=utf-8' } })

app.get('/', () => html(`<h1>Home</h1><p><a href="/user/42">Go to user</a></p>`))
app.get('/user/:id', (req) => html(`<h1>User ${req.params.id}</h1><p><a href="/">Back</a></p>`))

const render = async (path) => {
  const res = await app.fetch(new Request(location.origin + path))
  if (res) document.getElementById('root').innerHTML = await res.text()
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('a')
  if (!a) return
  const href = a.getAttribute('href')
  if (!href || href.startsWith('http')) return
  e.preventDefault()
  history.pushState(null, '', href)
  render(href)
})

window.addEventListener('popstate', () => render(location.pathname))
render(location.pathname)
</script>
```
### Browser (React SPA)

```html
<div id="root"></div>
<script src="https://unpkg.com/react@18/umd/react.development.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
<script type="module">
import { flite } from 'uflite/lite'

const app = flite()

const Home = () => React.createElement('div', null, [
  React.createElement('h1', { key: 1 }, 'Home'),
  React.createElement('p', { key: 2 }, React.createElement('a', { href: '/user/42' }, 'Go to user'))
])

const User = ({ id }) => React.createElement('div', null, [
  React.createElement('h1', { key: 1 }, 'User ' + id),
  React.createElement('p', { key: 2 }, React.createElement('a', { href: '/' }, 'Back'))
])

app.get('/', () => Home)
app.get('/user/:id', (req) => {
  const Bound = () => React.createElement(User, { id: req.params.id })
  return Bound
})

const mount = (Comp) => {
  const rootEl = document.getElementById('root')
  const el = typeof Comp === 'function' ? React.createElement(Comp) : Comp
  if (ReactDOM.createRoot) ReactDOM.createRoot(rootEl).render(el)
  else ReactDOM.render(el, rootEl)
}

const ErrorView = () => React.createElement('div', null, 'Error')

document.addEventListener('click', (e) => {
  const a = e.target.closest('a')
  if (!a) return
  const href = a.getAttribute('href')
  if (!href || href.startsWith('http')) return
  e.preventDefault()
  history.pushState(null, '', href)
  app.fetch(new Request(location.origin + href)).then((Comp) => mount(Comp)).catch(() => mount(ErrorView))
})

window.addEventListener('popstate', () => app.fetch(new Request(location.origin + location.pathname)).then((Comp) => mount(Comp)).catch(() => mount(ErrorView)))
app.fetch(new Request(location.origin + location.pathname)).then((Comp) => mount(Comp)).catch(() => mount(ErrorView))
</script>


```
---

## Storage Service

`createStorageService()` defaults to local files in `./data/files`. It supports upload, download, metadata, listing, and deletion through service methods and HTTP routes. Raw HTTP uploads use `PUT /storage?key=folder/file.txt`; downloads use `GET /storage/download?key=folder/file.txt`.

For local storage, set `basePath` to choose a different directory and `maxFileSize` to set the upload limit. Local storage is suitable for development and single-instance deployments. Use shared durable storage such as S3 when multiple instances must see the same files.

Pass `type: 's3'` to explicitly select S3-compatible storage. Existing S3 configurations that provide `bucket`, `region`, or credentials continue to select S3 automatically.

### S3-compatible backend

```js
import { createStorageService } from 'uflite/services'

app.service('storage', createStorageService({
  type: 's3',
  endpoint: 'http://localhost:9000', // omit for AWS S3
  region: 'us-east-1',
  accessKeyId: storageAccessKey,
  secretAccessKey: storageSecretKey,
  bucket: 'uploads'
}))
```

Request an upload URL with `POST /storage/presign` and `{ key, contentType }`, then `PUT` the file directly to the returned `url`, using the returned `headers`. Request downloads with `POST /storage/presign-download` and `{ key }`. `GET /storage` lists objects; `GET /storage/:id` reads metadata; `DELETE /storage/:id` deletes an object. The `/storage/head` and `/storage/delete` POST routes accept `{ key }` for keys containing slashes.

Storage operations use the normal service hooks. Their REST routes include the server-side `request` in hook `params`, so authorization hooks can inspect trusted authentication state attached by middleware. Do not authorize from a user-supplied key prefix alone.

Configure bucket CORS at the storage provider to allow the frontend origin, `PUT`, and the signed request headers. Presigned PUT URLs do not enforce a maximum file size; `contentLength` is rejected instead of implying a limit. `ListObjectsV2` does not return per-object content types, so list entries have `contentType: null`; use object metadata for the content type. Multipart uploads and live-provider tests require separate infrastructure and are not included in this first service implementation.

## Database Service Defaults

`createDBService()` uses an isolated in-memory collection by default and accepts optional `initialData`. This data is lost when the process exits and is not shared between server instances. For production persistence, pass a collection provider backed by your configured database:

```js
import { createDBService } from 'uflite/services'

app.service('users', createDBService(params => database.collection('users')))
```

## Generic Service Hooks and Utilities

uflite includes reusable service hooks, predicates, data transformers, and field resolver helpers. They use the existing service lifecycle and error type, and work in both hook modes.

```js
import { flite } from 'uflite'
import { requireAuth, requireFields, setDefaults, auditFields, transformResult } from 'uflite/hooks'
import * as transformers from 'uflite/transformers'

const app = flite()
const users = app.service('users', userService)
users.hooks({
  before: { create: [requireAuth(), requireFields(['email']), setDefaults({ active: true }), auditFields()] },
  after: { get: [transformResult(user => transformers.pick(['id', 'email'])(user))] }
})
```

Public subpaths include `uflite/middlewares`, `uflite/utils`, `uflite/hooks`, `uflite/predicates`, `uflite/transformers`, `uflite/resolvers`, and `uflite/services`. The optional `uflite/services/auth` and `uflite/services/acl` entries require the consuming application to provide `better-auth` and `uqry`, respectively; neither is loaded through the core or generic service entry. `better-auth` remains a development dependency. The services module exports `createDBService`, `createTableService`, `createStorageService`, and `createStorage`. See the [hook specification](docs/HOOK_SPEC.md) and [real-world patterns](docs/REAL_WORLD_HOOKS.md) for hook API and practical guidance.

## 🤝 Contributing

Contributions are welcome. Run `bun test` for the suite and `bun run build` to regenerate distributable files before opening a change.

---

## 📄 License

MIT © [Kethan Surana](https://github.com/kethan)

---

## 🙏 Acknowledgments

Inspired by:

- [itty-router](https://github.com/kwhitley/itty-router) - Minimal routing
- [Hono](https://hono.dev) - Middleware pattern
- [FeathersJS](https://feathersjs.com) - Service architecture

---

## 📚 Examples

See [/examples](./examples) for the checked-in browser SPA, React browser, middleware, and service-worker examples. Service APIs and hooks are documented above; the examples directory does not currently contain chat, SSR, or WebSocket demos.

---

**Built with ❤️ for the edge**
