
import { describe, test, expect, beforeEach } from 'bun:test';
import { flite, json, text, html, error, status } from './src';


// ===== 1. BASIC ROUTING =====
describe('Basic Routing', () => {
  const app = flite();

  app
    .get('/hello/:name', (req) => text(`Hello, ${req.params.name}!`))
    .post('/echo', async (req) => json(await req.json()))
    .put('/update/:id', (req) => json({ id: req.params.id, method: 'PUT' }))
    .patch('/patch/:id', (req) => json({ id: req.params.id, method: 'PATCH' }))
    .delete('/delete/:id', (req) => json({ id: req.params.id, method: 'DELETE' }))
    .all('/any', () => text('Any method'));

  test('GET with path params', async () => {
    const res = await app.fetch(new Request('http://localhost/hello/world'));
    expect(await res.text()).toBe('Hello, world!');
  });

  test('POST with body', async () => {
    const res = await app.fetch(new Request('http://localhost/echo', {
      method: 'POST',
      body: JSON.stringify({ foo: 'bar' })
    }));
    expect(await res.json()).toEqual({ foo: 'bar' });
  });

  test('PUT request', async () => {
    const res = await app.fetch(new Request('http://localhost/update/123', { method: 'PUT' }));
    expect(await res.json()).toEqual({ id: '123', method: 'PUT' });
  });

  test('PATCH request', async () => {
    const res = await app.fetch(new Request('http://localhost/patch/456', { method: 'PATCH' }));
    expect(await res.json()).toEqual({ id: '456', method: 'PATCH' });
  });

  test('DELETE request', async () => {
    const res = await app.fetch(new Request('http://localhost/delete/789', { method: 'DELETE' }));
    expect(await res.json()).toEqual({ id: '789', method: 'DELETE' });
  });

  test('ALL method handler', async () => {
    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    for (const method of methods) {
      const res = await app.fetch(new Request('http://localhost/any', { method }));
      expect(await res.text()).toBe('Any method');
    }
  });
});

// ===== 2. QUERY PARAMETERS =====
describe('Query Parameters', () => {
  const app = flite();
  app.get('/search', (req) => json({ query: req.query }));

  test('Simple query params', async () => {
    const res = await app.fetch(new Request('http://localhost/search?name=john&age=30'));
    const body = await res.json();
    expect(body.query).toEqual({ name: 'john', age: '30' });
  });

  test('Empty query params', async () => {
    const res = await app.fetch(new Request('http://localhost/search'));
    const body = await res.json();
    expect(body.query).toEqual({});
  });

  test('URL encoded values', async () => {
    const res = await app.fetch(new Request('http://localhost/search?email=test%40example.com&name=John%20Doe'));
    const body = await res.json();
    expect(body.query.email).toBe('test@example.com');
    expect(body.query.name).toBe('John Doe');
  });

  test('MongoDB-style complex query', async () => {
    const url = 'http://localhost/search?' +
      '$and[0][field1][$in][0]=value1&' +
      '$and[0][field1][$in][1]=value2&' +
      '$and[0][field1][$gt]=10&' +
      '$limit=20&$skip=10';
    const res = await app.fetch(new Request(url));
    const body = await res.json();
    expect(body.query['$limit']).toBe('20');
    expect(body.query['$skip']).toBe('10');
    expect(body.query['$and[0][field1][$gt]']).toBe('10');
  });
});

// ===== 3. NESTED ROUTERS (4 LEVELS DEEP) =====
describe('Deep Nested Routers', () => {
  const app = flite();

  const greatgrandchild = flite()
    .get('/', () => text('greatgrandchild root'))
    .get('/page', () => text('greatgrandchild page'))
    .all('*', () => text('Not found greatgrandchild'));

  const grandchild = flite()
    .get('/', () => text('grandchild root'))
    .use('/greatgrandchild/:who', greatgrandchild)
    .all('*', () => text('Not found grandchild'));

  const child = flite()
    .get('/', () => text('child root'))
    .use('/grandchild/:bar', grandchild)
    .all('*', () => text('Not found child'));

  app
    .use('/child/:name', child)
    .all('*', () => text('Not found parent'));

  test('Level 1: Child root', async () => {
    const res = await app.fetch(new Request('http://localhost/child/alice'));
    expect(await res.text()).toBe('child root');
  });

  test('Level 2: Grandchild root', async () => {
    const res = await app.fetch(new Request('http://localhost/child/alice/grandchild/bob'));
    expect(await res.text()).toBe('grandchild root');
  });

  test('Level 3: Greatgrandchild root', async () => {
    const res = await app.fetch(new Request('http://localhost/child/alice/grandchild/bob/greatgrandchild/charlie'));
    expect(await res.text()).toBe('greatgrandchild root');
  });

  test('Level 4: Greatgrandchild page', async () => {
    const res = await app.fetch(new Request('http://localhost/child/alice/grandchild/bob/greatgrandchild/charlie/page'));
    expect(await res.text()).toBe('greatgrandchild page');
  });

  test('404 at parent level', async () => {
    const res = await app.fetch(new Request('http://localhost/unknown'));
    expect(await res.text()).toBe('Not found parent');
  });

  test('404 at child level', async () => {
    const res = await app.fetch(new Request('http://localhost/child/alice/unknown'));
    expect(await res.text()).toBe('Not found child');
  });

  test('404 at grandchild level', async () => {
    const res = await app.fetch(new Request('http://localhost/child/alice/grandchild/bob/unknown'));
    expect(await res.text()).toBe('Not found grandchild');
  });
});

// ===== 4. MULTIPLE ROUTERS AT SAME LEVEL =====
describe('Multiple Routers at Same Level', () => {
  const app = flite();

  const wow = flite()
    .get('/wow', () => text('this is wow'))
    .all('/wow/*', () => text('Not found wow'));

  const mom = flite()
    .get('/mom', () => text('this is mom'))
    .all('/mom/*', () => text('Not found mom'));

  app.use(wow).use(mom).all('*', () => text('Not found'));

  test('First router route', async () => {
    const res = await app.fetch(new Request('http://localhost/wow'));
    expect(await res.text()).toBe('this is wow');
  });

  test('Second router route', async () => {
    const res = await app.fetch(new Request('http://localhost/mom'));
    expect(await res.text()).toBe('this is mom');
  });

  test('404 in first router', async () => {
    const res = await app.fetch(new Request('http://localhost/wow/unknown'));
    expect(await res.text()).toBe('Not found wow');
  });

  test('Global 404', async () => {
    const response = await app.fetch(new Request('http://localhost/unknown'));
    expect(await response.text()).toBe('Not found')
  });
});

// ===== 5. MIDDLEWARE =====
describe('Middleware', () => {

  test('Global middleware', async () => {
    const app = flite({
      before: {
        all: [(req) => { req.timestamp = Date.now(); }]
      },
      after: {
        all: [(res, req) => json(res, {
          headers: {
            'X-Timestamp': String(req.timestamp),
          }
        })]
      }
    });

    app.get('/test', () => ({ ok: true }));

    const res = await app.fetch(new Request('http://localhost/test'));
    expect(res.headers.has('X-Timestamp')).toBe(true);
  });

  test('Method-specific middleware', async () => {
    const app = flite({
      before: {
        post: [(req) => { req.isPost = true; }],
        get: [(req) => { req.isGet = true; }]
      }
    });

    app
      .get('/test', (req) => json({ isGet: req.isGet, isPost: req.isPost }))
      .post('/test', (req) => json({ isGet: req.isGet, isPost: req.isPost }));

    const getRes = await app.fetch(new Request('http://localhost/test'));
    const getBody = await getRes.json();
    expect(getBody.isGet).toBe(true);
    expect(getBody.isPost).toBeUndefined();

    const postRes = await app.fetch(new Request('http://localhost/test', { method: 'POST' }));
    const postBody = await postRes.json();
    expect(postBody.isPost).toBe(true);
    expect(postBody.isGet).toBeUndefined();
  });

  test('Early return from middleware', async () => {
    const app = flite();

    app
      .all('*', (req) => {
        if (!req.headers.get('Authorization')) {
          return json({ error: 'Unauthorized' }, { status: 401 });
        }
      })
      .get('/protected', () => json({ secret: 'data' }));

    const res1 = await app.fetch(new Request('http://localhost/protected'));
    expect(res1.status).toBe(401);

    const res2 = await app.fetch(new Request('http://localhost/protected', {
      headers: { Authorization: 'Bearer token' }
    }));
    expect(res2.status).toBe(200);
  });

  test('Multiple handlers per route', async () => {
    const app = flite();
    app.get('/multi',
      (req) => { req.step1 = true; },
      (req) => { req.step2 = true; },
      (req) => json({ step1: req.step1, step2: req.step2 })
    );

    const res = await app.fetch(new Request('http://localhost/multi'));
    const body = await res.json();
    expect(body.step1).toBe(true);
    expect(body.step2).toBe(true);
  });
});

