import { describe, expect, it } from 'vitest'
import { serveData } from '@/babylon/games/kitchenFx/models'
import { hexToRgb, OUTLINE } from '@/babylon/fx/palette'

describe('serveData：出餐台的「>>」箭頭', () => {
  it('每個箭頭兩條斜桿在 +x 那端收成尖角（指向遠離瀝架的 +x），開口朝 −x', () => {
    const d = serveData()
    const [r, g, b] = hexToRgb(OUTLINE)
    const pts: { x: number; z: number }[] = []
    for (let i = 0; i < d.positions.length / 3; i++) {
      const c = d.colors!.slice(i * 4, i * 4 + 3)
      if (Math.abs(c[0] - r) + Math.abs(c[1] - g) + Math.abs(c[2] - b) > 1e-3) continue
      pts.push({ x: d.positions[i * 3], z: d.positions[i * 3 + 2] })
    }
    expect(pts.length).toBeGreaterThan(0)
    // 尖角＝貼近中線的點（|z| 小），開口＝離中線遠的點；「>>」的尖角一定在開口的 +x 側
    // （兩個箭頭的 x 範圍互相重疊，所以不按箭頭切，改比兩群點的平均 x）
    const tips = pts.filter((p) => Math.abs(p.z) < 0.06)
    const ends = pts.filter((p) => Math.abs(p.z) > 0.27)
    const avg = (xs: { x: number }[]) => xs.reduce((t, p) => t + p.x, 0) / xs.length
    expect(tips.length).toBeGreaterThan(0)
    expect(ends.length).toBeGreaterThan(0)
    expect(avg(tips) - avg(ends)).toBeGreaterThan(0.2)
  })
})
