import { describe, it, expect } from 'vitest'
import {
  BOOST_SPEED,
  DRIFT_TIERS,
  MAX_REVERSE,
  MAX_SPEED,
  MINI_TURBO_MS,
  OFFTRACK_FACTOR,
  OFFTRACK_RESPAWN_MS,
  RESPAWN_GHOST_MS,
  SLIP_BOOST_MS,
  SLIP_CHARGE_MS,
  SLIP_CONE_DEG,
  SLIP_SPEED_MULT,
  STUCK_MS,
  JUMP_G,
  JUMP_H,
  JUMP_MIN_SPEED,
  RAMP_HALF_W,
  jumpY,
  launchVy,
  rampY,
  makeRacer,
  pushApart,
  respawnPose,
  shouldRespawn,
  slipCharge,
  stepCar,
  stepDrift,
  stepRacer,
  type CarPhys,
  type DriftState,
  type RacerState,
} from '@/babylon/games/raceRules/drive'
import { CHECKPOINTS, makeCourse, pointAt, type Vec2 } from '@/babylon/games/raceRules/track'

/** 置中的 40×40 方形賽道，起點 (0,−20) 朝 +x */
const CTRL: Vec2[] = (
  [
    [20, 0], [30, 0], [40, 0], [40, 10], [40, 20], [40, 30], [40, 40], [30, 40],
    [20, 40], [10, 40], [0, 40], [0, 30], [0, 20], [0, 10], [0, 0], [10, 0],
  ] as Vec2[]
).map(([x, z]) => [x - 20, z - 20] as Vec2)
const course = makeCourse({ ctrl: CTRL, width: 8, bound: { x: 40, z: 40 }, pads: [{ s: 8, lateral: 0 }], jumps: [[86, 92]], itemRows: [] })
const track = course.track

describe('stepDrift — 甩尾蓄力', () => {
  const dt = 0.25 // 二進位精確，避免累加誤差
  const hold = (secs: number, steer = 1, speed = 10) => {
    let d: DriftState = { charge: 0, tier: 0 }
    for (let i = 0; i < secs / dt; i++) d = stepDrift(d, { drifting: true, steer, speed }, dt).state
    return d
  }

  it(`三段門檻 ${DRIFT_TIERS.join('／')} 秒對應段位 1／2／3`, () => {
    expect(hold(0.5).tier).toBe(0)
    expect(hold(0.75).tier).toBe(1)
    expect(hold(1.25).tier).toBe(2)
    expect(hold(1.75).tier).toBe(2)
    expect(hold(2).tier).toBe(3)
    expect(hold(5).tier).toBe(3)
  })

  it('放開給對應段位的加速 ms，並歸零', () => {
    for (const [secs, want] of [[0.5, 0], [0.75, MINI_TURBO_MS[0]], [1.25, MINI_TURBO_MS[1]], [2, MINI_TURBO_MS[2]]]) {
      const r = stepDrift(hold(secs), { drifting: false, steer: 1, speed: 10 }, dt)
      expect(r.turboMs).toBe(want)
      expect(r.state).toEqual({ charge: 0, tier: 0 })
    }
  })

  it('未轉向不蓄力（保留已蓄的量）', () => {
    expect(hold(3, 0)).toEqual({ charge: 0, tier: 0 })
    const half = hold(0.75)
    expect(stepDrift(half, { drifting: true, steer: 0, speed: 10 }, dt).state).toEqual(half)
  })

  it('速度不足蓄力取消、不給加速', () => {
    expect(hold(3, 1, 5)).toEqual({ charge: 0, tier: 0 })
    const r = stepDrift(hold(2), { drifting: true, steer: 1, speed: 4 }, dt)
    expect(r).toEqual({ state: { charge: 0, tier: 0 }, turboMs: 0 })
  })
})

