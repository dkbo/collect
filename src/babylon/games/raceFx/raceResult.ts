/**
 * 賽車名次、最佳圈與結算表（純函式）。
 * 各端以同一份 own／botState 快照呼叫 liveOrder 得到相同名次；結算由 host 依觀察到的過線順序組表。
 */
import type { RaceStanding } from '@/babylon/games/raceFx/raceNet'
import { normalizeProgress, rankCars, type Track } from '@/babylon/games/raceRules/track'

export interface LiveCar {
  id: string
  lap: number
  cp: number
  s: number
  fin: number | null
}

/** 目前名次（第一名在前）：已過線依 fin 升冪，其餘依 normalizeProgress 後的圈數＋沿線距離 */
export function liveOrder(track: Track, cars: readonly LiveCar[]): string[] {
  return rankCars(
    cars.map((c) => {
      const n = normalizeProgress(track, c)
      return { id: c.id, lap: n.lap, s: n.s, finishedAt: c.fin }
    })
  )
}

export interface LapClock {
  /** 本圈開始時間 */
  startAt: number
  /** 已完成圈數 */
  lap: number
  lastMs: number | null
  bestMs: number | null
}

export const makeLapClock = (now: number): LapClock => ({ startAt: now, lap: 0, lastMs: null, bestMs: null })

/** 觀察到完成圈數增加時記一圈；不變或倒退原樣回傳 */
export function stepLapClock(c: LapClock, lap: number, now: number): LapClock {
  if (lap <= c.lap) return c
  const lastMs = now - c.startAt
  return { startAt: now, lap, lastMs, bestMs: c.bestMs === null ? lastMs : Math.min(c.bestMs, lastMs) }
}

export interface StandingCar extends LiveCar {
  name: string
  colorIndex: 0 | 1 | 2 | 3
}

/**
 * 結算表：finishOrder（host 觀察到 fin 由 null 變數值的先後）在前、總時間取該車 fin；
 * 有 fin 卻沒被觀察到的接在後面（依 fin）；未過線者依當下名次、totalMs null。
 */
export function finalStandings(
  track: Track,
  cars: readonly StandingCar[],
  finishOrder: readonly string[],
  bestLaps: Readonly<Record<string, number | null>>
): RaceStanding[] {
  const byId = new Map(cars.map((c) => [c.id, c]))
  const seen = finishOrder.filter((id, i) => byId.get(id)?.fin != null && finishOrder.indexOf(id) === i)
  const late = cars
    .filter((c) => c.fin !== null && !seen.includes(c.id))
    .sort((a, b) => (a.fin as number) - (b.fin as number) || (a.id < b.id ? -1 : 1))
    .map((c) => c.id)
  const rest = liveOrder(
    track,
    cars.filter((c) => c.fin === null)
  )
  return [...seen, ...late, ...rest].map((id, i) => {
    const c = byId.get(id) as StandingCar
    return { id, name: c.name, colorIndex: c.colorIndex, rank: i + 1, totalMs: c.fin, bestLapMs: bestLaps[id] ?? null }
  })
}

/** m:ss.cc；null 顯示 -- */
export function formatRaceMs(ms: number | null): string {
  if (ms === null) return '--'
  const cs = Math.floor(ms / 10)
  const m = Math.floor(cs / 6000)
  const s = Math.floor((cs % 6000) / 100)
  const c = cs % 100
  return `${m}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`
}
