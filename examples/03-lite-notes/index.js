import { flite } from 'uflite/lite';
import { json, error, status } from 'uflite';
import { store } from './notes.js';

const app = flite({
  before: {
    all: [req => { req.startedAt = Date.now(); }],
    post: [async req => {
      if (new URL(req.url).pathname !== '/notes') return;
      const data = await parse(req.clone());
      validate(data);
    }]
  },
  after: { all: [(res, req) => {
    // lite may return undefined for an unmatched route.
    res ??= error(404, 'Route not found');
    const headers = new Headers(res.headers);
    headers.set('x-duration-ms', String(Date.now() - req.startedAt));
    return new Response(res.body, { status: res.status, headers });
  }] },
  error: { all: [err => error(err.status || 500, (err.status || 500) >= 500 ? 'Internal Server Error' : err.message)] }
});

async function parse(req) {
  try { return await req.json(); }
  catch { throw new status(400, 'Invalid JSON'); }
}
function validate(data) {
  if (typeof data?.title !== 'string' || !data.title.trim()) throw new status(400, 'title is required');
  return data.title.trim();
}
function found(id) {
  const note = store.get(id);
  if (!note) throw new status(404, 'Note not found');
  return note;
}

app.get('/notes', () => json(store.list()));
app.get('/notes/:id', req => json(found(req.params.id)));
app.post('/notes', async req => json(store.create(validate(await parse(req))), { status: 201 }));
app.patch('/notes/:id', async req => { found(req.params.id); return json(store.update(req.params.id, validate(await parse(req)))); });
app.delete('/notes/:id', req => { found(req.params.id); return json(store.remove(req.params.id)); });

export { app };
export default app;
