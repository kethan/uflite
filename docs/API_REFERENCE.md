# Public API reference

This reference lists public package exports (including helper subpaths). `?` means optional; `→` indicates a returned function or value. JavaScript signatures are intentionally compact; the linked [declaration files](../src/index.d.ts) provide types. For runnable invocations, see the [README](../readme.md) and the five linked example projects.

### Entry points · routes · hooks

| Import | Constructor | What `fetch` returns |
| :--- | :--- | :--- |
| `uflite/nano` | `flite({ routes?, mode?: 0 \| 1, match? }?)` | `Promise<raw value \| undefined>` (declaration narrows to Response) |
| `uflite/lite` | `flite({ routes?, mode?, match?, before?, after?, error? }?)` | Result after global request hooks, or `undefined` |
| `uflite` | `flite({ routes?, mode?, match?, before?, after?, error?, format?, missing? }?)` | Usually a Response; default 404/format/error hook |

Each entry point also exports **default `flite`**. `routes` can be supplied as the app's route array; nano exposes it on `app.routes` (lite/full inherit this property).

```text
app.get/post/put/patch/delete/head/options/all(path, ...handlers) → app
app.GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS/ALL(path, ...handlers) → app
app.use(handler | router) / app.use(path, ...handlersOrRouters) → app
app.fetch(request: Request, ...adapterArgs) → Promise<result | undefined>
app.routes → registered route tuples
match({ method, path }) → { handlers, params? } | undefined
run(mode?: 0 | 1)(...handlers)(...args) → Promise<result | undefined>  // full export
```

`before` / `after` / `error` are dictionaries keyed by `all` or a **lowercase HTTP method**. Their handlers are `(req, ...args)`, `(result, req, ...args)`, `(err, req, ...args)`. Lite/full request hooks run before.all → before.method → route → after.method → after.all; a thrown request error instead runs error.method → error.all. A before hook can return a value to skip routing; after hooks can transform a result or supply a response for a miss. In mode 1 each hook must call `next()` to run the next hook in that phase. Error hooks are request hooks, distinct from service-context error hooks. `format(result)` controls full auto-formatting (`false` disables it); `missing()` controls the full fallback. If custom full `error` hooks are supplied, they replace the default.

When `match({method,path})` is supplied, nano bypasses its registered-route loop even if the custom matcher returns no handlers; lite/full fall back to registered routes if the matcher returns no handlers. Both return raw handler results unless full formatting is active.

### Responses · `uflite`

| Export | Signature | Behavior |
| :--- | :--- | :--- |
| `response` | `response(contentType?, transform?)(body, options?) → Response \| undefined` | Type + optional body transform; defaults to text/plain |
| `text` | `text(body, options?) → Response \| undefined` | Text content type |
| `html` | `html(body, options?) → Response \| undefined` | HTML content type |
| `json` | `json(body, options?) → Response \| undefined` | JSON stringify; `json(undefined)` returns `undefined` |
| `error` | `error(statusCode, messageOrObject?) → Response` or `error(err: Error) → Response` | JSON `{status,error}` / object details |
| `status` | `new status(code, message?, data?) → Error` | Throw for status-aware full error handling |

`options` accepts Fetch `ResponseInit` fields such as `status` and `headers`. Response helpers pass an existing **same-realm** `Response` through. Full defaults to `error(err.status || 500, err.message)`, **including 5xx messages**. Install an application error hook to redact internal errors.

### HTTP middleware · `uflite/middlewares`

Request factories return `Middleware(request, next?) → Response | void | Promise<…>`; named companions are response-phase functions `(response, request, next?) → Response | Promise<Response>` for `after.all`. In mode 0, wrap optional-next middleware as `req => middleware(req)` if a Fetch host supplies extra arguments; otherwise it may mistake an environment/server value for `next` (see [example 05](../examples/05-full-middleware-resolvers/index.js)).

| Factory signature | Main options | After companion |
| :--- | :--- | :--- |
| `cors({origin?,methods?,credentials?,maxAge?,allowedHeaders?,exposedHeaders?}?)` | Origin may be string, array or RegExp | `corsAfter` |
| `logger({format?,skip?}?)` | `format: 'dev' \| 'combined' \| 'json'`; `skip(req)` | `loggerAfter` |
| `rateLimit({windowMs?,max?,keyGenerator?,standardHeaders?}?)` | In-process limits; explicit trusted `keyGenerator(req)` | `rateLimitAfter` |
| `bearerAuth({token?,verify?,realm?}?)` | Static token or sync/async `verify(token)` | — |
| `basicAuth({users,realm?})` | Username→password record | — |
| `bodyLimit({max?}?)` | Number of bytes or size string e.g. `'10mb'` | — |
| `secureHeaders({contentSecurityPolicy?,xFrameOptions?,strictTransportSecurity?,xContentTypeOptions?,referrerPolicy?}?)` | Header policy | `secureHeadersAfter` |
| `requestId({header?,generator?}?)` | Request ID generation | `requestIdAfter` |

