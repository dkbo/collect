import { describe, expect, it } from 'vitest'
import { colorIndexIn, kitchenRoster } from '@/babylon/games/kitchenFx/players'

const players = [
  { id: 'uidC', name: '小明' },
  { id: 'uidA', name: '阿華' },
  { id: 'uidB', name: 'Bob' },
  { id: 'uidD', name: '丁丁' },
]

describe('colorIndexIn（colorIndex = 在 ctx.players 的序號，與 respawn 同序）', () => {
  it('依序號取 0..3，不看 id 內容', () => {
    expect(players.map((p) => colorIndexIn(players, p.id))).toEqual([0, 1, 2, 3])
  })
  it('找不到的 id 退回 0（對齊 respawn 的 Math.max(0, idx)）', () => {
    expect(colorIndexIn(players, 'ghost')).toBe(0)
  })
  it('超過 4 人時環繞', () => {
    const five = [...players, { id: 'uidE', name: 'E' }]
    expect(colorIndexIn(five, 'uidE')).toBe(0)
  })
})

describe('kitchenRoster', () => {
  it('同一份 players 陣列在任何 selfId 下，每位玩家的 colorIndex 一致', () => {
    const colorsBy = (selfId: string) => kitchenRoster(players, selfId).map((r) => [r.id, r.colorIndex])
    const expected = colorsBy('uidC')
    for (const p of players) expect(colorsBy(p.id)).toEqual(expected)
    expect(colorsBy('spectator')).toEqual(expected)
  })
  it('只有自己標 isSelf，順序與名字照 players', () => {
    const r = kitchenRoster(players, 'uidB')
    expect(r.map((x) => x.isSelf)).toEqual([false, false, true, false])
    expect(r.map((x) => x.name)).toEqual(['小明', '阿華', 'Bob', '丁丁'])
  })
})
