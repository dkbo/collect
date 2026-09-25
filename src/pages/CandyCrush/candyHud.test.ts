import { describe, expect, it } from 'vitest'
import {
  dialogFitScale,
  hudLayout,
  isCompactTopBar,
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

  it('兩側縮放低於 0.6（字太小）時也退回上方橫條', () => {
    // md 斷點附近 .rpg-screen ≈ 740×550（剛過 4:3）：k = (740 - 489) / 2 / 240 ≈ 0.52
    expect(hudLayout(740, 550)).toEqual({ mode: 'top', scale: 1 })
    // 縮放剛好 0.6 仍在兩側
    expect(hudLayout(576, 324).mode).toBe('side')
  })

  it('尺寸未知（0）時退回上方橫條', () => {
    expect(hudLayout(0, 0).mode).toBe('top')
  })
})

describe('isCompactTopBar', () => {
  it('橫條寬度放不下「LV＋步數球＋4 顆圓鈕」時改精簡排法（步數球移到第二列）', () => {
    // 320px 手機：.rpg-screen ≈ 248px
    expect(isCompactTopBar(248)).toBe(true)
    // 390px 手機：.rpg-screen ≈ 318px
    expect(isCompactTopBar(318)).toBe(false)
  })
})

describe('dialogFitScale', () => {
  it('放得下就不縮', () => {
    expect(dialogFitScale(486, 436)).toBe(1)
  })

  it('放不下時等比縮到剛好塞進可用高度', () => {
    // 390×844 最後一關：可用 346、卡片 390
    expect(dialogFitScale(346, 390)).toBeCloseTo(346 / 390, 5)
  })

  it('尺寸未知（0）時不縮', () => {
    expect(dialogFitScale(0, 0)).toBe(1)
    expect(dialogFitScale(300, 0)).toBe(1)
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

  it('1.5 倍非整數時無條件捨去（與 Godot level_manager int(1.5*target) 一致）', () => {
    expect(nextStarScore(1, 1001)).toBe(1501)
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