`rateLimit` uses one `unknown` bucket by default rather than trusting forwarded headers; use a trusted key and shared store for multi-instance deployments. `bodyLimit` counts streamed bytes from a cloned request; use an upstream connection/body cap too.

### Service registry · `uflite` (full only)

```text
app.service(name: string, implementation) → ServiceWrapper
app.service(name: string) → ServiceWrapper                 // lookup; throws if missing
app.hooks({ before?, after?, error? }) → app              // global SERVICE hooks
app.teardown() → app                                      // does not await cleanup
service.hooks({ before?, after?, error? }) → service
service.on('created'|'updated'|'patched'|'removed', handler) → service
service.setup(...args) / service.teardown(...args) → Promise<void>
service.find(params?) / service.get(id, params?)
service.create(data, params?) / service.update(id, data, params?)
service.patch(id, data, params?) / service.remove(id, params?) → Promise<result>
```

`implementation` can define those standard methods, custom functions, `setup(app,name)` and `teardown(app,name)`. Hooks use `all` and/or method names (`find`, `get`, `create`, `update`, `patch`, `remove`, custom). The wrapper exposes standard method functions even when the implementation omits one, but **registers an HTTP route only when that method is implemented**. Service `setup` runs on registration and `app.teardown()` calls teardown without awaiting asynchronous work.

**Successful service call order:** app.before.all → app.before.method → service.before.all → service.before.method → implementation → service.after.method → service.after.all → app.after.method → app.after.all → mutation event. In mode 0 hooks advance automatically; in mode 1 a hook must call `next()` for subsequent hooks to run. Only an *implementation* exception enters service.error.method → service.error.all → app.error.method → app.error.all; after those hooks complete, the original error is rethrown (unless an error hook throws a replacement). Before-hook, after-hook, and event-listener exceptions do not enter service error hooks. A REST request may separately reach the router's request-level error hook. Service error hooks observe/log; setting `context.result` there does not turn failure into success.

Auto-REST passes the **flat** request query as params. DBService direct `find` expects `params.query` for pagination; add a mapping layer if you require `$limit` via HTTP.

### Built-in service factories · individual imports

| Export / import | Signature & required option shape | Additional install |
| :--- | :--- | :--- |
| `createDBService` · `uflite/services/db` | `createDBService(getCollection?, {idField?,paginate?:{default,max},multi?,initialData?}?)` | `umosql@0.3.1` |
| `createTableService` · `uflite/services/table` | `createTableService(dbAdapter)` | Supply an adapter with table/DDL operations |
| `createLocalStorageService` · `uflite/services/localStorage` | `createLocalStorageService({basePath?,publicUrl?,maxFileSize?}?)` | No AWS SDK |
| `createStorageService`, alias `createStorage` · `uflite/services/storage` | `createStorageService({type?:'local'\|'s3',basePath?,publicUrl?,maxFileSize?,bucket?,region?,accessKeyId?,secretAccessKey?,sessionToken?,endpoint?,forcePathStyle?,uploadExpiresIn?,downloadExpiresIn?,client?,presign?}?)` | Both AWS SDK packages, including local mode |
| `createAuth` · `uflite/services/auth` | `await createAuth({adapter,baseURL,secret,trustedOrigins?,emailAndPassword?,secondaryStorage?,logger?,adapterConfig?,plugins?,extraPlugins?,...betterAuthOptions})` | `better-auth`; supply adapter (e.g. UMOSQL) |
| `sqlAdapterFactory` · `uflite/services/auth` | `sqlAdapterFactory(base, config?) → Better Auth adapter factory` | `better-auth`; adapter integration |
| `createACL` · `uflite/services/acl` | `createACL({enabled:boolean,rules:[{id,name?,permissions:['role:resource:method'],check?}]}) → {can(context,permission)}` | `uqry` |

