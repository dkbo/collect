import { describe, it, expect } from 'vitest'
import { BOX_FACE_COLORS, DRIFT_COLORS, ITEM_COLORS, RACE } from '@/babylon/games/raceFx/palette'
import { ITEM_KINDS } from '@/babylon/games/raceRules/items'

const HEX = /^#[0-9A-F]{6}$/i

describe('raceFx/palette（spec §3.2／§3.3）', () => {
  it('場景色票全部是 #RRGGBB', () => {
    for (const [k, v] of Object.entries(RACE)) {
      const list = Array.isArray(v) ? v : [v]
      for (const c of list) expect(c, k).toMatch(HEX)
    }
  })

  it('關鍵色照 spec：天空、路面、路緣、加速帶', () => {
    expect(RACE.sky).toBe('#9ED8F5')
    expect(RACE.road).toBe('#5A5380')
    expect(RACE.curbRed).toBe('#F0503C')
    expect(RACE.boostPad).toBe('#FFB21F')
  })

  it('甩尾段位色 0..3 = 白／藍／橘／紫', () => {
    expect(DRIFT_COLORS).toEqual(['#FFFFFF', '#39C2FF', '#FF9A1F', '#C05CFF'])
  })

  it('4 種道具都有主色／暗階／點綴，道具箱 4 種面色', () => {
    for (const k of ITEM_KINDS) {
      expect(ITEM_COLORS[k].main).toMatch(HEX)
      expect(ITEM_COLORS[k].dark).toMatch(HEX)
      expect(ITEM_COLORS[k].accent).toMatch(HEX)
    }
    expect(BOX_FACE_COLORS).toHaveLength(4)
    for (const c of BOX_FACE_COLORS) expect(c).toMatch(HEX)
  })
})
