import { flite } from './nano/index.js';

const isApp = (x) => !!x && typeof x.fetch === 'function';

export function createSPA(appOrRoutes, options = {}) {
  const opts = (appOrRoutes && !Array.isArray(appOrRoutes) && !isApp(appOrRoutes))
    ? { ...appOrRoutes, ...options }
    : (options || {});
  const app = Array.isArray(appOrRoutes)
    ? (() => { const a = flite(); appOrRoutes.forEach(([p, h]) => a.get(p, h)); return a; })()
    : (isApp(appOrRoutes) ? appOrRoutes : flite(opts.appConfig || {}));

  const win = opts.window ?? (typeof window !== 'undefined' ? window : undefined);
  const baseUrl = opts.baseUrl ?? opts.origin ?? (win?.location?.origin) ?? 'http://localhost';
  const notFound = opts.notFound ?? opts.fallback;
  const listeners = new Set();
  let current;

  const notify = (value) => {
    current = value;
    listeners.forEach((fn) => { try { fn(value); } catch {} });
    return value;
  };

  const resolvePath = (path) => {
    if (typeof path !== 'string') path = String(path ?? '/');
    if (!path.startsWith('/')) path = '/' + path;
    return path;
  };

  const navigate = async (path) => {
    const p = resolvePath(path);
    try {
      const view = await app.fetch(new Request(baseUrl + p));
      return notify(view);
    } catch (err) {
      const fallback = typeof notFound === 'function' ? notFound(err) : (notFound ?? err);
      return notify(fallback);
    }
  };

  const linkProps = {
    onClick: (e) => {
      const target = e?.target?.closest ? e.target.closest('a') : null;
      const href = target?.getAttribute?.('href');
      if (!target || !href || href.startsWith('http') || href.startsWith('//')) return;
      if (typeof e?.preventDefault === 'function') e.preventDefault();
      if (win?.history?.pushState) win.history.pushState(null, '', href);
      void navigate(href);
    }
  };

  const start = async () => {
    const path = win
      ? (win.location.pathname + win.location.search + (win.location.hash || ''))
      : (opts.initialPath || '/');
    return navigate(path);
  };

  const subscribe = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };

  const controller = {
    app,
    navigate,
    start,
    linkProps,
    subscribe,
    get current() { return current; },
    get view() { return current; }
  };

  // Optional auto-start when a window is present and requested.
  if (opts.autoStart && win) void start();

  return controller;
}

export const createBrowserRouter = createSPA;
export const createFrameworkRouter = createSPA;
export const createRouter = createSPA;
export const spa = createSPA;
export const router = createSPA;

// Framework-friendly hook-like helper. Framework code owns state; this returns
// navigation helpers bound to a setter: setView(value).
export function useRouter(appOrRoutes, initial, setView, options = {}) {
  const ctrl = createSPA(appOrRoutes, options);
  const navigate = async (path) => {
    const view = await ctrl.navigate(path);
    if (typeof setView === 'function') setView(view);
    return view;
  };
  const start = async () => {
    const view = await ctrl.start();
    if (typeof setView === 'function') setView(view);
    return view;
  };
  return {
    app: ctrl.app,
    view: ctrl.current ?? initial,
    navigate,
    start,
    linkProps: ctrl.linkProps,
    subscribe: ctrl.subscribe
  };
}

export default createSPA;
