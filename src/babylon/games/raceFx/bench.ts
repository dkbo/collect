/**
 * 效能量測場景（AC14 N1，純函式）：`?raceBench=1` 且 `?raceNoDegrade=1` 時，每台車各持一種道具、
 * 起跑線前方路面擺 4 根香蕉與 2 顆龜殼。只是視覺擺設（不進 host 的場上道具、不會命中），固定 draw call 量測條件。
 */
import { placeAt, type Course } from '@/babylon/games/raceRules/track'
import { ITEM_KINDS, type ItemKind } from '@/babylon/games/raceRules/items'

/** search 為合併過 hash 的 query（fx/quality 的 tierQuery） */
export function benchEnabled(search: string): boolean {
  const q = new URLSearchParams(search)
  return q.get('raceBench') === '1' && q.get('raceNoDegrade') === '1'
}

export interface BenchLayout {
  /** 依實體序（自己、他人、bot）各持一種 */
  held: ItemKind[]
  bananas: { x: number; z: number }[]
  shells: { x: number; z: number }[]
}

export function benchLayout(course: Course): BenchLayout {
  const t = course.track
  const at = (s: number, lat: number) => {
    const p = placeAt(t, s, lat)
    return { x: p.x, z: p.z }
  }
  return {
    held: [...ITEM_KINDS],
    bananas: [at(18, -3), at(22, 2), at(26, -1), at(30, 3.5)],
    shells: [at(24, 0), at(34, -2.5)],
  }
}
