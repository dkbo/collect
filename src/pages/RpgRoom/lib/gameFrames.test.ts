import { describe, expect, it } from 'vitest'

// AC8／AC10 守門：五個遊戲頁外框改用 toybox（只掃頁面外框檔，凍結的糖果 HUD 不在內）
// app tsconfig 沒有 node 型別、vitest 又把 CSS ?raw 讀成空字串，所以動態載入 node:fs 讀原始檔（vitest 在專案根目錄執行）
type Fs = { existsSync: (p: string) => boolean; readFileSync: (p: string, enc: 'utf8') => string }
const FS_MODULE = 'node:fs'
const fs: Fs = await import(/* @vite-ignore */ FS_MODULE)
const read = (p: string) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '')

const PAGES = [
  { tsx: 'src/pages/MapDeveloper/index.tsx', css: 'src/pages/MapDeveloper/MapDeveloper.css', prefix: 'mapdev-' },
  { tsx: 'src/pages/MiniGame/index.tsx', css: 'src/pages/MiniGame/MiniGame.css', prefix: 'mini-' },
  { tsx: 'src/pages/GodotGame/index.tsx', css: 'src/pages/GodotGame/GodotGame.css', prefix: 'godot-' },
  { tsx: 'src/pages/RpgRoom/index.tsx', css: 'src/pages/RpgRoom/RpgRoom.css', prefix: 'rpg-' },
  { tsx: 'src/pages/CandyCrush/index.tsx', css: 'src/pages/CandyCrush/CandyCrush.css', prefix: 'candy-page-' },
]

// 與 AC10 同一條 regex；拆段拼接，免得 AC10 的 grep 掃到這行字面
const FORBIDDEN = new RegExp(['(purple|indigo|violet|fuchsia)', '-[0-9]|bg-(gradient|linear)', '-|bg-clip', '-text|backdrop', '-blur|blur-\\['].join(''))
const OLD_CLASSES = /\b(rpg-cabinet|rpg-chat-box|rpg-joy-base|rpg-joy-knob|rpg-touch-action|candy-tool-btn|candy-title|candy-subtitle)\b|['" ]rpg-(screen|canvas)['" ]/
const HEX = /#[0-9a-fA-F]{3,8}\b/

describe.each(PAGES)('$tsx', ({ tsx, css, prefix }) => {
  const src = read(tsx)

  it('不含禁用樣式與舊頁面 class', () => {
    const hits = src.split('\n').filter((l: string) => FORBIDDEN.test(l) || OLD_CLASSES.test(l))
    expect(hits).toEqual([])
  })

  it('載入自己的頁面 CSS，檔首 @reference index.css', () => {
    expect(src).toContain(`import '@/${css.slice(4)}'`)
    const sheet = read(css)
    expect(sheet.startsWith('@reference "../../index.css";')).toBe(true)
    expect(sheet.split('\n').filter((l: string) => FORBIDDEN.test(l) || HEX.test(l))).toEqual([])
  })

  it('頁面 CSS 的 class 都帶頁名前綴', () => {
    const names = [...read(css).matchAll(/^\s*\.([a-z][\w-]*)/gm)].map((m) => m[1])
    expect(names.length).toBeGreaterThan(0)
    expect(names.filter((n) => !n.startsWith(prefix))).toEqual([])
  })

  it('頁面 CSS 包在 @layer components（不蓋過 className 的 utility）', () => {
    const sheet = read(css)
    const body = sheet.replace(/\/\*[\s\S]*?\*\//g, '').replace('@reference "../../index.css";', '').trim()
    expect(body.startsWith('@layer components {')).toBe(true)
    expect(body.endsWith('}')).toBe(true)
  })

  it('TSX 用到的頁面前綴 class 都有 CSS 定義', () => {
    const defined = new Set([...read(css).matchAll(/\.([a-z][\w-]*)/g)].map((m) => m[1]))
    const used = new Set(
      [...src.matchAll(/className=(?:"([^"]*)"|\{[^}]*?'([^']*)'|\{`([^`]*)`)/g)]
        .flatMap((m) => (m[1] ?? m[2] ?? m[3] ?? '').split(/\s+/))
        .concat([...src.matchAll(/'([a-z][\w-]*)'/g)].map((m) => m[1]))
        .filter((c) => c.startsWith(prefix)),
    )
    expect([...used].filter((c) => !defined.has(c))).toEqual([])
  })

  it('遊戲畫面以 tb-screen／ScreenFrame 包起來', () => {
    expect(/tb-screen|<ScreenFrame/.test(src)).toBe(true)
  })
})

// 觸控目標 ≥ 44px：size-9 浮鈕只准疊在遊戲畫面內（ruling 10:41）；MapDeveloper 的工具列與表單列不在畫面上
it('MapDeveloper 不用 size-9 的 ScreenIconButton', () => {
  expect(read('src/pages/MapDeveloper/index.tsx')).not.toContain('<ScreenIconButton')
})
