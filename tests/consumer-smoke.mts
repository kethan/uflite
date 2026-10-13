// Compile with NodeNext against the public package exports after `bun run build`.
import { flite, json, type FullFliteApp } from 'uflite';
import { flite as lite, type FliteApp, type BeforeHook } from 'uflite/lite';
import { flite as nano } from 'uflite/nano';
import { bodyLimit } from 'uflite/middlewares';
import { createDBService } from 'uflite/services';
import { createLocalStorageService } from 'uflite/services/localStorage';
import { createACL } from 'uflite/services/acl';
import { createAuth } from 'uflite/services/auth';

const app: FullFliteApp = flite();
app.get('/hi', () => json({ ok: true }));
const before: BeforeHook = async (request, next) => { if (next) await next(); };
const small: FliteApp = lite({ before: { all: [before, bodyLimit({ max: 42 })] } });
small.get('/id/:id', request => Response.json({ id: request.params?.id }));
nano().get('/status', () => new Response('ok'));
createDBService();
createLocalStorageService({ basePath: './files' });
createACL({ enabled: true, rules: [] });
void createAuth;
