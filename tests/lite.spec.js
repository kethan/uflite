import { describe, it, expect } from "bun:test";
import { flite } from "../lite/index.js";
import { json } from '../plugins.js';
import Trouter from "trouter";

const makeRequest = (path, method = "GET", body) =>
    new Request("http://localhost" + path, {
        method,
        body: body ? JSON.stringify(body) : undefined,
        headers: { "content-type": "application/json" },
    });

describe("CORE - Before Hooks (Mode 0)", () => {
    it("runs before.all hook", async () => {
        const calls = [];
        const app = flite({
            mode: 0,
            before: {
                all: [req => { calls.push("before-all"); }],
            },
        });

        app.GET("/test", () => json({ ok: true }));
        await app.fetch(makeRequest("/test"));

        expect(calls).toEqual(["before-all"]);
    });

    it("runs method-specific before hook", async () => {
        const calls = [];
        const app = flite({
            mode: 0,
            before: {
                get: [req => { calls.push("before-get"); }],
                post: [req => { calls.push("before-post"); }],
            },
        });

        app.GET("/test", () => json({ ok: true }));
        app.POST("/test", () => json({ ok: true }));

        await app.fetch(makeRequest("/test", "GET"));
        await app.fetch(makeRequest("/test", "POST"));

        expect(calls).toEqual(["before-get", "before-post"]);
    });

    it("runs before.all then before.method", async () => {
        const calls = [];
        const app = flite({
            mode: 0,
            before: {
                all: [req => { calls.push("before-all"); }],
                get: [req => { calls.push("before-get"); }],
            },
        });

        app.GET("/test", () => json({ ok: true }));
        await app.fetch(makeRequest("/test"));

        expect(calls).toEqual(["before-all", "before-get"]);
    });

    it("runs multiple before hooks in sequence", async () => {
        const calls = [];
        const app = flite({
            mode: 0,
            before: {
                all: [
                    req => { calls.push("before-1"); },
                    req => { calls.push("before-2"); },
                    req => { calls.push("before-3"); },
                ],
            },
        });

        app.GET("/test", () => json({ ok: true }));
        await app.fetch(makeRequest("/test"));

        expect(calls).toEqual(["before-1", "before-2", "before-3"]);
    });

    it("can modify request in before hook", async () => {
        const app = flite({
            mode: 0,
            before: {
                all: [req => { req.customProp = "injected"; }],
            },
        });

        app.GET("/test", req => json({ prop: req.customProp }));
        const res = await app.fetch(makeRequest("/test"));

        expect(await res.json()).toEqual({ prop: "injected" });
    });

    it("short-circuits if before hook returns value", async () => {
        const calls = [];
        const app = flite({
            mode: 0,
            before: {
                all: [
                    req => { calls.push("before-1"); },
                    req => {
                        calls.push("before-2");
                        return json({ early: true });
                    },
                    req => { calls.push("before-3"); },
                ],
            },
        });

        app.GET("/test", () => {
            calls.push("handler");
            return json({ ok: true });
        });

        const res = await app.fetch(makeRequest("/test"));
        expect(await res.json()).toEqual({ early: true });
        expect(calls).toEqual(["before-1", "before-2"]);
    });
});

describe("CORE - Before Hooks (Mode 1)", () => {
    it("runs before hooks with next() callback", async () => {
        const calls = [];
        const app = flite({
            mode: 1,
            before: {
                all: [
                    async (req, next) => {
                        calls.push("→ before-1");
                        await next();
                        calls.push("← before-1");
                    },
                    async (req, next) => {
                        calls.push("→ before-2");
                        await next();
                        calls.push("← before-2");
                    },
                ],
            },
        });

        app.GET("/test", () => {
            calls.push("★ handler");
            return json({ ok: true });
        });

        await app.fetch(makeRequest("/test"));
        expect(calls).toEqual([
            "→ before-1",
            "→ before-2",
            "← before-2",
            "← before-1",
            "★ handler",
        ]);
    });

    it("before hook can short-circuit with return value", async () => {
        const calls = [];
        const app = flite({
            mode: 1,
            before: {
                all: [
                    async (req, next) => {
                        calls.push("before-1");
                        return json({ stopped: true });
                    },
                ],
            },
        });

        app.GET("/test", () => {
            calls.push("handler");
            return json({ ok: true });
        });

        const res = await app.fetch(makeRequest("/test"));
        expect(await res.json()).toEqual({ stopped: true });
        expect(calls).toEqual(["before-1"]);
    });
});

