# Useful use cases and roadmap

This package contains generic building blocks, not product-specific policy. The hook list intentionally avoids organization/app/tenant-specific names.

## Included high-value patterns

| Use case | Building blocks |
|---|---|
| Reject incomplete create data | `requireFields`, `validateData` |
| Normalize strings and emails | `transformData`, `transformers/compose`, `trimStrings`, `normalizeEmail` |
| Prevent mass assignment | `pickDataFields`, `removeFields`, `pick` |
| Apply trusted defaults | `setDefaults`, `setQueryDefaults`, transformer `setDefaults` |
| Protect immutable fields | `preventChanges` |
| Authenticate and authorize | `requireAuth`, `requireRole`, `requirePermission`, `requireOwner` |
| Restrict list query shape | `pickQueryFields`, `transformQuery` |
| Enforce actor scope | `scopeToActor`, plus storage-level ownership checks |
| Hide response fields | `pickResultFields`, `omitResultFields` |
| Resolve virtual/related fields | `uresolver.resolve`, `uresolver.virtual`, helpers under `/resolvers` |
| Add audit metadata | `auditFields` |
| Notify other systems | `publishEvent`, `sideEffect` |
| Protect an expensive endpoint | `rateLimit` with atomic injected store |
| Express reusable business conditions | `/predicates` combinators |
| Normalize and map arbitrary records | `/transformers` |

## Important future work (not implemented)

These need explicit storage/runtime contracts and should not be faked as context-only hooks.

1. **Idempotency** — injected atomic store; key scope, request hash, expiry, and replay semantics.
2. **Optimistic concurrency** — version field plus conditional writes at the storage boundary.
3. **Soft delete and restore** — coordinated query filtering, lifecycle semantics, and storage behavior.
4. **Atomic quotas** — atomic counters and well-defined consume/refund semantics.
5. **Durable event delivery/webhooks** — outbox/queue, retry policy, signatures, replay protection.
6. **Realtime authorization** — authorize subscription and event delivery, not only the initial request.
7. **Upload validation** — stream/file limits, content-type sniffing, scanning and quarantine.
8. **Cache** — key isolation, invalidation, mutation policy and error behavior.
9. **Request tracing** — integrate with the app's own request context and logger.
10. **Schema adapter** — optional adapters for Zod/Valibot/JSON Schema without making any one validator mandatory.

## Security reminders

- A query-scope hook only works if the service uses the scoped query for the actual operation.
- ID-based mutations require trusted-record checks or storage-level ownership predicates.
- Result filtering is not authorization.
- Side effects after a successful write can fail; use an outbox for guaranteed delivery.
- A process-local rate limiter is not correct for multi-worker deployments.
