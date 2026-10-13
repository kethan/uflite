import { continueIfMiddleware, configuredError, createConfiguredError } from './internal.js';

const authErrors = {
  unauthenticated: { message: 'Authentication required', status: 401, code: 'UNAUTHENTICATED' },
  forbidden: { message: 'Forbidden', status: 403, code: 'FORBIDDEN' }
};

export const requireAuth = (options = {}) =>
  async (context, next) => {
    const getUser = options.getUser ?? (ctx => ctx.params?.user);
    if (!(await getUser(context))) throw await createConfiguredError(options, authErrors.unauthenticated, context);
    return continueIfMiddleware(next);
  };

export const requireRole = (roles, options = {}) => {
  const { getUser = context => context.params?.user, roleField = 'role' } = options;
  const allowed = new Set(Array.isArray(roles) ? roles : [roles]);
  return async (context, next) => {
    const user = await getUser(context);
    if (!user) throw await configuredError(options, 'unauthenticated', authErrors.unauthenticated, context);
    const actual = user[roleField];
    const actualRoles = Array.isArray(actual) ? actual : [actual];
    if (!actualRoles.some(role => allowed.has(role))) throw await configuredError(options, 'forbidden', authErrors.forbidden, context, { roles: [...allowed] });
    return continueIfMiddleware(next);
  };
};

export const requirePermission = (permissions, options = {}) => {
  const {
    getPermissions = context => context.params?.permissions ?? context.params?.user?.permissions,
    match = 'any'
  } = options;
  if (match !== 'any' && match !== 'all') throw new TypeError("match must be 'any' or 'all'");
  const required = Array.isArray(permissions) ? permissions : [permissions];
  return async (context, next) => {
    const current = await getPermissions(context);
    const granted = new Set(current instanceof Set ? current : Array.isArray(current) ? current : []);
    const allowed = match === 'all'
      ? required.every(permission => granted.has(permission))
      : required.some(permission => granted.has(permission));
    if (!allowed) throw await configuredError(options, 'forbidden', {
      ...authErrors.forbidden,
      message: 'Insufficient permissions'
    }, context, { permissions: required, match });
    return continueIfMiddleware(next);
  };
};

export const requireOwner = (options = {}) => {
  const {
    ownerField = 'userId',
    getActor = context => context.params?.user?.id ?? context.params?.user?._id,
    getRecord = context => context.original ?? context.result
  } = options;
  return async (context, next) => {
    const actor = await getActor(context);
    if (actor == null) throw await configuredError(options, 'unauthenticated', authErrors.unauthenticated, context);
    const record = await getRecord(context);
    if (!record || record[ownerField] !== actor) throw await configuredError(options, 'forbidden', authErrors.forbidden, context, { ownerField });
    return continueIfMiddleware(next);
  };
};

/** Adds a trusted actor constraint to a query object; it does not perform the query. */
export const scopeToActor = (options = {}) => {
  const {
    field = 'userId',
    getActor = context => context.params?.user?.id ?? context.params?.user?._id,
    getQuery = context => (context.params ??= {}, context.params.query ??= {}, context.params.query)
  } = options;
  return async (context, next) => {
    const actor = await getActor(context);
    if (actor == null) throw await configuredError(options, 'unauthenticated', authErrors.unauthenticated, context);
    const query = await getQuery(context);
    if (!query || typeof query !== 'object' || Array.isArray(query)) throw new TypeError('getQuery must return an object');
    query[field] = actor;
    return continueIfMiddleware(next);
  };
};

export const requireMethod = (methods, options = {}) => {
  const allowed = new Set(Array.isArray(methods) ? methods : [methods]);
  return async (context, next) => {
    if (!allowed.has(context.method)) {
      throw await createConfiguredError(options, { message: 'Method not allowed', status: 405, code: 'METHOD_NOT_ALLOWED' }, context);
    }
    return continueIfMiddleware(next);
  };
};

/** Delegate atomic rate-limit counting to an injected store/function. */
export const rateLimit = (consume, options = {}) => {
  const {
    key = context => context.params?.user?.id ?? context.params?.ip ?? 'anonymous',
    limit = 100,
    windowMs = 60_000
  } = options;
  return async (context, next) => {
    const result = await consume(await key(context), { limit, windowMs, context });
    const allowed = typeof result === 'boolean' ? result : result?.allowed;
    if (!allowed) {
      const error = await createConfiguredError(options, {
        message: 'Rate limit exceeded', status: 429, code: 'RATE_LIMITED'
      }, context, { result });
      if (result && typeof result === 'object' && result.retryAfter != null) error.retryAfter = result.retryAfter;
      throw error;
    }
    return continueIfMiddleware(next);
  };
};