// ===== 6. WILDCARD ROUTES =====
describe('Wildcard Routes', () => {
  const app = flite();

  app
    .get('/api/*', (req) => json({ api: true, path: req.params[0] }))
    .get('/files/*', (req) => json({ file: req.params[0] || 'root' }))
    .all('*', () => json({ error: 'Not found' }, { status: 404 }));

  test('API wildcard', async () => {
    const res = await app.fetch(new Request('http://localhost/api/v1/users'));
    const body = await res.json();
    expect(body.api).toBe(true);
  });

  test('Files wildcard', async () => {
    const res = await app.fetch(new Request('http://localhost/files/images/logo.png'));
    const body = await res.json();
    expect(body.file).toBeDefined();
  });

  test('Catch-all 404', async () => {
    const res = await app.fetch(new Request('http://localhost/unknown'));
    expect(res.status).toBe(404);
  });
});

// ===== 7. ERROR HANDLING =====
describe('Error Handling', () => {
  test('Global error handler', async () => {
    const app = flite({
      error: {
        all: [(err) => error(err)]
      }
    });

    app.get('/throw', () => {
      throw Object.assign(new Error('Test error'), { status: 400 });
    });

    const res = await app.fetch(new Request('http://localhost/throw'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Test error');
  });

  test('Method-specific error handler', async () => {
    const app = flite({
      error: {
        get: [(err) => json({ getError: err.message }, { status: 500 })],
        post: [(err) => json({ postError: err.message }, { status: 500 })]
      }
    });

    app
      .get('/error', () => { throw new Error('GET error'); })
      .post('/error', () => { throw new Error('POST error'); });

    const getRes = await app.fetch(new Request('http://localhost/error'));
    const getBody = await getRes.json();
    expect(getBody.getError).toBe('GET error');

    const postRes = await app.fetch(new Request('http://localhost/error', { method: 'POST' }));
    const postBody = await postRes.json();
    expect(postBody.postError).toBe('POST error');
  });
});

// ===== 8. SERVICES (CRUD) =====
describe('Services - CRUD Operations', () => {
  let app;

  beforeEach(() => {
    app = flite({
      error: { all: [(err) => error(err)] }
    });

    app.service('users', {
      users: [
        { id: '1', name: 'Alice', email: 'alice@test.com' },
        { id: '2', name: 'Bob', email: 'bob@test.com' }
      ],

      async find(params) {
        let results = [...this.users];
        if (params.name) results = results.filter(u => u.name.includes(params.name));
        return { total: results.length, data: results };
      },

      async get(id, params) {
        const user = this.users.find(u => u.id === id);
        if (!user) throw Object.assign(new Error('Not found'), { status: 404 });
        return user;
      },

      async create(data, params) {
        const user = { id: Date.now().toString(), ...data };
        this.users.push(user);
        return user;
      },

      async patch(id, data, params) {
        const user = this.users.find(u => u.id === id);
        if (!user) throw Object.assign(new Error('Not found'), { status: 404 });
        Object.assign(user, data);
        return user;
      },

      async update(id, data, params) {
        const user = this.users.find(u => u.id === id);
        if (!user) throw Object.assign(new Error('Not found'), { status: 404 });
        Object.assign(user, data);
        return user;
      },

      async remove(id, params) {
        const idx = this.users.findIndex(u => u.id === id);
        if (idx === -1) throw Object.assign(new Error('Not found'), { status: 404 });
        return this.users.splice(idx, 1)[0];
      }
    });
  });

  test('GET /users (find)', async () => {
    const res = await app.fetch(new Request('http://localhost/users'));
    const body = await res.json();
    expect(body.total).toBe(2);
    expect(body.data).toBeArray();
  });

  test('GET /users?name=Alice (find with query)', async () => {
    const res = await app.fetch(new Request('http://localhost/users?name=Alice'));
    const body = await res.json();
    expect(body.data.length).toBe(1);
    expect(body.data[0].name).toBe('Alice');
  });

  test('GET /users/:id (get)', async () => {
    const res = await app.fetch(new Request('http://localhost/users/1'));
    const body = await res.json();
    expect(body.id).toBe('1');
    expect(body.name).toBe('Alice');
  });

  test('POST /users (create)', async () => {
    const res = await app.fetch(new Request('http://localhost/users', {
      method: 'POST',
      body: JSON.stringify({ name: 'Charlie', email: 'charlie@test.com' })
    }));
    const body = await res.json();
    expect(body.name).toBe('Charlie');
    expect(body.id).toBeDefined();
  });

  test('PATCH /users/:id (patch)', async () => {
    const res = await app.fetch(new Request('http://localhost/users/1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Alice Updated' })
    }));
    const body = await res.json();
    expect(body.name).toBe('Alice Updated');
  });

  test('PUT /users/:id (update)', async () => {
    const res = await app.fetch(new Request('http://localhost/users/1', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Alice Put', email: 'new@test.com' })
    }));
    const body = await res.json();
    expect(body.name).toBe('Alice Put');
  });

  test('DELETE /users/:id (remove)', async () => {
    const res = await app.fetch(new Request('http://localhost/users/2', { method: 'DELETE' }));
    const body = await res.json();
    expect(body.id).toBe('2');
  });

  test('GET /users/:id 404', async () => {
    const response = await app.fetch(new Request('http://localhost/users/999'));
    const res = await response.json();
    expect(res.status).toBe(404);
  });
});

// ===== 9. SERVICE HOOKS =====
describe('Service Hooks', () => {
  test('Before hooks', async () => {
    const app = flite({ error: { all: (err) => error(err) } });

    app.service('posts', {
      posts: [],
      async create(data, params) {
        this.posts.push(data);
        return data;
      }
    });

    app.service('posts').hooks({
      before: {
        create: [
          async (ctx) => {
            ctx.data.createdAt = 'timestamp';
            return ctx;
          }
        ]
      }
    });

    const res = await app.fetch(new Request('http://localhost/posts', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test' })
    }));
    const body = await res.json();
    expect(body.createdAt).toBe('timestamp');
  });

  test('After hooks', async () => {
    const app = flite({ error: { all: (err) => error(err) } });

    app.service('items', {
      async find(params) { return { data: [] }; }
    });

    app.service('items').hooks({
      after: {
        all: [
          async (ctx) => {
            ctx.result.hooked = true;
            return ctx;
          }
        ]
      }
    });

    const res = await app.fetch(new Request('http://localhost/items'));
    const body = await res.json();
    expect(body.hooked).toBe(true);
  });

  test('App-level hooks', async () => {
    const app = flite({ error: { all: (err) => error(err) } });

    app.hooks({
      before: {
        all: [
          async (ctx) => {
            ctx.data = ctx.data || {};
            ctx.data.appHook = true;
            return ctx;
          }
        ]
      }
    });

    app.service('things', {
      async create(data, params) { return data; }
    });

    const res = await app.fetch(new Request('http://localhost/things', {
      method: 'POST',
      body: JSON.stringify({ name: 'Thing' })
    }));
    const body = await res.json();
    expect(body.appHook).toBe(true);
  });
});

// ===== 10. SERVICE EVENTS =====
describe('Service Events', () => {
  test('Event emitted on create', async () => {
    const app = flite({ error: { all: (err) => error(err) } });
    let eventData = null;

    app.service('messages', {
      async create(data, params) {
        return { id: '1', ...data };
      }
    });

    app.service('messages').on('created', (data) => {
      eventData = data;
    });

    await app.fetch(new Request('http://localhost/messages', {
      method: 'POST',
      body: JSON.stringify({ text: 'Hello' })
    }));

    expect(eventData).toEqual({ id: '1', text: 'Hello' });
  });
});

// ===== 11. CUSTOM SERVICE METHODS =====
describe('Custom Service Methods', () => {
  test('Custom method accessible', async () => {
    const app = flite();

    app.service('auth', {
      async login(email, password) {
        if (email === 'test@test.com' && password === 'secret') {
          return { token: 'abc123' };
        }
        throw Object.assign(new Error('Invalid credentials'), { status: 401 });
      }
    });

    const result = await app.service('auth').login('test@test.com', 'secret');
    expect(result.token).toBe('abc123');
  });

  test('Custom method error', async () => {
    const app = flite();

    app.service('auth', {
      async login(email, password) {
        throw Object.assign(new Error('Invalid'), { status: 401 });
      }
    });

    try {
      await app.service('auth').login('wrong', 'wrong');
      expect(true).toBe(false);
    } catch (err) {
      expect(err.message).toBe('Invalid');
    }
  });
});

