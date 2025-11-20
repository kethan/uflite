import { describe, it, expect, beforeEach } from "bun:test";
import { flite } from "../nano/index.js";
import { run } from '../plugins.js';

const makeRequest = (path, method = "GET", body) =>
    new Request("http://localhost" + path, {
        method,
        body: body ? JSON.stringify(body) : undefined,
        headers: { "content-type": "application/json" },
    });

const json = (data, options = {}) =>
    data instanceof Response
        ? data
        : new Response(JSON.stringify(data), {
            status: options.status || 200,  // ✅ Support status option
            headers: { "content-type": "application/json", ...options.headers },
        });

describe("NANO - Basic Routing", () => {
    let app;

    beforeEach(() => {
        app = flite();
    });

    it("handles GET route", async () => {
        app.GET("/hello", () => json({ msg: "hello" }));
        const res = await app.fetch(makeRequest("/hello"));
        expect(await res.json()).toEqual({ msg: "hello" });
    });

    it("handles POST route", async () => {
        app.POST("/data", () => json({ posted: true }));
        const res = await app.fetch(makeRequest("/data", "POST"));
        expect(await res.json()).toEqual({ posted: true });
    });

    it("handles PUT route", async () => {
        app.PUT("/update", () => json({ updated: true }));
        const res = await app.fetch(makeRequest("/update", "PUT"));
        expect(await res.json()).toEqual({ updated: true });
    });

    it("handles DELETE route", async () => {
        app.DELETE("/remove", () => json({ deleted: true }));
        const res = await app.fetch(makeRequest("/remove", "DELETE"));
        expect(await res.json()).toEqual({ deleted: true });
    });

    it("handles PATCH route", async () => {
        app.PATCH("/modify", () => json({ patched: true }));
        const res = await app.fetch(makeRequest("/modify", "PATCH"));
        expect(await res.json()).toEqual({ patched: true });
    });

    it("returns undefined for no matching route", async () => {
        app.GET("/exists", () => json({ ok: true }));
        const res = await app.fetch(makeRequest("/nope"));
        expect(res).toBeUndefined();
    });
});

describe("NANO - Route Parameters", () => {
    let app;

    beforeEach(() => {
        app = flite();
    });

    it("extracts single param", async () => {
        app.GET("/user/:id", req => json({ id: req.params.id }));
        const res = await app.fetch(makeRequest("/user/123"));
        expect(await res.json()).toEqual({ id: "123" });
    });

    it("extracts multiple params", async () => {
        app.GET("/team/:team/user/:user", req =>
            json({ team: req.params.team, user: req.params.user })
        );
        const res = await app.fetch(makeRequest("/team/dev/user/alice"));
        expect(await res.json()).toEqual({ team: "dev", user: "alice" });
    });

    it("handles params with special characters", async () => {
        app.GET("/item/:id", req => json({ id: req.params.id }));
        const res = await app.fetch(makeRequest("/item/abc-123_xyz"));
        expect(await res.json()).toEqual({ id: "abc-123_xyz" });
    });
});

describe("NANO - Query Parameters", () => {
    let app;

    beforeEach(() => {
        app = flite();
    });

    it("parses single query param", async () => {
        app.GET("/search", req => json({ query: req.query }));
        const res = await app.fetch(makeRequest("/search?q=test"));
        expect(await res.json()).toEqual({ query: { q: "test" } });
    });

    it("parses multiple query params", async () => {
        app.GET("/search", req => json({ query: req.query }));
        const res = await app.fetch(makeRequest("/search?q=test&page=2&limit=10"));
        expect(await res.json()).toEqual({
            query: { q: "test", page: "2", limit: "10" },
        });
    });

    it("handles duplicate query params as array", async () => {
        app.GET("/tags", req => json({ tags: req.query.tag }));
        const res = await app.fetch(makeRequest("/tags?tag=js&tag=node&tag=bun"));
        expect(await res.json()).toEqual({ tags: ["js", "node", "bun"] });
    });

    it("handles mixed single and duplicate params", async () => {
        app.GET("/search", req => json({ query: req.query }));
        const res = await app.fetch(makeRequest("/search?q=test&tag=js&tag=ts&page=1"));
        expect(await res.json()).toEqual({
            query: { q: "test", tag: ["js", "ts"], page: "1" },
        });
    });

    it("handles empty query string", async () => {
        app.GET("/search", req => json({ query: req.query }));
        const res = await app.fetch(makeRequest("/search"));
        expect(await res.json()).toEqual({ query: {} });
    });
});

