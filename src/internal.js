import { status as UfliteError } from '../plugins.js';

export const continueIfMiddleware = next =>
  typeof next === 'function' ? next() : undefined;

export const createError = (message, status, code, details = {}) =>
  new UfliteError(status, message, { code, ...details });

/** Resolve the single public error configuration shape. */
export const resolveErrorOptions = (options = {}, fallback = {}) => ({
  message: options.error?.message ?? fallback.message,
  status: options.error?.status ?? fallback.status,
  code: options.error?.code ?? fallback.code
});

export const createConfiguredError = async (options, fallback, context, details = {}) => {
  const config = resolveErrorOptions(options, fallback);
  const message = typeof config.message === 'function'
    ? await config.message(context, details)
    : config.message;
  return createError(message, config.status, config.code, details);
};

/** Resolve shared defaults and per-failure overrides for hooks with multiple failure types. */
export const configuredError = async (options, key, fallback, context, details = {}) => {
  const specific = options.errors?.[key] ?? {};
  const common = resolveErrorOptions(options, fallback);
  const config = {
    message: specific.message ?? common.message,
    status: specific.status ?? common.status,
    code: specific.code ?? common.code
  };
  const message = typeof config.message === 'function'
    ? await config.message(context, details)
    : config.message;
  return createError(message, config.status, config.code, details);
};
