import { describe, it, expect } from 'vitest'
import {
  finalStandings,
  formatRaceMs,
  liveOrder,
  makeLapClock,
  stepLapClock,
  type LiveCar,
} from '@/babylon/games/raceFx/raceResult'
import { RACE_COURSE } from '@/babylon/games/raceRules/trackData'

const T = RACE_COURSE.track
const cp = (k: number) => T.checkpoints[k]

describe('liveOrder（各端以同一份快照算名次）', () => {
  it('圈數優先、同圈依沿線距離；已過線依 fin 升冪排最前', () => {
    const cars: LiveCar[] = [
      { id: 'a', lap: 1, cp: 2, s: cp(2) + 5, fin: null },
      { id: 'b', lap: 2, cp: 0, s: 3, fin: null },
      { id: 'c', lap: 1, cp: 3, s: cp(3) + 1, fin: null },
      { id: 'd', lap: 3, cp: 0, s: 2, fin: 99000 },
      { id: 'e', lap: 3, cp: 0, s: 1, fin: 98000 },
    ]
    expect(liveOrder(T, cars)).toEqual(['e', 'd', 'b', 'c', 'a'])
    expect(liveOrder(T, [...cars].reverse())).toEqual(['e', 'd', 'b', 'c', 'a'])
  })

  it('起跑格在起點線後（s 接近 len、lap 0）不會被當成跑了一整圈', () => {
    const cars: LiveCar[] = [
      { id: 'grid', lap: 0, cp: 0, s: T.len - 5, fin: null },
      { id: 'ahead', lap: 0, cp: 0, s: 10, fin: null },
    ]
    expect(liveOrder(T, cars)).toEqual(['ahead', 'grid'])
  })
})

describe('LapClock（最佳圈）', () => {
  it('lap 增加時記一圈時間並更新最佳；lap 不變或倒退不記', () => {
    let c = makeLapClock(1000)
    c = stepLapClock(c, 0, 5000)
    expect(c.bestMs).toBeNull()
    c = stepLapClock(c, 1, 31000)
    expect(c).toMatchObject({ lap: 1, lastMs: 30000, bestMs: 30000, startAt: 31000 })
    c = stepLapClock(c, 2, 59000)
    expect(c).toMatchObject({ lap: 2, lastMs: 28000, bestMs: 28000 })
    c = stepLapClock(c, 3, 92000)
    expect(c).toMatchObject({ lap: 3, lastMs: 33000, bestMs: 28000 })
    expect(stepLapClock(c, 2, 95000)).toBe(c)
  })
})

describe('finalStandings（AC6 結算）', () => {
  const base = { name: 'n', colorIndex: 0 as const }
  it('過線者依 host 觀察順序、總時間取 fin；未過線者依當下名次、totalMs null', () => {
    const cars = [
      { ...base, id: 'a', lap: 3, cp: 0, s: 1, fin: 91000 },
      { ...base, id: 'b', lap: 3, cp: 0, s: 2, fin: 90500 },
      { ...base, id: 'c', lap: 2, cp: 5, s: cp(5) + 3, fin: null },
      { ...base, id: 'd', lap: 2, cp: 6, s: cp(6) + 3, fin: null },
    ]
    const rows = finalStandings(T, cars, ['a', 'b'], { a: 29000, b: null })
    expect(rows.map((r) => [r.id, r.rank, r.totalMs])).toEqual([
      ['a', 1, 91000],
      ['b', 2, 90500],
      ['d', 3, null],
      ['c', 4, null],
    ])
    expect(rows[0].bestLapMs).toBe(29000)
    expect(rows[1].bestLapMs).toBeNull()
    expect(rows[2].bestLapMs).toBeNull()
  })

  it('finishOrder 有已離線的車就略過；有 fin 但沒被觀察到過線的排在已觀察者之後', () => {
    const cars = [
      { ...base, id: 'a', lap: 3, cp: 0, s: 1, fin: 91000 },
      { ...base, id: 'b', lap: 1, cp: 0, s: 2, fin: null },
    ]
    const rows = finalStandings(T, cars, ['gone', 'x'], {})
    expect(rows.map((r) => r.id)).toEqual(['a', 'b'])
    expect(rows.map((r) => r.rank)).toEqual([1, 2])
  })
})

describe('formatRaceMs', () => {
  it('m:ss.cc，null 顯示 --', () => {
    expect(formatRaceMs(0)).toBe('0:00.00')
    expect(formatRaceMs(83456)).toBe('1:23.45')
    expect(formatRaceMs(9990)).toBe('0:09.99')
    expect(formatRaceMs(null)).toBe('--')
  })
})
