import { describe, expect, it } from 'vitest'
import { BurstQueue } from '@/babylon/games/bomberFx/burstQueue'

describe('BurstQueue', () => {
  it('依序逐顆取出，同一筆請求的位置落在 spread 範圍內', () => {
    const q = new BurstQueue<string>(() => 0.5)
    q.push({ x: 1, y: 2, z: 3, spread: 0.4, count: 2, style: 'a' })
    q.push({ x: -5, y: 0, z: 0, spread: 0, count: 1, style: 'b' })
    expect(q.total).toBe(3)
    const p1 = q.next()
    const p2 = q.next()
    const p3 = q.next()
    expect(p1?.style).toBe('a')
    expect(p2?.style).toBe('a')
    expect(p3).toMatchObject({ style: 'b', x: -5, y: 0, z: 0 })
    expect(q.next()).toBeNull()
    expect(q.total).toBe(0)
  })

  it('spread 以請求中心為準（亂數 0 與 1 落在兩端；y 只往上散，不鑽進地面）', () => {
    const vals = [0, 0, 0, 1, 1, 1]
    const q = new BurstQueue<number>(() => vals.shift() ?? 0.5)
    q.push({ x: 0, y: 0, z: 0, spread: 1, count: 2, style: 0 })
    expect(q.next()).toMatchObject({ x: -1, y: 0, z: -1 })
    expect(q.next()).toMatchObject({ x: 1, y: 1, z: 1 })
  })

  it('總數超過上限時丟掉最舊的請求', () => {
    const q = new BurstQueue<number>(() => 0.5, 5)
    q.push({ x: 0, y: 0, z: 0, spread: 0, count: 3, style: 1 })
    q.push({ x: 0, y: 0, z: 0, spread: 0, count: 4, style: 2 })
    expect(q.total).toBeLessThanOrEqual(5)
    expect(q.next()?.style).toBe(2)
  })

  it('clear 清空', () => {
    const q = new BurstQueue<number>(() => 0.5)
    q.push({ x: 0, y: 0, z: 0, spread: 0, count: 3, style: 1 })
    q.clear()
    expect(q.total).toBe(0)
    expect(q.next()).toBeNull()
  })
})
