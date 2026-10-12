/**
 * Pure data transformers. Unless a function is explicitly named in-place,
 * transformers return a new value and do not mutate the input.
 */
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
const pathValue = (object, path) =>
  String(path).split('.').reduce((value, key) => value == null ? undefined : value[key], object);

const assignPath = (object, path, value) => {
  const keys = String(path).split('.');
  if (!keys.length || keys.some(key => !key || forbidden.has(key))) {
    throw new TypeError(`Unsafe property path: ${path}`);
  }
  let current = object;
  for (const key of keys.slice(0, -1)) {
    if (!current[key] || typeof current[key] !== 'object' || Array.isArray(current[key])) {
      current[key] = {};
    } else {
      current[key] = { ...current[key] };
    }
    current = current[key];
  }
  current[keys.at(-1)] = value;
  return object;
};

const cloneRecord = value => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value instanceof Date) return value;
  return { ...value };
};

export const identity = value => value;
export const compose = (...transformers) => async value => {
  let result = value;
  for (const transformer of transformers.flat(Infinity)) result = await transformer(result);
  return result;
};
export const pipe = compose;

export const trimString = value => typeof value === 'string' ? value.trim() : value;
export const lowercase = value => typeof value === 'string' ? value.toLowerCase() : value;
export const uppercase = value => typeof value === 'string' ? value.toUpperCase() : value;
export const normalizeEmail = value =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
export const normalizeWhitespace = value =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;
export const slugify = value =>
  typeof value === 'string'
    ? value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    : value;

export const toNumber = (value, { strict = false } = {}) => {
  if (value == null || value === '') return value;
  const number = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(number)) {
    if (strict) throw new TypeError(`Cannot convert ${String(value)} to a number`);
    return value;
  }
  return number;
};

export const toInteger = (value, { strict = false } = {}) => {
  if (value == null || value === '') return value;
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(number)) {
    if (strict) throw new TypeError(`Cannot convert ${String(value)} to an integer`);
    return value;
  }
  return number;
};

export const parseJSON = (value, { strict = false } = {}) => {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); }
  catch (error) {
    if (strict) throw error;
    return value;
  }
};

export const toBoolean = (value, { strict = false } = {}) => {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || (typeof value === 'string' && value.toLowerCase() === 'true')) return true;
  if (value === 0 || value === '0' || (typeof value === 'string' && value.toLowerCase() === 'false')) return false;
  if (strict) throw new TypeError(`Cannot convert ${String(value)} to a boolean`);
  return value;
};

export const pick = keys => value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const output = {};
  for (const key of keys) if (Object.hasOwn(value, key)) output[key] = value[key];
  return output;
};

export const omit = keys => value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const excluded = new Set(keys);
  return Object.fromEntries(Object.entries(value).filter(([key]) => !excluded.has(key)));
};

export const renameFields = mapping => value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const output = { ...value };
  for (const [from, to] of Object.entries(mapping)) {
    if (Object.hasOwn(output, from)) {
      output[to] = output[from];
      if (from !== to) delete output[from];
    }
  }
  return output;
};

export const mapFields = mapping => async value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const output = { ...value };
  for (const [field, transformer] of Object.entries(mapping)) {
    if (Object.hasOwn(output, field)) output[field] = await transformer(output[field], value);
  }
  return output;
};

export const trimStrings = ({ fields, recursive = false } = {}) => value => {
  if (Array.isArray(value)) return value.map(item => trimStrings({ recursive })(item));
  if (!value || typeof value !== 'object' || value instanceof Date) return trimString(value);
  const output = { ...value };
  for (const [key, child] of Object.entries(output)) {
    if (fields ? fields.includes(key) : typeof child === 'string') {
      output[key] = trimString(child);
    } else if (recursive && child && typeof child === 'object') {
      output[key] = trimStrings({ recursive: true })(child);
    }
  }
  return output;
};

export const removeEmpty = ({ removeNull = false, removeEmptyStrings = true, removeEmptyArrays = false, removeEmptyObjects = false } = {}) => value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([, item]) => {
    if (removeNull && item == null) return false;
    if (removeEmptyStrings && item === '') return false;
    if (removeEmptyArrays && Array.isArray(item) && item.length === 0) return false;
    if (removeEmptyObjects && item && typeof item === 'object' && !Array.isArray(item) && Object.keys(item).length === 0) return false;
    return true;
  }));
};

export const setDefaults = defaults => async value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const output = { ...value };
  for (const [key, fallback] of Object.entries(defaults)) {
    if (output[key] === undefined) output[key] = typeof fallback === 'function' ? await fallback(value) : fallback;
  }
  return output;
};

export const mapArray = transformer => async value =>
  Array.isArray(value) ? Promise.all(value.map(item => transformer(item))) : value;

export const updatePath = (path, transformer) => async value => {
  const output = cloneRecord(value);
  if (!output || typeof output !== 'object' || Array.isArray(output)) return value;
  const current = pathValue(output, path);
  assignPath(output, path, await transformer(current, output));
  return output;
};
