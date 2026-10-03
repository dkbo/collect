import { PLAYER_PALETTE } from '@/babylon/fx/palette'
import type { AnyGameHud, RaceHud, RaceHudResult } from '@/babylon/types'
import type { ItemKind } from '@/babylon/games/raceRules/items'
import type { TouchAction } from '@/pages/Battle/TouchControls'

/** 固定 4 色（與 3D 車同源）；索引 = colorIndex */
export const RACE_COLORS = PLAYER_PALETTE

/** 名次色（spec §9.5） */
export type RankTone = 'gold' | 'silver' | 'bronze' | 'plain'
export const RANK_TONES: Record<RankTone, string> = {
  gold: '#FFC21A',
  silver: '#E3E6EF',
  bronze: '#FF9A5A',
  plain: '#C9BEDB',
}

/** 道具名稱（無障礙標籤用） */
export const RACE_ITEM_LABELS: Record<ItemKind, string> = {
  banana: '香蕉皮',
  shell: '紅龜殼',
  mushroom: '加速菇',
  shield: '防護罩',
}

/** 道具欄轉盤膠卷的排列順序（spec §9.2） */
export const RACE_ITEM_REEL: readonly ItemKind[] = ['banana', 'shell', 'mushroom', 'shield']

/** 「最後一圈！」大字停留多久、新最佳圈閃色多久（spec §9.2） */
export const RACE_FINAL_BANNER_MS = 2200
export const RACE_BEST_FLASH_MS = 1200

/** 小地圖 SVG 的 viewBox 尺寸與留白（168×148 卡片扣掉邊框與 p-2） */
export const RACE_MAP_W = 147
export const RACE_MAP_H = 127
export const RACE_MAP_PAD = 7

/**
 * 手機動作鈕（AC8、spec §9.3）：2×2，上排道具／煞車、下排甩尾／油門；搖桿只負責轉向。
 * ▲／▼ 為 U+25B2／U+25BC。
 */
export const RACE_TOUCH_ACTIONS: TouchAction[] = [
  { label: '🎁', key: 'e' },
  { label: '▼', key: 's' },
  { label: '💨', key: ' ' },
  { label: '▲', key: 'w' },
]

/** setHud 收到的是不是賽車 HUD（沒有 kind 的一律當 bomber） */
export function isRaceHud(hud: AnyGameHud | null): hud is RaceHud {
  return hud !== null && 'kind' in hud && hud.kind === 'race'
}

/** 名次夾成正整數（非數字當 1） */
export function rankOf(rank: number): number {
  return Number.isFinite(rank) ? Math.max(1, Math.round(rank)) : 1
}

/** 名次字尾 st／nd／rd／th（11–13 一律 th） */
export function ordinalSuffix(rank: number): string {
  const n = rankOf(rank)
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return 'th'
  if (n % 10 === 1) return 'st'
  if (n % 10 === 2) return 'nd'
  if (n % 10 === 3) return 'rd'
  return 'th'
}

/** 1st／2nd／3rd／4th… */
export function ordinal(rank: number): string {
  return `${rankOf(rank)}${ordinalSuffix(rank)}`
}

/** 圈時 m:ss.cc（不足 10ms 捨去）；null 或不合法 → -:--.-- */
export function formatLapMs(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return '-:--.--'
  const cs = Math.floor(ms / 10)
  const m = Math.floor(cs / 6000)
  const s = Math.floor((cs % 6000) / 100)
  const c = cs % 100
  return `${m}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`
}

/** 名次 → 色調：1 金、2 銀、3 銅、其餘 plain */
export function rankTone(rank: number): RankTone {
  const n = rankOf(rank)
  if (n === 1) return 'gold'
  if (n === 2) return 'silver'
  if (n === 3) return 'bronze'
  return 'plain'
}

/**
 * 小地圖座標轉換：賽道 bbox 等比塞進 w×h（四周留 pad）並置中；z 往上（SVG y 反向）。
 * 空賽道或單點時退回畫面中心，不會除以 0。
 */
export function mapTransform(pts: readonly [number, number][], w: number, h: number, pad: number): (x: number, z: number) => [number, number] {
  if (pts.length === 0) return () => [w / 2, h / 2]
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const [x, z] of pts) {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minZ = Math.min(minZ, z)
    maxZ = Math.max(maxZ, z)
  }
  const spanX = maxX - minX
  const spanZ = maxZ - minZ
  const availW = Math.max(0, w - pad * 2)
  const availH = Math.max(0, h - pad * 2)
  const k = spanX > 0 || spanZ > 0 ? Math.min(spanX > 0 ? availW / spanX : Infinity, spanZ > 0 ? availH / spanZ : Infinity) : 0
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2
  return (x, z) => [w / 2 + (x - cx) * k, h / 2 - (z - cz) * k]
}