// ===== 12. SETUP/TEARDOWN =====
describe('Setup and Teardown', () => {
  test('Setup called on first service call', async () => {
    const app = flite({ error: { all: (err) => error(err) } });
    let setupCalled = false;

    app.service('test', {
      async setup(app, path) {
        setupCalled = true;
      },
      async find(params) {
        return { data: [] };
      }
    });

    await app.fetch(new Request('http://localhost/test'));
    expect(setupCalled).toBe(true);
  });

  test('Teardown called on app teardown', async () => {
    const app = flite();
    let teardownCalled = false;

    app.service('test', {
      async teardown() {
        teardownCalled = true;
      },
    });

    app.teardown();
    expect(teardownCalled).toBe(true);
  });
});

// ===== 13. CROSS-SERVICE COMMUNICATION =====
describe('Cross-Service Communication', () => {
  test('Event triggers cross-service action', async () => {
    const app = flite({ error: { all: (err) => error(err) } });
    let welcomePostCreated = false;

    app.service('users', {
      users: [],
      async create(data, params) {
        const user = { id: Date.now().toString(), ...data };
        this.users.push(user);
        return user;
      }
    });

    app.service('posts', {
      posts: [],
      async create(data, params) {
        this.posts.push(data);
        if (data.type === 'welcome') welcomePostCreated = true;
        return data;
      }
    });

    app.service('users').on('created', async (user) => {
      await app.service('posts').create({
        title: `Welcome ${user.name}!`,
        type: 'welcome'
      });
    });

    await app.fetch(new Request('http://localhost/users', {
      method: 'POST',
      body: JSON.stringify({ name: 'Dave' })
    }));

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(welcomePostCreated).toBe(true);
  });
});

// ===== 14. RESPONSE HELPERS =====
describe('Response Helpers', () => {
  test('text() helper', () => {
    const res = text('Hello');
    expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8');
  });

  test('html() helper', () => {
    const res = html('<h1>Test</h1>');
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
  });

  test('json() helper', () => {
    const res = json({ foo: 'bar' });
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
  });

  test('error() helper with Error', () => {
    const err = Object.assign(new Error('Test'), { status: 400 });
    const res = error(err);
    expect(res.status).toBe(400);
  });

  test('error() helper with status', () => {
    const res = error(500, 'Server error');
    expect(res.status).toBe(500);
  });

  test('Service can return custom response', async () => {
    const app = flite({ error: { all: (err) => error(err) } });

    app.service('custom', {
      async find(params) {
        if (params.format === 'html') {
          return html('<h1>HTML Response</h1>');
        }
        return { data: [] };
      }
    });

    const res = await app.fetch(new Request('http://localhost/custom?format=html'));
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
  });
});

// ===== 15. GLOBAL EVENTS =====
describe('Global Events', () => {
  test('Emit and receive events', () => {
    const app = flite();
    let eventCalled = false;

    app.on('test-event', (data) => {
      eventCalled = data;
    });

    app.emit('test-event', { value: 123 });
    expect(eventCalled).toEqual({ value: 123 });
  });

  test('Remove event listener', () => {
    const app = flite();
    const handler = (data) => { };
    app.on('remove-test', handler);
    app.off('remove-test', handler);
    app.emit('remove-test', {});
  });
});

// ===== 16. EDGE CASES =====
describe('Edge Cases', () => {
  test('Return undefined from route', async () => {
    const app = flite();
    app.get('/undefined', () => undefined);
    app.get('/fallback', () => text('fallback'));

    const res = await app.fetch(new Request('http://localhost/undefined'));
    const respone = await res.json()
    expect(res.status).toBe(404);
  });

  test('Return Response directly', async () => {
    const app = flite();
    app.get('/response', () => new Response('custom', { status: 201 }));

    const res = await app.fetch(new Request('http://localhost/response'));
    expect(res.status).toBe(201);
    expect(await res.text()).toBe('custom');
  });

  test('Return Promise', async () => {
    const app = flite();
    app.get('/promise', () => Promise.resolve(json({ async: true })));

    const res = await app.fetch(new Request('http://localhost/promise'));
    const body = await res.json();
    expect(body.async).toBe(true);
  });

  test('Empty path parameters', async () => {
    const app = flite();
    app.get('/test/:id?', (req) => json({ id: req.params.id || 'none' }));

    const res = await app.fetch(new Request('http://localhost/test/'));
    const body = await res.json();
    expect(body.id).toBeDefined();
  });
});

// ===== MISSING: Direct .fetch() call (no Bun.serve) =====
describe('Direct fetch() call', () => {
  test('Call fetch directly on router', async () => {
    const app = flite();
    app.get('/test', () => text('direct call'));

    const res = await app.fetch({
      method: 'GET',
      url: 'http://localhost/test'
    });

    expect(await res.text()).toBe('direct call');
  });
});

// ===== MISSING: Auto-wrapping plain values =====
describe('Auto-wrap plain values', () => {
  test('Return plain string', async () => {
    const app = flite();
    app.get('/string', () => text('Hello World'));

    const res = await app.fetch(new Request('http://localhost/string'));
    expect(await res.text()).toBe('Hello World');
  });

  test('Return plain number', async () => {
    const app = flite();
    app.get('/number', () => text(42));

    const res = await app.fetch(new Request('http://localhost/number'));
    expect(await res.text()).toBe('42');
  });

  test('Return plain object (should auto-JSON)', async () => {
    const app = flite();
    app.get('/object', () => (json({ foo: 'bar' })));

    const res = await app.fetch(new Request('http://localhost/object'));
    // This might fail - depends if you auto-wrap objects
    const body = await res.json();
    expect(body.foo).toBe('bar');
  });
});

// ===== MISSING: Middleware returning undefined =====
describe('Middleware returning undefined', () => {
  test('Middleware with no return should continue', async () => {
    const app = flite();
    const calls = [];

    app.get('/test',
      () => { calls.push(1); }, // No return
      () => { calls.push(2); }, // No return
      () => { calls.push(3); return text('done'); }
    );

    const res = await app.fetch(new Request('http://localhost/test'));
    expect(calls).toEqual([1, 2, 3]);
    expect(await res.text()).toBe('done');
  });
});

// ===== MISSING: Super complex query params =====
describe('Extremely complex query string', () => {
  test('MongoDB aggregation pipeline-like query', async () => {
    const app = flite();
    app.get('/search', (req) => json({ count: Object.keys(req.query).length }));

    const url = 'http://localhost/search?' +
      '$and[0][field1][$in][0]=value1&' +
      '$and[0][field1][$in][1]=value2&' +
      '$and[0][field1][$gt]=10&' +
      '$and[0][field1][$lte]=100&' +
      '$and[1][$or][0][field3]=&' +
      '$and[1][$or][1][field3][$exists]=false&' +
      '$and[2][field4][$elemMatch][subfield1][$eq]=something&' +
      '$and[2][field4][$elemMatch][subfield2][$gt]=5&' +
      '$and[3][$expr][$gt][0][$sum][0]=$field5&' +
      '$and[3][$expr][$gt][0][$sum][1]=$field6&' +
      '$and[3][$expr][$gt][1]=100&' +
      '$and[4][$geoWithin][$centerSphere][0][0]=50&' +
      '$and[4][$geoWithin][$centerSphere][0][1]=-50&' +
      '$and[4][$geoWithin][$centerSphere][1]=100&' +
      '$and[5][$text][$search]=keyword&' +
      '$and[5][$text][$caseSensitive]=false&' +
      '$sort[field1]=-1&' +
      '$sort[field2]=1&' +
      '$limit=20&$skip=10&' +
      '$projection[field1]=1&' +
      '$projection[field2]=0&' +
      '$projection[nested.field]=1';

    const res = await app.fetch(new Request(url));
    const body = await res.json();
    expect(body.count).toBeGreaterThan(22); // Should have MANY params
  });
});

// ===== MISSING: Path params through nested levels =====
describe('Path params inheritance in nested routers', () => {
  test('All params accessible in deep nesting', async () => {
    const app = flite();

    const level3 = flite()
      .get('/', (req) => json({
        a: req.params.a,
        b: req.params.b,
        c: req.params.c
      }));

    const level2 = flite()
      .use('/:c', level3);

    app.use('/:a/:b', level2);

    const res = await app.fetch(new Request('http://localhost/one/two/three'));
    const body = await res.json();
    expect(body.a).toBe('one');
    expect(body.b).toBe('two');
    expect(body.c).toBe('three');
  });
});

