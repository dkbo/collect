/**
 * 賽車手感（純函式，不依賴 Babylon）：基準運動學、甩尾蓄力、尾流、推擠、出界重生、跳台。
 * 自己的車與 host 的 bot 用同一套 stepRacer，規則只有一份。
 * 時間參數：名為 dt 的是秒，名為 *Ms 的是毫秒。
 */
import {
  LAPS,
  advanceLap,
  inSpan,
  pointAt,
  sectorOf,
  stepWrongWay,
  trackProgress,
  wrapAngle,
  type Course,
  type LapState,
  type Track,
} from '@/babylon/games/raceRules/track'

// 基準運動學（沿用舊 race.ts 數值）
export const MAX_SPEED = 17
export const MAX_REVERSE = 5
export const ACCEL = 13
export const BRAKE = 22
export const DRAG = 4.5
export const TURN_RATE = 2.4
export const OFFTRACK_FACTOR = 0.3
export const DRIFT_TURN_MULT = 1.8
export const DRIFT_DRAG = 2.0
export const CAR_PUSH_DIST = 1.4
export const CAR_PUSH_FORCE = 6
export const BOOST_SPEED = 22
export const BOOST_DURATION_MS = 1500

/** 加速中往 BOOST_SPEED 拉的加速度 */
export const BOOST_ACCEL = 30
/** 超過上限時每秒降多少（路面上／路面外） */
export const OVERSPEED_DECAY = 8
export const OFFTRACK_DECAY = 30
/** 打滑時每秒減速 */
export const SPIN_DECEL = 20

// 甩尾蓄力
export const DRIFT_MIN_SPEED = 6
export const DRIFT_TIERS = [0.6, 1.2, 2.0] as const
export const MINI_TURBO_MS = [500, 900, 1300] as const
/** |steer| 超過此值才算「轉向中」 */
export const DRIFT_STEER_MIN = 0.2

// 尾流
export const SLIP_DIST = 6
export const SLIP_CONE_DEG = 25
export const SLIP_CHARGE_MS = 1200
export const SLIP_BOOST_MS = 1000
export const SLIP_SPEED_MULT = 1.15
export const SLIP_MIN_SPEED = 6

// 重生
export const STUCK_MS = 2000
export const STUCK_SPEED = 1
export const OFFTRACK_RESPAWN_MS = 3000
export const RESPAWN_GHOST_MS = 1500

// 加速帶（spec §1.5：賽道座標的矩形，沿線半長、橫向半寬）
export const PAD_HALF_LEN = 2
export const PAD_HALF_W = 1.6

// 跳台（spec §1.4）：斜坡唇口高、坡半寬、起跳最低速、重力；起跳 vy = JUMP_VY0 + JUMP_VY_K·speed
export const JUMP_H = 1.1
export const RAMP_HALF_W = 4
export const JUMP_MIN_SPEED = 6
export const JUMP_G = 30
export const JUMP_VY0 = 4
export const JUMP_VY_K = 0.25

export interface CarPhys {
  x: number
  z: number
  ry: number
  speed: number
}

/** throttle −1..1（負為煞車／倒車），steer −1..1（正 = 右轉、ry 增加） */
export interface DriveInput {
  throttle: number
  steer: number
  drifting: boolean
}

export interface DriveMods {
  onTrack: boolean
  boosting: boolean
  slipping: boolean
  spinning: boolean
}

/** charge 為已蓄秒數，tier 0..3（0 = 未達第一段） */
export interface DriftState {
  charge: number
  tier: 0 | 1 | 2 | 3
}

export interface RespawnTimer {
  stuckMs: number
  offMs: number
}

const NO_DRIFT: DriftState = { charge: 0, tier: 0 }

