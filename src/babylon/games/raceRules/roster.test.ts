import { describe, it, expect } from 'vitest'
import { MAX_RACERS, makeRaceBots, raceColorIndex, raceEntityIds } from '@/babylon/games/raceRules/roster'

const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `玩家${i}` }))

describe('makeRaceBots — 補滿 4 台', () => {
  it('單人補 3 台，命名 bot-N／電腦N', () => {
    expect(MAX_RACERS).toBe(4)
    expect(makeRaceBots(1)).toEqual([
      { id: 'bot-0', name: '電腦1' },
      { id: 'bot-1', name: '電腦2' },
      { id: 'bot-2', name: '電腦3' },
    ])
  })

  it('4 人以上不補', () => {
    expect(makeRaceBots(4)).toEqual([])
    expect(makeRaceBots(5)).toEqual([])
  })
})

describe('raceColorIndex — 固定 4 色（AC7）', () => {
  it('依「真人依序＋bot 依序」給 0..3', () => {
    const ps = players(2)
    const bots = makeRaceBots(2)
    expect(raceEntityIds(ps, bots)).toEqual(['p0', 'p1', 'bot-0', 'bot-1'])
    expect(['p0', 'p1', 'bot-0', 'bot-1'].map((id) => raceColorIndex(id, ps, bots))).toEqual([0, 1, 2, 3])
  })

  it('同一份名冊在每個 client 輸出一致（與 selfId 無關、與呼叫順序無關）', () => {
    const ps = players(3)
    const bots = makeRaceBots(3)
    const a = raceEntityIds(ps, bots).map((id) => raceColorIndex(id, ps, bots))
    const b = [...raceEntityIds(ps, bots)].reverse().map((id) => raceColorIndex(id, ps, bots)).reverse()
    expect(a).toEqual(b)
    expect(a).toEqual([0, 1, 2, 3])
  })

  it('找不到的 id 回 0；第 5 人以上循環', () => {
    expect(raceColorIndex('nobody', players(2), [])).toBe(0)
    expect(raceColorIndex('p4', players(5), [])).toBe(0)
  })
})
