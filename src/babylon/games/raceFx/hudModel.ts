/**
 * 賽車 React HUD 的資料（共用契約 RaceHud，純函式）：名次、圈數、時間、道具欄、小地圖、衝線名次表。
 * 量化規則照契約：車點 0.1、時間 10ms；map.pts 由呼叫端開局算一次後原參照傳入（React 以參照比對不重算）。
 */
import type { RaceHud, RaceHudCar, RaceHudResult } from '@/babylon/types'
import type { ItemKind } from '@/babylon/games/raceRules/items'

/** 道具欄轉盤時長（spec §9.2 建議 900ms） */
export const ROLL_MS = 900

export const q01 = (v: number): number => Math.round(v * 10) / 10 || 0
export const q10ms = (ms: number | null): number | null => (ms === null ? null : Math.floor(ms / 10) * 10)

/** 小地圖輪廓：等距抽樣到 ≤ maxPts 點並量化 0.1（首尾不重複） */
export function mapOutline(pts: readonly [number, number][], maxPts: number): [number, number][] {
  const step = Math.max(1, Math.ceil(pts.length / maxPts))
  const out: [number, number][] = []
  for (let i = 0; i < pts.length; i += step) out.push([q01(pts[i][0]), q01(pts[i][1])])
  return out
}

export interface RaceHudCarInput {
  id: string
  colorIndex: 0 | 1 | 2 | 3
  x: number
  z: number
  fin: number | null
  name: string
  bestLapMs: number | null
}

export interface RaceHudInput {
  selfId: string
  /** 名次順序（liveOrder） */
  order: readonly string[]
  laps: number
  /** 自己已完成的圈數（own.lap，0..laps） */
  ownLap: number
  lapMs: number
  bestLapMs: number | null
  item: ItemKind | null
  /** 撿到道具時 now + ROLL_MS */
  rollingUntil: number
  now: number
  wrongWay: boolean
  fin: number | null
  pts: [number, number][]
  cars: readonly RaceHudCarInput[]
}

export function buildRaceHud(i: RaceHudInput): RaceHud {
  const idx = i.order.indexOf(i.selfId)
  const finished = i.fin !== null
  const cars: RaceHudCar[] = i.cars.map((c) => ({ id: c.id, colorIndex: c.colorIndex, x: q01(c.x), z: q01(c.z), isSelf: c.id === i.selfId }))
  let results: RaceHudResult[] = []
  if (finished) {
    const rankOf = (id: string) => {
      const k = i.order.indexOf(id)
      return k < 0 ? i.order.length + 1 : k + 1
    }
    results = i.cars
      .map((c) => ({ id: c.id, name: c.name, colorIndex: c.colorIndex, rank: rankOf(c.id), totalMs: q10ms(c.fin), bestLapMs: q10ms(c.bestLapMs) }))
      .sort((a, b) => a.rank - b.rank)
  }
  return {
    kind: 'race',
    rank: idx < 0 ? 1 : idx + 1,
    total: Math.max(1, i.order.length),
    lap: Math.min(i.ownLap + 1, i.laps),
    laps: i.laps,
    lapMs: q10ms(Math.max(0, i.lapMs)) ?? 0,
    bestLapMs: q10ms(i.bestLapMs),
    item: i.item,
    rolling: i.item !== null && i.now < i.rollingUntil,
    wrongWay: i.wrongWay,
    finalLap: i.ownLap === i.laps - 1 && !finished,
    finished,
    map: { pts: i.pts, cars },
    results,
  }
}
