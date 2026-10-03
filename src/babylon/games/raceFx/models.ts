/**
 * A「Toy Racer」程式建模（spec §4，純資料，可在 node 單測）：玩具車、輪胎、道具箱、香蕉、龜殼、場景積木與裝飾。
 * 頂點色、車頭朝 +z、原點在地面中心；需要依實例換色的（積木、路緣、觀眾、旗面）頂點色只放明暗，顏色走 instance color。
 */
import { mergeData, roundedBox, colorize, type FaceUV, type MeshData } from '@/babylon/fx/geometry'
import { at, cylinder, frustum, radial, rgba, solid, sphere, torus, type Rgba } from '@/babylon/fx/models'
import { OUTLINE, PLAYER_PALETTE, type ColorIndex } from '@/babylon/fx/palette'
import { BOX_FACE_COLORS, ITEM_COLORS, RACE } from '@/babylon/games/raceFx/palette'

const rb = (w: number, h: number, d: number, r: number): MeshData => roundedBox({ width: w, height: h, depth: d, radius: r })
const HALF_PI = Math.PI / 2
const deg = (d: number): number => (d * Math.PI) / 180

/** 依法線分明暗：頂面 1、側面 side、底面 bottom（給 instance color 乘） */
const shade = (d: MeshData, side = 0.78, bottom = 0.6): MeshData =>
  colorize(d, (_p, n) => {
    const k = n[1] > 0.5 ? 1 : n[1] < -0.5 ? bottom : side
    return [k, k, k, 1]
  })

/** 兩色依法線：頂面 top、其餘 side */
const topSide = (d: MeshData, top: string, side: string): MeshData => {
  const T = rgba(top)
  const S = rgba(side)
  return colorize(d, (_p, n) => (n[1] > 0.5 ? T : S))
}

// ---- 玩具車（§4.1） ----

/** 輪位（車身座標）：前輪隨轉向擺動，後輪大一點 */
export const WHEELS: readonly { x: number; y: number; z: number; scale: number; front: boolean }[] = [
  { x: -0.8, y: 0.31, z: 0.7, scale: 1, front: true },
  { x: 0.8, y: 0.31, z: 0.7, scale: 1, front: true },
  { x: -0.82, y: 0.33, z: -0.7, scale: 1.08, front: false },
  { x: 0.82, y: 0.33, z: -0.7, scale: 1.08, front: false },
]
/** 輪胎半徑（轉動角 = 移動距離 / 半徑） */
export const WHEEL_R = 0.31
/** 「你」標記中心高度（安全帽正上方，spec §4.1） */
export const YOU_Y = 2.0
/** 後輪之間火花芯的位置（車身座標） */
export const CORE_POS = { y: 0.3, z: -0.9 } as const

