import { describe, expect, it } from 'vitest'
import { perfLogLine } from '@/babylon/games/bomberFx/perfLog'

describe('perfLogLine（AC8 量測行）', () => {
  it('正常取樣：四捨五入 fps', () => {
    expect(perfLogLine(42, 59.6)).toBe('[bomber] drawCalls=42 fps=60')
  })

  it('還沒渲染過（drawCalls=0 或 fps 非有限值）回 null，不印雜訊', () => {
    expect(perfLogLine(0, Infinity)).toBeNull()
    expect(perfLogLine(0, 60)).toBeNull()
    expect(perfLogLine(30, Infinity)).toBeNull()
    expect(perfLogLine(30, NaN)).toBeNull()
  })
})
