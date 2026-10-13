import { isObject } from '../utils/is-object.js'

const DEFAULT_BASE_PATH = './data/files'
const DEFAULT_MAX_FILE_SIZE = 25 * 1024 * 1024
const DEFAULT_LIMIT = 100
const MAX_LIMIT = 1000

const inputError = message => Object.assign(new TypeError(message), { status: 400 })

const runtime = () => Promise.all([
  import('node:fs/promises'),
  import('node:path'),
  import('node:fs')
]).then(([fs, path, { constants }]) => ({ fs, path, constants }))

const requireKey = key => {
  if (typeof key !== 'string' || !key || key.includes('\\') || key.includes('\0') || key.startsWith('/')) {
    throw inputError('key must be a relative file key using forward slashes')
  }
  const parts = key.split('/')
  if (parts.some(part => !part || part === '.' || part === '..')) {
    throw inputError('key must not contain empty, dot, or parent path segments')
  }
  return key
}

const asBytes = async value => {
  if (typeof value === 'string') return new TextEncoder().encode(value)
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  }
  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    return new Uint8Array(await value.arrayBuffer())
  }
  throw inputError('body must be a string, Blob, ArrayBuffer, or byte array')
}

const notFound = key => {
  const error = new Error(`No file found for key '${key}'`)
  error.code = 404
  error.name = 'NotFound'
  error.status = 404
  return error
}

