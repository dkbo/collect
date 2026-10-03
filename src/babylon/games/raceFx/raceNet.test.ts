import { describe, it, expect } from 'vitest'
import {
  OWN_FIN_MAX,
  decodeBotState,
  decodeBoxState,
  decodeItemGone,
  decodeItemGrant,
  decodeItemReq,
  decodeItemSpawn,
  decodeItemState,
  decodeOwn,
  decodeResult,
  decodeSpin,
  decodeStart,
  decodeUseItem,
} from '@/babylon/games/raceFx/raceNet'

const LEN = 554.8
const IDS = ['p1', 'p2', 'bot-0', 'bot-1']
const own = {
  x: 10,
  z: -70,
  ry: 1.57,
  lap: 1,
  cp: 3,
  s: 200,
  fin: null,
  ghost: false,
  drift: 2,
  boost: true,
  spin: false,
  shield: false,
}

describe('decodeOwn（AC6b own 快照）', () => {
  it('合法照收，fin 可為 null 或 0..OWN_FIN_MAX', () => {
    expect(decodeOwn(own, LEN)).toEqual(own)
    expect(decodeOwn({ ...own, lap: 3, fin: 123456 }, LEN)?.fin).toBe(123456)
    expect(OWN_FIN_MAX).toBe(600000)
  })

  it('範圍外或型別錯誤一律 null', () => {
    const bad: Record<string, unknown>[] = [
      { ...own, lap: 4 },
      { ...own, lap: 1.5 },
      { ...own, cp: 8 },
      { ...own, cp: -1 },
      { ...own, s: LEN + 1 },
      { ...own, s: -0.1 },
      { ...own, fin: 600001 },
      { ...own, fin: -1 },
      { ...own, fin: 'x' },
      { ...own, drift: 4 },
      { ...own, ghost: 1 },
      { ...own, x: 1000 },
      { ...own, z: Number.NaN },
      { ...own, ry: Infinity },
      { ...own, boost: undefined },
    ]
    for (const p of bad) expect(decodeOwn(p, LEN)).toBeNull()
    expect(decodeOwn(null, LEN)).toBeNull()
    expect(decodeOwn([own], LEN)).toBeNull()
  })

  it('舊格式 {x,z,ry,q} 不收', () => {
    expect(decodeOwn({ x: 1, z: 2, ry: 0, q: 3 }, LEN)).toBeNull()
  })
})

describe('decodeStart（開局名冊）', () => {
  it('bots 可選；只收 bot-0..3、最多 4 台', () => {
    expect(decodeStart({})).toEqual({ bots: [] })
    const bots = [
      { id: 'bot-0', name: '電腦1' },
      { id: 'bot-1', name: '電腦2' },
    ]
    expect(decodeStart({ bots })).toEqual({ bots })
    expect(decodeStart({ bots: [{ id: 'p1', name: 'x' }] })).toBeNull()
    expect(decodeStart({ bots: Array.from({ length: 5 }, (_, i) => ({ id: `bot-${i % 4}`, name: 'x' })) })).toBeNull()
    expect(decodeStart({ bots: 'x' })).toBeNull()
    expect(decodeStart(null)).toBeNull()
  })
})

describe('decodeBotState', () => {
  const st = { id: 'bot-0', x: 1, z: 2, ry: 0, lap: 0, cp: 0, s: 3, fin: null, drift: 0, spin: false }
  it('只收名冊內的 bot 與合法範圍', () => {
    expect(decodeBotState({ states: [st] }, ['bot-0'], LEN)).toEqual({ states: [st] })
    expect(decodeBotState({ states: [st] }, ['bot-1'], LEN)).toBeNull()
    expect(decodeBotState({ states: [{ ...st, lap: 9 }] }, ['bot-0'], LEN)).toBeNull()
    expect(decodeBotState({ states: [{ ...st, spin: 'no' }] }, ['bot-0'], LEN)).toBeNull()
    expect(decodeBotState({ states: Array(5).fill(st) }, ['bot-0'], LEN)).toBeNull()
  })
})

