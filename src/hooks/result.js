import { continueIfMiddleware } from './internal.js';

export const transformResult = (transform, { target = 'result' } = {}) => async (context, next) => {
  context[target] = await transform(context[target], context);
  return continueIfMiddleware(next);
};

export const pickResultFields = (fields, options) => {
  const allowed = new Set(fields);
  return transformResult(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    return Object.fromEntries(Object.entries(value).filter(([key]) => allowed.has(key)));
  }, options);
};

export const omitResultFields = (fields, options) => {
  const excluded = new Set(fields);
  return transformResult(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    return Object.fromEntries(Object.entries(value).filter(([key]) => !excluded.has(key)));
  }, options);
};

export const mapResult = mapper => transformResult(async (result, context) =>
  Array.isArray(result)
    ? Promise.all(result.map((item, index) => mapper(item, context, index)))
    : mapper(result, context));
