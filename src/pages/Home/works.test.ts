import { describe, expect, it } from 'vitest'
import { HERO_TILES, WORKS } from './works'
import appSource from '@/App.tsx?raw'

// 以 ?raw 讀 App.tsx 原始碼抓路由 path，避免 import 帶 JSX 與 lazy 的 App
const routePaths = new Set([...appSource.matchAll(/path: '([^']+)'/g)].map((m) => m[1]))

describe('WORKS', () => {
  it('共 9 個作品，id 唯一', () => {
    expect(WORKS).toHaveLength(9)
    expect(new Set(WORKS.map((w) => w.id)).size).toBe(9)
  })

  it('每個 to 都是 App.tsx 定義的路由', () => {
    for (const w of WORKS) {
      expect(w.to.startsWith('/')).toBe(true)
      expect(routePaths.has(w.to.slice(1)), `${w.id} → ${w.to}`).toBe(true)
    }
  })

  it('featured / shot 卡有截圖路徑，icon 卡有圖示', () => {
    for (const w of WORKS) {
      if (w.variant === 'icon') {
        expect(w.icon, w.id).toBeDefined()
        expect(w.shot, w.id).toBeUndefined()
      } else {
        expect(w.shot, w.id).toMatch(new RegExp(`works/${w.id}\\.webp$`))
      }
    }
  })

  it('恰有一張 featured，五張遊戲、四張工具', () => {
    expect(WORKS.filter((w) => w.variant === 'featured')).toHaveLength(1)
    expect(WORKS.filter((w) => w.kind === 'game')).toHaveLength(5)
    expect(WORKS.filter((w) => w.kind === 'tool')).toHaveLength(4)
  })

  it('每張卡至少一個標籤、文案非空', () => {
    for (const w of WORKS) {
      expect(w.tags.length, w.id).toBeGreaterThan(0)
      expect(w.title.trim().length, w.id).toBeGreaterThan(0)
      expect(w.desc.trim().length, w.id).toBeGreaterThan(0)
    }
  })
})

describe('HERO_TILES', () => {
  it('恰為 battle、rpgroom、candy 三張', () => {
    expect(HERO_TILES.map((w) => w.id)).toEqual(['battle', 'rpgroom', 'candy'])
  })
})
