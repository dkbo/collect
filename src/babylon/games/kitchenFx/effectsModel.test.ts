import { describe, expect, it } from 'vitest'
import {
  ALARM_HZ,
  advanceAlarmPhase,
  alarmHz,
  alarmPulse,
  alarmSmokeRate,
  arcPoint,
  boardPhase,
  extrapolateProgress,
  EXTRAPOLATE_MAX_MS,
  potPhase,
  slotEvents,
} from '@/babylon/games/kitchenFx/effectsModel'
import { CHOP_MS, COOK_MS } from '@/babylon/games/overcookedKitchen'

describe('potPhase（快焦＝soup 且 progress > 0，裁決⑥）', () => {
  it('空鍋、煮中、煮好、快焦、焦了', () => {
    expect(potPhase(null, 1)).toBe('empty')
    expect(potPhase({ kind: 'chop', ing: 'v' }, 0.4)).toBe('cooking')
    expect(potPhase({ kind: 'soup', ing: 'v' }, 0)).toBe('done')
    expect(potPhase({ kind: 'soup', ing: 'm' }, 0.01)).toBe('alarm')
    expect(potPhase({ kind: 'burnt', ing: 'm' }, 1)).toBe('burnt')
  })
})

describe('boardPhase', () => {
  it('生食材在切、切好、空板', () => {
    expect(boardPhase(null)).toBe('empty')
    expect(boardPhase({ kind: 'raw', ing: 'v' })).toBe('chopping')
    expect(boardPhase({ kind: 'chop', ing: 'm' })).toBe('done')
  })
})

describe('快焦脈動與煙量', () => {
  it('頻率 2Hz → 6Hz、煙 4 → 20，隨 progress 線性並夾住', () => {
    expect(alarmHz(0)).toBe(ALARM_HZ[0])
    expect(alarmHz(1)).toBe(ALARM_HZ[1])
    expect(alarmHz(0.5)).toBeCloseTo(4)
    expect(alarmHz(3)).toBe(6)
    expect(alarmSmokeRate(0)).toBe(4)
    expect(alarmSmokeRate(1)).toBe(20)
  })
})

describe('extrapolateProgress（guest 8Hz 快照之間本地外插）', () => {
  it('砧板生食材：progress += age / CHOP_MS，夾到 1', () => {
    expect(extrapolateProgress('board', { kind: 'raw', ing: 'v' }, 0.2, CHOP_MS * 0.1)).toBeCloseTo(0.3)
    expect(extrapolateProgress('board', { kind: 'raw', ing: 'v' }, 0.95, 400)).toBe(1)
  })
  it('鍋中煮與快焦：progress += age / COOK_MS', () => {
    expect(extrapolateProgress('pot', { kind: 'chop', ing: 'm' }, 0.5, COOK_MS * 0.05)).toBeCloseTo(0.55)
    expect(extrapolateProgress('pot', { kind: 'soup', ing: 'm' }, 0.3, COOK_MS * 0.05)).toBeCloseTo(0.35)
  })
  it('煮好的前 2 秒（soup 且 progress 0）不外插：不知道快焦何時開始', () => {
    expect(extrapolateProgress('pot', { kind: 'soup', ing: 'v' }, 0, 100)).toBe(0)
  })
  it('完成品、空格、檯面不動', () => {
    expect(extrapolateProgress('board', { kind: 'chop', ing: 'v' }, 1, 100)).toBe(1)
    expect(extrapolateProgress('pot', null, 1, 100)).toBe(1)
    expect(extrapolateProgress('counter', { kind: 'raw', ing: 'v' }, 1, 100)).toBe(1)
  })
  it('快照斷了也只外插 EXTRAPOLATE_MAX_MS；負的經過時間當 0', () => {
    const cap = extrapolateProgress('board', { kind: 'raw', ing: 'v' }, 0, EXTRAPOLATE_MAX_MS)
    expect(extrapolateProgress('board', { kind: 'raw', ing: 'v' }, 0, 60_000)).toBeCloseTo(cap)
    expect(extrapolateProgress('board', { kind: 'raw', ing: 'v' }, 0.4, -50)).toBeCloseTo(0.4)
  })
})

describe('arcPoint（拾取／放下弧線）', () => {
  it('兩端點落在起訖、中間抬高', () => {
    const a = { x: 0, y: 1, z: 0 }
    const b = { x: 2, y: 1, z: 4 }
    expect(arcPoint(a, b, 0, 0.8)).toEqual({ x: 0, y: 1, z: 0 })
    const end = arcPoint(a, b, 1, 0.8)
    expect(end.x).toBeCloseTo(2)
    expect(end.y).toBeCloseTo(1)
    expect(end.z).toBeCloseTo(4)
    const mid = arcPoint(a, b, 0.5, 0.8)
    expect(mid.y).toBeCloseTo(1.8)
    expect(mid.x).toBeCloseTo(1)
  })
})

