import { describe, it, expect } from 'vitest'
import {
  decodeBotState,
  decodeBullet,
  decodeBounce,
  decodeClose,
  decodeCrate,
  decodeHit,
  decodeItem,
  decodePickup,
  decodeSeed,
} from '@/babylon/games/tankFx/messages'

const LIMITS = { worldLimit: 18, velLimit: 24 }

describe('decodeSeed — bots 可選', () => {
  it('舊格式（無 bots）照收，bots 為空', () => {
    expect(decodeSeed({ seed: 7 })).toEqual({ seed: 7, bots: [] })
  })

  it('帶 bots 名冊', () => {
    const bots = [{ id: 'bot-0', name: '電腦1' }]
    expect(decodeSeed({ seed: 7, bots })).toEqual({ seed: 7, bots })
  })

  it('bots 形狀不對（id 非 bot-N、超過 4 台、非陣列）整則丟棄', () => {
    expect(decodeSeed({ seed: 7, bots: [{ id: 'p1', name: 'x' }] })).toBeNull()
    expect(decodeSeed({ seed: 7, bots: Array.from({ length: 5 }, (_, i) => ({ id: `bot-${i}`, name: 'x' })) })).toBeNull()
    expect(decodeSeed({ seed: 7, bots: 'x' })).toBeNull()
    expect(decodeSeed({ seed: -1 })).toBeNull()
  })
})

describe('decodeBounce', () => {
  it('合法', () => {
    const p = { bulletId: 'b3', x: 1, z: -2, vx: -12, vz: 0 }
    expect(decodeBounce(p, LIMITS)).toEqual(p)
  })

  it('座標越界、超速、缺 id 拒收', () => {
    expect(decodeBounce({ bulletId: 'b3', x: 99, z: 0, vx: 0, vz: 0 }, LIMITS)).toBeNull()
    expect(decodeBounce({ bulletId: 'b3', x: 0, z: 0, vx: 99, vz: 0 }, LIMITS)).toBeNull()
    expect(decodeBounce({ x: 0, z: 0, vx: 0, vz: 0 }, LIMITS)).toBeNull()
  })
})

describe('decodeClose／decodeCrate', () => {
  it('格座標在場內才收', () => {
    expect(decodeClose({ cx: 0, cy: 15 })).toEqual({ cx: 0, cy: 15 })
    expect(decodeClose({ cx: 16, cy: 0 })).toBeNull()
    expect(decodeClose({ cx: 1.5, cy: 0 })).toBeNull()
  })

  it('crate 格索引在場內才收', () => {
    expect(decodeCrate({ ci: 255 })).toEqual({ ci: 255, bulletId: null })
    expect(decodeCrate({ ci: 256 })).toBeNull()
  })

  it('crate 帶打掉它的 bulletId（guest 據此刪掉自己延遲的那發，避免穿過已刪木箱）', () => {
    expect(decodeCrate({ ci: 40, bulletId: 'b12' })).toEqual({ ci: 40, bulletId: 'b12' })
  })

  it('bulletId 型別錯拒收', () => {
    expect(decodeCrate({ ci: 40, bulletId: 12 })).toBeNull()
  })
})

describe('decodeBotState — 只收名冊內的 bot', () => {
  const ids = ['bot-0', 'bot-1']
  it('合法', () => {
    const states = [{ id: 'bot-0', x: 1, z: 2, ry: 0.5, ta: -1 }]
    expect(decodeBotState({ states }, ids, LIMITS)).toEqual({ states })
  })

  it('不在名冊、座標越界、非有限數皆丟棄整則', () => {
    expect(decodeBotState({ states: [{ id: 'bot-3', x: 0, z: 0, ry: 0, ta: 0 }] }, ids, LIMITS)).toBeNull()
    expect(decodeBotState({ states: [{ id: 'bot-0', x: 99, z: 0, ry: 0, ta: 0 }] }, ids, LIMITS)).toBeNull()
    expect(decodeBotState({ states: [{ id: 'bot-0', x: 0, z: 0, ry: NaN, ta: 0 }] }, ids, LIMITS)).toBeNull()
  })
})

describe('decodeHit — 新可選欄位', () => {
  it('舊格式照收：無方向、未破盾、非無敵', () => {
    expect(decodeHit({ bulletId: 'b1', targetId: 'p1', hp: 2, killerId: 'p0' })).toEqual({
      bulletId: 'b1',
      targetId: 'p1',
      hp: 2,
      killerId: 'p0',
      dirX: 0,
      dirZ: 0,
      shieldBroken: false,
      invuln: false,
    })
  })

  it('帶擊退方向與破盾', () => {
    const r = decodeHit({ bulletId: 'b1', targetId: 'p1', hp: 2, killerId: null, dirX: 0.6, dirZ: -0.8, shieldBroken: true })
    expect(r).toMatchObject({ dirX: 0.6, dirZ: -0.8, shieldBroken: true, killerId: null })
  })

  it('方向超出單位範圍或型別錯拒收', () => {
    expect(decodeHit({ targetId: 'p1', hp: 2, dirX: 3, dirZ: 0 })).toBeNull()
    expect(decodeHit({ targetId: 'p1', hp: 2, shieldBroken: 'yes' })).toBeNull()
    expect(decodeHit({ targetId: 'p1', hp: 100 })).toBeNull()
  })
})

describe('decodePickup — kind 可選', () => {
  it('舊格式照收', () => {
    expect(decodePickup({ ci: 3, who: 'p0' })).toEqual({ ci: 3, who: 'p0', kind: null })
  })

  it('帶 kind', () => {
    expect(decodePickup({ ci: 3, who: 'bot-0', kind: 'shield' })).toEqual({ ci: 3, who: 'bot-0', kind: 'shield' })
  })

  it('未知 kind 拒收', () => {
    expect(decodePickup({ ci: 3, who: 'p0', kind: 'nuke' })).toBeNull()
  })
})

describe('decodeBullet／decodeItem', () => {
  it('合法 bullet 照收', () => {
    const b = { id: 'b1', owner: 'p1', x: 1, z: -2, vx: 12, vz: 0 }
    expect(decodeBullet(b, LIMITS)).toEqual({ ...b, side: false })
    expect(decodeBullet({ ...b, side: true }, LIMITS)).toEqual({ ...b, side: true })
    expect(decodeBullet({ ...b, side: 1 }, LIMITS)).toBeNull()
  })

  it('bullet 座標／速度出界、id 過長或缺欄位整則丟棄', () => {
    expect(decodeBullet({ id: 'b1', owner: 'p1', x: 99, z: 0, vx: 0, vz: 0 }, LIMITS)).toBeNull()
    expect(decodeBullet({ id: 'b1', owner: 'p1', x: 0, z: 0, vx: 99, vz: 0 }, LIMITS)).toBeNull()
    expect(decodeBullet({ id: 'x'.repeat(65), owner: 'p1', x: 0, z: 0, vx: 0, vz: 0 }, LIMITS)).toBeNull()
    expect(decodeBullet({ owner: 'p1', x: 0, z: 0, vx: 0, vz: 0 }, LIMITS)).toBeNull()
  })

  it('合法 item 照收；格座標出界或未知 kind 丟棄', () => {
    expect(decodeItem({ cx: 3, cy: 4, kind: 'shield' })).toEqual({ cx: 3, cy: 4, kind: 'shield' })
    expect(decodeItem({ cx: 16, cy: 4, kind: 'hp' })).toBeNull()
    expect(decodeItem({ cx: 3, cy: 4, kind: 'bouncy' })).toBeNull()
  })
})
