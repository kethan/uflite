# Production readiness follow-up — uflite

**2026-10-13 · Branch `arena/dcd62c4a-uflite` · Base revision `e155681`**

This review records the state of the branch after the README/examples work. It is **not** a production certification.

## Maintainer-requested design decisions

- `plugins.js` uses the original compact one-line `compile` implementation. This preserves the byte-focused design. Literal regexp punctuation in paths (for example `.`) is interpreted as regexp syntax rather than escaped; avoid assuming a route with punctuation matches only the literal string.
- Full `uflite` retains its original default error hook: `all: [(err) => error(err.status || 500, err.message)]`. It includes internal exception messages in 5xx responses. Apps handling secrets should install a custom error hook that logs privately and redacts 5xx, as demonstrated in runnable examples 03–06. Example 01 deliberately uses the minimal `.then(json).catch(error)` wrapper, which exposes thrown messages unless customized.
- The README and six runnable examples import `json` from `uflite`, not `Response.json` as an example API. Nano/lite do not export the helper; importing it from full brings the full entry into the bundle.

## Fixes still on this branch

- **Zero production dependencies:** service integrations are optional peers. Individual `uflite/services/*` subpaths avoid the DB/S3 barrel's eager imports; users install only packages their chosen subpath needs.
- Packed CommonJS `.cjs` entry points and NodeNext TypeScript declaration paths/signatures work in an isolated production-only consumer.
- Local storage rejects pre-existing symlinks, using `lstat` and `O_NOFOLLOW` on supported platforms. A trusted private storage root is still required against hostile concurrent filesystem changes.
- `bodyLimit` measures streamed bytes rather than trusting `Content-Length`. The in-memory rate limiter does not trust forwarded IP headers by default; configure a trusted key and shared store for distributed use.
- Lite custom matcher results pass through after hooks and formatting. Nano now creates a fresh handler runner for each matching route, a one-line correction discovered while verifying an `app.use()` example; the compact route compiler remains unchanged.

## Verification

- `bun install --frozen-lockfile`, `bun run build`, `bun test`: **701 pass, 0 fail, 1,016 assertions across 21 files**.
- `bun run test:types`: passed (middleware source and NodeNext public-consumer sample).
- `bun run test:package`: passed (packed ESM/CommonJS/TypeScript imports without production dependencies; DB-only subpath with only `umosql`).
- `bun run test:examples`: passed. It runs the documented `npm install` and `npm start` for each Bun-hosted example and checks HTTP success and error cases, CRUD, Better Auth signup/login, ACL-protected DBService and local storage, and JWT issuance/verification with 401/403 responses.
- `bun run bench:size` (Bun 1.4.3): nano 1,385 B minified / 799 B gzip; lite 2,470 / 1,251; full 6,134 / 2,690. Fixture: one browser-target GET route; not a universal performance claim.
- The README's internal headings and relative file links were checked. StackBlitz itself was **not** opened or tested; no StackBlitz links are supplied.

## Outstanding deployment checks

1. Runtime/provider smoke tests beyond the local Bun server: Workers, Deno, persistent database, real S3-compatible storage and browser UI. The full Auth example uses an in-memory UMOSQL adapter and local storage by default; do not use its demo secret in production.
2. DBService missing-record errors use `code:404`, not HTTP `status`, so the default service REST response can be 500. The automatic service REST `find` route passes flat query params, whereas DBService expects `params.query` for pagination. Map these explicitly if the deployment requires those HTTP semantics.
3. Async service `setup`/`teardown` are not awaited by the registry; design an explicit lifecycle before depending on async startup/shutdown completion.
4. Triage dev/test-tooling dependency advisories before release. The package metadata says ISC but a matching top-level license file is absent; confirm the project's intended license with the owner.
5. Full's default error-message exposure and the compact compiler's regex treatment are deliberate choices in this branch. Document a deployment-specific redaction policy and use paths without regexp metacharacters or a custom matcher where exact matching is required.

The README is now the primary API and runnable-examples guide; this document is only a release follow-up checklist.