`createAuth`, `createACL` and `createLocalStorageService` are also the **default exports** of their individual subpaths. `uflite/services` re-exports the DB, table and storage factories (**not** Auth/ACL/localStorage) and eagerly loads UMOSQL and AWS; prefer subpaths. `createDBService()` creates an isolated in-memory collection (default page size 10, maximum 100). Direct `find({query:{$limit?,$skip?,$select?,$sort?},paginate?})` returns `{total,limit,skip,data}`; `$limit` is clamped to the configured maximum, `$limit:0` preserves `total` with empty `data`, and `paginate:false` returns an unpaginated array. DBService not-found exceptions from `get` and ID-based mutations have `code:404` but **not** HTTP `status:404`; a default full-app HTTP response can therefore be 500. `createTableService` implements `find/get/create/patch/remove` for authorized schema changes. Both storage backends offer `find/get/create/remove` and `presignUpload/presignDownload`; **only local storage** implements `upload/download` and raw PUT/download routes. S3 upload/download bytes go directly to the provider via presigned URLs. Local upload/download HTTP routes must be protected by a request guard (local raw download does not pass the Request into its service-hook parameters); local presign links are **not** signed authorization tokens. S3 presigned PUT cannot enforce file size. [Example 04](../examples/04-full-services/index.js) runs real Auth + ACL + DBService + StorageService.

### Generic service hooks · `uflite/hooks` (also re-exported by full `uflite`)

Every factory returns `(context, next?) → value | Promise<value>`, **not** a request middleware. `HookErrorOptions` is `{error?: {status?,message?,code?}, errors?: {reason: {status?,message?,code?}}}`. `options.target` usually defaults to `data`, `result` or `params.query` as indicated; it is **not** a raw HTTP field. Full argument signatures, grouped for scanning:

| Flow | Data and query | Auth and result | Lifecycle |
| :--- | :--- | :--- | :--- |
| `iff(predicate, ...hooks)` | `requireFields(fields, options?)` | `requireAuth(options?)` | `auditFields(options?)` |
| `unless(predicate, ...hooks)` | `setDefaults(defaults, options?)` | `requireRole(roles, options?)` | `publishEvent(publish, eventName, options?)` |
| `throwIf(predicate, options?)` | `setField(field, value, options?)` | `requirePermission(permissions, options?)` | `sideEffect(effect, options?)` |
| `disallow(options?)` | `preventChanges(fields, options?)` | `requireOwner(options?)` | `debug(logger?, options?)` |
| `setData(valueOrFn)` | `removeFields(fields, options?)` | `scopeToActor(options?)` | |
| `setResult(valueOrFn)` | `pickDataFields(fields, options?)` | `requireMethod(methods, options?)` | |
| | `validateData(validator, options?)` | `rateLimit(consume, options?)` | |
| | `transformData(transform, options?)` | `transformResult(transform, options?)` | |
| | `preventEmptyData(options?)` | `pickResultFields(fields, options?)` | |
| | `setQueryDefaults(defaults, options?)` | `omitResultFields(fields, options?)` | |
| | `pickQueryFields(fields, options?)` | `mapResult(mapper)` | |
| | `transformQuery(transform, options?)` | | |

**Full typed hook signatures** (public declaration shapes, included here so the README stands alone):

