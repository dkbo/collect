/**
 * 坦克的 juice 曲線（spec §7，純函式）：開砲與受擊共用同一條擠壓回彈，砲管後座另一條。
 * t 一律是 0..1 的進度（呼叫端用 經過毫秒 / 時長 算），超出範圍回原狀。
 */
import { clamp01, easeOut } from '@/babylon/fx/curves'

/** 開砲：振幅 0.12、180ms */
export const FIRE_SQUASH = { amp: 0.12, ms: 180 } as const
/** 受擊：振幅 0.22、260ms */
export const HIT_SQUASH = { amp: 0.22, ms: 260 } as const
/** 砲管後座距離（local z）與時長 */
export const RECOIL_DIST = 0.14
export const RECOIL_MS = 180

/** 回彈段係數 0.8（spec §7 已回寫；原公式 0.45 對不上「t≈0.6 時 sy≈1+0.3·amp」的關鍵幀） */
const REBOUND = 0.8
const PRESS_END = 0.35

/** 先往下壓（t≈0.17 最低 1−amp）、再彈高（t≈0.6 約 1+0.3·amp）、t=1 收回；橫向以體積守恆近似 */
export function squashPose(t: number, amp: number): { sy: number; sxz: number } {
  if (!(t > 0 && t < 1)) return { sy: 1, sxz: 1 }
  const press = t < PRESS_END ? Math.sin(Math.PI * (t / PRESS_END)) : 0
  const rebound = Math.sin(Math.PI * clamp01((t - PRESS_END) / (1 - PRESS_END))) * (1 - t)
  const sy = 1 - amp * press + amp * REBOUND * rebound
  return { sy, sxz: 1 + (1 - sy) * 0.5 }
}

/** 砲管後座：前 15% 退到 −RECOIL_DIST，之後 easeOut 回位 */
export function recoilZ(t: number): number {
  if (!(t >= 0 && t <= 1)) return 0
  if (t < 0.15) return -RECOIL_DIST * (t / 0.15)
  return -RECOIL_DIST * (1 - easeOut((t - 0.15) / 0.85))
}
