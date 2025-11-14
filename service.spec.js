import { describe, it, expect, beforeEach } from "bun:test";
import { flite } from "./src/index.js";
import { services } from './plugins.js';

const makeRequest = (path, method = "GET", body) =>
    new Request("http://localhost" + path, {
        method,
        body: body ? JSON.stringify(body) : undefined,
        headers: { "content-type": "application/json" },
    });

describe("Services Plugin - Basic CRUD", () => {
    let app;

    beforeEach(() => {
        app = services(flite({ mode: 0 }));
    });

    it("registers a service and auto-creates routes", async () => {
        const userService = {
            find: async (params) => [{ id: 1, name: 'Alice' }],
            get: async (id, params) => ({ id, name: 'Alice' }),
            create: async (data, params) => ({ id: 2, ...data }),
            patch: async (id, data, params) => ({ id, ...data }),
            update: async (id, data, params) => ({ id, ...data }),
            remove: async (id, params) => ({ id, deleted: true })
        };

        const users = app.service('users', userService);

        // Test auto-registered routes
        const res1 = await app.fetch(makeRequest("/users"));
        expect(await res1.json()).toEqual([{ id: 1, name: 'Alice' }]);

        const res2 = await app.fetch(makeRequest("/users/123"));
        expect(await res2.json()).toEqual({ id: '123', name: 'Alice' });

        const res3 = await app.fetch(makeRequest("/users", "POST", { name: 'Bob' }));
        expect(await res3.json()).toEqual({ id: 2, name: 'Bob' });

        const res4 = await app.fetch(makeRequest("/users/123", "PATCH", { name: 'Updated' }));
        expect(await res4.json()).toEqual({ id: '123', name: 'Updated' });

        const res5 = await app.fetch(makeRequest("/users/123", "PUT", { name: 'Replaced' }));
        expect(await res5.json()).toEqual({ id: '123', name: 'Replaced' });

        const res6 = await app.fetch(makeRequest("/users/123", "DELETE"));
        expect(await res6.json()).toEqual({ id: '123', deleted: true });
    });

    it("can call service methods directly", async () => {
        const userService = {
            find: async () => [{ id: 1 }],
            create: async (data) => ({ id: 2, ...data })
        };

        const users = app.service('users', userService);

        const result1 = await users.find();
        expect(result1).toEqual([{ id: 1 }]);

        const result2 = await users.create({ name: 'Direct' });
        expect(result2).toEqual({ id: 2, name: 'Direct' });
    });

    it("retrieves registered service", async () => {
        const userService = {
            find: async () => [{ id: 1 }]
        };

        app.service('users', userService);

        const users = app.service('users');
        const result = await users.find();
        expect(result).toEqual([{ id: 1 }]);
    });

    it("throws error for non-existent service", () => {
        expect(() => app.service('nope')).toThrow("Service 'nope' not found");
    });
});

describe("Services Plugin - Service Hooks", () => {
    let app;

    beforeEach(() => {
        app = services(flite({ mode: 0 }));
    });

    it("runs service-level before hooks", async () => {
        const calls = [];
        const userService = {
            create: async (data) => ({ id: 1, ...data })
        };

        const users = app.service('users', userService);
        users.hooks({
            before: {
                create: [
                    ctx => { calls.push('before-1'); return ctx; },
                    ctx => { calls.push('before-2'); return ctx; }
                ]
            }
        });

        await users.create({ name: 'Test' });
        expect(calls).toEqual(['before-1', 'before-2']);
    });

    it("can modify data in before hooks", async () => {
        const userService = {
            create: async (data) => data
        };

        const users = app.service('users', userService);
        users.hooks({
            before: {
                create: [ctx => {
                    ctx.data.createdAt = 12345;
                    return ctx;
                }]
            }
        });

        const result = await users.create({ name: 'Test' });
        expect(result).toEqual({ name: 'Test', createdAt: 12345 });
    });

    it("runs service-level after hooks", async () => {
        const calls = [];
        const userService = {
            create: async (data) => ({ id: 1, ...data })
        };

        const users = app.service('users', userService);
        users.hooks({
            after: {
                create: [
                    ctx => { calls.push('after-1'); return ctx; },
                    ctx => { calls.push('after-2'); return ctx; }
                ]
            }
        });

        await users.create({ name: 'Test' });
        expect(calls).toEqual(['after-1', 'after-2']);
    });

    it("can modify result in after hooks", async () => {
        const userService = {
            create: async (data) => ({ id: 1, ...data })
        };

        const users = app.service('users', userService);
        users.hooks({
            after: {
                create: [ctx => {
                    ctx.result.modified = true;
                    return ctx;
                }]
            }
        });

        const result = await users.create({ name: 'Test' });
        expect(result).toEqual({ id: 1, name: 'Test', modified: true });
    });

    it("runs before.all and before.method", async () => {
        const calls = [];
        const userService = {
            create: async (data) => ({ id: 1, ...data })
        };

        const users = app.service('users', userService);
        users.hooks({
            before: {
                all: [ctx => { calls.push('all'); return ctx; }],
                create: [ctx => { calls.push('create'); return ctx; }]
            }
        });

        await users.create({ name: 'Test' });
        expect(calls).toEqual(['all', 'create']);
    });

    it("runs after.method and after.all (reversed)", async () => {
        const calls = [];
        const userService = {
            create: async (data) => ({ id: 1, ...data })
        };

        const users = app.service('users', userService);
        users.hooks({
            after: {
                create: [ctx => { calls.push('create'); return ctx; }],
                all: [ctx => { calls.push('all'); return ctx; }]
            }
        });

        await users.create({ name: 'Test' });
        expect(calls).toEqual(['create', 'all']);
    });
});

