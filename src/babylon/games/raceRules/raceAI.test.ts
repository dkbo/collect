import { describe, it, expect } from 'vitest'
import {
  AI_ERR,
  decideRaceBot,
  makeBotMind,
  nextRand,
  stepBotMind,
  type BotInput,
  type BotMind,
} from '@/babylon/games/raceRules/raceAI'
import { MAX_SPEED, OFFTRACK_RESPAWN_MS, makeRacer, stepRacer, type RacerState } from '@/babylon/games/raceRules/drive'
import { RACE_COURSE, LONG_CORNERS } from '@/babylon/games/raceRules/trackData'
import { placeAt, sectorOf, type Course } from '@/babylon/games/raceRules/track'

const course: Course = RACE_COURSE
const { track } = course
/** 安靜的 bot：無雜訊、無失誤、道具延遲已過 */
const calm = (o: Partial<BotMind> = {}): BotMind => ({ ...makeBotMind(1), itemDelayMs: 0, heldMs: 0, ...o })

const input = (s: number, o: Partial<BotInput> = {}, lateral = 0, speed = 10): BotInput => {
  const p = placeAt(track, s, lateral)
  return {
    course,
    car: { x: p.x, z: p.z, ry: p.heading, speed },
    s,
    lateral,
    dist: s,
    item: null,
    others: [],
    shellChasing: false,
    mind: calm(),
    ...o,
  }
}

describe('nextRand — 可重現亂數', () => {
  it('同 seed 同序列、值落在 [0,1)', () => {
    let a = 42
    let b = 42
    for (let i = 0; i < 100; i++) {
      const [x, na] = nextRand(a)
      const [y, nb] = nextRand(b)
      expect(x).toBe(y)
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
      a = na
      b = nb
    }
  })
})

describe('decideRaceBot — 開車', () => {
  it('起跑直線、置中、朝前：油門全開、幾乎不轉', () => {
    const o = decideRaceBot(input(10))
    expect(o.throttle).toBe(1)
    expect(Math.abs(o.steer)).toBeLessThan(0.1)
    expect(o.drift).toBe(false)
  })

  it('前方 R≈10 的彎（T3，s≈328）全速逼近：收油（throttle 0）', () => {
    expect(decideRaceBot(input(310, {}, 0, MAX_SPEED)).throttle).toBe(0)
  })

  it('超過彎道目標速度 + 3：煞車', () => {
    expect(decideRaceBot(input(310, {}, 0, MAX_SPEED + 2)).throttle).toBe(-1)
  })

  it('晚煞車失誤：同一點還沒收油', () => {
    expect(decideRaceBot(input(310, { mind: calm({ lateBrake: true }) }, 0, MAX_SPEED)).throttle).toBe(1)
    expect(decideRaceBot(input(310, {}, 0, MAX_SPEED)).throttle).toBe(0)
  })

  it('左彎（T1）往左打方向（steer < 0）', () => {
    expect(decideRaceBot(input(80, {}, 0, 15)).steer).toBeLessThan(-0.1)
  })

  it('長彎內按住甩尾，彎前、出口前 6 以後、skipDrift 都不甩', () => {
    const t1 = LONG_CORNERS[0]
    expect(decideRaceBot(input(t1.s0, {}, 0, 15)).drift).toBe(true)
    expect(decideRaceBot(input(t1.s0 - 10, {}, 0, 15)).drift).toBe(false)
    expect(decideRaceBot(input(t1.s1 - 5, {}, 0, 15)).drift).toBe(false)
    expect(decideRaceBot(input(t1.s0, { mind: calm({ skipDrift: true }) }, 0, 15)).drift).toBe(false)
  })

  it('跨起點的長彎 span（s1 > len、或進彎提前量使 s0 < 0）用 inSpan 判定', () => {
    const L = track.len
    const across: Course = { ...course, driftZones: [[L - 20, L + 30]] }
    expect(decideRaceBot(input(5, { course: across }, 0, 15)).drift).toBe(true)
    expect(decideRaceBot(input(L - 10, { course: across }, 0, 15)).drift).toBe(true)
    expect(decideRaceBot(input(30, { course: across }, 0, 15)).drift).toBe(false)
    const nearStart: Course = { ...course, driftZones: [[1, 40]] }
    expect(decideRaceBot(input(L - 2, { course: nearStart }, 0, 15)).drift).toBe(true)
    expect(decideRaceBot(input(L - 10, { course: nearStart }, 0, 15)).drift).toBe(false)
  })

  it('不在長彎（T3）不甩尾', () => {
    expect(decideRaceBot(input(325, {}, 0, 12)).drift).toBe(false)
  })

  it('走大線失誤：目標點往彎外偏，轉向比平常小', () => {
    const normal = decideRaceBot(input(80, {}, 0, 15)).steer
    const wide = decideRaceBot(input(80, { mind: calm({ mistakeMs: 500 }) }, 0, 15)).steer
    expect(wide).toBeGreaterThan(normal)
  })
})

