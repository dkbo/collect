import { describe, expect, it } from 'vitest'
import {
  CHOP_HZ,
  HOLD_ARM,
  ITEM_KEYS,
  chefArms,
  chopTarget,
  itemKey,
  kitchenCellZ,
  kitchenZ,
  type BoardSpot,
} from '@/babylon/games/kitchenFx/pose'

describe('kitchenZ（渲染 z 軸翻轉：cy=0 在遠側）', () => {
  it('cy=0 在 +z、最後一列在 −z，對稱於 0', () => {
    expect(kitchenZ(0, 7, 2)).toBe(6)
    expect(kitchenZ(6, 7, 2)).toBe(-6)
    expect(kitchenZ(3, 7, 2)).toBe(0)
  })
  it('kitchenCellZ 是反函式：每一列往返不變，格內偏移四捨五入回同一格', () => {
    for (let cy = 0; cy < 7; cy++) {
      expect(kitchenCellZ(kitchenZ(cy, 7, 2), 7, 2)).toBe(cy)
      expect(kitchenCellZ(kitchenZ(cy, 7, 2) + 0.9, 7, 2)).toBe(cy)
      expect(kitchenCellZ(kitchenZ(cy, 7, 2) - 0.9, 7, 2)).toBe(cy)
    }
  })
  it('往 +z 走（W）格號變小＝往 cy=0 的背牆那一側', () => {
    expect(kitchenCellZ(kitchenZ(3, 7, 2) + 2, 7, 2)).toBe(2)
  })
})

describe('itemKey', () => {
  it('kind × ing 共 8 組、互不重複', () => {
    expect(ITEM_KEYS).toHaveLength(8)
    expect(new Set(ITEM_KEYS).size).toBe(8)
    expect(itemKey({ kind: 'soup', ing: 'm' })).toBe('soup-m')
    expect(ITEM_KEYS).toContain(itemKey({ kind: 'burnt', ing: 'v' }))
  })
})

describe('chopTarget', () => {
  const boards: BoardSpot[] = [
    { x: -10, z: 2, chopping: true },
    { x: -10, z: -2, chopping: false },
  ]
  it('範圍內有加工中的砧板就回傳它', () => {
    expect(chopTarget(-8, 2, boards, 2.6)).toBe(boards[0])
  })
  it('只靠近沒在加工的砧板回 null', () => {
    expect(chopTarget(-8, -2, boards, 2.6)).toBeNull()
  })
  it('超出範圍回 null', () => {
    expect(chopTarget(-5, 2, boards, 2.6)).toBeNull()
  })
  it('兩塊都在加工時取最近的', () => {
    const both: BoardSpot[] = [
      { x: -10, z: 2, chopping: true },
      { x: -10, z: -1, chopping: true },
    ]
    expect(chopTarget(-8.5, -0.5, both, 2.6)).toBe(both[1])
  })
})

describe('chefArms', () => {
  it('一般走路：雙手與走路擺幅反向、不內收', () => {
    const p = chefArms({ swing: 0.5, holding: false, chopping: false, tMs: 0 })
    expect(p.armL).toBeCloseTo(-0.5)
    expect(p.armR).toBeCloseTo(0.5)
    expect(p.inward).toBe(0)
  })
  it('手持物：雙手抬到胸前、往內收，不隨走路擺', () => {
    const a = chefArms({ swing: 0.5, holding: true, chopping: false, tMs: 0 })
    const b = chefArms({ swing: -0.5, holding: true, chopping: false, tMs: 0 })
    expect(a.armL).toBe(HOLD_ARM)
    expect(a.armR).toBe(HOLD_ARM)
    expect(a.inward).toBeGreaterThan(0)
    expect(b).toEqual(a)
  })
  it('切菜：右手在 X 軸 ±0.9 範圍以 4Hz 上下砍', () => {
    expect(CHOP_HZ).toBe(4)
    const period = 1000 / CHOP_HZ
    const samples = Array.from({ length: 40 }, (_, i) => chefArms({ swing: 0, holding: false, chopping: true, tMs: (i * period) / 40 }).armR)
    const lo = Math.min(...samples)
    const hi = Math.max(...samples)
    expect(hi - lo).toBeCloseTo(1.8, 1)
    // 一個週期後回到同一個角度
    const r0 = chefArms({ swing: 0, holding: false, chopping: true, tMs: 30 }).armR
    const r1 = chefArms({ swing: 0, holding: false, chopping: true, tMs: 30 + period }).armR
    expect(r1).toBeCloseTo(r0, 5)
  })
  it('手上有東西時不切菜（手持優先）', () => {
    const p = chefArms({ swing: 0, holding: true, chopping: true, tMs: 60 })
    expect(p.armR).toBe(HOLD_ARM)
  })
})
