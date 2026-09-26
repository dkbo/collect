import { describe, expect, it } from 'vitest'
import { noDegradeFlag, pickTier, tierQuery } from '@/babylon/fx/quality'

describe('quality 以 key 區分遊戲的網址參數', () => {
  it("key='kitchen' 讀 kitchenTier／kitchenNoDegrade", () => {
    const q = tierQuery('', '#/battle?kitchenTier=mobile&kitchenNoDegrade=1')
    expect(pickTier({ search: q, touch: false, cores: 16 }, 'kitchen')).toBe('mobile')
    expect(noDegradeFlag(q, 'kitchen')).toBe(true)
  })
  it('別的遊戲的參數互不影響', () => {
    const q = '?bomberTier=mobile&bomberNoDegrade=1'
    expect(pickTier({ search: q, touch: false, cores: 16 }, 'kitchen')).toBe('desktop')
    expect(noDegradeFlag(q, 'kitchen')).toBe(false)
    expect(pickTier({ search: '?kitchenTier=mobile', touch: false, cores: 16 }, 'bomber')).toBe('desktop')
  })
  it("key='bomber' 行為同既有預設", () => {
    expect(pickTier({ search: '?bomberTier=mobile', touch: false, cores: 16 }, 'bomber')).toBe('mobile')
    expect(noDegradeFlag('?bomberNoDegrade=1', 'bomber')).toBe(true)
  })
})
