/**
 * 廚房特效的判定（kitchen spec §7；純函式，可在 node 單測）：站點狀態分期、快焦脈動與煙量、
 * guest 端進度外插、拾取／放下弧線、前後兩張 view 的站點事件。什麼時候畫、怎麼畫在 effects.ts。
 */
import { CHOP_MS, COOK_MS, type Item, type SlotView, type StationKind } from '@/babylon/games/overcookedKitchen'
import { clamp01 } from '@/babylon/fx/curves'

export type PotPhase = 'empty' | 'cooking' | 'done' | 'alarm' | 'burnt'
export type BoardPhase = 'empty' | 'chopping' | 'done'

/**
 * 鍋的狀態。快焦（裁決⑥）：soup 的 busyUntil 是焦掉期限（OVERCOOK_MS），但 buildView 以 COOK_MS 當分母，
 * 所以煮好的前 2 秒 progress 為 0（煮好）、最後 3 秒 0→1（快焦）。
 */
export function potPhase(item: Item | null, progress: number): PotPhase {
  if (!item) return 'empty'
  if (item.kind === 'chop') return 'cooking'
  if (item.kind === 'soup') return progress > 0 ? 'alarm' : 'done'
  if (item.kind === 'burnt') return 'burnt'
  return 'empty'
}

export function boardPhase(item: Item | null): BoardPhase {
  if (item?.kind === 'raw') return 'chopping'
  if (item?.kind === 'chop') return 'done'
  return 'empty'
}

/** 快焦鍋緣脈動頻率：2Hz → 6Hz */
export const ALARM_HZ = [2, 6] as const
export const alarmHz = (progress: number): number => ALARM_HZ[0] + (ALARM_HZ[1] - ALARM_HZ[0]) * clamp01(progress)
const TAU = Math.PI * 2
/**
 * 快焦脈動相位：每鍋自己累加 phase += 2π·hz·dt（進 alarm 時由呼叫端歸零）。
 * 不能用 sin(2π·hz(t)·t)：hz 隨時間變時瞬時頻率會變成 hz + t·dhz/dt，t 是頁面載入起算的秒數，越久越亂閃。
 * 單幀最多算 100ms（切分頁回來不暴衝）。
 */
export function advanceAlarmPhase(phase: number, progress: number, dtMs: number): number {
  const next = phase + TAU * alarmHz(progress) * (Math.min(Math.max(0, dtMs), 100) / 1000)
  return ((next % TAU) + TAU) % TAU
}
/** 相位 → 脈動 0..1（相位 0 時 0.5） */
export const alarmPulse = (phase: number): number => 0.5 + 0.5 * Math.sin(phase)
/** 快焦灰黑煙每秒顆數：4 → 20 */
export const alarmSmokeRate = (progress: number): number => 4 + 16 * clamp01(progress)

/** 外插上限：快照斷掉時進度不會一路衝到底 */
export const EXTRAPOLATE_MAX_MS = 400

/**
 * guest 端進度外插：快照只有 8Hz，兩張之間用 age（收到這張後經過的毫秒）往前推，收到下一張自然校正。
 * 煮好的前 2 秒（soup 且 progress 0）不推：看不出快焦何時開始，等快照帶出 > 0 再接手。
 */
export function extrapolateProgress(kind: StationKind, item: Item | null, progress: number, ageMs: number): number {
  if (!item || progress >= 1) return progress
  const age = Math.min(EXTRAPOLATE_MAX_MS, Math.max(0, ageMs))
  let total = 0
  if (kind === 'board' && item.kind === 'raw') total = CHOP_MS
  else if (kind === 'pot' && item.kind === 'chop') total = COOK_MS
  else if (kind === 'pot' && item.kind === 'soup' && progress > 0) total = COOK_MS
  if (total === 0) return progress
  return Math.min(1, progress + age / total)
}

export interface P3 {
  x: number
  y: number
  z: number
}

/** 拾取／放下：起訖直線插值，再加一段 sin 拱起（頂點高 h） */
export function arcPoint(a: P3, b: P3, t: number, h: number): P3 {
  const u = clamp01(t)
  return {
    x: a.x + (b.x - a.x) * u,
    y: a.y + (b.y - a.y) * u + h * Math.sin(Math.PI * u),
    z: a.z + (b.z - a.z) * u,
  }
}

export type SlotEventType = 'chopStart' | 'chopDone' | 'cookStart' | 'cookDone' | 'burnt'
export interface SlotEvent {
  type: SlotEventType
  id: string
}

/** 站點事件：只看物品 kind 的轉變（host 與 guest 看到的一樣）；id 前綴 board／pot 判站點種類 */
export function slotEvents(prev: readonly SlotView[], next: readonly SlotView[]): SlotEvent[] {
  const before = new Map(prev.map((s) => [s.id, s.item?.kind ?? null]))
  const out: SlotEvent[] = []
  for (const s of next) {
    const a = before.get(s.id) ?? null
    const b = s.item?.kind ?? null
    if (a === b) continue
    const id = s.id
    if (id.startsWith('board')) {
      if (b === 'raw') out.push({ type: 'chopStart', id })
      else if (a === 'raw' && b === 'chop') out.push({ type: 'chopDone', id })
    } else if (id.startsWith('pot')) {
      if (b === 'chop') out.push({ type: 'cookStart', id })
      else if (a === 'chop' && b === 'soup') out.push({ type: 'cookDone', id })
      else if (b === 'burnt') out.push({ type: 'burnt', id })
    }
  }
  return out
}