describe('slotEvents（前後兩張 view 的站點差異 → 特效事件）', () => {
  const sv = (id: string, item: { kind: 'raw' | 'chop' | 'soup' | 'burnt'; ing: 'v' | 'm' } | null, progress = 1) => ({ id, item, progress })
  it('切：開始與切好', () => {
    expect(slotEvents([sv('board-0', null)], [sv('board-0', { kind: 'raw', ing: 'v' }, 0)])).toEqual([{ type: 'chopStart', id: 'board-0' }])
    expect(slotEvents([sv('board-0', { kind: 'raw', ing: 'v' }, 0.9)], [sv('board-0', { kind: 'chop', ing: 'v' })])).toEqual([
      { type: 'chopDone', id: 'board-0' },
    ])
  })
  it('煮：開始、煮好、焦了', () => {
    expect(slotEvents([sv('pot-0', null)], [sv('pot-0', { kind: 'chop', ing: 'm' }, 0)])).toEqual([{ type: 'cookStart', id: 'pot-0' }])
    expect(slotEvents([sv('pot-0', { kind: 'chop', ing: 'm' }, 0.9)], [sv('pot-0', { kind: 'soup', ing: 'm' }, 0)])).toEqual([
      { type: 'cookDone', id: 'pot-0' },
    ])
    expect(slotEvents([sv('pot-0', { kind: 'soup', ing: 'm' }, 0.9)], [sv('pot-0', { kind: 'burnt', ing: 'm' })])).toEqual([
      { type: 'burnt', id: 'pot-0' },
    ])
  })
  it('快焦進度變化、同狀態不重報', () => {
    expect(slotEvents([sv('pot-1', { kind: 'soup', ing: 'v' }, 0)], [sv('pot-1', { kind: 'soup', ing: 'v' }, 0.2)])).toEqual([])
    expect(slotEvents([sv('counter-1-0', { kind: 'raw', ing: 'v' })], [sv('counter-1-0', { kind: 'raw', ing: 'v' })])).toEqual([])
  })
})

describe('快焦脈動相位（每鍋累加，不用絕對時間）', () => {
  const TAU = Math.PI * 2
  it('progress 固定時每幀增量 = 2π·hz·dt，與已經過多久無關', () => {
    const dt = 1000 / 60
    const a = advanceAlarmPhase(0, 0.5, dt)
    expect(a).toBeCloseTo(TAU * alarmHz(0.5) * (dt / 1000))
    // 從任何相位起算，增量都一樣（對照：舊算式在 t=100s 時每幀轉 2 圈以上）
    const b = advanceAlarmPhase(1.234, 0.5, dt)
    expect(((b - 1.234 + TAU) % TAU)).toBeCloseTo(a)
  })
  it('2Hz 時 1 秒剛好轉 2 圈回到原相位；6Hz 時 1 秒轉 6 圈', () => {
    let ph = 0
    for (let i = 0; i < 60; i++) ph = advanceAlarmPhase(ph, 0, 1000 / 60)
    expect(Math.sin(ph)).toBeCloseTo(0, 5)
    // 從 π/2 起算，6 次過零都落在區間內部（不受浮點誤差卡在端點）
    let n = 0
    ph = Math.PI / 2
    let prev = Math.sin(ph)
    for (let i = 0; i < 600; i++) {
      ph = advanceAlarmPhase(ph, 1, 1000 / 600)
      const s = Math.sin(ph)
      if (prev < 0 && s >= 0) n++
      prev = s
    }
    expect(n).toBe(6)
  })
  it('相位保持在 [0, 2π)；單幀最多算 100ms（切分頁回來不暴衝）', () => {
    const ph = advanceAlarmPhase(6, 1, 50)
    expect(ph).toBeGreaterThanOrEqual(0)
    expect(ph).toBeLessThan(TAU)
    expect(advanceAlarmPhase(0, 0, 10_000)).toBeCloseTo(advanceAlarmPhase(0, 0, 100))
  })
  it('alarmPulse：相位 0 起從 0.5 開始、落在 0..1', () => {
    expect(alarmPulse(0)).toBeCloseTo(0.5)
    expect(alarmPulse(Math.PI / 2)).toBeCloseTo(1)
    expect(alarmPulse(-Math.PI / 2)).toBeCloseTo(0)
  })
})
