/**
 * 炸彈超人 A 方案的程式建模：把圓角盒、球、圓柱組成合併後的單一 mesh（頂點色／圖集 UV），
 * 每種物件一個 mesh，重複的物件交給 thin instance（見 fx/thin.ts）；通用積木在 fx/models。
 */
import { mergeData, roundedBox, type MeshData } from '@/babylon/fx/geometry'
import { at, cylinder, radial, rgba, solid, sphere, type Rgba } from '@/babylon/fx/models'
import { TOY } from '@/babylon/games/bomberFx/palette'
import { BLOCK_TILE, boxFaceUV, ITEM_WHITE_CELL, itemCellUV } from '@/babylon/games/bomberFx/textures'

// ---- 方塊（圖集貼圖，底面貼地 y=0） ----

/** 柱牆：圓角盒 0.96×1.1×0.96 CELL，淺灰石頂＋磚縫側面 */
export const pillarData = (cell: number, topTile: number = BLOCK_TILE.pillarTop): MeshData => {
  const h = cell * 1.1
  return at(
    roundedBox({ width: cell * 0.96, height: h, depth: cell * 0.96, radius: cell * 0.09, segments: 2, faceUV: boxFaceUV(BLOCK_TILE.pillarSide, topTile) }),
    { x: 0, y: h / 2, z: 0 }
  )
}

/** 外框牆單位塊（1×1×1，實例用 scale 撐成各段長度） */
export const borderBlockData = (): MeshData =>
  at(roundedBox({ width: 1, height: 1, depth: 1, radius: 0.08, segments: 2, faceUV: boxFaceUV(BLOCK_TILE.borderSide, BLOCK_TILE.borderTop) }), { x: 0, y: 0.5, z: 0 })

export type CrateVariant = 'soft' | 'hard' | 'damaged'
const CRATE_TILES: Record<CrateVariant, [number, number]> = {
  soft: [BLOCK_TILE.crateSide, BLOCK_TILE.crateTop],
  hard: [BLOCK_TILE.hardSide, BLOCK_TILE.hardTop],
  damaged: [BLOCK_TILE.dmgSide, BLOCK_TILE.dmgTop],
}

/** 木箱三態統一箱形：0.9 CELL 圓角盒，差別只在圖集格 */
export const crateData = (cell: number, v: CrateVariant): MeshData => {
  const s = cell * 0.9
  return at(roundedBox({ width: s, height: s, depth: s, radius: cell * 0.07, segments: 2, faceUV: boxFaceUV(...CRATE_TILES[v]) }), { x: 0, y: s / 2, z: 0 })
}

// ---- 炸彈（頂點色，中心在原點，半徑 0.55） ----

export const bombData = (flash: boolean): MeshData => {
  const [c0, c1, c2] = flash ? ['#FF8A80', TOY.bombFlash, '#B3122A'] : TOY.bomb
  const body = radial(sphere(1.1, 16), c0, c1, c2)
  const cap = at(solid(cylinder(0.14, 0.28, 12), rgba('#8E9AB0')), { x: 0, y: 0.56, z: 0 })
  // 引信：沿二次曲線排 4 段小圓柱
  const fuse: MeshData[] = []
  const P = (t: number): [number, number] => [0.28 * t * t + 0.02 * t, 0.62 + 0.3 * t - 0.08 * t * t]
  for (let i = 0; i < 4; i++) {
    const [x0, y0] = P(i / 4)
    const [x1, y1] = P((i + 1) / 4)
    const len = Math.hypot(x1 - x0, y1 - y0)
    // 圓柱沿 +Y：pitch 把 +Y 往 +Z 倒，再 yaw=π/2 把 +Z 轉到 +X，等於在 XY 平面內往 +X 傾斜
    const ang = Math.atan2(x1 - x0, y1 - y0)
    fuse.push(at(solid(cylinder(len + 0.02, 0.07, 6), rgba(TOY.fuse)), { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: 0, yaw: Math.PI / 2, pitch: ang }))
  }
  return mergeData([body, cap, ...fuse])
}

// ---- 火焰（三層：外、中、芯；底面貼地） ----

export const FLAME_LAYERS = [
  { w: 0.84, h: 0.5 },
  { w: 0.56, h: 0.72 },
  { w: 0.26, h: 0.88 },
] as const

/** 臂：沿 X 長 1 CELL 的圓角條（實例 yaw 轉到 Z 軸、scale 縮成半格當端頭） */
export const flameArmData = (cell: number, layer: number): MeshData => {
  const { w, h } = FLAME_LAYERS[layer]
  return at(roundedBox({ width: cell, height: h, depth: cell * w, radius: Math.min(h, cell * w) * 0.45, segments: 2 }), { x: 0, y: h / 2, z: 0 })
}

/** 爆心／端頭帽：壓扁的球殼 */
export const flameCapData = (cell: number, layer: number): MeshData => {
  const { w, h } = FLAME_LAYERS[layer]
  return at(sphere(1, 12), { x: 0, y: h / 2, z: 0, sx: cell * w, sy: h, sz: cell * w })
}

// ---- 道具代幣：圓角方塊外殼（頂點色）＋下唇＋正面圖示 quad（圖集 UV） ----

export const tokenData = (cell: number, kindIndex: number, shell: string): MeshData => {
  const s = cell * 0.66
  const white = itemCellUV(ITEM_WHITE_CELL)
  const whiteUV = Array.from({ length: 6 }, () => white)
  const base = rgba(shell)
  const dark: Rgba = [base[0] * 0.62, base[1] * 0.62, base[2] * 0.62, 1]
  const shellBox = solid(roundedBox({ width: s, height: 0.2, depth: s, radius: 0.1, segments: 2, faceUV: whiteUV }), base)
  const lip = at(solid(roundedBox({ width: s * 1.04, height: 0.12, depth: s * 1.04, radius: 0.08, segments: 1, faceUV: whiteUV }), dark), { x: 0, y: -0.1, z: 0 })
  // 圖示 quad：法線 +Y，u 沿 +X、v 沿 +Z（canvas 上方 = 遠端 = 畫面上方）
  const q = s * 0.86
  const [u0, v0, u1, v1] = itemCellUV(kindIndex)
  const icon: MeshData = {
    positions: [-q / 2, 0.102, -q / 2, q / 2, 0.102, -q / 2, q / 2, 0.102, q / 2, -q / 2, 0.102, q / 2],
    normals: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    uvs: [u0, v0, u1, v0, u1, v1, u0, v1],
    // 與 Babylon 繞序一致：cross(b−a, c−a) 與法線反向
    indices: [0, 1, 2, 0, 2, 3],
    colors: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  }
  return mergeData([shellBox, lip, icon])
}

/** 突然死亡預告格：貼地正方形 */
export const warnQuadData = (cell: number): MeshData => {
  const q = cell * 0.96
  return {
    positions: [-q / 2, 0.03, -q / 2, q / 2, 0.03, -q / 2, q / 2, 0.03, q / 2, -q / 2, 0.03, q / 2],
    normals: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    uvs: [0, 0, 1, 0, 1, 1, 0, 1],
    indices: [0, 1, 2, 0, 2, 3],
  }
}