```ts
export type UfliteContext = {
  app?: unknown;
  service?: unknown;
  method?: string;
  path?: string;
  id?: unknown;
  data?: unknown;
  result?: unknown;
  params?: Record<string, any>;
  [key: string]: any;
};
export type Hook = (context: UfliteContext, next?: (error?: unknown) => unknown) => unknown | Promise<unknown>;
export type Predicate<T = any> = (value: T, ...args: any[]) => boolean | Promise<boolean>;
export type Transformer<T = any, R = any> = (value: T, ...args: any[]) => R | Promise<R>;
export type FieldResolver = (value: any, object: Record<string, any>, context?: any) => any | Promise<any>;
export type HookErrorConfig = {
  message?: string | ((context: UfliteContext, details?: Record<string, any>) => string | Promise<string>);
  status?: number;
  code?: string;
};
export type HookErrorOptions = {
  /** Shared error defaults. */
  error?: HookErrorConfig;
  /** Per-failure overrides for hooks with distinct failure reasons. */
  errors?: Record<string, HookErrorConfig>;
};

export function iff(predicate: Predicate<UfliteContext>, ...hooks: Hook[]): Hook;
export function unless(predicate: Predicate<UfliteContext>, ...hooks: Hook[]): Hook;
export function throwIf(predicate: Predicate<UfliteContext>, options?: HookErrorOptions): Hook;
export function disallow(options?: HookErrorOptions): Hook;
export function setData(value: any | ((context: UfliteContext) => any)): Hook;
export function setResult(value: any | ((context: UfliteContext) => any)): Hook;
export function requireFields(fields: string[], options?: { target?: string; allowEmpty?: boolean } & HookErrorOptions): Hook;
export function setDefaults(defaults: Record<string, any> | ((context: UfliteContext) => any), options?: { target?: string }): Hook;
export function setField(field: string, value: any | ((context: UfliteContext) => any), options?: { target?: string }): Hook;
export function preventChanges(fields: string[], options?: { target?: string; original?: (context: UfliteContext) => any } & HookErrorOptions): Hook;
export function removeFields(fields: string[], options?: { target?: string }): Hook;
export function pickDataFields(fields: string[], options?: { target?: string }): Hook;
export function validateData(validator: Transformer, options?: { target?: string } & HookErrorOptions): Hook;
export function transformData(transform: Transformer, options?: { target?: string }): Hook;
export function preventEmptyData(options?: { target?: string } & HookErrorOptions): Hook;
export function setQueryDefaults(defaults: Record<string, any> | Function, options?: { target?: string }): Hook;
export function pickQueryFields(fields: string[], options?: { target?: string }): Hook;
export function transformQuery(transform: Transformer, options?: { target?: string }): Hook;
export function requireAuth(options?: HookErrorOptions & { getUser?: (context: UfliteContext) => any }): Hook;
export function requireRole(roles: string | string[], options?: HookErrorOptions & { getUser?: (context: UfliteContext) => any; roleField?: string }): Hook;
export function requirePermission(permissions: string | string[], options?: HookErrorOptions & { getPermissions?: (context: UfliteContext) => any; match?: 'any' | 'all' }): Hook;
export function requireOwner(options?: HookErrorOptions & { ownerField?: string; getActor?: (context: UfliteContext) => any; getRecord?: (context: UfliteContext) => any }): Hook;
export function scopeToActor(options?: HookErrorOptions & { field?: string; getActor?: (context: UfliteContext) => any; getQuery?: (context: UfliteContext) => any }): Hook;
export function requireMethod(methods: string | string[], options?: HookErrorOptions): Hook;
export function rateLimit(consume: Function, options?: HookErrorOptions & { key?: Function; limit?: number; windowMs?: number }): Hook;
export function transformResult(transform: Transformer, options?: { target?: string }): Hook;
export function pickResultFields(fields: string[], options?: { target?: string }): Hook;
export function omitResultFields(fields: string[], options?: { target?: string }): Hook;
export function mapResult(mapper: Transformer): Hook;
export function auditFields(options?: Record<string, any>): Hook;
export function publishEvent(publish: Function, eventName: string, options?: Record<string, any>): Hook;
export function sideEffect(effect: Function, options?: Record<string, any>): Hook;
export function debug(logger?: any, options?: Record<string, any>): Hook;
```

`uflite/hooks/flow`, `/data`, `/auth`, `/lifecycle`, `/result` re-export the respective columns. `rateLimit(consume, options?)` here is a **service hook**, unlike HTTP `rateLimit(options?)`. Hooks can mutate `context.data` or `context.result`; [example 05](../examples/05-full-middleware-resolvers/index.js) uses `requireFields` + `transformData`. For longer worked recipes see [HOOK_SPEC.md](HOOK_SPEC.md) and [REAL_WORLD_HOOKS.md](REAL_WORLD_HOOKS.md).

### Predicates · `uflite/predicates`

Direct predicates return booleans; curried predicates return `(value) → boolean`. `all`, `any`, `not`, `when` and `contextPredicate` can be asynchronous. Nothing here automatically attaches to a route.

| Values & types | Comparison & sets | Paths & composition |
| :--- | :--- | :--- |
| `isPresent(value)` | `equals(expected)(value)` | `hasPath(path)(object)` |
| `isNil(value)` | `notEquals(expected)(value)` | `pathEquals(path,expected)(object)` |
| `isDefined(value)` | `oneOf(values)(value)` | `pathMatches(path,predicate)(object)` |
| `isEmpty(value)` | `includes(expected)(value)` | `all(...predicates)(value)` |
| `isString(value)` | `matches(pattern,flags?)(value)` | `any(...predicates)(value)` |
| `isNumber(value)` | `greaterThan(threshold)(value)` | `not(predicate)(value)` |
| `isInteger(value)` | `atLeast(threshold)(value)` | `when(predicate,yes,no?)(value)` |
| `isBoolean(value)` | `lessThan(threshold)(value)` | `contextPredicate(predicate,{select?}?)(context)` |
| `isArray(value)` | `atMost(threshold)(value)` | |
| `isObject(value)` | `between(min,max,{inclusive?}?)(value)` | |
| `isPlainObject(value)` | `lengthAtLeast(length)(value)` | |
| `isNonEmptyString(value)` | `lengthAtMost(length)(value)` | |
| `isEmail(value)` | `hasAny(values)(value)` | |
| `isURL(value)` | `hasAll(values)(value)` | |
| `isUUID(value)` | `truthy(value)` | |
| | `falsy(value)` | |

