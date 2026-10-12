import { describe, test, expect } from 'bun:test'
import { createDBService } from '../services/db.js'
import { collection } from 'umosql/memory'

describe('DBService', () => {
  describe('memory default', () => {
    test('creates an isolated in-memory collection when no adapter is provided', async () => {
      const service = createDBService()
      const other = createDBService()
      const created = await service.create({ name: 'Ada', active: true })

      expect(created.name).toBe('Ada')
      expect(await service.get(created._id)).toMatchObject({ name: 'Ada', active: true })
      expect((await other.find()).total).toBe(0)
      expect((await service.find({ query: { active: true } })).data).toHaveLength(1)
      expect(await service.remove(created._id)).toMatchObject({ name: 'Ada' })
      expect((await service.find()).total).toBe(0)
    })

    test('accepts seed records and still supports explicit adapters', async () => {
      const seeded = createDBService(undefined, {
        initialData: [{ _id: 'seed-1', name: 'Lin' }]
      })
      expect(await seeded.get('seed-1')).toEqual({ _id: 'seed-1', name: 'Lin' })

      const collection = { marker: true }
      const custom = createDBService(async () => collection)
      expect(typeof custom.find).toBe('function')
      expect(() => createDBService(undefined, { initialData: {} })).toThrow('initialData')
      expect(() => createDBService({})).toThrow('getCollection')
    })
  })

  describe('find', () => {
    test('returns Feathers pagination', async () => {
      const users = collection('db_find_pagination', [
        { _id: 1, name: 'Alice', age: 30, active: true },
        { _id: 2, name: 'Bob', age: 25, active: true },
        { _id: 3, name: 'Charlie', age: 35, active: false }
      ])

      const service = createDBService(async () => users)

      const result = await service.find({})

      expect(result).toEqual({
        total: 3,
        limit: 10,
        skip: 0,
        data: [
          { _id: 1, name: 'Alice', age: 30, active: true },
          { _id: 2, name: 'Bob', age: 25, active: true },
          { _id: 3, name: 'Charlie', age: 35, active: false }
        ]
      })
    })

    test('$limit', async () => {
      const users = collection('db_find_limit', [
        { _id: 1, name: 'Alice' },
        { _id: 2, name: 'Bob' },
        { _id: 3, name: 'Charlie' }
      ])

      const service = createDBService(async () => users)

      const result = await service.find({
        query: {
          $limit: 2
        }
      })

      expect(result.total).toBe(3)
      expect(result.limit).toBe(2)
      expect(result.skip).toBe(0)
      expect(result.data).toHaveLength(2)
    })

    test('$limit is capped by max', async () => {
      const users = collection('db_find_limit_max', [
        { _id: 1, name: 'Alice' },
        { _id: 2, name: 'Bob' },
        { _id: 3, name: 'Charlie' },
        { _id: 4, name: 'David' }
      ])

      const service = createDBService(
        async () => users,
        {
          paginate: {
            default: 2,
            max: 2
          }
        }
      )

      const result = await service.find({
        query: {
          $limit: 100
        }
      })

      expect(result.limit).toBe(2)
      expect(result.data).toHaveLength(2)
      expect(result.total).toBe(4)
    })

    test('$skip', async () => {
      const users = collection('db_find_skip', [
        { _id: 1, name: 'Alice' },
        { _id: 2, name: 'Bob' },
        { _id: 3, name: 'Charlie' }
      ])

      const service = createDBService(async () => users)

      const result = await service.find({
        query: {
          $skip: 1
        }
      })

      expect(result.total).toBe(3)
      expect(result.skip).toBe(1)
      expect(result.data).toEqual([
        { _id: 2, name: 'Bob' },
        { _id: 3, name: 'Charlie' }
      ])
    })

    test('$skip with $limit', async () => {
      const users = collection('db_find_skip_limit', [
        { _id: 1, name: 'Alice' },
        { _id: 2, name: 'Bob' },
        { _id: 3, name: 'Charlie' },
        { _id: 4, name: 'David' }
      ])

      const service = createDBService(async () => users)

      const result = await service.find({
        query: {
          $skip: 1,
          $limit: 2
        }
      })

      expect(result.total).toBe(4)
      expect(result.skip).toBe(1)
      expect(result.limit).toBe(2)

      expect(result.data).toEqual([
        { _id: 2, name: 'Bob' },
        { _id: 3, name: 'Charlie' }
      ])
    })

    test('filters records', async () => {
      const users = collection('db_find_filter', [
        { _id: 1, name: 'Alice', age: 30, active: true },
        { _id: 2, name: 'Bob', age: 20, active: false },
        { _id: 3, name: 'Charlie', age: 40, active: true }
      ])

      const service = createDBService(async () => users)

      const result = await service.find({
        query: {
          active: true
        }
      })

      expect(result.total).toBe(2)

      expect(result.data).toEqual([
        { _id: 1, name: 'Alice', age: 30, active: true },
        { _id: 3, name: 'Charlie', age: 40, active: true }
      ])
    })

    test('$sort', async () => {
      const users = collection('db_find_sort', [
        { _id: 1, name: 'Alice', age: 30 },
        { _id: 2, name: 'Bob', age: 20 },
        { _id: 3, name: 'Charlie', age: 40 }
      ])

      const service = createDBService(async () => users)

      const result = await service.find({
        query: {
          $sort: {
            age: 1
          }
        }
      })

      expect(result.data).toEqual([
        { _id: 2, name: 'Bob', age: 20 },
        { _id: 1, name: 'Alice', age: 30 },
        { _id: 3, name: 'Charlie', age: 40 }
      ])
    })

    test('$select string', async () => {
      const users = collection('db_find_select_string', [
        {
          _id: 1,
          name: 'Alice',
          age: 30,
          city: 'Paris',
          active: true
        }
      ])

      const service = createDBService(async () => users)

      const result = await service.find({
        query: {
          $select: 'name age',
          $limit: 10
        }
      })

      expect(result.data[0]).toEqual({
        _id: 1,
        name: 'Alice',
        age: 30
      })
    })

    test('$select array', async () => {
      const users = collection('db_find_select_array', [
        {
          _id: 1,
          name: 'Alice',
          age: 30,
          city: 'Paris',
          active: true
        }
      ])

      const service = createDBService(async () => users)

      const result = await service.find({
        query: {
          $select: ['name'],
          $limit: 10
        }
      })

      expect(result.data[0]).toEqual({
        _id: 1,
        name: 'Alice'
      })
    })

    test('$select excludes _id', async () => {
      const users = collection('db_find_select_exclude_id', [
        {
          _id: 1,
          name: 'Alice',
          age: 30,
          city: 'Paris'
        }
      ])

      const service = createDBService(async () => users)

      const result = await service.find({
        query: {
          $select: {
            name: 1,
            age: 1,
            _id: 0
          }
        }
      })

      expect(result.data[0]).toEqual({
        name: 'Alice',
        age: 30
      })
    })

    test('paginate:false returns array', async () => {
      const users = collection('db_find_no_pagination', [
        { _id: 1, name: 'Alice' },
        { _id: 2, name: 'Bob' },
        { _id: 3, name: 'Charlie' }
      ])

      const service = createDBService(async () => users)

      const result = await service.find({
        paginate: false
      })

      expect(Array.isArray(result)).toBe(true)
      expect(result).toEqual([
        { _id: 1, name: 'Alice' },
        { _id: 2, name: 'Bob' },
        { _id: 3, name: 'Charlie' }
      ])
    })

    test('$limit:0 returns total with empty data', async () => {
      const users = collection('db_find_limit_zero', [
        { _id: 1, name: 'Alice' },
        { _id: 2, name: 'Bob' },
        { _id: 3, name: 'Charlie' }
      ])

      const service = createDBService(async () => users)

      const result = await service.find({
        query: {
          $limit: 0
        }
      })

      expect(result).toEqual({
        total: 3,
        limit: 0,
        skip: 0,
        data: []
      })
    })

    test('$skip beyond total returns empty data', async () => {
      const users = collection('db_find_skip_beyond', [
        { _id: 1, name: 'Alice' },
        { _id: 2, name: 'Bob' }
      ])

      const service = createDBService(async () => users)

      const result = await service.find({
        query: {
          $skip: 10
        }
      })

      expect(result.total).toBe(2)
      expect(result.data).toEqual([])
    })
  })

  describe('get', () => {
    test('returns record', async () => {
      const users = collection('db_get', [
        { _id: 1, name: 'Alice', age: 30 },
        { _id: 2, name: 'Bob', age: 25 }
      ])

      const service = createDBService(async () => users)

      const result = await service.get(2)

      expect(result).toEqual({
        _id: 2,
        name: 'Bob',
        age: 25
      })
    })

    test('$select', async () => {
      const users = collection('db_get_select', [
        {
          _id: 1,
          name: 'Alice',
          age: 30,
          city: 'Paris'
        }
      ])

      const service = createDBService(async () => users)

      const result = await service.get(1, {
        query: {
          $select: 'name age'
        }
      })

      expect(result).toEqual({
        _id: 1,
        name: 'Alice',
        age: 30
      })
    })

    test('missing record throws 404', async () => {
      const users = collection('db_get_missing', [
        { _id: 1, name: 'Alice' }
      ])

      const service = createDBService(async () => users)

      try {
        await service.get(999)
        throw new Error('Expected get to throw')
      } catch (error) {
        expect(error.code).toBe(404)
        expect(error.name).toBe('NotFound')
      }
    })
  })

  describe('create', () => {
    test('creates record', async () => {
      const users = collection('db_create', [])

      const service = createDBService(async () => users)

      const result = await service.create({
        name: 'Alice',
        age: 30
      })

      expect(result.name).toBe('Alice')
      expect(result.age).toBe(30)
      expect(result._id).toBeDefined()

      const stored = await users.find({}).toArray()

      expect(stored).toHaveLength(1)
    })

    test('rejects multi create', async () => {
      const users = collection('db_create_multi_reject', [])

      const service = createDBService(
        async () => users,
        {
          multi: false
        }
      )

      await expect(
        service.create([
          { name: 'Alice' },
          { name: 'Bob' }
        ])
      ).rejects.toThrow()
    })

    test('allows multi create', async () => {
      const users = collection('db_create_multi', [])

      const service = createDBService(
        async () => users,
        {
          multi: true
        }
      )

      const result = await service.create([
        { name: 'Alice' },
        { name: 'Bob' }
      ])

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('Alice')
      expect(result[1].name).toBe('Bob')

      const stored = await users.find({}).toArray()

      expect(stored).toHaveLength(2)
    })
  })

  describe('update', () => {
    test('replaces record', async () => {
      const users = collection('db_update', [
        {
          _id: 1,
          name: 'Alice',
          age: 30,
          city: 'Paris',
          active: true
        }
      ])

      const service = createDBService(async () => users)

      const result = await service.update(1, {
        name: 'Alice Updated',
        age: 31
      })

      expect(result).toEqual({
        _id: 1,
        name: 'Alice Updated',
        age: 31
      })
    })

    test('missing record throws 404', async () => {
      const users = collection('db_update_missing', [
        { _id: 1, name: 'Alice' }
      ])

      const service = createDBService(async () => users)

      await expect(
        service.update(999, {
          name: 'Missing'
        })
      ).rejects.toMatchObject({
        code: 404,
        name: 'NotFound'
      })
    })
  })

  describe('patch', () => {
    test('patches record', async () => {
      const users = collection('db_patch', [
        {
          _id: 1,
          name: 'Alice',
          age: 30,
          active: true
        }
      ])

      const service = createDBService(async () => users)

      const result = await service.patch(1, {
        age: 31
      })

      expect(result).toEqual({
        _id: 1,
        name: 'Alice',
        age: 31,
        active: true
      })
    })

    test('supports $set', async () => {
      const users = collection('db_patch_set', [
        {
          _id: 1,
          name: 'Alice',
          age: 30,
          active: true
        }
      ])

      const service = createDBService(async () => users)

      const result = await service.patch(1, {
        $set: {
          age: 31
        }
      })

      expect(result).toEqual({
        _id: 1,
        name: 'Alice',
        age: 31,
        active: true
      })
    })

    test('missing record throws 404', async () => {
      const users = collection('db_patch_missing', [
        { _id: 1, name: 'Alice' }
      ])

      const service = createDBService(async () => users)

      await expect(
        service.patch(999, {
          name: 'Missing'
        })
      ).rejects.toMatchObject({
        code: 404,
        name: 'NotFound'
      })
    })

    test('rejects multi patch', async () => {
      const users = collection('db_patch_multi_reject', [
        { _id: 1, name: 'Alice', active: true },
        { _id: 2, name: 'Bob', active: true }
      ])

      const service = createDBService(
        async () => users,
        {
          multi: false
        }
      )

      await expect(
        service.patch(
          null,
          {
            active: false
          },
          {
            query: {
              active: true
            }
          }
        )
      ).rejects.toThrow()
    })

    test('multi patch updates matching records', async () => {
      const users = collection('db_patch_multi', [
        { _id: 1, name: 'Alice', active: true },
        { _id: 2, name: 'Bob', active: true },
        { _id: 3, name: 'Charlie', active: false },
        { _id: 4, name: 'David', active: true }
      ])

      const service = createDBService(
        async () => users,
        {
          multi: true
        }
      )

      const result = await service.patch(
        null,
        {
          $set: {
            active: false
          }
        },
        {
          query: {
            active: true
          }
        }
      )

      expect(result).toHaveLength(3)

      expect(
        result.map(user => user._id).sort((a, b) => a - b)
      ).toEqual([1, 2, 4])

      const updated = await users.find({
        active: false
      }).toArray()

      expect(updated).toHaveLength(4)
    })
  })

  describe('remove', () => {
    test('removes and returns record', async () => {
      const users = collection('db_remove', [
        { _id: 1, name: 'Alice' },
        { _id: 2, name: 'Bob' }
      ])

      const service = createDBService(async () => users)

      const result = await service.remove(1)

      expect(result).toEqual({
        _id: 1,
        name: 'Alice'
      })

      const remaining = await users.find({}).toArray()

      expect(remaining).toHaveLength(1)
      expect(remaining[0]._id).toBe(2)
    })

    test('missing record throws 404', async () => {
      const users = collection('db_remove_missing', [
        { _id: 1, name: 'Alice' }
      ])

      const service = createDBService(async () => users)

      await expect(
        service.remove(999)
      ).rejects.toMatchObject({
        code: 404,
        name: 'NotFound'
      })
    })

    test('rejects multi remove', async () => {
      const users = collection('db_remove_multi_reject', [
        { _id: 1, name: 'Alice', active: true },
        { _id: 2, name: 'Bob', active: true }
      ])

      const service = createDBService(
        async () => users,
        {
          multi: false
        }
      )

      await expect(
        service.remove(null, {
          query: {
            active: true
          }
        })
      ).rejects.toThrow()
    })

    test('multi remove returns removed records', async () => {
      const users = collection('db_remove_multi', [
        { _id: 1, name: 'Alice', active: true },
        { _id: 2, name: 'Bob', active: false },
        { _id: 3, name: 'Charlie', active: true },
        { _id: 4, name: 'David', active: false }
      ])

      const service = createDBService(
        async () => users,
        {
          multi: true
        }
      )

      const result = await service.remove(null, {
        query: {
          active: true
        }
      })

      expect(result).toHaveLength(2)

      expect(
        result.map(user => user._id).sort((a, b) => a - b)
      ).toEqual([1, 3])

      const remaining = await users.find({}).toArray()

      expect(remaining).toHaveLength(2)

      expect(
        remaining.map(user => user._id).sort((a, b) => a - b)
      ).toEqual([2, 4])
    })
  })
})
