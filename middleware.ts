// middleware.ts - Essential & Validated
const MW = new WeakMap<any, any>();
const ctx = (req: any) => { let c = MW.get(req); if (!c) { c = {}; MW.set(req, c); } return c; };

/**
 * CORS - Cross-Origin Resource Sharing
 */
export const cors = (options: {
    origin?: string | string[] | RegExp;
    methods?: string[];
    credentials?: boolean;
    maxAge?: number;
    allowedHeaders?: string[];
    exposedHeaders?: string[];
} = {}) => {
    const {
        origin = '*',
        methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        credentials = false,
        maxAge = 86400,
        allowedHeaders = ['Content-Type', 'Authorization'],
        exposedHeaders = []
    } = options;

    // ✅ Validate options
    if (maxAge < 0) throw new Error('maxAge must be >= 0');
    if (!Array.isArray(methods)) throw new Error('methods must be an array');

    return async (req: Request, next?: any) => {
        const requestOrigin = req.headers.get('origin') || '';

        // Determine allowed origin
        let allowedOrigin = '*';
        if (origin instanceof RegExp) {
            allowedOrigin = origin.test(requestOrigin) ? requestOrigin : '';
        } else if (Array.isArray(origin)) {
            allowedOrigin = origin.includes(requestOrigin) ? requestOrigin : '';
        } else if (typeof origin === 'string') {
            allowedOrigin = origin;
        }

        // ✅ Reject if origin not allowed
        if (!allowedOrigin) {
            return new Response('Forbidden', { status: 403 });
        }

        // Handle preflight
        if (req.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': allowedOrigin,
                    'Access-Control-Allow-Methods': methods.join(', '),
                    'Access-Control-Allow-Headers': allowedHeaders.join(', '),
                    'Access-Control-Max-Age': maxAge.toString(),
                    ...(credentials && { 'Access-Control-Allow-Credentials': 'true' }),
                    ...(exposedHeaders.length && { 'Access-Control-Expose-Headers': exposedHeaders.join(', ') })
                }
            });
        }

        if (next) await next();
        ctx(req).cors = { allowedOrigin, credentials, exposedHeaders };
        };
};

// ✅ CORS wrapper for after hook
export const corsAfter = async (res: Response, req: Request, next?: any) => {
    const t = next ? await next() : undefined;
    const r = (t ?? res) as Response;
    const data = ctx(req).cors;
    if (!data || r instanceof Response === false) return r;
    const headers = new Headers(r.headers);
    headers.set('Access-Control-Allow-Origin', data.allowedOrigin);
    if (data.credentials) headers.set('Access-Control-Allow-Credentials', 'true');
    if (data.exposedHeaders?.length) headers.set('Access-Control-Expose-Headers', data.exposedHeaders.join(', '));
    return new Response(r.body, { status: r.status, statusText: r.statusText, headers });
};

/**
 * Logger - Request/Response logging
 */
export const logger = (options: {
    format?: 'dev' | 'combined' | 'json';
    skip?: (req: Request) => boolean;
} = {}) => {
    const { format = 'dev', skip } = options;

    const statusColor = (status: number) => {
        if (status >= 500) return '\x1b[31m'; // red
        if (status >= 400) return '\x1b[33m'; // yellow
        if (status >= 300) return '\x1b[36m'; // cyan
        if (status >= 200) return '\x1b[32m'; // green
        return '\x1b[0m';
    };

    return async (req: Request, next?: any) => {
        if (skip?.(req)) {
            return next?.();
        }

        const start = Date.now();
        const url = new URL(req.url);

        ctx(req).logger = { start, url, format };
        if (next) await next();
        };
};

export const loggerAfter = async (res: Response, req: Request, next?: any) => {
    const t = next ? await next() : undefined;
    const r = (t ?? res) as Response;
    const logData = ctx(req).logger;
    if (!logData) return r;

    const duration = Date.now() - logData.start;
    const { url, format } = logData;

    if (format === 'dev') {
        const color = (s: number) => s >= 500 ? '\x1b[31m' : s >= 400 ? '\x1b[33m' : s >= 300 ? '\x1b[36m' : s >= 200 ? '\x1b[32m' : '\x1b[0m';
        console.log(
            `\x1b[90m${req.method}\x1b[0m ${url.pathname} ` +
            `${color(r.status)}${r.status}\x1b[0m \x1b[90m${duration}ms\x1b[0m`
        );
    } else if (format === 'combined') {
        const timestamp = new Date().toISOString();
        console.log(
            `${req.headers.get('x-forwarded-for') || '-'} - - ` +
            `[${timestamp}] "${req.method} ${url.pathname}" ${r.status} ` +
            `${duration}ms "${req.headers.get('user-agent') || '-'}"`
        );
    } else if (format === 'json') {
        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            method: req.method,
            path: url.pathname,
            status: r.status,
            duration,
            ip: req.headers.get('x-forwarded-for') || '-'
        }));
    }

    return r;
};

