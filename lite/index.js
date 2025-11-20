import { lead, mount, compile, run } from '../plugins.js'

export const flite = ({ routes = [], before, after, error, ...others } = {}) => {
  const index = {};
  const add = (mt, rx, hs, p) => {
    routes.push([mt, rx, hs, p]);
    const order = routes.length - 1;
    (index[mt] || (index[mt] = [])).push([rx, hs, order, p]);
  };

  const toMethod = x => x?.toUpperCase ? x.toUpperCase() : x;



  const api = {
    __proto__: new Proxy({}, {
      get: (_, method, receiver) => (path, ...handlers) => {
        if (!method?.toUpperCase) return;
        const m = toMethod(method);
        if (m == 'USE') {
          const r = path?.routes || path?.call, b = r ? '' : path || '';
          (r ? [path, ...handlers] : handlers).forEach(h =>
            h?.routes
              ? h.routes.forEach(([d, , f, p]) =>
                add(d, compile(lead(b + p)), f.map(mount), lead(b + p)))
              : add('ALL', compile(b || '*'), [mount(h)], b || '*')
          );
        } else {
          add(m, compile(lead(path)), handlers.map(mount), lead(path));
        }
        return receiver;
      }
    }),
    routes,
    ...others,
    fetch: async (request, ...args) => {
      const s = request.url, i = s.indexOf('/', 8), j = s.indexOf('?', i), path = s.slice(i, j > -1 ? j : s.length), mt = request.method, mm = mt.toLowerCase(), mode = others.mode;
      let res;
      request.query = { __proto__: null };
      if (j > -1) {
        const str = s.slice(j + 1);
        if (str) {
          for (const pair of str.split('&')) {
            if (!pair) continue;
            const eq = pair.indexOf('='), k = eq > -1 ? pair.slice(0, eq) : pair, v = eq > -1 ? pair.slice(eq + 1) : '';
            const dk = decodeURIComponent(k.replace(/\+/g, ' ')), dv = decodeURIComponent(v.replace(/\+/g, ' '));
            request.query[dk] = request.query[dk] ? [].concat(request.query[dk], dv) : dv;
          }
        }
      }
      try {
        const b = [...(before?.all || []), ...(before?.[mm] || [])];
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
          const mx = others.match;
          if (mx) {
            const m = mx({ method: mt, path });
            if (m?.params) request.params = m.params;
            if (m?.handlers?.length) return await run(mode)(m.handlers)(request, ...args);
          }
          const h = [];
          const all = index.ALL || [];
          let first;
          const spec = index[mt] || [];
          for (const r of spec) {
            const m = path.match(r[0]);
            if (m) { request.params = m.groups || {}; first = { hs: r[1], order: r[2] }; break; }
          }
          if (first) {
            for (const r of all) if (r[2] < first.order && path.match(r[0])) h.push(...r[1]);
            h.push(...first.hs);
          } else {
            for (const r of all) if (path.match(r[0])) h.push(...r[1]);
          }
          h.length && (res = await run(mode)(h)(request, ...args));
        }
        const a = [...(after?.[mm] || []), ...(after?.all || [])];
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
        const e = [...(error?.[mm] || []), ...(error?.all || [])];
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
  };
  return api;
};
