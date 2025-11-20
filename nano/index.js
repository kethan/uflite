import { lead, mount, compile, run } from '../plugins';

export const flite = ({ routes = [], ...others } = {}) => ({
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
        const url = new URL(request.url), path = url.pathname, mt = request.method, exec = run(others.mode);
        let result, match;
        request.query = { __proto__: null };
        for (let [k, v] of url.searchParams)
            request.query[k] = request.query[k] ? [].concat(request.query[k], v) : v;
        const mx = others.match;
        if (mx) {
            const m = mx({ method: mt, path });
            if (m?.params) request.params = m.params;
            if (m?.handlers?.length) return await exec(m.handlers)(request, ...args);
        } else {
            for (let [m, rx, hs] of routes)
                if ((m == mt || m == 'ALL') && (match = path.match(rx))) {
                    if (m != 'ALL' && match.groups) request.params = match.groups;
                    if ((result = await exec(hs)(request, ...args)) != null) return result;
                }
        }
        return result;
    }
});
