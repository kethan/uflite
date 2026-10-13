# 06 — Login, verified JWT and ACL

A small, independent full-entry example. It uses **`createAuth`** from
`uflite/services/auth` (real Better Auth login), **`createACL`** from
`uflite/services/acl` (policy checks), and Better Auth's optional JWT plugin.
There are no `authService` or `ACLservice` classes in uflite.

From the repository root, run `bun install && bun run build`. Then:

```bash
cd examples/06-auth-jwt-acl
npm install
npm start # bun index.js, http://localhost:3000; PORT overrides the port
```

The example needs Bun, `umosql@0.3.1`, `better-auth`, and `uqry`, all declared locally.
Bun auto-serves its single `index.js` file; no HTTP adapter or Hono is required.
The demo uses in-memory auth storage and a **local-only** fallback secret. Set a unique
`AUTH_SECRET` of at least 32 random characters and the correct `AUTH_BASE_URL` in a real
installation; never use the fallback in production.

## Try the flow

```bash
BASE=http://localhost:3000
curl -si "$BASE/api/me" # 401: no bearer token

# Create an account. Better Auth sets a session cookie.
curl -si -c /tmp/uflite-auth-cookies -X POST "$BASE/api/auth/sign-up/email" \
  -H "origin: $BASE" -H 'content-type: application/json' \
  -d '{"name":"Ada","email":"ada@example.test","password":"strong-demo-password"}'
# 200, Set-Cookie, user and opaque session token

# Log in explicitly and update the cookie jar.
curl -si -c /tmp/uflite-auth-cookies -X POST "$BASE/api/auth/sign-in/email" \
  -H "origin: $BASE" -H 'content-type: application/json' \
  -d '{"email":"ada@example.test","password":"strong-demo-password"}'
# 200, Set-Cookie, user and opaque session token (NOT a JWT)

# Exchange the cookie-authenticated session for a signed JWT.
# /api/auth/token returns {"token":"eyJ..."}; Bun parses its JSON response.
JWT=$(curl -s -b /tmp/uflite-auth-cookies "$BASE/api/auth/token" | \
  bun -e 'process.stdout.write((await Bun.stdin.json()).token)')

# These requests use ONLY the Authorization header (no cookie).
curl -si "$BASE/api/me" -H "authorization: Bearer $JWT"
# 200 {"id":"<verified user id>"}
curl -si "$BASE/api/admin" -H "authorization: Bearer $JWT"
# 403 {"error":"Forbidden"} (no admin policy was configured)
curl -si "$BASE/api/me" -H 'authorization: Bearer invalid'
# 401 {"error":"Unauthorized"}
```

`/api/auth/*` is handled by Better Auth. `/api/auth/token` requires a valid
session cookie to **issue** a JWT. Subsequent `/api/me` and `/api/admin` calls
verify the JWT cryptographically via `auth.api.verifyJWT` (including issuer,
audience and expiry), then use only its verified `sub` identity for ACL. They do
not use the cookie or trust an unsigned decoded payload. All verified users get
this demo's fixed `member:profile:read` permission; nobody receives
`admin:reports:read`. Add trusted application roles and record-level policy
before using ACL to protect real multi-user data.

A JWT is not a revocable session: a previously issued token may remain valid
until its expiry. Rotating keys, revocation, persistent key storage, TLS,
rate limiting, and key/secret management are deployment responsibilities.
This memory demo loses users and JWT signing keys when restarted. For a
cookie-session integration with DBService and guarded storage, see
[example 04](../04-full-services/README.md). For the *static demo bearer string*
(not JWT) used to teach middleware, see [example 05](../05-full-middleware-resolvers/README.md).
