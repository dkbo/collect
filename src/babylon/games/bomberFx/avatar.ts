/**
 * 炸彈超人角色外觀（spec §4）：通用角色在 fx/avatar，這裡只給頭上的天線與 AvatarKit 設定。
 * 真人的粉紅天線球併進身體；AI 的青色發光球由 fx/avatar 另建（Glow 白名單）。
 */
import type { MeshData } from '@/babylon/fx/geometry'
import { at, cylinder, radial, rgba, solid, sphere } from '@/babylon/fx/models'
import type { AvatarKitOptions } from '@/babylon/fx/avatar'
import { TOY } from '@/babylon/games/bomberFx/palette'

/** 天線球在頭心座標系的高度 */
const ANTENNA_BALL_Y = 0.68

const antenna = (_pal: unknown, isAI: boolean): MeshData[] => {
  const parts = [at(solid(cylinder(0.2, 0.045, 6), rgba(TOY.outline)), { x: 0, y: 0.54, z: 0 })]
  if (!isAI) parts.push(at(radial(sphere(0.19, 10), '#FFB3D6', '#FF5AA8', '#C2307A'), { x: 0, y: ANTENNA_BALL_Y, z: 0 }))
  return parts
}

export const BOMBER_AVATAR: AvatarKitOptions = {
  style: { headgear: antenna, legs: '#3B3453', face: TOY.face, eye: TOY.eye },
  haloColor: TOY.invincible,
  ai: { color: TOY.aiAntenna, ballY: ANTENNA_BALL_Y },
}
