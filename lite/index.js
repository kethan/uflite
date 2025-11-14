import { lead, mount, compile, run } from '../plugins.js'

export const flite = ({ routes = [], before, after, error, ...others } = {}) => ({
  __proto__: new Proxy({}, {
    get: (_, method, receiver) => (path, ...handlers) => {
      if (!method?.toUpperCase) return;
      const m = method.toUpperCase();

      if (m == 'USE') {
        const r = path?.routes || path?.call, b = r ? '' : path || '';
        (r ? [path, ...handlers] : handlers).forEach(h =>
          h?.routes
            ? h.routes.forEach(([d, , f, p]) =>
              routes.push([d, compile(lead(b + p)), f.map(mount), lead(b + p)]))
            : routes.push(['ALL', compile(b || '*'), [mount(h)], b || '*'])
        );
      } else {
        routes.push([m, compile(lead(path)), handlers.map(mount), lead(path)]);
      }
      return receiver;
    }
  }),
  routes,
  ...others,

  fetch: async (request, ...args) => {
    const url = new URL(request.url), m = request.method.toLowerCase(), mode = others.mode;
    let res, match;

    request.query = { __proto__: null };
    for (let [k, v] of url.searchParams)
      request.query[k] = request.query[k] ? [].concat(request.query[k], v) : v;

    try {
      const b = [...(before?.all || []), ...(before?.[m] || [])];
      if (b.length) {
        if (mode) {
          res = await run(mode)(b)(request, ...args);
        } else {
          for (const h of b) {
            const t = await h(request, ...args);
            if (t != null) { res = t; break; }
          }
        }
      }

      if (res == null) {
        const h = [];
        routes.some(([mt, rx, hs]) =>
          (mt == request.method || mt == 'ALL') && (match = url.pathname.match(rx)) &&
          (mt != 'ALL' && (request.params = match.groups || {}), h.push(...hs), mt != 'ALL')
        );
        h.length && (res = await run(mode)(h)(request, ...args));
      }

      const a = [...(after?.[m] || []), ...(after?.all || [])];

      if (a.length) {
        if (mode) {
          const t = await run(mode)(a)(res, request, ...args);
          if (t !== undefined) res = t;
        } else {
          for (const h of a) {
            const t = await h(res, request, ...args);
            if (t !== undefined) res = t;
          }
        }
      }
    } catch (err) {

      const e = [...(error?.[m] || []), ...(error?.all || [])];

      if (e.length) {
        if (mode) {
          res = await run(mode)(e)(err, request, ...args);
        } else {
          res = undefined;
          for (const h of e) {
            const t = await h(err, request, ...args);
            if (t !== undefined) { res = t; break; }
          }
        }
        if (res === undefined) throw err;
      } else throw err;
    }

    return res;
  }
});