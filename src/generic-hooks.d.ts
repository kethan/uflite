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

export * as predicates from './predicates/index.js';
export * as transformers from './transformers/index.js';
export * as resolvers from './resolvers/index.js';