/**
 * Rate Limiter - In-memory (for single instance)
 */
export const rateLimit = (options: {
    windowMs?: number;
    max?: number;
    keyGenerator?: (req: Request) => string;
    standardHeaders?: boolean;
} = {}) => {
    const {
        windowMs = 60000,
        max = 100,
        keyGenerator = (req) => req.headers.get('x-forwarded-for') ||
            req.headers.get('x-real-ip') ||
            'unknown',
        standardHeaders = true
    } = options;

    // ✅ Validate
    if (windowMs <= 0) throw new Error('windowMs must be > 0');
    if (max <= 0) throw new Error('max must be > 0');

    const hits = new Map<string, number[]>();

    // Cleanup periodically
    const cleanup = setInterval(() => {
        const now = Date.now();
        for (const [key, timestamps] of hits.entries()) {
            const valid = timestamps.filter(t => now - t < windowMs);
            if (valid.length === 0) hits.delete(key);
            else hits.set(key, valid);
        }
    }, windowMs);

    // ✅ Cleanup on exit
    if (typeof process !== 'undefined') {
        process.on('beforeExit', () => clearInterval(cleanup));
    }

    return async (req: Request) => {
        const key = keyGenerator(req);

        // ✅ Validate key
        if (!key || key === 'unknown') {
            console.warn('Rate limiter: Unable to identify client');
        }

        const now = Date.now();
        const timestamps = hits.get(key) || [];
        const validTimestamps = timestamps.filter(t => now - t < windowMs);

        const remaining = Math.max(0, max - validTimestamps.length - 1);
        const resetTime = validTimestamps.length > 0
            ? new Date(validTimestamps[0] + windowMs).toISOString()
            : new Date(now + windowMs).toISOString();

        if (validTimestamps.length >= max) {
            const headers = standardHeaders ? {
                'RateLimit-Limit': max.toString(),
                'RateLimit-Remaining': '0',
                'RateLimit-Reset': resetTime,
                'Retry-After': Math.ceil(windowMs / 1000).toString()
            } : {};

            return new Response(
                JSON.stringify({
                    error: 'Too many requests',
                    retryAfter: Math.ceil(windowMs / 1000)
                }),
                {
                    status: 429,
                    headers: {
                        'Content-Type': 'application/json',
                        ...headers
                    }
                }
            );
        }

        validTimestamps.push(now);
        hits.set(key, validTimestamps);
        (req as any)._mw = (req as any)._mw || {};
        (req as any)._mw.rate = { remaining, resetTime, limit: max };
        ctx(req).rate = { remaining, resetTime, limit: max };
    };
};

export const rateLimitAfter = async (res: Response, req: Request, next?: any) => {
    const t = next ? await next() : undefined;
    const r = (t ?? res) as Response;
    const data = ctx(req).rate;
    if (!data || !data.limit) return r;
    const headers = new Headers(r.headers);
    headers.set('RateLimit-Limit', data.limit.toString());
    headers.set('RateLimit-Remaining', data.remaining.toString());
    headers.set('RateLimit-Reset', data.resetTime);
    return new Response(r.body, { status: r.status, statusText: r.statusText, headers });
};

/**
 * Bearer Token Authentication
 */
export const bearerAuth = (options: {
    token?: string;
    verify?: (token: string) => boolean | Promise<boolean>;
    realm?: string;
} = {}) => {
    const {
        token: expectedToken,
        verify,
        realm = 'api'
    } = options;

    // ✅ Validate
    if (!expectedToken && !verify) {
        throw new Error('bearerAuth requires either token or verify function');
    }

    const unauthorized = () => new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
            status: 401,
            headers: {
                'Content-Type': 'application/json',
                'WWW-Authenticate': `Bearer realm="${realm}"`
            }
        }
    );

    return async (req: Request, next?: any) => {
        const auth = req.headers.get('authorization');

        if (!auth?.startsWith('Bearer ')) {
            return unauthorized();
        }

        const token = auth.slice(7).trim();

        // ✅ Validate token format
        if (!token || token.length === 0) {
            return unauthorized();
        }

        try {
            const isValid = verify
                ? await verify(token)
                : token === expectedToken;

            if (!isValid) {
                return unauthorized();
            }

            (req as any)._mw = (req as any)._mw || {};
            (req as any)._mw.token = token;
            if (next) await next();
            return;
        } catch (err) {
            console.error('bearerAuth error:', err);
            return unauthorized();
        }
    };
};

/**
 * Body Size Limit
 */
