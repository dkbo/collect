/**
 * 廚房快手角色外觀（kitchen spec §4）：沿用 fx/avatar 的玩具角色，天線換白色廚師帽、身前加白圍裙與本色口袋。
 */
import { roundedBox, type MeshData } from '@/babylon/fx/geometry'
import { at, radial, rgba, solid, sphere } from '@/babylon/fx/models'
import type { AvatarKitOptions } from '@/babylon/fx/avatar'
import type { PlayerPalette } from '@/babylon/fx/palette'
import { KITCHEN } from '@/babylon/games/kitchenFx/palette'

const rbox = (w: number, h: number, d: number, r: number): MeshData => roundedBox({ width: w, height: h, depth: d, radius: r, segments: 2 })

/** 廚師帽（頭心座標）：帽圈圓角盒 0.5×0.14×0.5，帽頂 3 顆球排成一排（中間稍高） */
const chefHat = (): MeshData[] => {
  const white = (d: MeshData) => radial(d, KITCHEN.hat, KITCHEN.hat, KITCHEN.hatShade)
  return [
    at(white(rbox(0.5, 0.14, 0.5, 0.06)), { x: 0, y: 0.42, z: 0 }),
    at(white(sphere(0.3, 12)), { x: -0.15, y: 0.58, z: 0 }),
    at(white(sphere(0.32, 12)), { x: 0, y: 0.63, z: 0.02 }),
    at(white(sphere(0.3, 12)), { x: 0.15, y: 0.58, z: 0 }),
  ]
}

/** 圍裙（身體座標）：白色圓角片貼在身體前面，加一個本色口袋 */
const apron = (pal: PlayerPalette): MeshData[] => [
  at(radial(rbox(0.36, 0.3, 0.04, 0.02), KITCHEN.hat, KITCHEN.hat, KITCHEN.hatShade), { x: 0, y: 0.56, z: 0.23 }),
  at(solid(rbox(0.16, 0.09, 0.03, 0.015), rgba(pal.base)), { x: 0, y: 0.5, z: 0.25 }),
]

export const KITCHEN_AVATAR: AvatarKitOptions = {
  style: { headgear: () => chefHat(), outfit: apron, legs: KITCHEN.pants, face: KITCHEN.face, eye: KITCHEN.eye },
  haloColor: '#FFCF3F',
}
