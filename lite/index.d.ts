// core.d.ts - Extends nano + adds hooks

import type { IRequest, FliteApp } from '../nano';

export * from '../nano';

export type BeforeHook<Req = IRequest> =
    | ((req: Req, ...args: any[]) => void | Response | Promise<void | Response>)
    | ((req: Req, ...args: any[], next: (err?: any) => Promise<void>) => void | Response | Promise<void | Response>);

export type AfterHook<Req = IRequest> =
    | ((res: any, req: Req, ...args: any[]) => any | Promise<any>)
    | ((res: any, req: Req, ...args: any[], next: (err?: any) => Promise<void>) => any | Promise<any>);

export type ErrorHook<Req = IRequest> =
    | ((err: Error, req: Req, ...args: any[]) => Response | void | Promise<Response | void>)
    | ((err: Error, req: Req, ...args: any[], next: (err?: any) => Promise<void>) => Response | void | Promise<Response | void>);

export interface HooksConfig<Req = IRequest> {
    before?: {
        all?: BeforeHook<Req>[];
        get?: BeforeHook<Req>[];
        post?: BeforeHook<Req>[];
        put?: BeforeHook<Req>[];
        patch?: BeforeHook<Req>[];
        delete?: BeforeHook<Req>[];
        [method: string]: BeforeHook<Req>[] | undefined;
    };
    after?: {
        all?: AfterHook<Req>[];
        get?: AfterHook<Req>[];
        post?: AfterHook<Req>[];
        put?: AfterHook<Req>[];
        patch?: AfterHook<Req>[];
        delete?: AfterHook<Req>[];
        [method: string]: AfterHook<Req>[] | undefined;
    };
    error?: {
        all?: ErrorHook<Req>[];
        get?: ErrorHook<Req>[];
        post?: ErrorHook<Req>[];
        put?: ErrorHook<Req>[];
        patch?: ErrorHook<Req>[];
        delete?: ErrorHook<Req>[];
        [method: string]: ErrorHook<Req>[] | undefined;
    };
}

export interface FliteConfigWithHooks<Req = IRequest> extends HooksConfig<Req> {
    routes?: any[];
    mode?: 0 | 1;
    [key: string]: any;
}

export function flite<Req = IRequest>(config?: FliteConfigWithHooks<Req>): FliteApp<Req>;