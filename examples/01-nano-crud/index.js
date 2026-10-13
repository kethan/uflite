import { serve } from '@hono/node-server';
import { flite } from 'uflite/nano';
import { json, error, status } from 'uflite';

const tasks = new Map();
let nextId = 1;
const router = flite();
const task = id => {
  const found = tasks.get(id);
  if (!found) throw new status(404, 'Task not found');
  return found;
};
const body = async req => {
  try {
    const data = await req.json();
    if (typeof data?.title !== 'string' || !data.title.trim()) throw new Error();
    return data;
  } catch {
    throw new status(400, 'Expected JSON with a non-empty title');
  }
};

router.get('/tasks', () => [...tasks.values()]);
router.get('/tasks/:id', req => task(req.params.id));
router.post('/tasks', async req => {
  const data = await body(req);
  const created = { id: String(nextId++), title: data.title.trim(), done: false };
  tasks.set(created.id, created);
  return json(created, { status: 201 });
});
router.patch('/tasks/:id', async req => {
  const current = task(req.params.id);
  const data = await body(req);
  Object.assign(current, { title: data.title.trim(), done: typeof data.done === 'boolean' ? data.done : current.done });
  return current;
});
router.delete('/tasks/:id', req => {
  const removed = task(req.params.id);
  tasks.delete(removed.id);
  return removed;
});
// Demonstrate that the wrapper catches unexpected exceptions without leaking details.
router.get('/test-error', () => { throw new Error('internal detail'); });

// nano returns undefined for misses and does not automatically format or catch errors.
export const app = {
  async fetch(req) {
    try {
      const result = await router.fetch(req);
      return result == null ? error(404, 'Route not found')
        : result instanceof Response ? result : json(result);
    } catch (err) {
      return error(err.status || 500, (err.status || 500) >= 500 ? 'Internal Server Error' : err.message);
    }
  }
};

if (process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.PORT || 3000);
  serve({ fetch: app.fetch, port });
  console.log(`Nano CRUD: http://localhost:${port}`);
}
