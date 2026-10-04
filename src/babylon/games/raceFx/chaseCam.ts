/**
 * 追尾相機（spec §7，純函式）：ArcRotateCamera 的 alpha／beta／radius／fov／target 每幀怎麼走。
 * 對局中跟在車後（甩尾時用移動方向的 ry，畫面不跟著車身甩）、速度越快拉遠一點且 fov 微增；
 * 倒數最後 0.9 s 從車正前方繞到車後；衝線後拉遠慢慢環繞。
 */
import { lerpAngle } from '@/babylon/math'
import { clamp01, easeOut } from '@/babylon/fx/curves'
import { MAX_SPEED } from '@/babylon/games/raceRules/drive'

export const CHASE = {
  beta: 1.36,
  radius: [9.5, 10.5] as const,
  lift: 1.6,
  liftK: 0.5,
  lead: 2.5,
  alphaRate: 6,
  fovRate: 4,
  introMs: 900,
  finish: { radius: 14, beta: 1.15, orbit: 0.25, rate: 2 },
  minZ: 0.3,
  maxZ: 260,
} as const

export type ChaseMode = 'countdown' | 'playing' | 'finished'

export interface ChaseInput {
  x: number
  z: number
  y: number
  /** 移動方向（state 的 ry，不是車身視覺偏航） */
  ry: number
  speed: number
  boosting: boolean
  mode: ChaseMode
  /** 倒數剩餘毫秒（mode 為 countdown 時用） */
  countdownMs: number
}

export interface ChaseState {
  alpha: number
  beta: number
  radius: number
  fov: number
  target: [number, number, number]
}

export const chaseRadius = (speed: number): number =>
  CHASE.radius[0] + (CHASE.radius[1] - CHASE.radius[0]) * clamp01(Math.abs(speed) / MAX_SPEED)

export const chaseFov = (speed: number, boosting: boolean): number =>
  0.8 + 0.1 * clamp01((Math.abs(speed) - 8) / 9) + (boosting ? 0.08 : 0)

export function chaseTarget(c: Pick<ChaseInput, 'x' | 'z' | 'y' | 'ry'>): [number, number, number] {
  return [c.x + Math.sin(c.ry) * CHASE.lead, CHASE.lift + CHASE.liftK * c.y, c.z + Math.cos(c.ry) * CHASE.lead]
}

const behind = (ry: number): number => -ry - Math.PI / 2
const front = (ry: number): number => -ry + Math.PI / 2

export function initChase(c: ChaseInput): ChaseState {
  return { alpha: behind(c.ry), beta: CHASE.beta, radius: chaseRadius(c.speed), fov: chaseFov(c.speed, c.boosting), target: chaseTarget(c) }
}

export function stepChase(s: ChaseState, c: ChaseInput, dt: number): ChaseState {
  const target = chaseTarget(c)
  const fov = s.fov + (chaseFov(c.speed, c.boosting) - s.fov) * Math.min(1, dt * CHASE.fovRate)
  if (c.mode === 'finished') {
    const k = Math.min(1, dt * CHASE.finish.rate)
    return {
      alpha: s.alpha + CHASE.finish.orbit * dt,
      beta: s.beta + (CHASE.finish.beta - s.beta) * k,
      radius: s.radius + (CHASE.finish.radius - s.radius) * k,
      fov,
      target,
    }
  }
  if (c.mode === 'countdown') {
    // 開場運鏡：最後 introMs 從車正前方往車後繞半圈（easeOut），GO 時剛好在車後
    const t = clamp01(1 - c.countdownMs / CHASE.introMs)
    return { alpha: front(c.ry) - Math.PI * easeOut(t), beta: CHASE.beta, radius: chaseRadius(c.speed), fov, target }
  }
  return {
    alpha: lerpAngle(s.alpha, behind(c.ry), Math.min(1, dt * CHASE.alphaRate)),
    beta: CHASE.beta,
    radius: chaseRadius(c.speed),
    fov,
    target,
  }
}

/** 量化到 step 的格點（陰影中心跟車走但不每幀抖動） */
export const snapGrid = (v: number, step: number): number => Math.round(v / step) * step + 0
