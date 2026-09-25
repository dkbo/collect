import { describe, expect, it } from 'vitest'
import { PLAYER_PALETTE } from '@/babylon/games/bomberFx/palette'
import { BOMBER_COLORS } from '@/pages/Battle/bomberHud'

describe('BOMBER_COLORS 與 3D 色票同源', () => {
  it('直接取用 bomberFx/palette 的 PLAYER_PALETTE，不另存一份', () => {
    expect(BOMBER_COLORS).toBe(PLAYER_PALETTE)
  })
})
