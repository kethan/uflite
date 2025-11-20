import { describe, it, expect } from "bun:test";
import { flite } from "../lite/index.js";
import { json } from "../plugins.js";
import {
  cors, corsAfter,
  logger, loggerAfter,
  requestId, requestIdAfter,
  bodyLimit,
  rateLimit, rateLimitAfter,
  bearerAuth,
  secureHeaders, secureHeadersAfter
} from "../middleware.ts";

const make = (path = "/", method = "GET", headers = {}) => new Request("http://localhost" + path, { method, headers });

describe("Middleware - CORS", () => {
  it("adds CORS headers on GET and handles preflight", async () => {
    const app = flite({ mode: 1,
      before: { all: [cors({ origin: ["https://example.com"] })] },
      after: { all: [corsAfter] }
    });

    app.get('/test', () => json({ ok: true }));
    const pre = await app.fetch(make("/test", "OPTIONS", { origin: "https://example.com" }));
    expect(pre.status).toBe(204);
    expect(pre.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com");

    const res = await app.fetch(make("/test", "GET", { origin: "https://example.com" }));
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com");
  });
});

describe("Middleware - Request ID and Security", () => {
  it("sets request id and security headers", async () => {
    const app = flite({ mode: 1,
      before: { all: [requestId(), secureHeaders()] },
      after: { all: [requestIdAfter, secureHeadersAfter] }
    });
    app.get("/", () => json({ ok: true }));
    const res = await app.fetch(make("/"));
    expect(res.headers.get("X-Request-ID")).toBeTruthy();
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});

describe("Middleware - RateLimit", () => {
  it("applies headers and blocks when limit exceeded", async () => {
    const app = flite({ mode: 1,
      before: { all: [rateLimit({ windowMs: 1000, max: 1 })] },
      after: { all: [rateLimitAfter] }
    });
    app.get("/", () => json({ ok: true }));

    const first = await app.fetch(make("/"));
    expect(first.headers.get("RateLimit-Limit")).toBe("1");

    const second = await app.fetch(make("/"));
    expect(second.status).toBe(429);
  });
});

describe("Middleware - Bearer Auth", () => {
  it("protects routes", async () => {
    const app = flite({ mode: 1 });
    app.use("/api/*", bearerAuth({ token: "t" }));
    app.get("/api/data", () => json({ ok: true }));

    const no = await app.fetch(make("/api/data"));
    expect(no.status).toBe(401);

    const ok = await app.fetch(make("/api/data", "GET", { authorization: "Bearer t" }));
    expect(ok.status).toBe(200);
  });
});