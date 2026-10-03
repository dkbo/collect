import { describe, it, expect } from 'vitest'
import {
  CHECKPOINTS,
  FINISH_GRACE_MS,
  LAPS,
  WRONG_WAY_MS,
  advanceLap,
  LONG_CORNER_K,
  LONG_CORNER_MIN_LEN,
  findLongCurves,
  makeCourse,
  makeTrack,
  normalizeProgress,
  pointAt,
  raceOver,
  rankCars,
  sectorOf,
  stepWrongWay,
  trackProgress,
  type LapState,
} from '@/babylon/games/raceRules/track'

/** 40×40 方形，每 10 單位一個控制點；起點 (20,0) 朝 +x，逆時針（俯視 x 右 z 上）繞一圈 */
const SQUARE: [number, number][] = [
  [20, 0], [30, 0], [40, 0], [40, 10], [40, 20], [40, 30], [40, 40], [30, 40],
  [20, 40], [10, 40], [0, 40], [0, 30], [0, 20], [0, 10], [0, 0], [10, 0],
]
const sq = makeTrack(SQUARE, 8)

const circle = (r: number, n: number): [number, number][] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    return [Math.sin(a) * r, Math.cos(a) * r] as [number, number]
  })

describe('makeTrack — 閉合中心線', () => {
  it('Catmull-Rom 取樣成閉合折線，總長接近圓周', () => {
    const t = makeTrack(circle(20, 16), 10)
    expect(t.len).toBeGreaterThan(2 * Math.PI * 20 * 0.98)
    expect(t.len).toBeLessThan(2 * Math.PI * 20 * 1.01)
    expect(t.pts.length).toBeGreaterThan(16)
    expect(t.width).toBe(10)
  })

  it('8 個檢查點：0 號在起點，依沿線距離升冪均分', () => {
    expect(sq.checkpoints).toHaveLength(CHECKPOINTS)
    expect(sq.checkpoints[0]).toBe(0)
    for (let i = 1; i < CHECKPOINTS; i++) {
      expect(sq.checkpoints[i]).toBeCloseTo((sq.len * i) / CHECKPOINTS, 6)
    }
  })
})

describe('trackProgress — 沿線距離與有號橫向距離', () => {
  it('直線段：s 等於離起點的距離，以行進方向看右正左負（朝 +x 時右側是 −z）', () => {
    const p = trackProgress(sq, 25, 0)
    expect(p.s).toBeCloseTo(5, 6)
    expect(p.lateral).toBeCloseTo(0, 6)
    expect(trackProgress(sq, 25, -3).lateral).toBeCloseTo(3, 6)
    expect(trackProgress(sq, 25, 2).lateral).toBeCloseTo(-2, 6)
  })

  it('彎段：中心線上的點回推到同一個 s、lateral≈0，沿法線偏移量即 lateral', () => {
    const t = makeTrack(circle(20, 16), 10)
    for (const s of [3, 30, 61.5, 100, t.len - 1]) {
      const c = pointAt(t, s)
      const back = trackProgress(t, c.x, c.z)
      expect(back.s).toBeCloseTo(s, 1)
      expect(Math.abs(back.lateral)).toBeLessThan(0.05)
      // 右側 = (cos h, -sin h)
      const off = trackProgress(t, c.x + Math.cos(c.heading) * 2, c.z - Math.sin(c.heading) * 2)
      expect(off.lateral).toBeCloseTo(2, 1)
    }
  })

  it('跨起點：起點前一點 s 接近 len，起點後一點 s 接近 0', () => {
    expect(trackProgress(sq, 19, 0).s).toBeCloseTo(sq.len - 1, 6)
    expect(trackProgress(sq, 21, 0).s).toBeCloseTo(1, 6)
  })

  it('seg 指向所在折線段', () => {
    const p = trackProgress(sq, 25, 0)
    const a = sq.pts[p.seg]
    const b = sq.pts[(p.seg + 1) % sq.pts.length]
    expect(Math.min(a[0], b[0])).toBeLessThanOrEqual(25)
    expect(Math.max(a[0], b[0])).toBeGreaterThanOrEqual(25)
  })
})

