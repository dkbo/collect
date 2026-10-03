import { describe, it, expect } from 'vitest'
import { roadStrip } from '@/babylon/games/raceFx/raceGeom'
import { RACE_COURSE } from '@/babylon/games/raceRules/trackData'
import { trackProgress } from '@/babylon/games/raceRules/track'

const T = RACE_COURSE.track

describe('roadStrip（閉合路面帶）', () => {
  const g = roadStrip(T, T.width / 2, 0.02)
  const n = T.pts.length

  it('每個取樣點左右各一個頂點、每段兩個三角形（閉合）', () => {
    expect(g.positions).toHaveLength(n * 2 * 3)
    expect(g.indices).toHaveLength(n * 6)
    expect(Math.max(...g.indices)).toBe(n * 2 - 1)
    expect(g.uvs).toHaveLength(n * 2 * 2)
  })

  it('頂點落在中心線兩側 ±半寬、高度為 y', () => {
    for (let i = 0; i < n; i += 37) {
      for (const side of [0, 1]) {
        const k = (i * 2 + side) * 3
        expect(g.positions[k + 1]).toBe(0.02)
        const p = trackProgress(T, g.positions[k], g.positions[k + 2])
        expect(Math.abs(Math.abs(p.lateral) - T.width / 2)).toBeLessThan(0.5)
      }
    }
  })

  it('法線一律朝上（路面材質關背面剔除，繞向不影響光照）', () => {
    expect(g.normals).toHaveLength(n * 2 * 3)
    for (let i = 0; i < g.normals.length; i += 3) expect([g.normals[i], g.normals[i + 1], g.normals[i + 2]]).toEqual([0, 1, 0])
  })
})