describe("CORE - After Hooks (Mode 0)", () => {
    it("runs after.all hook", async () => {
        const calls = [];
        const app = flite({
            mode: 0,
            after: {
                all: [(res, req) => { calls.push("after-all"); return res; }],
            },
        });

        app.GET("/test", () => json({ ok: true }));
        await app.fetch(makeRequest("/test"));

        expect(calls).toEqual(["after-all"]);
    });

    it("runs method-specific after hook", async () => {
        const calls = [];
        const app = flite({
            mode: 0,
            after: {
                get: [(res, req) => { calls.push("after-get"); return res; }],
                post: [(res, req) => { calls.push("after-post"); return res; }],
            },
        });

        app.GET("/test", () => json({ ok: true }));
        app.POST("/test", () => json({ ok: true }));

        await app.fetch(makeRequest("/test", "GET"));
        await app.fetch(makeRequest("/test", "POST"));

        expect(calls).toEqual(["after-get", "after-post"]);
    });

    it("runs after.method then after.all (reversed order)", async () => {
        const calls = [];
        const app = flite({
            mode: 0,
            after: {
                get: [(res, req) => { calls.push("after-get"); return res; }],
                all: [(res, req) => { calls.push("after-all"); return res; }],
            },
        });

        app.GET("/test", () => json({ ok: true }));
        await app.fetch(makeRequest("/test"));

        expect(calls).toEqual(["after-get", "after-all"]);
    });

    it("can modify response in after hook", async () => {
        const app = flite({
            mode: 0,
            after: {
                all: [(res, req) => ({ ...res, modified: true })],
            },
        });

        app.GET("/test", () => ({ original: true }));
        const res = await app.fetch(makeRequest("/test"));

        expect(res).toEqual({ original: true, modified: true });
    });

    it("chains multiple after hooks", async () => {
        const app = flite({
            mode: 0,
            after: {
                all: [
                    (res, req) => ({ ...res, step1: true }),
                    (res, req) => ({ ...res, step2: true }),
                    (res, req) => ({ ...res, step3: true }),
                ],
            },
        });

        app.GET("/test", () => ({ original: true }));
        const res = await app.fetch(makeRequest("/test"));

        expect(res).toEqual({ original: true, step1: true, step2: true, step3: true });
    });

    it("after hook can format response to JSON", async () => {
        const app = flite({
            mode: 0,
            after: {
                all: [json],
            },
        });

        app.GET("/test", () => ({ data: "raw object" }));
        const res = await app.fetch(makeRequest("/test"));

        expect(res.headers.get("content-type")).toBe("application/json; charset=utf-8");
        expect(await res.json()).toEqual({ data: "raw object" });
    });

    it("after hook preserves Response objects", async () => {
        const app = flite({
            mode: 0,
            after: {
                all: [json],
            },
        });

        app.GET("/test", () => new Response("Already a response", {
            headers: { "content-type": "text/plain" },
        }));

        const res = await app.fetch(makeRequest("/test"));
        expect(res.headers.get("content-type")).toBe("text/plain");
        expect(await res.text()).toBe("Already a response");
    });

    it("after hook receives undefined if no handler matched", async () => {
        let capturedRes;
        const app = flite({
            mode: 0,
            after: {
                all: [(res, req) => {
                    capturedRes = res;
                    return json({ fallback: true });
                }],
            },
        });

        app.GET("/exists", () => json({ ok: true }));
        await app.fetch(makeRequest("/nope"));

        expect(capturedRes).toBeUndefined();
    });
});