/** 一台車的車身（合併單一 mesh）；bot 多天線、安全帽不畫白條 */
export function carBodyData(ci: ColorIndex, isBot: boolean): MeshData {
  const pal = PLAYER_PALETTE[ci]
  const base = rgba(pal.base)
  const dark = rgba(pal.dark)
  const c = (hex: string): Rgba => rgba(hex)
  const parts: MeshData[] = [
    // 底盤車身、車鼻、前保桿
    at(radial(rb(1.36, 0.4, 2.0, 0.2), pal.light, pal.base, pal.dark), { x: 0, y: 0.42, z: 0 }),
    at(solid(rb(1.0, 0.24, 0.46, 0.12), base), { x: 0, y: 0.38, z: 0.98 }),
    at(solid(rb(1.3, 0.14, 0.18, 0.07), c(RACE.bumper)), { x: 0, y: 0.22, z: 1.12 }),
    // 側裙
    at(solid(rb(0.14, 0.18, 1.3, 0.06), dark), { x: -0.7, y: 0.28, z: 0 }),
    at(solid(rb(0.14, 0.18, 1.3, 0.06), dark), { x: 0.7, y: 0.28, z: 0 }),
    // 車頭燈
    at(solid(sphere(0.18, 8), c(RACE.headlight)), { x: -0.36, y: 0.48, z: 1.02, sz: 0.6 }),
    at(solid(sphere(0.18, 8), c(RACE.headlight)), { x: 0.36, y: 0.48, z: 1.02, sz: 0.6 }),
    // 座艙、方向盤
    at(solid(rb(0.86, 0.2, 0.86, 0.12), c(RACE.seat)), { x: 0, y: 0.72, z: -0.18 }),
    at(solid(torus(0.34, 0.06, 14), c(RACE.steer)), { x: 0, y: 0.92, z: 0.22, pitch: deg(-60) }),
    // 尾翼：支柱、翼板、端板
    at(solid(cylinder(0.36, 0.08, 6), c(RACE.exhaust)), { x: -0.34, y: 0.8, z: -0.86 }),
    at(solid(cylinder(0.36, 0.08, 6), c(RACE.exhaust)), { x: 0.34, y: 0.8, z: -0.86 }),
    at(solid(rb(1.5, 0.09, 0.42, 0.04), base), { x: 0, y: 1.0, z: -0.92 }),
    at(solid(rb(0.06, 0.26, 0.46, 0.02), dark), { x: -0.76, y: 1.0, z: -0.92 }),
    at(solid(rb(0.06, 0.26, 0.46, 0.02), dark), { x: 0.76, y: 1.0, z: -0.92 }),
    // 排氣管＋管口
    at(solid(cylinder(0.22, 0.14, 8), c(RACE.exhaust)), { x: -0.26, y: 0.34, z: -1.08, pitch: HALF_PI }),
    at(solid(cylinder(0.22, 0.14, 8), c(RACE.exhaust)), { x: 0.26, y: 0.34, z: -1.08, pitch: HALF_PI }),
    at(solid(cylinder(0.02, 0.08, 8), c(OUTLINE)), { x: -0.26, y: 0.34, z: -1.19, pitch: HALF_PI }),
    at(solid(cylinder(0.02, 0.08, 8), c(OUTLINE)), { x: 0.26, y: 0.34, z: -1.19, pitch: HALF_PI }),
    // 駕駛：身體、安全帽、護目鏡與反光條、臉、眼
    at(solid(rb(0.52, 0.34, 0.36, 0.12), base), { x: 0, y: 0.91, z: -0.2 }),
    at(radial(sphere(0.64, 14), pal.light, pal.base, pal.dark), { x: 0, y: 1.3, z: -0.18 }),
    at(solid(rb(0.5, 0.18, 0.1, 0.06), c(RACE.visor)), { x: 0, y: 1.3, z: 0.12 }),
    at(solid(rb(0.3, 0.03, 0.02, 0.01), c(RACE.visorShine)), { x: -0.06, y: 1.37, z: 0.175 }),
    at(solid(rb(0.36, 0.1, 0.06, 0.03), c(RACE.face)), { x: 0, y: 1.17, z: 0.12 }),
    at(solid(sphere(0.07, 6), c(RACE.eye)), { x: -0.08, y: 1.3, z: 0.17 }),
    at(solid(sphere(0.07, 6), c(RACE.eye)), { x: 0.08, y: 1.3, z: 0.17 }),
  ]
  if (isBot) {
    parts.push(
      at(solid(cylinder(0.32, 0.04, 6), c(RACE.exhaust)), { x: 0.18, y: 1.6, z: -0.25 }),
      at(solid(sphere(0.14, 8), c(RACE.aiBall)), { x: 0.18, y: 1.8, z: -0.25 })
    )
  } else {
    parts.push(at(solid(rb(0.12, 0.04, 0.6, 0.02), c('#FFFFFF')), { x: 0, y: 1.6, z: -0.18 }))
  }
  return mergeData(parts)
}

/** 輪胎：胎身＋輪轂，軸向沿 x；胎紋每 30° 一條（看得出轉動） */
export function wheelData(): MeshData {
  const axisX = { x: 0, y: 0, z: 0, pitch: HALF_PI, yaw: HALF_PI }
  const tire = at(cylinder(0.34, 0.62, 24), axisX)
  const T = rgba(RACE.tire)
  const S = rgba(RACE.tread)
  const striped = colorize(tire, (p) => {
    const r = Math.hypot(p[1], p[2])
    if (r < 0.28) return T
    const a = ((Math.atan2(p[1], p[2]) * 180) / Math.PI + 360) % 30
    return a < 6 ? S : T
  })
  const hub = solid(at(cylinder(0.36, 0.32, 12), axisX), rgba(RACE.hub))
  return mergeData([striped, hub])
}