### Transformers · `uflite/transformers`

Transformers return new values rather than mutating input objects; `compose`, `pipe`, `mapFields`, `setDefaults`, `mapArray` and `updatePath` may be async. The `setDefaults` name here is a **value transformer**, not the service hook of the same name.

| Direct value functions | Factory → value transformer |
| :--- | :--- |
| `identity(value)` | `compose(...transformers)(value)`; `pipe` is an alias |
| `trimString(value)` | `pick(keys)(value)`; `omit(keys)(value)` |
| `lowercase(value)` | `renameFields(mapping)(value)` |
| `uppercase(value)` | `mapFields(mapping)(value)` |
| `normalizeEmail(value)` | `trimStrings({fields?,recursive?}?)(value)` |
| `normalizeWhitespace(value)` | `removeEmpty({removeNull?,removeEmptyStrings?,removeEmptyArrays?,removeEmptyObjects?}?)(value)` |
| `slugify(value)` | `setDefaults(defaults)(value)` |
| `toNumber(value,{strict?}?)` | `mapArray(transformer)(value)` |
| `toInteger(value,{strict?}?)` | `updatePath(path,transformer)(value)` |
| `parseJSON(value,{strict?}?)` | |
| `toBoolean(value,{strict?}?)` | |

### Field resolvers · `uflite/resolvers`

Each factory returns a field resolver `(current, object, context?) → value | Promise<value>`. Call it yourself in a route or service hook (or pass to your own mapping layer); these helpers do **not** implement `uresolver.resolve` or `virtual`.

| Read / lookup | Decide / redact | Arrays / aggregate |
| :--- | :--- | :--- |
| `value()` | `resolveIf(predicate,resolver,{otherwise?}?)` | `mapArray(resolver)` |
| `fromPath(path,{fallback?}?)` | `omitIf(predicate)` | `relationMany(fetchMany,{key?}?)` |
| `fromContext(path,{fallback?}?)` | `redactIf(predicate,replacement?)` | `join(separator?)` |
| `fallback(defaultValue)` | `mapValue(mapper)` | `count()` |
| `lookup(fetchOne,{key?,fallback?}?)` | `relation(fetchOne,{key?,fallback?}?)` | `sum()` |
| | | `pluck(field)` |

```js
import { fromPath } from 'uflite/resolvers'
import { trimStrings } from 'uflite/transformers'
import { isNonEmptyString } from 'uflite/predicates'

const cleaned = trimStrings({ fields: ['name'] })({ name: '  Ada  ' })
const valid = isNonEmptyString(cleaned.name) // true
const label = fromPath('profile.name', { fallback: 'Anonymous' })(null, { profile: cleaned })
```

### In-process events · channels · other exports

| Import | Signature | Notes |
| :--- | :--- | :--- |
| `uflite` | `app.on(event, fn) → app`, `app.off(event, fn) → app`, `app.emit(event, ...args) → app` | Synchronous local events |
| `uflite` | `app.channel(name) → channel` | Local connection set, not a socket server |
| `uflite` | `channel.join(conn, data?) → channel`, `channel.leave(conn) → channel` | `conn.send(string)` is application-supplied |
| `uflite` | `channel.send(event,data) → channel`, `channel.filter(fn).send(event,data)` | Sends JSON `{event,data}` to connections; filter receives `(connectionData,eventData)` |
| `uflite/utils` | `isObject(value) → boolean` | Object guard (also exported via predicates) |
| `uflite` | `predicates`, `transformers`, `resolvers` namespaces | Same helpers as individual subpaths |
| `uflite/package.json` | Package metadata | Exported JSON subpath |

```js
import { flite } from 'uflite'
const app = flite()
app.on('ready', count => console.log(count)).emit('ready', 1)
const socket = { send: message => console.log(message) } // replace with a real connection
app.channel('updates').join(socket, { room: 'demo' })
app.channel('updates').filter(meta => meta.room === 'demo').send('created', { id: 1 })
app.channel('updates').leave(socket)
```
