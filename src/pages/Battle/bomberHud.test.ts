import { describe, expect, it } from 'vitest'
import type { GameHud, GameHudPlayer } from '@/babylon/types'
import {
  BOMBER_COLORS,
  formatTimer,
  hudScale,
  invincibleSeconds,
  playerLabel,
  sameHud,
  splitColumns,
  timerView,
  winStars,
} from '@/pages/Battle/bomberHud'

function player(colorIndex: 0 | 1 | 2 | 3, extra: Partial<GameHudPlayer> = {}): GameHudPlayer {
  return {
    id: `p${colorIndex}`,
    name: `玩家${colorIndex + 1}`,
    colorIndex,
    isSelf: false,
    isAI: false,
    alive: true,
    wins: 0,
    bombs: 1,
    fire: 2,
    speed: 0,
    kick: false,
    throw: false,
    invincibleMs: 0,
    ...extra,
  }
}

function hud(extra: Partial<GameHud> = {}): GameHud {
  return {
    timer: { secondsLeft: 24, suddenDeath: false },
    aliveCount: 4,
    totalCount: 4,
    players: [player(0), player(1), player(2), player(3)],
    ...extra,
  }
}

describe('formatTimer', () => {
  it('分:秒兩位數，小數無條件進位', () => {
    expect(formatTimer(24)).toBe('0:24')
    expect(formatTimer(23.2)).toBe('0:24')
    expect(formatTimer(40)).toBe('0:40')
    expect(formatTimer(65)).toBe('1:05')
  })

  it('負數與非有限值夾到 0:00', () => {
    expect(formatTimer(-3)).toBe('0:00')
    expect(formatTimer(Number.NaN)).toBe('0:00')
  })
})

describe('timerView', () => {
  it('一般倒數', () => {
    expect(timerView({ secondsLeft: 24, suddenDeath: false })).toEqual({ mode: 'normal', text: '0:24' })
  })

  it('剩 10 秒內（含）變 urgent', () => {
    expect(timerView({ secondsLeft: 10, suddenDeath: false }).mode).toBe('urgent')
    expect(timerView({ secondsLeft: 0.4, suddenDeath: false }).mode).toBe('urgent')
    expect(timerView({ secondsLeft: 10.2, suddenDeath: false }).mode).toBe('normal')
  })

  it('突然死亡時忽略 secondsLeft，改顯示縮圈中', () => {
    expect(timerView({ secondsLeft: 5, suddenDeath: true })).toEqual({ mode: 'sudden', text: '縮圈中' })
  })
})

describe('splitColumns', () => {
  it('左欄 P1／P3、右欄 P2／P4，與輸入順序無關', () => {
    const { left, right } = splitColumns([player(3), player(1), player(2), player(0)])
    expect(left.map((p) => p.colorIndex)).toEqual([0, 2])
    expect(right.map((p) => p.colorIndex)).toEqual([1, 3])
  })

  it('只有兩人時右欄只剩 P2', () => {
    const { left, right } = splitColumns([player(1), player(0)])
    expect(left.map((p) => p.colorIndex)).toEqual([0])
    expect(right.map((p) => p.colorIndex)).toEqual([1])
  })
})

describe('playerLabel', () => {
  it('P 編號 = colorIndex + 1', () => {
    expect(playerLabel(0)).toBe('P1')
    expect(playerLabel(3)).toBe('P4')
  })
})

describe('winStars', () => {
  it('3 顆星，已得的在前', () => {
    expect(winStars(0)).toEqual([false, false, false])
    expect(winStars(2)).toEqual([true, true, false])
  })

  it('超過 3 勝或負數都夾住', () => {
    expect(winStars(5)).toEqual([true, true, true])
    expect(winStars(-1)).toEqual([false, false, false])
  })
})

describe('invincibleSeconds', () => {
  it('毫秒無條件進位成秒，0 以下為 0', () => {
    expect(invincibleSeconds(6100)).toBe(7)
    expect(invincibleSeconds(1)).toBe(1)
    expect(invincibleSeconds(0)).toBe(0)
    expect(invincibleSeconds(-50)).toBe(0)
  })
})

describe('hudScale', () => {
  it('960×540 設計尺寸縮放 1', () => {
    expect(hudScale(960, 540)).toBe(1)
  })

  it('取寬高兩者較小的比例', () => {
    expect(hudScale(960, 432)).toBeCloseTo(0.8)
    expect(hudScale(1918, 864)).toBeCloseTo(1.6)
  })

  it('夾在 0.5–2 之間，0 尺寸不回 0', () => {
    expect(hudScale(3840, 2160)).toBe(2)
    expect(hudScale(200, 100)).toBe(0.5)
    expect(hudScale(0, 0)).toBe(1)
  })
})

describe('sameHud', () => {
  it('內容相同視為相同（不同參照）', () => {
    expect(sameHud(hud(), hud())).toBe(true)
  })

  it('任一欄位不同即不同', () => {
    expect(sameHud(hud(), hud({ aliveCount: 3 }))).toBe(false)
    const changed = hud()
    changed.players[2] = player(2, { bombs: 2 })
    expect(sameHud(hud(), changed)).toBe(false)
  })

  it('null 只等於 null', () => {
    expect(sameHud(null, null)).toBe(true)
    expect(sameHud(null, hud())).toBe(false)
  })
})

describe('BOMBER_COLORS', () => {
  it('固定 4 色對應 spec §4 本色', () => {
    expect(BOMBER_COLORS.map((c) => c.base)).toEqual(['#FF3B4E', '#2F86FF', '#2FCF5E', '#FFC21A'])
  })
})