// ---- 道具與道具箱（§4.2） ----

export const BOX_SIZE = 1.3

/** 道具箱：6 面 uv 對到 1024×256 圖集的格（±Z 第 0 格、±X 第 1 格、±Y 第 2 格；對面同色） */
export function boxData(): MeshData {
  const cell = (k: number): FaceUV => [k / 4, 0, (k + 1) / 4, 1]
  return roundedBox({
    width: BOX_SIZE,
    height: BOX_SIZE,
    depth: BOX_SIZE,
    radius: 0.2,
    faceUV: [cell(0), cell(0), cell(1), cell(1), cell(2), cell(2)],
  })
}
/** 道具箱圖集各格的底色（textures 畫圖集用） */
export const BOX_CELL_COLORS = BOX_FACE_COLORS

/** 香蕉皮：壓扁的果肉＋3 片往外趴的皮＋暗色尖端＋蒂，貼地 */
export function bananaData(): MeshData {
  const { main, dark, accent } = ITEM_COLORS.banana
  const parts: MeshData[] = [at(solid(sphere(0.42, 10), rgba(main)), { x: 0, y: 0.13, z: 0, sy: 0.6 })]
  const tilt = deg(70)
  for (let i = 0; i < 3; i++) {
    const yaw = (i * 2 * Math.PI) / 3
    const dir = [Math.sin(yaw), Math.cos(yaw)]
    const mid = 0.25
    const lift = Math.cos(tilt)
    const out = Math.sin(tilt)
    parts.push(
      at(solid(frustum(0.5, 0.08, 0.26, 8), rgba(main)), {
        x: dir[0] * out * mid,
        y: 0.12 + lift * mid,
        z: dir[1] * out * mid,
        pitch: tilt,
        yaw,
      }),
      at(solid(sphere(0.1, 6), rgba(dark)), { x: dir[0] * out * 0.5, y: 0.12 + lift * 0.5, z: dir[1] * out * 0.5 })
    )
  }
  parts.push(at(solid(cylinder(0.16, 0.08, 6), rgba(accent)), { x: 0, y: 0.28, z: 0 }))
  return mergeData(parts)
}

/** 紅龜殼：壓扁的殼頂（radial）＋白殼緣＋3 顆凸點；原點在殼心（實例 y 0.3 貼地） */
export function shellData(): MeshData {
  const { main, dark, accent } = ITEM_COLORS.shell
  const parts: MeshData[] = [
    at(radial(sphere(0.9, 14), accent, main, dark), { x: 0, y: 0, z: 0, sy: 0.62 }),
    at(solid(torus(0.92, 0.16, 20), rgba(RACE.roadEdge)), { x: 0, y: -0.06, z: 0 }),
  ]
  for (let i = 0; i < 3; i++) {
    const a = (i * 2 * Math.PI) / 3
    parts.push(at(solid(sphere(0.18, 6), rgba(accent)), { x: Math.sin(a) * 0.2, y: 0.22, z: Math.cos(a) * 0.2 }))
  }
  return mergeData(parts)
}

// ---- 場景（§4.3） ----

/** 凸點積木（2×2 或 2×4），原點在底面中心、高 1.2；頂點色只有明暗，顏色走 instance color */
export function blockData(kind: '2x2' | '2x4'): MeshData {
  const w = kind === '2x2' ? 2 : 4
  const parts: MeshData[] = [shade(at(rb(w, 1.2, 2, 0.12), { x: 0, y: 0.6, z: 0 }))]
  for (let i = 0; i < w; i++) {
    for (const z of [-0.5, 0.5]) parts.push(shade(at(cylinder(0.2, 0.5, 10), { x: -w / 2 + 0.5 + i, y: 1.3, z }), 0.85))
  }
  return mergeData(parts)
}

/** 路緣小方塊：沿線 1.5（z）× 0.12 高 × 0.9 寬 */
export function curbData(): MeshData {
  return shade(at(rb(0.9, 0.12, 1.5, 0.04), { x: 0, y: 0.06, z: 0 }))
}

/** 棋子觀眾：圓台身體＋頭，原點在底面 */
export function crowdData(): MeshData {
  return mergeData([
    shade(at(frustum(0.7, 0.3, 0.5, 10), { x: 0, y: 0.35, z: 0 }), 0.85),
    shade(at(sphere(0.36, 8), { x: 0, y: 0.86, z: 0 }), 0.85),
  ])
}

