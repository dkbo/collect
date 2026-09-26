import { PLAYER_PALETTE } from '@/babylon/games/bomberFx/palette'
import type { GameHud, GameHudPlayer } from '@/babylon/types'

/** 固定 4 色（spec §4），與 3D 角色同源；索引 = colorIndex，P 編號 = colorIndex + 1 */
export const BOMBER_COLORS = PLAYER_PALETTE

/** 勝場星數（bomber MATCH_TARGET） */
const STAR_COUNT = 3
/** HUD 以 960×540 設計尺寸排版，再依容器等比縮放 */
const DESIGN_W = 960
const DESIGN_H = 540
const MIN_SCALE = 0.5
const MAX_SCALE = 2
/** 剩這麼多秒（含）以內計時器變紅跳動 */
const URGENT_SECONDS = 10

/** 秒數 → m:ss（小數無條件進位，負數與非有限值為 0:00） */
export function formatTimer(seconds: number): string {
  const s = Number.isFinite(seconds) ? Math.max(0, Math.ceil(seconds)) : 0
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export type TimerMode = 'normal' | 'urgent' | 'sudden'

/** 計時器膠囊的顯示狀態：突然死亡時忽略 secondsLeft */
export function timerView(timer: GameHud['timer']): { mode: TimerMode; text: string } {
  if (timer.suddenDeath) return { mode: 'sudden', text: '縮圈中' }
  const text = formatTimer(timer.secondsLeft)
  const mode = Math.ceil(timer.secondsLeft) <= URGENT_SECONDS ? 'urgent' : 'normal'
  return { mode, text }
}

/** 左欄 P1／P3、右欄 P2／P4，各自依 P 編號排序 */
export function splitColumns(players: GameHudPlayer[]): { left: GameHudPlayer[]; right: GameHudPlayer[] } {
  const sorted = [...players].sort((a, b) => a.colorIndex - b.colorIndex)
  return {
    left: sorted.filter((p) => p.colorIndex % 2 === 0),
    right: sorted.filter((p) => p.colorIndex % 2 === 1),
  }
}

export function playerLabel(colorIndex: number): string {
  return `P${colorIndex + 1}`
}

/** 勝場星：已得的在前，共 3 顆 */
export function winStars(wins: number): boolean[] {
  return Array.from({ length: STAR_COUNT }, (_, i) => i < wins)
}

export function invincibleSeconds(ms: number): number {
  return ms > 0 ? Math.ceil(ms / 1000) : 0
}

/** 容器尺寸 → HUD 縮放（取寬高較小的比例，夾在 0.5–2；尺寸未知時為 1） */
export function hudScale(width: number, height: number): number {
  if (width <= 0 || height <= 0) return 1
  const s = Math.min(width / DESIGN_W, height / DESIGN_H)
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))
}

/** HUD 內容是否相同（遊戲可每幀 setHud，內容沒變就不重繪）；bomber 與 kitchen 共用 */
export function sameHud<T = GameHud>(a: T | null, b: T | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return JSON.stringify(a) === JSON.stringify(b)
}