// ===== MISSING: Use multiple routers in one call =====
describe('Multiple routers in single .use()', () => {
  test('.use(router1, router2, router3)', async () => {
    const app = flite();

    const r1 = flite().get('/one', () => text('r1'));
    const r2 = flite().get('/two', () => text('r2'));
    const r3 = flite().get('/three', () => text('r3'));

    app.use(r1, r2, r3);

    const res1 = await app.fetch(new Request('http://localhost/one'));
    expect(await res1.text()).toBe('r1');

    const res2 = await app.fetch(new Request('http://localhost/two'));
    expect(await res2.text()).toBe('r2');

    const res3 = await app.fetch(new Request('http://localhost/three'));
    expect(await res3.text()).toBe('r3');
  });
});

// ===== MISSING: Return Request object =====
describe('Return Request object itself', () => {
  test('Handler returns req', async () => {
    const app = flite();
    app.get('/echo', (req) => req);

    const res = await app.fetch(new Request('http://localhost/echo'));
    // Should it return the request as a response? Edge case!
    expect(res).toBeDefined();
  });
});

// ===== MISSING: Service + regular routes on same path =====
describe('Service and regular routes conflict', () => {
  test('Service and manual route on same path', async () => {
    const app = flite({ error: { all: (err) => error(err) } });

    app.service('users', {
      async find(params) {
        return { data: ['from service'] };
      }
    });

    // Manual route on same path - what wins?
    app.get('/users', () => json({ manual: true }));

    const res = await app.fetch(new Request('http://localhost/users'));
    const body = await res.json();
    // Which one wins? Service or manual route?
    expect(body).toBeDefined();
  });
});

// ===== MISSING: Service methods called internally =====
describe('Internal service calls (no HTTP)', () => {
  test('Call service method directly', async () => {
    const app = flite();

    app.service('calculator', {
      async add(a, b) {
        return a + b;
      }
    });

    // Direct call, no HTTP
    const result = await app.service('calculator').add(5, 3);
    expect(result).toBe(8);
  });

  test('Service hooks run on internal calls', async () => {
    const app = flite();

    app.service('items', {
      async create(data) {
        return data;
      }
    });

    app.service('items').hooks({
      before: {
        create: [
          async (ctx) => {
            ctx.data.hooked = true;
            return ctx;
          }
        ]
      }
    });

    // Direct call
    const result = await app.service('items').create({ name: 'test' });
    expect(result.hooked).toBe(true);
  });
});

// ===== MISSING: Service returning HTML/Text =====
describe('Service returning non-JSON responses', () => {
  test('Service find() returns HTML', async () => {
    const app = flite({ error: { all: (err) => error(err) } });

    app.service('pages', {
      async find(params) {
        return html('<h1>Hello</h1>');
      }
    });

    const res = await app.fetch(new Request('http://localhost/pages'));
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(await res.text()).toBe('<h1>Hello</h1>');
  });

  test('Service get() returns text', async () => {
    const app = flite({ error: { all: (err) => error(err) } });

    app.service('logs', {
      async get(id, params) {
        return text(`Log entry ${id}`);
      }
    });

    const res = await app.fetch(new Request('http://localhost/logs/123'));
    expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(await res.text()).toBe('Log entry 123');
  });
});

// ===== MISSING: Empty/null handlers =====
describe('Empty or null handlers', () => {
  test('Route with null handler', async () => {
    const app = flite();
    app.get('/test', null, () => text('ok'));

    const res = await app.fetch(new Request('http://localhost/test'));
    expect(await res.text()).toBe('ok');
  });

  test('Route with undefined handler', async () => {
    const app = flite();
    app.get('/test', undefined, () => text('ok'));

    const res = await app.fetch(new Request('http://localhost/test'));
    expect(await res.text()).toBe('ok');
  });
});

// ===== MISSING: Service without standard methods =====
describe('Service with only custom methods', () => {
  test('Service has no CRUD methods', async () => {
    const app = flite();

    app.service('auth', {
      async login(email, password) {
        return { token: 'xyz' };
      }
    });

    // Should not create routes like GET /auth
    const res = await app.fetch(new Request('http://localhost/auth'));
    const response = await res.json();

    expect(response.status).toBe(404); // No route should match
  });
});

// ===== MISSING: Trailing slashes =====
describe('Trailing slashes', () => {
  test('Route with trailing slash', async () => {
    const app = flite();
    app.get('/test/', () => text('with slash'));

    const res = await app.fetch(new Request('http://localhost/test/'));
    expect(await res.text()).toBe('with slash');
  });

  test('Route without slash matches with slash', async () => {
    const app = flite();
    app.get('/test', () => text('no slash'));

    const res = await app.fetch(new Request('http://localhost/test/'));
    expect(await res.text()).toBe('no slash');
  });
});


// describe('Mode 1: Express-style middleware', () => {
//   test('Middleware must call next() to continue', async () => {
//     const app = Router({ mode: 1 });
//     const calls = [];

//     app.get('/test',
//       (req, next) => { calls.push(1); next(); },
//       (req, next) => { calls.push(2); next(); },
//       (req, next) => { calls.push(3); return text('done'); }
//     );

//     const res = await app.fetch(new Request('http://localhost/test'));
//     expect(calls).toEqual([1, 2, 3]);
//     expect(await res.text()).toBe('done');
//   });
// });

// describe('Mode 1: Express-style middleware', () => {
//   test('Middleware must call next() to continue', async () => {
//     const app = Router({ mode: 1 });
//     const calls = [];

//     app.get('/test',
//       (req, next) => { calls.push(1); next(); },
//       (req, next) => { calls.push(2); next(); },
//       (req, next) => { calls.push(3); return text('done'); }
//     );

//     const res = await app.fetch(new Request('http://localhost/test'));
//     expect(calls).toEqual([1, 2, 3]);
//     expect(await res.text()).toBe('done');
//   });
// });


// router.test.js

describe('Router - Basic Routing', () => {
  test('should match GET route', async () => {
    const app = flite();
    app.get('/hello', () => ({ message: 'Hello' }));

    const req = new Request('http://localhost/hello');
    const res = await app.fetch(req);
    const data = await res.json();

    expect(data.message).toBe('Hello');
  });

  test('should match route with params', async () => {
    const app = flite();
    app.get('/users/:id', (req) => ({ id: req.params.id }));

    const req = new Request('http://localhost/users/123');
    const res = await app.fetch(req);
    const data = await res.json();

    expect(data.id).toBe('123');
  });

  test('should parse query params', async () => {
    const app = flite();
    app.get('/search', (req) => ({ query: req.query }));

    const req = new Request('http://localhost/search?q=test&limit=10');
    const res = await app.fetch(req);
    const data = await res.json();

    expect(data.query.q).toBe('test');
    expect(data.query.limit).toBe('10');
  });

  test('should match wildcard routes', async () => {
    const app = flite();
    app.get('/api/*', () => ({ matched: 'wildcard' }));

    const req = new Request('http://localhost/api/users/123');
    const res = await app.fetch(req);
    const data = await res.json();

    expect(data.matched).toBe('wildcard');
  });

  test('should handle 404', async () => {
    const app = flite();
    app.get('/hello', () => ({ message: 'Hello' }));

    const req = new Request('http://localhost/not-found');
    const response = await app.fetch(req);
    const res = await response.json();

    expect(res.status).toBe(404);
  });
});

describe('Router - Auto Formatting', () => {
  test('should auto-format objects to JSON', async () => {
    const app = flite();
    app.get('/test', () => ({ data: 'test' }));

    const req = new Request('http://localhost/test');
    const res = await app.fetch(req);

    expect(res.headers.get('content-type')).toContain('application/json');
    const data = await res.json();
    expect(data.data).toBe('test');
  });

  test('should pass through Response objects', async () => {
    const app = flite();
    app.get('/test', () => text('Plain text'));

    const req = new Request('http://localhost/test');
    const res = await app.fetch(req);

    expect(res.headers.get('content-type')).toContain('text/plain');
    const body = await res.text();
    expect(body).toBe('Plain text');
  });

  test('should support custom formatters', async () => {
    const app = flite({ format: html });
    app.get('/test', () => '<h1>Hello</h1>');

    const req = new Request('http://localhost/test');
    const res = await app.fetch(req);

    expect(res.headers.get('content-type')).toContain('text/html');
  });

  test('should disable formatting with format: false', async () => {
    const app = flite({ format: false });
    app.get('/test', () => ({ data: 'raw' }));

    const req = new Request('http://localhost/test');
    const res = await app.fetch(req);

    expect(res).toEqual({ data: 'raw' });
  });
});