/** 棒棒糖樹：樹幹＋樹冠（上亮下暗），原點在地面 */
export function treeData(): MeshData {
  const crown = colorize(at(sphere(2.4, 12), { x: 0, y: 2.7, z: 0 }), (p) => {
    const t = Math.max(0, Math.min(1, (p[1] - 1.5) / 2.4))
    const [r, g, b] = rgba(RACE.treeTop)
    const k = 0.72 + 0.28 * t
    return [r * k, g * k, b * k, 1]
  })
  return mergeData([at(solid(cylinder(1.8, 0.4, 8), rgba(RACE.treeTrunk)), { x: 0, y: 0.9, z: 0 }), crown])
}

/** 三角錐：橘身、中段白環，原點在底面 */
export function coneData(): MeshData {
  const O = rgba(RACE.cone)
  const W = rgba(RACE.coneStripe)
  const body = colorize(at(frustum(0.9, 0.1, 0.6, 12), { x: 0, y: 0.45, z: 0 }), (p) => (p[1] > 0.38 && p[1] < 0.55 ? W : O))
  return mergeData([body, at(solid(rb(0.7, 0.06, 0.7, 0.03), O), { x: 0, y: 0.03, z: 0 })])
}

/** 雙面四邊形（法線 ±z），x 從 x0 到 x0 + w、y 置中 */
function quad2(w: number, h: number, x0: number, colorHex = '#FFFFFF'): MeshData {
  const c = rgba(colorHex)
  const y0 = -h / 2
  const y1 = h / 2
  const x1 = x0 + w
  return {
    positions: [x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y1, 0, x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y1, 0],
    normals: [0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
    uvs: [0, 0, 1, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 1, 1, 1],
    indices: [0, 1, 2, 0, 2, 3, 5, 4, 7, 5, 7, 6],
    colors: Array.from({ length: 8 }, () => [...c]).flat(),
  }
}

/** 旗面 1.2×0.7（雙面，左緣貼旗桿），顏色走 instance color */
export const flagData = (): MeshData => quad2(1.2, 0.7, 0)

/** 起跑拱門橫幅（雙面；背面 u 反向，從兩側看字都是正的），寬 w 高 h，中心在原點 */
export const bannerData = (w: number, h: number): MeshData => quad2(w, h, -w / 2)

/** 看台：3 階（每階高 1.2、深 2）＋屋頂＋紅條＋柱＋8 支旗桿；x 沿賽道、+z 遠離賽道，原點在前緣中心 */
export function standData(len: number): MeshData {
  const parts: MeshData[] = []
  for (let i = 0; i < 3; i++) {
    const h = 1.2 * (i + 1)
    parts.push(topSide(at(rb(len, h, 2, 0.1), { x: 0, y: h / 2, z: 1 + i * 2 }), RACE.stand, RACE.standSide))
  }
  parts.push(
    at(solid(rb(len, 0.3, 7, 0.1), rgba(RACE.roof)), { x: 0, y: 5.6, z: 3, pitch: deg(-8) }),
    at(solid(rb(len, 0.32, 0.5, 0.1), rgba(RACE.roofStripe)), { x: 0, y: 5.15, z: -0.3 })
  )
  for (const x of [-len / 2 + 0.4, len / 2 - 0.4]) {
    for (const z of [-0.2, 6]) parts.push(at(solid(cylinder(z < 0 ? 5 : 6, 0.24, 8), rgba(RACE.flagPole)), { x, y: z < 0 ? 2.5 : 3, z }))
  }
  for (const p of flagPoles(len)) parts.push(at(solid(cylinder(2.4, 0.1, 6), rgba(RACE.flagPole)), { x: p.x, y: p.y - 1.2, z: p.z }))
  return mergeData(parts)
}

/** 看台屋頂上 8 支旗桿的頂端（看台座標），旗面掛在這裡 */
export function flagPoles(len: number): { x: number; y: number; z: number }[] {
  return Array.from({ length: 8 }, (_, i) => ({ x: -len / 2 + (len * (i + 0.5)) / 8, y: 8.1, z: 3 }))
}

/** 起跑拱門：兩根 3 塊積木疊的立柱＋橫樑＋4 面玩家色三角旗；x 橫跨賽道、z 沿行進方向 */
export function archData(): MeshData {
  const parts: MeshData[] = []
  for (const x of [-7.6, 7.6]) {
    for (let k = 0; k < 3; k++) {
      const col = k % 2 === 0 ? RACE.arch : RACE.archDark
      parts.push(topSide(at(rb(1.4, 1.6, 1.4, 0.12), { x, y: 0.8 + k * 1.6, z: 0 }), col, col))
    }
    for (const dx of [-0.35, 0.35]) for (const dz of [-0.35, 0.35]) parts.push(at(solid(cylinder(0.2, 0.36, 8), rgba(RACE.arch)), { x: x + dx, y: 4.9, z: dz }))
  }
  parts.push(solid(at(rb(16.6, 1.5, 0.8, 0.15), { x: 0, y: 5.3, z: 0 }), rgba(RACE.arch)))
  PLAYER_PALETTE.forEach((p, i) => {
    const x = -4.5 + i * 3
    const c = rgba(p.base)
    parts.push({
      positions: [x - 0.6, 4.55, 0, x + 0.6, 4.55, 0, x, 3.7, 0, x - 0.6, 4.55, 0, x + 0.6, 4.55, 0, x, 3.7, 0],
      normals: [0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
      uvs: new Array(12).fill(0),
      indices: [0, 1, 2, 3, 5, 4],
      colors: Array.from({ length: 6 }, () => [...c]).flat(),
    })
  })
  return mergeData(parts)
}

/** 跳台貼圖的白色區（v 0..1/8）：側面、唇口、護欄以頂點色上色，uv 都指到這裡 */
const WHITE_UV: [number, number] = [0.5, 0.06]

/** 跳台楔形（長 len 沿 z、寬 w、唇口高 h）＋唇口白邊＋兩側護欄；頂面 uv 走斜紋區（v 1/8..1） */
export function rampData(len: number, w: number, h: number): MeshData {
  const x0 = -w / 2
  const x1 = w / 2
  const y0 = 0.02
  const ny = len / Math.hypot(len, h - y0)
  const nz = -(h - y0) / Math.hypot(len, h - y0)
  const top: MeshData = {
    positions: [x0, y0, 0, x1, y0, 0, x1, h, len, x0, h, len],
    normals: [0, ny, nz, 0, ny, nz, 0, ny, nz, 0, ny, nz],
    uvs: [0, 0.125, 1, 0.125, 1, 1, 0, 1],
    indices: [0, 1, 2, 0, 2, 3],
    colors: new Array(16).fill(1),
  }
  const S = rgba(RACE.rampSide)
  const side = (x: number, nx: number): MeshData => ({
    positions: [x, 0, 0, x, 0, len, x, h, len, x, y0, 0],
    normals: [nx, 0, 0, nx, 0, 0, nx, 0, 0, nx, 0, 0],
    uvs: [...WHITE_UV, ...WHITE_UV, ...WHITE_UV, ...WHITE_UV],
    indices: nx < 0 ? [1, 0, 3, 1, 3, 2] : [1, 3, 0, 1, 2, 3],
    colors: Array.from({ length: 4 }, () => [...S]).flat(),
  })
  const back: MeshData = {
    positions: [x0, 0, len, x1, 0, len, x1, h, len, x0, h, len],
    normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
    uvs: [...WHITE_UV, ...WHITE_UV, ...WHITE_UV, ...WHITE_UV],
    indices: [1, 0, 3, 1, 3, 2],
    colors: Array.from({ length: 4 }, () => [...S]).flat(),
  }
  const whiteUv = (d: MeshData): MeshData => ({ ...d, uvs: d.uvs.map((_, i) => WHITE_UV[i % 2]) })
  const lip = whiteUv(at(solid(rb(w, 0.14, 0.3, 0.05), rgba(RACE.roadEdge)), { x: 0, y: h + 0.02, z: len - 0.15 }))
  const rails = [-1, 1].map((sd) =>
    whiteUv(at(topSide(rb(0.5, 0.5, len - 0.5, 0.1), RACE.arch, RACE.archDark), { x: sd * (w / 2 + 0.3), y: 0.25, z: (len + 0.5) / 2 }))
  )
  return mergeData([top, side(x0, -1), side(x1, 1), back, lip, ...rails])
}
