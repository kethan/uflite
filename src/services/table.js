import { isObject } from '../utils/is-object.js'

// umosql's identifier validator accepts word characters and treats identifiers
// as a single name. Keep the same boundary here, before values reach DDL APIs.
const isIdentifier = value =>
  typeof value === 'string' &&
  value.length > 0 &&
  /^\w+$/.test(value)

// Column types are passed through to umosql, which embeds them in DDL. Permit
// common SQL type names and numeric precision while excluding SQL fragments.
const isColumnType = value =>
  typeof value === 'string' &&
  /^[A-Za-z][A-Za-z0-9_]*(?:\s+[A-Za-z][A-Za-z0-9_]*)*(?:\s*\(\s*\d+(?:\s*,\s*\d+)?\s*\))?$/.test(value)

const requireIdentifier = (value, label) => {
  if (!isIdentifier(value)) {
    throw new TypeError(`${label} must be a non-empty SQL identifier`)
  }
}

const requireColumnType = value => {
  if (!isColumnType(value)) {
    throw new TypeError('type must be a valid SQL column type')
  }
}

const validateSchema = schema => {
  const definitions = schema.properties === undefined
    ? schema
    : schema.properties

  if (!isObject(definitions)) {
    throw new TypeError('schema properties must be an object')
  }

  for (const [name, definition] of Object.entries(definitions)) {
    requireIdentifier(name, 'column name')

    // JSON Schema types are mapped by umosql. Already-mapped SQL schema types
    // are passed through, but must not contain executable DDL fragments.
    const type = typeof definition === 'string'
      ? definition
      : definition?.type
    if (type !== undefined) requireColumnType(type)
  }
}

const requireCapability = (db, method) => {
  if (typeof db[method] !== 'function') {
    throw new Error(`The database adapter does not support ${method}`)
  }
}

export const createTableService = db => {
  if (!isObject(db)) {
    throw new TypeError('db must be an object')
  }

  return {
    async find() {
      requireCapability(db, 'listCollections')
      return db.listCollections()
    },

    async get(tableName) {
      requireIdentifier(tableName, 'table name')
      requireCapability(db, 'getTableSchema')
      return db.getTableSchema(tableName)
    },

    async create(data) {
      if (!isObject(data)) {
        throw new TypeError('table data must be an object')
      }
      requireIdentifier(data.name, 'table name')
      if (!isObject(data.schema)) {
        throw new TypeError('schema must be an object')
      }
      validateSchema(data.schema)

      requireCapability(db, 'createTableWithSchema')
      return db.createTableWithSchema(data.name, data.schema)
    },

    async patch(tableName, data) {
      requireIdentifier(tableName, 'table name')
      if (!isObject(data) || typeof data.operation !== 'string') {
        throw new TypeError('patch data must include an operation')
      }

      switch (data.operation) {
        case 'addColumn': {
          requireIdentifier(data.columnName, 'column name')
          requireColumnType(data.type)
          requireCapability(db, 'addColumn')
          return db.addColumn(tableName, data.columnName, data.type, data.options)
        }
        case 'renameColumn': {
          requireIdentifier(data.oldName, 'old column name')
          requireIdentifier(data.newName, 'new column name')
          requireCapability(db, 'renameColumn')
          return db.renameColumn(tableName, data.oldName, data.newName)
        }
        case 'modifyColumn': {
          requireIdentifier(data.columnName, 'column name')
          requireColumnType(data.type)
          requireCapability(db, 'modifyColumn')
          return db.modifyColumn(tableName, data.columnName, data.type, data.options)
        }
        case 'dropColumn': {
          requireIdentifier(data.columnName, 'column name')
          requireCapability(db, 'dropColumn')
          return db.dropColumn(tableName, data.columnName)
        }
        default:
          throw new TypeError(`Unsupported table patch operation '${data.operation}'`)
      }
    },

    async remove(tableName) {
      requireIdentifier(tableName, 'table name')
      requireCapability(db, 'dropCollection')
      return db.dropCollection(tableName)
    }
  }
}

export default createTableService
