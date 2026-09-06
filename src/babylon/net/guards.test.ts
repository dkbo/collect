import { describe, it, expect } from 'vitest'
import {
  clampNum,
  isArrayOf,
  isCell,
  isCellArray,
  isIntIn,
  isNum,
  isNumIn,
  isObj,
  isOneOf,
  isStr,
  isStrArray,
} from './guards'

describe('isObj', () => {
  it('accepts plain objects only', () => {
    expect(isObj({ a: 1 })).toBe(true)
    expect(isObj(null)).toBe(false)
    expect(isObj(undefined)).toBe(false)
    expect(isObj([1, 2])).toBe(false)
    expect(isObj('x')).toBe(false)
  })
})

describe('isNum / isNumIn / isIntIn', () => {
  it('rejects NaN, Infinity and non-numbers', () => {
    expect(isNum(1.5)).toBe(true)
    expect(isNum(Number.NaN)).toBe(false)
    expect(isNum(Number.POSITIVE_INFINITY)).toBe(false)
    expect(isNum('1')).toBe(false)
    expect(isNum(undefined)).toBe(false)
  })

  it('enforces the inclusive range', () => {
    expect(isNumIn(0, 0, 10)).toBe(true)
    expect(isNumIn(10, 0, 10)).toBe(true)
    expect(isNumIn(-0.1, 0, 10)).toBe(false)
    expect(isNumIn(10.1, 0, 10)).toBe(false)
    expect(isNumIn(Number.NaN, 0, 10)).toBe(false)
  })

  it('requires integers for isIntIn', () => {
    expect(isIntIn(3, 0, 5)).toBe(true)
    expect(isIntIn(3.5, 0, 5)).toBe(false)
    expect(isIntIn(-1, 0, 5)).toBe(false)
  })
})

describe('isStr / isOneOf', () => {
  it('rejects empty and over-long strings', () => {
    expect(isStr('abc')).toBe(true)
    expect(isStr('')).toBe(false)
    expect(isStr('a'.repeat(65))).toBe(false)
    expect(isStr('a'.repeat(65), 128)).toBe(true)
    expect(isStr(42)).toBe(false)
  })

  it('only accepts listed values', () => {
    expect(isOneOf('hp', ['hp', 'speed'] as const)).toBe(true)
    expect(isOneOf('pwn', ['hp', 'speed'] as const)).toBe(false)
    expect(isOneOf(undefined, ['hp'] as const)).toBe(false)
  })
})

describe('isArrayOf / isStrArray', () => {
  it('enforces the element predicate and the length cap', () => {
    expect(isArrayOf<number>([1, 2], (x) => isNum(x), 4)).toBe(true)
    expect(isArrayOf<number>([1, 'x'], (x) => isNum(x), 4)).toBe(false)
    expect(isArrayOf<number>([1, 2, 3], (x) => isNum(x), 2)).toBe(false)
    expect(isArrayOf<number>('nope', (x) => isNum(x), 2)).toBe(false)
  })

  it('validates string arrays', () => {
    expect(isStrArray(['a', 'b'])).toBe(true)
    expect(isStrArray(['a', ''])).toBe(false)
    expect(isStrArray([1])).toBe(false)
  })
})

describe('isCell / isCellArray', () => {
  it('accepts in-bounds integer pairs only', () => {
    expect(isCell([0, 0], 13, 11)).toBe(true)
    expect(isCell([12, 10], 13, 11)).toBe(true)
    expect(isCell([13, 0], 13, 11)).toBe(false)
    expect(isCell([-1, 0], 13, 11)).toBe(false)
    expect(isCell([1.5, 0], 13, 11)).toBe(false)
    expect(isCell([0], 13, 11)).toBe(false)
    expect(isCell([0, 0, 0], 13, 11)).toBe(false)
    expect(isCell(undefined, 13, 11)).toBe(false)
  })

  it('validates arrays of cells and their length cap', () => {
    expect(isCellArray([[0, 0], [1, 1]], 13, 11)).toBe(true)
    expect(isCellArray([[0, 0], [99, 1]], 13, 11)).toBe(false)
    expect(isCellArray([[0, 0], [1, 1]], 13, 11, 1)).toBe(false)
    expect(isCellArray([], 13, 11)).toBe(true)
  })
})

describe('clampNum', () => {
  it('clamps in range and falls back for invalid input', () => {
    expect(clampNum(5, 0, 10)).toBe(5)
    expect(clampNum(-3, 0, 10)).toBe(0)
    expect(clampNum(99, 0, 10)).toBe(10)
    expect(clampNum(Number.NaN, 0, 10)).toBe(0)
    expect(clampNum('x', 0, 10, 7)).toBe(7)
  })
})
