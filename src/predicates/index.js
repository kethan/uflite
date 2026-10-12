import { isObject } from '../../utils/isObject.js'

/**
 * Pure, reusable predicate factories.
 *
 * Predicates return booleans and do not mutate the value/context.
 * Async composition helpers await every child predicate.
 */
const pathValue = (object, path) =>
  String(path).split('.').reduce((value, key) => value == null ? undefined : value[key], object);

export const isPresent = value => value !== undefined && value !== null;
export const isNil = value => value === undefined || value === null;
export const isString = value => typeof value === 'string';
export const isNumber = value => typeof value === 'number' && Number.isFinite(value);
export const isInteger = value => Number.isInteger(value);
export const isBoolean = value => typeof value === 'boolean';
export const isArray = Array.isArray;
export { isObject }
export const isPlainObject = value => {
  if (!value || Object.prototype.toString.call(value) !== '[object Object]') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
};
export const isNonEmptyString = value => typeof value === 'string' && value.trim().length > 0;
export const isEmail = value => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export const isURL = value => {
  if (typeof value !== 'string') return false;
  try { const url = new URL(value); return url.protocol === 'http:' || url.protocol === 'https:'; }
  catch { return false; }
};
export const isUUID = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const isDefined = value => value !== undefined;
export const isEmpty = value =>
  value == null ||
  (typeof value === 'string' && value.length === 0) ||
  (Array.isArray(value) && value.length === 0) ||
  (value instanceof Map && value.size === 0) ||
  (value instanceof Set && value.size === 0) ||
  (value && typeof value === 'object' && !(value instanceof Date) &&
    !(value instanceof Map) && !(value instanceof Set) && Object.keys(value).length === 0);

export const equals = expected => value => Object.is(value, expected);
export const notEquals = expected => value => !Object.is(value, expected);
export const oneOf = values => {
  const set = new Set(values);
  return value => set.has(value);
};
export const includes = expected => value =>
  typeof value === 'string' || Array.isArray(value) || value instanceof Set
    ? value.includes ? value.includes(expected) : value.has(expected)
    : false;
export const matches = (pattern, flags) => {
  const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, flags);
  return value => typeof value === 'string' && (regex.lastIndex = 0, regex.test(value));
};
export const greaterThan = threshold => value => typeof value === 'number' && value > threshold;
export const atLeast = threshold => value => typeof value === 'number' && value >= threshold;
export const lessThan = threshold => value => typeof value === 'number' && value < threshold;
export const atMost = threshold => value => typeof value === 'number' && value <= threshold;
export const between = (min, max, { inclusive = true } = {}) => value =>
  typeof value === 'number' && (inclusive ? value >= min && value <= max : value > min && value < max);
export const lengthAtLeast = length => value =>
  (typeof value === 'string' || Array.isArray(value)) && value.length >= length;
export const lengthAtMost = length => value =>
  (typeof value === 'string' || Array.isArray(value)) && value.length <= length;
export const hasAny = values => value => {
  const candidates = value instanceof Set ? value : Array.isArray(value) ? value : [];
  return values.some(item => candidates.includes ? candidates.includes(item) : candidates.has(item));
};
export const hasAll = values => value => {
  const candidates = value instanceof Set ? value : Array.isArray(value) ? value : [];
  return values.every(item => candidates.includes ? candidates.includes(item) : candidates.has(item));
};
export const truthy = value => Boolean(value);
export const falsy = value => !value;

export const hasPath = path => object => pathValue(object, path) !== undefined;
export const pathEquals = (path, expected) => object => Object.is(pathValue(object, path), expected);
export const pathMatches = (path, predicate) => object => predicate(pathValue(object, path), object);

export const all = (...predicates) => async value => {
  for (const predicate of predicates.flat(Infinity)) {
    if (!(await predicate(value))) return false;
  }
  return true;
};
export const any = (...predicates) => async value => {
  for (const predicate of predicates.flat(Infinity)) {
    if (await predicate(value)) return true;
  }
  return false;
};
export const not = predicate => async value => !(await predicate(value));
export const when = (predicate, yes, no = () => false) => async value =>
  (await predicate(value)) ? yes(value) : no(value);

/** Adapt a value predicate to the uflite hook context. */
export const contextPredicate = (predicate, { select = context => context } = {}) =>
  async context => predicate(await select(context), context);
