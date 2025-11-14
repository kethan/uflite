// full.d.ts - Complete with services, events, channels

import type { FliteApp } from '../nano';
import type { FliteConfigWithHooks } from '../lite';

export * from '../lite';

// ============================================
// RESPONSE HELPERS
// ============================================

export interface ResponseOptions {
    status?: number;
    headers?: Record<string, string>;
    [key: string]: any;
}

export function response(
    format?: string,
    transform?: (body: any) => any
): (body: any, options?: ResponseOptions) => Response | undefined;

export function text(body: any, options?: ResponseOptions): Response | undefined;
export function html(body: any, options?: ResponseOptions): Response | undefined;
export function json(body: any, options?: ResponseOptions): Response | undefined;
export function error(status: number, message?: string | object): Response;
export function error(err: Error & { status?: number }): Response;

export class status extends Error {
    status: number;
    constructor(status: number, message?: string, data?: any);
}

// ============================================
// EVENTS
// ============================================

export interface EventsApp {
    on(event: string, handler: (...args: any[]) => void): this;
    off(event: string, handler: (...args: any[]) => void): this;
    emit(event: string, ...args: any[]): this;
}

export function events<T extends FliteApp>(app: T): T & EventsApp;

// ============================================
// CHANNELS
// ============================================

export interface Connection {
    send?(message: string): void;
    [key: string]: any;
}

export interface Channel {
    connections: Set<{ conn: Connection; data?: any }>;
    join(conn: Connection, data?: any): this;
    leave(conn: Connection): this;
    send(event: string, data: any): this;
    filter(fn: (connData: any, eventData: any) => boolean): {
        send(event: string, data: any): void;
    };
}

export interface ChannelsApp {
    channel(name: string): Channel;
}

export function channels<T extends FliteApp>(app: T): T & ChannelsApp;

// ============================================
// SERVICES
// ============================================

export interface Params {
    [key: string]: any;
}

export interface HookContext<T = any> {
    app: any;
    service: any;
    method: string;
    path: string;
    params: Params;
    id?: string | number;
    data?: any;
    result?: T;
}

export type ServiceHook<T = any> =
    | ((context: HookContext<T>) => void | HookContext<T> | Promise<void | HookContext<T>>)
    | ((context: HookContext<T>, next: (err?: any) => Promise<void>) => void | HookContext<T> | Promise<void | HookContext<T>>);

export interface ServiceHooks<T = any> {
    before?: {
        all?: ServiceHook<T>[];
        find?: ServiceHook<T>[];
        get?: ServiceHook<T>[];
        create?: ServiceHook<T>[];
        update?: ServiceHook<T>[];
        patch?: ServiceHook<T>[];
        remove?: ServiceHook<T>[];
        [method: string]: ServiceHook<T>[] | undefined;
    };
    after?: {
        all?: ServiceHook<T>[];
        find?: ServiceHook<T>[];
        get?: ServiceHook<T>[];
        create?: ServiceHook<T>[];
        update?: ServiceHook<T>[];
        patch?: ServiceHook<T>[];
        remove?: ServiceHook<T>[];
        [method: string]: ServiceHook<T>[] | undefined;
    };
}

export interface Service<T = any> {
    find?(params?: Params): Promise<T[]> | T[];
    get?(id: string | number, params?: Params): Promise<T> | T;
    create?(data: Partial<T>, params?: Params): Promise<T> | T;
    update?(id: string | number, data: T, params?: Params): Promise<T> | T;
    patch?(id: string | number, data: Partial<T>, params?: Params): Promise<T> | T;
    remove?(id: string | number, params?: Params): Promise<T> | T;
    setup?(app: any, path: string): void | Promise<void>;
    teardown?(app: any, path: string): void | Promise<void>;
    [method: string]: any;
}

export interface ServiceWrapper<T = any> {
    find(params?: Params): Promise<T[]>;
    get(id: string | number, params?: Params): Promise<T>;
    create(data: Partial<T>, params?: Params): Promise<T>;
    update(id: string | number, data: T, params?: Params): Promise<T>;
    patch(id: string | number, data: Partial<T>, params?: Params): Promise<T>;
    remove(id: string | number, params?: Params): Promise<T>;
    on(event: 'created' | 'updated' | 'patched' | 'removed', handler: (data: T) => void): this;
    hooks(hooks: ServiceHooks<T>): this;
    setup(...args: any[]): Promise<void>;
    teardown(...args: any[]): Promise<void>;
    [method: string]: any;
}

export interface ServicesApp {
    service<T = any>(name: string): ServiceWrapper<T>;
    service<T = any>(name: string, service: Service<T>): ServiceWrapper<T>;
    hooks(hooks: ServiceHooks): this;
    teardown(): this;
}

export function services<T extends FliteApp>(app: T): T & ServicesApp;

// ============================================
// FULL FLITE APP
// ============================================

export type FullFliteApp = FliteApp & EventsApp & ChannelsApp & ServicesApp;

export function flite(config?: FliteConfigWithHooks): FullFliteApp;