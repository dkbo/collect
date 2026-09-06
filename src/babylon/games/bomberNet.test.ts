import { describe, it, expect } from 'vitest'
import {
  decodeBombReq,
  decodeBomberMessage,
  decodeKickReq,
  decodeThrowReq,
} from './bomberNet'

/**
 * bomber 網路 payload 解碼測試（安全審查 C2）：
 * 合法封包完整解出，畸形封包一律回 null（呼叫端整則丟棄），任何輸入都不得 throw。
 */

describe('decodeBomberMessage — 合法封包', () => {
  it('bomb', () => {
    expect(decodeBomberMessage('bomb', { id: 'b0', cx: 3, cy: 4, owner: 'p1' })).toEqual({
      type: 'bomb',
      id: 'b0',
      cx: 3,
      cy: 4,
      owner: 'p1',
    })
  })

  it('boom（含選填的 damaged / itemKills / drops）', () => {
    const msg = decodeBomberMessage('boom', {
      id: 'b0',
      cells: [[1, 1], [2, 1]],
      destroyed: [[2, 1]],
      damaged: [[3, 1]],
      itemKills: [[1, 1]],
      kills: ['p2'],
      drops: [{ cx: 2, cy: 1, kind: 'fire' }],
    })

    expect(msg).toMatchObject({
      type: 'boom',
      id: 'b0',
      kills: ['p2'],
      drops: [{ cx: 2, cy: 1, kind: 'fire' }],
    })
  })

  it('bombMove / pickup / closeWall / burn', () => {
    expect(
      decodeBomberMessage('bombMove', { id: 'b0', toCx: 5, toCy: 5, durMs: 240, arc: 0 })
    ).toMatchObject({ type: 'bombMove', toCx: 5, toCy: 5, durMs: 240, arc: 0 })
    expect(decodeBomberMessage('pickup', { ci: 12, who: 'p1' })).toEqual({
      type: 'pickup',
      ci: 12,
      who: 'p1',
    })
    expect(decodeBomberMessage('closeWall', { cx: 0, cy: 0, kills: [] })).toEqual({
      type: 'closeWall',
      cx: 0,
      cy: 0,
      kills: [],
    })
    expect(decodeBomberMessage('burn', { kills: ['p1'] })).toEqual({ type: 'burn', kills: ['p1'] })
  })

  it('seed：bots 不合法時退回空名冊，不整則丟棄', () => {
    expect(decodeBomberMessage('seed', { seed: 42, bots: 'nope' })).toEqual({
      type: 'seed',
      seed: 42,
      bots: [],
    })
    expect(decodeBomberMessage('seed', { seed: 42, bots: [{ id: 'bot-0', name: '電腦1' }] })).toEqual(
      { type: 'seed', seed: 42, bots: [{ id: 'bot-0', name: '電腦1' }] }
    )
  })
})

describe('decodeBomberMessage — 畸形封包一律拒收', () => {
  it('非物件 payload 與未知 type', () => {
    expect(decodeBomberMessage('bomb', null)).toBeNull()
    expect(decodeBomberMessage('bomb', 'oops')).toBeNull()
    expect(decodeBomberMessage('bomb', [1, 2, 3])).toBeNull()
    expect(decodeBomberMessage('nope', { any: 1 })).toBeNull()
  })

  it('bomb：格座標越界或缺欄位', () => {
    expect(decodeBomberMessage('bomb', { id: 'b0', cx: 99, cy: 4, owner: 'p1' })).toBeNull()
    expect(decodeBomberMessage('bomb', { id: 'b0', cx: 3.5, cy: 4, owner: 'p1' })).toBeNull()
    expect(decodeBomberMessage('bomb', { id: 'b0', cx: 3, cy: 4 })).toBeNull()
  })

  it('boom：cells 為空（套用端會讀 cells[0]）或 drops 種類非白名單', () => {
    expect(
      decodeBomberMessage('boom', { id: 'b0', cells: [], destroyed: [], kills: [] })
    ).toBeNull()
    expect(
      decodeBomberMessage('boom', {
        id: 'b0',
        cells: [[1, 1]],
        destroyed: [],
        kills: [],
        drops: [{ cx: 1, cy: 1, kind: 'nuke' }],
      })
    ).toBeNull()
  })

  it('bombMove：非有限數 / 超出時間上限', () => {
    expect(
      decodeBomberMessage('bombMove', { id: 'b0', toCx: 1, toCy: 1, durMs: Infinity, arc: 0 })
    ).toBeNull()
    expect(
      decodeBomberMessage('bombMove', { id: 'b0', toCx: 1, toCy: 1, durMs: 999_999, arc: 0 })
    ).toBeNull()
  })

  it('kills 陣列超出實體數上限', () => {
    const tooMany = Array.from({ length: 9 }, (_, i) => `p${i}`)
    expect(decodeBomberMessage('burn', { kills: tooMany })).toBeNull()
  })
})

/**
 * host 本地回放（hostBroadcast 內以 { type, ...payload } 直接套用，不再解碼）
 * 必須與 guest 走 decodeBomberMessage 後得到的物件一致，否則兩端會分歧。
 */
describe('host 本地回放與 guest 解碼結果等價', () => {
  const hostPayloads: [string, Record<string, unknown>][] = [
    ['seed', { seed: 12345, bots: [{ id: 'bot-0', name: '電腦1' }] }],
    ['bomb', { id: 'b0', cx: 3, cy: 4, owner: 'p1' }],
    ['bombMove', { id: 'b0', toCx: 5, toCy: 4, durMs: 240, arc: 0 }],
    [
      'boom',
      {
        id: 'b0',
        cells: [[3, 4], [4, 4]],
        destroyed: [[4, 4]],
        damaged: [],
        kills: ['p2'],
        itemKills: [],
        drops: [{ cx: 4, cy: 4, kind: 'bomb' }],
      },
    ],
    ['burn', { kills: ['p1'] }],
    ['pickup', { ci: 30, who: 'p1' }],
    ['closeWall', { cx: 0, cy: 0, kills: ['p3'] }],
  ]

  it.each(hostPayloads)('%s', (type, payload) => {
    expect(decodeBomberMessage(type, payload)).toEqual({ type, ...payload })
  })
})

describe('上行請求解碼', () => {
  it('bombReq / kickReq / throwReq 合法值', () => {
    expect(decodeBombReq({ cx: 1, cy: 2 })).toEqual({ cx: 1, cy: 2 })
    expect(decodeKickReq({ cx: 1, cy: 2, dx: -1, dy: 0 })).toEqual({ cx: 1, cy: 2, dx: -1, dy: 0 })
    expect(decodeThrowReq({ dx: 0, dy: 1 })).toEqual({ dx: 0, dy: 1 })
  })

  it('越界格、NaN 方向、非物件皆拒收', () => {
    expect(decodeBombReq({ cx: -1, cy: 2 })).toBeNull()
    expect(decodeKickReq({ cx: 1, cy: 2, dx: NaN, dy: 0 })).toBeNull()
    expect(decodeThrowReq({ dx: 'left', dy: 0 })).toBeNull()
    expect(decodeThrowReq(undefined)).toBeNull()
  })
})
