import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { createACL } from '../src/services/acl.js'
import { createStorageService } from '../src/services/storage.js'
import { flite } from '../src/index.js'

const config = overrides => ({
  bucket: 'uploads',
  region: 'us-east-1',
  accessKeyId: 'test-access-key',
  secretAccessKey: 'test-secret-key',
  ...overrides
})

const mockClient = (responses = []) => {
  const calls = []
  return {
    calls,
    client: {
      async send(command) {
        calls.push(command)
        const response = responses[calls.length - 1]
        if (response instanceof Error) throw response
        return response || {}
      }
    }
  }
}

const jsonRequest = (url, method, body) => new Request(`http://localhost${url}`, {
  method,
  headers: { 'content-type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) })
})

const localRoots = []
const localService = async options => {
  const basePath = await mkdtemp(join(process.cwd(), '.tmp-storage-'))
  localRoots.push(basePath)
  return createStorageService({ basePath, ...options })
}

afterEach(async () => {
  await Promise.all(localRoots.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('StorageService local filesystem default', () => {
  it('defaults to local storage without credentials and validates provider options', () => {
    expect(createStorageService().type).toBe('local')
    expect(createStorageService({ type: 'local', basePath: './files' }).type).toBe('local')
    expect(() => createStorageService({ type: 'unknown' })).toThrow('unsupported storage type')
    expect(() => createStorageService({ type: 'local', maxFileSize: 0 })).toThrow('maxFileSize')
  })

  it('writes and reads bytes, reports metadata, and blocks unsafe keys and oversized files', async () => {
    const service = await localService({ maxFileSize: 16 })
    const uploaded = await service.create({
      key: 'users/u1/avatar.txt',
      body: 'avatar bytes',
      contentType: 'text/plain'
    })

    expect(uploaded).toMatchObject({ key: 'users/u1/avatar.txt', size: 12, contentType: 'text/plain' })
    expect(await service.get('users/u1/avatar.txt')).toMatchObject({
      key: uploaded.key, size: uploaded.size, contentType: uploaded.contentType
    })
    expect(new TextDecoder().decode((await service.download('users/u1/avatar.txt')).body)).toBe('avatar bytes')
    for (const key of ['../escape.txt', '/absolute.txt', 'folder/../escape.txt', 'folder\\escape.txt', 'folder//file']) {
      await expect(service.upload({ key, body: 'no' })).rejects.toThrow()
    }
    await expect(service.upload({ key: 'large.bin', body: 'x'.repeat(17) })).rejects.toThrow('maxFileSize')
    await expect(service.get('missing.txt')).rejects.toMatchObject({ code: 404, name: 'NotFound' })
  })

  it('accepts byte arrays, supports idempotent deletion, and builds download URLs', async () => {
    const service = await localService({ publicUrl: 'https://files.example.test/public/' })
    await service.upload({ key: 'binary/data.bin', body: new Uint8Array([0, 1, 255]) })
    expect([...((await service.download('binary/data.bin')).body)]).toEqual([0, 1, 255])
    expect((await service.presignDownload({ key: 'binary/data.bin' })).url)
      .toBe('https://files.example.test/public/binary/data.bin')
    expect(await service.remove('binary/data.bin')).toEqual({ key: 'binary/data.bin', deleted: true })
    expect(await service.remove('binary/data.bin')).toEqual({ key: 'binary/data.bin', deleted: true })
    await expect(service.download('binary/data.bin')).rejects.toMatchObject({ status: 404 })
  })

  it('lists sorted files with prefix filtering and stable cursors', async () => {
    const service = await localService()
    for (const key of ['users/b.txt', 'users/a.txt', 'public/c.txt']) {
      await service.upload({ key, body: key })
    }

    const first = await service.find({ query: { prefix: 'users/', limit: 1 } })
    expect(first.data.map(file => file.key)).toEqual(['users/a.txt'])
    expect(first.nextCursor).toBe('users/a.txt')
    const second = await service.find({ query: { prefix: 'users/', limit: 1, cursor: first.nextCursor } })
    expect(second.data.map(file => file.key)).toEqual(['users/b.txt'])
    expect(second.nextCursor).toBeNull()
  })

  it('serves bounded raw uploads and downloads through the normal hookable service API', async () => {
    const service = await localService({ maxFileSize: 4 })
    const app = flite()
    const storage = app.service('local-files', service)
    const events = []
    storage.hooks({ before: { upload: [ctx => events.push(ctx.params.request.method)] } })

    const put = await app.fetch(new Request('http://localhost/local-files?key=images%2Fcat.txt', {
      method: 'PUT', headers: { 'content-type': 'text/plain' }, body: 'cat!'
    }))
    expect(put.status).toBe(200)
    expect((await put.json()).key).toBe('images/cat.txt')
    expect(events).toEqual(['PUT'])

    const get = await app.fetch(new Request('http://localhost/local-files/download?key=images%2Fcat.txt'))
    expect(get.status).toBe(200)
    expect(get.headers.get('content-type')).toBe('text/plain')
    expect(await get.text()).toBe('cat!')

    const unsafeKey = await app.fetch(new Request('http://localhost/local-files?key=..%2Foutside.txt', {
      method: 'PUT', body: 'x'
    }))
    expect(unsafeKey.status).toBe(400)

    const tooLarge = await app.fetch(new Request('http://localhost/local-files?key=large.bin', {
      method: 'PUT', body: 'five!'
    }))
    expect(tooLarge.status).toBe(413)
  })
})

describe('StorageService configuration', () => {
  it('requires a bucket, region and static credentials', () => {
    for (const [name, value] of Object.entries({
      bucket: undefined,
      region: undefined,
      accessKeyId: undefined,
      secretAccessKey: undefined
    })) {
      expect(() => createStorageService(config({ [name]: value }))).toThrow(name)
    }
  })

  it('accepts endpoint, region, credentials, session token and path-style configuration', () => {
    const { client } = mockClient()
    const service = createStorageService(config({
      endpoint: 'http://localhost:9000',
      sessionToken: 'temporary-token',
      forcePathStyle: true,
      client
    }))

    expect(typeof service.create).toBe('function')
    expect(typeof service.find).toBe('function')
  })

  it('uses a 15-minute default and allows per-operation expiry overrides', async () => {
    const service = createStorageService(config({ endpoint: 'https://objects.example.test' }))
    const upload = await service.presignUpload({ key: 'users/123/avatar.jpg' })
    const download = await service.presignDownload({ key: 'users/123/avatar.jpg', expiresIn: 120 })

    expect(upload.expiresIn).toBe(900)
    expect(new URL(upload.url).searchParams.get('X-Amz-Expires')).toBe('900')
    expect(download.expiresIn).toBe(120)
    expect(new URL(download.url).searchParams.get('X-Amz-Expires')).toBe('120')
    expect(new URL(upload.url).pathname).toContain('users/123/avatar.jpg')
  })

  it('uses configured upload and download expiry defaults', async () => {
    const service = createStorageService(config({
      uploadExpiresIn: 300,
      downloadExpiresIn: 60,
      endpoint: 'https://objects.example.test'
    }))
    const upload = await service.create({ key: 'docs/report.pdf' })
    const download = await service.presignDownload({ key: 'docs/report.pdf' })

    expect(upload.expiresIn).toBe(300)
    expect(download.expiresIn).toBe(60)
  })

  it('rejects expiration values outside the supported S3 range', () => {
    for (const value of [0, -1, 604801, 1.5, 'forever']) {
      expect(() => createStorageService(config({ uploadExpiresIn: value })))
        .toThrow('uploadExpiresIn')
    }
  })
})

describe('StorageService presigned URLs', () => {
  it('signs PUT uploads with the exact key and optional content type header', async () => {
    const service = createStorageService(config({ endpoint: 'https://objects.example.test' }))
    const result = await service.presignUpload({
      key: 'users/123/avatar image.jpg',
      contentType: 'image/jpeg',
      expiresIn: 75
    })
    const url = new URL(result.url)

    expect(result.key).toBe('users/123/avatar image.jpg')
    expect(result.method).toBe('PUT')
    expect(result.headers).toEqual({ 'Content-Type': 'image/jpeg' })
    expect(result.expiresIn).toBe(75)
    expect(url.searchParams.get('X-Amz-Expires')).toBe('75')
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain('content-type')
    expect(JSON.stringify(result)).not.toContain('test-secret-key')
    expect(result).not.toHaveProperty('accessKeyId')
    expect(result).not.toHaveProperty('secretAccessKey')
  })

  it('signs GET downloads without returning credential fields', async () => {
    const service = createStorageService(config({ endpoint: 'https://objects.example.test' }))
    const result = await service.presignDownload({ key: 'private/user-1/report.pdf' })
    const url = new URL(result.url)

    expect(result.key).toBe('private/user-1/report.pdf')
    expect(result.expiresIn).toBe(900)
    expect(url.searchParams.get('X-Amz-Expires')).toBe('900')
    expect(result).not.toHaveProperty('accessKeyId')
    expect(result).not.toHaveProperty('secretAccessKey')
    expect(JSON.stringify(result)).not.toContain('test-secret-key')
  })

  it('does not claim to enforce upload size through presigned PUT', async () => {
    const service = createStorageService(config({
      endpoint: 'https://objects.example.test',
      presign: async () => 'https://signed.example.test/upload'
    }))

    await expect(service.presignUpload({ key: 'large.bin', contentLength: 100 }))
      .rejects.toThrow('cannot be enforced')
  })

  it('rejects invalid keys, content types and expiry overrides', async () => {
    const service = createStorageService(config({ endpoint: 'https://objects.example.test' }))

    await expect(service.presignUpload({})).rejects.toThrow('key')
    await expect(service.presignDownload({ key: '' })).rejects.toThrow('key')
    await expect(service.presignUpload({ key: 'a', contentType: ' ' }))
      .rejects.toThrow('contentType')
    await expect(service.presignDownload({ key: 'a', expiresIn: 604801 }))
      .rejects.toThrow('expiresIn')
  })
})

describe('StorageService metadata, list and delete', () => {
  it('maps HeadObject into stable metadata and preserves opaque keys', async () => {
    const lastModified = new Date('2026-10-08T00:00:00Z')
    const { client, calls } = mockClient([{
      ContentLength: 42,
      ContentType: 'text/plain',
      ETag: '"abc"',
      LastModified: lastModified,
      Metadata: { owner: 'client-metadata' },
      ServerSideEncryption: 'AES256'
    }])
    const service = createStorageService(config({ client }))
    const metadata = await service.get('users/123/a file.txt')

    expect(calls[0].constructor.name).toBe('HeadObjectCommand')
    expect(calls[0].input).toEqual({ Bucket: 'uploads', Key: 'users/123/a file.txt' })
    expect(metadata).toEqual({
      key: 'users/123/a file.txt',
      size: 42,
      contentType: 'text/plain',
      etag: '"abc"',
      lastModified,
      metadata: { owner: 'client-metadata' }
    })
    expect(metadata).not.toHaveProperty('ServerSideEncryption')
  })

  it('propagates provider errors for missing metadata', async () => {
    const missing = Object.assign(new Error('Not Found'), {
      name: 'NotFound',
      $metadata: { httpStatusCode: 404 }
    })
    const { client } = mockClient([missing])
    const service = createStorageService(config({ client }))

    await expect(service.get({ key: 'missing.txt' })).rejects.toBe(missing)
  })

  it('lists with prefix, limit and opaque continuation token', async () => {
    const lastModified = new Date('2026-10-07T12:00:00Z')
    const { client, calls } = mockClient([{
      Contents: [{
        Key: 'users/123/avatar.jpg',
        Size: 25,
        ETag: '"etag"',
        LastModified: lastModified
      }],
      IsTruncated: true,
      NextContinuationToken: 'next-page-token'
    }])
    const service = createStorageService(config({ client }))
    const result = await service.find({
      query: { prefix: 'users/123/', limit: 1, cursor: 'current-token' }
    })

    expect(calls[0].constructor.name).toBe('ListObjectsV2Command')
    expect(calls[0].input).toEqual({
      Bucket: 'uploads', Prefix: 'users/123/', MaxKeys: 1,
      ContinuationToken: 'current-token'
    })
    expect(result).toEqual({
      data: [{
        key: 'users/123/avatar.jpg', size: 25, contentType: null,
        etag: '"etag"', lastModified
      }],
      nextCursor: 'next-page-token'
    })
  })

  it('returns an empty list and null cursor for an empty bucket', async () => {
    const { client } = mockClient([{}])
    const service = createStorageService(config({ client }))

    expect(await service.find()).toEqual({ data: [], nextCursor: null })
  })

  it('validates list prefix, cursor and limit without fetching all objects', async () => {
    const { client, calls } = mockClient()
    const service = createStorageService(config({ client }))

    await expect(service.find({ prefix: 5 })).rejects.toThrow('prefix')
    await expect(service.find({ cursor: {} })).rejects.toThrow('cursor')
    await expect(service.find({ limit: 1001 })).rejects.toThrow('limit')
    expect(calls).toHaveLength(0)
  })

  it('deletes through DeleteObject and returns an idempotent result', async () => {
    const { client, calls } = mockClient([{}])
    const service = createStorageService(config({ client }))

    expect(await service.remove({ key: 'documents/2026/report.pdf' }))
      .toEqual({ key: 'documents/2026/report.pdf', deleted: true })
    expect(calls[0].constructor.name).toBe('DeleteObjectCommand')
    expect(calls[0].input).toEqual({ Bucket: 'uploads', Key: 'documents/2026/report.pdf' })
  })

  it('preserves delete provider errors', async () => {
    const failure = Object.assign(new Error('Access Denied'), { name: 'AccessDenied' })
    const { client } = mockClient([failure])
    const service = createStorageService(config({ client }))

    await expect(service.remove('secret.txt')).rejects.toBe(failure)
  })
})

describe('StorageService hooks and REST access', () => {
  it('runs hooks for direct presign, metadata, list, and delete calls', async () => {
    const failure = new Error('storage unavailable')
    const service = createStorageService(config({
      endpoint: 'https://objects.example.test',
      client: {
        send: async command => {
          if (command.constructor.name === 'HeadObjectCommand') throw failure
          return {}
        }
      },
      presign: async () => 'https://signed.example.test/object'
    }))
    const app = flite()
    const storage = app.service('storage', service)
    const events = []
    storage.hooks({
      before: {
        presignUpload: [ctx => { events.push(`before:${ctx.method}`) }],
        get: [ctx => { events.push(`before:${ctx.method}`) }]
      },
      after: {
        presignUpload: [ctx => { events.push(`after:${ctx.method}`) }]
      },
      error: {
        get: [ctx => { events.push(`error:${ctx.method}`); expect(ctx.error).toBe(failure) }]
      }
    })

    await storage.presignUpload({ key: 'users/1/file.txt' }, { user: { id: '1' } })
    await expect(storage.get('missing')).rejects.toBe(failure)
    expect(events).toEqual(['before:presignUpload', 'after:presignUpload', 'before:get', 'error:get'])
  })

  it('exposes frontend-friendly REST endpoints that preserve slash-containing keys', async () => {
    const sent = []
    const hookUsers = []
    const app = flite({
      before: {
        all: [request => { request._mw = { user: { id: 'authenticated-user' } } }]
      }
    })
    const storage = app.service('storage', createStorageService(config({
      endpoint: 'https://objects.example.test',
      client: { send: async command => { sent.push(command); return {} } },
      presign: async (_client, command, options) =>
        `https://signed.example.test/${command.input.Key}?expires=${options.expiresIn}`
    })))
    storage.hooks({
      before: {
        create: [ctx => hookUsers.push(ctx.params.request._mw.user.id)]
      }
    })

    const standardUpload = await app.fetch(jsonRequest('/storage', 'POST', { key: 'standard/upload.txt' }))
    expect(standardUpload.status).toBe(200)
    expect((await standardUpload.json()).key).toBe('standard/upload.txt')
    expect(hookUsers).toEqual(['authenticated-user'])

    const listing = await app.fetch(new Request('http://localhost/storage?prefix=users%2F123%2F'))
    expect(listing.status).toBe(200)
    expect(sent[0].input.Prefix).toBe('users/123/')

    const upload = await app.fetch(jsonRequest('/storage/presign', 'POST', {
      key: 'users/123/avatar.jpg', contentType: 'image/jpeg'
    }))
    expect(upload.status).toBe(200)
    expect(await upload.json()).toMatchObject({
      key: 'users/123/avatar.jpg', method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' }, expiresIn: 900
    })

    const download = await app.fetch(jsonRequest('/storage/presign-download', 'POST', {
      key: 'documents/2026/report.pdf'
    }))
    expect(download.status).toBe(200)
    expect(await download.json()).toMatchObject({
      key: 'documents/2026/report.pdf', expiresIn: 900
    })

    const metadata = await app.fetch(jsonRequest('/storage/head', 'POST', { key: 'users/123/avatar.jpg' }))
    expect(metadata.status).toBe(200)
    expect(sent[1].input.Key).toBe('users/123/avatar.jpg')

    const deletion = await app.fetch(jsonRequest('/storage/doc.txt', 'DELETE'))
    expect(deletion.status).toBe(200)
    expect((await deletion.json()).key).toBe('doc.txt')
    expect(sent[2].input.Key).toBe('doc.txt')
  })

  it('lets normal uflite hooks and ACL deny frontend signing and deletion', async () => {
    const acl = createACL({
      enabled: true,
      rules: [{
        id: 'owner',
        permissions: ['user:storage:presignUpload', 'user:storage:presignDownload', 'user:storage:remove'],
        check: { 'user.active': true }
      }]
    })
    const client = { send: async () => ({}) }
    const app = flite()
    const storage = app.service('storage', createStorageService(config({
      client,
      presign: async () => 'https://signed.example.test/file'
    })))
    const authorize = method => ctx => {
      const permission = `user:storage:${method}`
      if (!acl.can(ctx.params, permission)) throw Object.assign(new Error('Forbidden'), { status: 403 })
    }
    storage.hooks({
      before: {
        presignUpload: [authorize('presignUpload')],
        presignDownload: [authorize('presignDownload')],
        remove: [authorize('remove')]
      }
    })

    await expect(storage.presignUpload({ key: 'private/a' }, { user: { active: false } }))
      .rejects.toThrow('Forbidden')
    await expect(storage.presignDownload({ key: 'private/a' }, { user: { active: false } }))
      .rejects.toThrow('Forbidden')
    await expect(storage.remove('private/a', { user: { active: false } }))
      .rejects.toThrow('Forbidden')
    expect(await storage.presignUpload({ key: 'private/a' }, { user: { active: true } }))
      .toMatchObject({ key: 'private/a', method: 'PUT' })
  })
})