/** 一個 tick 的車體運動學（不含推擠、出界判定） */
export function stepCar(c: CarPhys, input: DriveInput, mods: DriveMods, dt: number): CarPhys {
  let speed = c.speed
  let ry = c.ry
  if (mods.spinning) {
    speed -= Math.sign(speed) * Math.min(SPIN_DECEL * dt, Math.abs(speed))
  } else {
    const th = Math.max(-1, Math.min(1, input.throttle))
    if (th > 0) speed += ACCEL * th * dt
    else if (th < 0) speed -= (speed > 0 ? BRAKE : ACCEL) * -th * dt
    else speed -= Math.sign(speed) * Math.min(DRAG * dt, Math.abs(speed))
    if (mods.boosting && speed < BOOST_SPEED) speed = Math.min(BOOST_SPEED, speed + BOOST_ACCEL * dt)
  }
  // 路面外降速對加速中也成立（AC3），否則加速可全速切內野
  const cap =
    (mods.boosting ? BOOST_SPEED : MAX_SPEED * (mods.slipping ? SLIP_SPEED_MULT : 1)) *
    (mods.onTrack ? 1 : OFFTRACK_FACTOR)
  // 本來就在上限內 → 直接夾住；從加速等狀態超速 → 逐步降回，不讓油門再往上推
  if (speed > cap) {
    speed = c.speed > cap ? Math.max(cap, Math.min(speed, c.speed - (mods.onTrack ? OVERSPEED_DECAY : OFFTRACK_DECAY) * dt)) : cap
  }
  speed = Math.max(-MAX_REVERSE, speed)

  const steer = Math.max(-1, Math.min(1, input.steer))
  if (!mods.spinning && steer !== 0 && Math.abs(speed) > 0.3) {
    const f = Math.min(1, Math.abs(speed) / (MAX_SPEED * 0.5)) * Math.sign(speed)
    ry = wrapAngle(ry + steer * TURN_RATE * (input.drifting ? DRIFT_TURN_MULT : 1) * f * dt)
  }
  if (!mods.spinning && input.drifting && Math.abs(speed) > 2) {
    speed -= Math.sign(speed) * Math.min(DRIFT_DRAG * 0.3 * dt, Math.abs(speed))
  }
  return { x: c.x + Math.sin(ry) * speed * dt, z: c.z + Math.cos(ry) * speed * dt, ry, speed }
}

/**
 * 甩尾蓄力：按住甩尾、轉向中、速度 > DRIFT_MIN_SPEED 才累積；沒轉向時保留已蓄量；
 * 掉到 DRIFT_MIN_SPEED 以下取消；放開時依段位給 MINI_TURBO_MS。
 */
export function stepDrift(
  d: DriftState,
  input: { drifting: boolean; steer: number; speed: number },
  dt: number
): { state: DriftState; turboMs: number } {
  if (!input.drifting) return { state: NO_DRIFT, turboMs: d.tier > 0 ? MINI_TURBO_MS[d.tier - 1] : 0 }
  if (input.speed <= DRIFT_MIN_SPEED) return { state: NO_DRIFT, turboMs: 0 }
  if (Math.abs(input.steer) <= DRIFT_STEER_MIN) return { state: d, turboMs: 0 }
  const charge = d.charge + dt
  const tier = DRIFT_TIERS.filter((t) => charge >= t).length as DriftState['tier']
  return { state: { charge, tier }, turboMs: 0 }
}

/**
 * 尾流：前方 SLIP_DIST 內、夾角 ≤ SLIP_CONE_DEG 有車且自己夠快才累積；滿 SLIP_CHARGE_MS 給 SLIP_BOOST_MS 並歸零。
 * 前車有給 ry 時，它的朝向與自己夾角須 ≤ 90°（迎面車不算）。
 */
export function slipCharge(
  ms: number,
  self: { x: number; z: number; ry: number; speed: number },
  others: readonly { x: number; z: number; ry?: number }[],
  dtMs: number
): { ms: number; slipMs: number } {
  const cosCone = Math.cos((SLIP_CONE_DEG * Math.PI) / 180)
  const fx = Math.sin(self.ry)
  const fz = Math.cos(self.ry)
  const inCone =
    self.speed > SLIP_MIN_SPEED &&
    others.some((o) => {
      const dx = o.x - self.x
      const dz = o.z - self.z
      const d = Math.hypot(dx, dz)
      const sameWay = o.ry === undefined || Math.cos(o.ry - self.ry) >= 0
      return d > 0.01 && d <= SLIP_DIST && (dx * fx + dz * fz) / d >= cosCone && sameWay
    })
  if (!inCone) return { ms: 0, slipMs: 0 }
  const next = ms + dtMs
  return next >= SLIP_CHARGE_MS ? { ms: 0, slipMs: SLIP_BOOST_MS } : { ms: next, slipMs: 0 }
}

/**
 * 重生判定：出界立即；離開賽道累計 ≥ OFFTRACK_RESPAWN_MS；
 * 踩油門（含倒車）但 |速度| < STUCK_SPEED 累計 ≥ STUCK_MS（停著不動不算卡住）。觸發時計時歸零。
 */
export function shouldRespawn(
  t: RespawnTimer,
  input: { speed: number; offTrack: boolean; throttle: boolean; outOfBounds?: boolean },
  dtMs: number
): { timer: RespawnTimer; respawn: boolean } {
  const stuckMs = input.throttle && Math.abs(input.speed) < STUCK_SPEED ? t.stuckMs + dtMs : 0
  const offMs = input.offTrack ? t.offMs + dtMs : 0
  const respawn = !!input.outOfBounds || stuckMs >= STUCK_MS || offMs >= OFFTRACK_RESPAWN_MS
  return { timer: respawn ? { stuckMs: 0, offMs: 0 } : { stuckMs, offMs }, respawn }
}

