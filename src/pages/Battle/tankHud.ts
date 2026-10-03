import { PLAYER_PALETTE } from '@/babylon/fx/palette'
import type { GameHud, KitchenHud, TankBuffKind, TankHud, TankHudFeed, TankHudPlayer } from '@/babylon/types'
import { timerView, type TimerMode } from '@/pages/Battle/bomberHud'
import type { TouchAction } from '@/pages/Battle/TouchControls'

/** 固定 4 色（tank spec §2.1），與 3D 坦克同源；索引 = colorIndex */
export const TANK_COLORS = PLAYER_PALETTE

/** buff 徽章底色與圖示／字色（tank spec §2.3） */
export const TANK_BUFFS: Record<TankBuffKind, { label: string; bg: string; fg: string }> = {
  speed: { label: '加速', bg: '#FFD23F', fg: '#3A2A00' },
  rapid: { label: '連射', bg: '#FF6B3D', fg: '#FFFFFF' },
  triple: { label: '三連發', bg: '#B07CFF', fg: '#FFFFFF' },
}

/** 擊殺通知：同時最多幾則、收到後顯示多久開始淡出、淡出多久後移除（spec §9.2） */
export const TANK_FEED_MAX = 3
export const TANK_FEED_SHOW_MS = 3000
export const TANK_FEED_LEAVE_MS = 300

/** 卡片 HP 超過這麼多格改顯示 hp/maxHp */
const MAX_HEARTS = 6

/**
 * 手機動作鈕（AC4、spec §9.3）：砲塔左轉 q、右轉 e（tank.ts 按住即轉），開火放最右。
 * ↺／↻ 為 U+21BA／U+21BB。
 */
export const TANK_TOUCH_ACTIONS: TouchAction[] = [
  { label: '↺', key: 'q' },
  { label: '↻', key: 'e' },
  { label: '🔥', key: ' ' },
]

/** setHud 收到的是不是坦克 HUD（沒有 kind 的一律當 bomber） */
export function isTankHud(hud: GameHud | KitchenHud | TankHud | null): hud is TankHud {
  return hud !== null && 'kind' in hud && hud.kind === 'tank'
}

/** 計時膠囊：到突然死亡的 m:ss，最後 10 秒（含）變紅跳動，進入後變「縮圈中」（同 bomber） */
export function tankTimerView(hud: Pick<TankHud, 'remainSec' | 'suddenDeath'>): { mode: TimerMode; text: string } {
  return timerView({ secondsLeft: hud.remainSec, suddenDeath: hud.suddenDeath })
}

export type HpView = { mode: 'hearts'; hearts: boolean[] } | { mode: 'count'; text: string }

/** 卡片 HP：maxHp ≤ 6 畫成一排心（還有的在前），否則 hp/maxHp；hp 夾在 0–maxHp */
export function hpView(hp: number, maxHp: number): HpView {
  const max = Number.isFinite(maxHp) ? Math.max(0, Math.round(maxHp)) : 0
  const cur = Number.isFinite(hp) ? Math.min(max, Math.max(0, Math.round(hp))) : 0
  if (max > MAX_HEARTS) return { mode: 'count', text: `${cur}/${max}` }
  return { mode: 'hearts', hearts: Array.from({ length: max }, (_, i) => i < cur) }
}

/** 左欄 P1／P3、右欄 P2／P4，各自依 P 編號排序 */
export function splitTankColumns(players: TankHudPlayer[]): { left: TankHudPlayer[]; right: TankHudPlayer[] } {
  const sorted = sortTankPlayers(players)
  return {
    left: sorted.filter((p) => p.colorIndex % 2 === 0),
    right: sorted.filter((p) => p.colorIndex % 2 === 1),
  }
}

export function sortTankPlayers(players: TankHudPlayer[]): TankHudPlayer[] {
  return [...players].sort((a, b) => a.colorIndex - b.colorIndex)
}

/** 還沒顯示過的擊殺通知，依 id 由舊到新 */
export function freshFeed(seen: ReadonlySet<number>, feed: TankHudFeed[]): TankHudFeed[] {
  return feed.filter((f) => !seen.has(f.id)).sort((a, b) => a.id - b.id)
}

/** 正在畫面上的擊殺通知；leaving 為 true 時播淡出 */
export interface TankFeedItem extends TankHudFeed {
  leaving: boolean
}

export interface FeedSide {
  name: string
  colorIndex: number | null
}

/** 擊殺通知的顯示資料：依名字從名冊找色點，找不到（如已離房）色點留空 */
export function feedView(f: TankHudFeed, players: TankHudPlayer[]): { killer: FeedSide | null; victim: FeedSide } {
  const side = (name: string): FeedSide => ({
    name,
    colorIndex: players.find((p) => p.name === name)?.colorIndex ?? null,
  })
  return { killer: f.killer === null ? null : side(f.killer), victim: side(f.victim) }
}
