import { describe, it, expect } from 'vitest'
import { emptyField, spawnField, stepField, type FieldCar } from '@/babylon/games/raceFx/raceField'
import { BANANA_MAX, SHELL_LIFE_MS, SHELL_SPIN_MS, SPIN_MS } from '@/babylon/games/raceRules/items'
import { placeAt } from '@/babylon/games/raceRules/track'
import { RACE_COURSE } from '@/babylon/games/raceRules/trackData'

const C = RACE_COURSE
const T = C.track
const at = (s: number, lat = 0) => placeAt(T, s, lat)
const car = (id: string, s: number, extra: Partial<FieldCar> = {}): FieldCar => {
  const p = at(s)
  return { id, x: p.x, z: p.z, ghost: false, shield: false, ...extra }
}
const pose = (s: number) => {
  const p = at(s)
  return { x: p.x, z: p.z, ry: p.heading }
}

describe('spawnField', () => {
  it('香蕉在車後、龜殼在車前；id 遞增不重複', () => {
    let f = emptyField()
    const a = spawnField(f, 'banana', 'p1', pose(20), null)
    f = a.field
    const b = spawnField(f, 'shell', 'p1', pose(20), 'p2')
    expect(a.entry.id).not.toBe(b.entry.id)
    expect(a.entry.vx).toBe(0)
    expect(Math.hypot(b.entry.vx, b.entry.vz)).toBeGreaterThan(20)
    expect(b.entry.target).toBe('p2')
    expect(b.field.items).toHaveLength(2)
  })

  it('香蕉超過 BANANA_MAX 時移除最舊的並回報', () => {
    let f = emptyField()
    const ids: string[] = []
    for (let i = 0; i < BANANA_MAX; i++) {
      const r = spawnField(f, 'banana', 'p1', pose(20 + i * 10), null)
      f = r.field
      ids.push(r.entry.id)
      expect(r.overflow).toEqual([])
    }
    const r = spawnField(f, 'banana', 'p1', pose(200), null)
    expect(r.overflow).toEqual([ids[0]])
    expect(r.field.items.filter((it) => it.kind === 'banana')).toHaveLength(BANANA_MAX)
    expect(r.field.items.some((it) => it.id === ids[0])).toBe(false)
  })
})

describe('stepField（host 裁決）', () => {
  it('香蕉打到別台：spin SPIN_MS ＋ itemGone hit；香蕉消失', () => {
    const f = spawnField(emptyField(), 'banana', 'p1', pose(30), null)
    const e = f.entry
    const victim: FieldCar = { id: 'p2', x: e.x, z: e.z, ghost: false, shield: false }
    const r = stepField(f.field, [victim], C, 1 / 30)
    expect(r.events).toContainEqual({ type: 'spin', target: 'p2', ms: SPIN_MS, blocked: false })
    expect(r.events).toContainEqual({ type: 'gone', id: e.id, reason: 'hit' })
    expect(r.field.items).toHaveLength(0)
  })

  it('護盾擋下：spin blocked、ms 0；ghost 不中', () => {
    const f = spawnField(emptyField(), 'banana', 'p1', pose(30), null)
    const e = f.entry
    const ghost = stepField(f.field, [{ id: 'p2', x: e.x, z: e.z, ghost: true, shield: false }], C, 1 / 30)
    expect(ghost.events).toEqual([])
    const sh = stepField(f.field, [{ id: 'p2', x: e.x, z: e.z, ghost: false, shield: true }], C, 1 / 30)
    expect(sh.events).toContainEqual({ type: 'spin', target: 'p2', ms: 0, blocked: true })
  })

  it('追蹤龜殼追到目標：spin SHELL_SPIN_MS', () => {
    let f = spawnField(emptyField(), 'shell', 'p1', pose(30), 'p2').field
    const target = car('p2', 45)
    let hit = null
    for (let i = 0; i < 60 && !hit; i++) {
      const r = stepField(f, [car('p1', 30), target], C, 1 / 30)
      f = r.field
      hit = r.events.find((ev) => ev.type === 'spin') ?? null
    }
    expect(hit).toEqual({ type: 'spin', target: 'p2', ms: SHELL_SPIN_MS, blocked: false })
  })

  it('龜殼壽命到 → itemGone expire', () => {
    let f = spawnField(emptyField(), 'shell', 'p1', pose(30), 'ghost-car').field
    let gone = null
    for (let i = 0; i < (SHELL_LIFE_MS / 1000) * 30 + 5 && !gone; i++) {
      const r = stepField(f, [], C, 1 / 30)
      f = r.field
      gone = r.events.find((ev) => ev.type === 'gone') ?? null
    }
    expect(gone).toMatchObject({ type: 'gone', reason: 'expire' })
  })

  it('龜殼撞香蕉：兩者都 clash 消失', () => {
    let f = emptyField()
    const ban = spawnField(f, 'banana', 'p2', pose(40), null)
    f = ban.field
    const sh = spawnField(f, 'shell', 'p1', pose(30), null)
    f = sh.field
    const ids = new Set<string>()
    for (let i = 0; i < 30; i++) {
      const r = stepField(f, [], C, 1 / 30)
      f = r.field
      for (const ev of r.events) if (ev.type === 'gone' && ev.reason === 'clash') ids.add(ev.id)
    }
    expect(ids).toEqual(new Set([ban.entry.id, sh.entry.id]))
    expect(f.items).toHaveLength(0)
  })

  it('不改動輸入 field', () => {
    const f = spawnField(emptyField(), 'shell', 'p1', pose(30), null).field
    const before = JSON.stringify(f)
    stepField(f, [], C, 1 / 30)
    expect(JSON.stringify(f)).toBe(before)
  })
})
