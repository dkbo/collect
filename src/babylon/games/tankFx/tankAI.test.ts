import { describe, it, expect } from 'vitest'
import {
  AI_AIM_ERR_DEG,
  AI_DODGE_MS,
  AI_REACT_MS,
  createAIMemory,
  decideTankBot,
  type TankAIInput,
} from '@/babylon/games/tankFx/tankAI'
import { GRID_H, GRID_W, cellToWorld } from '@/babylon/games/tankFx/grid'

const NOW = 10_000
const wx = (c: number) => cellToWorld(c, GRID_W)
const wz = (c: number) => cellToWorld(c, GRID_H)
const only = (...cells: [number, number][]) => (cx: number, cy: number) =>
  cells.some(([x, y]) => x === cx && y === cy)
const none = () => false

/** 空曠場地上位於格 (2,2) 中心的 bot */
const input = (over: Partial<TankAIInput> = {}): TankAIInput => ({
  self: { id: 'bot-0', x: wx(2), z: wz(2), turretAngle: 0 },
  now: NOW,
  isWall: none,
  isCrate: none,
  isDanger: none,
  enemies: [],
  bullets: [],
  items: [],
  rand: () => 0.5,
  ...over,
})

describe('常數', () => {
  it('AC2 具名常數', () => {
    expect([AI_AIM_ERR_DEG, AI_REACT_MS, AI_DODGE_MS]).toEqual([8, 300, 600])
  })
})

describe('decideTankBot — 開火', () => {
  const enemy = { id: 'p0', x: wx(8), z: wz(2) }
  const aimed = Math.atan2(enemy.x - wx(2), 0) // 正 +x 方向

  it('有直線視線、反應時間已過、砲塔對準 → 開火', () => {
    const mem = { targetId: 'p0', seenSince: NOW - AI_REACT_MS, aimErr: 0 }
    const { action } = decideTankBot(input({ enemies: [enemy], self: { id: 'bot-0', x: wx(2), z: wz(2), turretAngle: aimed } }), mem)
    expect(action.fire).toBe(true)
    expect(action.aim).toBeCloseTo(aimed)
  })

  it('剛看到目標：未滿反應延遲不開火', () => {
    const { action, memory } = decideTankBot(
      input({ enemies: [enemy], self: { id: 'bot-0', x: wx(2), z: wz(2), turretAngle: aimed } }),
      createAIMemory()
    )
    expect(action.fire).toBe(false)
    expect(memory).toMatchObject({ targetId: 'p0', seenSince: NOW })
  })

  it('瞄準誤差不超過 AI_AIM_ERR_DEG', () => {
    for (const r of [0, 0.999]) {
      const { action } = decideTankBot(input({ enemies: [enemy], rand: () => r }), createAIMemory())
      expect(Math.abs((action.aim ?? 0) - aimed)).toBeLessThanOrEqual((AI_AIM_ERR_DEG * Math.PI) / 180 + 1e-9)
    }
  })

  it('每開一發就重抽瞄準誤差（不會對同一目標永遠打偏同一邊）', () => {
    const seq = [0.9, 0.1]
    const mem = { targetId: 'p0', seenSince: NOW - AI_REACT_MS, aimErr: 0 }
    const { action, memory } = decideTankBot(
      input({ enemies: [enemy], rand: () => seq.shift() ?? 0.5, self: { id: 'bot-0', x: wx(2), z: wz(2), turretAngle: aimed } }),
      mem
    )
    expect(action.fire).toBe(true)
    expect(memory.aimErr).not.toBe(0)
  })

  it('冷卻中（fireReady=false）不回報開火、也不重抽誤差', () => {
    const mem = { targetId: 'p0', seenSince: NOW - AI_REACT_MS, aimErr: 0 }
    const { action, memory } = decideTankBot(
      input({ enemies: [enemy], fireReady: false, self: { id: 'bot-0', x: wx(2), z: wz(2), turretAngle: aimed } }),
      mem
    )
    expect(action.fire).toBe(false)
    expect(memory.aimErr).toBe(0)
  })

  it('有視線但距離遠：邊瞄準邊往敵人靠近', () => {
    const far = { id: 'p0', x: wx(14), z: wz(2) }
    const { action } = decideTankBot(input({ enemies: [far] }), createAIMemory())
    expect(action.aim).not.toBeNull()
    expect([action.moveX, action.moveZ]).toEqual([1, 0])
  })

  it('中間隔著牆＝無視線，不開火也不瞄準', () => {
    const mem = { targetId: 'p0', seenSince: NOW - 1000, aimErr: 0 }
    const { action, memory } = decideTankBot(
      input({ enemies: [enemy], isWall: only([5, 2]), self: { id: 'bot-0', x: wx(2), z: wz(2), turretAngle: aimed } }),
      mem
    )
    expect(action.fire).toBe(false)
    expect(memory.targetId).toBeNull()
  })

  it('木箱也擋視線', () => {
    const mem = { targetId: 'p0', seenSince: NOW - 1000, aimErr: 0 }
    const { memory } = decideTankBot(input({ enemies: [enemy], isCrate: only([5, 2]) }), mem)
    expect(memory.targetId).toBeNull()
  })
})

