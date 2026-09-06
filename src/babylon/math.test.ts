import { describe, it, expect } from 'vitest'
import { lerpAngle, quadrantOf, stepQuarters } from './math'

describe('lerpAngle', () => {
  it('interpolates linearly when there is no wraparound', () => {
    expect(lerpAngle(0, Math.PI / 2, 0.5)).toBeCloseTo(Math.PI / 4, 10)
  })

  it('returns a at t=0 and b at t=1', () => {
    const a = 0.3
    const b = 1.2
    expect(lerpAngle(a, b, 0)).toBeCloseTo(a, 10)
    expect(lerpAngle(a, b, 1)).toBeCloseTo(b, 10)
  })

  it('takes the shortest path across the -pi/pi boundary', () => {
    // a 和 b 分別緊貼 -π / π 邊界；naive（無環繞）平均會落在 0，
    // 但實際最短路徑跨過邊界，中點應落在 ±π 上
    const a = -Math.PI + 0.1
    const b = Math.PI - 0.1
    const result = lerpAngle(a, b, 0.5)
    expect(Math.abs(result)).toBeCloseTo(Math.PI, 5)
  })
})

describe('quadrantOf', () => {
  it('maps the four axis-aligned directions to quadrants 0-3', () => {
    expect(quadrantOf(0, 1)).toBe(0) // +z
    expect(quadrantOf(1, 0)).toBe(1) // +x
    expect(quadrantOf(0, -1)).toBe(2) // -z
    expect(quadrantOf(-1, 0)).toBe(3) // -x
  })

  it('stays in quadrant 0 exactly on the 45 degree boundary', () => {
    expect(quadrantOf(1, 1)).toBe(0)
  })

  it('handles the negative/negative quadrant via angle wraparound', () => {
    expect(quadrantOf(-1, -1)).toBe(2)
  })
})

describe('stepQuarters', () => {
  it('increments on a forward (+1) quadrant step', () => {
    expect(stepQuarters(0, 0, 1)).toBe(1)
  })

  it('increments across the 3 -> 0 wraparound', () => {
    expect(stepQuarters(3, 3, 0)).toBe(4)
  })

  it('decrements on a backward (-1) quadrant step', () => {
    expect(stepQuarters(0, 1, 0)).toBe(-1)
  })

  it('leaves q unchanged when the quadrant does not change', () => {
    expect(stepQuarters(5, 2, 2)).toBe(5)
  })

  it('ignores a non-adjacent jump (e.g. teleport across two quadrants)', () => {
    expect(stepQuarters(0, 0, 2)).toBe(0)
  })
})
