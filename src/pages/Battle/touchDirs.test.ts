import { describe, expect, it } from 'vitest'
import { joyDirs } from '@/pages/Battle/touchDirs'

describe('虛擬搖桿方向 joyDirs', () => {
  it("預設 'xy'：上下左右都派發（其他遊戲行為不變）", () => {
    expect([...joyDirs(-0.8, -0.8)].sort()).toEqual(['arrowleft', 'arrowup'])
    expect([...joyDirs(0.8, 0.8, 'xy')].sort()).toEqual(['arrowdown', 'arrowright'])
  })

  it('死區內不派發', () => {
    expect(joyDirs(0.2, -0.3).size).toBe(0)
  })

  it("'x'：只派發左右，推上下也不出 arrowup／arrowdown", () => {
    expect([...joyDirs(-0.8, -0.9, 'x')]).toEqual(['arrowleft'])
    expect([...joyDirs(0.6, 0.9, 'x')]).toEqual(['arrowright'])
    expect(joyDirs(0.1, -1, 'x').size).toBe(0)
  })
})
