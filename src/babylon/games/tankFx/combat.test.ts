import { describe, it, expect } from 'vitest'
import {
  INVULN_MS,
  ITEM_KINDS,
  KNOCKBACK,
  SHIELD_MS,
  TRIPLE_MS,
  TRIPLE_SPREAD_DEG,
  buffRemainSec,
  invulnBlinkOn,
  knockback,
  pickItemKind,
  resolveHit,
  tripleVelocities,
} from '@/babylon/games/tankFx/combat'

const NOW = 50_000

describe('常數', () => {
  it('AC2 具名常數', () => {
    expect([INVULN_MS, KNOCKBACK, SHIELD_MS, TRIPLE_MS, TRIPLE_SPREAD_DEG]).toEqual([1000, 0.6, 12000, 8000, 12])
  })
})

describe('resolveHit — 無敵／護盾／扣血', () => {
  it('一般命中扣 1 血', () => {
    expect(resolveHit({ hp: 3, shieldUntil: 0, invulnUntil: 0 }, NOW)).toEqual({
      damaged: true,
      hp: 2,
      shieldBroken: false,
      invuln: false,
    })
  })

  it('無敵期間不扣血、不破盾', () => {
    const r = resolveHit({ hp: 3, shieldUntil: NOW + 5000, invulnUntil: NOW + 1 }, NOW)
    expect(r).toEqual({ damaged: false, hp: 3, shieldBroken: false, invuln: true })
  })

  it('護盾抵擋：不扣血、盾破', () => {
    const r = resolveHit({ hp: 1, shieldUntil: NOW + 1, invulnUntil: 0 }, NOW)
    expect(r).toEqual({ damaged: false, hp: 1, shieldBroken: true, invuln: false })
  })

  it('護盾到期就不再抵擋', () => {
    expect(resolveHit({ hp: 2, shieldUntil: NOW, invulnUntil: 0 }, NOW).damaged).toBe(true)
  })

  it('無敵恰好到期即可再受傷', () => {
    expect(resolveHit({ hp: 2, shieldUntil: 0, invulnUntil: NOW }, NOW).damaged).toBe(true)
  })
})

describe('knockback — 以碰撞判定截斷', () => {
  it('空曠處推滿 KNOCKBACK', () => {
    const r = knockback(0, 0, 1, 0, KNOCKBACK, () => false)
    expect(r.x).toBeCloseTo(0.6)
    expect(r.z).toBe(0)
  })

  it('前方有牆：停在牆前、不進牆', () => {
    const blocked = (x: number) => x > 0.25
    const r = knockback(0, 0, 1, 0, KNOCKBACK, blocked)
    expect(r.x).toBeLessThanOrEqual(0.25)
    expect(r.x).toBeGreaterThan(0.15)
  })

  it('一開始就被擋：原地不動', () => {
    expect(knockback(1, 2, 0, 1, KNOCKBACK, () => true)).toEqual({ x: 1, z: 2 })
  })
})

describe('tripleVelocities — 三連發', () => {
  it('中央原向量、左右各偏 12° 且速度大小不變', () => {
    const [c, l, r] = tripleVelocities(0, 12)
    expect(c).toEqual([0, 12])
    const rad = (TRIPLE_SPREAD_DEG * Math.PI) / 180
    for (const v of [l, r]) expect(Math.hypot(v[0], v[1])).toBeCloseTo(12)
    expect(Math.abs(Math.atan2(l[0], l[1]))).toBeCloseTo(rad)
    expect(Math.atan2(l[0], l[1])).toBeCloseTo(-Math.atan2(r[0], r[1]))
  })
})

describe('pickItemKind — 五種等機率', () => {
  it('五種道具', () => {
    expect([...ITEM_KINDS]).toEqual(['hp', 'speed', 'rapid', 'shield', 'triple'])
  })

  it('[0,1) 均分成五段', () => {
    expect([0, 0.19, 0.2, 0.41, 0.6, 0.79, 0.8, 0.9999].map(pickItemKind)).toEqual([
      'hp',
      'hp',
      'speed',
      'rapid',
      'shield',
      'shield',
      'triple',
      'triple',
    ])
  })

  it('越界亂數也夾在合法範圍', () => {
    expect(pickItemKind(1)).toBe('triple')
    expect(pickItemKind(-0.5)).toBe('hp')
  })
})

describe('buffRemainSec／invulnBlinkOn', () => {
  it('剩餘秒數無條件進位、到期為 0', () => {
    expect(buffRemainSec(NOW + 7001, NOW)).toBe(8)
    expect(buffRemainSec(NOW + 1000, NOW)).toBe(1)
    expect(buffRemainSec(NOW, NOW)).toBe(0)
    expect(buffRemainSec(0, NOW)).toBe(0)
  })

  it('無敵到期後不閃、期間會亮暗交替', () => {
    expect(invulnBlinkOn(NOW, NOW)).toBe(true)
    const states = new Set<boolean>()
    for (let t = 0; t < INVULN_MS; t += 25) states.add(invulnBlinkOn(NOW + t, NOW + INVULN_MS))
    expect(states).toEqual(new Set([true, false]))
  })
})
