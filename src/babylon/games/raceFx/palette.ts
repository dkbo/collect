/**
 * 極速賽車 A「Toy Racer」場景與道具色票（spec §3.2／§3.3）：純資料，不依賴 Babylon。玩家色沿用 fx/palette 的 PLAYER_PALETTE。
 */
import type { ItemKind } from '@/babylon/games/raceRules/items'

export { OUTLINE, PLAYER_PALETTE, type ColorIndex } from '@/babylon/fx/palette'

export const RACE = {
  sky: '#9ED8F5',
  /** 實際填進 clearColor／fogColor 的天色：ACES＋對比會把 #9ED8F5 壓成灰藍 (188,202,208)，這個值渲染後約 (149,192,206) */
  skyClear: '#4FB4EE',
  matA: '#EBD9AF',
  matB: '#E2CE9F',
  matLine: '#D3BD8A',
  matMajor: '#C4AA72',
  table: '#C08A55',
  tableGrain: '#A97646',
  road: '#5A5380',
  roadSeam: '#47406A',
  roadEdge: '#FFF6E3',
  curbRed: '#F0503C',
  curbWhite: '#FFF6E3',
  curbRedSide: '#B8392B',
  curbWhiteSide: '#D9CBB0',
  startA: '#FFFFFF',
  startB: '#2B2440',
  arch: '#FF8A3D',
  archDark: '#C2561B',
  banner: '#FFF6E3',
  stand: '#B3A4C9',
  standSide: '#6F6490',
  roof: '#FFF6E3',
  roofStripe: '#F0503C',
  flagPole: '#E3E6EF',
  block: ['#FF8A94', '#8CC4FF', '#93F0A8', '#FFF0A0'],
  treeTop: '#7CCB6A',
  treeTrunk: '#A97646',
  cone: '#FF8A3D',
  coneStripe: '#FFF6E3',
  boostPad: '#FFB21F',
  boostArrow: '#FFF6C8',
  ramp: '#FFD23F',
  rampSide: '#C79A00',
  rampStripe: '#2B2440',
  tire: '#2F2A40',
  tread: '#3A3556',
  hub: '#C3CBD8',
  seat: '#3A3556',
  steer: '#2B2440',
  bumper: '#3A3556',
  visor: '#2E3A4F',
  visorShine: '#9FE4FF',
  face: '#FFF1E0',
  eye: '#2B2440',
  headlight: '#FFF6C8',
  exhaust: '#8E9AB0',
  aiBall: '#39E6FF',
  slip: '#E8F7FF',
  dust: '#E4D3A8',
  spark: '#FFE38A',
  shield: '#39D5FF',
  shieldFill: '#7FE8FF',
} as const

/** 甩尾段位 0..3：白（未滿第一段）／藍／橘／紫（spec §3.2 drift1..3，放開噴焰同色） */
export const DRIFT_COLORS = ['#FFFFFF', '#39C2FF', '#FF9A1F', '#C05CFF'] as const

/** 道具（HUD 道具欄與 3D 共用） */
export const ITEM_COLORS: Record<ItemKind, { main: string; dark: string; accent: string }> = {
  banana: { main: '#FFD23F', dark: '#C79A00', accent: '#7A4A1D' },
  shell: { main: '#E8413A', dark: '#A82A24', accent: '#FF8A80' },
  mushroom: { main: '#FF7A3D', dark: '#C2561B', accent: '#FFF6E3' },
  shield: { main: '#1FB5E0', dark: '#0B7FA6', accent: '#7FE8FF' },
}

/** 道具箱面色輪替（圖集 4 格的底色） */
export const BOX_FACE_COLORS = ['#FF5C8A', '#FFD23F', '#39D5FF', '#7CF06A'] as const
