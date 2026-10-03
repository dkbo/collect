/**
 * 坦克特效的色票與粒子樣式（effects.ts 拆出，純資料）。每種色票的樣式只建一次（styleCache）。
 */
import { style, type FxStyle } from '@/babylon/fx/emitter'
import { Color3 } from '@/babylon/babylonCore'
import { TANK } from '@/babylon/games/tankFx/palette'

export const CREAM = '#FFF6E3'
export const WOOD = ['#F0B866', '#C07E33'] as const
export const FLASH = ['#FFF6C8', '#FFC53A', '#FF7A1A'] as const
/** 每幀更新用的預算色（避免逐幀 FromHexString 配置新物件） */
export const FLASH_C = FLASH.map((h) => Color3.FromHexString(h))
export const SMOKE_DARK = '#5D627A'
export const SMOKE = '#C4C8D6'
export const SPARK_HOT = '#FFE38A'
export const BOOST_DUST = '#FFE9A0'
export const DEG = Math.PI / 180

export const STYLE = {
  hitStar: style('#FFFFFF', '#FFFFFF', '#FFE38A', { size: [0.8, 0.8], life: [0.16, 0.2], power: [0, 0], dir: 'up' }),
  bounceStar: style('#FFFFFF', SPARK_HOT, '#FFE38A', { size: [0.6, 0.6], life: [0.12, 0.16], power: [0, 0], dir: 'up' }),
  boomStar: style('#FFFFFF', FLASH[0], FLASH[1], { size: [2.4, 2.4], life: [0.1, 0.14], power: [0, 0], dir: 'up' }),
  boomSpark: style('#FFFFFF', '#FFC53A', FLASH[2], { size: [0.14, 0.3], life: [0.25, 0.45], power: [5, 9], dir: 'burst' }),
  boomSmoke: style(SMOKE_DARK, SMOKE, SMOKE, { size: [0.8, 1.3], life: [0.8, 1.2], power: [0.6, 1.4], dir: 'up' }, 0.85),
  shard: style(TANK.shieldFill, TANK.shield, TANK.shieldFill, { size: [0.2, 0.34], life: [0.18, 0.26], power: [4, 6.5], dir: 'radial' }),
  crateSmoke: style(CREAM, '#F3E6CC', CREAM, { size: [0.9, 1.3], life: [0.45, 0.6], power: [0.4, 0.9], dir: 'up' }, 0.9),
  landDust: style(TANK.dust, '#D8C8A6', TANK.dust, { size: [0.6, 1.0], life: [0.4, 0.6], power: [2.5, 4], dir: 'radial' }, 0.85),
  dust: style(TANK.dust, TANK.dust, TANK.dust, { size: [0.3, 0.6], life: [0.4, 0.5], power: [0.3, 0.6], dir: 'up' }, 0.5),
  boostDust: style(BOOST_DUST, BOOST_DUST, BOOST_DUST, { size: [0.3, 0.6], life: [0.4, 0.5], power: [0.3, 0.6], dir: 'up' }, 0.6),
  bounceTrail: style('#FFFFFF', TANK.bounce, TANK.bounce, { size: [0.16, 0.22], life: [0.18, 0.26], power: [0.02, 0.06], dir: 'up' }),
} as const

export const muzzleSparkStyle = (dx: number, dz: number): FxStyle =>
  style('#FFFFFF', SPARK_HOT, FLASH[2], { size: [0.1, 0.18], life: [0.1, 0.18], power: [4, 7], dir: 'aim', aim: [dx, 0.12, dz], cone: 25 * DEG })
export const bounceSparkStyle = (dx: number, dz: number): FxStyle =>
  style('#FFFFFF', SPARK_HOT, SPARK_HOT, { size: [0.1, 0.2], life: [0.12, 0.18], power: [3, 6], dir: 'aim', aim: [dx, 0.35, dz], cone: 70 * DEG })

/** 每種色票只建一次樣式（拖尾、命中、拾取依玩家／道具換色） */
export const styleCache = new Map<string, FxStyle>()
export const cached = (key: string, make: () => FxStyle): FxStyle => {
  let s = styleCache.get(key)
  if (!s) styleCache.set(key, (s = make()))
  return s
}
