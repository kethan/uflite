import { describe, it, expect } from "bun:test";
import { flite } from "../lite/index.js";
import { json } from "../plugins.js";

import {
  cors,
  corsAfter,
  logger,
  loggerAfter,
  requestId,
  requestIdAfter,
  bodyLimit,
  rateLimit,
  rateLimitAfter,
  bearerAuth,
  secureHeaders,
  secureHeadersAfter,
  basicAuth
} from "../middlewares";

const make = (
  path = "/",
  method = "GET",
  headers = {}
) =>
  new Request(
    "http://localhost" + path,
    { method, headers }
  );

describe("Middleware - CORS", () => {
  it("adds CORS headers on GET and handles preflight", async () => {
    const app = flite({
      mode: 1,
      before: {
        all: [
          cors({
            origin: ["https://example.com"]
          })
        ]
      },
      after: {
        all: [corsAfter]
      }
    });

    app.get("/test", () =>
      json({ ok: true })
    );

    const pre = await app.fetch(
      make("/test", "OPTIONS", {
        origin: "https://example.com"
      })
    );

    expect(pre.status).toBe(204);

    expect(
      pre.headers.get(
        "Access-Control-Allow-Origin"
      )
    ).toBe("https://example.com");

    const res = await app.fetch(
      make("/test", "GET", {
        origin: "https://example.com"
      })
    );

    expect(
      res.headers.get(
        "Access-Control-Allow-Origin"
      )
    ).toBe("https://example.com");
  });

  it("rejects disallowed origins", async () => {
    const app = flite({
      mode: 1,
      before: {
        all: [
          cors({
            origin: ["https://allowed.com"]
          })
        ]
      }
    });

    app.get("/", () =>
      json({ ok: true })
    );

    const res = await app.fetch(
      make("/", "GET", {
        origin: "https://evil.com"
      })
    );

    expect(res.status).toBe(403);
  });

  it("supports regex origins", async () => {
    const app = flite({
      mode: 1,
      before: {
        all: [
          cors({
            origin: /example\.com$/g
          })
        ]
      },
      after: {
        all: [corsAfter]
      }
    });

    app.get("/", () =>
      json({ ok: true })
    );

    const first = await app.fetch(
      make("/", "GET", {
        origin: "https://example.com"
      })
    );

    const second = await app.fetch(
      make("/", "GET", {
        origin: "https://example.com"
      })
    );

    expect(
      first.headers.get(
        "Access-Control-Allow-Origin"
      )
    ).toBe("https://example.com");

    expect(
      second.headers.get(
        "Access-Control-Allow-Origin"
      )
    ).toBe("https://example.com");
  });

  it("rejects wildcard origin with credentials", () => {
    expect(() =>
      cors({
        origin: "*",
        credentials: true
      })
    ).toThrow();
  });

  it("supports credentials with explicit origin", async () => {
    const app = flite({
      mode: 1,
      before: {
        all: [
          cors({
            origin: "https://example.com",
            credentials: true
          })
        ]
      },
      after: {
        all: [corsAfter]
      }
    });

    app.get("/", () =>
      json({ ok: true })
    );

    const res = await app.fetch(
      make("/", "GET", {
        origin: "https://example.com"
      })
    );

    expect(
      res.headers.get(
        "Access-Control-Allow-Credentials"
      )
    ).toBe("true");
  });
});

describe("Middleware - Request ID", () => {
  it("generates request id", async () => {
    const app = flite({
      mode: 1,
      before: {
        all: [requestId()]
      },
      after: {
        all: [requestIdAfter]
      }
    });

    app.get("/", () =>
      json({ ok: true })
    );

    const res = await app.fetch(
      make("/")
    );

    expect(
      res.headers.get("X-Request-ID")
    ).toBeTruthy();
  });

  it("preserves supplied request id", async () => {
    const app = flite({
      mode: 1,
      before: {
        all: [requestId()]
      },
      after: {
        all: [requestIdAfter]
      }
    });

    app.get("/", () =>
      json({ ok: true })
    );

    const res = await app.fetch(
      make("/", "GET", {
        "X-Request-ID": "test-123"
      })
    );

    expect(
      res.headers.get("X-Request-ID")
    ).toBe("test-123");
  });

  it("supports custom request id generator", async () => {
    const app = flite({
      mode: 1,
      before: {
        all: [
          requestId({
            generator: () => "generated-123"
          })
        ]
      },
      after: {
        all: [requestIdAfter]
      }
    });

    app.get("/", () =>
      json({ ok: true })
    );

    const res = await app.fetch(
      make("/")
    );

    expect(
      res.headers.get("X-Request-ID")
    ).toBe("generated-123");
  });
});

