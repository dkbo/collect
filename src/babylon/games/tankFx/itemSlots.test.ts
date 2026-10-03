import { describe, it, expect } from 'vitest'
import { ThinSlots } from '@/babylon/fx/thinSlots'
import { alignIconSlots } from '@/babylon/games/tankFx/itemSlots'

const ICON: Record<string, number> = { a: 0, b: 1, c: 2, d: 3 }
const iconOf = (k: string) => ICON[k]
const iconAt = (icons: ThinSlots<string>, k: string) => icons.buffer[icons.slotOf(k)!]

describe('alignIconSlots — 道具圖示與 matrix slot 一一對應', () => {
  it('同樣的操作順序（含中間 remove 的 swap）已對齊：不重建', () => {
    const m = new ThinSlots<string>(2)
    const ic = new ThinSlots<string>(2, 1)
    for (const k of ['a', 'b', 'c']) {
      m.add(k)
      ic.add(k)
      ic.write(k, (buf, o) => (buf[o] = iconOf(k)))
    }
    m.remove('a')
    ic.remove('a')
    expect(alignIconSlots(m, ic, iconOf)).toBe(false)
    expect(m.keys().map((k) => iconAt(ic, k))).toEqual(m.keys().map(iconOf))
  })

  it('順序走歪（只動了其中一邊）：依 matrix 順序重建，每個 slot 圖示正確', () => {
    const m = new ThinSlots<string>(4)
    const ic = new ThinSlots<string>(4, 1)
    for (const k of ['a', 'b', 'c']) m.add(k)
    for (const k of ['c', 'a', 'd']) {
      ic.add(k)
      ic.write(k, (buf, o) => (buf[o] = iconOf(k)))
    }
    expect(alignIconSlots(m, ic, iconOf)).toBe(true)
    expect(ic.count).toBe(3)
    m.keys().forEach((k, i) => {
      expect(ic.slotOf(k)).toBe(i)
      expect(ic.buffer[i]).toBe(iconOf(k))
    })
  })
})