describe('pointAt — 沿線取點與朝向', () => {
  it('朝向以 ry 表示（前方 = (sin ry, cos ry)）', () => {
    const p = pointAt(sq, 5)
    expect(p.x).toBeCloseTo(25, 6)
    expect(p.z).toBeCloseTo(0, 6)
    expect(p.heading).toBeCloseTo(Math.PI / 2, 6)
  })

  it('s 超出一圈或為負會環繞', () => {
    expect(pointAt(sq, sq.len + 5).x).toBeCloseTo(25, 6)
    expect(pointAt(sq, -1).x).toBeCloseTo(19, 6)
  })
})

describe('advanceLap — 依序通過檢查點才算圈', () => {
  const run = (from: LapState, sectors: number[]) => sectors.reduce(advanceLap, from)
  const start: LapState = { lap: 0, cp: 0 }

  it('依序 1..7 再回 0 號：圈數 +1', () => {
    expect(run(start, [0, 1, 2, 3, 4, 5, 6, 7, 0])).toEqual({ lap: 1, cp: 0 })
  })

  it('跳過檢查點（抄捷徑）不算圈', () => {
    expect(run(start, [0, 1, 2, 5, 6, 7, 0])).toEqual({ lap: 0, cp: 2 })
  })

  it('補回跳過的檢查點後才繼續累計', () => {
    expect(run(start, [1, 2, 5, 3, 4, 5, 6, 7, 0])).toEqual({ lap: 1, cp: 0 })
  })

  it('過線後倒車回上一圈再前進，不重複加圈', () => {
    const lap1 = run(start, [1, 2, 3, 4, 5, 6, 7, 0])
    expect(run(lap1, [7, 6, 7, 0, 7, 0])).toEqual({ lap: 1, cp: 0 })
  })

  it('起跑格在起點線後方（7 號區）不算任何進度', () => {
    expect(run(start, [7, 7, 0])).toEqual({ lap: 0, cp: 0 })
  })

  it('跑滿 LAPS 圈後不再累加', () => {
    let st = start
    for (let i = 0; i < LAPS + 2; i++) st = run(st, [1, 2, 3, 4, 5, 6, 7, 0])
    expect(st.lap).toBe(LAPS)
  })
})

describe('sectorOf', () => {
  it('回傳不大於 s 的最後一個檢查點序號', () => {
    expect(sectorOf(sq, 0)).toBe(0)
    expect(sectorOf(sq, sq.checkpoints[3] + 0.01)).toBe(3)
    expect(sectorOf(sq, sq.len - 0.01)).toBe(CHECKPOINTS - 1)
  })
})

