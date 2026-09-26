/**
 * /battle 玩具系列共用的玩家配色（bomber spec §4、kitchen spec §4）：純資料與純函式，不依賴 Babylon。
 * 遊戲專屬色票留在各自的 `games/<遊戲>Fx/palette.ts`。
 */

export type ColorIndex = 0 | 1 | 2 | 3

export interface PlayerPalette {
  light: string
  base: string
  dark: string
}

/** 固定 4 色，依各遊戲的出生序分配；P 編號 = index + 1 */
export const PLAYER_PALETTE: readonly PlayerPalette[] = [
  { light: '#FF8A94', base: '#FF3B4E', dark: '#B3122A' }, // P1 紅
  { light: '#8CC4FF', base: '#2F86FF', dark: '#1446B8' }, // P2 藍
  { light: '#93F0A8', base: '#2FCF5E', dark: '#138A3A' }, // P3 綠
  { light: '#FFF0A0', base: '#FFC21A', dark: '#C27D00' }, // P4 黃
]

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/** 玩具系列共用描邊／深色線稿色（bomber TOY.outline、kitchen 描邊同色） */
export const OUTLINE = '#2B2440'