describe("Services Plugin - App Hooks", () => {
    let app;

    beforeEach(() => {
        app = services(flite({ mode: 0 }));
    });

    it("runs app-level before hooks", async () => {
        const calls = [];

        app.hooks({
            before: {
                all: [ctx => { calls.push('app-before'); return ctx; }]
            }
        });

        const users = app.service('users', {
            create: async (data) => ({ id: 1, ...data })
        });

        await users.create({ name: 'Test' });
        expect(calls).toEqual(['app-before']);
    });

    it("runs app hooks before service hooks", async () => {
        const calls = [];

        app.hooks({
            before: {
                create: [ctx => { calls.push('app'); return ctx; }]
            }
        });

        const users = app.service('users', {
            create: async (data) => ({ id: 1, ...data })
        });

        users.hooks({
            before: {
                create: [ctx => { calls.push('service'); return ctx; }]
            }
        });

        await users.create({ name: 'Test' });
        expect(calls).toEqual(['app', 'service']);
    });

    it("runs service hooks before app hooks in after (reversed)", async () => {
        const calls = [];

        app.hooks({
            after: {
                create: [ctx => { calls.push('app'); return ctx; }]
            }
        });

        const users = app.service('users', {
            create: async (data) => ({ id: 1, ...data })
        });

        users.hooks({
            after: {
                create: [ctx => { calls.push('service'); return ctx; }]
            }
        });

        await users.create({ name: 'Test' });
        expect(calls).toEqual(['service', 'app']);
    });

    it("complete hook order: app.before → service.before → method → service.after → app.after", async () => {
        const calls = [];

        app.hooks({
            before: {
                all: [ctx => { calls.push('1-app-before-all'); return ctx; }],
                create: [ctx => { calls.push('2-app-before-create'); return ctx; }]
            },
            after: {
                create: [ctx => { calls.push('6-app-after-create'); return ctx; }],
                all: [ctx => { calls.push('7-app-after-all'); return ctx; }]
            }
        });

        const users = app.service('users', {
            create: async (data) => {
                calls.push('>>>METHOD');
                return { id: 1, ...data };
            }
        });

        users.hooks({
            before: {
                all: [ctx => { calls.push('3-svc-before-all'); return ctx; }],
                create: [ctx => { calls.push('4-svc-before-create'); return ctx; }]
            },
            after: {
                create: [ctx => { calls.push('5-svc-after-create'); return ctx; }],
                all: [ctx => { calls.push('5.5-svc-after-all'); return ctx; }]
            }
        });

        await users.create({ name: 'Test' });
        expect(calls).toEqual([
            '1-app-before-all',
            '2-app-before-create',
            '3-svc-before-all',
            '4-svc-before-create',
            '>>>METHOD',
            '5-svc-after-create',
            '5.5-svc-after-all',
            '6-app-after-create',
            '7-app-after-all'
        ]);
    });
});

describe("Services Plugin - Events", () => {
    let app;

    beforeEach(() => {
        app = services(flite({ mode: 0 }));
    });

    it("emits 'created' event", async () => {
        const emitted = [];
        const users = app.service('users', {
            create: async (data) => ({ id: 1, ...data })
        });

        users.on('created', user => emitted.push(user));
        await users.create({ name: 'Test' });

        expect(emitted).toEqual([{ id: 1, name: 'Test' }]);
    });

    it("emits 'patched' event", async () => {
        const emitted = [];
        const users = app.service('users', {
            patch: async (id, data) => ({ id, ...data })
        });

        users.on('patched', user => emitted.push(user));
        await users.patch(1, { name: 'Updated' });

        expect(emitted).toEqual([{ id: 1, name: 'Updated' }]);
    });

    it("emits 'updated' event", async () => {
        const emitted = [];
        const users = app.service('users', {
            update: async (id, data) => ({ id, ...data })
        });

        users.on('updated', user => emitted.push(user));
        await users.update(1, { name: 'Replaced' });

        expect(emitted).toEqual([{ id: 1, name: 'Replaced' }]);
    });

    it("emits 'removed' event", async () => {
        const emitted = [];
        const users = app.service('users', {
            remove: async (id) => ({ id, deleted: true })
        });

        users.on('removed', user => emitted.push(user));
        await users.remove(1);

        expect(emitted).toEqual([{ id: 1, deleted: true }]);
    });

    it("supports multiple listeners", async () => {
        const calls = [];
        const users = app.service('users', {
            create: async (data) => ({ id: 1, ...data })
        });

        users.on('created', () => calls.push('listener-1'));
        users.on('created', () => calls.push('listener-2'));

        await users.create({ name: 'Test' });
        expect(calls).toEqual(['listener-1', 'listener-2']);
    });
});

