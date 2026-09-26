import { describe, expect, it } from 'vitest'
import { PLAYER_PALETTE, hexToRgb } from '@/babylon/fx/palette'
import * as bomberPalette from '@/babylon/games/bomberFx/palette'

describe('fx/palette 共用色票', () => {
  it('PLAYER_PALETTE 固定 4 色（spec §4）', () => {
    expect(PLAYER_PALETTE.map((p) => p.base)).toEqual(['#FF3B4E', '#2F86FF', '#2FCF5E', '#FFC21A'])
    expect(PLAYER_PALETTE[1]).toEqual({ light: '#8CC4FF', base: '#2F86FF', dark: '#1446B8' })
  })
  it('bomberFx/palette 轉出的是同一份（不重複定義）', () => {
    expect(bomberPalette.PLAYER_PALETTE).toBe(PLAYER_PALETTE)
    expect(bomberPalette.hexToRgb).toBe(hexToRgb)
  })
  it('hexToRgb 轉成 0..1', () => {
    expect(hexToRgb('#2B2440')).toEqual([0x2b / 255, 0x24 / 255, 0x40 / 255])
  })
})
