import { flite, json, status } from 'uflite';
import { requestId, bearerAuth, requestIdAfter } from 'uflite/middlewares';
import { requireFields, transformData } from 'uflite/hooks';
import { trimStrings } from 'uflite/transformers';
import { fromPath } from 'uflite/resolvers';
import { isNonEmptyString } from 'uflite/predicates';

const records = new Map();
let nextId = 1;
const addId = requestId();
const guard = bearerAuth({ token: 'demo-token' });
const app = flite({
  // All routes already return Responses.
  format: false,
  // In mode 0, forward only the Request to optional-next middleware;
  // Fetch runtimes may pass additional arguments to the exported handler.
  before: { all: [req => addId(req), req => guard(req)] },
  after: { all: [(res, req) => res?.headers ? requestIdAfter(res, req) : res] },
  error: { all: [err => json({ error: (err.status || 500) >= 500 ? 'Internal Server Error' : err.message }, { status: err.status || 500 })] }
});

const items = app.service('items', {
  async find() { return [...records.values()]; },
  async get(id) {
    if (!records.has(id)) throw new status(404, 'Item not found');
    return records.get(id);
  },
  async create(data) {
    const item = { id: String(nextId++), name: data.name };
    records.set(item.id, item);
    return item;
  },
  async remove(id) {
    const item = records.get(id);
    if (!item) throw new status(404, 'Item not found');
    records.delete(id);
    return item;
  },
  async count() { return records.size; } // custom method: direct service call only
});
items.hooks({
  before: { create: [requireFields(['name']), transformData(trimStrings({ fields: ['name'] })),
    ctx => { if (!isNonEmptyString(ctx.data.name)) throw new status(400, 'name is required'); }] },
  after: { create: [ctx => { ctx.result.label = fromPath('name')(null, ctx.result).toUpperCase(); }] },
  error: { all: [ctx => console.warn('Service failed:', ctx.method, ctx.error.message)] }
});
items.on('created', item => console.log('Created item', item.id));
app.get('/item-count', async () => json({ count: await items.count() }));
export { app };
export default app;
