/**
 * 坦克對戰的網路請求驗證（純邏輯，無 Babylon / scene 依賴，node 可直接單測）。
 *
 * 目前只涵蓋 guest → host 的 shootReq：host 不能只信任封包裡的座標與速度，
 * 還要對照自己掌握的狀態（存活、開火冷卻、該玩家最新已知位置）重新裁決，
 * 否則一顆手寫封包就能無視冷卻、從任意位置、以任意速度開火。
 * 驗不過一律回傳 null（呼叫端靜默丟棄），絕不 throw。
 *
 * 場地大小與子彈速度屬 tank.ts 的場景常數，經 ctx 傳入，避免本模組反向相依。
 */
import { isNum, isNumIn, isObj } from '@/babylon/net'

/** 起點與 host 已知位置的最大容許距離：客端槍口偏移 0.6 + 20Hz 位置同步的插值延遲餘裕 */
export const SHOOT_MAX_POS_DELTA = 2.0
/** 冷卻容忍係數：客端用同一組常數計算，這裡放寬 0.8 倍吸收網路抖動 */
export const SHOOT_COOLDOWN_TOLERANCE = 0.8
/** 子彈速度大小相對標準速度的容許區間（客端必為 sin/cos × BULLET_SPEED，理應恰好 1.0） */
export const SHOOT_SPEED_MIN_RATIO = 0.9
export const SHOOT_SPEED_MAX_RATIO = 1.1

/** 驗證通過的開火請求 */
export interface ShootReq {
  x: number
  z: number
  vx: number
  vz: number
}

/** host 端裁決 shootReq 所需的自身狀態 */
export interface ShootReqContext {
  /** 請求者是否存活 */
  alive: boolean
  /** host 記錄的該玩家上次開火時刻；從未開火為 undefined */
  lastShotAt: number | undefined
  /** 該玩家目前的開火冷卻（FIRE_COOLDOWN_MS × rapidMul） */
  cooldownMs: number
  /** host 已知的該玩家位置（ownership 最新樣本）；null 表示尚無樣本，一律拒絕 */
  knownPos: { x: number; z: number } | null
  now: number
  /** 世界座標容許範圍（±worldLimit） */
  worldLimit: number
  /** 標準子彈速度 */
  bulletSpeed: number
}

/**
 * 驗證 guest 送來的開火請求。
 * 依序檢查：payload 形狀與座標範圍 → 存活 → 冷卻 → 起點與已知位置的距離 → 速度大小。
 */
export const validateShootReq = (payload: unknown, ctx: ShootReqContext): ShootReq | null => {
  if (!isObj(payload)) return null
  const { x, z, vx, vz } = payload
  if (!isNumIn(x, -ctx.worldLimit, ctx.worldLimit) || !isNumIn(z, -ctx.worldLimit, ctx.worldLimit)) {
    return null
  }
  if (!isNum(vx) || !isNum(vz)) return null

  // 已毀損的坦克不能開火
  if (!ctx.alive) return null

  // 冷卻：兩發之間至少要隔 cooldownMs × 容忍係數
  if (
    ctx.lastShotAt !== undefined &&
    ctx.now - ctx.lastShotAt < ctx.cooldownMs * SHOOT_COOLDOWN_TOLERANCE
  ) {
    return null
  }

  // 位置：子彈起點須貼近 host 已知的該玩家位置
  if (!ctx.knownPos) return null
  if (Math.hypot(x - ctx.knownPos.x, z - ctx.knownPos.z) > SHOOT_MAX_POS_DELTA) return null

  // 速度：大小須落在標準子彈速度附近（方向不限）
  const speed = Math.hypot(vx, vz)
  if (speed < ctx.bulletSpeed * SHOOT_SPEED_MIN_RATIO) return null
  if (speed > ctx.bulletSpeed * SHOOT_SPEED_MAX_RATIO) return null

  return { x, z, vx, vz }
}