export const bodyLimit = (options: {
    max?: number | string;
} = {}) => {
    const { max = '10mb' } = options;

    const parseSize = (size: number | string): number => {
        if (typeof size === 'number') {
            if (size < 0) throw new Error('Size must be >= 0');
            return size;
        }

        const units: Record<string, number> = {
            b: 1,
            kb: 1024,
            mb: 1024 * 1024,
            gb: 1024 * 1024 * 1024
        };

        const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
        if (!match) throw new Error(`Invalid size format: ${size}`);

        const value = parseFloat(match[1]);
        if (value < 0) throw new Error('Size must be >= 0');

        return value * (units[match[2] || 'b'] || 1);
    };

    const maxBytes = parseSize(max);

    return async (req: Request) => {
        const contentLength = req.headers.get('content-length');

        if (contentLength) {
            const size = parseInt(contentLength, 10);

            // ✅ Validate
            if (isNaN(size) || size < 0) {
                return new Response(
                    JSON.stringify({ error: 'Invalid Content-Length' }),
                    {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    }
                );
            }

            if (size > maxBytes) {
                return new Response(
                    JSON.stringify({
                        error: 'Request body too large',
                        max: maxBytes,
                        received: size
                    }),
                    {
                        status: 413,
                        headers: { 'Content-Type': 'application/json' }
                    }
                );
            }
        }
    };
};

/**
 * Security Headers (Essential subset of Helmet)
 */
export const secureHeaders = (options: {
    contentSecurityPolicy?: string | false;
    xFrameOptions?: string | false;
    strictTransportSecurity?: string | false;
    xContentTypeOptions?: boolean;
    referrerPolicy?: string | false;
} = {}) => {
    const {
        contentSecurityPolicy = "default-src 'self'",
        xFrameOptions = 'DENY',
        strictTransportSecurity = 'max-age=31536000; includeSubDomains',
        xContentTypeOptions = true,
        referrerPolicy = 'no-referrer'
    } = options;

    const headers: Record<string, string> = {};

    if (contentSecurityPolicy) {
        headers['Content-Security-Policy'] = contentSecurityPolicy;
    }
    if (xFrameOptions) {
        headers['X-Frame-Options'] = xFrameOptions;
    }
    if (strictTransportSecurity) {
        headers['Strict-Transport-Security'] = strictTransportSecurity;
    }
    if (xContentTypeOptions) {
        headers['X-Content-Type-Options'] = 'nosniff';
    }
    if (referrerPolicy) {
        headers['Referrer-Policy'] = referrerPolicy;
    }

    return async (req: Request, next?: any) => {
        (req as any)._mw = (req as any)._mw || {};
        (req as any)._mw.secure = { headers };
        ctx(req).secure = { headers };
        if (next) await next();
    };
};

export const secureHeadersAfter = async (res: Response, req: Request, next?: any) => {
    const t = next ? await next() : undefined;
    const r = (t ?? res) as Response;
    const data = ctx(req).secure;
    if (!data?.headers) return r;
    const headers = new Headers(r.headers);
    Object.entries(data.headers).forEach(([key, value]) => headers.set(key, value as string));
    return new Response(r.body, { status: r.status, statusText: r.statusText, headers });
};

/**
 * Request ID
 */
export const requestId = (options: {
    header?: string;
    generator?: () => string;
} = {}) => {
    const {
        header = 'X-Request-ID',
        generator = () => crypto.randomUUID()
    } = options;

    // ✅ Validate
    if (!header) throw new Error('header cannot be empty');

    return async (req: Request, next?: any) => {
        const existing = req.headers.get(header);
        const id = existing || generator();

        (req as any)._mw = (req as any)._mw || {};
        (req as any)._mw.reqId = { id, header };
        ctx(req).reqId = { id, header };
        if (next) await next();
    };
};

export const requestIdAfter = async (res: Response, req: Request, next?: any) => {
    const t = next ? await next() : undefined;
    const r = (t ?? res) as Response;
    const data = ctx(req).reqId;
    if (!data?.id) return r;
    const headers = new Headers(r.headers);
    headers.set(data.header, data.id);
    return new Response(r.body, { status: r.status, statusText: r.statusText, headers });
};

/**
 * Basic Auth
 */
export const basicAuth = (options: {
    users: Record<string, string>;
    realm?: string;
} = { users: {} }) => {
    const {
        users,
        realm = 'Secure Area'
    } = options;

    // ✅ Validate
    if (!users || Object.keys(users).length === 0) {
        throw new Error('basicAuth requires at least one user');
    }

    const unauthorized = () => new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
            status: 401,
            headers: {
                'Content-Type': 'application/json',
                'WWW-Authenticate': `Basic realm="${realm}"`
            }
        }
    );

    return async (req: Request) => {
        const auth = req.headers.get('authorization');

        if (!auth?.startsWith('Basic ')) {
            return unauthorized();
        }

        try {
            const credentials = atob(auth.slice(6));
            const colonIndex = credentials.indexOf(':');

            // ✅ Validate format
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

            return { user: { username } };
        } catch (err) {
            console.error('basicAuth error:', err);
            return unauthorized();
        }
    };
};