/** 放回最後通過的檢查點中心，朝向沿線 */
export function respawnPose(track: Track, lap: LapState): { x: number; z: number; ry: number } {
  const p = pointAt(track, track.checkpoints[lap.cp] ?? 0)
  return { x: p.x, z: p.z, ry: p.heading }
}

/** 推擠：只把自己從重疊的車推開（各車在自己的擁有端推自己；bot 由 host 推） */
export function pushApart(
  self: { x: number; z: number },
  others: readonly { x: number; z: number }[],
  dt: number
): { x: number; z: number } {
  let { x, z } = self
  for (const o of others) {
    const dx = x - o.x
    const dz = z - o.z
    const d = Math.hypot(dx, dz)
    if (d < CAR_PUSH_DIST && d > 0.01) {
      const push = (CAR_PUSH_DIST - d) * CAR_PUSH_FORCE * dt
      x += (dx / d) * push
      z += (dz / d) * push
    }
  }
  return { x, z }
}

/** 起跳垂直初速 */
export const launchVy = (speed: number): number => JUMP_VY0 + JUMP_VY_K * speed

/** 騰空 t 秒的高度（從唇口 JUMP_H 起跳），落地後夾在 0 */
export const jumpY = (t: number, vy: number): number => Math.max(0, JUMP_H + vy * t - 0.5 * JUMP_G * t * t)

/** 斜坡上的高度：s ∈ [s0, s1] 且 |lateral| ≤ RAMP_HALF_W 時線性升到 JUMP_H，其餘 0 */
export function rampY(course: Course, s: number, lateral: number): number {
  if (Math.abs(lateral) > RAMP_HALF_W) return 0
  for (const [s0, s1] of course.jumps) if (s >= s0 && s <= s1) return (JUMP_H * (s - s0)) / (s1 - s0)
  return 0
}

export type RacerEvent = 'lap' | 'finish' | 'turbo' | 'slip' | 'pad' | 'jump' | 'land' | 'respawn'

/** 一台車的完整本機狀態（自己的車或 host 上的 bot） */
export interface RacerState {
  car: CarPhys
  /** 跳台高度（只給視覺） */
  y: number
  drift: DriftState
  slipChargeMs: number
  /** 尾流加成剩餘 */
  slipMs: number
  /** 加速（迷你加速、加速帶、加速菇）剩餘 */
  boostMs: number
  spinMs: number
  shieldMs: number
  /** 重生後閃爍、不被道具命中 */
  ghostMs: number
  respawn: RespawnTimer
  lap: LapState
  s: number
  lateral: number
  wrongMs: number
  wrongWay: boolean
  /** 騰空中：已過秒數與起跳垂直初速；在地面為 null */
  air: { t: number; vy: number } | null
  onPad: boolean
  /** 上一 tick 在斜坡上（越過坡頂才起跳） */
  onRamp: boolean
}

export interface RacerWorld {
  course: Course
  /** 其他車的位置（推擠與尾流用）；ry 給了才做尾流的朝向判定 */
  others: readonly { x: number; z: number; ry?: number }[]
}

/** 起跑格 slot 的初始狀態 */
export function makeRacer(course: Course, slot: number): RacerState {
  const g = course.grid[slot % course.grid.length]
  const p = trackProgress(course.track, g.x, g.z)
  return {
    car: { x: g.x, z: g.z, ry: g.ry, speed: 0 },
    y: 0,
    drift: NO_DRIFT,
    slipChargeMs: 0,
    slipMs: 0,
    boostMs: 0,
    spinMs: 0,
    shieldMs: 0,
    ghostMs: 0,
    respawn: { stuckMs: 0, offMs: 0 },
    lap: { lap: 0, cp: 0 },
    s: p.s,
    lateral: p.lateral,
    wrongMs: 0,
    wrongWay: false,
    air: null,
    onPad: false,
    onRamp: false,
  }
}

const dec = (v: number, dtMs: number) => Math.max(0, v - dtMs)

/** s 剛越過某座斜坡的坡頂（往前 0 < ds ≤ 5） */
const crossedRampTop = (course: Course, s: number): boolean =>
  course.jumps.some(([, s1]) => {
    const ds = (((s - s1) % course.track.len) + course.track.len) % course.track.len
    return ds > 0 && ds <= 5
  })

/**
 * 一台車的一個 tick：計時器 → 甩尾 → 運動學 → 推擠 → 賽道投影 → 尾流 → 加速帶 → 跳台 → 計圈 → 逆向 → 重生。
 * 道具效果（打滑、護盾、加速菇）由呼叫端改 spinMs／shieldMs／boostMs。
 */
