import { describe, expect, it } from 'vitest'
import { buildBomberHud, phaseTimer } from '@/babylon/games/bomberFx/hudModel'

describe('buildBomberHud：陣亡玩家不帶無敵', () => {
  it('陣亡玩家 invincibleMs 回 0，存活者照算', () => {
    const hud = buildBomberHud({
      entities: [
        { id: 'me', name: '我', isAI: false, colorIndex: 0 },
        { id: 'bot-0', name: '電腦1', isAI: true, colorIndex: 1 },
      ],
      selfId: 'me',
      now: 5000,
      timer: { secondsLeft: 12, suddenDeath: false },
      alive: (id) => id === 'me',
      wins: () => 0,
      stat: () => ({ bombs: 1, fire: 1, speed: 0, kick: false, throw: false, invincibleUntil: 7000 }),
    })
    expect(hud.players[0].invincibleMs).toBe(2000)
    expect(hud.players[1].invincibleMs).toBe(0)
  })
})

describe('phaseTimer：結算階段凍結最後的值', () => {
  const base = { now: 20000, playingSince: 1000, suddenMs: 40000 }

  it('playing 照算距突然死亡倒數', () => {
    expect(phaseTimer({ ...base, phase: 'playing', last: null })).toEqual({ secondsLeft: 21, suddenDeath: false })
  })

  it('result 沿用最後一次 playing 的值，不跳回完整時長', () => {
    const last = { secondsLeft: 17, suddenDeath: false }
    const t = phaseTimer({ ...base, phase: 'result', last })
    expect(t).toEqual(last)
    expect(t).not.toBe(last)
    expect(phaseTimer({ ...base, phase: 'result', last: { secondsLeft: 0, suddenDeath: true } })).toEqual({ secondsLeft: 0, suddenDeath: true })
  })

  it('result 但沒有 playing 紀錄（中途加入）時顯示完整時長；countdown 照舊顯示完整時長', () => {
    expect(phaseTimer({ ...base, phase: 'result', last: null })).toEqual({ secondsLeft: 40, suddenDeath: false })
    expect(phaseTimer({ ...base, phase: 'countdown', last: { secondsLeft: 3, suddenDeath: false } })).toEqual({ secondsLeft: 40, suddenDeath: false })
  })
})
