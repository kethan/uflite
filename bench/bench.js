import { flite } from "../lite/index.js";
import { compile, lead, mount, json } from "../plugins.js";

const now = () => performance.now();
const print = (label, ms, ops) => console.log(label + " " + ms.toFixed(2) + "ms " + Math.round(ops) + "/s");

// Current app (indexed routes)
const current = flite();
for (let i = 0; i < 1000; i++) current.get("/r" + i, () => json({ i }));
current.all("*", () => { });

// Legacy app (linear scan)
const legacy = (() => {
  const routes = [];
  const app = {
    get: (p, ...hs) => (routes.push(["GET", compile(lead(p)), hs.map(mount), lead(p)]), app),
    all: (p, ...hs) => (routes.push(["ALL", compile(lead(p || "*")), hs.map(mount), lead(p || "*")]), app),
    fetch: async (request, ...args) => {
      const url = new URL(request.url);
      let res, match;
      const h = [];
      routes.some(([mt, rx, hs]) => (
        (mt == request.method || mt == 'ALL') && (match = url.pathname.match(rx)) &&
        (mt != 'ALL' && (request.params = match.groups || {}), h.push(...hs), mt != 'ALL')
      ));
      if (h.length) {
        for (const f of h) { const t = await f(request, ...args); if (t != null) { res = t; break; } }
      }
      return res;
    }
  };
  return app;
})();

for (let i = 0; i < 1000; i++) legacy.get("/r" + i, () => json({ i }));
legacy.all("*", () => { });

const run = async (label, app, path, n = 20000) => {
  const req = new Request("http://localhost" + path);
  const t0 = now();
  for (let i = 0; i < n; i++) await app.fetch(req);
  const ms = now() - t0;
  print(label + " " + path, ms, n / (ms / 1000));
};

await run("current", current, "/r500");
await run("legacy", legacy, "/r500");
await run("current", current, "/not-found");
await run("legacy", legacy, "/not-found");