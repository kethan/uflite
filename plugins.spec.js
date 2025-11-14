// utils.spec.js - 39 comprehensive test cases

import { describe, it, expect, beforeEach } from "bun:test";
import { events, channels, lead, mount, compile, run } from "./plugins.js";
import { flite } from "./nano/index.js";

// ============================================
// RUN FUNCTION - 8 tests
// ============================================
describe("run() function", () => {
    it("mode 0: executes handlers sequentially", async () => {
        const calls = [];
        const handlers = [
            () => { calls.push(1); },
            () => { calls.push(2); },
            () => { calls.push(3); }
        ];

        await run(0)(...handlers)();
        expect(calls).toEqual([1, 2, 3]);
    });

    it("mode 0: stops at first non-null return", async () => {
        const calls = [];
        const handlers = [
            () => { calls.push(1); },
            () => { calls.push(2); return 'stop'; },
            () => { calls.push(3); }
        ];

        const result = await run(0)(...handlers)();
        expect(calls).toEqual([1, 2]);
        expect(result).toBe('stop');
    });

    it("mode 0: continues on null/undefined returns", async () => {
        const calls = [];
        const handlers = [
            () => { calls.push(1); return null; },
            () => { calls.push(2); return undefined; },
            () => { calls.push(3); return 'done'; }
        ];

        const result = await run(0)(...handlers)();
        expect(calls).toEqual([1, 2, 3]);
        expect(result).toBe('done');
    });

    it('run() function - Hono-style onion pattern', async () => {
        const calls = [];

        const handlers = [
            async (req, next) => {
                calls.push('mw1-start');
                await next();
                calls.push('mw1-end');
            },
            async (req, next) => {
                calls.push('mw2-start');
                await next();
                calls.push('mw2-end');
            },
            async (req, next) => {
                calls.push('mw3-start');
                await next();
                calls.push('mw3-end');
            },
            async (req) => {
                calls.push('handler');
                return { success: true };
            }
        ];

        const result = await run(1)(handlers)({ url: 'http://localhost/test' });

        expect(calls).toEqual([
            'mw1-start',
            'mw2-start',
            'mw3-start',
            'handler',
            'mw3-end',
            'mw2-end',
            'mw1-end'
        ]);
        expect(result).toEqual({ success: true });
    });

    it("mode 1: executes in onion pattern", async () => {
        const calls = [];
        const handlers = [
            async (req, next) => {
                calls.push('→1');
                await next();
                calls.push('←1');
            },
            async (req, next) => {
                calls.push('→2');
                await next();
                calls.push('←2');
            },
            () => {
                calls.push('handler');
                return 'result';
            }
        ];

        const result = await run(1)(...handlers)({});
        expect(calls).toEqual(['→1', '→2', 'handler', '←2', '←1']);
        expect(result).toBe('result');
    });

    it("mode 1: preserves result when middleware doesn't return", async () => {
        const handlers = [
            async (req, next) => {
                await next();
                // ✅ No return, result preserved
            },
            () => 'original'
        ];

        const result = await run(1)(...handlers)({});
        expect(result).toBe('original'); // ✅ Preserved
    });

    it("flattens nested arrays", async () => {
        const calls = [];
        const handlers = [
            () => { calls.push(1); },
            [() => { calls.push(2); }, () => { calls.push(3); }],
            [[() => { calls.push(4); }]]
        ];

        await run(0)(...handlers)();
        expect(calls).toEqual([1, 2, 3, 4]);
    });

    it("filters non-callable values", async () => {
        const calls = [];
        const handlers = [
            () => { calls.push(1); },
            null,
            undefined,
            'string',
            42,
            () => { calls.push(2); }
        ];

        await run(0)(...handlers)();
        expect(calls).toEqual([1, 2]);
    });

    it("propagates errors via next(err) in mode 1", async () => {
        const handlers = [
            async (req, next) => {
                await next('error message');
            }
        ];

        await expect(run(1)(...handlers)({})).rejects.toBe('error message');
    });
});

