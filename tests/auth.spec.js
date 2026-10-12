import { describe, expect, test } from 'bun:test'
import { createSchemalessAdapter } from 'umosql/schemaless'
import { createAuth } from '../services/createAuth.js'
import { sqlAdapterFactory } from '../services/sqlAdapterFactory.js'

const newMemoryAdapter = () => createSchemalessAdapter(undefined, 'memory')
const SECRET = 'this-is-a-test-secret-with-at-least-32-characters'
const authOptions = adapter => ({
	adapter,
	baseURL: 'http://localhost:3000',
	secret: SECRET,
})

const createDatabaseAdapter = (base, config = {}, options = {}) => sqlAdapterFactory(base, config)(
	{ baseURL: 'http://localhost:3000', secret: SECRET, ...options }
)

describe('sqlAdapterFactory', () => {
	test('generates string IDs and maps them from _id to id', async () => {
		const { adapter: base } = newMemoryAdapter()
		const adapter = createDatabaseAdapter(base, {}, {
			user: { additionalFields: { age: { type: 'number', required: false }, active: { type: 'boolean', required: false } } },
		})
		const result = await adapter.create({
			model: 'user',
			data: { name: 'Ada', email: 'ada@example.test' },
		})

		expect(result.id).toMatch(/^[0-9a-f]{24}$/)
		const row = await (await base.collection('users')).findOne({ _id: result.id })
		expect(row).toMatchObject({ _id: result.id, name: 'Ada' })
	})

	test('constructs lazily without touching the database or generating IDs', async () => {
		let collectionCalls = 0
		let idCalls = 0
		const { adapter: memory } = newMemoryAdapter()
		const base = {
			collection(...args) {
				collectionCalls++
				return memory.collection(...args)
			},
		}
		const factory = sqlAdapterFactory(base, { idGenerator: () => { idCalls++; return 'lazy-id' } })
		expect(collectionCalls).toBe(0)
		expect(idCalls).toBe(0)
		const adapter = factory({ baseURL: 'http://localhost:3000', secret: SECRET })
		expect(collectionCalls).toBe(0)
		expect(idCalls).toBe(0)
		await adapter.count({ model: 'user', where: [] })
		expect(collectionCalls).toBe(1)
		expect(idCalls).toBe(0)
	})

	test('preserves provided string and numeric IDs when configured', async () => {
		const { adapter: base } = newMemoryAdapter()
		const stringAdapter = createDatabaseAdapter(base)
		const provided = await stringAdapter.create({
			model: 'user',
			data: { id: 'provided-id', name: 'String ID' },
			forceAllowId: true,
		})
		expect(provided.id).toBe('provided-id')

		const numericBase = newMemoryAdapter().adapter
		const numericAdapter = createDatabaseAdapter(numericBase, {
			supportsNumericIds: true,
			idStrategy: 'custom',
			idGenerator: () => 42,
		})
		const numeric = await numericAdapter.create({
			model: 'user',
			data: { name: 'Numeric ID' },
		})
		expect(numeric.id).toBe(42)
		expect(typeof numeric.id).toBe('number')
	})

	test('supports alternate database ID columns and mappings', async () => {
		const { adapter: base } = newMemoryAdapter()
		const adapter = createDatabaseAdapter(base, {
			idColumn: 'id',
			idStrategy: 'custom',
			idGenerator: () => 'custom-id',
			mapKeysTransformInput: { id: 'id' },
			mapKeysTransformOutput: { id: 'id' },
		})
		const user = await adapter.create({ model: 'user', data: { name: 'Custom column' } })
		expect(user.id).toBe('custom-id')
		const stored = await (await base.collection('users', { idColumn: 'id' })).findOne({ id: 'custom-id' })
		expect(stored).toMatchObject({ id: 'custom-id', name: 'Custom column' })
	})

	test('maps id projections and id sorting to the configured database key', async () => {
		const { adapter: base } = newMemoryAdapter()
		const adapter = createDatabaseAdapter(base)
		await adapter.create({ model: 'user', data: { id: 'u2', name: 'Bea' }, forceAllowId: true })
		await adapter.create({ model: 'user', data: { id: 'u1', name: 'Ada' }, forceAllowId: true })

		const selected = await adapter.findOne({
			model: 'user',
			where: [{ field: 'id', value: 'u1' }],
			select: ['id', 'name'],
		})
		expect(selected).toMatchObject({ id: 'u1', name: 'Ada' })

		const sorted = await adapter.findMany({
			model: 'user',
			where: [],
			limit: 10,
			sortBy: { field: 'id', direction: 'asc' },
		})
		expect(sorted.map(row => row.id)).toEqual(['u1', 'u2'])
		const paged = await adapter.findMany({
			model: 'user', where: [], limit: 1, offset: 1,
			sortBy: { field: 'id', direction: 'asc' },
		})
		expect(paged.map(row => row.id)).toEqual(['u2'])
	})

	test('implements query operators, count, update, and delete CRUD methods', async () => {
		const { adapter: base } = newMemoryAdapter()
		const adapter = createDatabaseAdapter(base, {}, {
			user: { additionalFields: { age: { type: 'number', required: false }, active: { type: 'boolean', required: false } } },
		})
		await adapter.create({ model: 'user', data: { id: 'a', name: 'Ada', age: 30 }, forceAllowId: true })
		await adapter.create({ model: 'user', data: { id: 'b', name: 'Bea', age: 20 }, forceAllowId: true })
		await adapter.create({ model: 'user', data: { id: 'c', name: 'Cam', age: 40 }, forceAllowId: true })

		const filtered = await adapter.findMany({
			model: 'user',
			where: [
				{ field: 'age', operator: 'gte', value: 30 },
				{ field: 'id', operator: 'not_in', value: ['c'] },
			],
			limit: 10,
		})
		expect(filtered.map(row => row.id)).toEqual(['a'])
		expect(await adapter.count({ model: 'user', where: [{ field: 'age', operator: 'gt', value: 20 }] })).toBe(2)
		expect(await adapter.count({ model: 'user', where: [{ field: 'name', operator: 'ne', value: 'Cam' }] })).toBe(2)
		expect(await adapter.count({ model: 'user', where: [{ field: 'id', operator: 'in', value: ['a', 'c'] }] })).toBe(2)
		expect(await adapter.count({ model: 'user', where: [{ field: 'age', operator: 'lt', value: 30 }] })).toBe(1)
		expect(await adapter.count({ model: 'user', where: [{ field: 'age', operator: 'lte', value: 30 }] })).toBe(2)

		const same = await adapter.update({
			model: 'user', where: [{ field: 'id', value: 'a' }], update: { name: 'Ada', age: 30 },
		})
		expect(same).toMatchObject({ id: 'a', name: 'Ada' })

		const changedWhere = await adapter.update({
			model: 'user', where: [{ field: 'name', value: 'Ada' }], update: { name: 'Adele' },
		})
		expect(changedWhere).toMatchObject({ id: 'a', name: 'Adele' })
		expect(await adapter.findOne({ model: 'user', where: [{ field: 'name', value: 'Adele' }] })).toMatchObject({ id: 'a' })
		expect(await adapter.update({ model: 'user', where: [{ field: 'id', value: 'missing' }], update: { name: 'Nope' } })).toBeNull()
		expect(await adapter.updateMany({ model: 'user', where: [{ field: 'age', operator: 'gte', value: 30 }], update: { active: true } })).toBe(2)
		await adapter.delete({ model: 'user', where: [{ field: 'id', value: 'b' }] })
		expect(await adapter.deleteMany({ model: 'user', where: [{ field: 'active', value: true }] })).toBe(2)
		expect(await adapter.count({ model: 'user', where: [] })).toBe(0)
	})

	test('throws on unsupported where operators', async () => {
		const { adapter: base } = newMemoryAdapter()
		const adapter = createDatabaseAdapter(base)
		await expect(adapter.findOne({
			model: 'user', where: [{ field: 'email', operator: 'contains', value: 'example' }],
		})).rejects.toThrow('Unsupported operator: contains')
	})

	test('treats only recognized missing-schema errors as empty results', async () => {
		const missingBase = { collection: () => { throw new Error('no such table: missing') } }
		const missingAdapter = createDatabaseAdapter(missingBase)
		expect(await missingAdapter.findOne({ model: 'user', where: [] })).toBeNull()
		expect(await missingAdapter.findMany({ model: 'user', where: [], limit: 10 })).toEqual([])
		expect(await missingAdapter.count({ model: 'user', where: [] })).toBe(0)

		const brokenBase = { collection: () => { throw new Error('connection refused') } }
		const brokenAdapter = createDatabaseAdapter(brokenBase)
		await expect(brokenAdapter.findOne({ model: 'user', where: [] })).rejects.toThrow('connection refused')
	})

	test('routes each operation to the active tenant database', async () => {
		const databases = {
			alpha: newMemoryAdapter().adapter,
			beta: newMemoryAdapter().adapter,
		}
		let activeTenant = 'alpha'
		const router = {
			collection(name, options) {
				return databases[activeTenant].collection(name, options)
			},
		}
		const adapter = createDatabaseAdapter(router)

		await adapter.create({ model: 'user', data: { id: 'shared-id', email: 'alpha@example.test' }, forceAllowId: true })
		activeTenant = 'beta'
		await adapter.create({ model: 'user', data: { id: 'shared-id', email: 'beta@example.test' }, forceAllowId: true })
		expect(await adapter.findOne({ model: 'user', where: [{ field: 'id', value: 'shared-id' }] })).toMatchObject({ email: 'beta@example.test' })

		activeTenant = 'alpha'
		expect(await adapter.findOne({ model: 'user', where: [{ field: 'id', value: 'shared-id' }] })).toMatchObject({ email: 'alpha@example.test' })
	})
})

