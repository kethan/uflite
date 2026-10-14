import { afterEach, describe, expect, it } from 'bun:test'
import { Database } from 'bun:sqlite'
import {
  createQueryBuilder,
  exprOps,
  filterOps,
  stageHandlers,
  updateOps
} from 'umosql'
import { createSQLAdapter } from 'umosql/schemaless'
import { createACL } from '../src/services/acl.js'
import { createTableService } from '../src/services/table.js'
import { flite } from '../src/index.js'

const databases = new Set()

const sqliteAdapter = () => {
  const client = new Database(':memory:')
  databases.add(client)
  const queryBuilder = createQueryBuilder({
    filterOps,
    exprOps,
    updateOps,
    stageHandlers
  })

  const adapter = createSQLAdapter({
    database: 'sqlite',
    queryBuilder,
    execute: async (sql, params = []) => {
      const statement = client.query(sql)
      if (/^(SELECT|PRAGMA)/i.test(sql.trim())) {
        return { rows: statement.all(...params) }
      }
      const result = statement.run(...params)
      return {
        rows: [],
        rowCount: result.changes,
        lastInsertRowid: result.lastInsertRowid
      }
    }
  })

  return { adapter, client }
}

afterEach(() => {
  for (const client of databases) client.close()
  databases.clear()
})