describe('normalizeProgress — 名次用的 (lap, s)', () => {
  it('正常行駛時原樣', () => {
    expect(normalizeProgress(sq, { lap: 1, cp: 2, s: sq.checkpoints[2] + 3 })).toEqual({
      lap: 1,
      s: sq.checkpoints[2] + 3,
    })
  })

  it('過線後倒車回起點線後：算回上一圈末段', () => {
    expect(normalizeProgress(sq, { lap: 1, cp: 0, s: sq.len - 2 })).toEqual({ lap: 0, s: sq.len - 2 })
  })

  it('起跑格在起點線後（lap 0）：夾成 s = 0', () => {
    expect(normalizeProgress(sq, { lap: 0, cp: 0, s: sq.len - 2 })).toEqual({ lap: 0, s: 0 })
  })

  it('長距離倒車過起點（超過半圈）：算回上一圈、不夾成 CP1（名次不偏高）', () => {
    expect(sq.checkpoints[0]).toBe(0)
    const s = sq.len * 0.4 // 從起點倒車 0.6 圈
    expect(normalizeProgress(sq, { lap: 2, cp: 0, s })).toEqual({ lap: 1, s })
    // 在 cp 3 之後倒車越過起點、再倒過 cp 7 進到 cp 6 區：仍在上一圈
    const s2 = sq.checkpoints[6] + 1
    expect(normalizeProgress(sq, { lap: 1, cp: 3, s: s2 })).toEqual({ lap: 0, s: s2 })
    // lap 0 倒車一大段仍夾在起跑格
    expect(normalizeProgress(sq, { lap: 0, cp: 0, s })).toEqual({ lap: 0, s: 0 })
  })

  it('已進下一個檢查點區（cp 未推進）或跳過一個檢查點（身在下下個區）：夾在下一個未通過檢查點', () => {
    // 下一個區（sector cp+1）
    expect(normalizeProgress(sq, { lap: 1, cp: 1, s: sq.checkpoints[2] + 3 })).toEqual({ lap: 1, s: sq.checkpoints[2] })
    expect(normalizeProgress(sq, { lap: 1, cp: 7, s: sq.checkpoints[1] - 1 })).toEqual({ lap: 2, s: 0 })
    // 真的跳過一個檢查點（sector cp+2），含跨起點
    expect(normalizeProgress(sq, { lap: 1, cp: 1, s: sq.checkpoints[3] + 2 })).toEqual({ lap: 1, s: sq.checkpoints[2] })
    expect(normalizeProgress(sq, { lap: 1, cp: 7, s: sq.checkpoints[1] + 2 })).toEqual({ lap: 2, s: 0 })
  })

  it('跳區抄到前方：s 不得超過下一個未通過檢查點', () => {
    const r = normalizeProgress(sq, { lap: 0, cp: 2, s: sq.checkpoints[5] })
    expect(r.lap).toBe(0)
    expect(r.s).toBeLessThanOrEqual(sq.checkpoints[3])
  })
})

describe('stepWrongWay — 逆向判定', () => {
  const dt = 100
  const go = (n: number, heading: number, speed: number) => {
    let ms = 0
    let wrongWay = false
    for (let i = 0; i < n; i++) ({ ms, wrongWay } = stepWrongWay(ms, { heading, trackHeading: 0, speed }, dt))
    return { ms, wrongWay }
  }

  it(`朝反方向前進持續 ${WRONG_WAY_MS}ms 以上才判逆向`, () => {
    expect(go(WRONG_WAY_MS / dt - 1, Math.PI, 8).wrongWay).toBe(false)
    expect(go(WRONG_WAY_MS / dt, Math.PI, 8).wrongWay).toBe(true)
  })

  it('順向或幾乎靜止不累計', () => {
    expect(go(30, 0.3, 8)).toEqual({ ms: 0, wrongWay: false })
    expect(go(30, Math.PI, 0.2)).toEqual({ ms: 0, wrongWay: false })
  })

  it('一回到順向立刻清除', () => {
    let st = go(20, Math.PI, 8)
    expect(st.wrongWay).toBe(true)
    st = stepWrongWay(st.ms, { heading: 0, trackHeading: 0, speed: 8 }, dt)
    expect(st).toEqual({ ms: 0, wrongWay: false })
  })
})

describe('rankCars — 名次', () => {
  const list = [
    { id: 'c', lap: 2, s: 10, finishedAt: null },
    { id: 'a', lap: 1, s: 50, finishedAt: null },
    { id: 'f2', lap: 3, s: 0, finishedAt: 9000 },
    { id: 'b', lap: 1, s: 50, finishedAt: null },
    { id: 'f1', lap: 3, s: 0, finishedAt: 8000 },
    { id: 'd', lap: 1, s: 80, finishedAt: null },
  ]

  it('已過線依 finishedAt 升冪；未過線依 lap、s 降冪；同分依 id', () => {
    expect(rankCars(list)).toEqual(['f1', 'f2', 'c', 'd', 'a', 'b'])
  })

  it('輸入順序打亂結果不變', () => {
    const want = rankCars(list)
    for (let k = 0; k < 6; k++) {
      const shuffled = list.map((v, i) => ({ v, o: (i * 7 + k * 3) % 11 })).sort((x, y) => x.o - y.o).map((x) => x.v)
      expect(rankCars(shuffled)).toEqual(want)
    }
    expect(rankCars([...list].reverse())).toEqual(want)
  })

  it('不改動輸入', () => {
    const copy = list.map((x) => ({ ...x }))
    rankCars(list)
    expect(list).toEqual(copy)
  })
})

