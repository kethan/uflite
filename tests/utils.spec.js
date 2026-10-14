import { describe, expect, it } from 'bun:test'
import { isObject } from '../src/utils/index.js'

describe('shared utilities', () => {
  it('recognizes non-null, non-array objects', () => {
    for (const value of [{}, Object.create(null), new Date()]) {
      expect(isObject(value)).toBe(true)
    }
  })

  it('rejects primitives, null, and arrays', () => {
    for (const value of [null, undefined, [], 'value', 1, false]) {
      expect(isObject(value)).toBe(false)
    }
  })
})