describe('Router - App-level Hooks', () => {
  test('should run before.all hook', async () => {
    const calls = [];
    const app = flite({
      before: {
        all: [(req) => calls.push('before.all')]
      }
    });

    app.get('/test', () => ({ ok: true }));

    const req = new Request('http://localhost/test');
    await app.fetch(req);

    expect(calls).toEqual(['before.all']);
  });

  test('should run before.get hook', async () => {
    const calls = [];
    const app = flite({
      before: {
        all: [(req) => { calls.push('before.all') }],
        get: [(req) => { calls.push('before.get') }]
      }
    });

    app.get('/test', () => ({ ok: true }));

    const req = new Request('http://localhost/test');
    await app.fetch(req);

    expect(calls).toEqual(['before.all', 'before.get']);
  });

  test('should run after hooks in correct order', async () => {
    const calls = [];
    const app = flite({
      after: {
        all: [(res) => { calls.push('after.all') }],
        get: [(res) => { calls.push('after.get') }]
      }
    });

    app.get('/test', () => ({ ok: true }));

    const req = new Request('http://localhost/test');
    await app.fetch(req);

    expect(calls).toEqual(['after.get', 'after.all']);
  });

  test('should modify request in before hook', async () => {
    const app = flite({
      before: {
        all: [(req) => { req.customProp = 'modified'; }]
      }
    });

    app.get('/test', (req) => ({ prop: req.customProp }));

    const req = new Request('http://localhost/test');
    const res = await app.fetch(req);
    const data = await res.json();

    expect(data.prop).toBe('modified');
  });

  test('should stop execution if before hook returns response', async () => {
    const app = flite({
      before: {
        all: [(req) => ({ early: 'return' })]
      }
    });

    app.get('/test', () => ({ should: 'not-run' }));

    const req = new Request('http://localhost/test');
    const res = await app.fetch(req);
    const data = await res.json();

    expect(data.early).toBe('return');
    expect(data.should).toBeUndefined();
  });
});

describe('Router - Error Handling', () => {
  test('should catch errors in error.all hook', async () => {
    const app = flite({
      error: {
        all: [(err) => ({ error: err.message, caught: true })]
      }
    });

    app.get('/test', () => {
      throw new Error('Test error');
    });

    const req = new Request('http://localhost/test');
    const res = await app.fetch(req);

    expect(res.caught).toBe(true);
    expect(res.error).toBe('Test error');
  });

  test('should handle status', async () => {
    const app = flite();

    app.get('/test', () => {
      throw new status(400, 'Bad request');
    });

    const req = new Request('http://localhost/test');
    const res = await app.fetch(req);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: 400, error: 'Bad request' });
  });

  test('should auto-catch uncaught errors', async () => {
    const app = flite();

    app.get('/test', () => {
      throw new Error('Uncaught');
    });

    const req = new Request('http://localhost/test');
    const res = await app.fetch(req);

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Uncaught');
  });

  test('should handle errors in after hooks', async () => {
    const app = flite({
      after: {
        all: [(res) => { throw new Error('After error'); }]
      },
      error: {
        all: [(err) => ({ afterError: err.message })]
      }
    });

    app.get('/test', () => ({ ok: true }));

    const req = new Request('http://localhost/test');
    const res = await app.fetch(req);

    expect(res.afterError).toBe('After error');
  });
});

describe('Router - Services', () => {
  test('should register and call service', async () => {
    const app = flite();

    app.service('users', {
      users: [{ id: 1, name: 'Alice' }],
      async find() {
        return this.users;
      }
    });

    const users = await app.service('users').find();
    expect(users).toHaveLength(1);
    expect(users[0].name).toBe('Alice');
  });

  test('should auto-create REST routes', async () => {
    const app = flite();

    app.service('users', {
      users: [],
      async find() {
        return this.users;
      }
    });

    const req = new Request('http://localhost/users');
    const res = await app.fetch(req);
    const data = await res.json();

    expect(Array.isArray(data)).toBe(true);
  });

  test('should handle service with params', async () => {
    const app = flite();

    app.service('users', {
      async get(id) {
        return { id, name: 'Test' };
      }
    });

    const req = new Request('http://localhost/users/123');
    const res = await app.fetch(req);
    const data = await res.json();

    expect(data.id).toBe('123');
  });

  test('should work with both /users and users syntax', async () => {
    const app = flite();

    app.service('users', {
      async find() {
        return [{ id: 1 }];
      }
    });

    const service1 = app.service('users');
    const service2 = app.service('/users');

    expect(service1).toBe(service2);
  });

  test('should emit service events', async () => {
    const app = flite();
    const events = [];

    app.service('users', {
      users: [],
      async create(data) {
        const user = { id: Date.now(), ...data };
        this.users.push(user);
        return user;
      }
    });

    app.service('users').on('created', (user) => {
      events.push(user);
    });

    await app.service('users').create({ name: 'Alice' });

    expect(events).toHaveLength(1);
    expect(events[0].name).toBe('Alice');
  });

  test('should call setup on service registration', async () => {
    const app = flite();
    let setupCalled = false;

    app.service('users', {
      setup(app, name) {
        setupCalled = true;
        expect(name).toBe('users');
      },
      async find() {
        return [];
      }
    });

    expect(setupCalled).toBe(true);
  });

  test('should call teardown', async () => {
    const app = flite();
    let teardownCalled = false;

    app.service('users', {
      async teardown() {
        teardownCalled = true;
      },
      async find() {
        return [];
      }
    });

    app.teardown();


    expect(teardownCalled).toBe(true);
  });
});

describe('Router - Service Hooks', () => {
  test('should run service before hooks in correct order', async () => {
    const calls = [];
    const app = flite({
      before: {
        all: [(ctx) => { calls.push('app.before.all') }],
        get: [(ctx) => { calls.push('app.before.get') }]
      }
    });

    const service = app.service('users', {
      async find() {
        return [];
      }
    });

    service.hooks({
      before: {
        all: [(ctx) => { calls.push('service.before.all') }],
        find: [(ctx) => { calls.push('service.before.find') }]
      }
    });

    await service.find();

    expect(calls).toEqual([
      'service.before.all',
      'service.before.find'
    ]);
  });

  test('should run service after hooks in correct order (reversed)', async () => {
    const calls = [];
    const app = flite({
      after: {
        all: [(ctx) => { calls.push('app.after.all') }],
        get: [(ctx) => { calls.push('app.after.find') }]
      }
    });

    const service = app.service('users', {
      async find() {
        return [];
      }
    });

    service.hooks({
      after: {
        all: [(ctx) => { calls.push('service.after.all') }],
        find: [(ctx) => { calls.push('service.after.find') }]
      }
    });

    await service.find();

    expect(calls).toEqual([
      'service.after.find',
      'service.after.all',
    ]);
  });

  test('should modify context in before hook', async () => {
    const app = flite();

    const service = app.service('users', {
      async find(params) {
        return [{ id: 1, name: params.name }];
      }
    });

    service.hooks({
      before: {
        find: [(ctx) => {
          ctx.params.name = 'Modified';
        }]
      }
    });

    const result = await service.find({});

    expect(result[0].name).toBe('Modified');
  });

  test('should modify result in after hook', async () => {
    const app = flite();

    const service = app.service('users', {
      async find() {
        return [{ id: 1, name: 'Alice' }];
      }
    });

    service.hooks({
      after: {
        find: [(ctx) => {
          ctx.result = ctx.result.map(u => ({ ...u, modified: true }));
        }]
      }
    });

    const result = await service.find();

    expect(result[0].modified).toBe(true);
  });

  test('should support custom methods with hooks', async () => {
    const calls = [];
    const app = flite();

    const service = app.service('users', {
      async search(query) {
        return [{ name: query }];
      }
    });

    service.hooks({
      before: {
        all: [(ctx) => { calls.push('before.all') }],
        search: [(ctx) => { calls.push('before.search') }]
      },
      after: {
        all: [(ctx) => { calls.push('after.all') }],
        search: [(ctx) => { calls.push('after.search') }]
      }
    });

    await service.search();

    expect(calls).toEqual([
      'before.all',
      'before.search',
      'after.search',
      'after.all'
    ]);
  });

  test('should pass correct context to hooks', async () => {
    const app = flite();
    let capturedContext;

    const service = app.service('users', {
      async create(data) {
        return { id: 1, ...data };
      }
    });

    service.hooks({
      before: {
        create: [(ctx) => {
          capturedContext = ctx;
        }]
      }
    });

    await service.create({ name: 'Test' }, { query: 'param' });

    expect(capturedContext.method).toBe('create');
    expect(capturedContext.path).toBe('users');
    expect(capturedContext.data.name).toBe('Test');
    expect(capturedContext.params.query).toBe('param');
    expect(capturedContext.service).toBeDefined();
    expect(capturedContext.app).toBeDefined();
  });
});

