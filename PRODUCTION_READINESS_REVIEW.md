# Production readiness follow-up — uflite

**2026-10-13 · Branch `arena/dcd62c4a-uflite` · Base revision `e155681`**

## What was fixed

The core package still has **zero production dependencies**. Integration libraries are now declared as **optional peers**, not installed automatically. The README names the packages needed for each integration. Individual subpaths (`uflite/services/db`, `/table`, `/storage`, `/localStorage`) let consumers avoid importing unrelated adapters; the `uflite/services` barrel still requires both the DB and S3 packages when used.

| Previously confirmed issue | Change and verification |
| --- | --- |
| CommonJS `require` entry points returned empty exports | Rollup emits `.cjs`; `package.json` points all three `require` exports there. A production-only packed consumer verified ESM and CommonJS `flite` exports. |
| Published TypeScript declarations failed NodeNext | Fixed invalid rest-parameter declarations and declaration-relative paths. `bun run test:types` and a strict NodeNext compile against the packed package pass. |
| Local storage followed pre-existing symlinks outside `basePath` | Reject symlinked parent and file components with `lstat`; use `O_NOFOLLOW` for final file opens on supported platforms. Regression tests cover read/write/delete attempts. Keep the storage directory inaccessible to untrusted local processes: path-based checks cannot fully prevent a concurrent parent-directory swap. |
| Default 500 responses disclosed internal exception messages | Default handler now returns `Internal Server Error` for 5xx while preserving 4xx messages and explicit custom error-hook behavior. Regression tests cover 500, 503, 400 and custom handling. |
| `bodyLimit` trusted `Content-Length` | It checks actual streamed bytes from a cloned request, including absent/forged headers, while preserving the original body for downstream handlers. An upstream server-level limit is still recommended for memory/connection protection. |
| Literal route punctuation acted as regexp syntax; custom matcher skipped after hooks | Route literals are escaped (while parameter/wildcard syntax remains); matcher results now pass through the same after-hook and formatting path. Tests cover both. |
| Default rate limiting trusted caller-supplied forwarding headers | It no longer reads these headers by default. Requests share an `unknown` bucket until an application supplies a trusted `keyGenerator`; the README documents the proxy boundary. Multi-instance installations still need a shared rate-limit store. |
| README quick starts imported nonexistent `json` from `uflite/lite` | Lite examples use `Response.json`, optional-install commands and test commands are explicit, and measured bundle sizes were refreshed. |

## Verification after changes

- `bun install --frozen-lockfile`: pass (Bun 1.4.3).
- `bun run build`: pass; Rollup still warns about mixed default/named exports (the CJS and ESM package smoke tests pass despite the warning).
- `bun test`: **701 passed, 0 failed, 1,019 assertions, 21 files**.
- `bun run test:types`: pass.
- `bun run test:package`: pass; a packed, production-only consumer imports the dependency-free entries and passes strict NodeNext compilation, while a separate consumer imports `uflite/services/db` after installing just `umosql`.
- `bun run bench:size`: pass; README sizes match Bun 1.4.3 measurements.
- CI now freezes the Bun lockfile, pins Bun and runs the type and packed-consumer checks after building.

## Still to decide / validate before a broad production claim

1. **Deployment matrix:** no real Cloudflare Workers or Deno deployment, S3-compatible provider, persistent database, or real browser UI was smoke-tested here. Tests use mock/in-memory integrations; test the actual production topology, including authentication on all exposed service REST routes.
2. **Storage threat model:** rejecting symlinks is effective against pre-existing links and `O_NOFOLLOW` protects final-component opens, but Node's path APIs cannot atomically anchor *all* path components against another local process swapping a parent after validation. Use a trusted, non-world-writable storage root, or a platform mechanism with directory-relative opens for a hostile-filesystem threat model.
3. **Rate limit scaling:** the built-in limiter is in-process; use a trusted `keyGenerator` and shared store/upstream limiter for a distributed or multi-tenant production deployment. The README's raw browser `<script type="module">` snippets still need a bundler or import map, and the React snippet recreates the root on navigation.
4. **Service lifecycle:** `plugins.js` still invokes potentially asynchronous `setup`/`teardown` without awaiting them. An async lifecycle API needs an explicit compatibility decision and tests before relying on it for critical startup/shutdown work.
5. **Security/dependency triage:** the earlier `bun audit --json` returned nonzero advisories for dev/test tooling (Hono, Rollup, serialize-javascript). Triage or update those before release; they do not establish exposure in the dependency-free core. The README now matches the package's `ISC` metadata, but the project has no top-level license text; confirm the license with the owner and include the correct file before publishing.

**Decision:** the directly reproduced blockers have regression fixes, but this is not a blanket production certification. Release only after the remaining deployment, license, and operational checks are resolved for the intended environment.
