// index.d.ts
// Types
export class StatusE extends Error {
  status: number;
  [key: string]: any;
  constructor(status?: number, message?: string, data?: any);
}

export const status: typeof StatusE;

// Utility types
type NextFunction = (err?: Error | void) => void | Promise<void>;
type Promisable<T> = T | Promise<T>;

// Run function
export function run<T extends any[] = any[]>(
  mode?: number,
  next?: NextFunction,
  loop?: () => void,
  i?: number,
  result?: any
): (
  ...fns: Array<(...args: [...T, NextFunction]) => any>
) => (
  ...args: T
) => Promise<any>;

// Response helpers
type ResponseOptions = ResponseInit & { url?: string };

export function response<T = any>(
  format?: string,
  transform?: (body: T) => any
): (body?: T | Response, options?: ResponseOptions) => Response | undefined;

export const text: (body?: string | Response, options?: ResponseOptions) => Response | undefined;
export const html: (body?: string | Response, options?: ResponseOptions) => Response | undefined;
export const json: <T = any>(body?: T | Response, options?: ResponseOptions) => Response | undefined;

export function error(status?: number, body?: any): Response;
export function error(error: Error): Response;

// Service types
export interface ServiceParams {
  [key: string]: any;
}

export interface HookContext<T = any> {
  app: FliteInstance;
  service: any;
  method: string;
  path: string;
  params: ServiceParams;
  id?: any;
  data?: any;
  result?: T;
}

export type HookFunction = (context: HookContext) => Promisable<HookContext | void>;

export interface Hooks {
  before?: {
    all?: HookFunction[];
    find?: HookFunction[];
    get?: HookFunction[];
    create?: HookFunction[];
    update?: HookFunction[];
    patch?: HookFunction[];
    remove?: HookFunction[];
    [key: string]: HookFunction[] | undefined;
  };
  after?: {
    all?: HookFunction[];
    find?: HookFunction[];
    get?: HookFunction[];
    create?: HookFunction[];
    update?: HookFunction[];
    patch?: HookFunction[];
    remove?: HookFunction[];
    [key: string]: HookFunction[] | undefined;
  };
}

export interface Service<T = any> {
  setup?(app: FliteInstance, name: string): Promisable<void>;
  teardown?(app: FliteInstance, name: string): Promisable<void>;
  find?(params?: ServiceParams): Promisable<T[]>;
  get?(id: any, params?: ServiceParams): Promisable<T>;
  create?(data: Partial<T>, params?: ServiceParams): Promisable<T>;
  update?(id: any, data: T, params?: ServiceParams): Promisable<T>;
  patch?(id: any, data: Partial<T>, params?: ServiceParams): Promisable<T>;
  remove?(id: any, params?: ServiceParams): Promisable<T>;
  [key: string]: any;
}

export interface ServiceWrapper<T = any> {
  on(event: 'created' | 'patched' | 'updated' | 'removed' | string, handler: (result: T) => void): this;
  hooks(hooks: Hooks): this;
  find(params?: ServiceParams): Promise<T[]>;
  get(id: any, params?: ServiceParams): Promise<T>;
  create(data: Partial<T>, params?: ServiceParams): Promise<T>;
  update(id: any, data: T, params?: ServiceParams): Promise<T>;
  patch(id: any, data: Partial<T>, params?: ServiceParams): Promise<T>;
  remove(id: any, params?: ServiceParams): Promise<T>;
  setup(app?: FliteInstance, name?: string): Promise<void>;
  teardown(app?: FliteInstance, name?: string): Promise<void>;
  [key: string]: any;
}

// Channel types
export interface ChannelConnection {
  conn: any;
  data: any;
}

export interface ChannelFilter {
  send(event: string, data?: any): void;
}

export interface Channel {
  connections: Set<ChannelConnection>;
  join(conn: any, data?: any): Channel;
  leave(conn: any): Channel;
  send(event: string, data?: any): Channel;
  filter(fn: (connData: any, eventData: any) => boolean): ChannelFilter;
}

// Request types
export interface FliteRequest extends Request {
  params: { [key: string]: string };
  query: { [key: string]: string };
  proxy?: Request;
}

// Handler types
export type RouteHandler = (request: FliteRequest, ...args: any[]) => any;
export type ErrorHandler = (error: Error, request: FliteRequest, ...args: any[]) => any;

export interface RouteHandlers {
  all?: RouteHandler[];
  get?: RouteHandler[];
  post?: RouteHandler[];
  put?: RouteHandler[];
  patch?: RouteHandler[];
  delete?: RouteHandler[];
  head?: RouteHandler[];
  options?: RouteHandler[];
  [key: string]: RouteHandler[] | undefined;
}

export interface ErrorHandlers {
  all?: ErrorHandler[];
  get?: ErrorHandler[];
  post?: ErrorHandler[];
  put?: ErrorHandler[];
  patch?: ErrorHandler[];
  delete?: ErrorHandler[];
  head?: ErrorHandler[];
  options?: ErrorHandler[];
  [key: string]: ErrorHandler[] | undefined;
}

// Flite configuration
export interface FliteConfig {
  routes?: any[];
  format?: false | ((body: any) => Response | undefined);
  mode?: number;
  // services?: Map<string, ServiceWrapper>;
  // events?: Map<string, Function[]>;
  // channels?: Map<string, Channel>;
  // hooks?: Hooks;
  // before?: RouteHandlers;
  // after?: RouteHandlers;
  // error?: ErrorHandlers;
}

// Flite instance
export interface FliteInstance {
  routes: any[];

  // HTTP methods (dynamically generated via Proxy)
  get(route: string, ...handlers: RouteHandler[]): this;
  post(route: string, ...handlers: RouteHandler[]): this;
  put(route: string, ...handlers: RouteHandler[]): this;
  patch(route: string, ...handlers: RouteHandler[]): this;
  delete(route: string, ...handlers: RouteHandler[]): this;
  head(route: string, ...handlers: RouteHandler[]): this;
  options(route: string, ...handlers: RouteHandler[]): this;
  all(route: string, ...handlers: RouteHandler[]): this;
  trace(route: string, ...handlers: RouteHandler[]): this;
  connect(route: string, ...handlers: RouteHandler[]): this;
  [method: string]: any;

  // Use method (special handling)
  use(handler: RouteHandler, ...handlers: RouteHandler[]): this;
  use(route: string, ...handlers: (RouteHandler | FliteInstance)[]): this;

  // Events
  on(event: string, handler: (...args: any[]) => void): this;
  off(event: string, handler: (...args: any[]) => void): this;
  emit(event: string, ...args: any[]): this;

  // Channels
  channel(name: string): Channel;

  // Services
  service<T = any>(name: string): ServiceWrapper<T>;
  service<T = any>(name: string, service: Service<T>): ServiceWrapper<T>;

  // Lifecycle
  teardown(): Promise<this>;
  hooks(hooks: Hooks): this;

  // Fetch handler
  fetch(request: Request, ...args: any[]): Promise<Response>;
}

// Flite factory
export function flite(config?: FliteConfig): FliteInstance;