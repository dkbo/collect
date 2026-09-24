import { describe, expect, it } from 'vitest'
import {
  hudLayout,
  isLowMoves,
  nextStarScore,
  progressPercent,
  resultSubtitle,
} from '@/pages/CandyCrush/candyHud'

describe('hudLayout', () => {
  it('16:9 設計尺寸：兩側、縮放 1', () => {
    expect(hudLayout(960, 540)).toEqual({ mode: 'side', scale: 1 })
  })

  it('剛好 4:3 仍在兩側，縮放受側欄空間限制', () => {
    const { mode, scale } = hudLayout(1024, 768)
    expect(mode).toBe('side')
    // 側欄空間 = (1024 - 480 * 768 / 540) / 2 ≈ 170.7，設計寬 240
    expect(scale).toBeCloseTo(170.67 / 240, 2)
  })

  it('1920×1080 放大 2 倍', () => {
    expect(hudLayout(1920, 1080)).toEqual({ mode: 'side', scale: 2 })
  })

  it('寬高比 < 4:3 退回上方橫條', () => {
    expect(hudLayout(1000, 800).mode).toBe('top')
    expect(hudLayout(320, 450).mode).toBe('top')
  })

  it('尺寸未知（0）時退回上方橫條', () => {
    expect(hudLayout(0, 0).mode).toBe('top')
  })
})

describe('progressPercent', () => {
  it('滿格 = 2 倍目標，封頂 100', () => {
    expect(progressPercent(2000, 4000)).toBe(25)
    expect(progressPercent(9000, 4000)).toBe(100)
  })

  it('目標為 0 時為 0', () => {
    expect(progressPercent(100, 0)).toBe(0)
  })
})

describe('nextStarScore', () => {
  it('依已得星數回傳下一顆星門檻（1× / 1.5× / 2× 目標）', () => {
    expect(nextStarScore(0, 4000)).toBe(4000)
    expect(nextStarScore(1, 4000)).toBe(6000)
    expect(nextStarScore(2, 4000)).toBe(8000)
  })

  it('1.5 倍非整數時無條件進位', () => {
    expect(nextStarScore(1, 1001)).toBe(1502)
  })

  it('三星時沒有下一顆', () => {
    expect(nextStarScore(3, 4000)).toBeNull()
  })
})

describe('isLowMoves', () => {
  it('步數 ≤ 5 為警示', () => {
    expect(isLowMoves(5)).toBe(true)
    expect(isLowMoves(6)).toBe(false)
  })
})

describe('resultSubtitle', () => {
  it('二星：目標與距第三顆星的差距', () => {
    expect(resultSubtitle(6420, 4000, 2)).toBe('目標 4,000 · 再 1,580 分拿第三顆星')
  })

  it('一星：距第二顆星', () => {
    expect(resultSubtitle(4500, 4000, 1)).toBe('目標 4,000 · 再 1,500 分拿第二顆星')
  })

  it('三星：完美通關', () => {
    expect(resultSubtitle(8000, 4000, 3)).toBe('完美通關！')
  })

  it('零星（失敗）：距目標', () => {
    expect(resultSubtitle(3000, 4000, 0)).toBe('目標 4,000 · 還差 1,000 分過關')
  })
})
