import { describe, it, expect } from 'vitest'
import { ROLL_MS, buildRaceHud, mapOutline, q01, q10ms, type RaceHudInput } from '@/babylon/games/raceFx/hudModel'

const base = (o: Partial<RaceHudInput> = {}): RaceHudInput => ({
  selfId: 'me',
  order: ['bot-0', 'me', 'bot-1', 'bot-2'],
  laps: 3,
  ownLap: 0,
  lapMs: 12345.678,
  bestLapMs: null,
  item: null,
  rollingUntil: 0,
  now: 1000,
  wrongWay: false,
  fin: null,
  pts: [[0, 0]],
  cars: [
    { id: 'me', colorIndex: 0, x: 1.234, z: -5.678, fin: null, name: '我', bestLapMs: null },
    { id: 'bot-0', colorIndex: 1, x: 10.05, z: 3.04, fin: null, name: '電腦1', bestLapMs: 30123.4 },
  ],
  ...o,
})

describe('raceFx/hudModel — 量化（共用契約 RaceHud）', () => {
  it('車點 0.1、時間 10ms（捨去）', () => {
    expect(q01(1.234)).toBe(1.2)
    expect(q01(-5.678)).toBe(-5.7)
    expect(q10ms(12345.678)).toBe(12340)
    expect(q10ms(null)).toBeNull()
  })

  it('小地圖輪廓：首尾不重複、量化 0.1、最多 maxPts 點', () => {
    const pts: [number, number][] = Array.from({ length: 500 }, (_, i) => [Math.cos(i / 80) * 50.123, Math.sin(i / 80) * 40.456])
    const out = mapOutline(pts, 120)
    expect(out.length).toBeLessThanOrEqual(120)
    expect(out.length).toBeGreaterThan(60)
    expect(out[0]).toEqual([50.1, 0])
    for (const [x, z] of out) {
      expect(Math.round(x * 10) / 10).toBe(x)
      expect(Math.round(z * 10) / 10).toBe(z)
    }
  })
})

describe('raceFx/hudModel — buildRaceHud', () => {
  it('名次、總數、lap = min(own.lap + 1, laps)、時間量化、map.pts 原參照', () => {
    const inp = base()
    const h = buildRaceHud(inp)
    expect(h.kind).toBe('race')
    expect(h.rank).toBe(2)
    expect(h.total).toBe(4)
    expect(h.lap).toBe(1)
    expect(h.laps).toBe(3)
    expect(h.lapMs).toBe(12340)
    expect(h.map.pts).toBe(inp.pts)
    expect(h.map.cars).toEqual([
      { id: 'me', colorIndex: 0, x: 1.2, z: -5.7, isSelf: true },
      { id: 'bot-0', colorIndex: 1, x: 10.1, z: 3, isSelf: false },
    ])
    expect(buildRaceHud(base({ ownLap: 2 })).lap).toBe(3)
    expect(buildRaceHud(base({ ownLap: 3 })).lap).toBe(3)
  })

  it('最後一圈：own.lap = laps − 1 且未完賽', () => {
    expect(buildRaceHud(base({ ownLap: 1 })).finalLap).toBe(false)
    expect(buildRaceHud(base({ ownLap: 2 })).finalLap).toBe(true)
    expect(buildRaceHud(base({ ownLap: 3, fin: 90000 })).finalLap).toBe(false)
  })

  it('道具轉盤：撿到後 ROLL_MS 內 rolling（手上已空則不轉）', () => {
    expect(ROLL_MS).toBe(900)
    expect(buildRaceHud(base({ item: 'shell', rollingUntil: 1500, now: 1000 })).rolling).toBe(true)
    expect(buildRaceHud(base({ item: 'shell', rollingUntil: 1500, now: 1500 })).rolling).toBe(false)
    expect(buildRaceHud(base({ item: null, rollingUntil: 1500, now: 1000 })).rolling).toBe(false)
  })

  it('未完賽：results 空；完賽：每台一列，名次依 order，totalMs 量化，未過線 null', () => {
    expect(buildRaceHud(base()).results).toEqual([])
    const h = buildRaceHud(
      base({
        fin: 95432.1,
        order: ['me', 'bot-0'],
        cars: [
          { id: 'me', colorIndex: 0, x: 0, z: 0, fin: 95432.1, name: '我', bestLapMs: 30001.9 },
          { id: 'bot-0', colorIndex: 1, x: 0, z: 0, fin: null, name: '電腦1', bestLapMs: null },
        ],
      })
    )
    expect(h.finished).toBe(true)
    expect(h.results).toEqual([
      { id: 'me', name: '我', colorIndex: 0, rank: 1, totalMs: 95430, bestLapMs: 30000 },
      { id: 'bot-0', name: '電腦1', colorIndex: 1, rank: 2, totalMs: null, bestLapMs: null },
    ])
  })

  it('自己不在 order（尚未有快照）→ rank 1、total 至少 1', () => {
    const h = buildRaceHud(base({ order: [] }))
    expect(h.rank).toBe(1)
    expect(h.total).toBe(1)
  })
})
