import { createAdapterFactory } from 'better-auth/adapters'

const defaultIdGenerator = () => {
	const timestamp = Math.floor(Date.now() / 1000)
		.toString(16)
		.padStart(8, '0')
	const bytes = new Uint8Array(8)
	globalThis.crypto.getRandomValues(bytes)
	const random = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
	return `${timestamp}${random}`.slice(0, 24)
}

const isMissingSchemaError = error => {
	const message = String(error?.message || '').toLowerCase()
	return message.includes('no such column') ||
		message.includes('unknown column') ||
		message.includes('does not exist') ||
		message.includes('no such table')
}

export const sqlAdapterFactory = (base, config = {}) => {
	if (!base || typeof base.collection !== 'function') {
		throw new TypeError('sqlAdapterFactory requires a database adapter with collection()')
	}

	const {
		adapterId = 'umosql-adapter',
		adapterName = 'UMOSQL Adapter',
		usePlural = false,
		debugLogs = false,
		idGenerator = defaultIdGenerator,
		modelCollectionMap = { user: 'users' },
		idStrategy = 'mongo',
		idColumn = '_id',
		supportsNumericIds = false,
		mapKeysTransformInput = { id: idColumn },
		mapKeysTransformOutput = { [idColumn]: 'id' },
	} = config

	const adapter = ({ getFieldName }) => {
		const collectionFor = model => base.collection(
			modelCollectionMap[model] ?? model,
			{ idStrategy, idColumn, idGenerator }
		)

		const dbField = (model, field) => {
			const schemaField = getFieldName({ model, field })
			return mapKeysTransformInput[schemaField] ?? mapKeysTransformInput[field] ?? schemaField
		}

		const toQuery = (model, where = []) => {
			if (!where.length) return {}
			const clauses = where.map(({ field, value, operator = 'eq' }) => {
				const key = dbField(model, field)
				switch (String(operator).toLowerCase()) {
					case 'eq': return { [key]: { $eq: value } }
					case 'ne': return { [key]: { $ne: value } }
					case 'in': return { [key]: { $in: Array.isArray(value) ? value : [value] } }
					case 'not_in': return { [key]: { $nin: Array.isArray(value) ? value : [value] } }
					case 'gt': return { [key]: { $gt: value } }
					case 'gte': return { [key]: { $gte: value } }
					case 'lt': return { [key]: { $lt: value } }
					case 'lte': return { [key]: { $lte: value } }
					default: throw new Error(`Unsupported operator: ${operator}`)
				}
			})
			return clauses.length === 1 ? clauses[0] : { $and: clauses }
		}

		const projectionFor = (model, select) => select?.length
			? Object.fromEntries(select.map(field => [dbField(model, field), 1]))
			: null

		const missingSchema = (error, fallback) => {
			if (isMissingSchemaError(error)) return fallback
			throw error
		}

		return {
			async create({ model, data }) {
				const result = await collectionFor(model).insertOne(data)
				const id = result.insertedId ?? data[idColumn] ?? data.id
				return { ...data, ...(id === undefined ? {} : { [idColumn]: id }) }
			},
			async findOne({ model, where, select }) {
				try {
					return await collectionFor(model).findOne(
						toQuery(model, where),
						projectionFor(model, select)
					) ?? null
				} catch (error) {
					return missingSchema(error, null)
				}
			},
			async findMany({ model, where, limit, offset, sortBy }) {
				try {
					const sort = sortBy
						? { [dbField(model, sortBy.field)]: sortBy.direction === 'desc' ? -1 : 1 }
						: undefined
					const cursor = await collectionFor(model).find(
						toQuery(model, where),
						null,
						{ limit, skip: offset, sort }
					)
					return await cursor.toArray()
				} catch (error) {
					return missingSchema(error, [])
				}
			},
			async count({ model, where }) {
				try {
					return await collectionFor(model).countDocuments(toQuery(model, where))
				} catch (error) {
					return missingSchema(error, 0)
				}
			},
			async update({ model, where, update }) {
				const collection = collectionFor(model)
				const clause = toQuery(model, where)
				const existing = await collection.findOne(clause)
				if (!existing) return null
				await collection.updateOne(clause, { $set: update })
				return collection.findOne({ [idColumn]: existing[idColumn] })
			},
			async updateMany({ model, where, update }) {
				const result = await collectionFor(model).updateMany(
					toQuery(model, where),
					{ $set: update }
				)
				return result.matchedCount ?? result.modifiedCount ?? 0
			},
			async delete({ model, where }) {
				await collectionFor(model).deleteOne(toQuery(model, where))
			},
			async deleteMany({ model, where }) {
				const result = await collectionFor(model).deleteMany(toQuery(model, where))
				return result.deletedCount ?? 0
			},
		}
	}

	return createAdapterFactory({
		config: {
			adapterId,
			adapterName,
			usePlural,
			debugLogs,
			supportsNumericIds,
			customIdGenerator: idGenerator,
			mapKeysTransformInput,
			mapKeysTransformOutput,
		},
		adapter,
	})
}

export default sqlAdapterFactory
