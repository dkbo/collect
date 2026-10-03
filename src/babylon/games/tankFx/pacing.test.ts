import { describe, it, expect } from 'vitest'
import { paceTick } from '@/babylon/games/tankFx/pacing'

describe('paceTick — 固定 tick 下維持平均廣播頻率', () => {
  it('30Hz tick、50ms 間隔：一秒送 20 次', () => {
    let last = 0
    let sent = 0
    for (let i = 1; i <= 30; i++) {
      const r = paceTick((i * 1000) / 30, last, 50)
      last = r.last
      if (r.due) sent++
    }
    expect(sent).toBe(20)
  })

  it('落後太多（例如分頁暫停）時夾回 now，不連發補送', () => {
    const r = paceTick(10_000, 0, 50)
    expect(r).toEqual({ due: true, last: 10_000 })
    expect(paceTick(10_033, r.last, 50).due).toBe(false)
  })
})
