/**
 * 炸彈超人 A「Toy Box」配色（spec §4／§5）：純資料與純函式，不依賴 Babylon，可在 node 單測。
 */

import { OUTLINE, PLAYER_PALETTE, type ColorIndex } from '@/babylon/fx/palette'

// 通用的玩家配色已搬到 fx/palette；這裡轉出給既有使用端（bomber、bomberHud）
export { PLAYER_PALETTE, hexToRgb, type ColorIndex, type PlayerPalette } from '@/babylon/fx/palette'

/** 場景物件色票（spec §5） */
export const TOY = {
  outline: OUTLINE,
  face: '#FFF1E0',
  eye: '#2B2440',
  aiAntenna: '#39E6FF',
  invincible: '#FFCF3F',
  groundA: '#79C257',
  groundB: '#6CB44C',
  grassTuft: '#58A03C',
  pillarTop: ['#E3E6EF', '#C4C8D6'],
  pillarSide: ['#9BA1B8', '#767C95'],
  pillarJoint: '#5D627A',
  borderTop: '#B3A4C9',
  borderSide: '#6F6490',
  moss: '#7FB85A',
  crateTop: '#F7C677',
  crateSide: '#DC9A48',
  crateBrace: '#8F561D',
  hardWood: '#D99A5A',
  hardIron: ['#8E9AB0', '#C3CBD8'],
  hardRivet: '#FFE38A',
  damagedWood: '#B98450',
  suddenTop: '#FF5A4E',
  suddenWarn: '#FF3B30',
  bomb: ['#6B7089', '#2A2D3D', '#15161F'],
  bombFlash: '#FF3B30',
  fuse: '#D9A066',
  flame: ['#FF7A1A', '#FFC53A', '#FFF6C8'], // 外、中、芯
} as const

/** 道具代幣底色（spec §5 道具列），圖示白色；速度、無敵用深色圖示 */
export const ITEM_COLORS = {
  bomb: '#4AA3FF',
  fire: '#FF6B3D',
  speed: '#FFD23F',
  kick: '#B07CFF',
  throw: '#3FD0A0',
  invincible: '#FFCF3F',
} as const
export const ITEM_ICON_DARK = '#3A2A00'

/** 依實體序取色：entityIds 為「真人在前、bot 在後」的合併名冊，與 spawnOf 用同一個順序，
 *  所以同一位玩家在每個 client 上顏色一致。找不到回 0（對齊 spawnOf 的 Math.max(0, idx)）。 */
export function colorIndexOf(id: string, entityIds: readonly string[]): ColorIndex {
  const idx = Math.max(0, entityIds.indexOf(id))
  return (idx % PLAYER_PALETTE.length) as ColorIndex
}

export const INVINCIBLE_BLINK_HZ = 8
export const INVINCIBLE_FAST_HZ = 16
export const INVINCIBLE_FAST_MS = 1500

/** 無敵金圈閃爍（方波）：剩 > 1.5 秒 8Hz，最後 1.5 秒 16Hz；以剩餘時間算相位，各端一致 */
export function invincibleBlinkOn(now: number, until: number): boolean {
  const left = until - now
  if (left <= 0) return false
  const hz = left > INVINCIBLE_FAST_MS ? INVINCIBLE_BLINK_HZ : INVINCIBLE_FAST_HZ
  return Math.floor((left / 1000) * hz * 2) % 2 === 0
}
