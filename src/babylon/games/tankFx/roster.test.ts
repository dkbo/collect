import { describe, it, expect } from 'vitest'
import { entityIds, makeBots, rankStandings, roundDecided, tankColorIndex } from '@/babylon/games/tankFx/roster'

const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `玩家${i}` }))

describe('makeBots — 補滿 4 台', () => {
  it('單人補 3 台，命名 bot-N／電腦N', () => {
    expect(makeBots(1)).toEqual([
      { id: 'bot-0', name: '電腦1' },
      { id: 'bot-1', name: '電腦2' },
      { id: 'bot-2', name: '電腦3' },
    ])
  })

  it('4 人以上不補', () => {
    expect(makeBots(4)).toEqual([])
    expect(makeBots(6)).toEqual([])
  })
})

describe('tankColorIndex — 固定 4 色', () => {
  it('依「真人依序＋bot 依序」給 0..3', () => {
    const ps = players(2)
    const bots = makeBots(2)
    expect(entityIds(ps, bots)).toEqual(['p0', 'p1', 'bot-0', 'bot-1'])
    expect(['p0', 'p1', 'bot-0', 'bot-1'].map((id) => tankColorIndex(id, ps, bots))).toEqual([0, 1, 2, 3])
  })

  it('同一份名冊在任何 selfId 下輸出一致', () => {
    const ps = players(3)
    const bots = makeBots(3)
    const table = (selfId: string) => {
      void selfId // 推導不吃 selfId：各 client 只差在自己是誰
      return entityIds(ps, bots).map((id) => tankColorIndex(id, ps, bots))
    }
    const ref = table('p0')
    for (const self of ['p1', 'p2']) expect(table(self)).toEqual(ref)
  })

  it('中途有人離房：依新名冊重排', () => {
    const ps = players(3)
    expect(tankColorIndex('p2', ps, [])).toBe(2)
    expect(tankColorIndex('p2', ps.filter((p) => p.id !== 'p1'), [])).toBe(1)
  })
})

describe('rankStandings — 結算含 bot', () => {
  it('存活優先、再比擊殺，同分依名冊序', () => {
    const r = rankStandings([
      { id: 'p0', name: 'A', alive: false, kills: 3 },
      { id: 'bot-0', name: '電腦1', alive: true, kills: 0 },
      { id: 'bot-1', name: '電腦2', alive: false, kills: 1 },
      { id: 'p1', name: 'B', alive: false, kills: 1 },
    ])
    expect(r.map((s) => s.id)).toEqual(['bot-0', 'p0', 'bot-1', 'p1'])
  })

  it('不改動輸入陣列', () => {
    const input = [
      { id: 'a', name: 'a', alive: false, kills: 0 },
      { id: 'b', name: 'b', alive: true, kills: 0 },
    ]
    rankStandings(input)
    expect(input[0].id).toBe('a')
  })
})

describe('roundDecided — 勝負已定', () => {
  it('2 台以上且存活 ≤ 1 即定', () => {
    expect(roundDecided(4, 1)).toBe(true)
    expect(roundDecided(2, 0)).toBe(true)
  })
  it('存活 ≥ 2 或只有 1 台（不結算）未定', () => {
    expect(roundDecided(4, 2)).toBe(false)
    expect(roundDecided(1, 1)).toBe(false)
  })
})
