// Fetch middleware primitives.
var MW = new WeakMap;
var ctx = (req) => {
  let c = MW.get(req);
  if (!c) {
    c = {};
    MW.set(req, c);
  }
  return c;
};
var cors = (options = {}) => {
  const {
    origin = "*",
    methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials = false,
    maxAge = 86400,
    allowedHeaders = ["Content-Type", "Authorization"],
    exposedHeaders = []
  } = options;
  if (maxAge < 0)
    throw new Error("maxAge must be >= 0");
  if (!Array.isArray(methods))
    throw new Error("methods must be an array");
  if (credentials && origin === "*") {
    throw new Error("CORS credentials require a specific origin");
  }
  return async (req, next) => {
    const requestOrigin = req.headers.get("origin") || "";
    let allowedOrigin = "*";
    if (origin instanceof RegExp) {
      origin.lastIndex = 0;
      const allowed = origin.test(requestOrigin);
      origin.lastIndex = 0;
      allowedOrigin = allowed ? requestOrigin : "";
    } else if (Array.isArray(origin)) {
      allowedOrigin = origin.includes(requestOrigin) ? requestOrigin : "";
    } else if (typeof origin === "string") {
      allowedOrigin = origin;
    }
    if (!allowedOrigin) {
      return new Response("Forbidden", { status: 403 });
    }
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": allowedOrigin,
          "Access-Control-Allow-Methods": methods.join(", "),
          "Access-Control-Allow-Headers": allowedHeaders.join(", "),
          "Access-Control-Max-Age": maxAge.toString(),
          ...credentials && {
            "Access-Control-Allow-Credentials": "true"
          },
          ...exposedHeaders.length && {
            "Access-Control-Expose-Headers": exposedHeaders.join(", ")
          }
        }
      });
    }
    if (next)
      await next();
    ctx(req).cors = {
      allowedOrigin,
      credentials,
      exposedHeaders
    };
  };
};
var corsAfter = async (res, req, next) => {
  const t = next ? await next() : undefined;
  const r = t ?? res;
  const data = ctx(req).cors;
  if (!data || r instanceof Response === false) {
    return r;
  }
  const headers = new Headers(r.headers);
  headers.set("Access-Control-Allow-Origin", data.allowedOrigin);
  if (data.credentials) {
    headers.set("Access-Control-Allow-Credentials", "true");
  }
  if (data.exposedHeaders?.length) {
    headers.set("Access-Control-Expose-Headers", data.exposedHeaders.join(", "));
  }
  return new Response(r.body, {
    status: r.status,
    statusText: r.statusText,
    headers
  });
};
var logger = (options = {}) => {
  const {
    format = "dev",
    skip
  } = options;
  return async (req, next) => {
    if (skip?.(req)) {
      return next?.();
    }
    const start = Date.now();
    const url = new URL(req.url);
    ctx(req).logger = {
      start,
      url,
      format
    };
    if (next)
      await next();
  };
};
var loggerAfter = async (res, req, next) => {
  const t = next ? await next() : undefined;
  const r = t ?? res;
  const logData = ctx(req).logger;
  if (!logData) {
    return r;
  }
  const duration = Date.now() - logData.start;
  const { url, format } = logData;
  if (format === "dev") {
    const color = (s) => s >= 500 ? "\x1B[31m" : s >= 400 ? "\x1B[33m" : s >= 300 ? "\x1B[36m" : s >= 200 ? "\x1B[32m" : "\x1B[0m";
    console.log(`\x1B[90m${req.method}\x1B[0m ${url.pathname} ` + `${color(r.status)}${r.status}\x1B[0m ` + `\x1B[90m${duration}ms\x1B[0m`);
  } else if (format === "combined") {
    const timestamp = new Date().toISOString();
    console.log(`${req.headers.get("x-forwarded-for") || "-"} - - ` + `[${timestamp}] "${req.method} ${url.pathname}" ` + `${r.status} ${duration}ms ` + `"${req.headers.get("user-agent") || "-"}"`);
  } else if (format === "json") {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      method: req.method,
      path: url.pathname,
      status: r.status,
      duration,
      ip: req.headers.get("x-forwarded-for") || "-"
    }));
  }
  return r;
};
var rateLimit = (options = {}) => {
  const {
    windowMs = 60000,
    max = 100,
    keyGenerator = () => "unknown",
    standardHeaders = true
  } = options;
  if (windowMs <= 0) {
    throw new Error("windowMs must be > 0");
  }
  if (max <= 0) {
    throw new Error("max must be > 0");
  }
  const hits = new Map;
  let warnedUnknown = false;
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of hits.entries()) {
      const valid = timestamps.filter((t) => now - t < windowMs);
      if (valid.length === 0) {
        hits.delete(key);
      } else {
        hits.set(key, valid);
      }
    }
  }, windowMs);
  cleanup.unref?.();
  return async (req) => {
    const key = keyGenerator(req);
    if ((!key || key === "unknown") && !warnedUnknown) {
      warnedUnknown = true;
      console.warn("Rate limiter: No trusted client identity; all requests share one bucket");
    }
    const now = Date.now();
    const timestamps = hits.get(key) || [];
    const validTimestamps = timestamps.filter((t) => now - t < windowMs);
    const remaining = Math.max(0, max - validTimestamps.length - 1);
    const resetTime = validTimestamps.length > 0 ? new Date(validTimestamps[0] + windowMs).toISOString() : new Date(now + windowMs).toISOString();
    if (validTimestamps.length >= max) {
      const headers = standardHeaders ? {
        "RateLimit-Limit": max.toString(),
        "RateLimit-Remaining": "0",
        "RateLimit-Reset": resetTime,
        "Retry-After": Math.ceil(windowMs / 1000).toString()
      } : {};
      return new Response(JSON.stringify({
        error: "Too many requests",
        retryAfter: Math.ceil(windowMs / 1000)
      }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          ...headers
        }
      });
    }
    validTimestamps.push(now);
    hits.set(key, validTimestamps);
    req._mw = req._mw || {};
    req._mw.rate = {
      remaining,
      resetTime,
      limit: max
    };
    ctx(req).rate = {
      remaining,
      resetTime,
      limit: max
    };
  };
};
var rateLimitAfter = async (res, req, next) => {
  const t = next ? await next() : undefined;
  const r = t ?? res;
  const data = ctx(req).rate;
  if (!data || !data.limit) {
    return r;
  }
  const headers = new Headers(r.headers);
  headers.set("RateLimit-Limit", data.limit.toString());
  headers.set("RateLimit-Remaining", data.remaining.toString());
  headers.set("RateLimit-Reset", data.resetTime);
  return new Response(r.body, {
    status: r.status,
    statusText: r.statusText,
    headers
  });
};
var bearerAuth = (options = {}) => {
  const {
    token: expectedToken,
    verify,
    realm = "api"
  } = options;
  if (!expectedToken && !verify) {
    throw new Error("bearerAuth requires either token or verify function");
  }
  const unauthorized = () => new Response(JSON.stringify({
    error: "Unauthorized"
  }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
      "WWW-Authenticate": `Bearer realm="${realm}"`
    }
  });
  return async (req, next) => {
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return unauthorized();
    }
    const token = auth.slice(7).trim();
    if (!token) {
      return unauthorized();
    }
    try {
      const isValid = verify ? await verify(token) : token === expectedToken;
      if (!isValid) {
        return unauthorized();
      }
      req._mw = req._mw || {};
      req._mw.token = token;
      ctx(req).token = token;
      if (next)
        await next();
      return;
    } catch (err) {
      return unauthorized();
    }
  };
};
var bodyLimit = (options = {}) => {
  const {
    max = "10mb"
  } = options;
  const parseSize = (size) => {
    if (typeof size === "number") {
      if (!Number.isSafeInteger(size) || size < 0) {
        throw new Error("Size must be a non-negative safe integer");
      }
      return size;
    }
    const units = {
      b: 1,
      kb: 1024,
      mb: 1024 * 1024,
      gb: 1024 * 1024 * 1024
    };
    const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
    if (!match) {
      throw new Error(`Invalid size format: ${size}`);
    }
    const value = parseFloat(match[1]);
    if (value < 0) {
      throw new Error("Size must be >= 0");
    }
    return value * (units[match[2] || "b"] || 1);
  };
  const maxBytes = parseSize(max);
  return async (req) => {
    const contentLength = req.headers.get("content-length");
    const invalidLength = () => new Response(JSON.stringify({ error: "Invalid Content-Length" }), { status: 400, headers: { "Content-Type": "application/json" } });
    const tooLarge = (received) => new Response(JSON.stringify({ error: "Request body too large", max: maxBytes, received }), { status: 413, headers: { "Content-Type": "application/json" } });
    if (contentLength !== null) {
      if (!/^(0|[1-9]\d*)$/.test(contentLength) || !Number.isSafeInteger(Number(contentLength))) {
        return invalidLength();
      }
      if (Number(contentLength) > maxBytes)
        return tooLarge(Number(contentLength));
    }
    if (!req.body)
      return;
    const reader = req.clone().body.getReader();
    let received = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done)
          break;
        received += value.byteLength;
        if (received > maxBytes) {
          reader.cancel().catch(() => {});
          req.body.cancel().catch(() => {});
          return tooLarge(received);
        }
      }
    } finally {
      reader.releaseLock();
    }
  };
};
var secureHeaders = (options = {}) => {
  const {
    contentSecurityPolicy = "default-src 'self'",
    xFrameOptions = "DENY",
    strictTransportSecurity = "max-age=31536000; includeSubDomains",
    xContentTypeOptions = true,
    referrerPolicy = "no-referrer"
  } = options;
  const headers = {};
  if (contentSecurityPolicy) {
    headers["Content-Security-Policy"] = contentSecurityPolicy;
  }
  if (xFrameOptions) {
    headers["X-Frame-Options"] = xFrameOptions;
  }
  if (strictTransportSecurity) {
    headers["Strict-Transport-Security"] = strictTransportSecurity;
  }
  if (xContentTypeOptions) {
    headers["X-Content-Type-Options"] = "nosniff";
  }
  if (referrerPolicy) {
    headers["Referrer-Policy"] = referrerPolicy;
  }
  return async (req, next) => {
    req._mw = req._mw || {};
    req._mw.secure = {
      headers
    };
    ctx(req).secure = {
      headers
    };
    if (next)
      await next();
  };
};
var secureHeadersAfter = async (res, req, next) => {
  const t = next ? await next() : undefined;
  const r = t ?? res;
  const data = ctx(req).secure;
  if (!data?.headers) {
    return r;
  }
  const headers = new Headers(r.headers);
  Object.entries(data.headers).forEach(([key, value]) => headers.set(key, value));
  return new Response(r.body, {
    status: r.status,
    statusText: r.statusText,
    headers
  });
};
var requestId = (options = {}) => {
  const {
    header = "X-Request-ID",
    generator = () => crypto.randomUUID()
  } = options;
  if (!header) {
    throw new Error("header cannot be empty");
  }
  return async (req, next) => {
    const existing = req.headers.get(header);
    const id = existing || generator();
    req._mw = req._mw || {};
    req._mw.reqId = {
      id,
      header
    };
    ctx(req).reqId = {
      id,
      header
    };
    if (next)
      await next();
  };
};
var requestIdAfter = async (res, req, next) => {
  const t = next ? await next() : undefined;
  const r = t ?? res;
  const data = ctx(req).reqId;
  if (!data?.id) {
    return r;
  }
  const headers = new Headers(r.headers);
  headers.set(data.header, data.id);
  return new Response(r.body, {
    status: r.status,
    statusText: r.statusText,
    headers
  });
};
var basicAuth = (options = { users: {} }) => {
  const {
    users,
    realm = "Secure Area"
  } = options;
  if (!users || Object.keys(users).length === 0) {
    throw new Error("basicAuth requires at least one user");
  }
  const unauthorized = () => new Response(JSON.stringify({
    error: "Unauthorized"
  }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
      "WWW-Authenticate": `Basic realm="${realm}"`
    }
  });
  return async (req, next) => {
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Basic ")) {
      return unauthorized();
    }
    try {
      const credentials = atob(auth.slice(6));
      const colonIndex = credentials.indexOf(":");
      if (colonIndex === -1) {
        return unauthorized();
      }
      const username = credentials.slice(0, colonIndex);
      const password = credentials.slice(colonIndex + 1);
      if (!username || !password) {
        return unauthorized();
      }
      if (users[username] !== password) {
        return unauthorized();
      }
      req._mw = req._mw || {};
      req._mw.user = {
        username
      };
      if (next)
        await next();
    } catch (err) {
      console.error("basicAuth error:", err);
      return unauthorized();
    }
  };
};
export {
  basicAuth,
  bearerAuth,
  bodyLimit,
  cors,
  corsAfter,
  logger,
  loggerAfter,
  rateLimit,
  rateLimitAfter,
  requestId,
  requestIdAfter,
  secureHeaders,
  secureHeadersAfter
};