export function stepRacer(
  r: RacerState,
  input: DriveInput,
  world: RacerWorld,
  dt: number
): { state: RacerState; events: RacerEvent[] } {
  const { course } = world
  const { track } = course
  const dtMs = dt * 1000
  const events: RacerEvent[] = []
  const spinMs = dec(r.spinMs, dtMs)
  const spinning = spinMs > 0
  const inp: DriveInput = spinning ? { throttle: 0, steer: 0, drifting: false } : input

  let boostMs = dec(r.boostMs, dtMs)
  let drift: DriftState = NO_DRIFT
  if (!spinning) {
    const d = stepDrift(r.drift, { drifting: inp.drifting, steer: inp.steer, speed: r.car.speed }, dt)
    drift = d.state
    if (d.turboMs > 0) {
      boostMs = Math.max(boostMs, d.turboMs)
      events.push('turbo')
    }
  }
  let slipMs = dec(r.slipMs, dtMs)
  // 騰空中不吃路面外降速（spec §1.4）
  const onTrack = r.air !== null || Math.abs(r.lateral) <= track.width / 2
  let car = stepCar(r.car, inp, { onTrack, boosting: boostMs > 0, slipping: slipMs > 0, spinning }, dt)
  car = { ...car, ...pushApart(car, world.others, dt) }
  const { bound } = course
  const outOfBounds = Math.abs(car.x) > bound.x || Math.abs(car.z) > bound.z
  if (outOfBounds) {
    car = { ...car, x: Math.max(-bound.x, Math.min(bound.x, car.x)), z: Math.max(-bound.z, Math.min(bound.z, car.z)) }
  }

  const prog = trackProgress(track, car.x, car.z)
  const slip = slipCharge(r.slipChargeMs, car, world.others, dtMs)
  if (slip.slipMs > 0) {
    slipMs = slip.slipMs
    events.push('slip')
  }

  const onPad = course.pads.some((p) => {
    let ds = Math.abs(prog.s - p.s)
    ds = Math.min(ds, track.len - ds)
    return ds <= PAD_HALF_LEN && Math.abs(prog.lateral - p.lateral) <= PAD_HALF_W
  })
  if (onPad && !r.onPad) {
    boostMs = Math.max(boostMs, BOOST_DURATION_MS)
    events.push('pad')
  }

  // 跳台：上一 tick 在坡上、這 tick 越過坡頂（往前 ≤ 5）且夠快 → 起跳；騰空到 y ≤ 0 落地
  let air = r.air
  let y: number
  const onRamp = Math.abs(prog.lateral) <= RAMP_HALF_W && course.jumps.some((j) => inSpan(track, prog.s, j))
  if (air) {
    air = { t: air.t + dt, vy: air.vy }
    y = jumpY(air.t, air.vy)
    if (y <= 0) {
      air = null
      events.push('land')
    }
  } else if (r.onRamp && !onRamp && car.speed >= JUMP_MIN_SPEED && crossedRampTop(course, prog.s)) {
    air = { t: 0, vy: launchVy(car.speed) }
    y = JUMP_H
    events.push('jump')
  } else {
    y = rampY(course, prog.s, prog.lateral)
  }

  const lap = advanceLap(r.lap, sectorOf(track, prog.s))
  if (lap.lap > r.lap.lap) events.push(lap.lap >= LAPS ? 'finish' : 'lap')

  const ww = stepWrongWay(r.wrongMs, { heading: car.ry, trackHeading: pointAt(track, prog.s).heading, speed: car.speed }, dtMs)

  const offTrack = air === null && Math.abs(prog.lateral) > track.width / 2
  const rs = shouldRespawn(r.respawn, { speed: car.speed, offTrack, throttle: inp.throttle !== 0, outOfBounds }, dtMs)

  const next: RacerState = {
    car,
    y,
    drift,
    slipChargeMs: slip.ms,
    slipMs,
    boostMs,
    spinMs,
    shieldMs: dec(r.shieldMs, dtMs),
    ghostMs: dec(r.ghostMs, dtMs),
    respawn: rs.timer,
    lap,
    s: prog.s,
    lateral: prog.lateral,
    wrongMs: ww.ms,
    wrongWay: ww.wrongWay,
    air,
    onPad,
    onRamp,
  }
  if (!rs.respawn) return { state: next, events }

  const pose = respawnPose(track, lap)
  const back = trackProgress(track, pose.x, pose.z)
  events.push('respawn')
  return {
    state: {
      ...next,
      car: { ...pose, speed: 0 },
      y: 0,
      drift: NO_DRIFT,
      slipChargeMs: 0,
      slipMs: 0,
      boostMs: 0,
      spinMs: 0,
      ghostMs: RESPAWN_GHOST_MS,
      s: back.s,
      lateral: back.lateral,
      wrongMs: 0,
      wrongWay: false,
      air: null,
      onPad: false,
      onRamp: false,
    },
    events,
  }
}