describe("Services Plugin - Custom Methods", () => {
    let app;

    beforeEach(() => {
        app = services(flite({ mode: 0 }));
    });

    it("supports custom methods", async () => {
        const users = app.service('users', {
            sendEmail: async (userId, emailData) => {
                return { sent: true, to: userId, ...emailData };
            }
        });

        const result = await users.sendEmail(123, { subject: 'Hello' });
        expect(result).toEqual({ sent: true, to: 123, subject: 'Hello' });
    });

    it("custom methods go through hooks", async () => {
        const calls = [];
        const users = app.service('users', {
            customMethod: async (arg) => ({ result: arg })
        });

        users.hooks({
            before: {
                customMethod: [ctx => { calls.push('before'); return ctx; }]
            },
            after: {
                customMethod: [ctx => { calls.push('after'); return ctx; }]
            }
        });

        await users.customMethod('test');
        expect(calls).toEqual(['before', 'after']);
    });
});

describe("Services Plugin - Lifecycle", () => {
    let app;

    beforeEach(() => {
        app = services(flite({ mode: 0 }));
    });

    it("calls setup on service registration", async () => {
        const calls = [];
        const userService = {
            setup: (app, name) => calls.push(`setup:${name}`),
            find: async () => []
        };

        app.service('users', userService);
        expect(calls).toEqual(['setup:users']);
    });

    it("calls teardown on app.teardown()", async () => {
        const calls = [];
        const userService = {
            teardown: (app, name) => { calls.push(`teardown:${name}`) },
            find: async () => []
        };

        const users = app.service('users', userService);
        app.teardown();

        expect(calls).toEqual(['teardown:users']);
    });

    // it('Global middleware', async () => {
    //     const app = flite({
    //         before: {
    //             all: [(req) => { req.timestamp = Date.now(); }]
    //         },
    //         after: {
    //             all: [(res, req) => json(res, {
    //                 headers: {
    //                     'X-Timestamp': String(req.timestamp),
    //                 }
    //             })]
    //         }
    //     });

    //     app.get('/test', () => ({ ok: true }));

    //     const res = await app.fetch(makeRequest("/test"));
    //     expect(res.headers.has('X-Timestamp')).toBe(true);
    // });

    // it("teardown all services", async () => {
    //     const calls = [];

    //     app.service('users', {
    //         teardown: () => { calls.push('users') },
    //         find: async () => []
    //     });

    //     app.service('posts', {
    //         teardown: () => { calls.push('posts') },
    //         find: async () => []
    //     });

    //     await app.teardown();
    //     expect(calls).toContain('users');
    //     expect(calls).toContain('posts');
    // });
});

describe("Services Plugin - Context", () => {
    it("provides full context to hooks", async () => {
        const app = services(flite({ mode: 0 }));
        let capturedCtx;

        const users = app.service('users', {
            create: async (data, params) => ({ id: 1, ...data })
        });

        users.hooks({
            before: {
                create: [ctx => {
                    capturedCtx = ctx;
                    return ctx;
                }]
            }
        });

        await users.create({ name: 'Test' }, { userId: 123 });

        expect(capturedCtx.app).toBe(app);
        expect(capturedCtx.method).toBe('create');
        expect(capturedCtx.path).toBe('users');
        expect(capturedCtx.data).toEqual({ name: 'Test' });
        expect(capturedCtx.params).toEqual({ userId: 123 });
    });

    it("includes result in after hook context", async () => {
        const app = services(flite({ mode: 0 }));
        let capturedCtx;

        const users = app.service('users', {
            create: async (data) => ({ id: 1, ...data })
        });

        users.hooks({
            after: {
                create: [ctx => {
                    capturedCtx = ctx;
                    return ctx;
                }]
            }
        });

        await users.create({ name: 'Test' });

        expect(capturedCtx.result).toEqual({ id: 1, name: 'Test' });
    });
});