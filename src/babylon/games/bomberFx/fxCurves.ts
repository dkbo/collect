/**
 * 炸彈超人專屬的特效時間曲線（spec §8，純函式，可在 node 單測）；通用曲線在 fx/curves。
 * t 一律是 0..1 的進度（呼叫端用 經過毫秒 / 時長 算），超出範圍自動夾住。
 */
import { backOut, clamp01 } from '@/babylon/fx/curves'

/** 放炸彈：縮放 0.6 → 1.0（back-out） */
export function placeScale(t: number): number {
  if (t >= 1) return 1
  return 0.6 + 0.4 * backOut(t)
}

/** 爆炸臂依序生長：每離爆心一格延遲 25ms */
export const ARM_STEP_MS = 25
export function armDelayMs(cx: number, cy: number, ccx: number, ccy: number): number {
  return (Math.abs(cx - ccx) + Math.abs(cy - ccy)) * ARM_STEP_MS
}

/** 火焰 emissive：1.0 → 0.4 */
export function flameEmissive(ageMs: number, lifeMs: number): number {
  return 1 - 0.6 * clamp01(ageMs / lifeMs)
}

/** 陣亡：往上跳（前 70% 走一個弧）、旋轉加速、縮小到 0 */
export function deathPose(t: number): { lift: number; spin: number; scale: number } {
  const u = clamp01(t)
  if (u === 0) return { lift: 0, spin: 0, scale: 1 }
  const hop = Math.min(1, u / 0.7)
  return {
    lift: 1.6 * Math.sin(Math.PI * hop) * (1 - 0.4 * u),
    spin: Math.PI * 4 * u * u,
    scale: 1 - u * u,
  }
}

/** 焦痕：前段維持原大小，最後 400ms 縮到 0（thin instance 沒有逐顆 alpha，用縮小代替淡出） */
export const SCORCH_FADE_MS = 400
export function scorchScale(ageMs: number, lifeMs: number): number {
  const left = lifeMs - ageMs
  if (left <= 0) return 0
  return Math.min(1, left / SCORCH_FADE_MS)
}
