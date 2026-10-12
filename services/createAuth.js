import { betterAuth } from 'better-auth/minimal'
import {
	admin,
	anonymous,
	bearer,
	emailOTP,
	genericOAuth,
	magicLink,
	twoFactor,
	username,
} from 'better-auth/plugins'
import { sqlAdapterFactory } from './sqlAdapterFactory.js'

const buildPlugins = (config = {}) => {
	config = config ?? {}
	const plugins = []
	const enabled = value => value !== false && value !== undefined && value !== null
	const options = value => value === true ? undefined : value

	for (const [name, factory] of Object.entries({
		bearer,
		username,
		twoFactor,
		anonymous,
		magicLink,
		emailOTP,
		genericOAuth,
		admin,
	})) {
		if (enabled(config[name])) plugins.push(factory(options(config[name])))
	}

	return plugins
}

export const createAuth = async ({
	adapter,
	baseURL,
	secret,
	trustedOrigins,
	emailAndPassword = { enabled: true, requireEmailVerification: false },
	secondaryStorage,
	logger = { level: 'error' },
	adapterConfig = {},
	plugins: pluginConfig = {},
	extraPlugins = [],
	...betterAuthOptions
} = {}) => {
	if (!adapter) throw new Error("[createAuth] 'adapter' option is required.")
	if (!baseURL) throw new Error("[createAuth] 'baseURL' option is required.")
	if (!secret) throw new Error("[createAuth] 'secret' option is required.")
	if (!Array.isArray(extraPlugins)) throw new TypeError("[createAuth] 'extraPlugins' must be an array.")

	const finalAdapterConfig = {
		adapterId: 'umosql-adapter',
		adapterName: 'UMOSQL Adapter',
		usePlural: false,
		debugLogs: false,
		modelCollectionMap: { user: 'users' },
		idStrategy: 'mongo',
		idColumn: '_id',
		supportsNumericIds: false,
		mapKeysTransformInput: { id: '_id' },
		mapKeysTransformOutput: { _id: 'id' },
		...adapterConfig,
	}
	if (adapterConfig.mapKeysTransformInput === undefined) {
		finalAdapterConfig.mapKeysTransformInput = { id: finalAdapterConfig.idColumn }
	}
	if (adapterConfig.mapKeysTransformOutput === undefined) {
		finalAdapterConfig.mapKeysTransformOutput = { [finalAdapterConfig.idColumn]: 'id' }
	}

	const authConfig = {
		...betterAuthOptions,
		baseURL,
		secret,
		trustedOrigins,
		logger,
		database: sqlAdapterFactory(adapter, finalAdapterConfig),
		emailAndPassword,
		plugins: [...buildPlugins(pluginConfig), ...extraPlugins],
	}

	if (secondaryStorage !== undefined && secondaryStorage !== null) {
		authConfig.secondaryStorage = secondaryStorage
	}

	return betterAuth(authConfig)
}

export default createAuth
