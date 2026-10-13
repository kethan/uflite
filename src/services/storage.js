import {
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  GetObjectCommand,
  S3Client
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createLocalStorageService } from './local-storage.js'
import { isObject } from '../utils/is-object.js'

const DEFAULT_EXPIRES_IN = 900
const MAX_EXPIRES_IN = 60 * 60 * 24 * 7
const DEFAULT_LIMIT = 100
const MAX_LIMIT = 1000

const requireKey = key => {
  if (typeof key !== 'string' || key.length === 0) {
    throw new TypeError('key must be a non-empty string')
  }
  return key
}

const requireExpiresIn = (value, fallback, label) => {
  const expiresIn = value === undefined ? fallback : Number(value)
  if (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > MAX_EXPIRES_IN) {
    throw new RangeError(`${label} must be an integer between 1 and ${MAX_EXPIRES_IN} seconds`)
  }
  return expiresIn
}

const requireLimit = value => {
  if (value === undefined || value === null) return DEFAULT_LIMIT
  const limit = Number(value)
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new RangeError(`limit must be an integer between 1 and ${MAX_LIMIT}`)
  }
  return limit
}

const keyFrom = value =>
  typeof value === 'string'
    ? requireKey(value)
    : requireKey(value?.key)

const objectSummary = (object = {}) => ({
  key: object.Key,
  size: object.Size,
  // ListObjectsV2 does not return ContentType. HeadObject does.
  contentType: null,
  etag: object.ETag,
  lastModified: object.LastModified
})

