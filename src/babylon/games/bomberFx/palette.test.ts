import { describe, expect, it } from 'vitest'
import { PLAYER_PALETTE, colorIndexOf, hexToRgb, invincibleBlinkOn } from '@/babylon/games/bomberFx/palette'

describe('PLAYER_PALETTE', () => {
  it('依 spec §4 固定 4 色（亮／本色／暗）', () => {
    expect(PLAYER_PALETTE.map((p) => p.base)).toEqual(['#FF3B4E', '#2F86FF', '#2FCF5E', '#FFC21A'])
    expect(PLAYER_PALETTE[0]).toEqual({ light: '#FF8A94', base: '#FF3B4E', dark: '#B3122A' })
    expect(PLAYER_PALETTE[3]).toEqual({ light: '#FFF0A0', base: '#FFC21A', dark: '#C27D00' })
  })
})

describe('colorIndexOf', () => {
  const ents = ['uidA', 'uidB', 'bot-0', 'bot-1']
  it('依實體序（= SPAWN_CORNERS 出生序）取色，不看 id 內容', () => {
    expect(ents.map((id) => colorIndexOf(id, ents))).toEqual([0, 1, 2, 3])
  })
  it('同一名冊在不同 client 得到同一顏色（與 id hash 無關）', () => {
    expect(colorIndexOf('uidB', ['uidA', 'uidB'])).toBe(colorIndexOf('uidB', ['uidA', 'uidB', 'bot-0']))
  })
  it('找不到的 id 退回 0（與 spawnOf 的 Math.max(0, idx) 一致）', () => {
    expect(colorIndexOf('ghost', ents)).toBe(0)
  })
  it('超過 4 人時環繞', () => {
    expect(colorIndexOf('e', ['a', 'b', 'c', 'd', 'e'])).toBe(0)
  })
})

describe('hexToRgb', () => {
  it('轉成 0..1 的 RGB', () => {
    expect(hexToRgb('#FF0080')).toEqual([1, 0, 128 / 255])
  })
})

describe('invincibleBlinkOn', () => {
  it('不在無敵中恆為 false', () => {
    expect(invincibleBlinkOn(1000, 0)).toBe(false)
    expect(invincibleBlinkOn(1000, 1000)).toBe(false)
  })
  it('剩餘 > 1.5 秒時 8Hz：每 62.5ms 切換一次', () => {
    const until = 10000
    const t0 = until - 5000 + 20 // 取半週期中段，避開切換邊界
    const a = invincibleBlinkOn(t0, until)
    expect(invincibleBlinkOn(t0 + 62.5, until)).toBe(!a)
    expect(invincibleBlinkOn(t0 + 125, until)).toBe(a)
  })
  it('最後 1.5 秒改 16Hz：每 31.25ms 切換一次', () => {
    const until = 10000
    const t0 = until - 1000 + 10
    const a = invincibleBlinkOn(t0, until)
    expect(invincibleBlinkOn(t0 + 31.25, until)).toBe(!a)
    expect(invincibleBlinkOn(t0 + 62.5, until)).toBe(a)
  })
})
