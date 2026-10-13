import { createSchemalessAdapter } from 'umosql/schemaless';
import { flite, json, status } from 'uflite';
import { createDBService } from 'uflite/services/db';
import { createAuth } from 'uflite/services/auth';
import { createACL } from 'uflite/services/acl';
import { createStorageService } from 'uflite/services/storage';

const port = Number(process.env.PORT || 3000);
const baseURL = process.env.AUTH_BASE_URL || `http://localhost:${port}`;
if (process.env.NODE_ENV === 'production' && !process.env.AUTH_SECRET) throw new Error('Set AUTH_SECRET in production');
const secret = process.env.AUTH_SECRET || 'local-demo-secret-at-least-32-characters-long';
const { adapter } = createSchemalessAdapter(undefined, 'memory');
const auth = await createAuth({ adapter, baseURL, secret });
const acl = createACL({ enabled: true, rules: [{
  id: 'signed-in-tasks',
  permissions: ['member:tasks:find', 'member:tasks:get', 'member:tasks:create', 'member:tasks:patch', 'member:tasks:remove']
}] });

const app = flite({
  // Every route below returns a Response, so skip the automatic formatter.
  format: false,
  before: { all: [async req => {
    const pathname = new URL(req.url).pathname;
    if (!['/tasks', '/storage'].some(path => pathname === path || pathname.startsWith(path + '/'))) return;
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) return json({ error: 'Sign in first' }, { status: 401 });
    // REST service routes pass request.query as the service params. Replace any client-supplied
    // `user` query field with the verified session user before the registered routes run.
    req.query.user = session.user;
  }] },
  error: { all: [err => json({ error: (err.status || 500) >= 500 ? 'Internal Server Error' : err.message }, { status: err.status || 500 })] }
});

// Forward Better Auth's real HTTP endpoints; no simulated login/token.
app.all('/api/auth/*', req => auth.handler(req));
const tasks = app.service('tasks', createDBService());
tasks.hooks({ before: { all: [ctx => {
  if (!ctx.params.user) throw new status(401, 'Sign in first');
  if (!acl.can({ user: ctx.params.user }, `member:tasks:${ctx.method}`)) throw new status(403, 'Forbidden');
}] } });

// Local storage works immediately. Configure S3_* variables to use an S3-compatible provider.
const storage = process.env.S3_BUCKET ? createStorageService({
  type: 's3', bucket: process.env.S3_BUCKET, region: process.env.S3_REGION,
  endpoint: process.env.S3_ENDPOINT, accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
}) : createStorageService({ type: 'local', basePath: './uploads', maxFileSize: 1024 * 1024 });
app.service('storage', storage);

export { app };
export default app;
