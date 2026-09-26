/**
 * 廚房快手 A「Toy Kitchen」場景色票（kitchen spec §5）：純資料。玩家 4 色與描邊色在 fx/palette。
 */
import { OUTLINE } from '@/babylon/fx/palette'

export const KITCHEN = {
  outline: OUTLINE,
  // 地面（奶油棋盤）
  groundA: '#F6E7C8',
  groundB: '#EAD5AC',
  groundSeam: 'rgba(217,192,142,0.5)',
  // 背牆磁磚與牆帽（牆帽與 bomber 外框同色）
  tile: '#A9E0CF',
  tileSeam: '#8FCDB9',
  wallCapTop: '#B3A4C9',
  wallCapSide: '#6F6490',
  // 一般檯面（白鋼頂＋灰藍櫃）
  counterTop: '#E3E6EF',
  counterTopEdge: '#F1F3F8',
  counterSide: ['#9BA1B8', '#767C95'],
  counterDoor: '#C4C8D6',
  counterHandle: '#5D627A',
  // 食材箱（木）
  crateTop: '#F7C677',
  crateSide: '#DC9A48',
  crateSeam: '#8F561D',
  crateLiner: '#6B4A2A',
  // 砧板與刀
  boardTop: '#F2C98A',
  boardSide: '#C98E48',
  blade: '#DDE3EE',
  knifeHandle: '#FF6B3D',
  // 爐台與鍋
  stove: '#2B2440',
  stoveTop: '#3A3556',
  burnerOff: '#4A4466',
  burnerOn: '#FF5A4E',
  pot: ['#6E77A0', '#5B6285', '#3A3F5C'],
  potRim: '#8A93B8',
  // 出餐口
  serve: ['#FFE38A', '#FFCF3F', '#D9A21A'],
  bell: ['#FFF0A0', '#FFD23F', '#C28A00'],
  windowTop: '#FFE9B0',
  windowBottom: '#FFB84A',
  serveSign: '#FF3B4E',
  // 盤子與碗
  plate: '#F4F6FA',
  plateRim: '#C4C8D6',
  bowl: ['#FFFFFF', '#F1F3F8', '#B9BFD3'],
  // 食材
  veg: ['#B6F07A', '#6FCF3F', '#3E9A2A'],
  meat: ['#FF9A9A', '#E8525E', '#A62C3A'],
  fat: '#FFE9DE',
  bone: '#FFF6E8',
  soupV: '#9BD65A',
  soupM: '#EE8A3A',
  burnt: '#2E2424',
  crack: '#FF6A2A',
  // 廚師
  hat: '#FFFFFF',
  hatShade: '#C9C3DA',
  face: '#FFF1E0',
  eye: '#2B2440',
  pants: '#3A3556',
} as const
