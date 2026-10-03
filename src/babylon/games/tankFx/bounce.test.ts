import { describe, it, expect } from 'vitest'
import { BULLET_MAX_BOUNCE, clampMuzzle, stepBullet, type BulletKin } from '@/babylon/games/tankFx/bounce'
import { GRID_H, GRID_W, TANK_RADIUS, cellToWorld, worldToCell } from '@/babylon/games/tankFx/grid'

const DT = 1 / 30
const SPEED = 12
const wx = (c: number) => cellToWorld(c, GRID_W)
const wz = (c: number) => cellToWorld(c, GRID_H)
const only = (...cells: [number, number][]) => (cx: number, cy: number) =>
  cells.some(([x, y]) => x === cx && y === cy)
const none = () => false

describe('stepBullet — 反彈', () => {
  it('上限常數為 1', () => {
    expect(BULLET_MAX_BOUNCE).toBe(1)
  })

  it('空地照常前進', () => {
    const b: BulletKin = { x: wx(4), z: wz(4), vx: SPEED, vz: 0, bounces: 0 }
    const r = stepBullet(b, DT, none, none)
    expect(r.kind).toBe('move')
    if (r.kind !== 'move') return
    expect(r.x).toBeCloseTo(wx(4) + SPEED * DT)
  })

  it('撞 x 向牆面：vx 反向、vz 不變，反射點落在牆面', () => {
    // 格 7 右緣 x=0；從 -0.1 前進 0.4 會進格 8（牆）
    const b: BulletKin = { x: -0.1, z: wz(4) + 0.3, vx: SPEED, vz: 1, bounces: 0 }
    const r = stepBullet(b, DT, only([8, 4]), none)
    expect(r.kind).toBe('bounce')
    if (r.kind !== 'bounce') return
    expect(r.vx).toBe(-SPEED)
    expect(r.vz).toBe(1)
    expect(r.x).toBeCloseTo(-(-0.1 + SPEED * DT)) // 對 x=0 鏡射
    expect(r.hitX).toBeCloseTo(0)
    expect(r.bounces).toBe(1)
  })

  it('撞 z 向牆面：vz 反向、vx 不變', () => {
    const b: BulletKin = { x: wx(4), z: -0.1, vx: 0, vz: SPEED, bounces: 0 }
    const r = stepBullet(b, DT, only([4, 8]), none)
    expect(r.kind).toBe('bounce')
    if (r.kind !== 'bounce') return
    expect(r.vz).toBe(-SPEED)
    expect(r.vx).toBe(0)
    expect(r.hitZ).toBeCloseTo(0)
  })

  it('角落（兩軸同時跨格且兩側皆牆）：兩軸皆反向', () => {
    const b: BulletKin = { x: -0.1, z: -0.1, vx: SPEED, vz: SPEED, bounces: 0 }
    const r = stepBullet(b, DT, only([8, 7], [7, 8], [8, 8]), none)
    expect(r.kind).toBe('bounce')
    if (r.kind !== 'bounce') return
    expect([r.vx, r.vz]).toEqual([-SPEED, -SPEED])
  })

  it('斜角只撞到一側牆：只反向那一軸', () => {
    const b: BulletKin = { x: -0.1, z: -0.1, vx: SPEED, vz: SPEED, bounces: 0 }
    const r = stepBullet(b, DT, only([8, 7], [8, 8]), none)
    expect(r.kind).toBe('bounce')
    if (r.kind !== 'bounce') return
    expect([r.vx, r.vz]).toEqual([-SPEED, SPEED])
  })

  it('場外視同牆（外圈）', () => {
    const b: BulletKin = { x: wx(0) - 0.9, z: wz(3), vx: -SPEED, vz: 0, bounces: 0 }
    expect(stepBullet(b, DT, none, none).kind).toBe('bounce')
  })

  it('已反彈過一次，第二次撞牆即消失', () => {
    const b: BulletKin = { x: -0.1, z: wz(4), vx: SPEED, vz: 0, bounces: 1 }
    const r = stepBullet(b, DT, only([8, 4]), none)
    expect(r.kind).toBe('expire')
  })

  it('撞木箱：回報該格、不反彈', () => {
    const b: BulletKin = { x: -0.1, z: wz(4), vx: SPEED, vz: 0, bounces: 0 }
    const r = stepBullet(b, DT, none, only([8, 4]))
    expect(r).toMatchObject({ kind: 'crate', cx: 8, cy: 4 })
  })
})

