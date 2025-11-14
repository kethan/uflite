export const lead = x => x[0] == '/' ? x : '/' + x;
export const mount = f => f?.fetch || f;
export const compile = p => RegExp(`^${p.replace(/\/+(\/|$)/g, '$1').replace(/:(\w+)/g, '(?<$1>[^/]+)').replace(/(\/?)\*/g, '($1.*)?')}/*$`);
export const norm = n => n.startsWith('/') ? n.slice(1) : n;

export const run = (mode = 0, next, loop, i = 0, result) =>
    (...f) =>
        (...a) =>
            new Promise((s, j) => (
                f = f.flat(Infinity).filter(x => x?.call),
                loop = async () => {
                    if (i >= f.length) return result;
                    const t = mode ? await f[i++](...a, next) : await f[i++](...a);
                    t != null && (result = t);
                    return mode ? result : (result != null ? result : next());
                },
                (next = err => err ? Promise.reject(err) : loop())().then(() => s(result), j)
            ));

// ============================================
// EVENTS PLUGIN


// ============================================
export const events = (app, eventMap = new Map()) => {
    app.on = (e, h) => (eventMap.has(e) || eventMap.set(e, []), eventMap.get(e).push(h), app);

    app.off = (e, h) => {
        const handlers = eventMap.get(e);
        if (handlers) {
            const i = handlers.indexOf(h);
            i > -1 && handlers.splice(i, 1);
        }
        return app;
    };

    app.emit = (e, ...a) => (eventMap.get(e)?.forEach(h => h(...a)), app);

    return app;
};

// ============================================
// CHANNELS PLUGIN
// ============================================
export const channels = (app, channelMap = new Map()) => {
    app.channel = name => {
        if (!channelMap.has(name)) {
            const conns = new Set();
            const msg = (event, data) => JSON.stringify({ event, data });

            channelMap.set(name, {
                connections: conns,
                join: (conn, data) => (conns.add({ conn, data }), channelMap.get(name)),
                leave: conn => (conns.forEach(c => c.conn === conn && conns.delete(c)), channelMap.get(name)),
                send: (event, data) => {
                    const m = msg(event, data);
                    conns.forEach(({ conn }) => conn.send?.(m));
                    return channelMap.get(name);
                },
                filter: fn => ({
                    send: (event, data) => {
                        const m = msg(event, data);
                        conns.forEach(c => fn(c.data, data) && c.conn.send?.(m));
                    }
                })
            });
        }
        return channelMap.get(name);
    };

    return app;
};

// ============================================
// RESPONSE HELPERS
// ============================================
class StatusE extends Error {
    constructor(status = 500, message, data) {
        super(message || `Error ${status}`);
        this.status = status;
        data && Object.assign(this, data);
    }
}

export const status = StatusE;

export const
    response = (format = 'text/plain; charset=utf-8', transform) =>
        (body, options = {}) => {
            if (body === undefined || body instanceof Response) return body;
            const res = new Response(transform?.(body) ?? body, options.url ? undefined : options);
            res.headers.set('content-type', format);
            return res;
        },
    text = response(),
    html = response('text/html; charset=utf-8'),
    json = response('application/json; charset=utf-8', JSON.stringify),
    error = (a = 500, b) => {
        if (a instanceof Error) b = { error: a.message, ...a }, a = a.status || 500;
        return json({ status: a, ...(typeof b === 'object' ? b : { error: b }) }, { status: a });
    };

// ============================================
// SERVICES PLUGIN
// ============================================

export const services = (app, m = new Map()) => {
    const ah = { before: {}, after: {} };

    app.hooks = h => (h.before && Object.assign(ah.before, h.before), h.after && Object.assign(ah.after, h.after), app);

    app.service = (n, s) => {
        if (!s) {
            const x = m.get(norm(n));
            if (!x) throw new Error(`Service '${n}' not found`);
            return x;
        }

        const ev = new Map(), sh = { before: {}, after: {} };

        s.setup?.(app, n);

        const runH = async (h, c) => {
            if (app.mode === 1) await run(1)(h)(c);
            else for (const x of h) await x(c);
        };

        const call = async (mt, ...a) => {
            const c = { app, service: s, method: mt, path: n, params: a[a.length - 1] || {} };

            mt !== 'find' && (c.id = a[0]);
            /create|patch|update/.test(mt) && (c.data = a[mt === 'create' ? 0 : 1]);

            const b = [...(ah.before?.all || []), ...(ah.before?.[mt] || []), ...(sh.before?.all || []), ...(sh.before?.[mt] || [])];
            b.length && await runH(b, c);

            c.result = await s[mt]?.(
                ...(/find|get|create|patch|update|remove/.test(mt)
                    ? (mt === 'find' ? [c.params]
                        : /get|remove/.test(mt) ? [c.id, c.params]
                            : mt === 'create' ? [c.data, c.params]
                                : [c.id, c.data, c.params])
                    : a)
            );

            const af = [...(sh.after?.[mt] || []), ...(sh.after?.all || []), ...(ah.after?.[mt] || []), ...(ah.after?.all || [])];
            af.length && await runH(af, c);

            /create|patch|update|remove/.test(mt) && ev.get(mt === 'patch' ? 'patched' : mt === 'remove' ? 'removed' : mt + 'd')?.forEach(f => f(c.result));

            return c.result;
        };

        const w = {
            on: (e, f) => (ev.has(e) || ev.set(e, []), ev.get(e).push(f), w),
            hooks: h => (h.before && Object.assign(sh.before, h.before), h.after && Object.assign(sh.after, h.after), w),
            setup: async (...a) => s.setup?.(...a),
            teardown: async (...a) => s.teardown?.(...a)
        };

        for (const x of ['find', 'get', 'create', 'patch', 'update', 'remove'])
            w[x] = (...a) => call(x, ...a);

        for (const k in s)
            typeof s[k] === 'function' && !w[k] && !['setup', 'teardown'].includes(k) && (w[k] = (...a) => call(k, ...a));

        m.set(norm(n), w);

        const p = lead(n);
        s.find && app.GET?.(p, async r => json(await w.find(r.query)));
        s.get && app.GET?.(`${p}/:id`, async r => json(await w.get(r.params.id, r.query)));
        s.create && app.POST?.(p, async r => json(await w.create(await r.json(), r.query)));
        s.patch && app.PATCH?.(`${p}/:id`, async r => json(await w.patch(r.params.id, await r.json(), r.query)));
        s.update && app.PUT?.(`${p}/:id`, async r => json(await w.update(r.params.id, await r.json(), r.query)));
        s.remove && app.DELETE?.(`${p}/:id`, async r => json(await w.remove(r.params.id, r.query)));

        return w;
    };

    app.teardown = () => {
        for (const [p, w] of m)
            w.teardown?.(app, p);
        return app;
    };

    return app;
};