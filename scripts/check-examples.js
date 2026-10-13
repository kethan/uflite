import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
if (!existsSync(join(root, 'dist/index.es.js'))) {
  throw new Error('Run `bun run build` from the repository root before checking examples');
}
const names = ['01-nano-crud', '02-nano-practical', '03-lite-notes', '04-full-services', '05-full-middleware-resolvers', '06-auth-jwt-acl'];
const freePort = () => new Promise((resolve, reject) => {
  const server = createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    server.close(() => resolve(port));
  });
});

const request = (base, path, { method = 'GET', data, headers = {} } = {}) =>
  fetch(base + path, {
    method,
    headers: { ...(data === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    signal: AbortSignal.timeout(5000)
  });
const body = async response => response.json();

const checks = [
  async base => {
    assert.deepEqual(await body(await request(base, '/api/tasks')), []);
    const bad = await request(base, '/api/tasks', { method: 'POST', data: {} });
    assert.equal(bad.status, 400);
    const created = await request(base, '/api/tasks', { method: 'POST', data: { title: 'Ship docs' } });
    assert.equal(created.status, 201);
    const { id } = await body(created);
    assert.equal((await body(await request(base, `/api/tasks/${id}`))).title, 'Ship docs');
    assert.equal((await body(await request(base, `/api/tasks/${id}`, { method: 'PATCH', data: { done: true } }))).title, 'Ship docs');
    assert.equal((await body(await request(base, `/api/tasks/${id}`, { method: 'PATCH', data: { title: 'Fixed' } }))).done, true);
    assert.equal((await request(base, `/api/tasks/${id}`, { method: 'PATCH', data: { done: 'yes' } })).status, 400);
    assert.equal((await body(await request(base, `/api/tasks/${id}`, { method: 'DELETE' }))).id, id);
    assert.equal((await request(base, `/api/tasks/${id}`)).status, 404);
    assert.equal((await request(base, '/missing')).status, 404);
    const serverError = await request(base, '/test-error');
    assert.equal(serverError.status, 500);
    assert.equal((await body(serverError)).error, 'Internal Server Error');
  },
  async base => {
    assert.equal((await request(base, '/api/tasks')).status, 401);
    const headers = { 'x-api-key': 'demo-key' };
    assert.equal((await body(await request(base, '/api/tasks?done=false', { headers }))).length, 1);
    assert.equal((await body(await request(base, '/api/tasks/1', { headers }))).id, '1');
    assert.equal((await request(base, '/api/tasks?done=maybe', { headers })).status, 400);
    assert.equal((await request(base, '/api/tasks', { method: 'POST', headers, data: {} })).status, 400);
    assert.equal((await request(base, '/api/tasks', { method: 'POST', headers, data: { title: 'Write tests' } })).status, 201);
  },
  async base => {
    assert.deepEqual(await body(await request(base, '/notes')), []);
    assert.equal((await request(base, '/notes', { method: 'POST', data: {} })).status, 400);
    const created = await request(base, '/notes', { method: 'POST', data: { title: '  Note  ' } });
    assert.equal(created.status, 201);
    assert.ok(created.headers.has('x-duration-ms'));
    const { id } = await body(created);
    assert.equal((await body(await request(base, `/notes/${id}`))).title, 'Note');
    assert.equal((await body(await request(base, `/notes/${id}`, { method: 'PATCH', data: { title: 'Changed' } }))).title, 'Changed');
    assert.equal((await body(await request(base, `/notes/${id}`, { method: 'DELETE' }))).id, id);
    assert.equal((await request(base, `/notes/${id}`)).status, 404);
    assert.equal((await request(base, '/unknown')).status, 404);
  },
  async base => {
    assert.equal((await request(base, '/tasks')).status, 401);
    assert.equal((await request(base, '/storage')).status, 401);
    assert.equal((await request(base, '/storage/download?key=notes%2Fhello.txt')).status, 401);
    const signup = await request(base, '/api/auth/sign-up/email', {
      method: 'POST', headers: { origin: base }, data: { name: 'Ada', email: 'ada@example.test', password: 'strong-demo-password' }
    });
    assert.equal(signup.status, 200, `Auth signup: ${await signup.text()}`);
    const cookies = signup.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    assert.ok(cookies.includes('session_token'), 'Better Auth must set a session cookie');
    const headers = { cookie: cookies };
    assert.equal((await request(base, '/tasks', { headers })).status, 200);
    const created = await request(base, '/tasks', { headers, method: 'POST', data: { name: 'First task' } });
    assert.equal(created.status, 200);
    const task = await body(created);
    assert.ok(task._id);
    assert.equal((await body(await request(base, '/tasks', { headers }))).data[0].name, 'First task');
    const missing = await request(base, '/tasks/absent', { headers });
    assert.equal(missing.status, 500); // DBService notFound uses code, not status
    assert.equal((await body(missing)).error, 'Internal Server Error');
    const signed = await request(base, '/storage/presign', { headers, method: 'POST', data: { key: 'notes/hello.txt' } });
    assert.equal(signed.status, 200);
    const signedBody = await body(signed);
    assert.equal(signedBody.method, 'PUT', JSON.stringify(signedBody));
    const upload = await fetch(base + '/storage?key=notes%2Fhello.txt', { method: 'PUT', headers: { ...headers, 'content-type': 'text/plain' }, body: 'hello' });
    assert.equal(upload.status, 200);
    const download = await request(base, '/storage/download?key=notes%2Fhello.txt', { headers });
    assert.equal(await download.text(), 'hello');
  },
  async base => {
    assert.equal((await request(base, '/items')).status, 401);
    const headers = { authorization: 'Bearer demo-token' };
    assert.deepEqual(await body(await request(base, '/items', { headers })), []);
    const invalid = await request(base, '/items', { method: 'POST', headers, data: {} });
    assert.equal(invalid.status, 400);
    const created = await request(base, '/items', { method: 'POST', headers, data: { name: '  apple  ' } });
    assert.equal(created.status, 200);
    assert.ok(created.headers.get('x-request-id'));
    const item = await body(created);
    assert.equal(item.label, 'APPLE');
    assert.equal((await body(await request(base, `/items/${item.id}`, { headers }))).name, 'apple');
    assert.equal((await body(await request(base, '/item-count', { headers }))).count, 1);
    assert.equal((await request(base, '/items/nope', { headers })).status, 404);
    assert.equal((await body(await request(base, `/items/${item.id}`, { method: 'DELETE', headers }))).id, item.id);
  },
  async base => {
    assert.equal((await request(base, '/api/me')).status, 401);
    const signup = await request(base, '/api/auth/sign-up/email', {
      method: 'POST', headers: { origin: base },
      data: { name: 'Ada', email: 'ada@example.test', password: 'strong-demo-password' }
    });
    assert.equal(signup.status, 200, `JWT demo signup: ${await signup.text()}`);
    const wrongPassword = await request(base, '/api/auth/sign-in/email', {
      method: 'POST', headers: { origin: base },
      data: { email: 'ada@example.test', password: 'wrong-demo-password' }
    });
    assert.equal(wrongPassword.status, 401);
    const login = await request(base, '/api/auth/sign-in/email', {
      method: 'POST', headers: { origin: base },
      data: { email: 'ada@example.test', password: 'strong-demo-password' }
    });
    assert.equal(login.status, 200, `JWT demo login: ${await login.clone().text()}`);
    const loginBody = await body(login);
    assert.ok(loginBody.token && !loginBody.token.includes('.'), 'Login returns an opaque session token');
    const cookies = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    assert.ok(cookies.includes('session_token'));
    assert.equal((await request(base, '/api/auth/token')).status, 401);
    const issued = await request(base, '/api/auth/token', { headers: { cookie: cookies } });
    assert.equal(issued.status, 200);
    const { token } = await body(issued);
    assert.equal(token.split('.').length, 3, 'Expected signed JWT');
    const bearer = { authorization: `Bearer ${token}` };
    const profile = await request(base, '/api/me', { headers: bearer });
    assert.equal(profile.status, 200);
    assert.equal((await body(profile)).id, loginBody.user.id);
    assert.equal((await request(base, '/api/admin', { headers: bearer })).status, 403);
    assert.equal((await request(base, '/api/me', { headers: { authorization: 'Bearer invalid' } })).status, 401);
    assert.equal((await request(base, '/api/me', { headers: { authorization: `Bearer ${token.slice(0, -4)}xxxx` } })).status, 401);
  }
];

for (const [index, name] of names.entries()) {
  const cwd = join(root, 'examples', name);
  execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['install'], { cwd, stdio: 'inherit' });
  const port = await freePort();
  const base = `http://localhost:${port}`;
  // Run the same `npm start` script documented in each example README.
  const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['start'], {
    cwd,
    detached: process.platform !== 'win32',
    env: { ...process.env, PORT: String(port), AUTH_BASE_URL: base, NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', part => { output += part; });
  child.stderr.on('data', part => { output += part; });
  try {
    let ready = false;
    for (let tries = 0; tries < 100 && !ready; tries++) {
      if (child.exitCode !== null) throw new Error(`Server exited ${child.exitCode}: ${output}`);
      try { await fetch(base + '/__ready', { signal: AbortSignal.timeout(200) }); ready = true; }
      catch { await new Promise(resolve => setTimeout(resolve, 50)); }
    }
    if (!ready) throw new Error(`Server did not start: ${output}`);
    await checks[index](base);
    console.log(`PASS ${name}: successful and error HTTP cases`);
  } catch (err) {
    console.error(`FAIL ${name}: ${err.stack}\n${output}`);
    process.exitCode = 1;
    break;
  } finally {
    // npm spawns a shell and then Bun; terminate the whole example server tree.
    try {
      if (process.platform === 'win32') child.kill();
      else if (child.pid) process.kill(-child.pid, 'SIGTERM');
    } catch (err) {
      if (err.code !== 'ESRCH') throw err;
    }
  }
}
