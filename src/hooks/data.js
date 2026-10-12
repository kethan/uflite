import { continueIfMiddleware, createConfiguredError } from '../internal.js';

const getPath = (object, path) =>
  String(path).split('.').reduce((value, key) => value == null ? undefined : value[key], object);

const setPath = (object, path, value) => {
  const keys = String(path).split('.');
  if (keys.some(key => !key || ['__proto__', 'prototype', 'constructor'].includes(key))) {
    throw new TypeError('Unsafe property path');
  }
  let current = object;
  for (const key of keys.slice(0, -1)) {
    if (!current[key] || typeof current[key] !== 'object' || Array.isArray(current[key])) current[key] = {};
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
  return object;
};


export const requireFields = (fields, options = {}) => {
  const { target = 'data', allowEmpty = false } = options;
  return async (context, next) => {
    const value = getPath(context, target);
    const missing = fields.filter(field => {
      const fieldValue = getPath(value, field);
      return fieldValue === undefined || fieldValue === null || (!allowEmpty && fieldValue === '');
    });
    if (missing.length) {
      const details = { fields: missing };
      throw await createConfiguredError(options, {
        message: (_context, info) => `Missing required fields: ${info.fields.join(', ')}`,
        status: 400, code: 'REQUIRED_FIELDS'
      }, context, details);
    }
    return continueIfMiddleware(next);
  };
};

export const setDefaults = (defaults, { target = 'data' } = {}) => async (context, next) => {
  let value = getPath(context, target);
  if (value == null) {
    value = {};
    setPath(context, target, value);
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    const resolved = typeof defaults === 'function' ? await defaults(context) : defaults;
    for (const [field, fallback] of Object.entries(resolved ?? {})) {
      if (getPath(value, field) === undefined) {
        setPath(value, field, typeof fallback === 'function' ? await fallback(context) : fallback);
      }
    }
  }
  return continueIfMiddleware(next);
};

export const preventChanges = (fields, options = {}) => {
  const { target = 'data', original = context => context.original } = options;
  return async (context, next) => {
    const before = await original(context);
    const after = getPath(context, target);
    if (before && after && typeof before === 'object' && typeof after === 'object') {
      const changed = fields.filter(field =>
        getPath(after, field) !== undefined && getPath(after, field) !== getPath(before, field)
      );
      if (changed.length) {
        const details = { fields: changed };
        throw await createConfiguredError(options, {
          message: (_context, info) => `Fields cannot be changed: ${info.fields.join(', ')}`,
          status: 400, code: 'IMMUTABLE_FIELDS'
        }, context, details);
      }
    }
    return continueIfMiddleware(next);
  };
};

export const removeFields = (fields, { target = 'data' } = {}) => async (context, next) => {
  const value = getPath(context, target);
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const field of fields) {
      const keys = String(field).split('.');
      if (keys.some(key => !key || ['__proto__', 'prototype', 'constructor'].includes(key))) throw new TypeError(`Unsafe property path: ${field}`);
      const last = keys.pop();
      const parent = keys.reduce((current, key) => current == null ? undefined : current[key], value);
      if (parent && typeof parent === 'object') delete parent[last];
    }
  }
  return continueIfMiddleware(next);
};

export const transformData = (transform, { target = 'data' } = {}) => async (context, next) => {
  const current = getPath(context, target);
  const transformed = await transform(current, context);
  setPath(context, target, transformed);
  return continueIfMiddleware(next);
};

export const setQueryDefaults = (defaults, { target = 'params.query' } = {}) => async (context, next) => {
  let query = getPath(context, target);
  if (query == null) { query = {}; setPath(context, target, query); }
  if (!query || typeof query !== 'object' || Array.isArray(query)) throw new TypeError(`${target} must be an object`);
  const resolved = typeof defaults === 'function' ? await defaults(context) : defaults;
  for (const [field, value] of Object.entries(resolved ?? {})) {
    if (query[field] === undefined) {
      query[field] = typeof value === 'function' ? await value(context) : value;
    }
  }
  return continueIfMiddleware(next);
};


export const setField = (field, value, { target = 'data' } = {}) => async (context, next) => {
  const current = getPath(context, target);
  if (current == null || typeof current !== 'object' || Array.isArray(current)) {
    setPath(context, target, {});
  }
  const resolved = typeof value === 'function' ? await value(context) : value;
  setPath(getPath(context, target), field, resolved);
  return continueIfMiddleware(next);
};

/** Allowlist fields on an object; unlike removeFields, unknown fields are dropped. */
export const pickDataFields = (fields, { target = 'data' } = {}) => async (context, next) => {
  const value = getPath(context, target);
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const allowed = new Set(fields);
    const picked = Object.fromEntries(Object.entries(value).filter(([key]) => allowed.has(key)));
    setPath(context, target, picked);
  }
  return continueIfMiddleware(next);
};

/** Validate a target using an injected validator. Return true/undefined for success. */
export const validateData = (validator, options = {}) => async (context, next) => {
  const { target = 'data' } = options;
  const value = getPath(context, target);
  const result = await validator(value, context);
  if (result === false || (Array.isArray(result) && result.length > 0)) {
    const details = Array.isArray(result) ? { details: result } : {};
    const errorDetails = { ...details, validation: result };
    throw await createConfiguredError(options, {
      message: 'Validation failed', status: 400, code: 'VALIDATION_FAILED'
    }, context, errorDetails);
  }
  return continueIfMiddleware(next);
};

/** Allowlist query keys, dropping unknown keys instead of interpreting them. */
export const pickQueryFields = (fields, { target = 'params.query' } = {}) => async (context, next) => {
  let query = getPath(context, target);
  if (query == null) { query = {}; setPath(context, target, query); }
  if (!query || typeof query !== 'object' || Array.isArray(query)) throw new TypeError(`${target} must be an object`);
  const allowed = new Set(fields);
  setPath(context, target, Object.fromEntries(Object.entries(query).filter(([key]) => allowed.has(key))));
  return continueIfMiddleware(next);
};

export const transformQuery = (transform, { target = 'params.query' } = {}) => async (context, next) => {
  let query = getPath(context, target);
  if (query == null) { query = {}; setPath(context, target, query); }
  const transformed = await transform(query, context);
  if (transformed == null || typeof transformed !== 'object' || Array.isArray(transformed)) throw new TypeError('Query transformer must return an object');
  setPath(context, target, transformed);
  return continueIfMiddleware(next);
};

export const preventEmptyData = (options = {}) => {
  const { target = 'data' } = options;
  return async (context, next) => {
    const value = getPath(context, target);
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length === 0) {
      throw await createConfiguredError(options, {
        message: 'At least one field is required', status: 400, code: 'EMPTY_DATA'
      }, context);
    }
    return continueIfMiddleware(next);
  };
};
