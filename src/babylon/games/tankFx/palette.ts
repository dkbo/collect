/**
 * 坦克 A「Toy Army」場景色票（spec §2.2／§2.3）：純資料，不依賴 Babylon。玩家色沿用 fx/palette 的 PLAYER_PALETTE。
 */
import type { ItemKind } from '@/babylon/games/tankFx/combat'

export { OUTLINE, PLAYER_PALETTE, type ColorIndex } from '@/babylon/fx/palette'

export const TANK = {
  groundA: '#A9B67F',
  groundB: '#9DAB72',
  groundSeam: '#8E9C66',
  camo: '#93A169',
  void: '#22302C',
  plinth: '#1A2421',
  wallTop: '#E3E6EF',
  wallSide: '#9BA1B8',
  wallSideDark: '#767C95',
  wallBand: '#F1F3F8',
  stud: '#EDEFF5',
  studSide: '#B9BFD0',
  borderTop: '#B3A4C9',
  borderSide: '#6F6490',
  borderStud: '#C9BEDB',
  borderStudSide: '#8C80AA',
  closeTop: '#FF5A4E',
  closeSide: '#C23A33',
  closeStud: '#FF8A80',
  closeStudSide: '#D9483F',
  warn: '#FF3B30',
  trackTop: '#4A4566',
  trackSide: '#3A3556',
  cleat: '#6E6890',
  wheel: '#8E9AB0',
  hub: '#C3CBD8',
  barrel: '#8A93B8',
  barrelDark: '#5B6285',
  muzzle: '#3A3F5C',
  face: '#FFF1E0',
  eye: '#2B2440',
  headlight: '#FFF6C8',
  aiBall: '#39E6FF',
  bullet: '#FFF1B8',
  bulletHot: '#FFD23F',
  bounce: '#FF5A4E',
  shield: '#39D5FF',
  shieldFill: '#7FE8FF',
  triple: '#B07CFF',
  dust: '#E4DCC0',
} as const

export interface ItemColor {
  shell: string
  lip: string
  icon: string
}

/** 道具代幣：底色、暗階下唇、圖示色 */
export const ITEM_COLORS: Record<ItemKind, ItemColor> = {
  hp: { shell: '#FF5C8A', lip: '#C2335E', icon: '#FFFFFF' },
  speed: { shell: '#FFD23F', lip: '#C79A00', icon: '#3A2A00' },
  rapid: { shell: '#FF6B3D', lip: '#C2441B', icon: '#FFFFFF' },
  shield: { shell: '#1FB5E0', lip: '#0B7FA6', icon: '#FFFFFF' },
  triple: { shell: '#B07CFF', lip: '#7A45D6', icon: '#FFFFFF' },
}

/** 道具圖集的格序（textures.ts 的 itemCellUV 用） */
export const ITEM_ORDER: readonly ItemKind[] = ['hp', 'speed', 'rapid', 'shield', 'triple']
