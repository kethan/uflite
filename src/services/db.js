import { collection as createMemoryCollection } from 'umosql/memory'

let memoryCollectionId = 0

const multiAllowed = (option, method) => {
  if (option === true) return true

  if (option && typeof option === 'object' && !Array.isArray(option)) {
    return !!option[method]
  }

  return Array.isArray(option) && option.includes(method)
}

const toProjection = value => {
  if (!value) return null

  if (typeof value === 'string') {
    return value
      .split(/\s+/)
      .filter(Boolean)
      .reduce((out, field) => {
        out[field] = 1
        return out
      }, {})
  }

  if (Array.isArray(value)) {
    return value.reduce((out, field) => {
      out[field] = 1
      return out
    }, {})
  }

  return value
}

const notFound = id => {
  const error = new Error(`No record found for id '${id}'`)
  error.code = 404
  error.name = 'NotFound'
  throw error
}

const queryOf = params => ({
  ...(params.query || {})
})

const cleanQuery = params => {
  const query = queryOf(params)

  delete query.$select
  delete query.$sort
  delete query.$limit
  delete query.$skip

  return query
}

const getLimit = (params, paginate) => {
  const value = params.query?.$limit

  if (value == null) {
    return paginate.default
  }

  const limit = Number(value)

  if (!Number.isFinite(limit)) {
    return paginate.default
  }

  return Math.max(
    0,
    Math.min(limit, paginate.max)
  )
}

const getSkip = params => {
  const value = params.query?.$skip

  if (value == null) return 0

  const skip = Number(value)

  return Number.isFinite(skip)
    ? Math.max(0, skip)
    : 0
}

export const createDBService = (
  getCollection,
  {
    idField = '_id',
    paginate = {
      default: 10,
      max: 100
    },
    multi = false,
    initialData = []
  } = {}
) => {
  if (getCollection == null) {
    if (!Array.isArray(initialData)) {
      throw new TypeError('initialData must be an array when using the memory database')
    }
    const memory = createMemoryCollection(`uflite_memory_${++memoryCollectionId}`, initialData)
    getCollection = () => memory
  } else if (typeof getCollection !== 'function') {
    throw new TypeError('getCollection must be a function')
  }

  return ({
  async find(params = {}) {
    const collection = await getCollection(params)

    const limit = getLimit(params, paginate)
    const skip = getSkip(params)

    if (!collection) {
      if (params.paginate === false) return []

      return {
        total: 0,
        limit,
        skip,
        data: []
      }
    }

    const query = cleanQuery(params)
    const projection = toProjection(
      params.query?.$select
    )
    const sort = params.query?.$sort

    const total = await collection.countDocuments(query)

    if (params.paginate === false) {
      return collection
        .find(
          query,
          projection,
          sort ? { sort } : {}
        )
        .toArray()
    }

    // Feathers semantics:
    // $limit: 0 => return no records but still return total.
    if (limit === 0) {
      return {
        total,
        limit: 0,
        skip,
        data: []
      }
    }

    const options = {
      skip,
      limit
    }

    if (sort) {
      options.sort = sort
    }

    const data = await collection
      .find(query, projection, options)
      .toArray()

    return {
      total,
      limit,
      skip,
      data
    }
  },

  async get(id, params = {}) {
    const collection = await getCollection(params)

    if (!collection) {
      notFound(id)
    }

    const projection = toProjection(
      params.query?.$select
    )

    const result = await collection.findOne(
      {
        [idField]: id
      },
      projection
    )

    if (!result) {
      notFound(id)
    }

    return result
  },

  async create(data, params = {}) {
    const collection = await getCollection(params)

    if (!collection) return null

    if (Array.isArray(data)) {
      if (!multiAllowed(multi, 'create')) {
        throw new Error('Multi create is not allowed')
      }

      const result = await collection.insertMany(data)

      return Promise.all(
        result.insertedIds.map(id =>
          this.get(id, params)
        )
      )
    }

    const result = await collection.insertOne(data)

    return this.get(
      result.insertedId,
      params
    )
  },

  async update(id, data, params = {}) {
    const collection = await getCollection(params)

    if (!collection) {
      notFound(id)
    }

    const existing = await collection.findOne({
      [idField]: id
    })

    if (!existing) {
      notFound(id)
    }

    const replacement = {
      ...data,
      [idField]: existing[idField]
    }

    const unset = {}

    for (const key of Object.keys(existing)) {
      if (
        key !== idField &&
        !(key in replacement)
      ) {
        unset[key] = 1
      }
    }

    const update = {
      $set: replacement
    }

    if (Object.keys(unset).length) {
      update.$unset = unset
    }

    await collection.updateOne(
      {
        [idField]: id
      },
      update
    )

    return this.get(id, params)
  },

  async patch(id, data, params = {}) {
    const collection = await getCollection(params)

    if (!collection) return null

    if (id == null) {
      if (!multiAllowed(multi, 'patch')) {
        throw new Error('Multi patch is not allowed')
      }

      const query = cleanQuery(params)

      const existing = await collection
        .find(query)
        .toArray()

      await collection.updateMany(
        query,
        data
      )

      return Promise.all(
        existing.map(item =>
          this.get(item[idField], params)
        )
      )
    }

    const existing = await collection.findOne({
      [idField]: id
    })

    if (!existing) {
      notFound(id)
    }

    await collection.updateOne(
      {
        [idField]: id
      },
      data
    )

    return this.get(id, params)
  },

  async remove(id, params = {}) {
    const collection = await getCollection(params)

    if (!collection) return null

    if (id == null) {
      if (!multiAllowed(multi, 'remove')) {
        throw new Error('Multi remove is not allowed')
      }

      const query = cleanQuery(params)

      const existing = await collection
        .find(query)
        .toArray()

      await collection.deleteMany(query)

      return existing
    }

    const existing = await collection.findOne({
      [idField]: id
    })

    if (!existing) {
      notFound(id)
    }

    await collection.deleteOne({
      [idField]: id
    })

    return existing
  }
  })
}

export default createDBService