describe('TableService', () => {
  it('registers with uflite and exposes standard service methods', () => {
    const app = flite()
    const service = createTableService({
      listCollections: async () => [],
      getTableSchema: async () => ({ columns: {} }),
      createTableWithSchema: async () => ({ acknowledged: true }),
      dropCollection: async () => ({ acknowledged: true })
    })
    const tables = app.service('tables', service)

    for (const method of ['find', 'get', 'create', 'patch', 'remove']) {
      expect(typeof tables[method]).toBe('function')
    }
  })

  it('lists tables, including the empty database case', async () => {
    const { adapter, client } = sqliteAdapter()
    const tables = createTableService(adapter)

    expect(await tables.find()).toEqual([])
    await tables.create({ name: 'users', schema: { name: { type: 'TEXT' } } })
    expect(await tables.find()).toContain('users')
  })

  it('passes JSON Schema through to umosql and exposes its schema result', async () => {
    const { adapter, client } = sqliteAdapter()
    const tables = createTableService(adapter)
    const schema = {
      properties: {
        name: { type: 'string' },
        age: { type: 'integer' },
        score: { type: 'number' },
        active: { type: 'boolean', default: true },
        metadata: { type: 'object', default: {} }
      },
      required: ['name']
    }

    expect(await tables.create({ name: 'profiles', schema })).toEqual({ acknowledged: true })
    expect(await tables.get('profiles')).toEqual({
      columns: {
        name: 'TEXT',
        age: 'INTEGER',
        score: 'REAL',
        active: 'INTEGER',
        metadata: 'TEXT'
      }
    })
    expect(() => client.query('INSERT INTO profiles (age) VALUES (4)').run())
      .toThrow()
    client.query('INSERT INTO profiles (name) VALUES (?)').run('Ada')
    expect(client.query('SELECT active FROM profiles').get()).toEqual({ active: 1 })
  })

  it('passes an already mapped schema through unchanged', async () => {
    const { adapter, client } = sqliteAdapter()
    const tables = createTableService(adapter)
    const schema = {
      label: { type: 'VARCHAR(80)', required: true },
      rank: { type: 'INTEGER', default: 2 }
    }

    await tables.create({ name: 'mapped_items', schema })
    expect(await tables.get('mapped_items')).toEqual({
      columns: { label: 'VARCHAR(80)', rank: 'INTEGER' }
    })
  })

  it('returns umosql schema output for a missing table', async () => {
    const { adapter } = sqliteAdapter()
    expect(await createTableService(adapter).get('missing_table'))
      .toEqual({ columns: {} })
  })

  it('adds and renames columns through umosql, retaining options', async () => {
    const { adapter, client } = sqliteAdapter()
    const tables = createTableService(adapter)
    await tables.create({ name: 'accounts', schema: { name: { type: 'TEXT' } } })

    expect(await tables.patch('accounts', {
      operation: 'addColumn',
      columnName: 'email',
      type: 'TEXT',
      options: { required: true, default: 'unknown' }
    })).toEqual({ acknowledged: true })
    expect((await tables.get('accounts')).columns.email).toBe('TEXT')

    expect(await tables.patch('accounts', {
      operation: 'renameColumn', oldName: 'email', newName: 'contact_email'
    })).toEqual({ acknowledged: true })
    expect((await tables.get('accounts')).columns).toHaveProperty('contact_email')
    client.query('INSERT INTO accounts (name) VALUES (?)').run('Ada')
    expect(client.query('SELECT contact_email FROM accounts').get())
      .toEqual({ contact_email: 'unknown' })
  })

  it('delegates every DDL operation with its arguments and return value', async () => {
    const calls = []
    const response = { acknowledged: true }
    const db = Object.fromEntries([
      'listCollections', 'getTableSchema', 'createTableWithSchema', 'addColumn',
      'renameColumn', 'modifyColumn', 'dropColumn', 'dropCollection'
    ].map(method => [method, async (...args) => {
      calls.push([method, ...args])
      return response
    }]))
    const tables = createTableService(db)

    expect(await tables.patch('items', {
      operation: 'addColumn', columnName: 'slug', type: 'TEXT',
      options: { required: true, unique: true, default: 'new' }
    })).toBe(response)
    expect(await tables.patch('items', {
      operation: 'modifyColumn', columnName: 'title', type: 'VARCHAR(120)',
      options: { required: true }
    })).toBe(response)
    expect(await tables.patch('items', {
      operation: 'dropColumn', columnName: 'legacy'
    })).toBe(response)
    expect(calls).toEqual([
      ['addColumn', 'items', 'slug', 'TEXT', { required: true, unique: true, default: 'new' }],
      ['modifyColumn', 'items', 'title', 'VARCHAR(120)', { required: true }],
      ['dropColumn', 'items', 'legacy']
    ])
  })

  it('preserves SQLite unsupported modify/drop column errors', async () => {
    const { adapter } = sqliteAdapter()
    const tables = createTableService(adapter)
    await tables.create({ name: 'items', schema: { title: { type: 'TEXT' } } })

    await expect(tables.patch('items', {
      operation: 'modifyColumn', columnName: 'title', type: 'VARCHAR(80)'
    })).rejects.toThrow('SQLite does not support MODIFY COLUMN')
    await expect(tables.patch('items', {
      operation: 'dropColumn', columnName: 'title'
    })).rejects.toThrow('SQLite does not support DROP COLUMN')
  })

  it('reports missing backend capabilities without emulating them', async () => {
    const db = {
      listCollections: async () => [],
      getTableSchema: async () => ({ columns: {} }),
      createTableWithSchema: async () => ({ acknowledged: true }),
      dropCollection: async () => ({ acknowledged: true })
    }
    const tables = createTableService(db)

    await expect(tables.patch('items', {
      operation: 'modifyColumn', columnName: 'title', type: 'TEXT'
    })).rejects.toThrow('does not support modifyColumn')
    await expect(tables.patch('items', {
      operation: 'dropColumn', columnName: 'title'
    })).rejects.toThrow('does not support dropColumn')
  })

  it('drops tables through umosql', async () => {
    const { adapter } = sqliteAdapter()
    const tables = createTableService(adapter)
    await tables.create({ name: 'temporary', schema: {} })

    expect(await tables.remove('temporary')).toEqual({ acknowledged: true })
    expect(await tables.find()).not.toContain('temporary')
  })

  it('rejects invalid and incomplete input before calling the adapter', async () => {
    const db = {
      listCollections: async () => [],
      getTableSchema: async () => ({ columns: {} }),
      createTableWithSchema: async () => ({ acknowledged: true }),
      dropCollection: async () => ({ acknowledged: true }),
      addColumn: async () => ({ acknowledged: true })
    }
    const tables = createTableService(db)

    await expect(tables.create()).rejects.toThrow('table data must be an object')
    await expect(tables.create({ name: 'users' })).rejects.toThrow('schema must be an object')
    await expect(tables.create({ name: 'users; DROP TABLE users', schema: {} }))
      .rejects.toThrow('table name must be a non-empty SQL identifier')
    await expect(tables.create({ name: 'users', schema: { properties: { 'email;DROP': { type: 'string' } } } }))
      .rejects.toThrow('column name')
    await expect(tables.create({ name: 'users', schema: { email: { type: 'TEXT; DROP TABLE users' } } }))
      .rejects.toThrow('valid SQL column type')
    await expect(tables.get('schema.users')).rejects.toThrow('table name')
    await expect(tables.remove('')).rejects.toThrow('table name')
    await expect(tables.patch('users', {})).rejects.toThrow('must include an operation')
    await expect(tables.patch('users', { operation: 'unknown' }))
      .rejects.toThrow("Unsupported table patch operation 'unknown'")
    await expect(tables.patch('users', {
      operation: 'addColumn', columnName: 'email; DROP TABLE users', type: 'TEXT'
    })).rejects.toThrow('column name')
    await expect(tables.patch('users', {
      operation: 'addColumn', columnName: 'email', type: 'TEXT; DROP TABLE users'
    })).rejects.toThrow('valid SQL column type')
  })

  it('propagates adapter failures unchanged', async () => {
    const failure = new Error('underlying DDL failure')
    const tables = createTableService({
      dropCollection: async () => { throw failure }
    })

    await expect(tables.remove('users')).rejects.toBe(failure)
  })

  it('runs before, after and error hooks through ordinary service registration', async () => {
    const failure = new Error('list failed')
    const app = flite()
    const tables = app.service('tables', createTableService({
      listCollections: async () => ['users'],
      dropCollection: async () => { throw failure }
    }))
    const calls = []

    tables.hooks({
      before: { find: [ctx => { calls.push('before'); ctx.params.checked = true }] },
      after: { find: [ctx => { calls.push('after'); ctx.result = [...ctx.result, 'posts'] }] },
      error: { remove: [ctx => { calls.push('error'); expect(ctx.error).toBe(failure) }] }
    })

    expect(await tables.find()).toEqual(['users', 'posts'])
    await expect(tables.remove('users')).rejects.toBe(failure)
    expect(calls).toEqual(['before', 'after', 'error'])
  })

  it('allows normal hooks to authorize and deny DDL operations', async () => {
    const acl = createACL({
      enabled: true,
      rules: [{
        id: 'admin',
        permissions: ['admin:tables:create'],
        check: { 'user.role': 'admin' }
      }]
    })
    const calls = []
    const app = flite()
    const tables = app.service('tables', createTableService({
      createTableWithSchema: async (...args) => {
        calls.push(args)
        return { acknowledged: true }
      }
    }))

    tables.hooks({
      before: {
        create: [ctx => {
          if (!acl.can(ctx.params, 'admin:tables:create')) {
            throw new Error('Forbidden')
          }
        }]
      }
    })

    await expect(tables.create({ name: 'users', schema: {} }, { user: { role: 'user' } }))
      .rejects.toThrow('Forbidden')
    expect(await tables.create({ name: 'users', schema: {} }, { user: { role: 'admin' } }))
      .toEqual({ acknowledged: true })
    expect(calls).toEqual([['users', {}]])
  })
})
