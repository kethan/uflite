const format = (ms, n) => `${ms.toFixed(2)}ms ${(n / (ms / 1000)).toFixed(0)}/s`

const pathWithURL = r => new URL(r.url).pathname
const pathManual = r => {
  const s = r.url
  const i = s.indexOf('/', 8)
  const j = s.indexOf('?', i)
  return s.slice(i, j > -1 ? j : s.length)
}

const queryWithURL = r => {
  const u = new URL(r.url)
  const q = { __proto__: null }
  for (const [k, v] of u.searchParams) q[k] = q[k] ? [].concat(q[k], v) : v
  return q
}

const queryManual = r => {
  const s = r.url
  const i = s.indexOf('?', 8)
  const q = { __proto__: null }
  if (i < 0) return q
  const str = s.slice(i + 1)
  if (!str) return q
  for (const pair of str.split('&')) {
    if (!pair) continue
    const eq = pair.indexOf('=')
    const k = eq > -1 ? pair.slice(0, eq) : pair
    const v = eq > -1 ? pair.slice(eq + 1) : ''
    const dk = decodeURIComponent(k)
    const dv = decodeURIComponent(v)
    q[dk] = q[dk] ? [].concat(q[dk], dv) : dv
  }
  return q
}

const bothWithURL = r => {
  const u = new URL(r.url)
  const p = u.pathname
  const q = { __proto__: null }
  for (const [k, v] of u.searchParams) q[k] = q[k] ? [].concat(q[k], v) : v
  return [p, q]
}

const bothManual = r => [pathManual(r), queryManual(r)]

const bench = async () => {
  const urls = [
    'http://localhost/users/123?x=1&y=2&x=3',
    'http://localhost/a/b/c/d/e/f/g?h=i&j=k&l=m&n=o&p=q',
    'http://localhost/path-only',
  ]
  const reqs = urls.map(u => new Request(u))
  const N = 100000

  const run = (name, fn) => {
    const t0 = performance.now()
    let c = 0
    for (let i = 0; i < N; i++) {
      const r = reqs[i % reqs.length]
      fn(r); c++
    }
    const ms = performance.now() - t0
    console.log(name, format(ms, c))
  }

  run('path / URL', pathWithURL)
  run('path / manual', pathManual)
  run('query / URL', queryWithURL)
  run('query / manual', queryManual)
  run('both / URL', bothWithURL)
  run('both / manual', bothManual)
}

bench()