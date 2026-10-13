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
// Demonstrate the catch(error) path using a deliberately generic message.
router.get('/test-error', () => { throw new Error('Internal Server Error'); });
router.all('*', () => error(404, 'Route not found'));

// The last route supplies an HTTP 404; nano itself returns undefined on a miss.
export const app = {
  fetch: (request, ...args) => router.fetch(request, ...args).then(json).catch(error)
};
export default app;