describe("Middleware - Security Headers", () => {
  it("sets default security headers", async () => {
    const app = flite({
      mode: 1,
      before: {
        all: [
          secureHeaders()
        ]
      },
      after: {
        all: [
          secureHeadersAfter
        ]
      }
    });

    app.get("/", () =>
      json({ ok: true })
    );

    const res = await app.fetch(
      make("/")
    );

    expect(
      res.headers.get(
        "X-Content-Type-Options"
      )
    ).toBe("nosniff");

    expect(
      res.headers.get(
        "X-Frame-Options"
      )
    ).toBe("DENY");

    expect(
      res.headers.get(
        "Referrer-Policy"
      )
    ).toBe("no-referrer");

    expect(
      res.headers.get(
        "Content-Security-Policy"
      )
    ).toBe("default-src 'self'");
  });

  it("supports disabling individual headers", async () => {
    const app = flite({
      mode: 1,
      before: {
        all: [
          secureHeaders({
            xFrameOptions: false,
            referrerPolicy: false
          })
        ]
      },
      after: {
        all: [
          secureHeadersAfter
        ]
      }
    });

    app.get("/", () =>
      json({ ok: true })
    );

    const res = await app.fetch(
      make("/")
    );

    expect(
      res.headers.get(
        "X-Frame-Options"
      )
    ).toBeNull();

    expect(
      res.headers.get(
        "Referrer-Policy"
      )
    ).toBeNull();

    expect(
      res.headers.get(
        "X-Content-Type-Options"
      )
    ).toBe("nosniff");
  });
});

