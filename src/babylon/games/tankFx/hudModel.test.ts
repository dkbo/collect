import { describe, expect, it } from 'vitest'
import { KillFeed, buildTankHud, tankTimer, type HudStat } from '@/babylon/games/tankFx/hudModel'

const NOW = 100_000
const SUDDEN = 60_000

const stat = (o: Partial<HudStat> = {}): HudStat => ({
  alive: true,
  hp: 3,
  maxHp: 3,
  kills: 0,
  shieldUntil: 0,
  speedUntil: 0,
  rapidUntil: 0,
  tripleUntil: 0,
  ...o,
})

describe('tankTimer（到突然死亡的剩餘秒數）', () => {
  it('倒數中顯示完整時長', () => {
    expect(tankTimer({ phase: 'countdown', now: NOW, playingSince: 0, suddenMs: SUDDEN, last: null })).toEqual({
      remainSec: 60,
      suddenDeath: false,
    })
  })
  it('playing 中無條件進位到整秒', () => {
    const t = tankTimer({ phase: 'playing', now: NOW, playingSince: NOW - 10_500, suddenMs: SUDDEN, last: null })
    expect(t).toEqual({ remainSec: 50, suddenDeath: false })
  })
  it('進入突然死亡後為 0 且 suddenDeath', () => {
    const t = tankTimer({ phase: 'playing', now: NOW, playingSince: NOW - SUDDEN, suddenMs: SUDDEN, last: null })
    expect(t).toEqual({ remainSec: 0, suddenDeath: true })
  })
  it('結算凍結在最後一次 playing 的值', () => {
    const last = { remainSec: 12, suddenDeath: false }
    expect(tankTimer({ phase: 'result', now: NOW, playingSince: 0, suddenMs: SUDDEN, last })).toEqual(last)
  })
})

describe('KillFeed（最近 3 則、id 單調遞增跨局不歸零）', () => {
  it('只留最近 3 則', () => {
    const f = new KillFeed()
    for (const v of ['a', 'b', 'c', 'd']) f.push('k', v)
    expect(f.items().map((x) => x.victim)).toEqual(['b', 'c', 'd'])
  })
  it('clear 後清空，但 id 接續不歸零', () => {
    const f = new KillFeed()
    f.push('k', 'a')
    f.push(null, 'b')
    const before = f.items().map((x) => x.id)
    f.clear()
    expect(f.items()).toEqual([])
    f.push('k', 'c')
    expect(f.items()[0].id).toBeGreaterThan(Math.max(...before))
  })
  it('killer 為 null 表示落牆；每次回傳新陣列', () => {
    const f = new KillFeed()
    f.push(null, 'v')
    expect(f.items()[0].killer).toBeNull()
    expect(f.items()).not.toBe(f.items())
  })
  it('可帶實體 id 供 HUD 依 id 找色點', () => {
    const f = new KillFeed()
    f.push('小藍', '小紅', { killerId: 'p1', victimId: 'p0' })
    expect(f.items()[0]).toMatchObject({ killer: '小藍', killerId: 'p1', victimId: 'p0' })
  })
})

describe('buildTankHud', () => {
  const entities = [
    { id: 'me', name: '小紅', colorIndex: 0, isBot: false },
    { id: 'bot-0', name: '電腦1', colorIndex: 1, isBot: true },
  ]
  const stats: Record<string, HudStat> = {
    me: stat({ hp: 2, kills: 1, shieldUntil: NOW + 4000, speedUntil: NOW + 2500, tripleUntil: NOW + 7001 }),
    'bot-0': stat({ alive: false, hp: 0 }),
  }
  const hud = buildTankHud({
    entities,
    selfId: 'me',
    now: NOW,
    timer: { remainSec: 33, suddenDeath: false },
    stat: (id) => stats[id],
    feed: [{ id: 7, killer: '小紅', victim: '電腦1' }],
  })

  it('kind 為 tank、計時與存活數', () => {
    expect(hud.kind).toBe('tank')
    expect(hud.remainSec).toBe(33)
    expect(hud.suddenDeath).toBe(false)
    expect(hud.aliveCount).toBe(1)
  })
  it('玩家卡：自己、bot、陣亡、血量、擊殺、護盾', () => {
    expect(hud.players.map((p) => [p.id, p.colorIndex, p.isSelf, p.isBot, p.alive, p.hp, p.maxHp, p.kills, p.shield])).toEqual([
      ['me', 0, true, false, true, 2, 3, 1, true],
      ['bot-0', 1, false, true, false, 0, 3, 0, false],
    ])
  })
  it('buff 依 speed／rapid／triple 排序，剩餘秒數無條件進位，到期不列', () => {
    expect(hud.players[0].buffs).toEqual([
      { kind: 'speed', remainSec: 3 },
      { kind: 'triple', remainSec: 8 },
    ])
    expect(hud.players[1].buffs).toEqual([])
  })
  it('feed 原樣帶出（新陣列）', () => {
    expect(hud.feed).toEqual([{ id: 7, killer: '小紅', victim: '電腦1' }])
  })
})
