import { describe, expect, it } from 'vitest'
import { uprightAxis } from '@/babylon/games/bomberFx/upright'

// bomber 的相機：ArcRotateCamera(α −π/2, β 0.55, r 30) → 位置 (0, 30cosβ, −30sinβ)，畫面上方 = (0, sinβ, cosβ)
const B = 0.55
const CAM: [number, number, number] = [0, 30 * Math.cos(B), -30 * Math.sin(B)]
const UP: [number, number, number] = [0, Math.sin(B), Math.cos(B)]
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

describe('uprightAxis（抵銷俯角透視的起伏位移：角色上軸在畫面上投影成直立）', () => {
  it('畫面正中那一欄不用傾斜', () => {
    const a = uprightAxis([0, 0, -10], CAM, UP)
    expect(a[0]).toBeCloseTo(0)
    expect(a[1]).toBeCloseTo(1)
    expect(a[2]).toBeCloseTo(0)
  })

  it('左下角（P1 出生角）往畫面中心側傾，上軸落在「視線 × 畫面上方」的平面內', () => {
    const p: [number, number, number] = [-12, 0, -10]
    const a = uprightAxis(p, CAM, UP)
    expect(a[0]).toBeGreaterThan(0.1)
    expect(Math.hypot(...a)).toBeCloseTo(1)
    const view = [CAM[0] - p[0], CAM[1] - p[1], CAM[2] - p[2]]
    expect(dot(a, cross(view, UP))).toBeCloseTo(0)
  })

  it('左右對稱：右下角往另一側傾', () => {
    const l = uprightAxis([-12, 0, -10], CAM, UP)
    const r = uprightAxis([12, 0, -10], CAM, UP)
    expect(r[0]).toBeCloseTo(-l[0])
    expect(r[1]).toBeCloseTo(l[1])
  })

  it('傾角有上限（預設 30°）', () => {
    const a = uprightAxis([-60, 0, -10], CAM, UP)
    expect(Math.acos(a[1])).toBeLessThanOrEqual((30 * Math.PI) / 180 + 1e-6)
  })
})

describe('uprightAxis 的 backTilt（往後仰、多露出正面，仍保持畫面直立）', () => {
  it('上軸離相機更遠、仍在同一平面內', () => {
    for (const p of [[0, 0, -10], [-12, 0, -10], [12, 0, 10]] as [number, number, number][]) {
      const view = [CAM[0] - p[0], CAM[1] - p[1], CAM[2] - p[2]]
      const a = uprightAxis(p, CAM, UP)
      const b = uprightAxis(p, CAM, UP, { backTilt: 0.35 })
      expect(dot(b, view)).toBeLessThan(dot(a, view))
      expect(dot(b, cross(view, UP))).toBeCloseTo(0)
      expect(Math.hypot(...b)).toBeCloseTo(1)
    }
  })

  it('畫面正中那一欄只往 +Z（遠離相機）仰', () => {
    const b = uprightAxis([0, 0, -10], CAM, UP, { backTilt: 0.35 })
    expect(b[0]).toBeCloseTo(0)
    expect(b[2]).toBeCloseTo(Math.sin(0.35))
  })
})