describe('道具訊息', () => {
  it('itemReq：箱 id 為範圍內整數', () => {
    expect(decodeItemReq({ box: 5 }, 12)).toEqual({ box: 5 })
    expect(decodeItemReq({ box: 12 }, 12)).toBeNull()
    expect(decodeItemReq({ box: 1.5 }, 12)).toBeNull()
    expect(decodeItemReq({}, 12)).toBeNull()
  })

  it('itemGrant：箱、已知實體、道具種類', () => {
    expect(decodeItemGrant({ box: 0, who: 'p2', kind: 'shell' }, 12, IDS)).toEqual({ box: 0, who: 'p2', kind: 'shell' })
    expect(decodeItemGrant({ box: 0, who: 'x', kind: 'shell' }, 12, IDS)).toBeNull()
    expect(decodeItemGrant({ box: 0, who: 'p2', kind: 'star' }, 12, IDS)).toBeNull()
  })

  it('useItem：只收 4 種', () => {
    expect(decodeUseItem({ kind: 'banana' })).toEqual({ kind: 'banana' })
    expect(decodeUseItem({ kind: 'bomb' })).toBeNull()
  })

  it('itemSpawn：只有香蕉與龜殼、owner 已知、target 為 null 或已知實體、速度有上限', () => {
    const sp = { id: 'i1', kind: 'shell', owner: 'p1', x: 0, z: 0, vx: 26, vz: 0, target: 'p2' }
    expect(decodeItemSpawn(sp, IDS)).toEqual(sp)
    expect(decodeItemSpawn({ ...sp, target: null }, IDS)?.target).toBeNull()
    expect(decodeItemSpawn({ ...sp, target: undefined }, IDS)?.target).toBeNull()
    expect(decodeItemSpawn({ ...sp, kind: 'mushroom' }, IDS)).toBeNull()
    expect(decodeItemSpawn({ ...sp, owner: 'zz' }, IDS)).toBeNull()
    expect(decodeItemSpawn({ ...sp, target: 'zz' }, IDS)).toBeNull()
    expect(decodeItemSpawn({ ...sp, vx: 999 }, IDS)).toBeNull()
    expect(decodeItemSpawn({ ...sp, x: 500 }, IDS)).toBeNull()
  })

  it('itemState：list 限長、每筆座標合法', () => {
    expect(decodeItemState({ list: [{ id: 'i1', x: 1, z: 2 }] })).toEqual({ list: [{ id: 'i1', x: 1, z: 2 }] })
    expect(decodeItemState({ list: [{ id: 'i1', x: 'a', z: 2 }] })).toBeNull()
    expect(decodeItemState({ list: Array(65).fill({ id: 'i', x: 0, z: 0 }) })).toBeNull()
  })

  it('itemGone：reason 只收已知值', () => {
    expect(decodeItemGone({ id: 'i1', reason: 'hit' })).toEqual({ id: 'i1', reason: 'hit' })
    expect(decodeItemGone({ id: 'i1', reason: 'expire' })).not.toBeNull()
    expect(decodeItemGone({ id: 'i1', reason: 'clash' })).not.toBeNull()
    expect(decodeItemGone({ id: 'i1', reason: 'boom' })).toBeNull()
  })

  it('spin：target 已知、ms 0..5000、blocked 布林（缺省 false）', () => {
    expect(decodeSpin({ target: 'p1', ms: 800, blocked: false }, IDS)).toEqual({ target: 'p1', ms: 800, blocked: false })
    expect(decodeSpin({ target: 'p1', ms: 0, blocked: true }, IDS)).toEqual({ target: 'p1', ms: 0, blocked: true })
    expect(decodeSpin({ target: 'p1', ms: 800 }, IDS)?.blocked).toBe(false)
    expect(decodeSpin({ target: 'p1', ms: 99999, blocked: false }, IDS)).toBeNull()
    expect(decodeSpin({ target: 'nobody', ms: 800, blocked: false }, IDS)).toBeNull()
    expect(decodeSpin({ target: 'p1', ms: 800, blocked: 'y' }, IDS)).toBeNull()
  })

  it('boxState：taken 為不重複的範圍內整數', () => {
    expect(decodeBoxState({ taken: [0, 3, 11] }, 12)).toEqual({ taken: [0, 3, 11] })
    expect(decodeBoxState({ taken: [] }, 12)).toEqual({ taken: [] })
    expect(decodeBoxState({ taken: [12] }, 12)).toBeNull()
    expect(decodeBoxState({ taken: [1, 1] }, 12)).toBeNull()
    expect(decodeBoxState({ taken: 'x' }, 12)).toBeNull()
  })
})

describe('decodeResult（flow result）', () => {
  const row = { id: 'p1', name: 'A', colorIndex: 0, rank: 1, totalMs: 90000, bestLapMs: 28000 }
  it('合法名次表照收；totalMs／bestLapMs 可為 null', () => {
    const rows = [row, { ...row, id: 'bot-0', name: '電腦1', colorIndex: 1, rank: 2, totalMs: null, bestLapMs: null }]
    expect(decodeResult(rows)).toEqual(rows)
  })

  it('非陣列、超過 4 筆、欄位錯誤回 null', () => {
    expect(decodeResult({})).toBeNull()
    expect(decodeResult(Array(5).fill(row))).toBeNull()
    expect(decodeResult([{ ...row, colorIndex: 4 }])).toBeNull()
    expect(decodeResult([{ ...row, rank: 0 }])).toBeNull()
    expect(decodeResult([{ ...row, totalMs: -5 }])).toBeNull()
    expect(decodeResult([{ ...row, name: 5 }])).toBeNull()
  })
})
