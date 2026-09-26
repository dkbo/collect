import { describe, expect, it } from 'vitest'
import { perfLogLine } from '@/babylon/fx/perfLog'

describe('perfLogLine 的 tag（log 前綴依遊戲）', () => {
  it("tag='kitchen' 印 [kitchen]", () => {
    expect(perfLogLine(42, 59.6, 'kitchen')).toBe('[kitchen] drawCalls=42 fps=60')
  })
})
