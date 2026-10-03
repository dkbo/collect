/**
 * host 端場上道具（香蕉／龜殼）的推進與命中裁決（純函式）。
 * 產生的事件由 race.ts 廣播：gone → itemGone、spin → spin。guest 不跑這裡、不自判命中。
 */
import {
  bananaOverflow,
  hitTest,
  shellBananaClash,
  shellGone,
  spawnItem,
  stepShell,
  type HitCar,
} from '@/babylon/games/raceRules/items'
import type { Course } from '@/babylon/games/raceRules/track'
import type { ItemGoneReason } from '@/babylon/games/raceFx/raceNet'

export interface FieldEntry {
  id: string
  kind: 'banana' | 'shell'
  owner: string
  /** 龜殼追蹤目標；null = 直射（香蕉恆為 null） */
  target: string | null
  x: number
  z: number
  vx: number
  vz: number
  ageMs: number
}

export interface ItemField {
  /** 依生成先後 */
  items: FieldEntry[]
  nextId: number
}

export type FieldCar = HitCar

export type FieldEvent =
  | { type: 'gone'; id: string; reason: ItemGoneReason }
  | { type: 'spin'; target: string; ms: number; blocked: boolean }

export const emptyField = (): ItemField => ({ items: [], nextId: 0 })

/** 生成香蕉或龜殼；香蕉超過上限時回報被擠掉的最舊幾根（已從 field 移除） */
export function spawnField(
  f: ItemField,
  kind: 'banana' | 'shell',
  owner: string,
  car: { x: number; z: number; ry: number },
  target: string | null
): { field: ItemField; entry: FieldEntry; overflow: string[] } {
  const p = spawnItem(kind, car)
  const entry: FieldEntry = { id: `i${f.nextId}`, kind, owner, target: kind === 'shell' ? target : null, ...p, ageMs: 0 }
  let items = [...f.items, entry]
  let overflow: string[] = []
  if (kind === 'banana') {
    overflow = bananaOverflow(items.filter((it) => it.kind === 'banana').map((it) => it.id))
    if (overflow.length) items = items.filter((it) => !overflow.includes(it.id))
  }
  return { field: { items, nextId: f.nextId + 1 }, entry, overflow }
}

/** 一個 tick：龜殼移動 → 壽命／出界 → 撞香蕉 → 命中各車。不改動輸入 */
export function stepField(
  f: ItemField,
  cars: readonly FieldCar[],
  course: Course,
  dt: number
): { field: ItemField; events: FieldEvent[] } {
  const events: FieldEvent[] = []
  const dead = new Set<string>()
  const pos = new Map(cars.map((c) => [c.id, c]))
  let items = f.items.map((it): FieldEntry => {
    if (it.kind === 'banana') return { ...it, ageMs: it.ageMs + dt * 1000 }
    const tp = it.target ? (pos.get(it.target) ?? null) : null
    const sh = stepShell({ ...it }, tp, course.track, dt)
    return { ...it, x: sh.x, z: sh.z, vx: sh.vx, vz: sh.vz, ageMs: sh.ageMs }
  })

  for (const it of items) {
    if (it.kind !== 'shell') continue
    if (shellGone(it, course)) {
      dead.add(it.id)
      events.push({ type: 'gone', id: it.id, reason: 'expire' })
      continue
    }
    const ban = shellBananaClash(
      it,
      items.filter((b) => b.kind === 'banana' && !dead.has(b.id))
    )
    if (ban) {
      dead.add(it.id)
      dead.add(ban)
      events.push({ type: 'gone', id: ban, reason: 'clash' }, { type: 'gone', id: it.id, reason: 'clash' })
    }
  }
  items = items.filter((it) => !dead.has(it.id))

  const hitIds = new Set<string>()
  for (const it of items) {
    const hit = hitTest(it, cars)
    if (!hit) continue
    hitIds.add(it.id)
    events.push({ type: 'spin', ...hit }, { type: 'gone', id: it.id, reason: 'hit' })
  }
  items = items.filter((it) => !hitIds.has(it.id))
  return { field: { items, nextId: f.nextId }, events }
}