describe("NANO - Wildcards", () => {
    let app;

    beforeEach(() => {
        app = flite();
    });

    it("matches wildcard route", async () => {
        app.GET("/files/*", () => json({ wildcard: true }));
        const res = await app.fetch(makeRequest("/files/path/to/file.txt"));
        expect(await res.json()).toEqual({ wildcard: true });
    });

    it("matches root wildcard", async () => {
        app.GET("*", () => json({ catchAll: true }));
        const res = await app.fetch(makeRequest("/anything/here"));
        expect(await res.json()).toEqual({ catchAll: true });
    });

    it("specific routes take precedence over wildcards", async () => {
        app.GET("/users/:id", () => json({ route: "specific" }));
        app.GET("/users/*", () => json({ route: "wildcard" }));

        const res = await app.fetch(makeRequest("/users/123"));
        expect(await res.json()).toEqual({ route: "specific" });
    });
});

describe("NANO - ALL Method", () => {
    let app;

    beforeEach(() => {
        app = flite();
    });

    it("matches any HTTP method with ALL", async () => {
        app.ALL("/any", req => json({ method: req.method }));

        const get = await app.fetch(makeRequest("/any", "GET"));
        const post = await app.fetch(makeRequest("/any", "POST"));
        const put = await app.fetch(makeRequest("/any", "PUT"));

        expect(await get.json()).toEqual({ method: "GET" });
        expect(await post.json()).toEqual({ method: "POST" });
        expect(await put.json()).toEqual({ method: "PUT" });
    });
});

describe("NANO - Nested Apps", () => {
    it("mounts sub-app at path", async () => {
        const api = flite();
        api.GET("/users", () => json({ users: [] }));

        const main = flite();
        main.USE("/api", api);

        const res = await main.fetch(makeRequest("/api/users"));
        expect(await res.json()).toEqual({ users: [] });
    });

    it("mounts multiple sub-apps", async () => {
        const api = flite();
        api.GET("/data", () => json({ api: true }));

        const admin = flite();
        admin.GET("/dashboard", () => json({ admin: true }));

        const main = flite();
        main.USE("/api", api);
        main.USE("/admin", admin);

        const res1 = await main.fetch(makeRequest("/api/data"));
        const res2 = await main.fetch(makeRequest("/admin/dashboard"));

        expect(await res1.json()).toEqual({ api: true });
        expect(await res2.json()).toEqual({ admin: true });
    });

    it("handles deeply nested apps (3 levels)", async () => {
        const l3 = flite();
        l3.GET("/deep", () => json({ level: 3 }));

        const l2 = flite();
        l2.USE("/l3", l3);

        const l1 = flite();
        l1.USE("/l2", l2);

        const res = await l1.fetch(makeRequest("/l2/l3/deep"));
        expect(await res.json()).toEqual({ level: 3 });
    });

    it("preserves route params in nested apps", async () => {
        const users = flite();
        users.GET("/:userId/posts/:postId", req =>
            json({ userId: req.params.userId, postId: req.params.postId })
        );

        const main = flite();
        main.USE("/api", users);

        const res = await main.fetch(makeRequest("/api/123/posts/456"));
        expect(await res.json()).toEqual({ userId: "123", postId: "456" });
    });
});

describe("NANO - Mode 0 (Simple)", () => {
    it("runs handlers sequentially", async () => {
        const app = flite({ mode: 0 });
        const calls = [];

        app.GET(
            "/test",
            req => { calls.push("handler1"); },  // ✅ Don't return push result
            req => { calls.push("handler2"); },  // ✅ Don't return push result
            req => json({ calls })
        );

        await app.fetch(makeRequest("/test"));
        expect(calls).toEqual(["handler1", "handler2"]);
    });

    it("stops at first handler that returns value", async () => {
        const app = flite({ mode: 0 });
        const calls = [];

        app.GET(
            "/test",
            req => { calls.push("first"); },  // ✅ Returns undefined
            req => {
                calls.push("second");
                return json({ stopped: true });
            },
            req => { calls.push("third"); }
        );

        const res = await app.fetch(makeRequest("/test"));
        expect(await res.json()).toEqual({ stopped: true });
        expect(calls).toEqual(["first", "second"]);
    });

    it("continues if handler returns null", async () => {
        const app = flite({ mode: 0 });
        const calls = [];

        app.GET(
            "/test",
            req => { calls.push("first"); return null; },  // ✅ Explicit null
            req => { calls.push("second"); return undefined; },  // ✅ Explicit undefined
            req => { calls.push("third"); return json({ done: true }); }
        );

        await app.fetch(makeRequest("/test"));
        expect(calls).toEqual(["first", "second", "third"]);
    });
});