describe('findLongCurves — 可甩尾的長彎', () => {
  it('圓形賽道整圈都是同向長彎', () => {
    const t = makeTrack(circle(20, 16), 10)
    const z = findLongCurves(t, 1 / 30, 20)
    expect(z).toHaveLength(1)
    expect(z[0][1] - z[0][0]).toBeGreaterThan(t.len * 0.95)
  })

  it('方形的直角短彎不算長彎', () => {
    expect(findLongCurves(sq, 1 / 30, 20)).toEqual([])
  })
})

describe('makeCourse — 賽道資料（位置以沿線距離 s 表示，spec §1）', () => {
  const c = makeCourse({
    ctrl: SQUARE,
    width: 8,
    bound: { x: 60, z: 50 },
    pads: [{ s: 40, lateral: 2 }],
    jumps: [[80, 83]],
    itemRows: [16, 96],
  })

  it('資料原樣帶到 Course', () => {
    expect(c.itemRows).toEqual([16, 96])
    expect(c.jumps).toEqual([[80, 83]])
    expect(c.bound).toEqual({ x: 60, z: 50 })
  })

  it('加速帶附世界座標，回推得到同一個 s 與 lateral', () => {
    const p = c.pads[0]
    expect(p.s).toBe(40)
    const back = trackProgress(c.track, p.x, p.z)
    expect(back.s).toBeCloseTo(40, 3)
    expect(back.lateral).toBeCloseTo(2, 3)
  })

  it('沒給 driftZones 時以曲率自動找長彎；有給就原樣用', () => {
    expect(c.driftZones).toEqual(findLongCurves(c.track, LONG_CORNER_K, LONG_CORNER_MIN_LEN))
    const d = makeCourse({ ctrl: SQUARE, width: 8, bound: { x: 60, z: 60 }, pads: [], jumps: [], itemRows: [], driftZones: [[1, 2]] })
    expect(d.driftZones).toEqual([[1, 2]])
  })

  it('4 個起跑格：起點線後 5／9／13／17、左右交錯 ∓路寬/4、朝向沿線', () => {
    expect(c.grid).toHaveLength(4)
    c.grid.forEach((g, i) => {
      const p = trackProgress(c.track, g.x, g.z)
      expect(p.s).toBeCloseTo(c.track.len - 5 - 4 * i, 3)
      expect(p.lateral).toBeCloseTo(i % 2 ? 2 : -2, 3)
      expect(sectorOf(c.track, p.s)).toBe(CHECKPOINTS - 1)
      expect(g.ry).toBeCloseTo(pointAt(c.track, p.s).heading, 6)
    })
  })
})

describe('raceOver — 結算時機（AC6）', () => {
  it('還沒人過線：不結束', () => {
    expect(raceOver([null, null], null, 99999)).toBe(false)
  })

  it('全員過線即結束', () => {
    expect(raceOver([1000, 2000], 1000, 2000)).toBe(true)
  })

  it(`第一台過線後 ${FINISH_GRACE_MS}ms 內仍有人沒過：等；時間到：結束`, () => {
    expect(raceOver([1000, null], 1000, 1000 + FINISH_GRACE_MS - 1)).toBe(false)
    expect(raceOver([1000, null], 1000, 1000 + FINISH_GRACE_MS)).toBe(true)
  })

  it('空名單（全員斷線）不結束', () => {
    expect(raceOver([], null, 0)).toBe(false)
  })
})
