# 04 — DBService, real Auth, ACL and StorageService

From the repository root: `bun install && bun run build`. Then:

```sh
cd examples/04-full-services
npm install
npm start
```

Requires Node 22+, `@hono/node-server`, `umosql@0.3.1`, `better-auth`, `uqry` and the AWS SDK packages imported by `uflite/services/storage` (all are declared in `package.json`). The `file:../..` dependency uses this checkout. By default, UMOSQL's schemaless memory adapter is used by real Better Auth; `createDBService()` uses its own in-memory UMOSQL collection. Both are **ephemeral**. Local StorageService uses `./uploads` (files survive restart until removed). No AWS account is needed to run the default example. Set `AUTH_SECRET` (at least 32 random characters) and `AUTH_BASE_URL` for a real deployment; the built-in fallback secret is **only for local demo**.

Real Better Auth HTTP routes are mounted at `/api/auth/*`. They create sessions; the service routes check the session cookie before execution. The service's before hook checks a real `createACL` policy; it does not trust a client-supplied `user` query field. Use the same cookie jar for all protected calls:

```sh
curl -si localhost:3000/tasks                       # 401 Sign in first
curl -si -c cookies.txt -X POST localhost:3000/api/auth/sign-up/email -H 'origin: http://localhost:3000' -H 'content-type: application/json' -d '{"name":"Ada","email":"ada@example.test","password":"strong-demo-password"}'  # 200, Set-Cookie, user/token
curl -si -b cookies.txt localhost:3000/tasks         # 200 {"total":0,"limit":10,"skip":0,"data":[]}
curl -si -b cookies.txt -X POST localhost:3000/tasks -H 'content-type: application/json' -d '{"name":"First task"}' # 200, record with _id
curl -si -b cookies.txt localhost:3000/tasks         # 200, data includes First task
curl -si -b cookies.txt -X POST localhost:3000/storage/presign -H 'content-type: application/json' -d '{"key":"notes/hello.txt"}' # 200 {key,url,method:"PUT",headers,...}
curl -si -b cookies.txt -X PUT 'localhost:3000/storage?key=notes%2Fhello.txt' -H 'content-type: text/plain' --data-binary 'hello' # 200
curl -s -b cookies.txt 'localhost:3000/storage/download?key=notes%2Fhello.txt' # hello
```

**Optional S3-compatible provider:** set `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`. Set `S3_ENDPOINT` for a local S3-compatible provider such as MinIO; omit it for AWS S3. Restart after configuring them. The same `/storage/presign` endpoint returns a signed PUT URL for the *configured* provider; upload bytes there with its returned headers. No provider is bundled/tested by the example. S3 presigned PUT cannot enforce a file-size limit; configure your provider and authorization policy. Do not put secrets in source control. Storage's global HTTP guard does not protect programmatic service calls: add service-level authorization for those if your app exposes them.

The framework auto-registers standard REST service routes. DBService owns pagination (`$limit`/`$skip` in `params.query` for direct calls); no second CRUD/pagination layer is added. This demo's REST wiring passes the flat request query as params, so avoid claiming REST `$limit` implements DBService pagination until explicitly adapted.