describe("CORE - After Hooks (Mode 1)", () => {
    it("runs after hooks with middleware pattern", async () => {
        const calls = [];
        const app = flite({
            mode: 1,
            after: {
                all: [
                    async (res, req, next) => {
                        calls.push("→ after-1");
                        const result = await next();
                        calls.push("← after-1");
                        return result;
                    },
                    async (res, req, next) => {
                        calls.push("→ after-2");
                        await next();
                        calls.push("← after-2");
                    },
                ],
            },
        });

        app.GET("/test", () => {
            calls.push("★ handler");
            return json({ ok: true });
        });

        await app.fetch(makeRequest("/test"));
        expect(calls).toEqual([
            "★ handler",
            "→ after-1",
            "→ after-2",
            "← after-2",
            "← after-1",
        ]);
    });

    it("after hook can transform response", async () => {
        const app = flite({
            mode: 1,
            after: {
                all: [
                    async (res, req, next) => {
                        const modified = { ...res, timestamp: Date.now() };
                        return await next() || modified;
                    },
                ],
            },
        });

        app.GET("/test", () => ({ data: "test" }));
        const res = await app.fetch(makeRequest("/test"));

        expect(res.data).toBe("test");
        expect(res.timestamp).toBeDefined();
    });
});

describe("CORE - Error Hooks (Mode 0)", () => {
    it("catches errors with error.all hook", async () => {
        const app = flite({
            mode: 0,
            error: {
                all: [(err, req) => json({ caught: err.message }, { status: 500 })],
            },
        });

        app.GET("/fail", () => {
            throw new Error("Something broke");
        });

        const res = await app.fetch(makeRequest("/fail"));
        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({ caught: "Something broke" });
    });

    it("uses method-specific error hook", async () => {
        const app = flite({
            mode: 0,
            error: {
                get: [(err, req) => json({ method: "GET", error: err.message }, { status: 400 })],
                post: [(err, req) => json({ method: "POST", error: err.message }, { status: 500 })],
            },
        });

        app.GET("/fail", () => { throw new Error("GET error"); });
        app.POST("/fail", () => { throw new Error("POST error"); });

        const res1 = await app.fetch(makeRequest("/fail", "GET"));
        const res2 = await app.fetch(makeRequest("/fail", "POST"));

        expect(res1.status).toBe(400);
        expect(await res1.json()).toEqual({ method: "GET", error: "GET error" });
        expect(res2.status).toBe(500);
        expect(await res2.json()).toEqual({ method: "POST", error: "POST error" });
    });

    it("catches errors from before hooks", async () => {
        const app = flite({
            mode: 0,
            before: {
                all: [req => { throw new Error("Before hook error"); }],
            },
            error: {
                all: [(err, req) => json({ caught: err.message })],
            },
        });

        app.GET("/test", () => json({ ok: true }));
        const res = await app.fetch(makeRequest("/test"));

        expect(await res.json()).toEqual({ caught: "Before hook error" });
    });

    it("catches errors from after hooks", async () => {
        const app = flite({
            mode: 0,
            after: {
                all: [(res, req) => { throw new Error("After hook error"); }],
            },
            error: {
                all: [(err, req) => json({ caught: err.message })],
            },
        });

        app.GET("/test", () => json({ ok: true }));
        const res = await app.fetch(makeRequest("/test"));

        expect(await res.json()).toEqual({ caught: "After hook error" });
    });

    it("catches async errors", async () => {
        const app = flite({
            mode: 0,
            error: {
                all: [(err, req) => json({ async: err.message })],
            },
        });

        app.GET("/async-fail", async () => {
            await new Promise(r => setTimeout(r, 10));
            throw new Error("Async error");
        });

        const res = await app.fetch(makeRequest("/async-fail"));
        expect(await res.json()).toEqual({ async: "Async error" });
    });

    it("re-throws if no error hooks defined", async () => {
        const app = flite({ mode: 0 });

        app.GET("/fail", () => {
            throw new Error("Unhandled");
        });

        try {
            await app.fetch(makeRequest("/fail"));
            expect(true).toBe(false); // Should not reach
        } catch (err) {
            expect(err.message).toBe("Unhandled");
        }
    });

    it("error hook receives request context", async () => {
        let capturedReq;
        const app = flite({
            mode: 0,
            error: {
                all: [(err, req) => {
                    capturedReq = req;
                    return json({ error: err.message });
                }],
            },
        });

        app.GET("/user/:id", () => {
            throw new Error("fail");
        });

        await app.fetch(makeRequest("/user/123?admin=true"));

        expect(capturedReq.params).toEqual({ id: "123" });
        expect(capturedReq.query).toEqual({ admin: "true" });
    });
});

