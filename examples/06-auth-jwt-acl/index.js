import { createSchemalessAdapter } from 'umosql/schemaless'
import { jwt } from 'better-auth/plugins'
import { flite, json } from 'uflite'
import { createAuth } from 'uflite/services/auth'
import { createACL } from 'uflite/services/acl'

const port = Number(Bun.env.PORT || 3000)
const baseURL = Bun.env.AUTH_BASE_URL || `http://localhost:${port}`
if (Bun.env.NODE_ENV === 'production' && (!Bun.env.AUTH_SECRET || Bun.env.AUTH_SECRET.length < 32))
  throw new Error('Set AUTH_SECRET (at least 32 characters) in production')
const secret = Bun.env.AUTH_SECRET || 'local-demo-secret-at-least-32-characters-long'
const { adapter } = createSchemalessAdapter(undefined, 'memory')
const auth = await createAuth({ adapter, baseURL, secret, extraPlugins: [jwt()] })
const acl = createACL({ enabled: true, rules: [
  { id: 'member-profile', permissions: ['member:profile:read'],
    check: { 'user.id': { $exists: true } } }
] })

const unauthorized = () => json({ error: 'Unauthorized' }, { status: 401 })
const forbidden = () => json({ error: 'Forbidden' }, { status: 403 })
const app = flite({
  before: { all: [async req => {
    const path = new URL(req.url).pathname
    if (path !== '/api/me' && path !== '/api/admin') return
    const token = /^Bearer (\S+)$/.exec(req.headers.get('authorization') || '')?.[1]
    if (!token) return unauthorized()
    // Verify signature, issuer, audience and expiry; never trust a decoded-only JWT.
    const { payload } = await auth.api.verifyJWT({ body: { token } })
    if (!payload?.sub) return unauthorized()
    req.userId = payload.sub
  }] },
  error: { all: [err => {
    if ((err.status || 500) >= 500) console.error(err)
    return json({ error: (err.status || 500) >= 500 ? 'Internal Server Error' : err.message },
      { status: err.status || 500 })
  }] }
})

// Better Auth owns real sign-up, sign-in and the cookie-gated JWT /token endpoint.
app.all('/api/auth/*', req => auth.handler(req))
app.get('/api/me', req => acl.can({ user: { id: req.userId } }, 'member:profile:read')
  ? json({ id: req.userId }) : forbidden())
app.get('/api/admin', req => acl.can({ user: { id: req.userId } }, 'admin:reports:read')
  ? json({ allowed: true }) : forbidden())

export { app }
export default { port, fetch: request => app.fetch(request) }
