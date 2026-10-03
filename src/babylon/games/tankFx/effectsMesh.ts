/**
 * 坦克特效的小 mesh 工具（effects.ts 拆出）：圖集 UV 換格、連殺字卡兩片 quad 與換色。
 */
import type { Mesh } from '@/babylon/babylonCore'
import { rgba } from '@/babylon/fx/models'
import { CARD_BAND } from '@/babylon/games/tankFx/textures'

export const CARD_W = 2.2
export const CARD_H = 0.95

/** 把 CreatePlane 的 0..1 UV 換成圖集裡的一格 */
export function setQuadUV(mesh: Mesh, [u0, v0, u1, v1]: [number, number, number, number]): void {
  mesh.setVerticesData('uv', [u0, v0, u1, v0, u1, v1, u0, v1], true)
}

/**
 * 字卡 = 兩片 quad：下方本體（白頂點色）＋上方色帶（擊殺者 base 色），UV 都取同一格，
 * 色帶片對到圖集格上方那條白帶，乘上頂點色就成了擊殺者顏色。
 */
export function cardQuads() {
  const w = CARD_W / 2
  const top = CARD_H / 2
  const bot = -CARD_H / 2
  const cut = top - CARD_H * CARD_BAND
  const quad = (y0: number, y1: number) => [-w, y0, 0, w, y0, 0, w, y1, 0, -w, y1, 0]
  return {
    positions: [...quad(bot, cut), ...quad(cut, top)],
    normals: new Array(24).fill(0).map((_, i) => (i % 3 === 2 ? -1 : 0)),
    uvs: new Array(16).fill(0),
    indices: [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7],
    colors: new Array(32).fill(1),
  }
}

export function setCardLook(mesh: Mesh, [u0, v0, u1, v1]: [number, number, number, number], base: string): void {
  const vc = v1 - (v1 - v0) * CARD_BAND
  mesh.setVerticesData('uv', [u0, v0, u1, v0, u1, vc, u0, vc, u0, vc, u1, vc, u1, v1, u0, v1], true)
  const [r, g, b] = rgba(base)
  const white = [1, 1, 1, 1]
  const band = [r, g, b, 1]
  mesh.setVerticesData('color', [...white, ...white, ...white, ...white, ...band, ...band, ...band, ...band], true)
}