describe("CORE - Error Hooks (Mode 1)", () => {
    it("error hooks work with middleware pattern", async () => {
        const calls = [];
        const app = flite({
            mode: 1,
            error: {
                all: [
                    async (err, req, next) => {
                        calls.push("→ error-1");
                        const result = await next();
                        calls.push("← error-1");
                        return result || json({ handled: err.message });
                    },
                    async (err, req, next) => {
                        calls.push("→ error-2");
                        await next();
                        calls.push("← error-2");
                    },
                ],
            },
        });

        app.GET("/fail", () => {
            throw new Error("test");
        });

        const res = await app.fetch(makeRequest("/fail"));
        expect(await res.json()).toEqual({ handled: "test" });
        expect(calls).toEqual(["→ error-1", "→ error-2", "← error-2", "← error-1"]);
    });
});

describe("CORE - Hook Combinations", () => {
    it("runs before → route → after in sequence", async () => {
        const calls = [];
        const app = flite({
            mode: 0,
            before: {
                all: [req => { calls.push("before"); }],
            },
            after: {
                all: [(res, req) => { calls.push("after"); return res; }],
            },
        });

        app.GET("/test", () => {
            calls.push("handler");
            return json({ ok: true });
        });

        await app.fetch(makeRequest("/test"));
        expect(calls).toEqual(["before", "handler", "after"]);
    });

    it("runs all hook types together (Mode 0)", async () => {
        const calls = [];
        const app = flite({
            mode: 0,
            before: {
                all: [req => { calls.push("before-all"); }],
                get: [req => { calls.push("before-get"); }],
            },
            after: {
                get: [(res, req) => { calls.push("after-get"); return res; }],
                all: [(res, req) => { calls.push("after-all"); return res; }],
            },
        });

        app.GET("/test", () => {
            calls.push("handler");
            return json({ ok: true });
        });

        await app.fetch(makeRequest("/test"));
        expect(calls).toEqual(["before-all", "before-get", "handler", "after-get", "after-all"]);
    });

    it("error hook catches errors even with before/after hooks", async () => {
        const calls = [];
        const app = flite({
            mode: 0,
            before: {
                all: [req => { calls.push("before"); }],
            },
            after: {
                all: [(res, req) => { calls.push("after"); return res; }],
            },
            error: {
                all: [(err, req) => {
                    calls.push("error");
                    return json({ caught: true });
                }],
            },
        });

        app.GET("/fail", () => {
            calls.push("handler");
            throw new Error("fail");
        });

        await app.fetch(makeRequest("/fail"));
        expect(calls).toEqual(["before", "handler", "error"]);
    });

    it("complete flow with Mode 1 (before, route, after, error)", async () => {
        const calls = [];
        const app = flite({
            mode: 1,
            before: {
                all: [
                    async (req, next) => {
                        calls.push("→ before");
                        await next();
                        calls.push("← before");
                    },
                ],
            },
            after: {
                all: [
                    async (res, req, next) => {
                        calls.push("→ after");
                        const result = await next();
                        calls.push("← after");
                        return result || res;
                    },
                ],
            },
            error: {
                all: [
                    async (err, req, next) => {
                        calls.push("→ error");
                        await next();
                        calls.push("← error");
                        return json({ error: err.message });  // ✅ Must return response

                    },
                ],
            },
        });

        app.GET("/success", async (req, next) => {
            calls.push("→ handler");
            await next();
            calls.push("← handler");
            return json({ ok: true });
        });

        app.GET("/fail", () => {
            calls.push("handler-fail");
            throw new Error("test");
        });

        // Success case
        await app.fetch(makeRequest("/success"));
        expect(calls).toEqual([
            "→ before",
            "← before",
            "→ handler",
            "← handler",
            "→ after",
            "← after",
        ]);

        calls.length = 0;

        // Error case
        await app.fetch(makeRequest("/fail"));
        expect(calls).toEqual([
            "→ before",
            "← before",
            "handler-fail",
            "→ error",
            "← error",
        ]);
    });
});

