/**
 * Generic flow hooks for uflite service hooks.
 *
 * Compatibility rule:
 * - mode 0 invokes hooks as hook(context), then advances itself.
 * - mode 1 invokes hooks as hook(context, next); a continuing hook must call next().
 * Therefore these hooks only call next when it is provided. They do not implement a
 * runner, adapter, context, error class, or pipeline.
 */

import { continueIfMiddleware, createConfiguredError } from './internal.js';

const asHooks = values => values.flat(Infinity).filter(value => typeof value === 'function');

export const iff = (predicate, ...hooks) => async (context, next) => {
  if (await predicate(context)) {
    for (const hook of asHooks(hooks)) {
      // Nested hooks are deliberately atomic; composition is handled by uflite.
      await hook(context);
    }
  }
  return continueIfMiddleware(next);
};

export const unless = (predicate, ...hooks) =>
  iff(async context => !(await predicate(context)), ...hooks);

export const throwIf = (predicate, options = {}) => async (context, next) => {
  if (await predicate(context)) {
    throw await createConfiguredError(options, {
      message: 'Operation rejected', status: 400, code: 'BAD_REQUEST'
    }, context);
  }
  return continueIfMiddleware(next);
};

export const disallow = (options = {}) => throwIf(() => true, options);

export const setResult = value => async (context, next) => {
  context.result = typeof value === 'function' ? await value(context) : value;
  return continueIfMiddleware(next);
};

export const setData = value => async (context, next) => {
  context.data = typeof value === 'function' ? await value(context) : value;
  return continueIfMiddleware(next);
};