// ============================================
// LEAD FUNCTION - 4 tests
// ============================================
describe("lead() function", () => {
    it("adds leading slash when missing", () => {
        expect(lead('users')).toBe('/users');
        expect(lead('api/v1')).toBe('/api/v1');
    });

    it("preserves existing leading slash", () => {
        expect(lead('/users')).toBe('/users');
        expect(lead('/api/v1')).toBe('/api/v1');
    });

    it("handles empty string", () => {
        expect(lead('')).toBe('/');
    });

    it("handles root path", () => {
        expect(lead('/')).toBe('/');
    });
});

// ============================================
// MOUNT FUNCTION - 3 tests
// ============================================
describe("mount() function", () => {
    it("extracts fetch from object with fetch property", () => {
        const obj = {
            fetch: () => 'fetched',
            other: 'prop'
        };
        const result = mount(obj);
        expect(result()).toBe('fetched');
    });

    it("returns function as-is if no fetch property", () => {
        const fn = () => 'direct';
        expect(mount(fn)).toBe(fn);
        expect(mount(fn)()).toBe('direct');
    });

    it("handles null/undefined", () => {
        expect(mount(null)).toBe(null);
        expect(mount(undefined)).toBe(undefined);
    });
});

// ============================================
// COMPILE FUNCTION - 8 tests
// ============================================
describe("compile() function", () => {
    it("compiles static paths", () => {
        const regex = compile('/users');
        expect(regex.test('/users')).toBe(true);
        expect(regex.test('/users/')).toBe(true);
        expect(regex.test('/posts')).toBe(false);
    });

    it("compiles paths with single param", () => {
        const regex = compile('/users/:id');
        const match = '/users/123'.match(regex);

        expect(match).toBeTruthy();
        expect(match?.groups?.id).toBe('123');
    });

    it("compiles paths with multiple params", () => {
        const regex = compile('/teams/:teamId/users/:userId');
        const match = '/teams/abc/users/xyz'.match(regex);

        expect(match).toBeTruthy();
        expect(match?.groups?.teamId).toBe('abc');
        expect(match?.groups?.userId).toBe('xyz');
    });

    it("compiles wildcard paths", () => {
        const regex = compile('/files/*');
        expect(regex.test('/files/path/to/file.txt')).toBe(true);
        expect(regex.test('/files/')).toBe(true);
        expect(regex.test('/files')).toBe(true);
    });

    it("compiles root wildcard", () => {
        const regex = compile('*');
        expect(regex.test('/anything')).toBe(true);
        expect(regex.test('/nested/path')).toBe(true);
        expect(regex.test('/')).toBe(true);
    });

    it("normalizes trailing slashes", () => {
        const regex = compile('/users/');
        expect(regex.test('/users')).toBe(true);
        expect(regex.test('/users/')).toBe(true);
    });

    it("normalizes double slashes", () => {
        const regex = compile('//users//posts');
        expect(regex.test('/users/posts')).toBe(true);
    });

    it("handles params with special characters in value", () => {
        const regex = compile('/files/:name');
        const match = '/files/script.min.js'.match(regex);

        expect(match?.groups?.name).toBe('script.min.js');
    });
});

