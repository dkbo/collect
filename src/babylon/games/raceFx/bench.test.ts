import { describe, it, expect } from 'vitest'
import { RACE_COURSE } from '@/babylon/games/raceRules/trackData'
import { trackProgress } from '@/babylon/games/raceRules/track'
import { ITEM_KINDS } from '@/babylon/games/raceRules/items'
import { benchEnabled, benchLayout } from '@/babylon/games/raceFx/bench'

describe('raceFx/bench（AC14 N1 量測場景）', () => {
  it('只在 raceBench=1 且 raceNoDegrade=1 時生效', () => {
    expect(benchEnabled('?raceBench=1&raceNoDegrade=1')).toBe(true)
    expect(benchEnabled('?raceBench=1')).toBe(false)
    expect(benchEnabled('?raceNoDegrade=1')).toBe(false)
    expect(benchEnabled('?tankBench=1&tankNoDegrade=1')).toBe(false)
    expect(benchEnabled('')).toBe(false)
  })

  it('每台車各持一種道具、香蕉 4 根、龜殼 2 顆擺在起跑線前方路面上', () => {
    const lay = benchLayout(RACE_COURSE)
    expect([...lay.held].sort()).toEqual([...ITEM_KINDS].sort())
    expect(lay.bananas).toHaveLength(4)
    expect(lay.shells).toHaveLength(2)
    for (const p of [...lay.bananas, ...lay.shells]) {
      const q = trackProgress(RACE_COURSE.track, p.x, p.z)
      expect(Math.abs(q.lateral)).toBeLessThan(RACE_COURSE.track.width / 2)
      expect(q.s).toBeGreaterThan(10)
      expect(q.s).toBeLessThan(60)
    }
  })
})
