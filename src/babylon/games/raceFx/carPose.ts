/**
 * 車身視覺姿態（spec §4.1／§1.4，純函式）：側傾、甩尾偏航、甩尾起跳、加速抬頭、騰空俯仰；
 * 他車與 bot 的跳台高度由 s 對照賽道跳台本機推算（own／botState 不帶 y）。只影響畫面，x/z 不動。
 */
import { inSpan, type Course } from '@/babylon/games/raceRules/track'
import { JUMP_MIN_SPEED, MAX_SPEED, RAMP_HALF_W, TURN_RATE, jumpY, launchVy, rampY } from '@/babylon/games/raceRules/drive'

/** 甩尾起跳：按下甩尾瞬間車身跳 0.25、160ms */
export const HOP_MS = 160
const HOP_H = 0.25
const LEAN = 0.07
const DRIFT_YAW = 0.38
const BOOST_PITCH = -0.06
const AIR_PITCH = (12 * Math.PI) / 180
/** 騰空俯仰：vy 達這個值時到 ±12° */
const AIR_VY_FULL = 8

/** 他車／bot 的 y：坡上照斜坡高度；越過唇口且速度 ≥ 起跳門檻時照 drive 的拋物線（t = 飛行距離 / 速度） */
export function remoteY(course: Course, s: number, lateral: number, speed: number): number {
  const ramp = rampY(course, s, lateral)
  if (ramp > 0) return ramp
  if (Math.abs(lateral) > RAMP_HALF_W || speed < JUMP_MIN_SPEED) return 0
  for (const [, s1] of course.jumps) {
    const d = s - s1
    if (d <= 0 || !inSpan(course.track, s, [s1, s1 + 40])) continue
    return jumpY(d / speed, launchVy(speed))
  }
  return 0
}

/** 由偏航角速度反推轉向 −1..1（他車沒有輸入，只有 ry 序列；公式同 drive.stepCar 的轉向） */
export function steerFromYaw(dRy: number, dt: number, speed: number): number {
  const f = Math.min(1, Math.abs(speed) / (MAX_SPEED * 0.5))
  if (dt <= 0 || f < 1e-3) return 0
  const s = dRy / (TURN_RATE * f * dt)
  return Math.max(-1, Math.min(1, s))
}

export interface PoseInput {
  steer: number
  /** |speed| / MAX_SPEED（0..1） */
  speedRatio: number
  drifting: boolean
  boosting: boolean
  /** 垂直速度（騰空俯仰用） */
  vy: number
  airborne: boolean
  /** 距甩尾按下的毫秒；< 0 表示沒在起跳 */
  hopMs: number
  /** 在斜坡上的俯仰（−atan(h/len)），不在坡上為 0 */
  rampPitch: number
}

export interface BodyPose {
  rx: number
  rz: number
  /** 相對移動方向的車身偏航（甩尾甩出車尾） */
  yaw: number
  dy: number
}

export function bodyPose(p: PoseInput): BodyPose {
  let rx = p.rampPitch
  if (p.airborne) rx = -Math.max(-1, Math.min(1, p.vy / AIR_VY_FULL)) * AIR_PITCH
  else if (p.boosting) rx += BOOST_PITCH
  const dy = p.hopMs >= 0 && p.hopMs < HOP_MS ? HOP_H * Math.sin((Math.PI * p.hopMs) / HOP_MS) : 0
  return { rx, rz: -p.steer * LEAN * p.speedRatio, yaw: p.drifting ? DRIFT_YAW * p.steer : 0, dy }
}