describe("NANO - Mode 1 (Middleware)", () => {
    it("executes middleware in onion pattern", async () => {
        const app = flite({ mode: 1 });
        const order = [];

        app.GET(
            "/onion",
            async (req, next) => {
                order.push("outer-before");
                await next();
                order.push("outer-after");
            },
            async (req, next) => {
                order.push("inner-before");
                await next();
                order.push("inner-after");
            },
            async req => {
                order.push("handler");
                return json({ order });
            }
        );

        await app.fetch(makeRequest("/onion"));
        expect(order).toEqual([
            "outer-before",
            "inner-before",
            "handler",
            "inner-after",
            "outer-after",
        ]);
    });

    it("supports multiple middleware layers", async () => {
        const app = flite({ mode: 1 });
        const logs = [];

        app.GET(
            "/layers",
            async (req, next) => {
                logs.push("→ layer1");
                await next();
                logs.push("← layer1");
            },
            async (req, next) => {
                logs.push("→ layer2");
                await next();
                logs.push("← layer2");
            },
            async (req, next) => {
                logs.push("→ layer3");
                await next();
                logs.push("← layer3");
            },
            async req => {
                logs.push("★ handler");
                return json({ logs });
            }
        );

        await app.fetch(makeRequest("/layers"));
        expect(logs).toEqual([
            "→ layer1",
            "→ layer2",
            "→ layer3",
            "★ handler",
            "← layer3",
            "← layer2",
            "← layer1",
        ]);
    });

    it("can modify request in middleware", async () => {
        const app = flite({ mode: 1 });

        app.GET(
            "/modify",
            async (req, next) => {
                req.custom = "injected";
                return await next();  // ✅ Return result
            },
            async (req, next) => {
                req.custom += " modified";
                return await next();  // ✅ Return result
            },
            async req => json({ custom: req.custom })
        );

        const res = await app.fetch(makeRequest("/modify"));
        expect(await res.json()).toEqual({ custom: "injected modified" });
    });

    it("stops execution if middleware returns value", async () => {
        const app = flite({ mode: 1 });
        const calls = [];

        app.GET(
            "/early-return",
            async (req, next) => {
                calls.push("mw1-before");
                const result = await next();  // ✅ Capture result
                calls.push("mw1-after");
                return result;  // ✅ Return it
            },
            async (req, next) => {
                calls.push("mw2");
                return json({ early: true }); // Early return
            },
            async req => {
                calls.push("handler");
                return json({ normal: true });
            }
        );

        const res = await app.fetch(makeRequest("/early-return"));
        expect(await res.json()).toEqual({ early: true });
        expect(calls).toEqual(["mw1-before", "mw2", "mw1-after"]);  // ✅ mw1-after IS called
    });
    it("propagates errors via next(err)", async () => {
        const app = flite({ mode: 1 });

        app.GET(
            "/error",
            async (req, next) => {
                await next("Something went wrong");
            },
            async req => json({ ok: true })
        );

        try {
            await app.fetch(makeRequest("/error"));
            expect(true).toBe(false); // Should not reach
        } catch (err) {
            expect(err).toBe("Something went wrong");
        }
    });
    
    it("can catch errors from next()", async () => {
        const app = flite({ mode: 1 });
        const logs = [];

        app.GET(
            "/error-catch",
            async (req, next) => {
                try {
                    logs.push("before");
                    await next();  // ✅ This will throw if downstream calls next(err)
                    logs.push("after-success");
                } catch (err) {
                    logs.push("caught: " + err);
                    return json({ error: err });
                }
            },
            async (req, next) => {
                await next("error from deep");  // ✅ Calls next with error
            }
        );

        const res = await app.fetch(makeRequest("/error-catch"));
        expect(await res.json()).toEqual({ error: "error from deep" });
        expect(logs).toEqual(["before", "caught: error from deep"]);
    });

    it("timing middleware pattern works", async () => {
        const app = flite({ mode: 1 });

        app.GET(
            "/timing",
            async (req, next) => {
                const start = Date.now();
                await next();
                const duration = Date.now() - start;
                return json({ duration: duration >= 0 });
            },
            async (req, next) => {
                await new Promise(resolve => setTimeout(resolve, 10));
                await next();
            },
            async req => json({ ok: true })
        );

        const res = await app.fetch(makeRequest("/timing"));
        expect(await res.json()).toEqual({ duration: true });
    });

    it("authentication middleware pattern", async () => {
        const app = flite({ mode: 1 });

        app.GET(
            "/protected",
            async (req, next) => {
                const auth = req.headers.get("authorization");
                if (!auth) return json({ error: "Unauthorized" }, { status: 401 });
                return await next();  // ✅ Return result from next middleware
            },
            async req => json({ secret: "data" })
        );

        // Without auth
        const res1 = await app.fetch(makeRequest("/protected"));
        expect(res1.status).toBe(401);

        // With auth
        const req2 = makeRequest("/protected");
        req2.headers.set("authorization", "Bearer token");
        const res2 = await app.fetch(req2);
        expect(await res2.json()).toEqual({ secret: "data" });
    });

    it("logging middleware pattern", async () => {
        const app = flite({ mode: 1 });
        const logs = [];

        app.GET(
            "/log",
            async (req, next) => {
                logs.push(`→ ${req.method} ${new URL(req.url).pathname}`);
                const result = await next();
                logs.push(`← ${req.method} ${new URL(req.url).pathname}`);
                return result;
            },
            async req => json({ ok: true })
        );

        await app.fetch(makeRequest("/log"));
        expect(logs).toEqual(["→ GET /log", "← GET /log"]);
    });
});