describe('Router - Channels', () => {
  test('should create and join channel', () => {
    const app = flite();
    const mockWs = { send: () => { } };

    const channel = app.channel('room-1');
    channel.join(mockWs, { userId: '123' });

    expect(channel.connections.size).toBe(1);
  });

  test('should send to all connections in channel', () => {
    const app = flite();
    const messages = [];

    const ws1 = { send: (msg) => messages.push(JSON.parse(msg)) };
    const ws2 = { send: (msg) => messages.push(JSON.parse(msg)) };

    app.channel('room-1').join(ws1).join(ws2);
    app.channel('room-1').send('test-event', { data: 'hello' });

    expect(messages).toHaveLength(2);
    expect(messages[0].event).toBe('test-event');
    expect(messages[0].data.data).toBe('hello');
  });

  test('should leave channel', () => {
    const app = flite();
    const ws1 = { send: () => { } };

    const channel = app.channel('room-1');
    channel.join(ws1);
    expect(channel.connections.size).toBe(1);

    channel.leave(ws1);
    expect(channel.connections.size).toBe(0);
  });

  test('should filter connections', () => {
    const app = flite();
    const messages = [];

    const ws1 = { send: (msg) => messages.push({ user: 'admin', msg: JSON.parse(msg) }) };
    const ws2 = { send: (msg) => messages.push({ user: 'user', msg: JSON.parse(msg) }) };

    app.channel('users')
      .join(ws1, { role: 'admin' })
      .join(ws2, { role: 'user' });

    app.channel('users')
      .filter((user) => user.role === 'admin')
      .send('admin-only', { secret: 'data' });

    expect(messages).toHaveLength(1);
    expect(messages[0].user).toBe('admin');
  });

  test('should broadcast service events to channel', async () => {
    const app = flite();
    const messages = [];

    const ws = { send: (msg) => messages.push(JSON.parse(msg)) };

    app.channel('room-1').join(ws);

    app.service('messages', {
      messages: [],
      async create(data) {
        const msg = { id: Date.now(), ...data };
        this.messages.push(msg);
        return msg;
      }
    });

    app.service('messages').on('created', (message) => {
      app.channel(`room-${message.roomId}`).send('message', message);
    });

    await app.service('messages').create({ text: 'Hello', roomId: 1 });

    expect(messages).toHaveLength(1);
    expect(messages[0].data.text).toBe('Hello');
  });
});

// describe('Router - Mode 1 (Middleware Chain)', () => {
//   test('should run all handlers in mode 1', async () => {
//     const calls = [];
//     const app = Router({ mode: 1 });

//     app.get('/test',
//       (req) => calls.push('handler-1'),
//       (req) => calls.push('handler-2'),
//       (req) => calls.push('handler-3')
//     );

//     const req = new Request('http://localhost/test');
//     await app.fetch(req);

//     expect(calls).toEqual(['handler-1', 'handler-2', 'handler-3']);
//   });

//   test('should return last handler result in mode 1', async () => {
//     const app = Router({ mode: 1 });

//     app.get('/test',
//       (req) => { req.data = 'first'; },
//       (req) => { req.data = 'second'; },
//       (req) => ({ result: req.data })
//     );

//     const req = new Request('http://localhost/test');
//     const res = await app.fetch(req);
//     const data = await res.json();

//     expect(data.result).toBe('second');
//   });
// });

describe('Router - Event Emitter', () => {
  test('should emit and listen to events', () => {
    const app = flite();
    const events = [];

    app.on('test-event', (data) => events.push(data));
    app.emit('test-event', { message: 'hello' });

    expect(events).toHaveLength(1);
    expect(events[0].message).toBe('hello');
  });

  test('should remove event listener', () => {
    const app = flite();
    const events = [];

    const handler = (data) => events.push(data);

    app.on('test-event', handler);
    app.emit('test-event', 'first');

    app.off('test-event', handler);
    app.emit('test-event', 'second');

    expect(events).toHaveLength(1);
    expect(events[0]).toBe('first');
  });
});

describe('Router - Nested Routers', () => {
  test('should mount sub-router', async () => {
    const app = flite();
    const api = flite();

    api.get('/users', () => ({ users: [] }));
    api.get('/posts', () => ({ posts: [] }));

    app.use('/api', api);

    const req = new Request('http://localhost/api/users');
    const res = await app.fetch(req);
    const data = await res.json();

    expect(data.users).toEqual([]);
  });
});

describe('Router - Edge Cases', () => {
  test('should handle undefined response', async () => {
    const app = flite();
    app.get('/test', () => undefined);

    const req = new Request('http://localhost/test');
    const response = await app.fetch(req);
    const res = await response.json();
    expect(res.status).toBe(404);
  });

  test('should handle null response', async () => {
    const app = flite();
    app.get('/test', () => null);

    const req = new Request('http://localhost/test');
    const response = await app.fetch(req);
    const res = await response.json();
    expect(res.status).toBe(404);
  });

  test('should handle async handlers', async () => {
    const app = flite();
    app.get('/test', async () => {
      await new Promise(r => setTimeout(r, 10));
      return { async: true };
    });

    const req = new Request('http://localhost/test');
    const res = await app.fetch(req);
    const data = await res.json();

    expect(data.async).toBe(true);
  });

  test('should handle POST with JSON body', async () => {
    const app = flite();
    app.post('/users', async (req) => {
      const body = await req.json();
      return { created: body };
    });

    const req = new Request('http://localhost/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice' })
    });

    const res = await app.fetch(req);
    const data = await res.json();

    expect(data.created.name).toBe('Alice');
  });
});

describe('Router - Full Integration', () => {
  test('complete flow: hooks -> service -> channels', async () => {
    const app = flite({
      before: {
        all: [(req) => { req.timestamp = Date.now(); }]
      }
    });

    const messages = [];
    const ws = { send: (msg) => messages.push(JSON.parse(msg)) };

    app.channel('authenticated').join(ws, { userId: '123' });

    const chatService = app.service('messages', {
      messages: [],
      async create(data, params) {
        const message = {
          id: Date.now(),
          ...data,
          timestamp: params.timestamp
        };
        this.messages.push(message);
        return message;
      }
    });

    chatService.hooks({
      before: {
        create: [(ctx) => {
          ctx.params.timestamp = ctx.app.timestamp;
        }]
      }
    });

    chatService.on('created', (message) => {
      app.channel('authenticated').send('new-message', message);
    });

    const req = new Request('http://localhost/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Hello World' })
    });

    await app.fetch(req);

    expect(messages).toHaveLength(1);
    expect(messages[0].event).toBe('new-message');
    expect(messages[0].data.text).toBe('Hello World');
  });
});


test('Mode 1: should run all middleware in chain', async () => {
  const calls = [];

  const app = flite({
    mode: 1,  // Enable middleware chain mode
    format: json
  });

  // Middleware 1: Authentication
  app.use(async (req, env, ctx, next) => {
    calls.push('auth');
    req.user = { id: 1, name: 'John' };
    await next();  // Continue to next middleware
  });

  // Middleware 2: Logging
  app.use(async (req, env, ctx, next) => {
    calls.push('log');
    req.timestamp = Date.now();
    await next();  // Continue to next middleware
  });

  // Route handler
  app.get('/test', async (req, env, ctx, next) => {
    calls.push('handler');
    return {
      user: req.user,
      timestamp: req.timestamp
    };
  });

  const response = await app.fetch(new Request('http://localhost/test'), {}, {});

  // All middleware and handler should be called in order
  expect(calls).toEqual(['auth', 'log', 'handler']);
  expect(response.user).toEqual({ id: 1, name: 'John' });
  expect(response.timestamp).toBeDefined();
});