describe('stepBullet — guest 預測與 host 一致', () => {
  /** 從同一則 bullet 訊息起算逐 tick 推進，回傳第一次反彈結果 */
  const firstBounce = (start: BulletKin, isWall: (cx: number, cy: number) => boolean) => {
    let b = { ...start }
    for (let i = 0; i < 300; i++) {
      const r = stepBullet(b, DT, isWall, none)
      if (r.kind === 'bounce') return r
      if (r.kind !== 'move') return null
      b = { x: r.x, z: r.z, vx: r.vx, vz: r.vz, bounces: r.bounces }
    }
    return null
  }

  it('同一函式、同輸入得同一反彈點與反彈後速度', () => {
    const wall = only([10, 6], [10, 5], [10, 7])
    const spawn: BulletKin = { x: wx(3) + 0.37, z: wz(6) - 0.21, vx: 11.2, vz: 4.3, bounces: 0 }
    const host = firstBounce(spawn, wall)
    const guest = firstBounce(structuredClone(spawn), wall)
    expect(host).not.toBeNull()
    expect(guest).toEqual(host)
  })
})

describe('clampMuzzle — 貼牆開火', () => {
  const MUZZLE = 0.6
  // 格 7 右緣 x=0、格 8 為牆；坦克貼牆時中心在 -TANK_RADIUS，砲口 0.6 落進牆格
  const tankX = -TANK_RADIUS
  const tz = wz(4)

  it('重現：砲口在牆格內直接起步，子彈不反彈而消失', () => {
    const b: BulletKin = { x: tankX + MUZZLE, z: tz, vx: SPEED, vz: 0, bounces: 0 }
    expect(stepBullet(b, DT, only([8, 4]), none).kind).toBe('expire')
  })

  it('砲口在牆格內：沿彈道拉回到牆面前，下一步即反彈', () => {
    const m = clampMuzzle(tankX + MUZZLE, tz, SPEED, 0, only([8, 4]))
    expect(worldToCell(m.x, GRID_W)).toBe(7)
    expect(m.x).toBeLessThan(0)
    expect(m.x).toBeGreaterThan(-0.05)
    expect(m.z).toBeCloseTo(tz)
    const r = stepBullet({ x: m.x, z: m.z, vx: SPEED, vz: 0, bounces: 0 }, DT, only([8, 4]), none)
    expect(r.kind).toBe('bounce')
    if (r.kind !== 'bounce') return
    expect(r.vx).toBe(-SPEED)
  })

  it('斜向貼牆：沿彈道反方向拉回，z 依同比例退回', () => {
    const vx = SPEED * Math.SQRT1_2
    const vz = SPEED * Math.SQRT1_2
    const sx = tankX + MUZZLE * Math.SQRT1_2 + 0.2 // 確保落進牆格
    const m = clampMuzzle(sx, tz, vx, vz, only([8, 4]))
    expect(worldToCell(m.x, GRID_W)).toBe(7)
    expect(m.x - sx).toBeCloseTo(m.z - tz) // 45° 反方向：兩軸退回量相同
  })

  it('場外視同牆（外圈貼邊開火）', () => {
    const edge = wx(GRID_W - 1) + 1 // 場地右緣
    const m = clampMuzzle(edge + 0.1, tz, SPEED, 0, none)
    expect(worldToCell(m.x, GRID_W)).toBe(GRID_W - 1)
  })

  it('砲口在空地：原樣不動', () => {
    expect(clampMuzzle(wx(4), wz(4), SPEED, 0, only([8, 4]))).toEqual({ x: wx(4), z: wz(4) })
  })
})
