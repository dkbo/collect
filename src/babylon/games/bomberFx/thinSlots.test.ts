import { describe, expect, it } from 'vitest'
import { ThinSlots } from '@/babylon/games/bomberFx/thinSlots'

const fill = (s: ThinSlots<number>, k: number, v: number) => s.write(k, (buf, o) => buf.fill(v, o, o + 16))

describe('ThinSlots', () => {
  it('add 依序配 slot、count 累加', () => {
    const s = new ThinSlots<number>(4)
    s.add(10)
    s.add(20)
    expect(s.count).toBe(2)
    expect(s.slotOf(20)).toBe(1)
    expect(s.has(10)).toBe(true)
  })
  it('remove 把最後一筆搬進空位（swap-remove），matrix 內容跟著搬', () => {
    const s = new ThinSlots<number>(4)
    for (const k of [1, 2, 3]) {
      s.add(k)
      fill(s, k, k)
    }
    s.remove(1)
    expect(s.count).toBe(2)
    expect(s.slotOf(3)).toBe(0)
    expect(s.buffer[0]).toBe(3)
    expect(s.slotOf(2)).toBe(1)
    expect(s.has(1)).toBe(false)
  })
  it('remove 不存在的 key 不動', () => {
    const s = new ThinSlots<number>(2)
    s.add(1)
    s.remove(9)
    expect(s.count).toBe(1)
  })
  it('超出容量自動擴充並保留既有資料，版本號遞增', () => {
    const s = new ThinSlots<number>(1)
    s.add(1)
    fill(s, 1, 7)
    const v0 = s.bufferVersion
    s.add(2)
    expect(s.capacity).toBeGreaterThanOrEqual(2)
    expect(s.buffer[0]).toBe(7)
    expect(s.bufferVersion).toBe(v0 + 1)
  })
  it('重複 add 同 key 回原 slot', () => {
    const s = new ThinSlots<number>(2)
    s.add(1)
    expect(s.add(1)).toBe(0)
    expect(s.count).toBe(1)
  })
  it('clear 歸零、寫入標 dirty', () => {
    const s = new ThinSlots<number>(2)
    s.add(1)
    s.dirty = false
    fill(s, 1, 1)
    expect(s.dirty).toBe(true)
    s.clear()
    expect(s.count).toBe(0)
    expect(s.has(1)).toBe(false)
  })
})