test('Mode 1: should stop if middleware does not call next', async () => {
  const calls = [];

  const app = flite({ mode: 1, format: json });

  app.use(async (req, env, ctx, next) => {
    calls.push('middleware-1');
    await next();
  });

  // This middleware returns without calling next()
  app.use(async (req, env, ctx, next) => {
    calls.push('middleware-2');
    return { error: 'Unauthorized' };  // Don't call next()
  });

  app.get('/test', async (req, env, ctx, next) => {
    calls.push('handler');
    return { success: true };
  });

  const response = await app.fetch(new Request('http://localhost/test'), {}, {});

  // Should stop at middleware-2
  expect(calls).toEqual(['middleware-1', 'middleware-2']);
  expect(calls).not.toContain('handler');
  expect(response.error).toBe('Unauthorized');
});

test('Mode 1: service hooks should receive next function', async () => {
  const calls = [];

  const app = flite({ mode: 1, format: json });

  app.hooks({
    before: {
      all: [
        async (ctx, next) => {
          calls.push('global-before-1');
          ctx.step1 = true;
          await next();
        },
        async (ctx, next) => {
          calls.push('global-before-2');
          ctx.step2 = true;
          await next();
        }
      ]
    }
  });

  app.service('users', {
    async find(params) {
      calls.push('find');
      return [{ id: 1 }];
    }
  });

  await app.service('users').find();

  expect(calls).toEqual(['global-before-1', 'global-before-2', 'find']);
});

test('Mode 1: should pass env and ctx through middleware chain', async () => {
  const calls = [];

  const app = flite({ mode: 1, format: json });

  app.use(async (req, env, ctx, next) => {
    calls.push(`env-key: ${env.KEY}`);
    calls.push(`ctx-value: ${ctx.value}`);
    await next();
  });

  app.get('/test', async (req, env, ctx, next) => {
    return {
      envKey: env.KEY,
      ctxValue: ctx.value
    };
  });

  const response = await app.fetch(
    new Request('http://localhost/test'),
    { KEY: 'secret' },  // env
    { value: 42 }       // ctx
  );


  expect(calls).toEqual(['env-key: secret', 'ctx-value: 42']);
  expect(response).toEqual({ envKey: 'secret', ctxValue: 42 });
});


test('Mode 1: Error handling with global error handlers', async () => {
  const calls = [];

  const app = flite({
    mode: 1,
    format: json,
    error: {
      all: [
        async (err, req, env, ctx) => {
          calls.push('error-handler');
          return {
            error: err.message,
            status: err.status || 500,
            path: new URL(req.url).pathname
          };
        }
      ]
    }
  });

  app.use(async (req, env, ctx, next) => {
    calls.push('middleware-1');
    await next();
  });

  app.use(async (req, env, ctx, next) => {
    calls.push('middleware-2');
    if (req.url.includes('fail=true')) {
      throw new status(403, 'Access forbidden');
    }
    await next();
  });

  app.get('/test', async (req) => {
    calls.push('handler');
    return { success: true };
  });

  const response = await app.fetch(
    new Request('http://localhost/test?fail=true'),
    {}, {}
  );

  expect(calls).toEqual(['middleware-1', 'middleware-2', 'error-handler']);
  expect(response).toEqual({
    error: 'Access forbidden',
    status: 403,
    path: '/test'
  });
});

test('Mode 1: Context sharing across middleware', async () => {
  const calls = [];

  const app = flite({ mode: 1 });

  // Set up shared state
  app.use(async (req, env, ctx, next) => {
    calls.push('setup-state');
    ctx.state = { counter: 0 };
    await next();
  });

  // Increment counter
  app.use(async (req, env, ctx, next) => {
    calls.push('increment-1');
    ctx.state.counter++;
    await next();
  });

  // Increment again
  app.use(async (req, env, ctx, next) => {
    calls.push('increment-2');
    ctx.state.counter++;
    await next();
  });

  app.get('/count', async (req, env, ctx) => {
    calls.push('handler');
    return { counter: ctx.state.counter };
  });

  const response = await app.fetch(
    new Request('http://localhost/count'),
    {},
    {}
  );

  expect(calls).toEqual(['setup-state', 'increment-1', 'increment-2', 'handler']);
  expect(response.counter).toBe(2);
});

test('Mode 1: Middleware with env bindings (Cloudflare Workers pattern)', async () => {
  const calls = [];

  const app = flite({ mode: 1, format: json });

  // Simulate KV cache middleware
  app.use(async (req, env, ctx, next) => {
    calls.push('check-cache');
    const cacheKey = new URL(req.url).pathname;
    const cached = await env.CACHE?.get(cacheKey);

    if (cached) {
      calls.push('cache-hit');
      return json(JSON.parse(cached));
    }

    calls.push('cache-miss');
    await next();
  });

  app.get('/data', async (req, env, ctx) => {
    calls.push('handler');
    const result = { data: 'fresh', timestamp: Date.now() };

    // Store in cache
    const cacheKey = new URL(req.url).pathname;
    await env.CACHE?.put(cacheKey, JSON.stringify(result));

    return json(result);
  });

  // Mock KV store
  const mockKV = new Map();
  const env = {
    CACHE: {
      get: async (key) => mockKV.get(key),
      put: async (key, value) => mockKV.set(key, value)
    }
  };

  // First request - cache miss
  const response1 = await app.fetch(
    new Request('http://localhost/data'),
    env,
    {}
  );
  const data1 = await response1.json();

  expect(calls).toEqual(['check-cache', 'cache-miss', 'handler']);
  expect(data1.data).toBe('fresh');

  // Reset calls
  calls.length = 0;

  // Second request - cache hit
  const response2 = await app.fetch(
    new Request('http://localhost/data'),
    env,
    {}
  );
  const data2 = await response2.json();

  expect(calls).toEqual(['check-cache', 'cache-hit']);
  expect(calls).not.toContain('handler');

  expect(data2.data).toBe('fresh');
});

test('Mode 1: Service hooks with authorization', async () => {
  const calls = [];

  const app = flite({ mode: 1, format: json });

  // Global hook for authentication
  app.hooks({
    before: {
      all: [
        async (ctx, next) => {
          calls.push('check-auth');
          // Simulate getting user from context
          if (!ctx.params.user) {
            throw new status(401, 'Not authenticated');
          }
          await next();
        }
      ],
      remove: [
        async (ctx, next) => {
          calls.push('check-permission');
          // Only admins can delete
          if (ctx.params.user.role !== 'admin') {
            throw new status(403, 'Admin access required');
          }
          await next();
        }
      ]
    }
  });

  const service = app.service('users', {
    async get(id, params) {
      calls.push('get-user');
      return { id, name: 'Alice' };
    },
    async remove(id, params) {
      calls.push('remove-user');
      return { id, deleted: true };
    }
  });

  // Test get with valid user
  const user1 = await service.get(1, { user: { id: 2, role: 'user' } });
  expect(calls).toEqual(['check-auth', 'get-user']);
  expect(user1.name).toBe('Alice');

  // Reset calls
  calls.length = 0;

  // Test remove with non-admin (should fail)
  await expect(
    service.remove(1, { user: { id: 2, role: 'user' } })
  ).rejects.toThrow('Admin access required');

  expect(calls).toEqual(['check-auth', 'check-permission']);

  // Reset calls
  calls.length = 0;

  // Test remove with admin (should succeed)
  const result = await service.remove(1, { user: { id: 3, role: 'admin' } });
  expect(calls).toEqual(['check-auth', 'check-permission', 'remove-user']);
  expect(result.deleted).toBe(true);
});