/** 小數 1 位（SVG 屬性字串短一點） */
const r1 = (v: number) => Math.round(v * 10) / 10

/** 起跑線短橫：在第一個點、垂直於第一段，半長 half（SVG 單位） */
export function startTick(
  pts: readonly [number, number][],
  tf: (x: number, z: number) => [number, number],
  half: number
): { x1: number; y1: number; x2: number; y2: number } {
  if (pts.length < 2) return { x1: 0, y1: 0, x2: 0, y2: 0 }
  const [ax, ay] = tf(pts[0][0], pts[0][1])
  const [bx, by] = tf(pts[1][0], pts[1][1])
  const len = Math.hypot(bx - ax, by - ay) || 1
  const nx = (-(by - ay) / len) * half
  const ny = ((bx - ax) / len) * half
  return { x1: ax - nx, y1: ay - ny, x2: ax + nx, y2: ay + ny }
}

export interface RaceMapCarView {
  id: string
  cx: number
  cy: number
  r: number
  fill: string
  isSelf: boolean
}

/** 賽道輪廓 points 字串（首尾閉合），pts 參照不變時由元件 useMemo 沿用 */
export function trackPoints(pts: readonly [number, number][], tf: (x: number, z: number) => [number, number]): string {
  const closed = pts.length > 1 ? [...pts, pts[0]] : pts
  return closed.map(([x, z]) => tf(x, z).map(r1).join(',')).join(' ')
}

/** 車點：自己 r 6.5 畫最後（最上層），其他 r 4.5；填玩家 base 色 */
export function mapCars(
  cars: RaceHud['map']['cars'],
  tf: (x: number, z: number) => [number, number]
): RaceMapCarView[] {
  return [...cars]
    .sort((a, b) => Number(a.isSelf) - Number(b.isSelf))
    .map((c) => {
      const [cx, cy] = tf(c.x, c.z)
      return {
        id: c.id,
        cx: r1(cx),
        cy: r1(cy),
        r: c.isSelf ? 6.5 : 4.5,
        fill: (RACE_COLORS[c.colorIndex] ?? RACE_COLORS[0]).base,
        isSelf: c.isSelf,
      }
    })
}

/** 小地圖整體（用預設尺寸）：賽道輪廓與車點 */
export function mapView(map: RaceHud['map']): { track: string; cars: RaceMapCarView[] } {
  const tf = mapTransform(map.pts, RACE_MAP_W, RACE_MAP_H, RACE_MAP_PAD)
  return { track: trackPoints(map.pts, tf), cars: mapCars(map.cars, tf) }
}

/** 道具欄三態：轉盤中、持有、空 */
export type ItemSlot = 'rolling' | 'item' | 'empty'
export function itemSlotView(item: ItemKind | null, rolling: boolean): ItemSlot {
  if (rolling) return 'rolling'
  return item ? 'item' : 'empty'
}

/** 最佳圈是否刷新（第一次有、或變快） */
export function bestLapImproved(prev: number | null, next: number | null): boolean {
  if (next === null) return false
  return prev === null || next < prev
}

/** bot 的實體 id 一律 bot- 開頭（raceRules/roster） */
export function isRaceBotId(id: string): boolean {
  return id.startsWith('bot-')
}

export interface RaceResultRow {
  id: string
  name: string
  colorIndex: 0 | 1 | 2 | 3
  rank: number
  tone: RankTone
  isSelf: boolean
  isBot: boolean
  /** 總時間；null 表示還在衝線 */
  time: string | null
  best: string
}

/** 衝線名次表：依名次排序（同名次依 id），自己依 selfId 判定 */
export function resultRows(results: readonly RaceHudResult[], selfId: string | null): RaceResultRow[] {
  return [...results]
    .sort((a, b) => a.rank - b.rank || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((r) => ({
      id: r.id,
      name: r.name,
      colorIndex: r.colorIndex,
      rank: rankOf(r.rank),
      tone: rankTone(r.rank),
      isSelf: r.id === selfId,
      isBot: isRaceBotId(r.id),
      time: r.totalMs === null ? null : formatLapMs(r.totalMs),
      best: formatLapMs(r.bestLapMs),
    }))
}
