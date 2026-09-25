import { describe, expect, it } from 'vitest'
import { noDegradeFlag, pickTier, tierQuery } from '@/babylon/games/bomberFx/quality'

describe('tierQuery（檔位參數同時讀 location.search 與 hash 路由內的 query）', () => {
  it('hash 路由的 query 也讀得到', () => {
    const q = tierQuery('', '#/battle?bomberTier=mobile&bomberNoDegrade=1')
    expect(pickTier({ search: q, touch: false, cores: 16 })).toBe('mobile')
    expect(noDegradeFlag(q)).toBe(true)
  })

  it('search 與 hash 都有時以 search 為準', () => {
    const q = tierQuery('?bomberTier=desktop', '#/battle?bomberTier=mobile')
    expect(pickTier({ search: q, touch: true, cores: 2 })).toBe('desktop')
  })

  it('沒有 query 的 hash 不影響', () => {
    expect(tierQuery('?bomberNoDegrade=1', '#/battle')).toContain('bomberNoDegrade=1')
    expect(tierQuery('', '')).toBe('')
  })
})