describe('slipCharge — 尾流', () => {
  const self = { x: 0, z: 0, ry: 0, speed: 15 } // 朝 +z
  const run = (others: { x: number; z: number }[], ms: number, s = self) => {
    let st = { ms: 0, slipMs: 0 }
    let got = 0
    for (let t = 0; t < ms; t += 100) {
      st = slipCharge(st.ms, s, others, 100)
      if (st.slipMs) got = st.slipMs
    }
    return got
  }

  it(`前方 6 單位、${SLIP_CONE_DEG}° 內持續 ${SLIP_CHARGE_MS}ms 給 ${SLIP_BOOST_MS}ms`, () => {
    expect(run([{ x: 0, z: 5 }], SLIP_CHARGE_MS - 100)).toBe(0)
    expect(run([{ x: 0, z: 5 }], SLIP_CHARGE_MS)).toBe(SLIP_BOOST_MS)
    const a = (14 * Math.PI) / 180
    expect(run([{ x: Math.sin(a) * 5.9, z: Math.cos(a) * 5.9 }], SLIP_CHARGE_MS)).toBe(SLIP_BOOST_MS)
  })

  it('太遠、角度太大、在後方或自己太慢都不累計', () => {
    const a = ((SLIP_CONE_DEG + 1) * Math.PI) / 180
    expect(run([{ x: 0, z: 6.5 }], 3000)).toBe(0)
    expect(run([{ x: Math.sin(a) * 4, z: Math.cos(a) * 4 }], 3000)).toBe(0)
    expect(run([{ x: 0, z: -3 }], 3000)).toBe(0)
    expect(run([{ x: 0, z: 4 }], 3000, { ...self, speed: 3 })).toBe(0)
  })

  it('夾角門檻放寬為 25°（波 2 qa 實測 15° 鍵盤難觸發）：24° 內累計、26° 外不累計', () => {
    expect(SLIP_CONE_DEG).toBe(25)
    const at = (deg: number) => {
      const a = (deg * Math.PI) / 180
      return [{ x: Math.sin(a) * 5, z: Math.cos(a) * 5 }]
    }
    expect(run(at(24), SLIP_CHARGE_MS)).toBe(SLIP_BOOST_MS)
    expect(run(at(-24), SLIP_CHARGE_MS)).toBe(SLIP_BOOST_MS)
    expect(run(at(26), 3000)).toBe(0)
  })

  it('前車朝向與自己夾角 > 90°（迎面）不累計；≤ 90° 照常；沒給 ry 維持舊行為', () => {
    const ahead = (ry?: number) => [{ x: 0, z: 5, ry }]
    expect(run(ahead(Math.PI), 3000)).toBe(0)
    expect(run(ahead(-Math.PI * 0.6), 3000)).toBe(0)
    expect(run(ahead(0), SLIP_CHARGE_MS)).toBe(SLIP_BOOST_MS)
    expect(run(ahead(Math.PI / 2), SLIP_CHARGE_MS)).toBe(SLIP_BOOST_MS)
    expect(run(ahead(Math.PI * 2 - 0.3), SLIP_CHARGE_MS)).toBe(SLIP_BOOST_MS)
    expect(run(ahead(), SLIP_CHARGE_MS)).toBe(SLIP_BOOST_MS)
  })

  it('中途離開條件即歸零', () => {
    let st = slipCharge(0, self, [{ x: 0, z: 5 }], 1000)
    expect(st.ms).toBe(1000)
    st = slipCharge(st.ms, self, [], 100)
    expect(st.ms).toBe(0)
  })
})

describe('shouldRespawn／respawnPose — 出界與卡住', () => {
  const t0 = { stuckMs: 0, offMs: 0 }
  const run = (input: { speed: number; offTrack: boolean; throttle: boolean }, ms: number) => {
    let t = t0
    let respawn = false
    for (let i = 0; i < ms / 100; i++) {
      const r = shouldRespawn(t, input, 100)
      t = r.timer
      respawn ||= r.respawn
    }
    return respawn
  }

  it(`離開賽道超過 ${OFFTRACK_RESPAWN_MS}ms 重生`, () => {
    expect(run({ speed: 5, offTrack: true, throttle: true }, OFFTRACK_RESPAWN_MS - 100)).toBe(false)
    expect(run({ speed: 5, offTrack: true, throttle: true }, OFFTRACK_RESPAWN_MS)).toBe(true)
  })

  it(`踩油門但速度 < 1 持續 ${STUCK_MS}ms 重生；沒踩油門（停著不動）不算卡住`, () => {
    expect(run({ speed: 0.5, offTrack: false, throttle: true }, STUCK_MS - 100)).toBe(false)
    expect(run({ speed: 0.5, offTrack: false, throttle: true }, STUCK_MS)).toBe(true)
    expect(run({ speed: 0, offTrack: false, throttle: false }, STUCK_MS * 3)).toBe(false)
  })

  it('出界立即重生', () => {
    expect(shouldRespawn(t0, { speed: 10, offTrack: true, throttle: true, outOfBounds: true }, 16).respawn).toBe(true)
  })

  it('放回最後通過的檢查點中心、朝向沿線', () => {
    for (let cp = 0; cp < CHECKPOINTS; cp++) {
      const want = pointAt(track, track.checkpoints[cp])
      const p = respawnPose(track, { lap: 1, cp })
      expect(p.x).toBeCloseTo(want.x, 6)
      expect(p.z).toBeCloseTo(want.z, 6)
      expect(p.ry).toBeCloseTo(want.heading, 6)
    }
  })
})

