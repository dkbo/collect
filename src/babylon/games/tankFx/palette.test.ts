import { describe, expect, it } from 'vitest'
import { ITEM_COLORS, ITEM_ORDER, TANK } from '@/babylon/games/tankFx/palette'
import { ITEM_KINDS } from '@/babylon/games/tankFx/combat'

const HEX = /^#[0-9A-F]{6}$/i

describe('tankFx palette（spec §2.2／§2.3）', () => {
  it('五種道具都有底色、唇色與圖示色', () => {
    expect([...ITEM_ORDER].sort()).toEqual([...ITEM_KINDS].sort())
    for (const k of ITEM_KINDS) {
      expect(ITEM_COLORS[k].shell).toMatch(HEX)
      expect(ITEM_COLORS[k].lip).toMatch(HEX)
      expect(ITEM_COLORS[k].icon).toMatch(HEX)
    }
  })
  it('場景色都是合法 hex', () => {
    for (const v of Object.values(TANK)) expect(v).toMatch(HEX)
  })
  it('地面跟 bomber 草綠拉開、場外底色照 spec', () => {
    expect(TANK.groundA).toBe('#A9B67F')
    expect(TANK.void).toBe('#22302C')
  })
})
