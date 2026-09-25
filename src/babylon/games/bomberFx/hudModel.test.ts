import { describe, expect, it } from 'vitest'
import { buildBomberHud, quantizeInvincible, suddenDeathSeconds } from '@/babylon/games/bomberFx/hudModel'

describe('quantizeInvincible（量化到 100ms，避免每幀重繪）', () => {
  it('無條件進位到 100ms，0 以下為 0', () => {
    expect(quantizeInvincible(0)).toBe(0)
    expect(quantizeInvincible(-50)).toBe(0)
    expect(quantizeInvincible(1)).toBe(100)
    expect(quantizeInvincible(6901)).toBe(7000)
    expect(quantizeInvincible(7000)).toBe(7000)
  })
})

describe('suddenDeathSeconds', () => {
  it('playing 前顯示完整 40 秒', () => {
    expect(suddenDeathSeconds({ now: 1000, playingSince: 0, suddenMs: 40000 })).toEqual({ secondsLeft: 40, suddenDeath: false })
  })

  it('playing 中量化到整秒（無條件進位）', () => {
    expect(suddenDeathSeconds({ now: 10500, playingSince: 1000, suddenMs: 40000 })).toEqual({ secondsLeft: 31, suddenDeath: false })
    expect(suddenDeathSeconds({ now: 41000, playingSince: 1000, suddenMs: 40000 })).toEqual({ secondsLeft: 0, suddenDeath: false })
  })

  it('超過 40 秒進入突然死亡，secondsLeft 歸 0', () => {
    expect(suddenDeathSeconds({ now: 41001, playingSince: 1000, suddenMs: 40000 })).toEqual({ secondsLeft: 0, suddenDeath: true })
  })
})

describe('buildBomberHud', () => {
  const base = {
    entities: [
      { id: 'me', name: '我', isAI: false, colorIndex: 0 as const },
      { id: 'bot-0', name: '電腦1', isAI: true, colorIndex: 1 as const },
    ],
    selfId: 'me',
    now: 5000,
    timer: { secondsLeft: 12, suddenDeath: false },
    alive: (id: string) => id === 'me',
    wins: (id: string) => (id === 'bot-0' ? 2 : 0),
    stat: (id: string) =>
      id === 'me'
        ? { bombs: 2, fire: 3, speed: 1, kick: true, throw: false, invincibleUntil: 6234 }
        : { bombs: 1, fire: 1, speed: 0, kick: false, throw: true, invincibleUntil: 0 },
  }

  it('依實體序列出玩家卡，帶顏色、AI、自己、存活與能力值', () => {
    const hud = buildBomberHud(base)
    expect(hud.aliveCount).toBe(1)
    expect(hud.totalCount).toBe(2)
    expect(hud.timer).toEqual({ secondsLeft: 12, suddenDeath: false })
    expect(hud.players[0]).toEqual({
      id: 'me', name: '我', colorIndex: 0, isSelf: true, isAI: false, alive: true,
      wins: 0, bombs: 2, fire: 3, speed: 1, kick: true, throw: false, invincibleMs: 1300,
    })
    expect(hud.players[1]).toMatchObject({ isAI: true, isSelf: false, alive: false, wins: 2, throw: true, invincibleMs: 0 })
  })

  it('每次回傳新物件（不共用上一次的參照）', () => {
    const a = buildBomberHud(base)
    const b = buildBomberHud(base)
    expect(a).not.toBe(b)
    expect(a.players).not.toBe(b.players)
    expect(a.timer).not.toBe(b.timer)
    expect(a).toEqual(b)
  })

  it('同一秒、同一個 100ms 內內容相同（量化後不會每幀變）', () => {
    const a = buildBomberHud({ ...base, now: 5001 })
    const b = buildBomberHud({ ...base, now: 5030 })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})