describe("NANO - run() Function Directly", () => {
    it("mode 0 runs functions sequentially", async () => {
        const calls = [];
        const fns = [
            () => { calls.push("fn1"); },  // ✅ Don't return
            () => { calls.push("fn2"); },
            () => { calls.push("fn3"); return "result"; },
            () => { calls.push("fn4"); },
        ];

        const result = await run(0)(...fns)();
        expect(result).toBe("result");
        expect(calls).toEqual(["fn1", "fn2", "fn3"]);
    });

    it("mode 1 supports next() callback", async () => {
        const calls = [];
        const fns = [
            async (next) => {
                calls.push("before-1");
                await next();
                calls.push("after-1");
            },
            async (next) => {
                calls.push("before-2");
                await next();
                calls.push("after-2");
            },
        ];

        await run(1)(...fns)();
        expect(calls).toEqual(["before-1", "before-2", "after-2", "after-1"]);
    });

    it("flattens nested arrays", async () => {
        const calls = [];
        const fns = [
            () => { calls.push("a"); },
            [() => { calls.push("b"); }, () => { calls.push("c"); }],
            [[() => { calls.push("d"); }]],
        ];

        await run(0)(...fns)();
        expect(calls).toEqual(["a", "b", "c", "d"]);
    });

    it("filters non-callable values", async () => {
        const calls = [];
        const fns = [
            () => { calls.push("fn1"); },
            null,
            undefined,
            "string",
            42,
            () => { calls.push("fn2"); },
        ];

        await run(0)(...fns)();
        expect(calls).toEqual(["fn1", "fn2"]);
    });
});

describe("NANO - Method Chaining", () => {
    it("supports fluent API", async () => {
        const app = flite()
            .GET("/a", () => json({ route: "a" }))
            .GET("/b", () => json({ route: "b" }))
            .POST("/c", () => json({ route: "c" }));

        const res1 = await app.fetch(makeRequest("/a"));
        const res2 = await app.fetch(makeRequest("/b"));
        const res3 = await app.fetch(makeRequest("/c", "POST"));

        expect(await res1.json()).toEqual({ route: "a" });
        expect(await res2.json()).toEqual({ route: "b" });
        expect(await res3.json()).toEqual({ route: "c" });
    });
});

describe("NANO - Edge Cases", () => {
    it("handles route with no handlers", async () => {
        const app = flite();
        app.GET("/empty"); // No handlers
        const res = await app.fetch(makeRequest("/empty"));
        expect(res).toBeUndefined();
    });

    it("handles multiple routes with same path, different methods", async () => {
        const app = flite();
        app.GET("/resource", () => json({ method: "GET" }));
        app.POST("/resource", () => json({ method: "POST" }));
        app.DELETE("/resource", () => json({ method: "DELETE" }));

        const get = await app.fetch(makeRequest("/resource", "GET"));
        const post = await app.fetch(makeRequest("/resource", "POST"));
        const del = await app.fetch(makeRequest("/resource", "DELETE"));

        expect(await get.json()).toEqual({ method: "GET" });
        expect(await post.json()).toEqual({ method: "POST" });
        expect(await del.json()).toEqual({ method: "DELETE" });
    });

    it("handles trailing slashes", async () => {
        const app = flite();
        app.GET("/path", () => json({ ok: true }));

        const res1 = await app.fetch(makeRequest("/path"));
        const res2 = await app.fetch(makeRequest("/path/"));

        expect(await res1.json()).toEqual({ ok: true });
        expect(await res2.json()).toEqual({ ok: true });
    });

    it("preserves null prototype on query object", async () => {
        const app = flite();
        app.GET("/test", req => {
            expect(Object.getPrototypeOf(req.query)).toBe(null);
            return json({ ok: true });
        });

        await app.fetch(makeRequest("/test?q=test"));
    });
});