describe("CORE - Hooks with Nested Apps", () => {
    it("parent hooks run for nested app routes", async () => {
        const calls = [];
        const sub = flite();
        sub.GET("/child", () => {
            calls.push("child-handler");
            return json({ child: true });
        });

        const main = flite({
            mode: 0,
            before: {
                all: [req => { calls.push("parent-before"); }],
            },
            after: {
                all: [(res, req) => { calls.push("parent-after"); return res; }],
            },
        });

        main.USE("/api", sub);
        await main.fetch(makeRequest("/api/child"));

        expect(calls).toEqual(["parent-before", "child-handler", "parent-after"]);
    });

    it("parent error hooks catch errors from nested apps", async () => {
        const sub = flite();
        sub.GET("/fail", () => {
            throw new Error("Child error");
        });

        const main = flite({
            mode: 0,
            error: {
                all: [(err, req) => json({ parentCaught: err.message })],
            },
        });

        main.USE("/api", sub);
        const res = await main.fetch(makeRequest("/api/fail"));

        expect(await res.json()).toEqual({ parentCaught: "Child error" });
    });
});

describe("CORE - Edge Cases", () => {
    it("handles empty hook arrays", async () => {
        const app = flite({
            mode: 0,
            before: { all: [] },
            after: { all: [] },
            error: { all: [] },
        });

        app.GET("/test", () => json({ ok: true }));
        const res = await app.fetch(makeRequest("/test"));

        expect(await res.json()).toEqual({ ok: true });
    });

    it("handles undefined hooks", async () => {
        const app = flite({
            mode: 0,
            before: undefined,
            after: undefined,
            error: undefined,
        });

        app.GET("/test", () => json({ ok: true }));
        const res = await app.fetch(makeRequest("/test"));

        expect(await res.json()).toEqual({ ok: true });
    });

    it("after hook with null result", async () => {
        const app = flite({
            mode: 0,
            after: {
                all: [(res, req) => json({ fallback: true })],
            },
        });

        app.GET("/null", () => null);
        const res = await app.fetch(makeRequest("/null"));

        expect(await res.json()).toEqual({ fallback: true });
    });

    it("error hook can return nothing (re-throws)", async () => {
        const app = flite({
            mode: 0,
            error: {
                all: [(err, req) => {
                    // Returns undefined
                }],
            },
        });

        app.GET("/fail", () => {
            throw new Error("test");
        });

        try {
            await app.fetch(makeRequest("/fail"));
            expect(true).toBe(false); // Should not reach
        } catch (err) {
            expect(err.message).toBe("test");
        }
    });
});