describe('createAuth', () => {
	test.each([
		[{ baseURL: 'http://localhost', secret: SECRET }, "'adapter' option is required."],
		[{ adapter: newMemoryAdapter().adapter, secret: SECRET }, "'baseURL' option is required."],
		[{ adapter: newMemoryAdapter().adapter, baseURL: 'http://localhost' }, "'secret' option is required."],
	])('requires %s', async (options, message) => {
		await expect(createAuth(options)).rejects.toThrow(message)
	})

	test('validates required inputs before constructing Better Auth', async () => {
		await expect(createAuth({
			adapter: {}, baseURL: 'http://localhost:3000', secret: SECRET,
		})).rejects.toThrow('collection()')
	})

	test('uses secondary storage only when the caller supplies it', async () => {
		const { adapter } = newMemoryAdapter()
		const withoutStorage = await createAuth(authOptions(adapter))
		expect(withoutStorage.options.secondaryStorage).toBeUndefined()
		const nullStorage = await createAuth({
			...authOptions(newMemoryAdapter().adapter), secondaryStorage: null,
		})
		expect(nullStorage.options.secondaryStorage).toBeUndefined()

		const store = new Map()
		const secondaryStorage = {
			async get(key) { return store.get(key) ?? null },
			async set(key, value) { store.set(key, value) },
			async delete(key) { store.delete(key) },
		}
		const withStorage = await createAuth({ ...authOptions(newMemoryAdapter().adapter), secondaryStorage })
		expect(withStorage.options.secondaryStorage).toBe(secondaryStorage)
	})

	test('forwards supported Better Auth options without allowing database override', async () => {
		const { adapter } = newMemoryAdapter()
		const secondaryStorage = { get: async () => null, set: async () => {}, delete: async () => {} }
		const callerDatabase = () => { throw new Error('caller database must not replace the supplied adapter') }
		const session = { expiresIn: 120 }
		const auth = await createAuth({
			...authOptions(adapter),
			trustedOrigins: ['https://app.example.test'],
			emailAndPassword: { enabled: false },
			secondaryStorage,
			session,
			database: callerDatabase,
		})

		expect(auth.options.trustedOrigins).toEqual(['https://app.example.test'])
		expect(auth.options.emailAndPassword).toMatchObject({ enabled: false })
		expect(auth.options.secondaryStorage).toBe(secondaryStorage)
		expect(auth.options.session).toMatchObject(session)
		expect(auth.options.database).not.toBe(callerDatabase)
		expect(typeof auth.handler).toBe('function')
	})

	test('passes the configured database adapter and ID mapping to Better Auth', async () => {
		const { adapter } = newMemoryAdapter()
		const auth = await createAuth({
			...authOptions(adapter),
			adapterConfig: {
				idColumn: 'id',
				idStrategy: 'custom',
				idGenerator: () => 'custom-id',
				modelCollectionMap: { user: 'members' },
			},
		})
		const database = auth.options.database({
			baseURL: 'http://localhost:3000',
			secret: SECRET,
		})
		const user = await database.create({ model: 'user', data: { name: 'Custom ID' } })
		expect(user.id).toBe('custom-id')
		const stored = await (await adapter.collection('members', { idColumn: 'id' })).findOne({ id: 'custom-id' })
		expect(stored).toMatchObject({ id: 'custom-id', name: 'Custom ID' })
	})

	test('accepts explicitly configured built-in and extra plugins', async () => {
		const { adapter } = newMemoryAdapter()
		const extraPlugin = { id: 'test-extra-plugin', init: () => ({}) }
		const auth = await createAuth({
			...authOptions(adapter),
			plugins: {
				bearer: true,
				username: true,
				twoFactor: true,
				anonymous: true,
				magicLink: { sendMagicLink: async () => {} },
				emailOTP: { sendVerificationOTP: async () => {} },
				genericOAuth: { config: [] },
				admin: true,
			},
			extraPlugins: [extraPlugin],
		})
		expect(auth.options.plugins.map(plugin => plugin.id)).toContain('test-extra-plugin')
		expect(auth.options.plugins.map(plugin => plugin.id)).toEqual([
			'bearer', 'username', 'two-factor', 'anonymous', 'magic-link', 'email-otp', 'generic-oauth', 'admin', 'test-extra-plugin',
		])
	})

	test('false, undefined, and null disable built-in plugins', async () => {
		const { adapter } = newMemoryAdapter()
		const auth = await createAuth({
			...authOptions(adapter),
			plugins: { bearer: false, username: undefined, twoFactor: null },
		})
		expect(auth.options.plugins).toEqual([])
		const nullPluginConfig = await createAuth({
			...authOptions(newMemoryAdapter().adapter),
			plugins: null,
		})
		expect(nullPluginConfig.options.plugins).toEqual([])
	})

	test('rejects invalid extra plugin configuration', async () => {
		await expect(createAuth({
			...authOptions(newMemoryAdapter().adapter), extraPlugins: {},
		})).rejects.toThrow("'extraPlugins' must be an array")
	})

	test('suppresses warning-level auth failure logs by default and accepts a logger override', async () => {
		const { adapter } = newMemoryAdapter()
		const defaultAuth = await createAuth(authOptions(adapter))
		expect(defaultAuth.options.logger.level).toBe('error')

		const log = () => {}
		const customAuth = await createAuth({
			...authOptions(newMemoryAdapter().adapter),
			logger: { level: 'warn', log },
		})
		expect(customAuth.options.logger).toEqual({ level: 'warn', log })
	})
})
