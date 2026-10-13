import { pathValue } from '../utils/path-value.js';

/**
 * Field resolver helpers compatible with uresolver's field signature:
 *   resolver(value, object, context)
 *
 * This module does not implement or wrap uresolver.resolve/virtual.
 * Import those directly from `uresolver`.
 */

export const value = () => current => current;

export const fromPath = (path, { fallback: fallbackValue } = {}) => (current, object) => {
  const result = pathValue(object, path);
  return result === undefined ? fallbackValue : result;
};

export const fromContext = (path, { fallback } = {}) => (current, object, context) => {
  const result = pathValue(context, path);
  return result === undefined ? fallback : result;
};

export const fallback = defaultValue => current =>
  current == null ? (typeof defaultValue === 'function' ? defaultValue() : defaultValue) : current;

export const mapValue = mapper => (current, object, context) => mapper(current, object, context);

export const lookup = (fetchOne, {
  key = current => current,
  fallback: fallbackValue = null
} = {}) => async (current, object, context) => {
  const lookupKey = await key(current, object, context);
  if (lookupKey == null) return typeof fallbackValue === 'function' ? fallbackValue(current, object, context) : fallbackValue;
  const result = await fetchOne(lookupKey, object, context);
  return result === undefined
    ? (typeof fallbackValue === 'function' ? fallbackValue(current, object, context) : fallbackValue)
    : result;
};

export const resolveIf = (predicate, resolver, { otherwise } = {}) => async (current, object, context) => {
  if (await predicate(current, object, context)) return resolver(current, object, context);
  return typeof otherwise === 'function' ? otherwise(current, object, context) : otherwise;
};

export const omitIf = predicate => async (current, object, context) =>
  await predicate(current, object, context) ? undefined : current;

export const redactIf = (predicate, replacement = null) => async (current, object, context) =>
  await predicate(current, object, context)
    ? (typeof replacement === 'function' ? replacement(current, object, context) : replacement)
    : current;

export const mapArray = resolver => async (current, object, context) =>
  Array.isArray(current) ? Promise.all(current.map((item, index) => resolver(item, object, { ...context, index }))) : current;

export const relation = (fetchOne, { key = current => current, fallback: fallbackValue = null } = {}) =>
  lookup(fetchOne, { key, fallback: fallbackValue });

export const relationMany = (fetchMany, { key = current => current } = {}) => async (current, object, context) => {
  const ids = await key(current, object, context);
  if (!Array.isArray(ids) || ids.length === 0) return [];
  return fetchMany(ids, object, context);
};


export const join = (separator = ' ') => current =>
  Array.isArray(current) ? current.join(separator) : current;

export const count = () => current =>
  Array.isArray(current) || typeof current === 'string' ? current.length : 0;

export const sum = () => current =>
  Array.isArray(current) ? current.reduce((total, item) => total + (typeof item === 'number' ? item : 0), 0) : 0;

export const pluck = field => current =>
  Array.isArray(current) ? current.map(item => item == null ? undefined : item[field]) : current;
