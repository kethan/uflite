export type Middleware = (request: Request, next?: () => Promise<unknown>) => unknown | Promise<unknown>;
export type AfterMiddleware = (response: Response, request: Request, next?: () => Promise<unknown>) => Response | Promise<Response>;

export interface CorsOptions {
  origin?: string | string[] | RegExp;
  methods?: string[];
  credentials?: boolean;
  maxAge?: number;
  allowedHeaders?: string[];
  exposedHeaders?: string[];
}
export function cors(options?: CorsOptions): Middleware;
export const corsAfter: AfterMiddleware;

export interface LoggerOptions {
  format?: 'dev' | 'combined' | 'json';
  skip?: (request: Request) => boolean;
}
export function logger(options?: LoggerOptions): Middleware;
export const loggerAfter: AfterMiddleware;

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  keyGenerator?: (request: Request) => string;
  standardHeaders?: boolean;
}
export function rateLimit(options?: RateLimitOptions): Middleware;
export const rateLimitAfter: AfterMiddleware;

export interface BearerAuthOptions {
  token?: string;
  verify?: (token: string) => boolean | Promise<boolean>;
  realm?: string;
}
export function bearerAuth(options?: BearerAuthOptions): Middleware;
export function bodyLimit(options?: { max?: number | string }): Middleware;

export interface SecureHeadersOptions {
  contentSecurityPolicy?: string | false;
  xFrameOptions?: string | false;
  strictTransportSecurity?: string | false;
  xContentTypeOptions?: boolean;
  referrerPolicy?: string | false;
}
export function secureHeaders(options?: SecureHeadersOptions): Middleware;
export const secureHeadersAfter: AfterMiddleware;

export interface RequestIdOptions {
  header?: string;
  generator?: () => string;
}
export function requestId(options?: RequestIdOptions): Middleware;
export const requestIdAfter: AfterMiddleware;

export interface BasicAuthOptions {
  users: Record<string, string>;
  realm?: string;
}
export function basicAuth(options?: BasicAuthOptions): Middleware;