describe('Edge cases', async () => {

  test('empty path', async () => {
    const app = flite();
    app.get('', () => text('root'));

    const res = await app.fetch(new Request('http://localhost'));
    expect(await res?.text()).toBe('root');
  });

  test('dots in path', async () => {
    const app = flite();
    app.get('/files/:name', (req) => text(req.params.name));

    const res = await app.fetch(new Request('http://localhost/files/script.min.js'));
    expect(await res?.text()).toBe('script.min.js');
  });


  test('empty query value', async () => {
    const app = flite();
    app.get('/search', (req) => json(req.query));

    const res = await app.fetch(new Request('http://localhost/search?q='));
    expect(await res?.json()).toEqual({ q: '' });
  });

  test('query param without value', async () => {
    const app = flite();
    app.get('/search', (req) => json(req.query));

    const res = await app.fetch(new Request('http://localhost/search?flag'));
    expect(await res?.json()).toEqual({ flag: '' }); // URLSearchParams behavior
  });

  test('encoded query params', async () => {
    const app = flite();
    app.get('/search', (req) => json(req.query));

    const res = await app.fetch(new Request('http://localhost/search?name=John%20Doe&email=test%40example.com'));
    expect(await res?.json()).toEqual({
      name: 'John Doe',
      email: 'test@example.com'
    });
  });

  test('single item array vs string', async () => {
    const app = flite();
    app.get('/search', (req) => json(req.query));

    const res = await app.fetch(new Request('http://localhost/search?tag=one'));
    expect(await res?.json()).toEqual({ tag: 'one' }); // String, not array
  });

  test('specific route before param route', async () => {
    const app = flite();
    app.get('/users/me', () => text('current user'));
    app.get('/users/:id', (req) => text(`user ${req.params.id}`));

    const res = await app.fetch(new Request('http://localhost/users/me'));
    expect(await res?.text()).toBe('current user'); // First match wins
  });

  test('wildcard priority', async () => {
    const app = flite();
    app.get('/api/users', () => text('users'));
    app.get('/api/*', () => text('api fallback'));
    app.get('*', () => text('global fallback'));

    const res1 = await app.fetch(new Request('http://localhost/api/users'));
    expect(await res1?.text()).toBe('users');

    const res2 = await app.fetch(new Request('http://localhost/api/posts'));
    expect(await res2?.text()).toBe('api fallback');

    const res3 = await app.fetch(new Request('http://localhost/other'));
    expect(await res3?.text()).toBe('global fallback');
  });

  test('case sensitive paths', async () => {
    const app = flite();
    app.get('/User', () => text('capital'));
    app.get('/user', () => text('lowercase'));

    const res1 = await app.fetch(new Request('http://localhost/User'));
    expect(await res1?.text()).toBe('capital');

    const res2 = await app.fetch(new Request('http://localhost/user'));
    expect(await res2?.text()).toBe('lowercase');
  });


  test('before hook throws synchronously', async () => {
    const app = flite({
      before: {
        all: [() => { throw new Error('sync error'); }]
      },
      error: {
        all: [(err) => text(err.message)]
      }
    });

    app.get('/test', () => text('ok'));

    const res = await app.fetch(new Request('http://localhost/test'));
    expect(await res?.text()).toBe('sync error');
  });

  test('after hook throws', async () => {
    const app = flite({
      after: {
        all: [() => { throw new Error('after error'); }]
      },
      error: {
        all: [(err) => text(err.message)]
      }
    });

    app.get('/test', () => text('ok'));

    const res = await app.fetch(new Request('http://localhost/test'));
    expect(await res?.text()).toBe('after error');
  });

  test('error in error hook re-throws', async () => {
    const app = flite({
      error: {
        all: [(err) => { throw new Error('error handler failed'); }]
      }
    });

    app.get('/test', () => { throw new Error('original'); });

    await expect(app.fetch(new Request('http://localhost/test')))
      .rejects.toThrow('error handler failed');
  });

  test('before hook throws synchronously', async () => {
    const app = flite({
      before: {
        all: [() => { throw new Error('sync error'); }]
      },
      error: {
        all: [(err) => text(err.message)]
      }
    });

    app.get('/test', () => text('ok'));

    const res = await app.fetch(new Request('http://localhost/test'));
    expect(await res?.text()).toBe('sync error');
  });

  test('after hook throws', async () => {
    const app = flite({
      after: {
        all: [() => { throw new Error('after error'); }]
      },
      error: {
        all: [(err) => text(err.message)]
      }
    });

    app.get('/test', () => text('ok'));

    const res = await app.fetch(new Request('http://localhost/test'));
    expect(await res?.text()).toBe('after error');
  });

  test('error in error hook re-throws', async () => {
    const app = flite({
      error: {
        all: [(err) => { throw new Error('error handler failed'); }]
      }
    });

    app.get('/test', () => { throw new Error('original'); });

    await expect(app.fetch(new Request('http://localhost/test')))
      .rejects.toThrow('error handler failed');
  });

  test('concurrent requests are isolated', async () => {
    const app = flite();

    app.get('/user/:id', (req) => {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(json({ id: req.params.id }));
        }, Math.random() * 100);
      });
    });

    const results = await Promise.all([
      app.fetch(new Request('http://localhost/user/1')),
      app.fetch(new Request('http://localhost/user/2')),
      app.fetch(new Request('http://localhost/user/3'))
    ]);

    expect(await results[0].json()).toEqual({ id: '1' });
    expect(await results[1].json()).toEqual({ id: '2' });
    expect(await results[2].json()).toEqual({ id: '3' });
  });

  test('hooks dont share state', async () => {
    let counter = 0;
    const app = flite({
      before: {
        all: [(req) => {
          req.counter = ++counter; // Bad practice, but testing isolation
        }]
      }
    });

    app.get('/test', (req) => json({ counter: req.counter }));

    const results = await Promise.all([
      app.fetch(new Request('http://localhost/test')),
      app.fetch(new Request('http://localhost/test')),
      app.fetch(new Request('http://localhost/test'))
    ]);

    // Each request should have unique counter
    const counters = await Promise.all(results.map(r => r.json()));
    expect(new Set(counters.map(c => c.counter)).size).toBe(3);
  });


  test('mounting at same path twice', async () => {
    const app = flite();
    const r1 = flite().get('/test', () => text('r1'));
    const r2 = flite().get('/test', () => text('r2'));

    app.use('/api', r1);
    app.use('/api', r2);

    const res = await app.fetch(new Request('http://localhost/api/test'));
    expect(await res?.text()).toBe('r1'); // First wins
  });

  test('middleware never calls next in mode 1', async () => {
    const app = flite({ mode: 1 });

    app.use(async (req, next) => {
      return text('blocked'); // Never calls next
    });

    app.get('/test', () => text('never reached'));

    const res = await app.fetch(new Request('http://localhost/test'));
    expect(await res?.text()).toBe('blocked');
  });


  test('many routes dont cause issues', async () => {
    const app = flite();

    for (let i = 0; i < 1000; i++) {
      app.get(`/route${i}`, () => text(`route ${i}`));
    }

    const res = await app.fetch(new Request('http://localhost/route500'));
    expect(await res?.text()).toBe('route 500');
  });

  test('service teardown cleans up', async () => {
    const app = flite();
    const cleaned = [];

    app.service('users', {
      async find() { return []; },
      teardown: () => { cleaned.push('users'); }
    });

    app.service('posts', {
      async find() { return []; },
      teardown: () => { cleaned.push('posts'); }
    });

    app.teardown();

    expect(cleaned).toEqual(['users', 'posts']);
  });
});

test('Mode 1: Performance monitoring middleware', async () => {
  const calls = [];
  const timings = [];

  const app = flite({ mode: 1, format: json });

  app.use(
    async (req, env, ctx, next) => {
      calls.push('start-timer');
      const start = Date.now();
      await next();
      calls.push('end-timer');
      timings.push(Date.now() - start);
    },
    async (req, env, ctx, next) => {
      calls.push('middleware');
      await new Promise(r => setTimeout(r, 10));
      await next();
    }
  );

  app.get('/test', async (req) => {
    calls.push('handler');
    await new Promise(r => setTimeout(r, 5));
    return { success: true };
  });

  // Route handler
  app.get('/test', async (req) => {
    calls.push('handler');
    await new Promise(resolve => setTimeout(resolve, 5));
    return { success: true }; // Return response to stop runner
  });
  await app.fetch(new Request('http://localhost/test'), {}, {});

  expect(calls).toEqual(['start-timer', 'middleware', 'handler', 'end-timer']);
  expect(timings[0]).toBeGreaterThanOrEqual(15); // At least 15ms (10 + 5)
});

test('Mode 1: Request/Response logging middleware', async () => {
  const logs = [];

  const app = flite({
    mode: 1,
    after: {
      all: [
        async (result, req, env, ctx, next) => {
          logs.push({
            type: 'response',
            path: new URL(req.url).pathname,
            hasData: !!result
          });
          await next();
          return result;
        }
      ]
    }
  });

  // Request logger
  app.use(async (req, env, ctx, next) => {
    const method = req.method;
    console.log(req.method);

    const url = new URL(req.url).pathname;
    logs.push({ type: 'request', method, url });

    await next();
  });

  app.get('/users', async (req) => {
    return { users: [{ id: 1 }, { id: 2 }] };
  });

  app.post('/users', async (req) => {
    return { created: true };
  });

  await app.fetch(new Request('http://localhost/users'), {}, {});
  await app.fetch(
    new Request('http://localhost/users', { method: 'POST' }),
    {},
    {}
  );

  expect(logs).toEqual([
    { type: 'request', method: 'GET', url: '/users' },
    { type: 'response', path: '/users', hasData: true },
    { type: 'request', method: 'POST', url: '/users' },
    { type: 'response', path: '/users', hasData: true }
  ]);

});