describe('stepCar — 基準運動學', () => {
  const car: CarPhys = { x: 0, z: 0, ry: 0, speed: 0 }
  const mods = { onTrack: true, boosting: false, slipping: false, spinning: false }
  const drive = (m = mods, secs = 5, throttle = 1) => {
    let c = car
    for (let i = 0; i < secs * 30; i++) c = stepCar(c, { throttle, steer: 0, drifting: false }, m, 1 / 30)
    return c
  }

  it('ry 環繞到 (−π, π]：一直右轉多圈不累積大值，位置與不環繞時相同', () => {
    let c: CarPhys = { x: 0, z: 0, ry: Math.PI - 0.01, speed: 10 }
    const step = (p: CarPhys) => stepCar(p, { throttle: 0, steer: 1, drifting: false }, mods, 0.1)
    const first = step(c)
    expect(first.ry).toBeLessThanOrEqual(Math.PI)
    expect(first.ry).toBeGreaterThan(-Math.PI)
    for (let i = 0; i < 300; i++) {
      c = step(c)
      expect(c.ry).toBeLessThanOrEqual(Math.PI)
      expect(c.ry).toBeGreaterThan(-Math.PI)
    }
    const left = stepCar({ x: 0, z: 0, ry: -Math.PI + 0.01, speed: 10 }, { throttle: 0, steer: -1, drifting: false }, mods, 0.1)
    expect(left.ry).toBeGreaterThan(-Math.PI)
    expect(left.ry).toBeLessThanOrEqual(Math.PI)
    // 環繞只改表示法：位移仍依原本轉過的角度
    expect(first.x).toBeCloseTo(Math.sin(first.ry) * first.speed * 0.1, 9)
    expect(first.z).toBeCloseTo(Math.cos(first.ry) * first.speed * 0.1, 9)
  })

  it('油門到底收斂到 MAX_SPEED，沿朝向前進', () => {
    const c = drive()
    expect(c.speed).toBeCloseTo(MAX_SPEED, 6)
    expect(c.x).toBeCloseTo(0, 6)
    expect(c.z).toBeGreaterThan(50)
  })

  it('路面外上限 MAX_SPEED × OFFTRACK_FACTOR', () => {
    expect(drive({ ...mods, onTrack: false }).speed).toBeCloseTo(MAX_SPEED * OFFTRACK_FACTOR, 6)
  })

  it(`尾流上限 ×${SLIP_SPEED_MULT}、加速中上限 BOOST_SPEED`, () => {
    expect(drive({ ...mods, slipping: true }).speed).toBeCloseTo(MAX_SPEED * SLIP_SPEED_MULT, 6)
    expect(drive({ ...mods, boosting: true }, 2).speed).toBeCloseTo(BOOST_SPEED, 6)
  })

  it('加速中開到路面外：上限仍乘 OFFTRACK_FACTOR（不能靠加速全速切內野）', () => {
    expect(drive({ ...mods, boosting: true, onTrack: false }, 2).speed).toBeCloseTo(BOOST_SPEED * OFFTRACK_FACTOR, 6)
    const c = stepCar({ ...car, speed: MAX_SPEED }, { throttle: 1, steer: 0, drifting: false }, { ...mods, boosting: true, onTrack: false }, 1 / 30)
    expect(c.speed).toBeLessThan(MAX_SPEED)
  })

  it('加速結束後超速逐步降回上限（不瞬間掉）', () => {
    const fast = { ...car, speed: BOOST_SPEED }
    const c = stepCar(fast, { throttle: 1, steer: 0, drifting: false }, mods, 1 / 30)
    expect(c.speed).toBeLessThan(BOOST_SPEED)
    expect(c.speed).toBeGreaterThan(MAX_SPEED)
  })

  it('倒車上限 MAX_REVERSE', () => {
    expect(drive(mods, 5, -1).speed).toBeCloseTo(-MAX_REVERSE, 6)
  })

  it('打滑中不能轉向、速度衰減', () => {
    const c = stepCar({ ...car, speed: 15 }, { throttle: 1, steer: 1, drifting: false }, { ...mods, spinning: true }, 0.1)
    expect(c.ry).toBe(0)
    expect(c.speed).toBeLessThan(15)
  })

  it('轉向：steer 正 → ry 增加（右轉）', () => {
    const c = stepCar({ ...car, speed: 15 }, { throttle: 1, steer: 1, drifting: false }, mods, 0.1)
    expect(c.ry).toBeGreaterThan(0)
  })
})

