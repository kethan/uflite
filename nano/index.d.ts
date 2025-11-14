// nano.d.ts - Minimal router only

export type IRequest = Request & {
    params?: Record<string, string>;
    query?: Record<string, string | string[]>;
};

export type RouteHandler<Req = IRequest> =
    | ((req: Req, ...args: any[]) => Response | any | Promise<Response | any>)
    | ((req: Req, ...args: any[], next: (err?: any) => Promise<void>) => Response | any | Promise<Response | any>);

export interface FliteConfig<Req = IRequest> {
    routes?: any[];
    mode?: 0 | 1;
    [key: string]: any;
}

export interface FliteApp<Req = IRequest> {
    routes: any[];

    GET(path: string, ...handlers: RouteHandler<Req>[]): this;
    POST(path: string, ...handlers: RouteHandler<Req>[]): this;
    PUT(path: string, ...handlers: RouteHandler<Req>[]): this;
    PATCH(path: string, ...handlers: RouteHandler<Req>[]): this;
    DELETE(path: string, ...handlers: RouteHandler<Req>[]): this;
    HEAD(path: string, ...handlers: RouteHandler<Req>[]): this;
    OPTIONS(path: string, ...handlers: RouteHandler<Req>[]): this;
    ALL(path: string, ...handlers: RouteHandler<Req>[]): this;

    get(path: string, ...handlers: RouteHandler<Req>[]): this;
    post(path: string, ...handlers: RouteHandler<Req>[]): this;
    put(path: string, ...handlers: RouteHandler<Req>[]): this;
    patch(path: string, ...handlers: RouteHandler<Req>[]): this;
    delete(path: string, ...handlers: RouteHandler<Req>[]): this;
    head(path: string, ...handlers: RouteHandler<Req>[]): this;
    options(path: string, ...handlers: RouteHandler<Req>[]): this;
    all(path: string, ...handlers: RouteHandler<Req>[]): this;

    USE(handler: RouteHandler<Req>): this;
    USE(...handlers: RouteHandler<Req>[]): this;
    USE(path: string, handler: RouteHandler<Req> | FliteApp<Req>): this;
    USE(path: string, ...handlers: Array<RouteHandler<Req> | FliteApp<Req>>): this;
    use(handler: RouteHandler<Req>): this;
    use(...handlers: RouteHandler<Req>[]): this;
    use(path: string, handler: RouteHandler<Req> | FliteApp<Req>): this;
    use(path: string, ...handlers: Array<RouteHandler<Req> | FliteApp<Req>>): this;

    fetch(request: Request, ...args: any[]): Promise<Response | undefined>;
}

export function run<T = any>(mode?: 0 | 1): (...handlers: Function[]) => (...args: any[]) => Promise<T | undefined>;

export function flite<Req = IRequest>(config?: FliteConfig<Req>): FliteApp<Req>;
// No default export; use named export `flite`