describe('decideTankBot — 閃避', () => {
  it('子彈將在 AI_DODGE_MS 內擊中自己 → 橫移（垂直於彈道）', () => {
    const bullet = { x: wx(2) - 4, z: wz(2), vx: 12, vz: 0, owner: 'p0', bounces: 0 }
    const { action } = decideTankBot(input({ bullets: [bullet] }), createAIMemory())
    expect(action.moveX).toBeCloseTo(0)
    expect(Math.abs(action.moveZ)).toBeCloseTo(1)
  })

  it('子彈太遠（超過 AI_DODGE_MS 才到）不閃', () => {
    const bullet = { x: wx(2) - 10, z: wz(2), vx: 12, vz: 0, owner: 'p0', bounces: 0 }
    const { action } = decideTankBot(input({ bullets: [bullet] }), createAIMemory())
    expect([action.moveX, action.moveZ]).toEqual([0, 0])
  })

  it('自己剛射出（未反彈）的子彈不閃', () => {
    const bullet = { x: wx(2) - 4, z: wz(2), vx: 12, vz: 0, owner: 'bot-0', bounces: 0 }
    const { action } = decideTankBot(input({ bullets: [bullet] }), createAIMemory())
    expect([action.moveX, action.moveZ]).toEqual([0, 0])
  })

  it('閃避方向一側是預告格就閃往另一側', () => {
    const bullet = { x: wx(2) - 4, z: wz(2) + 0.1, vx: 12, vz: 0, owner: 'p0', bounces: 0 }
    // 子彈略偏 +z，原本會往 -z 閃；-z 那格是預告格 → 改往 +z
    const { action } = decideTankBot(input({ bullets: [bullet], isDanger: only([2, 1]) }), createAIMemory())
    expect(action.moveZ).toBeCloseTo(1)
  })
})

describe('decideTankBot — 尋路', () => {
  it('撿道具：無目標時沿格路徑走向最近的道具', () => {
    const { action } = decideTankBot(input({ items: [{ cx: 2, cy: 5 }] }), createAIMemory())
    expect([action.moveX, action.moveZ]).toEqual([0, 1])
  })

  it('避開預告格：直線路徑上有預告格就繞路', () => {
    const { action } = decideTankBot(input({ items: [{ cx: 4, cy: 2 }], isDanger: only([3, 2]) }), createAIMemory())
    expect(action.moveX).toBe(0)
    expect(Math.abs(action.moveZ)).toBe(1)
  })

  it('不走進已落牆格（牆格不可通行）', () => {
    const { action } = decideTankBot(input({ items: [{ cx: 4, cy: 2 }], isWall: only([3, 2]) }), createAIMemory())
    expect(action.moveX).toBe(0)
  })

  it('站在預告格上 → 往最近的安全格逃', () => {
    const { action } = decideTankBot(input({ isDanger: only([2, 2], [2, 1], [2, 3], [1, 2]) }), createAIMemory())
    expect([action.moveX, action.moveZ]).toEqual([1, 0])
  })

  it('無道具、無視線 → 走向最近的敵人', () => {
    const enemy = { id: 'p0', x: wx(2), z: wz(9) }
    const { action } = decideTankBot(input({ enemies: [enemy], isWall: only([2, 5]) }), createAIMemory())
    expect(Math.hypot(action.moveX, action.moveZ)).toBeCloseTo(1)
  })

  it('路被木箱擋住：對準木箱開火', () => {
    const crate = only([2, 3], [1, 2], [3, 2], [2, 1])
    const enemy = { id: 'p0', x: wx(2), z: wz(9) }
    const { action } = decideTankBot(
      input({ enemies: [enemy], isCrate: crate, self: { id: 'bot-0', x: wx(2), z: wz(2), turretAngle: 0 } }),
      createAIMemory()
    )
    expect(action.aim).not.toBeNull()
    expect(action.fire).toBe(true)
  })
})