const createS3StorageService = ({
  bucket,
  region,
  accessKeyId,
  secretAccessKey,
  sessionToken,
  endpoint,
  forcePathStyle = Boolean(endpoint),
  uploadExpiresIn = DEFAULT_EXPIRES_IN,
  downloadExpiresIn = DEFAULT_EXPIRES_IN,
  client: providedClient,
  presign = getSignedUrl
} = {}) => {
  if (typeof bucket !== 'string' || !bucket.trim()) {
    throw new TypeError("[createStorageService] 'bucket' is required")
  }
  if (typeof region !== 'string' || !region.trim()) {
    throw new TypeError("[createStorageService] 'region' is required")
  }
  if (typeof accessKeyId !== 'string' || !accessKeyId) {
    throw new TypeError("[createStorageService] 'accessKeyId' is required")
  }
  if (typeof secretAccessKey !== 'string' || !secretAccessKey) {
    throw new TypeError("[createStorageService] 'secretAccessKey' is required")
  }

  const defaultUploadExpiresIn = requireExpiresIn(
    uploadExpiresIn,
    DEFAULT_EXPIRES_IN,
    'uploadExpiresIn'
  )
  const defaultDownloadExpiresIn = requireExpiresIn(
    downloadExpiresIn,
    DEFAULT_EXPIRES_IN,
    'downloadExpiresIn'
  )

  const client = providedClient || new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials: {
      accessKeyId,
      secretAccessKey,
      ...(sessionToken ? { sessionToken } : {})
    }
  })

  const presignUpload = async input => {
    if (!isObject(input)) throw new TypeError('upload input must be an object')
    const key = requireKey(input.key)
    if (input.contentType !== undefined && (
      typeof input.contentType !== 'string' || !input.contentType.trim()
    )) {
      throw new TypeError('contentType must be a non-empty string')
    }
    if (input.contentLength !== undefined) {
      throw new Error('contentLength cannot be enforced with a presigned PUT URL')
    }
    const expiresIn = requireExpiresIn(
      input.expiresIn,
      defaultUploadExpiresIn,
      'expiresIn'
    )
    const headers = input.contentType
      ? { 'Content-Type': input.contentType }
      : {}
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ...(input.contentType ? { ContentType: input.contentType } : {})
    })
    const url = await presign(client, command, {
      expiresIn,
      ...(input.contentType
        ? { signableHeaders: new Set(['content-type']) }
        : {})
    })

    return { key, url, method: 'PUT', headers, expiresIn }
  }

  const presignDownload = async input => {
    if (!isObject(input)) throw new TypeError('download input must be an object')
    const key = requireKey(input.key)
    const expiresIn = requireExpiresIn(
      input.expiresIn,
      defaultDownloadExpiresIn,
      'expiresIn'
    )
    const command = new GetObjectCommand({ Bucket: bucket, Key: key })
    const url = await presign(client, command, { expiresIn })
    return { key, url, expiresIn }
  }

  const service = {
    type: 's3',
    async find(params = {}) {
      const query = params.query || params
      if (query.prefix !== undefined && typeof query.prefix !== 'string') {
        throw new TypeError('prefix must be a string')
      }
      if (query.cursor !== undefined && typeof query.cursor !== 'string') {
        throw new TypeError('cursor must be a string')
      }
      const limit = requireLimit(query.limit ?? query.$limit)
      const result = await client.send(new ListObjectsV2Command({
        Bucket: bucket,
        ...(query.prefix !== undefined ? { Prefix: query.prefix } : {}),
        MaxKeys: limit,
        ...(query.cursor ? { ContinuationToken: query.cursor } : {})
      }))

      return {
        data: (result.Contents || []).map(objectSummary),
        nextCursor: result.IsTruncated ? result.NextContinuationToken || null : null
      }
    },

    async get(key) {
      key = keyFrom(key)
      const result = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
      return {
        key,
        size: result.ContentLength,
        contentType: result.ContentType,
        etag: result.ETag,
        lastModified: result.LastModified,
        metadata: result.Metadata || {}
      }
    },

    // The REST POST /storage route creates a direct-to-provider upload URL.
    async create(data) {
      return presignUpload(data)
    },

    async remove(key) {
      key = keyFrom(key)
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
      // S3 DeleteObject is idempotent and succeeds when the key is already absent.
      return { key, deleted: true }
    },

    // These custom methods are hookable through the normal uflite service wrapper.
    presignUpload,
    presignDownload,

    setup(app, name) {
      const path = `/${String(name).replace(/^\/+|\/+$/g, '')}`
      const serviceForRequest = () => app.service(name)
      const paramsForRequest = request => ({ ...request.query, request })

      // Register the standard REST routes here so service hooks can inspect
      // trusted middleware state on the server-side Request (for ACL checks).
      app.GET?.(path, async request =>
        Response.json(await serviceForRequest().find(paramsForRequest(request))))
      app.GET?.(`${path}/:id`, async request =>
        Response.json(await serviceForRequest().get(request.params.id, paramsForRequest(request))))
      app.POST?.(path, async request =>
        Response.json(await serviceForRequest().create(
          await request.json(), paramsForRequest(request)
        )))
      app.DELETE?.(`${path}/:id`, async request =>
        Response.json(await serviceForRequest().remove(
          request.params.id, paramsForRequest(request)
        )))

      // Body-based endpoints preserve keys verbatim, including slashes.
      app.POST?.(`${path}/presign`, async request =>
        Response.json(await serviceForRequest().presignUpload(
          await request.json(), paramsForRequest(request)
        )))
      app.POST?.(`${path}/presign-download`, async request =>
        Response.json(await serviceForRequest().presignDownload(
          await request.json(), paramsForRequest(request)
        )))
      app.POST?.(`${path}/head`, async request =>
        Response.json(await serviceForRequest().get(
          await request.json(), paramsForRequest(request)
        )))
      app.POST?.(`${path}/delete`, async request =>
        Response.json(await serviceForRequest().remove(
          await request.json(), paramsForRequest(request)
        )))
    }
  }

  return service
}

export const createStorageService = (options = {}) => {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('storage options must be an object')
  }

  const hasS3Options = [
    'bucket', 'region', 'accessKeyId', 'secretAccessKey', 'sessionToken',
    'endpoint', 'forcePathStyle', 'client', 'presign'
  ].some(key => options[key] !== undefined)
  const type = options.type ?? (hasS3Options ? 's3' : 'local')

  if (type === 'local') return createLocalStorageService(options)
  if (type === 's3') return createS3StorageService(options)
  throw new TypeError(`unsupported storage type '${type}'`)
}

export const createStorage = createStorageService
export default createStorageService