describe('pushApart — 只推開自己', () => {
  it('重疊時沿連線推離對方，對方不動', () => {
    const me = { x: 0, z: 0 }
    const other = { x: 1, z: 0 }
    const p = pushApart(me, [other], 0.1)
    expect(p.x).toBeLessThan(0)
    expect(p.z).toBeCloseTo(0, 9)
    expect(other).toEqual({ x: 1, z: 0 })
  })

  it('距離夠遠不推', () => {
    expect(pushApart({ x: 0, z: 0 }, [{ x: 3, z: 0 }], 0.1)).toEqual({ x: 0, z: 0 })
  })
})

describe('jumpY／launchVy／rampY — 跳台（spec §1.4）', () => {
  it('從唇口 JUMP_H 起跳的拋物線，落地後夾在 0', () => {
    const vy = launchVy(MAX_SPEED)
    expect(vy).toBeCloseTo(4 + 0.25 * MAX_SPEED, 9)
    expect(jumpY(0, vy)).toBeCloseTo(JUMP_H, 9)
    const top = vy / JUMP_G
    expect(jumpY(top, vy)).toBeCloseTo(JUMP_H + (vy * vy) / (2 * JUMP_G), 9)
    expect(jumpY(5, vy)).toBe(0)
  })

  it('斜坡上 y 隨 s 線性升到 JUMP_H；坡外或偏出坡寬為 0', () => {
    const [s0, s1] = course.jumps[0]
    expect(rampY(course, s0, 0)).toBeCloseTo(0, 9)
    expect(rampY(course, (s0 + s1) / 2, 0)).toBeCloseTo(JUMP_H / 2, 9)
    expect(rampY(course, s1, 1)).toBeCloseTo(JUMP_H, 9)
    expect(rampY(course, s1 + 1, 0)).toBe(0)
    expect(rampY(course, (s0 + s1) / 2, RAMP_HALF_W + 0.1)).toBe(0)
  })
})