// ============================================
// EVENTS PLUGIN - 8 tests
// ============================================
describe("events plugin", () => {
    let app;

    beforeEach(() => {
        app = events(flite());
    });

    it("registers event listener with on()", () => {
        const calls = [];
        app.on('test', (data) => { calls.push(data); });
        app.emit('test', 'hello');

        expect(calls).toEqual(['hello']);
    });

    it("supports multiple listeners for same event", () => {
        const calls = [];
        app.on('test', () => { calls.push(1); });
        app.on('test', () => { calls.push(2); });
        app.emit('test');

        expect(calls).toEqual([1, 2]);
    });

    it("passes multiple arguments to listeners", () => {
        let received;
        app.on('test', (a, b, c) => { received = [a, b, c]; });
        app.emit('test', 1, 2, 3);

        expect(received).toEqual([1, 2, 3]);
    });

    it("removes listener with off()", () => {
        const calls = [];
        const handler = () => { calls.push(1); };

        app.on('test', handler);
        app.emit('test');
        app.off('test', handler);
        app.emit('test');

        expect(calls).toEqual([1]); // Only first emit
    });

    it("off() only removes specific handler", () => {
        const calls = [];
        const h1 = () => { calls.push(1); };
        const h2 = () => { calls.push(2); };

        app.on('test', h1);
        app.on('test', h2);
        app.off('test', h1);
        app.emit('test');

        expect(calls).toEqual([2]); // Only h2
    });

    it("handles non-existent events gracefully", () => {
        expect(() => app.emit('nonexistent')).not.toThrow();
        expect(() => app.off('nonexistent', () => { })).not.toThrow();
    });

    it("returns app for chaining", () => {
        const result = app.on('test', () => { });
        expect(result).toBe(app);

        const result2 = app.off('test', () => { });
        expect(result2).toBe(app);

        const result3 = app.emit('test');
        expect(result3).toBe(app);
    });

    it("listeners are isolated per event", () => {
        const calls = [];
        app.on('event1', () => { calls.push('e1'); });
        app.on('event2', () => { calls.push('e2'); });

        app.emit('event1');
        expect(calls).toEqual(['e1']);

        app.emit('event2');
        expect(calls).toEqual(['e1', 'e2']);
    });
});

// ============================================
// CHANNELS PLUGIN - 8 tests
// ============================================
describe("channels plugin", () => {
    let app;

    beforeEach(() => {
        app = channels(flite());
    });

    it("creates channel on first access", () => {
        const channel = app.channel('chat');
        expect(channel).toBeDefined();
        expect(channel.connections).toBeInstanceOf(Set);
    });

    it("returns same channel on subsequent access", () => {
        const ch1 = app.channel('chat');
        const ch2 = app.channel('chat');
        expect(ch1).toBe(ch2);
    });

    it("joins connection to channel", () => {
        const channel = app.channel('chat');
        const conn = { id: 1, send: () => { } };

        channel.join(conn, { userId: 'user1' });
        expect(channel.connections.size).toBe(1);
    });

    it("leaves connection from channel", () => {
        const channel = app.channel('chat');
        const conn = { id: 1, send: () => { } };

        channel.join(conn);
        expect(channel.connections.size).toBe(1);

        channel.leave(conn);
        expect(channel.connections.size).toBe(0);
    });

    it("sends message to all connections", () => {
        const channel = app.channel('chat');
        const messages = [];

        const conn1 = { send: (msg) => { messages.push(['c1', msg]); } };
        const conn2 = { send: (msg) => { messages.push(['c2', msg]); } };

        channel.join(conn1).join(conn2);
        channel.send('message', { text: 'Hello' });

        expect(messages).toEqual([
            ['c1', JSON.stringify({ event: 'message', data: { text: 'Hello' } })],
            ['c2', JSON.stringify({ event: 'message', data: { text: 'Hello' } })]
        ]);
    });

    it("filters connections before sending", () => {
        const channel = app.channel('chat');
        const messages = [];

        const conn1 = { send: (msg) => { messages.push('c1'); } };
        const conn2 = { send: (msg) => { messages.push('c2'); } };

        channel.join(conn1, { userId: 'user1' });
        channel.join(conn2, { userId: 'user2' });

        channel.filter((connData, eventData) => connData.userId === eventData.targetUser)
            .send('private', { targetUser: 'user1', text: 'Secret' });

        expect(messages).toEqual(['c1']); // Only user1
    });

    it("supports method chaining", () => {
        const channel = app.channel('chat');
        const conn = { send: () => { } };

        const result = channel.join(conn);
        expect(result).toBe(channel);

        const result2 = channel.leave(conn);
        expect(result2).toBe(channel);

        const result3 = channel.send('test', {});
        expect(result3).toBe(channel);
    });

    it("handles connections without send method", () => {
        const channel = app.channel('chat');
        const conn = { id: 1 }; // No send method

        channel.join(conn);
        expect(() => channel.send('test', {})).not.toThrow();
    });
});