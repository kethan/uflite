import { filter } from 'uqry'
import { isObject } from '../utils/isObject.js'

const isPermission = value =>
  typeof value === 'string' &&
  value.split(':').length === 3 &&
  value.split(':').every(Boolean)

const matchesPermission = (pattern, permission) => {
  const p = pattern.split(':')
  const v = permission.split(':')

  return (
    (p[0] === '*' || p[0] === v[0]) &&
    (p[1] === '*' || p[1] === v[1]) &&
    (p[2] === '*' || p[2] === v[2])
  )
}

const validateRule = rule => {
  if (!isObject(rule))
    throw new TypeError('Invalid ACL rule')

  if (typeof rule.id !== 'string' || !rule.id)
    throw new TypeError('ACL rule id is required')

  if (rule.name !== undefined && typeof rule.name !== 'string')
    throw new TypeError('ACL rule name must be a string')

  if (
    !Array.isArray(rule.permissions) ||
    !rule.permissions.length
  ) {
    throw new TypeError('ACL rule permissions are required')
  }

  if (!rule.permissions.every(isPermission))
    throw new TypeError('Invalid ACL permission')

  if (rule.check !== undefined && !isObject(rule.check))
    throw new TypeError('ACL rule check must be an object')
}

const validatePolicy = policy => {
  if (!isObject(policy))
    throw new TypeError('Invalid ACL policy')

  if (typeof policy.enabled !== 'boolean')
    throw new TypeError('ACL enabled must be a boolean')

  if (!Array.isArray(policy.rules))
    throw new TypeError('ACL rules must be an array')

  policy.rules.forEach(validateRule)
}

export const createACL = policy => {
  validatePolicy(policy)

  return {
    can(context = {}, permission) {
      if (!policy.enabled)
        return true

      if (!isPermission(permission))
        return false

      return policy.rules.some(rule => {
        const permissionMatch = rule.permissions.some(pattern =>
          matchesPermission(pattern, permission)
        )

        if (!permissionMatch)
          return false

        if (rule.check === undefined)
          return true

        return filter(rule.check)(context)
      })
    }
  }
}

export default createACL
