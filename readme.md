# 🪶 Flite

**Ultra-lightweight web framework combining the routing power of [Hono](https://hono.dev)/[itty-router](https://itty.dev) with [Feathers](https://feathersjs.com)-like services.**

[![tests](https://github.com/kethan/uflite/actions/workflows/node.js.yml/badge.svg)](https://github.com/kethan/uflite/actions/workflows/node.js.yml)
[![Version](https://img.shields.io/npm/v/uflite.svg?color=success&style=flat-square)](https://www.npmjs.com/package/uflite)
[![Badge size](https://deno.bundlejs.com/badge?q=uflite&treeshake=[*]&config={"compression":"brotli"})](https://unpkg.com/uflite)
[![Badge size](https://deno.bundlejs.com/badge?q=uflite&treeshake=[*]&config={"compression":"gzip"})](https://unpkg.com/uflite)

Works everywhere: **Cloudflare Workers**, **Bun**, **Node.js**, **Deno**, **Browser**, and any edge runtime.

```bash
npm install uflite
```

---

## ✨ Features

- 🚀 **Tiny** - Only ~2kb minified gzipped
- 🌍 **Universal** - Works in Node, Bun, Deno, Cloudflare Workers, browsers
- 🎯 **Express-like API** - Familiar routing with optional `mode: 1` for Express-style middleware
- 🦅 **Feathers Services** - Built-in CRUD services with hooks & events
- 🔌 **Real-time Channels** - WebSocket-like pub/sub system
- 🎨 **Auto Response Formatting** - JSON, HTML, Text helpers
- 🪝 **Powerful Hooks** - Before/after hooks at app & service level
- 📡 **Event Emitter** - Built-in event system
- 🧩 **Sub-apps** - Mount routers infinitely deep
- ⚡ **Edge-ready** - Perfect for Cloudflare Workers, Deno Deploy

---

## 🚀 Quick Start

### Basic Routing

```javascript
import { flite, json, text } from "uflite";

const app = flite();

app.get("/hello/:name", (req) => {
	return text(`Hello, ${req.params.name}!`);
});

app.post("/users", async (req) => {
	const body = await req.json();
	return json({ created: body });
});

// Cloudflare Workers
export default app;
// Bun
export default {...app};


// Or Node.js / Bun.serve
Bun.serve({
	port: 3000,
	fetch: app.fetch,
});
```

### Feathers-like Services

```javascript
const app = flite();

// Define a service
app.service("users", {
	users: [
		{ id: 1, name: "Alice" },
		{ id: 2, name: "Bob" },
	],

	async find(params) {
		return { data: this.users, total: this.users.length };
	},

	async get(id, params) {
		return this.users.find((u) => u.id == id);
	},

	async create(data, params) {
		const user = { id: Date.now(), ...data };
		this.users.push(user);
		return user;
	},

	async patch(id, data, params) {
		const user = this.users.find((u) => u.id == id);
		Object.assign(user, data);
		return user;
	},

	async remove(id, params) {
		const idx = this.users.findIndex((u) => u.id == id);
		return this.users.splice(idx, 1)[0];
	},
});

// Auto-creates REST endpoints:
// GET    /users       → find()
// GET    /users/:id   → get(id)
// POST   /users       → create(data)
// PATCH  /users/:id   → patch(id, data)
// PUT    /users/:id   → update(id, data)
// DELETE /users/:id   → remove(id)
```

---

## 📖 Table of Contents

- [Routing](#-routing)
- [Middleware](#-middleware)
- [Services](#-services)
- [Hooks](#-hooks)
- [Events & Channels](#-events--channels)
- [Error Handling](#-error-handling)
- [Response Helpers](#-response-helpers)
- [Express Mode](#-express-mode-mode-1)
- [Platform Examples](#-platform-examples)

---

## 🛣️ Routing

### HTTP Methods

```javascript
app.get("/users", () => json({ users: [] }));
app.post("/users", async (req) => json(await req.json()));
app.put("/users/:id", (req) => json({ id: req.params.id }));
app.patch("/users/:id", (req) => json({ id: req.params.id }));
app.delete("/users/:id", (req) => json({ deleted: req.params.id }));
app.all("/ping", () => text("pong")); // Any method
```

### Path Parameters

```javascript
app.get("/users/:id/posts/:postId", (req) => {
	return json({
		userId: req.params.id,
		postId: req.params.postId,
	});
});
```

### Query Parameters

```javascript
app.get("/search", (req) => {
	return json({
		q: req.query.q,
		limit: req.query.limit,
	});
});

// GET /search?q=javascript&limit=10
```

### Wildcards

```javascript
app.get("/api/*", () => json({ matched: true }));
app.all("*", () => json({ error: "Not found" }, { status: 404 }));
```

### Nested Routers

```javascript
const api = flite();
api.get("/users", () => json({ users: [] }));
api.get("/posts", () => json({ posts: [] }));

const admin = flite();
admin.get("/dashboard", () => json({ admin: true }));

const app = flite();
app.use("/api", api); // Mounts at /api/users, /api/posts
app.use("/admin", admin); // Mounts at /admin/dashboard
```

---

## 🔗 Middleware

### Global Middleware

```javascript
const app = flite({
	before: {
		all: [
			(req) => {
				console.log(req.method, req.url);
			},
		],
	},
});
```

### Method-Specific Middleware

```javascript
const app = flite({
	before: {
		post: [
			(req) => {
				if (!req.headers.get("content-type")?.includes("json")) {
					return json({ error: "JSON required" }, { status: 400 });
				}
			},
		],
	},
});
```

### Route Middleware

```javascript
const auth = (req) => {
	if (!req.headers.get("authorization")) {
		return json({ error: "Unauthorized" }, { status: 401 });
	}
};

app.get("/protected", auth, () => json({ secret: "data" }));
```

### Multiple Handlers

```javascript
app.get(
	"/multi",
	(req) => {
		req.step1 = true;
	},
	(req) => {
		req.step2 = true;
	},
	(req) => json({ step1: req.step1, step2: req.step2 })
);
```

---

## 🦅 Services

Services provide a structured way to build REST APIs with automatic endpoint creation.

### Basic Service

```javascript
app.service("messages", {
	messages: [],

	async find(params) {
		// GET /messages
		return { data: this.messages, total: this.messages.length };
	},

	async get(id, params) {
		// GET /messages/:id
		return this.messages.find((m) => m.id === id);
	},

	async create(data, params) {
		// POST /messages
		const msg = { id: Date.now(), ...data };
		this.messages.push(msg);
		return msg;
	},

	async patch(id, data, params) {
		// PATCH /messages/:id
		const msg = this.messages.find((m) => m.id === id);
		Object.assign(msg, data);
		return msg;
	},

	async update(id, data, params) {
		// PUT /messages/:id (full replace)
		const idx = this.messages.findIndex((m) => m.id === id);
		this.messages[idx] = { id, ...data };
		return this.messages[idx];
	},

	async remove(id, params) {
		// DELETE /messages/:id
		const idx = this.messages.findIndex((m) => m.id === id);
		return this.messages.splice(idx, 1)[0];
	},
});
```

### Custom Service Methods

```javascript
app.service("auth", {
	async login(email, password) {
		// Custom method (no auto-route)
		if (email === "user@example.com" && password === "secret") {
			return { token: "abc123" };
		}
		throw new status(401, "Invalid credentials");
	},
});

// Call directly
const result = await app.service("auth").login("user@example.com", "secret");
```

### Service Events

```javascript
app.service("users").on("created", (user) => {
	console.log("New user:", user);
	// Send welcome email, etc.
});

app.service("users").on("removed", (user) => {
	console.log("User deleted:", user);
});

// Events auto-fire on create, patch, update, remove
```

---

## 🪝 Hooks

Hooks let you intercept and modify service calls.

### Service-Level Hooks

```javascript
app.service("posts").hooks({
	before: {
		all: [
			async (ctx) => {
				console.log("Before:", ctx.method);
				return ctx;
			},
		],
		create: [
			async (ctx) => {
				// Add timestamp
				ctx.data.createdAt = new Date();
				return ctx;
			},
		],
		patch: [
			async (ctx) => {
				// Add updatedAt
				ctx.data.updatedAt = new Date();
				return ctx;
			},
		],
	},
	after: {
		all: [
			async (ctx) => {
				// Remove sensitive data
				delete ctx.result.password;
				return ctx;
			},
		],
	},
});
```

### App-Level Hooks

```javascript
const app = flite();

app.hooks({
	before: {
		all: [
			async (ctx) => {
				// Runs for ALL services
				ctx.params.timestamp = Date.now();
				return ctx;
			},
		],
		remove: [
			async (ctx) => {
				// Check permissions before any delete
				if (!ctx.params.user?.isAdmin) {
					throw new status(403, "Admin only");
				}
				return ctx;
			},
		],
	},
	after: {
		all: [
			async (ctx) => {
				console.log("Service call completed:", ctx.method);
				return ctx;
			},
		],
	},
});
```

### Hook Context

```javascript
{
	app, // App instance
		service, // Service object
		method, // 'find', 'get', 'create', etc.
		path, // Service path
		id, // For get/patch/update/remove
		data, // For create/patch/update
		params, // Query params, user context, etc.
		result; // In after hooks
}
```

---

## 📡 Events & Channels

### Global Events

```javascript
app.on("user:login", (user) => {
	console.log("User logged in:", user);
});

app.emit("user:login", { id: 1, name: "Alice" });

app.off("user:login", handler); // Remove listener
```

### Channels (Real-time)

```javascript
// WebSocket-like pub/sub system
const lobby = app.channel("lobby");

// Join channel
lobby.join(websocket, { userId: 123, role: "user" });

// Broadcast to all
lobby.send("message", { text: "Hello everyone!" });

// Filtered broadcast
lobby
	.filter((userData) => userData.role === "admin")
	.send("admin-alert", { level: "critical" });

// Leave channel
lobby.leave(websocket);
```

### Service + Channels Integration

```javascript
app.service("chat").on("created", (message) => {
	// Broadcast new messages to room
	app.channel(`room-${message.roomId}`).send("new-message", message);
});
```

---

## ⚠️ Error Handling

### Custom Errors

```javascript
import { status } from "uflite";

app.get("/protected", (req) => {
	if (!req.headers.get("auth")) {
		throw new status(401, "Unauthorized");
	}
	return json({ secret: "data" });
});
```

### Global Error Handler

```javascript
const app = flite({
	error: {
		all: [
			(err, req) => {
				console.error(err);
				return json(
					{
						error: err.message,
						path: new URL(req.url).pathname,
					},
					{ status: err.status || 500 }
				);
			},
		],
	},
});
```

### Method-Specific Error Handlers

```javascript
const app = flite({
	error: {
		get: [(err) => json({ getError: err.message }, { status: 500 })],
		post: [(err) => json({ postError: err.message }, { status: 500 })],
	},
});
```

---

## 📝 Response Helpers

```javascript
import { text, html, json, error } from "uflite";

app.get("/text", () => text("Plain text"));
app.get("/html", () => html("<h1>Hello</h1>"));
app.get("/json", () => json({ foo: "bar" }));
app.get("/error", () => error(404, "Not found"));

// Or return Response directly
app.get("/custom", () => {
	return new Response("Custom", {
		status: 201,
		headers: { "X-Custom": "Header" },
	});
});

// Auto-formatting (if format: json set)
app.get("/auto", () => ({ auto: "formatted" }));
```

---

## 🎯 Express Mode (`mode: 1`)

Enable Express/Koa-style middleware with explicit `next()` calls.

```javascript
const app = flite({ mode: 1 });

app.use(async (req, env, ctx, next) => {
	console.log("Before");
	await next(); // Must call next()
	console.log("After");
});

app.get(
	"/test",
	async (req, env, ctx, next) => {
		req.user = { id: 1 };
		await next();
	},
	async (req, env, ctx, next) => {
		return json({ user: req.user });
	}
);
```

### Cloudflare Workers Pattern

```javascript
const app = flite({ mode: 1 });

// Cache middleware
app.use(async (req, env, ctx, next) => {
	const cache = await env.KV.get(req.url);
	if (cache) return json(JSON.parse(cache));

	await next();
});

app.get("/data", async (req, env, ctx) => {
	const data = { cached: true };
	await env.KV.put(req.url, JSON.stringify(data));
	return json(data);
});

export default app;
```

---

## 🌍 Platform Examples

### Cloudflare Workers

```javascript
import { flite, json } from "uflite";

const app = flite();

app.get("/api/users", async (req, env, ctx) => {
	// Access Cloudflare bindings
	const users = await env.DB.prepare("SELECT * FROM users").all();
	return json(users);
});

export default app;
```

### Bun

```javascript
import { flite, json } from "uflite";

const app = flite();

app.get("/", () => json({ message: "Hello from Bun!" }));

Bun.serve({
	port: 3000,
	fetch: app.fetch,
});
```

### Node.js (with adapters)

```javascript
import { flite } from "uflite";
import { serve } from "@hono/node-server";

const app = flite();

app.get("/", () => ({ message: "Hello from Node!" }));

serve({ fetch: app.fetch, port: 3000 });
```

### Deno

```javascript
import { flite } from "https://esm.sh/uflite";

const app = flite();

app.get("/", () => ({ message: "Hello from Deno!" }));

Deno.serve(app.fetch);
```

---

## 🔧 Advanced Usage

### Cross-Service Communication

```javascript
// When user is created, create a welcome post
app.service("users").on("created", async (user) => {
	await app.service("posts").create({
		title: `Welcome ${user.name}!`,
		userId: user.id,
	});
});
```

### Setup & Teardown

```javascript
app.service("database", {
	connection: null,

	async setup(app, path) {
		this.connection = await connectToDatabase();
	},

	async teardown() {
		await this.connection.close();
	},

	async find(params) {
		return this.connection.query("SELECT * FROM items");
	},
});

// On shutdown
await app.teardown();
```

### Service with Non-Standard Methods

```javascript
app.service("analytics", {
	async find(params) {
		return { visits: 1000 };
	},

	// Custom method (no auto-route)
	async calculateMetrics(startDate, endDate) {
		return { revenue: 5000, users: 200 };
	},
});

// Call custom method directly
const metrics = await app
	.service("analytics")
	.calculateMetrics("2024-01-01", "2024-01-31");
```

---

## 📊 Comparison

| Feature      | Flite    | Hono            | itty-router | Feathers |
| ------------ | -------- | --------------- | ----------- | -------- |
| Size         | **~8KB** | ~12KB           | ~1KB        | ~50KB    |
| Services     | ✅       | ❌              | ❌          | ✅       |
| Hooks        | ✅       | ✅ (middleware) | ❌          | ✅       |
| Channels     | ✅       | ❌              | ❌          | ✅       |
| Events       | ✅       | ❌              | ❌          | ✅       |
| Edge Runtime | ✅       | ✅              | ✅          | ❌       |
| Auto CRUD    | ✅       | ❌              | ❌          | ✅       |

---

## 📚 API Reference

### `flite(options)`

```javascript
const app = flite({
	format: json, // Auto-format responses (json | html | text | false)
	mode: 0, // 0 = auto-next, 1 = explicit next()
	before: {}, // Global before hooks
	after: {}, // Global after hooks
	error: {}, // Global error handlers
	hooks: {}, // Alias for before/after
});
```

### Router Methods

- `app.get(path, ...handlers)`
- `app.post(path, ...handlers)`
- `app.put(path, ...handlers)`
- `app.patch(path, ...handlers)`
- `app.delete(path, ...handlers)`
- `app.all(path, ...handlers)`
- `app.use(path?, ...routers|handlers)`

### Service Methods

- `app.service(name, service?)` - Register or get service
- `service.hooks({ before, after })` - Add hooks
- `service.on(event, handler)` - Listen to events

### Events

- `app.on(event, handler)` - Listen
- `app.off(event, handler)` - Remove
- `app.emit(event, ...args)` - Emit

### Channels

- `app.channel(name)` - Get/create channel
- `channel.join(conn, data)` - Add connection
- `channel.leave(conn)` - Remove connection
- `channel.send(event, data)` - Broadcast
- `channel.filter(fn).send(event, data)` - Filtered broadcast

---

## 🧪 Testing

All 130+ test cases pass. See `test.spec.js` examples.

```bash
bun test
```

---

## 📄 License

MIT ©

---

## 🤝 Contributing

PRs welcome!

---

## ⭐ Show Your Support

If you like this project, give it a ⭐️!

---

**Built with ❤️ for the edge computing era.**
