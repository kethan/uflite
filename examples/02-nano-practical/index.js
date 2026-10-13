import { serve } from '@hono/node-server';
import { flite } from 'uflite/nano';
import { json, error } from 'uflite';

const tasks = flite();
const records = [{ id: '1', title: 'Review PR', done: false }];

// nano mode 0 visits matching ALL/use handlers in registration order;
// a non-null return stops dispatch. This is a demo-only shared key.
tasks.use('/tasks/*', req =>
  req.headers.get('x-api-key') === 'demo-key' ? undefined : error(401, 'Missing API key'));
tasks.get('/tasks', req => {
  const done = req.query.done;
  if (done && !['true', 'false'].includes(done)) return error(400, 'done must be true or false');
  return json(done ? records.filter(item => item.done === (done === 'true')) : records);
});
tasks.get('/tasks/:id', req => {
  const item = records.find(row => row.id === req.params.id);
  return item ? json(item) : error(404, 'Task not found');
});
tasks.post('/tasks', async req => {
  let data;
  try { data = await req.json(); } catch { return error(400, 'Invalid JSON'); }
  if (typeof data?.title !== 'string' || !data.title.trim()) return error(400, 'title is required');
  const item = { id: String(records.length + 1), title: data.title.trim(), done: false };
  records.push(item);
  return json(item, { status: 201 });
});

const router = flite();
router.use('/api', tasks); // mounted paths: /api/tasks and /api/tasks/:id
export const app = { fetch: async req => await router.fetch(req) ?? error(404, 'Route not found') };

if (process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.PORT || 3000);
  serve({ fetch: app.fetch, port });
  console.log(`Nano practical: http://localhost:${port}`);
}