describe('decideRaceBot — 道具使用條件（spec §2.3）', () => {
  const me = 200
  const use = (o: Partial<BotInput>, s = me) => decideRaceBot(input(s, { dist: s, ...o })).useItem

  it('香蕉：後方 0 < Δs ≤ 12 且 |Δlateral| ≤ 3 有車才丟；或持有超過 8 秒', () => {
    expect(use({ item: 'banana', others: [{ dist: me - 8, lateral: 1 }] })).toBe(true)
    expect(use({ item: 'banana', others: [{ dist: me - 14, lateral: 0 }] })).toBe(false)
    expect(use({ item: 'banana', others: [{ dist: me - 8, lateral: 4 }] })).toBe(false)
    expect(use({ item: 'banana', others: [{ dist: me + 8, lateral: 0 }] })).toBe(false)
    expect(use({ item: 'banana', mind: calm({ heldMs: 8001 }) })).toBe(true)
  })

  it('龜殼：前一名在 40 內才射；第 1 名時前方 20 內有（被套圈的）車才直射', () => {
    expect(use({ item: 'shell', others: [{ dist: me + 30, lateral: 0 }, { dist: me + 90, lateral: 0 }] })).toBe(true)
    expect(use({ item: 'shell', others: [{ dist: me + 50, lateral: 0 }] })).toBe(false)
    expect(use({ item: 'shell', others: [{ dist: me + 15 - track.len, lateral: 0 }] })).toBe(true)
    expect(use({ item: 'shell', others: [{ dist: me - 30, lateral: 0 }] })).toBe(false)
  })

  it('加速菇：前方 25 內是直線才用', () => {
    expect(use({ item: 'mushroom' }, 10)).toBe(true)
    expect(use({ item: 'mushroom' }, 60)).toBe(false)
  })

  it('護盾：延遲到了就開；延遲未到但有龜殼在追立刻開', () => {
    expect(use({ item: 'shield' })).toBe(true)
    expect(use({ item: 'shield', mind: calm({ itemDelayMs: 1000, heldMs: 100 }) })).toBe(false)
    expect(use({ item: 'shield', shellChasing: true, mind: calm({ itemDelayMs: 1000, heldMs: 100 }) })).toBe(true)
  })

  it('撿到後未滿 itemDelayMs 不用；沒道具永遠 false', () => {
    expect(use({ item: 'mushroom', mind: calm({ itemDelayMs: 1000, heldMs: 500 }) }, 10)).toBe(false)
    expect(use({ item: null }, 10)).toBe(false)
  })
})

