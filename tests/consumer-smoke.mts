// Compile with NodeNext against the public package exports after `bun run build`.
import { flite, json, run, type FullFliteApp } from 'uflite';
import * as rootExports from 'uflite';
import * as nanoExports from 'uflite/nano';
import * as liteExports from 'uflite/lite';
import { flite as lite, type FliteApp, type BeforeHook } from 'uflite/lite';
import { flite as nano } from 'uflite/nano';
import { bodyLimit } from 'uflite/middlewares';
import dbDefault, { createDBService, type DBServiceOptions, type CollectionProvider } from 'uflite/services/db';
import tableDefault, { createTableService } from 'uflite/services/table';
import storageDefault, { createStorageService, type StorageServiceOptions } from 'uflite/services/storage';
import { isPresent } from 'uflite/predicates';
import { trimString } from 'uflite/transformers';
import { fromPath } from 'uflite/resolvers';
import { createLocalStorageService } from 'uflite/services/local-storage';
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
void run;

// Public subpaths expose the same named/default factories as their JS entries.
const dbOptions: DBServiceOptions = { idField: 'id' };
const collection: CollectionProvider = () => ({});
const storageOptions: StorageServiceOptions = { type: 'local' };
void [dbDefault, dbOptions, collection, tableDefault, createTableService,
  storageDefault, createStorageService, storageOptions, isPresent, trimString, fromPath];

// Type declarations must not advertise named exports missing at runtime.
// @ts-expect-error events is applied internally, not exported from the root.
void rootExports.events;
// @ts-expect-error channels is applied internally, not exported from the root.
void rootExports.channels;
// @ts-expect-error services is applied internally, not exported from the root.
void rootExports.services;
// @ts-expect-error run is available only from the full entry.
void nanoExports.run;
// @ts-expect-error run is available only from the full entry.
void liteExports.run;
