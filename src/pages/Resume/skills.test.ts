import { describe, expect, it } from 'vitest'
import { SKILL_ITEMS, skillTagStyle, CHART_TONE } from '@/pages/Resume/skills'

describe('skillTagStyle', () => {
  it('weight 6 為 Tag l pop', () => {
    expect(skillTagStyle(6, 0)).toEqual({ size: 'l', tone: 'pop' })
  })

  it('weight 4 依序 sky／mint／pink 輪替（以 weight 4 內的序號計）', () => {
    expect([0, 1, 2, 3].map((i) => skillTagStyle(4, i).tone)).toEqual(['sky', 'mint', 'pink', 'sky'])
    expect(skillTagStyle(4, 0).size).toBe('s')
  })

  it('weight 3 為 Tag s plain', () => {
    expect(skillTagStyle(3, 5)).toEqual({ size: 's', tone: 'plain' })
  })
})

describe('SKILL_ITEMS', () => {
  it('保留原有 29 項技能與權重', () => {
    expect(SKILL_ITEMS).toHaveLength(29)
    expect(SKILL_ITEMS.filter((s) => s.weight === 6).map((s) => s.text)).toEqual([
      'Vue2 / Vue3',
      'React',
      'TypeScript',
      'JavaScript (ES6+)',
      'Claude Code',
    ])
  })
})

describe('CHART_TONE', () => {
  it('狀態圖顏色對應貼紙色', () => {
    expect(CHART_TONE).toEqual({ green: 'mint', blue: 'sky', red: 'pink' })
  })
})