describe('stepBotMind — 失誤與道具計時（全由 seed 決定）', () => {
  it('同 seed 同輸入 → 同結果', () => {
    let a = makeBotMind(7)
    let b = makeBotMind(7)
    for (let i = 0; i < 300; i++) {
      a = stepBotMind(a, { sector: Math.floor(i / 40) % 8, item: i > 100 ? 'banana' : null }, 33)
      b = stepBotMind(b, { sector: Math.floor(i / 40) % 8, item: i > 100 ? 'banana' : null }, 33)
    }
    expect(a).toEqual(b)
  })

  it('撿到道具：heldMs 從 0 起算，itemDelayMs 落在 spec 範圍', () => {
    let m = stepBotMind(makeBotMind(3), { sector: 0, item: 'shell' }, 33)
    expect(m.held).toBe('shell')
    expect(m.heldMs).toBe(0)
    expect(m.itemDelayMs).toBeGreaterThanOrEqual(AI_ERR.itemDelayMs[0])
    expect(m.itemDelayMs).toBeLessThanOrEqual(AI_ERR.itemDelayMs[1])
    m = stepBotMind(m, { sector: 0, item: 'shell' }, 100)
    expect(m.heldMs).toBe(100)
  })

  it('長時間下失誤觸發率約 mistakeRatePerSec（±50%）', () => {
    let m = makeBotMind(11)
    let starts = 0
    const secs = 2000
    for (let i = 0; i < secs * 10; i++) {
      const before = m.mistakeMs
      m = stepBotMind(m, { sector: 0, item: null }, 100)
      if (before === 0 && m.mistakeMs > 0) starts++
    }
    expect(starts).toBeGreaterThan(secs * AI_ERR.mistakeRatePerSec * 0.5)
    expect(starts).toBeLessThan(secs * AI_ERR.mistakeRatePerSec * 1.5)
  })

  it('進新的檢查點區才重擲 lateBrake／skipDrift', () => {
    const m0 = makeBotMind(5)
    const same = stepBotMind(m0, { sector: m0.sector, item: null }, 33)
    expect([same.lateBrake, same.skipDrift]).toEqual([m0.lateBrake, m0.skipDrift])
    expect(stepBotMind(m0, { sector: (m0.sector + 1) % 8, item: null }, 33).sector).toBe((m0.sector + 1) % 8)
  })
})

describe('bot 開出路面：3 秒內回到路面或觸發重生（AC5）', () => {
  const cases: [string, number, number, number][] = [
    ['直線外側、朝前', 30, 9, 0],
    ['直線外側、背對賽道', 30, 10, Math.PI / 2],
    ['彎道外側、逆向', 90, -10, Math.PI],
    ['髮夾內側', 240, -9, -Math.PI / 2],
  ]
  for (const [name, s, lateral, dry] of cases) {
    it(name, () => {
      const p = placeAt(track, s, lateral)
      let r: RacerState = { ...makeRacer(course, 0), car: { x: p.x, z: p.z, ry: p.heading + dry, speed: 8 }, s, lateral, lap: { lap: 0, cp: sectorOf(track, s) } }
      let mind = makeBotMind(9)
      let ok = false
      for (let i = 0; i < (OFFTRACK_RESPAWN_MS / 1000) * 30 + 2 && !ok; i++) {
        mind = stepBotMind(mind, { sector: sectorOf(track, r.s), item: null }, 1000 / 30)
        const o = decideRaceBot({ course, car: r.car, s: r.s, lateral: r.lateral, dist: r.s, item: null, others: [], shellChasing: false, mind })
        const out = stepRacer(r, { throttle: o.throttle, steer: o.steer, drifting: o.drift }, { course, others: [] }, 1 / 30)
        r = out.state
        ok = out.events.includes('respawn') || Math.abs(r.lateral) <= track.width / 2
      }
      expect(ok).toBe(true)
    })
  }
})

describe('bot 跑完整一圈（整合）', () => {
  it('單一 bot 在 60 秒內依序過完 8 個檢查點完成一圈，且不靠重生', () => {
    let r = makeRacer(course, 0)
    let mind = makeBotMind(21)
    let respawns = 0
    let t = 0
    for (; t < 60 * 30 && r.lap.lap < 1; t++) {
      mind = stepBotMind(mind, { sector: sectorOf(track, r.s), item: null }, 1000 / 30)
      const o = decideRaceBot({ course, car: r.car, s: r.s, lateral: r.lateral, dist: r.s, item: null, others: [], shellChasing: false, mind })
      const out = stepRacer(r, { throttle: o.throttle, steer: o.steer, drifting: o.drift }, { course, others: [] }, 1 / 30)
      r = out.state
      if (out.events.includes('respawn')) respawns++
    }
    expect(r.lap.lap).toBe(1)
    expect(respawns).toBe(0)
    expect(t / 30).toBeLessThan(50)
  })
})
