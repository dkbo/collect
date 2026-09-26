/**
 * 玩具系列開局倒數配色（bomber spec §9，kitchen 沿用）：奶油底、深紫描邊、Fredoka。
 * 面板走 UI 相機，不經 ACES／bloom，填的就是畫面色。
 */
import type { CountdownTheme } from '@/babylon/hud'
import { OUTLINE } from '@/babylon/fx/palette'

export const COUNTDOWN_THEME: CountdownTheme = {
  fontFamily: 'Fredoka, sans-serif',
  count: { glow: 'rgba(0,0,0,0.4)', fill: '#FFF6E3', border: OUTLINE, stroke: OUTLINE, text: '#FF7A1A' },
  go: { glow: 'rgba(0,0,0,0.4)', fill: '#2FCF5E', border: OUTLINE, stroke: OUTLINE, text: '#FFFFFF' },
  plain: { stroke: OUTLINE, text: '#FFF6E3' },
  shadowOffset: 0.12,
  shadowBlur: 0,
}
