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
const body = async (req, partial = false) => {
  try {
    const data = await req.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    if (partial) {
      const fields = Object.keys(data);
      if (!fields.length || fields.some(key => !['title', 'done'].includes(key)) ||
          ('done' in data && typeof data.done !== 'boolean') ||
          ('title' in data && (typeof data.title !== 'string' || !data.title.trim())))
        throw new Error();
    } else if (typeof data.title !== 'string' || !data.title.trim()) throw new Error();
    return data;
  } catch {
    throw new status(400, 'Expected a title, or a valid title/done patch');
  }
};

router.get('/api/tasks', () => [...tasks.values()]);
router.get('/api/tasks/:id', req => task(req.params.id));
router.post('/api/tasks', async req => {
  const data = await body(req);
  const created = { id: String(nextId++), title: data.title.trim(), done: false };
  tasks.set(created.id, created);
  return json(created, { status: 201 });
});
router.patch('/api/tasks/:id', async req => {
  const current = task(req.params.id);
  const data = await body(req, true);
  if ('title' in data) current.title = data.title.trim();
  if ('done' in data) current.done = data.done;
  return current;
});
router.delete('/api/tasks/:id', req => {
  const removed = task(req.params.id);
  tasks.delete(removed.id);
  return removed;
});
// Demonstrate the catch(error) path using a deliberately generic message.
router.get('/test-error', () => { throw new Error('Internal Server Error'); });
router.all('*', () => error(404, 'Route not found'));

// The last route supplies an HTTP 404; nano itself returns undefined on a miss.
export const app = {
  fetch: (request, ...args) => router.fetch(request, ...args).then(json).catch(error)
};
export default app;
