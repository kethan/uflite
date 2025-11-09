
const lead = x => String(x).startsWith('/') ? x : '/' + x,
  mount = fn => fn?.fetch || fn,
  compile = path => RegExp(`^${path
    .replace(/\/+(\/|$)/g, '$1')
    .replace(/:(\w+)/g, '(?<$1>[^/]+)')
    .replace(/(\/?)\*/g, '($1.*)?')
    }/*$`);


class StatusE extends Error {
  constructor(status = 500, message, data) {
    super(message || `Error ${status}`);
    this.status = status;
    if (data) Object.assign(this, data);
  }
}

export const status = StatusE;

export const
  run =
    (mode = 0, next, loop, i = 0, result) =>
      (...fns) =>
        (...args) =>
          new Promise((resolve, reject) => {
            fns = fns.flat(1 / 0).filter(fn => fn?.call);
            loop = async () => {
              if (i >= fns.length) return resolve();
              result = mode ? await fns[i++](...args, next) : await fns[i++](...args);
              if (result) return resolve(result);
              if (!mode) await next();
            };
            (next = (err) => err ? reject(err) : loop().catch(next))()
          }),
  response =
    (format = 'text/plain; charset=utf-8', transform) =>
      (body, options = {}) => {
        if (body === undefined || body instanceof Response) return body;
        const response = new Response(transform?.(body) ?? body, options.url ? undefined : options);
        response.headers.set('content-type', format);
        return response;
      },
  text = response(),
  html = response('text/html; charset=utf-8'),
  json = response('application/json; charset=utf-8', JSON.stringify),
  error = (a = 500, b) => {
    if (a instanceof Error) {
      b = { error: a.message, ...a };
      a = a.status || 500;
    }
    return json({ status: a, ...(typeof b === 'object' ? b : { error: b }) }, { status: a });
  },
  flite = ({ routes = [], format = json, services = new Map(), events = new Map(), channels = new Map(), ...other } = {}) => ({
    __proto__: new Proxy({}, {
      get: (_, method, receiver) => (route, ...handlers) => {
        method && method.toUpperCase() === 'USE' ?
          route?.call ?
            routes.push(["ALL", compile('*'), [route, ...handlers].map(mount), "*"]) :
            (handlers.forEach(handler =>
              handler?.routes ?
                (handler.routes.forEach(([method, , handles, path]) =>
                  routes.push([method.toUpperCase(), compile(lead(route + path)), handles.map(mount), lead(route + path)])
                )) : routes.push(['ALL', compile(lead(route)), [handler].map(mount), lead(route)])
            )) :
          routes.push([method.toUpperCase(), compile(lead(route)), handlers.map(mount), lead(route)]);
        return receiver;
      }
    }),
    routes,
    ...other,

    on(event, handler) {
      if (!events.has(event)) events.set(event, []);
      events.get(event).push(handler);
      return this;
    },

    off(event, handler) {
      const handlers = events.get(event);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) handlers.splice(index, 1);
      }
      return this;
    },

    emit(event, ...args) {
      events.get(event)?.forEach(handler => handler(...args));
      return this;
    },

    channel(name) {
      if (!channels.has(name)) {
        const conns = new Set();
        channels.set(name, {
          connections: conns,
          join: (conn, data) => (conns.add({ conn, data }), channels.get(name)),
          leave: (conn) => (conns.forEach(c => c.conn === conn && conns.delete(c)), channels.get(name)),
          send: (event, data) => (conns.forEach(({ conn }) => conn.send?.(JSON.stringify({ event, data }))), channels.get(name)),
          filter: (fn) => ({ send: (event, data) => conns.forEach(c => fn(c.data, data) && c.conn.send?.(JSON.stringify({ event, data }))) })
        });
      }
      return channels.get(name);
    },

    service(name, svc) {
      if (svc) {
        const ev = new Map(), hooks = { before: {}, after: {} };

        svc.setup?.(this, name);

        const call = async (m, ...a) => {
          let c = { app: this, service: svc, method: m, path: name, params: a[a.length - 1] || {} };
          if (m !== 'find') c.id = a[0];
          if (['create', 'patch', 'update'].includes(m)) c.data = a[m === 'create' ? 0 : 1];

          const before = [
            ...(other.hooks?.before?.all || []),
            ...(other.hooks?.before?.[m] || []),
            ...(hooks.before?.all || []),
            ...(hooks.before?.[m] || [])
          ];
          if (before.length) c = await run(other.mode)(before)(c) || c;

          c.result = await svc[m]?.(...['find', 'get', 'create', 'patch', 'update', 'remove'].includes(m)
            ? (m === 'find' ? [c.params]
              : m === 'get' || m === 'remove' ? [c.id, c.params]
                : m === 'create' ? [c.data, c.params]
                  : [c.id, c.data, c.params])
            : a);

          const after = [
            ...(hooks.after?.[m] || []),
            ...(hooks.after?.all || []),
            ...(other.hooks?.after?.[m] || []),
            ...(other.hooks?.after?.all || [])
          ];
          if (after.length) c = await run(other.mode)(after)(c) || c;

          ['create', 'patch', 'update', 'remove'].includes(m) && ev.get(m + 'd')?.forEach(f => f(c.result));
          return c.result;
        };

        const w = {
          on: (e, f) => (ev.has(e) || ev.set(e, []), ev.get(e).push(f), w),
          hooks: (h) => (h.before && Object.assign(hooks.before, h.before), h.after && Object.assign(hooks.after, h.after), w),
          find: (...a) => call('find', ...a),
          get: (...a) => call('get', ...a),
          create: (...a) => call('create', ...a),
          patch: (...a) => call('patch', ...a),
          update: (...a) => call('update', ...a),
          remove: (...a) => call('remove', ...a),
          setup: async (...a) => await svc.setup?.(...a),
          teardown: async (...a) => await svc.teardown?.(...a),
        };

        for (const k in svc)
          typeof svc[k] === 'function' && !w[k] && !['setup', 'teardown'].includes(k) &&
            (w[k] = (...a) => call(k, ...a));

        services.set(name.startsWith('/') ? name.slice(1) : name, w);

        const path = name.startsWith('/') ? name : `/${name}`;
        svc.find && this.get(path, async (r) => w.find(r.query));
        svc.get && this.get(`${path}/:id`, async (r) => w.get(r.params.id, r.query));
        svc.create && this.post(path, async (r) => w.create(await r.json(), r.query));
        svc.patch && this.patch(`${path}/:id`, async (r) => w.patch(r.params.id, await r.json(), r.query));
        svc.update && this.put(`${path}/:id`, async (r) => w.update(r.params.id, await r.json(), r.query));
        svc.remove && this.delete(`${path}/:id`, async (r) => w.remove(r.params.id, r.query));

        return w;
      }

      const s = services.get(name.startsWith('/') ? name.slice(1) : name);
      if (!s) throw new Error(`Service '${name}' not found`);
      return s;
    },

    async teardown() {
      for (const [path, wrapper] of services) {
        await wrapper?.teardown?.(this, path);
      }
      return this;
    },

    hooks(h) {
      if (!other.hooks) other.hooks = { before: {}, after: {} };
      if (h.before) Object.assign(other.hooks.before, h.before);
      if (h.after) Object.assign(other.hooks.after, h.after);
      return this;
    },

    fetch: async (request, ...args) => {
      try {
        let res, url = new URL(request.url), match;
        request.query = Object.fromEntries(url.searchParams);

        const r = async (hns, ...params) => run(other.mode || 0)(hns)(...params);

        t: try {
          if ((res = await r([other?.before?.all, other?.before?.[request.method.toLowerCase()]], request.proxy ?? request, ...args)) !== undefined) break t;
          outer: for (const [method, route, handlers] of routes) {
            if ((method === request.method || method === 'ALL') && (match = url.pathname.match(route))) {
              request.params = match.groups || {};
              if ((res = await r(handlers, request.proxy ?? request, ...args)) !== undefined) break outer;
            }
          }
        } catch (err) {
          if (other.error) {
            res = await run(other.mode || 0)([other?.error?.all, other?.error?.[request.method.toLowerCase()]])(err, request.proxy ?? request, ...args);
          } else {
            throw err;
          }
        }

        try {
          res = await r([other?.after?.all, other?.after?.[request.method.toLowerCase()]], res, request.proxy ?? request, ...args) ?? res;
        } catch (err) {
          if (other.error) {
            res = await run(other.mode || 0)([other?.error?.all, other?.error?.[request.method.toLowerCase()]])(err, request.proxy ?? request, ...args);
          } else {
            throw err;
          }
        }
        return format === false ? res : format(res);

      } catch (err) {
        return format === false ? Promise.reject(err) : error(err);
      }
    }
  });