describe("Middleware - RateLimit", () => {
  it("allows requests within the limit", async () => {
    const app = flite({
      mode: 1,
      before: {
        all: [
          rateLimit({
            windowMs: 1000,
            max: 2
          })
        ]
      },
      after: {
        all: [rateLimitAfter]
      }
    });

    app.get("/", () =>
      json({ ok: true })
    );

    const first = await app.fetch(
      make("/")
    );

    expect(first.status).toBe(200);

    expect(
      first.headers.get(
        "RateLimit-Limit"
      )
    ).toBe("2");

    expect(
      first.headers.get(
        "RateLimit-Remaining"
      )
    ).toBe("1");
  });

  it("blocks when limit is exceeded", async () => {
    const app = flite({
      mode: 1,
      before: {
        all: [
          rateLimit({
            windowMs: 1000,
            max: 1
          })
        ]
      },
      after: {
        all: [rateLimitAfter]
      }
    });

    app.get("/", () =>
      json({ ok: true })
    );

    const first = await app.fetch(
      make("/")
    );

    expect(first.status).toBe(200);

    const second = await app.fetch(
      make("/")
    );

    expect(second.status).toBe(429);

    expect(
      second.headers.get(
        "RateLimit-Remaining"
      )
    ).toBe("0");

    expect(
      second.headers.get(
        "Retry-After"
      )
    ).toBeTruthy();
  });

  it("supports separate rate-limit keys", async () => {
    const app = flite({
      mode: 1,
      before: {
        all: [
          rateLimit({
            windowMs: 1000,
            max: 1,
            keyGenerator: req =>
              req.headers.get("x-client") ||
              "unknown"
          })
        ]
      }
    });

    app.get("/", () =>
      json({ ok: true })
    );

    const first = await app.fetch(
      make("/", "GET", {
        "x-client": "a"
      })
    );

    const second = await app.fetch(
      make("/", "GET", {
        "x-client": "b"
      })
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });
});

describe("Middleware - Bearer Auth", () => {
  it("protects routes", async () => {
    const app = flite({
      mode: 1
    });

    app.use(
      "/api/*",
      bearerAuth({
        token: "t"
      })
    );

    app.get("/api/data", () =>
      json({ ok: true })
    );

    const no = await app.fetch(
      make("/api/data")
    );

    expect(no.status).toBe(401);

    const ok = await app.fetch(
      make("/api/data", "GET", {
        authorization: "Bearer t"
      })
    );

    expect(ok.status).toBe(200);
  });

  it("rejects an invalid token", async () => {
    const app = flite({
      mode: 1
    });

    app.use(
      "/api/*",
      bearerAuth({
        token: "correct"
      })
    );

    app.get("/api/data", () =>
      json({ ok: true })
    );

    const res = await app.fetch(
      make("/api/data", "GET", {
        authorization: "Bearer wrong"
      })
    );

    expect(res.status).toBe(401);
  });

  it("supports async verify", async () => {
    const app = flite({
      mode: 1
    });

    app.use(
      "/api/*",
      bearerAuth({
        verify: async token =>
          token === "valid"
      })
    );

    app.get("/api/data", () =>
      json({ ok: true })
    );

    const ok = await app.fetch(
      make("/api/data", "GET", {
        authorization: "Bearer valid"
      })
    );

    expect(ok.status).toBe(200);

    const bad = await app.fetch(
      make("/api/data", "GET", {
        authorization: "Bearer invalid"
      })
    );

    expect(bad.status).toBe(401);
  });

  it("returns 401 when verify throws", async () => {
    const app = flite({
      mode: 1
    });

    app.use(
      "/api/*",
      bearerAuth({
        verify: async () => {
          throw new Error("invalid");
        }
      })
    );

    app.get("/api/data", () =>
      json({ ok: true })
    );

    const res = await app.fetch(
      make("/api/data", "GET", {
        authorization: "Bearer t"
      })
    );
    expect(res.status).toBe(401);
  });
});

describe("Middleware - Body Limit", () => {
  it("allows body within limit", async () => {
    const app = flite({
      mode: 1,
      before: {
        all: [
          bodyLimit({
            max: "10kb"
          })
        ]
      }
    });

    app.post("/", () =>
      json({ ok: true })
    );

    const res = await app.fetch(
      new Request(
        "http://localhost/",
        {
          method: "POST",
          headers: {
            "Content-Length": "1000"
          }
        }
      )
    );

    expect(res.status).toBe(200);
  });

  it("blocks body larger than limit", async () => {
    const app = flite({
      mode: 1,
      before: {
        all: [
          bodyLimit({
            max: "1kb"
          })
        ]
      }
    });

    app.post("/", () =>
      json({ ok: true })
    );

    const res = await app.fetch(
      new Request(
        "http://localhost/",
        {
          method: "POST",
          headers: {
            "Content-Length": "2000"
          }
        }
      )
    );

    expect(res.status).toBe(413);
  });

  it("rejects invalid Content-Length", async () => {
    const app = flite({
      mode: 1,
      before: {
        all: [
          bodyLimit({
            max: "1kb"
          })
        ]
      }
    });

    app.post("/", () =>
      json({ ok: true })
    );

    const res = await app.fetch(
      new Request(
        "http://localhost/",
        {
          method: "POST",
          headers: {
            "Content-Length": "invalid"
          }
        }
      )
    );

    expect(res.status).toBe(400);
  });
});

describe("Middleware - Basic Auth", () => {
  it("rejects missing credentials", async () => {
    const app = flite({
      mode: 1
    });

    app.use(
      "/admin/*",
      basicAuth({
        users: {
          admin: "secret"
        }
      })
    );

    app.get("/admin/data", () =>
      json({ ok: true })
    );

    const res = await app.fetch(
      make("/admin/data")
    );

    expect(res.status).toBe(401);
  });

  it("rejects wrong credentials", async () => {
    const app = flite({
      mode: 1
    });

    app.use(
      "/admin/*",
      basicAuth({
        users: {
          admin: "secret"
        }
      })
    );

    app.get("/admin/data", () =>
      json({ ok: true })
    );

    const encoded = btoa(
      "admin:wrong"
    );

    const res = await app.fetch(
      make("/admin/data", "GET", {
        authorization:
          `Basic ${encoded}`
      })
    );

    expect(res.status).toBe(401);
  });

  it("accepts valid credentials", async () => {
    const app = flite({
      mode: 1
    });

    app.use(
      "/admin/*",
      basicAuth({
        users: {
          admin: "secret"
        }
      })
    );

    app.get("/admin/data", () =>
      json({ ok: true })
    );

    const encoded = btoa(
      "admin:secret"
    );

    const res = await app.fetch(
      make("/admin/data", "GET", {
        authorization:
          `Basic ${encoded}`
      })
    );

    expect(res.status).toBe(200);
  });
});

describe("Middleware - Short Circuit", () => {
  it("allows request middleware to return a Response", async () => {
    const app = flite({
      mode: 1,
      before: {
        all: [
          () =>
            new Response("blocked", {
              status: 403
            })
        ]
      }
    });

    app.get("/", () =>
      json({ ok: true })
    );

    const res = await app.fetch(
      make("/")
    );

    expect(res.status).toBe(403);
    expect(
      await res.text()
    ).toBe("blocked");
  });
});

describe("Middleware - Logger", () => {
  it("runs logger middleware and loggerAfter", async () => {
    const app = flite({
      mode: 1,
      before: {
        all: [
          logger({
            format: "json"
          })
        ]
      },
      after: {
        all: [loggerAfter]
      }
    });

    app.get("/", () =>
      json({ ok: true })
    );

    const res = await app.fetch(
      make("/")
    );

    expect(res.status).toBe(200);
  });

  it("supports logger skip", async () => {
    const app = flite({
      mode: 1,
      before: {
        all: [
          logger({
            skip: () => true
          })
        ]
      },
      after: {
        all: [loggerAfter]
      }
    });

    app.get("/", () =>
      json({ ok: true })
    );

    const res = await app.fetch(
      make("/")
    );

    expect(res.status).toBe(200);
  });
});

describe("Middleware - Validation", () => {
  it("validates rate limit options", () => {
    expect(() =>
      rateLimit({
        windowMs: 0
      })
    ).toThrow();

    expect(() =>
      rateLimit({
        max: 0
      })
    ).toThrow();
  });

  it("validates bearer auth options", () => {
    expect(() =>
      bearerAuth()
    ).toThrow();
  });

  it("validates basic auth options", () => {
    expect(() =>
      basicAuth({
        users: {}
      })
    ).toThrow();
  });

  it("validates body limit", () => {
    expect(() =>
      bodyLimit({
        max: "invalid"
      })
    ).toThrow();
  });

  it("validates request id header", () => {
    expect(() =>
      requestId({
        header: ""
      })
    ).toThrow();
  });

  it("validates CORS options", () => {
    expect(() =>
      cors({
        maxAge: -1
      })
    ).toThrow();

    expect(() =>
      cors({
        credentials: true,
        origin: "*"
      })
    ).toThrow();
  });
});