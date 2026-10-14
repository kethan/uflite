/** Return true for non-null, non-array objects. */
export const isObject = value =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

export default isObject