describe("CORE - Real-World Patterns", () => {

    it("authentication + logging + formatting pattern", async () => {
        const logs = [];
        const app = flite({
            mode: 1,
            before: {
                all: [
                    // Logging
                    async (req, next) => {
                        logs.push(`→ ${req.method} ${new URL(req.url).pathname}`);
                        const start = Date.now();
                        const result = await next();
                        logs.push(`← ${Date.now() - start}ms`);
                        return result;
                    },
                    // Authentication
                    async (req, next) => {
                        if (!req.headers.get("authorization")) {
                            return json({ error: "Unauthorized" }, { status: 401 });
                        }
                        return await next();
                    },
                ],
            },
            after: {
                // ✅ Fix: Wrap json helper to match (res, req) signature
                all: [(res, req) => {
                    if (res instanceof Response) return res;
                    return json(res);
                }]
            },
            error: {
                all: [(err, req) => json({ error: err.message }, { status: 500 })],
            },
        });

        app.GET("/protected", () => ({ secret: "data" }));

        // Without auth
        const res1 = await app.fetch(makeRequest("/protected"));
        expect(res1.status).toBe(401);

        // With auth
        const req2 = makeRequest("/protected");
        req2.headers.set("authorization", "Bearer token");
        const res2 = await app.fetch(req2);
        expect(await res2.json()).toEqual({ secret: "data" });

        expect(logs[0]).toBe("→ GET /protected");
    });

    it("CORS + validation + transformation pattern", async () => {
        const app = flite({
            mode: 0,
            before: {
                all: [
                    req => {
                        if (req.headers.get("origin") === "evil.com") {
                            throw new Error("CORS blocked");
                        }
                    },
                ],
            },
            after: {
                all: [
                    (res, req) => {
                        if (res instanceof Response) return res;
                        // ✅ Use json helper with CORS header
                        return json(res, {
                            headers: { 'Access-Control-Allow-Origin': '*' }
                        });
                    },
                ],
            },
            error: {
                all: [(err, req) => {
                    return json({ error: err.message }, {
                        status: 400,
                        headers: { 'Access-Control-Allow-Origin': '*' }
                    });
                }],
            },
        });

        app.POST("/submit", async req => {
            const body = await req.json();

            if (!body.email) {
                throw new Error("Email required");
            }

            return { submitted: true, email: body.email };
        });

        const res = await app.fetch(makeRequest("/submit", "POST", { email: "test@example.com" }));
        expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
        expect(await res.json()).toEqual({ submitted: true, email: "test@example.com" });
    });

    it("CORS pattern (simplified)", async () => {
        const app = flite({
            mode: 0,
            after: {
                all: [
                    (res) => {
                        if (!res || res instanceof Response) return res;

                        // ✅ Or use json helper
                        return json(res, {
                            headers: { 'Access-Control-Allow-Origin': '*' }
                        });
                    },
                ],
            },
        });

        app.POST("/submit", async req => {
            const body = await req.json();
            return { submitted: true, email: body.email };
        });

        const res = await app.fetch(makeRequest("/submit", "POST", { email: "test@example.com" }));
        expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
        expect(await res.json()).toEqual({ submitted: true, email: "test@example.com" });
    });
});

describe("Routing Precedence", () => {
    it("specific route wins over wildcard", async () => {
        const app = flite();
        app.GET("/users/:id", () => json({ route: "specific" }));
        app.GET("/users/*", () => json({ route: "wildcard" }));

        const res = await app.fetch(new Request("http://localhost/users/123"));
        expect(await res.json()).toEqual({ route: "specific" });
    });

    it("first registered route wins when both match", async () => {
        const app = flite();
        app.GET("/a/*", () => json({ route: "first" }));
        app.GET("/a/:id", () => json({ route: "second" }));

        const res = await app.fetch(new Request("http://localhost/a/1"));
        expect(await res.json()).toEqual({ route: "first" });
    });
});

describe("External Router - match()", () => {
    it("Trouter delegates via match and returns JSON", async () => {
        const tr = new Trouter();
        tr.add('GET', '/trouter/:id', (req, params) => new Response(JSON.stringify({ id: params.id }), { headers: { 'content-type': 'application/json' } }));
        const app = flite({ match: ({ method, path }) => {
            const found = tr.find(method, path);
            if (!found.handlers.length) return null;
            return { handlers: found.handlers.map(fn => (req) => fn(req, found.params)) };
        } });
        const res = await app.fetch(new Request('http://localhost/trouter/7'));
        expect(await res.json()).toEqual({ id: '7' });
    });
});