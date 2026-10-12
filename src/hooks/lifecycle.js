import { continueIfMiddleware } from '../internal.js';

/** Set audit fields on create/update data. The service must persist context.data. */
export const auditFields = ({
  createdAt = 'createdAt',
  updatedAt = 'updatedAt',
  createdBy = 'createdBy',
  updatedBy = 'updatedBy',
  now = () => new Date().toISOString(),
  getActor = context => context.params?.user?.id ?? context.params?.user?._id,
  isCreate = context => context.method === 'create',
  target = 'data'
} = {}) => async (context, next) => {
  const data = context[target];
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const timestamp = await now(context);
    const actor = await getActor(context) ?? null;
    if (await isCreate(context)) {
      if (createdAt) data[createdAt] = timestamp;
      if (createdBy) data[createdBy] = actor;
    } else {
      // Strip default and configured creation fields so client input cannot spoof them.
      delete data.createdAt;
      delete data.createdBy;
      if (createdAt) delete data[createdAt];
      if (createdBy) delete data[createdBy];
    }
    if (updatedAt) data[updatedAt] = timestamp;
    if (updatedBy) data[updatedBy] = actor;
  }
  return continueIfMiddleware(next);
};

/** Generic event hook. Use a durable outbox/queue when delivery must survive crashes. */
export const publishEvent = (publish, eventName, { payload = context => context.result, when = () => true } = {}) =>
  async (context, next) => {
    if (await when(context)) await publish(eventName, await payload(context), context);
    return continueIfMiddleware(next);
  };

/** Run a side effect with explicit error policy. Default behavior propagates failures. */
export const sideEffect = (effect, { onError, ignoreError = false } = {}) => async (context, next) => {
  try {
    await effect(context);
  } catch (error) {
    if (onError) await onError(error, context);
    else if (!ignoreError) throw error;
  }
  return continueIfMiddleware(next);
};

export const debug = (logger = console, { label = 'hook', select = context => ({
  method: context.method, path: context.path
}) } = {}) => async (context, next) => {
  logger.debug?.(label, await select(context));
  return continueIfMiddleware(next);
};