describe('stepRacer — 整台車一個 tick', () => {
  const at = (r: RacerState, s: number, speed = 10): RacerState => {
    const p = pointAt(track, s)
    return { ...r, s, lateral: 0, car: { ...r.car, x: p.x, z: p.z, ry: p.heading, speed } }
  }
  const tick = (r: RacerState, input = { throttle: 1, steer: 0, drifting: false }, others: { x: number; z: number }[] = []) =>
    stepRacer(r, input, { course, others }, 1 / 30)

  it('起跑格開局：lap 0、cp 0、沒有事件', () => {
    const r0 = makeRacer(course, 0)
    expect(r0.lap).toEqual({ lap: 0, cp: 0 })
    expect(r0.car).toMatchObject({ x: course.grid[0].x, z: course.grid[0].z, ry: course.grid[0].ry, speed: 0 })
    expect(tick(r0).events).toEqual([])
  })

  it('依序經過每一區回到起點：發 lap 事件', () => {
    let r = makeRacer(course, 0)
    const events: string[] = []
    for (let k = 1; k <= CHECKPOINTS; k++) {
      const out = tick(at(r, track.checkpoints[k % CHECKPOINTS] + 0.5))
      r = out.state
      events.push(...out.events)
    }
    expect(r.lap).toEqual({ lap: 1, cp: 0 })
    expect(events.filter((e) => e === 'lap')).toHaveLength(1)
  })

  it('壓到加速帶：發 pad 事件並取得加速，停在上面不重複觸發', () => {
    const r = at(makeRacer(course, 0), course.pads[0].s - 0.3)
    const a = tick(r)
    expect(a.events).toContain('pad')
    expect(a.state.boostMs).toBeGreaterThan(0)
    expect(tick(a.state).events).not.toContain('pad')
  })

  it('全速衝過跳台：坡上升高 → jump → 騰空高於唇口 → land、y 歸 0', () => {
    let r = at(makeRacer(course, 0), course.jumps[0][0] - 2, MAX_SPEED)
    const events: string[] = []
    let maxY = 0
    for (let i = 0; i < 90 && !events.includes('land'); i++) {
      const out = tick(at(r, r.s, MAX_SPEED)) // 每 tick 拉回中心線、維持全速
      r = out.state
      events.push(...out.events)
      maxY = Math.max(maxY, r.y)
    }
    expect(events.filter((e) => e === 'jump')).toHaveLength(1)
    expect(events).toContain('land')
    expect(maxY).toBeGreaterThan(JUMP_H)
    expect(r.y).toBe(0)
  })

  it(`速度 < ${JUMP_MIN_SPEED} 沿斜坡下來不騰空`, () => {
    let r = at(makeRacer(course, 0), course.jumps[0][0] - 1, JUMP_MIN_SPEED - 1)
    const events: string[] = []
    for (let i = 0; i < 90; i++) {
      const out = tick(at(r, r.s, JUMP_MIN_SPEED - 1))
      r = out.state
      events.push(...out.events)
    }
    expect(events).not.toContain('jump')
    expect(r.s).toBeGreaterThan(course.jumps[0][1])
  })

  it('開出路面不回來：最多 OFFTRACK_RESPAWN_MS 後重生到檢查點、進入 ghost', () => {
    const base = at(makeRacer(course, 0), track.checkpoints[2] + 3, 0)
    let r: RacerState = { ...base, lap: { lap: 0, cp: 2 }, car: { ...base.car, x: 0, z: 0, speed: 0 } } // 場中央草地
    let respawned = false
    for (let i = 0; i < (OFFTRACK_RESPAWN_MS / 1000) * 30 + 2 && !respawned; i++) {
      const out = tick(r, { throttle: 0, steer: 0, drifting: false })
      r = out.state
      respawned = out.events.includes('respawn')
    }
    expect(respawned).toBe(true)
    const cp = pointAt(track, track.checkpoints[2])
    expect(r.car.x).toBeCloseTo(cp.x, 6)
    expect(r.car.z).toBeCloseTo(cp.z, 6)
    expect(r.car.speed).toBe(0)
    expect(r.ghostMs).toBe(RESPAWN_GHOST_MS)
  })

  it('甩尾放開：發 turbo 事件、boostMs = 對應段位', () => {
    let r = makeRacer(course, 0)
    // 每 tick 拉回直線上同一點，只看蓄力狀態（避免車開出路面掉速）
    for (let i = 0; i < 40; i++) r = tick(at(r, 2, 12), { throttle: 1, steer: 1, drifting: true }).state
    expect(r.drift.tier).toBeGreaterThanOrEqual(1)
    const tier = r.drift.tier
    const out = tick(r, { throttle: 1, steer: 0, drifting: false })
    expect(out.events).toContain('turbo')
    expect(out.state.boostMs).toBeGreaterThanOrEqual(MINI_TURBO_MS[tier - 1] - 40)
  })

  it('打滑中按甩尾不蓄力', () => {
    let r: RacerState = { ...at(makeRacer(course, 0), 2, 12), spinMs: 800 }
    for (let i = 0; i < 20; i++) r = tick(r, { throttle: 1, steer: 1, drifting: true }).state
    expect(r.drift).toEqual({ charge: 0, tier: 0 })
  })

  it('計時器隨 tick 遞減、不低於 0', () => {
    const r: RacerState = { ...at(makeRacer(course, 0), 2), spinMs: 10, shieldMs: 1000, ghostMs: 20 }
    const s = tick(r).state
    expect(s.spinMs).toBe(0)
    expect(s.shieldMs).toBeCloseTo(1000 - 1000 / 30, 6)
    expect(s.ghostMs).toBe(0)
  })
})