export const createLocalStorageService = ({
  basePath = DEFAULT_BASE_PATH,
  publicUrl,
  maxFileSize = DEFAULT_MAX_FILE_SIZE
} = {}) => {
  if (typeof basePath !== 'string' || !basePath.trim()) {
    throw new TypeError('basePath must be a non-empty directory path')
  }
  if (!Number.isSafeInteger(maxFileSize) || maxFileSize < 1) {
    throw new RangeError('maxFileSize must be a positive safe integer')
  }

  const contentTypes = new Map()
  const pathFor = async key => {
    key = requireKey(key)
    const { fs, path, constants } = await runtime()
    const root = path.resolve(basePath)
    await fs.mkdir(root, { recursive: true })
    let parent = root

    for (const segment of key.split('/').slice(0, -1)) {
      parent = path.join(parent, segment)
      try {
        const stat = await fs.lstat(parent)
        if (!stat.isDirectory()) {
          throw inputError('key resolves through a non-directory path')
        }
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
        await fs.mkdir(parent)
      }
    }

    const filePath = path.join(parent, key.split('/').at(-1))
    try {
      const stat = await fs.lstat(filePath)
      if (!stat.isFile()) {
        throw inputError('key must refer to a regular file')
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    return { fs, filePath, constants }
  }

  const getUrl = (path, key, params) => {
    const request = params?.request
    if (request?.url) {
      const url = new URL(path, request.url)
      url.searchParams.set('key', key)
      return url.href
    }
    return null
  }

  const metadata = async key => {
    key = requireKey(key)
    const { fs, filePath } = await pathFor(key)
    let stat
    try {
      stat = await fs.lstat(filePath)
    } catch (error) {
      if (error.code === 'ENOENT') throw notFound(key)
      throw error
    }
    return {
      key,
      size: stat.size,
      contentType: contentTypes.get(key) || 'application/octet-stream',
      lastModified: stat.mtime
    }
  }

  const upload = async (input, params = {}) => {
    if (!isObject(input)) {
      throw inputError('upload input must be an object')
    }
    const key = requireKey(input.key)
    const body = await asBytes(input.body ?? input.data)
    if (body.byteLength > maxFileSize) {
      throw Object.assign(new RangeError(`file exceeds maxFileSize of ${maxFileSize} bytes`), { status: 413 })
    }
    const contentType = input.contentType ?? 'application/octet-stream'
    if (typeof contentType !== 'string' || !contentType.trim() || /[\r\n]/.test(contentType)) {
      throw inputError('contentType must be a valid non-empty header value')
    }
    const { fs, filePath, constants } = await pathFor(key)
    // O_NOFOLLOW also protects against a final-component symlink swapped in after pathFor.
    const handle = await fs.open(filePath, constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | (constants.O_NOFOLLOW || 0), 0o600)
    try {
      await handle.writeFile(body)
    } finally {
      await handle.close()
    }
    contentTypes.set(key, contentType)
    return { key, size: body.byteLength, contentType, url: getUrl('/storage/download', key, params) }
  }

  const download = async keyOrInput => {
    const key = requireKey(typeof keyOrInput === 'string' ? keyOrInput : keyOrInput?.key)
    const { fs, filePath, constants } = await pathFor(key)
    let body
    try {
      const handle = await fs.open(filePath, constants.O_RDONLY | (constants.O_NOFOLLOW || 0))
      try {
        body = await handle.readFile()
      } finally {
        await handle.close()
      }
    } catch (error) {
      if (error.code === 'ENOENT') throw notFound(key)
      throw error
    }
    return { ...(await metadata(key)), body }
  }

  const service = {
    type: 'local',
    maxFileSize,
    async find(params = {}) {
      const query = params.query || params
      const prefix = query.prefix ?? ''
      if (typeof prefix !== 'string' || (prefix && requireKey(prefix.replace(/\/$/, '')) !== prefix.replace(/\/$/, ''))) {
        throw new TypeError('prefix must be a relative file prefix')
      }
      const limitValue = query.limit ?? query.$limit
      const limit = limitValue == null ? DEFAULT_LIMIT : Number(limitValue)
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
        throw new RangeError(`limit must be an integer between 1 and ${MAX_LIMIT}`)
      }
      if (query.cursor !== undefined && typeof query.cursor !== 'string') {
        throw new TypeError('cursor must be a string')
      }

      const { fs, path } = await runtime()
      const root = path.resolve(basePath)
      await fs.mkdir(root, { recursive: true })
      const keys = []
      const walk = async (directory, relative = '') => {
        for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
          if (entry.isSymbolicLink()) continue
          const key = relative ? `${relative}/${entry.name}` : entry.name
          const fullPath = path.join(directory, entry.name)
          if (entry.isDirectory()) await walk(fullPath, key)
          else if (entry.isFile() && key.startsWith(prefix)) keys.push(key)
        }
      }
      await walk(root)
      keys.sort()
      const remaining = keys.filter(key => !query.cursor || key > query.cursor)
      const page = remaining.slice(0, limit)
      return {
        data: await Promise.all(page.map(metadata)),
        nextCursor: remaining.length > limit ? page.at(-1) : null
      }
    },
    async get(key) {
      return metadata(typeof key === 'string' ? key : key?.key)
    },
    create: upload,
    upload,
    download,
    async remove(keyOrInput) {
      const key = requireKey(typeof keyOrInput === 'string' ? keyOrInput : keyOrInput?.key)
      const { fs, filePath } = await pathFor(key)
      try {
        await fs.unlink(filePath)
        contentTypes.delete(key)
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
      return { key, deleted: true }
    },
    async presignUpload(input, params = {}) {
      const key = requireKey(input?.key)
      const contentType = input.contentType || 'application/octet-stream'
      if (typeof contentType !== 'string' || !contentType.trim() || /[\r\n]/.test(contentType)) {
        throw inputError('contentType must be a valid non-empty header value')
      }
      return {
        key,
        url: getUrl('/storage', key, params),
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        expiresIn: null
      }
    },
    async presignDownload(input, params = {}) {
      const key = requireKey(input?.key)
      return {
        key,
        url: publicUrl
          ? `${String(publicUrl).replace(/\/+$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`
          : getUrl('/storage/download', key, params),
        method: 'GET',
        expiresIn: null
      }
    },
    setup(app, name) {
      const path = `/${String(name).replace(/^\/+|\/+$/g, '')}`
      const serviceForRequest = () => app.service(name)
      const paramsForRequest = request => ({ ...request.query, request })
      const route = handler => async request => {
        try {
          return await handler(request)
        } catch (error) {
          if (error.status == null) {
            error.status = error instanceof TypeError || error instanceof RangeError ? 400 : 500
          }
          throw error
        }
      }

      app.GET?.(path, route(async request =>
        Response.json(await serviceForRequest().find(paramsForRequest(request)))))
      app.PUT?.(path, route(async request => {
          const declaredSize = Number(request.headers.get('content-length'))
          if (Number.isFinite(declaredSize) && declaredSize > maxFileSize) {
            throw Object.assign(new RangeError(`file exceeds maxFileSize of ${maxFileSize} bytes`), { status: 413 })
          }
          const reader = request.body?.getReader()
          const chunks = []
          let size = 0
          if (reader) {
            try {
              while (true) {
                const { done, value } = await reader.read()
                if (done) break
                size += value.byteLength
                if (size > maxFileSize) {
                  await reader.cancel()
                  throw Object.assign(new RangeError(`file exceeds maxFileSize of ${maxFileSize} bytes`), { status: 413 })
                }
                chunks.push(value)
              }
            } finally {
              reader.releaseLock()
            }
          }
          const body = new Uint8Array(size)
          let offset = 0
          for (const chunk of chunks) {
            body.set(chunk, offset)
            offset += chunk.byteLength
          }
          const result = await serviceForRequest().upload({
            key: request.query?.key,
            body,
            contentType: request.headers.get('content-type') || undefined
          }, paramsForRequest(request))
          return Response.json(result)
      }))
      app.GET?.(`${path}/download`, route(async request => {
        const file = await serviceForRequest().download(request.query?.key)
        return new Response(file.body, {
          headers: {
            'Content-Type': file.contentType,
            'Content-Length': String(file.size)
          }
        })
      }))
      app.GET?.(`${path}/:id`, route(async request =>
        Response.json(await serviceForRequest().get(request.params.id, paramsForRequest(request)))))
      app.POST?.(`${path}/presign`, route(async request =>
        Response.json(await serviceForRequest().presignUpload(
          await request.json(), paramsForRequest(request)
        ))))
      app.POST?.(`${path}/presign-download`, route(async request =>
        Response.json(await serviceForRequest().presignDownload(
          await request.json(), paramsForRequest(request)
        ))))
      app.POST?.(`${path}/head`, route(async request =>
        Response.json(await serviceForRequest().get(
          await request.json(), paramsForRequest(request)
        ))))
      app.POST?.(`${path}/delete`, route(async request =>
        Response.json(await serviceForRequest().remove(
          await request.json(), paramsForRequest(request)
        ))))
    }
  }

  return service
}

export default createLocalStorageService
