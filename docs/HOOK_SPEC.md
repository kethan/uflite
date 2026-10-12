# uflite/hooks — practical hook and utility cookbook

> **Goal:** copy an example, change the application-specific names, and understand exactly what the hook does before shipping it.

This document covers every exported middleware hook, predicate, transformer, and field-resolver helper in uflite. Examples use JavaScript ESM and real application scenarios. When a database, authentication system, Redis client, event bus, or queue is application-provided, that dependency is called out explicitly rather than simulated by uflite.

## Contents

- [Install and understand the execution contract](#install-and-understand-the-execution-contract)
- [A realistic create/update service](#a-realistic-createupdate-service)
- [Hooks: flow control](#hooks-flow-control)
- [Hooks: data and query shaping](#hooks-data-and-query-shaping)
- [Hooks: authentication and authorization](#hooks-authentication-and-authorization)
- [Hooks: results](#hooks-results)
- [Hooks: lifecycle and operations](#hooks-lifecycle-and-operations)
- [Predicates: reusable conditions](#predicates-reusable-conditions)
- [Transformers: reusable data conversion](#transformers-reusable-data-conversion)
- [Resolvers: fields, relations, and computed values](#resolvers-fields-relations-and-computed-values)
- [Production checklist](#production-checklist)

---

## Install and understand the execution contract

```sh
npm install uflite
```

If using the field resolver helpers with `uresolver`, install that separately:

```sh
npm install uresolver
```

Import hooks from `uflite/hooks` and utilities from their subpaths:

```js
import { requireAuth, requireFields, transformResult } from 'uflite/hooks';
import * as p from 'uflite/predicates';
import * as t from 'uflite/transformers';
import * as r from 'uflite/resolvers';
```

### Mode 0 and mode 1

uflite owns execution. In mode 0 it calls a hook with `context` and advances to the next hook itself. In mode 1 it calls a hook with `context, next`; a hook that continues calls `next()`. These helpers support both modes and do not accept a `mode` option. Do not call hooks manually in production as a replacement for registering them with uflite.

### One error configuration

A rejecting hook accepts this common shape:

```js
const options = {
  error: {
    message: 'A message appropriate for this API',
    status: 422,
    code: 'VALIDATION_FAILED'
  }
};
```

Hooks with multiple failure reasons also accept `errors`, keyed by reason. `errors[reason]` overrides `error` field by field; unspecified fields fall back to the shared configuration and then the hook's default. `message` can be an async function `(context, details) => string`.

```js
requireFields(['email'], {
  error: { status: 422, code: 'INVALID_INPUT' },
  // The callback receives the list of missing fields from this hook.
  // The message is resolved asynchronously if necessary.
  // message: async (_context, { fields }) => `Missing: ${fields.join(', ')}`
});
```

Validation/authorization errors use uflite's existing `status` error class. This package does not introduce an error class, hook runner, or alternate resolver engine. Invalid programmer configuration (for example, an unsafe property path) may throw `TypeError` rather than an HTTP-style error.

---

## A realistic create/update service

This example shows the usual responsibilities split across hooks. `app`, service storage, authentication middleware, and `loadOriginalRecord` are application code; the package does not create them for you.

```js
import { flite } from 'uflite';
import {
  requireAuth, requireFields, setDefaults, setField,
  pickDataFields, validateData, transformData, preventChanges,
  auditFields, requireOwner, transformResult, omitResultFields
} from 'uflite/hooks';
import * as t from 'uflite/transformers';

const app = flite({ mode: 0 }); // choose mode 1 here if that is your application's configuration
const products = app.service('products', {
  async create(data) {
    // Replace with your actual database insert.
    return { id: 'prod_123', ...data, passwordHash: 'never-return-this' };
  },
  async patch(id, data) {
    // Replace with a real read/update implementation. The example expects
    // application code to load the existing record into context.original.
    return { id, ...data };
  }
});

products.hooks({
  before: {
    create: [
      requireAuth(),
      pickDataFields(['name', 'sku', 'price', 'description']),
      requireFields(['name', 'sku', 'price']),
      transformData(t.pipe(
        t.trimStrings({ fields: ['name', 'sku', 'description'] }),
        t.mapFields({ sku: sku => sku.toUpperCase() })
      )),
      validateData(data => {
        const errors = [];
        if (typeof data.price !== 'number' || data.price < 0) errors.push('price must be a non-negative number');
        if (typeof data.name !== 'string' || data.name.length < 2) errors.push('name must have at least 2 characters');
        return errors;
      }, { error: { message: 'Product data is invalid', status: 422, code: 'INVALID_PRODUCT' } }),
      setDefaults({ description: '' }),
      setField('createdBy', ctx => ctx.params.user.id),
      auditFields()
    ],
    patch: [
      requireAuth(),
      // The application must load the trusted original record before this hook.
      preventChanges(['id', 'createdBy', 'createdAt']),
      requireOwner({ ownerField: 'createdBy' }),
      pickDataFields(['name', 'price', 'description']),
      auditFields()
    ]
  },
  after: {
    create: [omitResultFields(['passwordHash'])],
    patch: [transformResult(result => ({ ...result, updated: true }))]
  }
});
```

**Important:** adapt the `flite` construction and service methods to your installed uflite API and persistence layer. Ownership checks only work when the trusted record is loaded before the check. Result filtering is defense-in-depth for response shape, not a substitute for authorization.

---

# Hooks: flow control

## `iff(predicate, ...hooks)` and `unless(predicate, ...hooks)`

Run nested hooks only when the predicate is true (`iff`) or false (`unless`). The predicate receives the **uflite context** and may be async. Nested hooks are invoked as atomic `(context)` functions; this is not a nested middleware composer.

**Use case — only add defaults for creates; strip client-only debug data unless an internal request is trusted:**

```js
import { iff, unless, setDefaults, removeFields } from 'uflite/hooks';

const createDefaults = iff(
  ctx => ctx.method === 'create',
  setDefaults({ status: 'draft', visibility: 'private' })
);

const stripDebug = unless(
  ctx => ctx.params?.trustedInternalRequest === true,
  removeFields(['debug', 'internalComment'])
);
```

**Caution:** `trustedInternalRequest` must be set by trusted server-side middleware, never copied from user input.

## `throwIf(predicate, options = {})`

Reject when the predicate returns a truthy value. Defaults: message `Operation rejected`, status `400`, code `BAD_REQUEST`.

**Use case — reject an order whose requested quantity exceeds the customer's available allowance:**

```js
import { throwIf } from 'uflite/hooks';

throwIf(
  async ctx => ctx.data.quantity > await getRemainingOrderAllowance(ctx.params.user.id),
  {
    error: {
      message: 'The order exceeds your available allowance',
      status: 422,
      code: 'ORDER_ALLOWANCE_EXCEEDED'
    }
  }
);
```

`getRemainingOrderAllowance` is an application function. Ensure the allowance check and final reservation are transactionally safe if concurrent requests could overspend it.

## `disallow(options = {})`

Always reject. Useful for disabling an operation explicitly while keeping the decision visible in the hook list.

```js
import { disallow } from 'uflite/hooks';

// Register on the relevant service method while an operation is disabled.
disallow({
  error: {
    message: 'Bulk deletion is temporarily disabled',
    status: 403,
    code: 'BULK_DELETE_DISABLED'
  }
});
```

## `setData(value)` and `setResult(value)`

Replace `context.data` or `context.result`. `value` can be a literal or an async function receiving context. These hooks do not skip the service operation.

```js
import { setData, setResult } from 'uflite/hooks';

// Build trusted input for a service operation. Do not blindly trust client fields.
setData(ctx => ({
  accountId: ctx.params.user.accountId,
  action: ctx.data.action,
  source: 'public-api'
}));

// Replace an after-hook result with a stable public response shape.
setResult(ctx => ({ id: ctx.result.id, accepted: true }));
```

Use `setResult` only at a lifecycle point where replacing the result is intended; a before hook's result may later be replaced by the service method.

---

# Hooks: data and query shaping

## `requireFields(fields, options = {})`

Checks field paths on `target` (default `data`). `undefined`, `null`, and empty strings are missing unless `allowEmpty: true`. Supports dotted paths. Failure details include `fields`, the missing field paths.

**Use case — validate a customer registration payload:**

```js
import { requireFields } from 'uflite/hooks';

requireFields(['email', 'profile.firstName', 'profile.lastName'], {
  error: {
    message: (_ctx, { fields }) => `Please provide: ${fields.join(', ')}`,
    status: 422,
    code: 'REGISTRATION_FIELDS_REQUIRED'
  }
});
```

## `setDefaults(defaults, { target = 'data' } = {})`

Fill only fields whose current value is `undefined`; explicit `null` is preserved. Supports dotted paths. `defaults` may be an object or async function of context; each default value may also be a function of context.

```js
import { setDefaults } from 'uflite/hooks';

setDefaults({
  currency: 'INR',
  status: 'pending',
  requestedAt: async () => new Date().toISOString(),
  createdBy: ctx => ctx.params.user.id
});
```

Use this for defaults, not for security-sensitive values that clients can overwrite later. Use `setField` for values that must be assigned unconditionally.

## `setField(field, value, { target = 'data' } = {})`

Set one field path unconditionally. Dotted paths are supported; unsafe path segments such as `__proto__`, `prototype`, and `constructor` are rejected.

```js
import { setField } from 'uflite/hooks';

// Set actor identity from trusted auth context, not from submitted data.
setField('createdBy', ctx => ctx.params.user.id);
setField('metadata.requestSource', ctx => ctx.params?.source ?? 'api');
```

## `preventChanges(fields, options = {})`

Reject fields that the request attempts to change from the trusted original value. By default, reads `context.original`; set `original` if your app stores it elsewhere. A field is checked when the submitted value is not `undefined`. The original record must already have been loaded.

**Use case — prevent changing invoice ownership and issue date after creation:**

```js
import { preventChanges } from 'uflite/hooks';

preventChanges(['customerId', 'issuedAt', 'createdBy'], {
  original: ctx => ctx.original, // populate from your database before this hook
  error: {
    message: (_ctx, { fields }) => `These fields are immutable: ${fields.join(', ')}`,
    status: 400,
    code: 'IMMUTABLE_INVOICE_FIELDS'
  }
});
```

This compares values strictly. It is not a substitute for database-level constraints when writes can happen outside this service.

## `removeFields(fields, { target = 'data' } = {})`

Delete named fields from an object. Dotted paths are supported; arrays are not processed.

```js
import { removeFields } from 'uflite/hooks';

// Strip secrets or client-controlled metadata before persistence.
removeFields(['passwordHash', 'isAdmin', 'billing.internalNotes']);
```

Prefer `pickDataFields` when you know the fields a client is allowed to submit; an allowlist also drops unexpected fields introduced in the future.

## `pickDataFields(fields, { target = 'data' } = {})`

Replace an object with a shallow allowlist of top-level fields. Unknown fields are dropped. Arrays and non-object values are unchanged.

```js
import { pickDataFields } from 'uflite/hooks';

// Only allow a customer to edit these profile fields.
pickDataFields(['displayName', 'avatarUrl', 'locale', 'timezone']);
```

This is input shaping, not a complete authorization policy. Validate allowed values and field-level permissions separately.

## `validateData(validator, options = {})`

Call `await validator(value, context)`. Return `false` to reject, or a non-empty array to reject with that array included in error details. An empty array succeeds. Other return shapes are treated as success.

**Use case — validate a paid plan selection and billing cycle:**

```js
import { validateData } from 'uflite/hooks';

validateData(async (data, ctx) => {
  const errors = [];
  if (!['starter', 'team', 'business'].includes(data?.plan)) errors.push('plan is invalid');
  if (!['monthly', 'annual'].includes(data?.billingCycle)) errors.push('billingCycle is invalid');
  if (data?.plan === 'business' && !ctx.params?.user?.canPurchaseBusinessPlan) {
    errors.push('business plan is not available to this account');
  }
  return errors;
}, {
  error: {
    message: 'Please correct the subscription details',
    status: 422,
    code: 'INVALID_SUBSCRIPTION'
  }
});
```

Adapt external validation libraries to the documented return contract. Do not assume a schema library's result object will automatically cause rejection.

## `transformData(transform, { target = 'data' } = {})`

Replace the target with `await transform(currentValue, context)`. Your transformer should return the complete replacement value.

```js
import { transformData } from 'uflite/hooks';
import * as t from 'uflite/transformers';

transformData(t.pipe(
  t.trimStrings({ fields: ['title', 'description'] }),
  t.mapFields({ title: title => title.trim().replace(/\s+/g, ' ') }),
  t.omit(['clientDebug', 'temporaryUploadToken'])
));
```

## `preventEmptyData(options = {})`

Reject when the configured target is not a non-empty, non-array object. Useful for PATCH endpoints where an empty update should not silently succeed.

```js
import { preventEmptyData } from 'uflite/hooks';

preventEmptyData({
  error: {
    message: 'Send at least one field to update',
    status: 400,
    code: 'EMPTY_PATCH'
  }
});
```

## `setQueryDefaults(defaults, { target = 'params.query' } = {})`

Fill top-level query keys that are `undefined`; explicit values (including `null`) are preserved. `defaults` and individual values can be functions of context. The target must be an object or nullish; invalid target values throw `TypeError`.

```js
import { setQueryDefaults } from 'uflite/hooks';

// A list endpoint defaults to published records and a bounded page size.
setQueryDefaults({ status: 'published', $limit: 25, $skip: 0 });
```

A default `$limit` is not necessarily a maximum. Enforce a hard maximum separately in service/database logic.

## `pickQueryFields(fields, { target = 'params.query' } = {})`

Keep only the named top-level query keys; creates an empty query object if needed.

```js
import { pickQueryFields } from 'uflite/hooks';

// Avoid allowing arbitrary query operators to pass through from clients.
pickQueryFields(['status', 'category', 'createdBy', '$limit', '$skip', '$sort']);
```

This does not validate values or authorize access to the selected records. Allow only operators supported by your service and enforce a server-side page-size ceiling.

## `transformQuery(transform, { target = 'params.query' } = {})`

Replace the query with `await transform(query, context)`. The transformer must return a non-null, non-array object or a `TypeError` is thrown.

```js
import { transformQuery } from 'uflite/hooks';

transformQuery((query, ctx) => ({
  ...query,
  status: query.status ?? 'published',
  ...(ctx.params.user.role === 'admin' ? {} : { visibility: 'public' })
}));
```

The query condition shown here is only an example of shaping a list query. Enforce access control at the service/storage boundary too, especially for ID-based reads and mutations.

---

# Hooks: authentication and authorization

The examples assume authentication middleware has already attached a trusted user to `context.params.user`. Configure `getUser`, `getActor`, or `getPermissions` when your application uses another context shape.

## `requireAuth(options = {})`

Require a user. Default user lookup is `context.params.user`. Missing user produces status `401`, code `UNAUTHENTICATED`.

```js
import { requireAuth } from 'uflite/hooks';

requireAuth({
  error: {
    message: 'Sign in before managing your saved addresses',
    status: 401,
    code: 'LOGIN_REQUIRED'
  }
});
```

## `requireRole(roles, options = {})`

Require at least one matching role. `roles` can be a string or array. Default role field is `user.role`; the actual role can also be an array. Missing user is an unauthenticated failure; a logged-in user without a matching role is forbidden.

```js
import { requireRole } from 'uflite/hooks';

requireRole(['admin', 'support'], {
  roleField: 'roles', // this user model stores roles in user.roles
  error: { status: 403, code: 'STAFF_ONLY', message: 'Staff access is required' },
  errors: {
    unauthenticated: { message: 'Sign in to continue', status: 401, code: 'LOGIN_REQUIRED' }
  }
});
```

Use roles for broad job functions; use permissions when access needs to be granular.

## `requirePermission(permissions, options = {})`

By default, at least one listed permission must be present. Set `match: 'all'` to require every permission. Permissions can come from `context.params.permissions` or `context.params.user.permissions`, or from a custom async `getPermissions(context)`.

```js
import { requirePermission } from 'uflite/hooks';

// A report download needs both permissions.
requirePermission(['reports:read', 'reports:export'], {
  match: 'all',
  getPermissions: ctx => ctx.params.user.permissions,
  error: {
    message: 'Your account cannot export these reports',
    status: 403,
    code: 'REPORT_EXPORT_FORBIDDEN'
  }
});
```

## `requireOwner(options = {})`

Compare the actor ID with a trusted record's owner field. Defaults: owner field `userId`, actor from `user.id` or `user._id`, record from `context.original ?? context.result`. Missing actor is a 401 failure; missing record or mismatched owner is a 403 failure.

**Use case — only the author can edit a saved draft:**

```js
import { requireOwner } from 'uflite/hooks';

requireOwner({
  ownerField: 'authorId',
  getActor: ctx => ctx.params.user.id,
  getRecord: ctx => ctx.original, // must be loaded from trusted storage before this hook
  errors: {
    forbidden: { message: 'Only the author can edit this draft', status: 403, code: 'DRAFT_NOT_OWNED' }
  }
});
```

This is a record check, not a database query. For updates, load the record before checking and ensure the actual write cannot race around the authorization check.

## `scopeToActor(options = {})`

Overwrite a query field with the trusted actor ID. Defaults to `query.userId` and actor ID from `user.id`/`user._id`. A custom `getQuery(context)` can provide a different query object.

```js
import { scopeToActor } from 'uflite/hooks';

// The caller may request a status or date range, but cannot choose another owner.
scopeToActor({
  field: 'ownerId',
  getActor: ctx => ctx.params.user.id,
  error: { message: 'Sign in to access your records', status: 401, code: 'LOGIN_REQUIRED' }
});
```

**Critical limitation:** this only affects operations that actually use the scoped query. It does not secure `get(id)` or an update by ID by itself. Enforce ownership in those service methods or in the storage query/transaction.

## `requireMethod(methods, options = {})`

Allow only the named `context.method` values. A string or array is accepted. Defaults to status `405`, code `METHOD_NOT_ALLOWED`.

```js
import { requireMethod } from 'uflite/hooks';

// Example for a service that should be read-only through this route.
requireMethod(['find', 'get'], {
  error: { message: 'This endpoint is read-only', status: 405, code: 'READ_ONLY' }
});
```

Register it only on the relevant service/route hook list; a global registration would also reject writes elsewhere.

## `rateLimit(consume, options = {})`

`consume(key, { limit, windowMs, context })` is an injected function. It may be async and must return either a boolean or `{ allowed, retryAfter? }`. The hook does **not** provide Redis, persistence, atomicity, a key store, or a response header. The default key is user ID, then `context.params.ip`, then `anonymous`; configure a trusted key explicitly for your deployment.

### Production-oriented Redis example (Node Redis v4)

Install Redis client separately:

```sh
npm install redis
```

Create a shared Redis client at application startup and use an atomic Lua script so concurrent workers increment/check the same counter without a race. This example implements a fixed window, not a sliding window or token bucket.

```js
import { createClient } from 'redis';
import { rateLimit } from 'uflite/hooks';

const redis = createClient({ url: process.env.REDIS_URL });
redis.on('error', error => console.error('Redis client error', error));
await redis.connect(); // do this once during startup, not for every request

const consumeScript = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then
    redis.call('PEXPIRE', KEYS[1], ARGV[2])
  end
  local ttl = redis.call('PTTL', KEYS[1])
  local limit = tonumber(ARGV[1])
  if count <= limit then
    return { 1, count, ttl }
  end
  return { 0, count, ttl }
`;

async function consumeRedisLimit(key, { limit, windowMs }) {
  // Keep a namespace and bounded expiry on every counter key.
  const redisKey = `rate-limit:v1:${key}`;
  const [allowed, count, ttlMs] = await redis.eval(consumeScript, {
    keys: [redisKey],
    arguments: [String(limit), String(windowMs)]
  });

  return {
    allowed: Number(allowed) === 1,
    // This example reports retryAfter in milliseconds; the hook attaches this
    // value to the thrown uflite error but does not convert it to an HTTP header.
    retryAfter: Math.max(0, Number(ttlMs)),
    count: Number(count)
  };
}

const limitProductSearch = rateLimit(consumeRedisLimit, {
  key: ctx => {
    const userId = ctx.params?.user?.id;
    // `params.ip` must be supplied by trusted server/proxy middleware.
    const ip = ctx.params?.ip;
    return userId ? `user:${userId}:product-search` : `ip:${ip ?? 'unknown'}:product-search`;
  },
  limit: 60,
  windowMs: 60_000,
  error: {
    message: 'Too many product searches. Wait before trying again.',
    status: 429,
    code: 'PRODUCT_SEARCH_RATE_LIMITED'
  }
});

// Register `limitProductSearch` before the expensive find/search operation.
```

**Operational notes:**

- Redis counters are shared across application instances, unlike an in-memory `Map`.
- The Lua script makes increment + first expiry assignment atomic. It is a fixed-window limiter; choose another algorithm if you need sliding-window or token-bucket behavior.
- The key includes a route/action suffix so one endpoint does not consume another endpoint's quota.
- If the client is behind a proxy, derive IP only from correctly configured trusted-proxy middleware. Never trust an arbitrary user-supplied `X-Forwarded-For` value.
- Redis errors propagate by default. Decide deliberately whether your system should fail open or fail closed; do not silently swallow store failures without an explicit policy.
- `retryAfter` is attached to the error when provided. If clients need `Retry-After`, translate it in your application's error/HTTP response layer and use the units your API contract specifies.
- Consider Redis ACLs, TLS, connection lifecycle, metrics, key cardinality, and the behavior during Redis failover before deploying.

---

# Hooks: results

Result hooks usually belong in an `after` hook list. They change the result value but do not authorize access to the underlying data.

## `transformResult(transform, { target = 'result' } = {})`

Replace the target with `await transform(currentValue, context)`.

```js
import { transformResult } from 'uflite/hooks';

// Derive a display field after the record has been fetched.
transformResult((result, ctx) => ({
  ...result,
  displayName: result.name?.trim() || 'Unnamed',
  requestedBy: ctx.params?.user?.id
}));
```

Do not expose the actor or other internal context fields unless the response contract intentionally includes them.

## `pickResultFields(fields, options)`

Keep only the named top-level fields on an object result. Arrays and primitives are unchanged; for an array of records, use `mapResult` with an allowlist transformation.

```js
import { pickResultFields } from 'uflite/hooks';

// Public profile endpoint: never include internal moderation or credential fields.
pickResultFields(['id', 'displayName', 'avatarUrl', 'joinedAt']);
```

## `omitResultFields(fields, options)`

Remove named top-level fields from an object result. Arrays and primitives are unchanged.

```js
import { omitResultFields } from 'uflite/hooks';

// Useful as a final response safeguard; do not rely on it as the only access control.
omitResultFields(['passwordHash', 'resetToken', 'internalNotes']);
```

For security-sensitive responses, an explicit allowlist (`pickResultFields`) is often safer than maintaining a growing denylist.

## `mapResult(mapper)`

Map an array result asynchronously with `mapper(item, context, index)`. For a non-array result, call the mapper once with the result as `item`.

```js
import { mapResult } from 'uflite/hooks';

mapResult(async (order, ctx, index) => ({
  id: order.id,
  total: order.total,
  position: index,
  canCancel: order.status === 'pending' && order.customerId === ctx.params.user.id
}));
```

This example adds a response field; the actual cancel operation must still enforce ownership and status at write time.

---

# Hooks: lifecycle and operations

## `auditFields(options = {})`

Set audit metadata on an object target (default `data`). On create it writes `createdAt`/`createdBy`; on non-create methods it removes creation metadata from incoming data and writes `updatedAt`/`updatedBy`. Options let you rename/disable fields and inject `now`, `getActor`, `isCreate`, or `target`. The service must persist the resulting data.

```js
import { auditFields } from 'uflite/hooks';

// Register before create/patch/update. The user is taken from trusted auth context.
auditFields({
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  createdBy: 'createdBy',
  updatedBy: 'updatedBy',
  now: () => new Date().toISOString(),
  getActor: ctx => ctx.params?.user?.id ?? ctx.params?.user?._id
});
```

If you use a custom schema, configure the field names explicitly. For bulk writes, ensure the target shape and actor policy are appropriate for every item.

## `publishEvent(publish, eventName, options = {})`

Call `await publish(eventName, payload, context)` when `when(context)` is truthy. Default payload is `context.result`; default condition is always true.

```js
import { publishEvent } from 'uflite/hooks';

// Application-provided eventBus.publish is expected to return a promise.
publishEvent(
  (name, payload, ctx) => eventBus.publish(name, payload, { requestId: ctx.params?.requestId }),
  'invoice.created',
  {
    when: ctx => ctx.method === 'create',
    payload: ctx => ({ invoiceId: ctx.result.id, customerId: ctx.result.customerId })
  }
);
```

This is a direct side effect, not a durable delivery guarantee. If the database write succeeds and publishing fails, the operation may report an error after the write has already happened. Use a transactional outbox or durable queue when delivery must survive process crashes.

## `sideEffect(effect, options = {})`

Run `await effect(context)`. On failure, call `onError(error, context)` if supplied; otherwise rethrow unless `ignoreError: true`. If `onError` itself throws, that error propagates.

```js
import { sideEffect } from 'uflite/hooks';

// Best-effort telemetry: failure is logged and deliberately does not fail the request.
sideEffect(
  ctx => telemetry.track('invoice.viewed', { invoiceId: ctx.result.id }),
  {
    ignoreError: true,
    onError: (error, ctx) => logger.warn({ error, invoiceId: ctx.result?.id }, 'Telemetry failed')
  }
);
```

For business-critical email, billing, or webhook delivery, prefer a durable queue/outbox over ignoring errors.

## `debug(logger = console, options = {})`

Log a label and selected context data. Default selection includes only method and path. Use `select` to keep logs small and avoid secrets.

```js
import { debug } from 'uflite/hooks';

// Avoid logging passwords, tokens, full request bodies, or personal data.
debug(logger, {
  label: 'orders.before-create',
  select: ctx => ({
    method: ctx.method,
    path: ctx.path,
    actorId: ctx.params?.user?.id,
    dataKeys: Object.keys(ctx.data ?? {})
  })
});
```

---

# Predicates: reusable conditions

Import predicates from `uflite/predicates`. A predicate tests a value and returns a boolean (or, for combinators, a promise of a boolean). Predicates do not mutate values. The examples use `p` as a namespace:

```js
import * as p from 'uflite/predicates';
```

## Type and value predicates

| Predicate | Meaning | Practical example |
|---|---|---|
| `isPresent(value)` | Not `null` or `undefined` | `p.isPresent(form.phone)` before optional persistence |
| `isNil(value)` | `null` or `undefined` | `p.isNil(record.deletedAt)` to identify a non-deleted record |
| `isString(value)` | String primitive | `p.isString(query.search)` before string operations |
| `isNumber(value)` | Finite number | `p.isNumber(invoice.total)`; rejects `NaN` and infinities |
| `isInteger(value)` | Integer number | `p.isInteger(pagination.page)` |
| `isBoolean(value)` | Boolean primitive | `p.isBoolean(settings.emailEnabled)` |
| `isArray(value)` | Array | `p.isArray(data.lineItems)` |
| `isObject(value)` | Non-null object other than array | `p.isObject(data.profile)` |
| `isPlainObject(value)` | Plain object or null-prototype object | `p.isPlainObject(config)` before merging user settings |
| `isNonEmptyString(value)` | String with non-whitespace content | `p.isNonEmptyString(data.title)` |
| `isDefined(value)` | Anything except `undefined` (includes `null`) | `p.isDefined(options.limit)` to distinguish omitted from explicit `null` |
| `isEmpty(value)` | Nullish, empty string/array/Map/Set, or non-Date object with no enumerable keys | `p.isEmpty(data.tags)` before applying a fallback |
| `truthy(value)` | Boolean coercion | `p.truthy(featureFlag)` when coercion is intentionally desired |
| `falsy(value)` | Negated boolean coercion | `p.falsy(optionalSetting)` |

```js
import * as p from 'uflite/predicates';

const shouldUseFallback = p.isEmpty(user.preferences);
const validPage = p.all(p.isInteger, p.atLeast(1))(query.page);
const isOptionalPhoneProvided = p.isPresent(form.phone);
```

Note that `isEmpty('   ')` is false because the string is not length zero; use `isNonEmptyString` to check that a string contains non-whitespace characters.

## Format predicates

| Predicate | Meaning | Example |
|---|---|---|
| `isEmail(value)` | Pragmatic `name@domain.tld`-style check | `p.isEmail('ops@example.com')` |
| `isURL(value)` | Valid URL whose protocol is HTTP or HTTPS | `p.isURL('https://example.com/docs')` |
| `isUUID(value)` | Canonical UUID-like version/variant pattern | `p.isUUID(order.publicId)` |

```js
const validContact = p.all(p.isNonEmptyString, p.isEmail);
if (!(await validContact(form.email))) throw new Error('Invalid email');
```

These checks are not full standards validators. An email format check does not prove that the address exists or belongs to the user; URL checks do not establish that a destination is safe to fetch.

## Equality, membership, and patterns

| Predicate factory | What it returns | Realistic example |
|---|---|---|
| `equals(expected)` | `Object.is` equality test | `p.equals('published')(article.status)` |
| `notEquals(expected)` | Negated `Object.is` test | `p.notEquals('deleted')(record.status)` |
| `oneOf(values)` | Membership in a `Set` built from values | `p.oneOf(['draft', 'published'])(article.status)` |
| `includes(expected)` | String substring, array item, or Set membership | `p.includes('urgent')(ticket.labels)` |
| `matches(pattern, flags)` | String regular-expression test | `p.matches(/^[A-Z]{3}-\d+$/)(ticket.code)` |
| `hasAny(values)` | Any requested item exists in an array/Set | `p.hasAny(['admin', 'support'])(user.roles)` |
| `hasAll(values)` | Every requested item exists in an array/Set | `p.hasAll(['orders:read', 'orders:export'])(user.permissions)` |

```js
const canDownloadReport = p.hasAll(['reports:read', 'reports:export']);
const hasUrgentLabel = p.includes('urgent');
const isValidTicketCode = p.matches('^[A-Z]{3}-\\d+$');

if (!canDownloadReport(currentUser.permissions)) {
  throw new Error('Missing report permissions');
}
```

`matches` resets `lastIndex` before each test, so a global/sticky regular expression does not produce alternating results due to retained regex state.

## Numeric and length predicates

| Predicate | Meaning | Example |
|---|---|---|
| `greaterThan(n)` | `value > n` for numeric values | `p.greaterThan(0)(invoice.total)` |
| `atLeast(n)` | `value >= n` | `p.atLeast(18)(user.age)` |
| `lessThan(n)` | `value < n` | `p.lessThan(100)(cart.itemCount)` |
| `atMost(n)` | `value <= n` | `p.atMost(100)(query.$limit)` |
| `between(min, max, options)` | Inclusive by default; `{ inclusive: false }` makes both bounds exclusive | `p.between(1, 5)(rating)` |
| `lengthAtLeast(n)` | String/array length at least `n` | `p.lengthAtLeast(8)(password)` |
| `lengthAtMost(n)` | String/array length at most `n` | `p.lengthAtMost(200)(data.title)` |

```js
const validPassword = p.all(p.isString, p.lengthAtLeast(12), p.lengthAtMost(128));
const validQuantity = p.all(p.isInteger, p.between(1, 50));
const safePageSize = p.all(p.isInteger, p.atLeast(1), p.atMost(100));
```

Numeric comparison predicates check that the input is a number; they do not coerce numeric strings. `isInteger` follows `Number.isInteger` and therefore returns false for a string such as `'3'`.

## Nested paths

| Predicate factory | Meaning | Example |
|---|---|---|
| `hasPath(path)` | Path resolves to a value other than `undefined` | `p.hasPath('profile.address.city')(user)` |
| `pathEquals(path, expected)` | Path value is `Object.is`-equal to expected | `p.pathEquals('billing.currency', 'INR')(account)` |
| `pathMatches(path, predicate)` | Passes path value and original object to predicate | `p.pathMatches('items', p.isArray)(cart)` |

```js
const hasVerifiedEmail = p.pathEquals('security.emailVerified', true);
const hasCity = p.pathMatches('profile.address.city', p.isNonEmptyString);
if (!hasVerifiedEmail(account)) throw new Error('Verify your email first');
```

## Async composition and context adapters

| Helper | Behavior | Example |
|---|---|---|
| `all(...predicates)` | Every predicate must pass; stops at first failure | `p.all(p.isString, p.isNonEmptyString)` |
| `any(...predicates)` | At least one predicate must pass; stops at first success | `p.any(p.equals('admin'), p.equals('owner'))` |
| `not(predicate)` | Negates a sync/async predicate | `p.not(p.isEmpty)` |
| `when(predicate, yes, no)` | Runs and returns the selected branch's result; default `no` returns false | `p.when(p.isNumber, n => n * 2)` |
| `contextPredicate(predicate, { select })` | Adapts a context predicate by selecting the value to test; default selector returns context | `p.contextPredicate(p.isNonEmptyString, { select: ctx => ctx.data.name })` |

```js
const maySeeDrafts = p.contextPredicate(
  p.any(p.equals('admin'), p.equals('editor')),
  { select: ctx => ctx.params?.user?.role }
);

const validAddress = p.all(
  p.isPlainObject,
  p.pathMatches('city', p.isNonEmptyString),
  p.pathMatches('postalCode', p.isNonEmptyString)
);

const priceWithTax = p.when(
  p.greaterThan(0),
  async price => price * 1.18,
  () => 0
);
```

`all`, `any`, `not`, `when`, and `contextPredicate` can await async predicates. These helpers are conditions, not authorization middleware; use a rejecting hook and enforce access in the service layer when a request must be blocked.

---

# Transformers: reusable data conversion

Import from `uflite/transformers`. Transformers return converted values; most are pure and return a new object when transforming records. Use `pipe`/`compose` to run multiple transforms left-to-right, awaiting each one.

```js
import * as t from 'uflite/transformers';
```

## Composition and strings

| Transformer | Behavior | Example |
|---|---|---|
| `identity` | Return input unchanged | `t.identity(input)` when a configurable transform is optional |
| `compose(...transformers)` / `pipe(...)` | Apply transforms left-to-right, awaiting each result | `t.pipe(t.trimString, t.lowercase)` |
| `trimString` | Trim string edges; leave non-strings unchanged | `t.trimString('  hello  ')` → `'hello'` |
| `lowercase` | Lowercase strings; leave other values unchanged | `t.lowercase('HELLO')` → `'hello'` |
| `uppercase` | Uppercase strings; leave other values unchanged | `t.uppercase('inr')` → `'INR'` |
| `normalizeEmail` | Trim and lowercase strings | `t.normalizeEmail(' Alice@Example.COM ')` → `'alice@example.com'` |
| `normalizeWhitespace` | Trim and collapse repeated whitespace | `t.normalizeWhitespace('  Product   name ')` → `'Product name'` |
| `slugify` | Unicode-normalize, lowercase, and replace non-ASCII alphanumeric runs with hyphens | `t.slugify('Hello World!')` → `'hello-world'` |

```js
const normalizeProductName = t.pipe(t.normalizeWhitespace, t.slugify);
const slug = await normalizeProductName('  Limited   Edition Lamp  '); // 'limited-edition-lamp'
```

`slugify` is intentionally simple and produces ASCII slugs; if your language or product requires a different transliteration policy, supply your own transformer.

## Numeric, boolean, and JSON conversion

| Transformer | Behavior | Example |
|---|---|---|
| `toNumber(value, { strict })` | Converts numeric input/string; preserves null/empty; invalid value is preserved unless strict | `t.toNumber('19.95')` → `19.95` |
| `toInteger(value, { strict })` | Converts only if result is an integer; invalid value is preserved unless strict | `t.toInteger('12')` → `12` |
| `toBoolean(value, { strict })` | Recognizes booleans, `0/1`, `'0'/'1'`, `'true'/'false'` case-insensitively | `t.toBoolean('false')` → `false` |
| `parseJSON(value, { strict })` | Parses strings as JSON; invalid JSON is preserved unless strict | `t.parseJSON('{"enabled":true}')` → `{ enabled: true }` |

```js
const parseSearchParams = t.mapFields({
  page: value => t.toInteger(value, { strict: true }),
  includeArchived: value => t.toBoolean(value, { strict: true })
});

const parsed = await parseSearchParams({ page: '2', includeArchived: 'false' });
// { page: 2, includeArchived: false }
```

Strict conversion failures throw. Non-strict mode preserves invalid values rather than silently guessing a replacement; validate the result if invalid input must be rejected.

## Record shaping

| Transformer | Behavior | Example |
|---|---|---|
| `pick(keys)` | Shallow allowlist of object keys | `t.pick(['id', 'name'])(user)` |
| `omit(keys)` | Shallow exclusion of object keys | `t.omit(['passwordHash'])(user)` |
| `renameFields(mapping)` | Rename present top-level fields | `t.renameFields({ _id: 'id' })(record)` |
| `mapFields(mapping)` | Apply async transformers to existing top-level fields; each gets `(fieldValue, originalObject)` | `t.mapFields({ email: t.normalizeEmail })(user)` |
| `trimStrings(options)` | Trim strings in selected fields, or direct string fields if `fields` omitted; `recursive: true` descends | `t.trimStrings({ recursive: true })(input)` |
| `removeEmpty(options)` | Shallowly remove configured empty values | `t.removeEmpty({ removeNull: true, removeEmptyArrays: true })(record)` |
| `setDefaults(defaults)` | Fill top-level `undefined` properties only; fallback functions receive original input | `t.setDefaults({ locale: 'en', ownerId: user => user.createdBy })(record)` |

```js
const normalizeRegistration = t.pipe(
  t.trimStrings({ fields: ['name', 'email'] }),
  t.mapFields({ email: t.normalizeEmail }),
  t.renameFields({ name: 'displayName' }),
  t.omit(['passwordConfirmation', 'marketingDebugFlag'])
);

const registration = await normalizeRegistration({
  name: '  Ada Lovelace ',
  email: ' ADA@EXAMPLE.COM ',
  passwordConfirmation: 'temporary',
  marketingDebugFlag: true
});
// { email: 'ada@example.com', displayName: 'Ada Lovelace' }
```

### `removeEmpty` options

All options default as shown:

```js
const cleanPatch = t.removeEmpty({
  removeNull: false,          // keep explicit null unless you choose otherwise
  removeEmptyStrings: true,  // default: remove ''
  removeEmptyArrays: true,
  removeEmptyObjects: true
});
```

This operation is shallow; nested objects are not recursively cleaned. Be careful with PATCH semantics: deleting a null or empty value may prevent a client from intentionally clearing a field.

## Arrays and nested paths

| Transformer | Behavior | Example |
|---|---|---|
| `mapArray(transformer)` | Async-map array items; non-arrays pass through unchanged | `t.mapArray(item => ({ ...item, label: item.name }))` |
| `updatePath(path, transformer)` | Return a record with one nested path transformed; uses a copy along the updated path | `t.updatePath('profile.name', t.normalizeWhitespace)(user)` |

```js
const enrichLineItems = t.mapArray(async item => ({
  ...item,
  sku: t.uppercase(item.sku),
  quantity: t.toInteger(item.quantity, { strict: true })
}));

const updated = await enrichLineItems([
  { sku: ' lamp-01 ', quantity: '2' },
  { sku: ' chair-02 ', quantity: '1' }
]);

const normalizeProfileName = t.updatePath('profile.name', t.normalizeWhitespace);
const profile = normalizeProfileName({ profile: { name: '  Ada   Lovelace ' }, active: true });
```

`updatePath` leaves non-record inputs unchanged and rejects unsafe path segments. `mapArray` does not turn a non-array into a one-item array; it returns the non-array unchanged.

---

# Resolvers: fields, relations, and computed values

Import helpers from `uflite/resolvers`. These helpers implement the field-resolver signature `(value, object, context)` for use with `uresolver`. They do **not** implement `resolve` or `virtual`; import those from `uresolver` itself.

```js
import { resolve, virtual } from 'uresolver';
import * as r from 'uflite/resolvers';
```

The following examples show resolver functions and a composed resolver. Exact invocation depends on your installed `uresolver` API. Relations should be bounded and authorized by the service/domain layer; resolver helpers are not an authorization boundary.

## Current value, object path, and resolver context

| Helper | Behavior | Example |
|---|---|---|
| `value()` | Return the current field value | `status: r.value()` |
| `fromPath(path, { fallback })` | Read a path from the source object; fallback applies when result is `undefined` | `displayName: r.fromPath('profile.name', { fallback: 'Unknown' })` |
| `fromContext(path, { fallback })` | Read a path from resolver context; fallback applies when result is `undefined` | `requestedBy: r.fromContext('user.id')` |
| `fallback(defaultValue)` | Use default when current value is `null` or `undefined`; function defaults are called with no arguments | `title: r.fallback('Untitled')` |
| `mapValue(mapper)` | Call mapper with `(current, object, context)` | `totalLabel: r.mapValue((total) => total.toFixed(2))` |

```js
const productResolver = resolve({
  id: r.fromPath('_id'),
  title: r.fromPath('title', { fallback: 'Untitled product' }),
  ownerId: r.fromPath('ownerId'),
  requestedBy: r.fromContext('user.id', { fallback: null }),
  currency: r.fallback('INR'),
  priceLabel: r.mapValue((price, product) => `${product.currency ?? 'INR'} ${Number(price).toFixed(2)}`)
});
```

## Lookups and relations

| Helper | Behavior | Example |
|---|---|---|
| `lookup(fetchOne, { key, fallback })` | Derive a lookup key, call injected async/sync `fetchOne(key, object, context)`, and use fallback for a nullish key or an `undefined` result | `r.lookup((id) => users.findById(id))` |
| `relation(fetchOne, options)` | Alias-style helper for lookup-based relations with the same key/fallback behavior | `r.relation((id, _post, ctx) => ctx.services.users.get(id))` |
| `relationMany(fetchMany, { key })` | Derive an array of keys and call `fetchMany(ids, object, context)` once; non-array/empty keys produce `[]` | `r.relationMany((ids) => users.findMany(ids), { key: post => post.authorIds })` |

```js
const postResolver = resolve({
  id: r.fromPath('_id'),
  title: r.fromPath('title'),
  author: r.relation(
    async (authorId, _post, ctx) => ctx.services.users.getPublicById(authorId),
    { key: post => post.authorId, fallback: null }
  ),
  relatedAuthors: r.relationMany(
    async (authorIds, _post, ctx) => ctx.services.users.findPublicByIds(authorIds),
    { key: post => post.relatedAuthorIds }
  )
});
```

`getPublicById` and `findPublicByIds` above are application methods, not package APIs. Prefer a batch lookup for many related records to avoid N+1 database queries. Apply authorization and tenant scoping inside those lookup methods. Never fetch an unbounded list of related records just to resolve a field.

## Conditional resolution, redaction, and arrays

| Helper | Behavior | Example |
|---|---|---|
| `resolveIf(predicate, resolver, { otherwise })` | Resolve conditionally; `otherwise` can be a value or callback | `r.resolveIf((_v, user, ctx) => ctx.user?.id === user.ownerId, r.fromPath('privateNote'), { otherwise: null })` |
| `omitIf(predicate)` | Return `undefined` when predicate matches; `uresolver` omits fields whose resolver returns `undefined` | `internalNotes: r.omitIf((_v, user, ctx) => !ctx.user?.isStaff)` |
| `redactIf(predicate, replacement = null)` | Replace matching values; replacement may be a callback | `email: r.redactIf((_v, user, ctx) => !ctx.user?.canViewEmail, '[redacted]')` |
| `mapArray(resolver)` | Resolve each array item asynchronously; callback receives item, source object, and context extended with `index` | `labels: r.mapArray(r.mapValue(label => label.toUpperCase()))` |

```js
const accountResolver = resolve({
  id: r.fromPath('_id'),
  email: r.redactIf(
    (_email, account, ctx) => ctx.user?.id !== account.userId && !ctx.user?.permissions?.includes('users:email:read'),
    '[redacted]'
  ),
  internalNotes: r.omitIf((_value, _account, ctx) => !ctx.user?.isStaff),
  privateMemo: r.resolveIf(
    (_value, account, ctx) => ctx.user?.id === account.userId,
    r.fromPath('privateMemo'),
    { otherwise: null }
  ),
  tags: r.mapArray(r.mapValue(tag => String(tag).toUpperCase()))
});
```

These examples demonstrate output shaping only. Do not rely on a resolver predicate as the only authorization check: enforce access before fetching the underlying record or relation.

## Array and aggregate helpers

| Helper | Behavior | Example |
|---|---|---|
| `join(separator = ' ')` | Join array elements; non-arrays pass through | `r.join(', ')` for tags |
| `count()` | Return array/string length; otherwise `0` | `r.count()` for comment count |
| `sum()` | Sum numeric items in an array; non-numeric items are ignored; non-arrays return `0` | `r.sum()` for numeric line totals |
| `pluck(field)` | Map an array to each item's named property; non-arrays pass through | `r.pluck('name')` |

```js
// A field resolver receives that field's current value as its first argument.
// Use `virtual` when a derived field must read another field from the source object.
const userSummaryResolver = resolve({
  tags: r.value(),
  tagCount: virtual(user => r.count()(user.tags)),
  tagList: virtual(user => r.join(', ')(user.tags)),
  tagNames: virtual(user => r.pluck('name')(user.tagObjects ?? [])),
  totalSpent: virtual(user => r.sum()((user.purchases ?? []).map(purchase => purchase.amount)))
});
```

`join`, `count`, `sum`, and `pluck` operate on the field's current value. They do not automatically look up another field on the parent object. Use `virtual` from `uresolver` for a computed field that needs access to the full source object.

---

# Production checklist

Before deploying these examples, confirm each item that applies to your service:

- [ ] Register middleware on the intended service methods and lifecycle stage (`before` vs `after`).
- [ ] Confirm mode 0 or mode 1 is configured on uflite, and test hooks through the actual service pipeline in that mode.
- [ ] Ensure authentication data is added by trusted server middleware, not copied from request bodies or query parameters.
- [ ] Load trusted original records before `preventChanges`/`requireOwner`; enforce ownership at the actual write boundary too.
- [ ] Use allowlists for client-supplied fields and validate data after normalization.
- [ ] Set a hard maximum for pagination in service/database logic; query defaults alone are not a hard limit.
- [ ] Use shared atomic storage (for example Redis) for rate limits across multiple workers; choose and document the failure policy.
- [ ] Use a durable outbox/queue for business-critical event delivery.
- [ ] Avoid logging credentials, tokens, full payloads, or unnecessary personal data.
- [ ] Keep resolver relation queries bounded, batch where possible, and authorize them in the service/domain layer.
- [ ] Test missing/null/empty inputs, async callbacks, error overrides, and both uflite hook modes.

## What this package intentionally does not do

This package supplies reusable generic hooks and helpers. It does not create authentication middleware, database queries, Redis clients, transactions, durable queues, a hook runner, or `uresolver.resolve`/`virtual`. Those responsibilities remain with the application or their respective libraries.
