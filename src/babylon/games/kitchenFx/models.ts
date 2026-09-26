/**
 * 廚房快手 A 方案的程式建模（kitchen spec §5）：圓角盒、球、圓柱組成的合併 mesh（頂點色，檯面走圖集 UV）。
 * 物品 8 種（kind × ing）底面貼 y=0、寬約 0.7；站點以「檯面頂 y=0」為原點，由 board.ts 擺到檯面上。
 */
import { colorize, mergeData, roundedBox, type MeshData } from '@/babylon/fx/geometry'
import { at, cylinder, frustum, radial, rgba, solid, sphere, torus, type Rgba } from '@/babylon/fx/models'
import type { ItemKind, Ing } from '@/babylon/games/overcookedKitchen'
import { KITCHEN } from '@/babylon/games/kitchenFx/palette'
import { counterFaceUV } from '@/babylon/games/kitchenFx/textures'

const rbox = (w: number, h: number, d: number, r: number, segments = 2): MeshData => roundedBox({ width: w, height: h, depth: d, radius: r, segments })
const tri = (c: readonly string[]): [string, string, string] => [c[0], c[1], c[2]]
/** 頂面一色、側面一色（依法線 y） */
const topSide = (d: MeshData, top: string, side: string, k = 0.6): MeshData => {
  const t = rgba(top)
  const s = rgba(side)
  return colorize(d, (_p, n) => (n[1] > k ? t : s))
}

// ---- 檯面（圖集 UV，底面貼地） ----

/** 一般檯面：圓角盒 0.96 CELL × 0.6 CELL 高，頂白鋼、四側櫃門（貼圖） */
export const counterData = (cell: number): MeshData => {
  const h = cell * 0.6
  return at(roundedBox({ width: cell * 0.96, height: h, depth: cell * 0.96, radius: cell * 0.05, segments: 2, faceUV: counterFaceUV() }), { x: 0, y: h / 2, z: 0 })
}

// ---- 站點本體（原點 = 檯面頂中心） ----

/** 食材箱：圓角木箱＋板縫＋深色內襯＋正面（−Z，朝鏡頭）白色圓標與食材圖；食材堆由呼叫端用物品 thin instance 疊上去 */
export const crateData = (ing: Ing): MeshData => {
  const H = 0.5
  const parts = [
    at(topSide(rbox(1.6, H, 1.3, 0.08), KITCHEN.crateTop, KITCHEN.crateSide), { x: 0, y: H / 2, z: 0 }),
    at(solid(rbox(1.63, 0.035, 1.33, 0.015, 1), rgba(KITCHEN.crateSeam)), { x: 0, y: 0.17, z: 0 }),
    at(solid(rbox(1.63, 0.035, 1.33, 0.015, 1), rgba(KITCHEN.crateSeam)), { x: 0, y: 0.34, z: 0 }),
    at(solid(rbox(1.38, 0.04, 1.08, 0.02, 1), rgba(KITCHEN.crateLiner)), { x: 0, y: H + 0.005, z: 0 }),
    // 圓標：白盤（轉成朝 −Z）＋食材小圖
    at(solid(cylinder(0.04, 0.5, 20), rgba('#FFFFFF')), { x: 0, y: 0.27, z: -0.66, pitch: Math.PI / 2 }),
    at(solid(torus(0.5, 0.05, 20), rgba(KITCHEN.outline)), { x: 0, y: 0.27, z: -0.68, pitch: Math.PI / 2 }),
  ]
  const [l, b, d] = ing === 'v' ? tri(KITCHEN.veg) : tri(KITCHEN.meat)
  parts.push(at(radial(sphere(0.3, 12), l, b, d), { x: 0, y: 0.27, z: -0.69, sz: 0.35 }))
  if (ing === 'm') parts.push(at(solid(sphere(0.12, 8), rgba(KITCHEN.fat)), { x: 0.08, y: 0.24, z: -0.74, sz: 0.3 }))
  return mergeData(parts)
}

/** 砧板＋刀（合併；砧板要回彈，所以不併進靜態站點）：圓角扁盒 1.4×0.16×1.0、右上掛孔，刀平放在右側 */
export const boardData = (): MeshData =>
  mergeData([
    at(topSide(rbox(1.4, 0.16, 1.0, 0.06), KITCHEN.boardTop, KITCHEN.boardSide), { x: -0.12, y: 0.08, z: 0 }),
    at(solid(cylinder(0.02, 0.12, 10), rgba(KITCHEN.boardSide)), { x: 0.42, y: 0.165, z: 0.34 }),
    at(radial(rbox(0.13, 0.03, 0.66, 0.012, 1), '#FFFFFF', KITCHEN.blade, '#A9B1C6'), { x: 0.78, y: 0.02, z: 0.18 }),
    at(radial(rbox(0.14, 0.07, 0.3, 0.03), '#FFA27E', KITCHEN.knifeHandle, '#C2431C'), { x: 0.78, y: 0.04, z: -0.3 }),
  ])

/** 鍋身底與鍋口（相對檯面頂） */
export const POT_BASE = 0.26
export const POT_TOP = POT_BASE + 0.6
/** 鍋身實心頂面比鍋緣低一截，湯面浮在兩者之間（太貼鍋身頂會被描邊外殼蓋掉） */
const POT_BODY_H = 0.5
export const SOUP_Y = POT_BASE + POT_BODY_H + 0.05

/** 爐台＋鍋（不含湯面與開火爐圈，那兩樣要換色／發光） */
export const stoveData = (): MeshData => {
  const [pl, pb, pd] = tri(KITCHEN.pot)
  return mergeData([
    at(topSide(rbox(1.72, 0.24, 1.72, 0.08), KITCHEN.stoveTop, KITCHEN.stove), { x: 0, y: 0.12, z: 0 }),
    at(solid(torus(1.2, 0.1, 24), rgba(KITCHEN.burnerOff)), { x: 0, y: 0.25, z: 0 }),
    at(radial(frustum(POT_BODY_H, 1.26, 1.1, 24), pl, pb, pd), { x: 0, y: POT_BASE + POT_BODY_H / 2, z: 0 }),
    // 鍋口內壁：一圈深色短筒，從鍋身頂延伸到鍋緣
    at(solid(frustum(POT_TOP - POT_BASE - POT_BODY_H, 1.3, 1.26, 24, true), rgba(pd)), { x: 0, y: (POT_TOP + POT_BASE + POT_BODY_H) / 2, z: 0 }),
    at(solid(torus(1.3, 0.1, 28), rgba(KITCHEN.potRim)), { x: 0, y: POT_TOP, z: 0 }),
    at(solid(rbox(0.28, 0.09, 0.16, 0.04), rgba(pd)), { x: -0.8, y: POT_TOP - 0.1, z: 0 }),
    at(solid(rbox(0.28, 0.09, 0.16, 0.04), rgba(pd)), { x: 0.8, y: POT_TOP - 0.1, z: 0 }),
  ])
}
/** 湯面（圓盤，材質換色） */
export const soupDiscData = (): MeshData => at(solid(cylinder(0.03, 1.2, 28), rgba('#FFFFFF')), { x: 0, y: 0, z: 0 })
/** 開火爐圈（emissive，進 Glow 白名單） */
export const burnerOnData = (): MeshData => at(solid(torus(1.22, 0.12, 24), rgba('#FFFFFF')), { x: 0, y: 0.26, z: 0 })
/** 快焦鍋緣（比鍋緣大一圈，emissive 紅；波 3 脈動） */
export const potAlarmRimData = (): MeshData => at(solid(torus(1.34, 0.14, 28), rgba('#FFFFFF')), { x: 0, y: POT_TOP, z: 0 })
/** 焦了的湯面上 2 顆 ember 點 */
export const emberDotsData = (): MeshData =>
  mergeData([at(solid(sphere(0.1, 8), rgba('#FFFFFF')), { x: -0.2, y: 0.02, z: 0.12 }), at(solid(sphere(0.08, 8), rgba('#FFFFFF')), { x: 0.22, y: 0.02, z: -0.1 })])

/** 出餐台：黃色圓角台＋瀝架條紋＋「>>」箭頭（鈴另建，要回彈） */
export const serveData = (): MeshData => {
  const [l, b, d] = tri(KITCHEN.serve)
  const parts = [at(radial(rbox(1.8, 0.3, 1.6, 0.1), l, b, d), { x: 0, y: 0.15, z: 0 })]
  for (let i = 0; i < 4; i++) parts.push(at(solid(rbox(0.07, 0.02, 1.2, 0.01, 1), rgba(d)), { x: -0.75 + i * 0.14, y: 0.305, z: 0 }))
  // 兩個 >> 箭頭：每個是兩條斜桿，在 +x 端收成尖角（yaw 正值會把 +z 端轉向 +x，所以 z>0 那條取負）
  for (const cx of [-0.1, 0.22]) {
    for (const s of [-1, 1]) {
      parts.push(at(solid(rbox(0.1, 0.03, 0.46, 0.02, 1), rgba(KITCHEN.outline)), { x: cx, y: 0.31, z: s * 0.15, yaw: -s * 0.7 }))
    }
  }
  return mergeData(parts)
}

/** 服務鈴（半球＋底座＋按鈕），原點在出餐台頂面 */
export const bellData = (): MeshData => {
  const [l, b, d] = tri(KITCHEN.bell)
  return mergeData([
    at(solid(cylinder(0.08, 0.62, 20), rgba(d)), { x: 0, y: 0.04, z: 0 }),
    at(radial(sphere(0.5, 16), l, b, d), { x: 0, y: 0.08, z: 0, sy: 0.9 }),
    at(solid(cylinder(0.08, 0.08, 8), rgba(d)), { x: 0, y: 0.34, z: 0 }),
    at(radial(sphere(0.13, 10), l, b, d), { x: 0, y: 0.4, z: 0 }),
  ])
}

/** 盤架裝飾：3 個白盤疊起來 */
export const plateStackData = (): MeshData => {
  const parts: MeshData[] = []
  for (let i = 0; i < 3; i++) {
    parts.push(at(radial(frustum(0.07, 1.1, 0.8, 24), '#FFFFFF', KITCHEN.plate, KITCHEN.plateRim), { x: 0, y: 0.035 + i * 0.1, z: 0 }))
    parts.push(at(solid(torus(1.06, 0.045, 24), rgba(KITCHEN.plateRim)), { x: 0, y: 0.075 + i * 0.1, z: 0 }))
  }
  return mergeData(parts)
}

// ---- 物品 8 種（底面 y=0） ----

const vegCol = (): [string, string, string] => tri(KITCHEN.veg)
const meatCol = (): [string, string, string] => tri(KITCHEN.meat)

/** 生菜：高麗菜（球＋兩片外葉＋葉脈） */
const cabbage = (): MeshData => {
  const [l, b, d] = vegCol()
  return mergeData([
    at(radial(sphere(0.56, 14), l, b, d), { x: 0, y: 0.3, z: 0 }),
    at(radial(sphere(0.52, 12), b, d, d), { x: -0.2, y: 0.26, z: 0, sx: 0.5, sy: 0.9, sz: 0.95 }),
    at(radial(sphere(0.52, 12), b, d, d), { x: 0.2, y: 0.26, z: 0, sx: 0.5, sy: 0.9, sz: 0.95 }),
    at(solid(rbox(0.05, 0.03, 0.34, 0.012, 1), rgba(l)), { x: 0, y: 0.575, z: 0, pitch: 0.15 }),
  ])
}

/** 切好的菜：4 片圓角扁葉片 */
const vegPieces = (): MeshData => {
  const [l, b, d] = vegCol()
  const spots = [
    { x: -0.16, z: -0.1, yaw: 0.4, y: 0.05 },
    { x: 0.14, z: -0.12, yaw: -0.5, y: 0.05 },
    { x: -0.05, z: 0.14, yaw: 1.2, y: 0.05 },
    { x: 0.04, z: 0, yaw: -0.2, y: 0.14 },
  ]
  return mergeData(spots.map((s) => at(radial(rbox(0.3, 0.09, 0.22, 0.04), l, b, d), { ...s, pitch: 0.12 })))
}

/** 生肉：兩個扁球合成的牛排＋白色脂肪邊＋一小截骨頭 */
const steak = (): MeshData => {
  const [l, b, d] = meatCol()
  return mergeData([
    at(solid(sphere(0.66, 14), rgba(KITCHEN.fat)), { x: -0.04, y: 0.12, z: -0.02, sx: 1.05, sy: 0.34, sz: 0.85 }),
    at(radial(sphere(0.62, 14), l, b, d), { x: -0.05, y: 0.15, z: 0.02, sx: 1, sy: 0.34, sz: 0.8 }),
    at(radial(sphere(0.4, 12), l, b, d), { x: 0.16, y: 0.15, z: 0.07, sy: 0.4 }),
    at(solid(cylinder(0.22, 0.08, 8), rgba(KITCHEN.bone)), { x: 0.36, y: 0.15, z: -0.06, yaw: Math.PI / 2, pitch: Math.PI / 2 }),
    at(solid(sphere(0.13, 8), rgba(KITCHEN.bone)), { x: 0.48, y: 0.15, z: -0.06 }),
  ])
}

/** 切好的肉：4 顆圓角小方塊，頂面淡色 */
const meatCubes = (): MeshData => {
  const [l, b] = meatCol()
  const spots = [
    { x: -0.14, y: 0.09, z: -0.1 },
    { x: 0.14, y: 0.09, z: -0.08 },
    { x: 0.0, y: 0.09, z: 0.14 },
    { x: 0.02, y: 0.25, z: 0.0 },
  ]
  return mergeData(spots.map((s, i) => at(topSide(rbox(0.2, 0.18, 0.2, 0.05), l, b, 0.5), { ...s, yaw: i * 0.5 })))
}

/** 白碗（口寬 0.66）：碗身＋碗緣；湯面在 y ≈ 0.28 */
const bowl = (): MeshData[] => {
  const [l, b, d] = tri(KITCHEN.bowl)
  return [at(radial(frustum(0.28, 0.66, 0.38, 20), l, b, d), { x: 0, y: 0.14, z: 0 }), at(solid(torus(0.66, 0.05, 20), rgba(l)), { x: 0, y: 0.28, z: 0 })]
}

const soup = (ing: Ing): MeshData => {
  const c = ing === 'v' ? KITCHEN.soupV : KITCHEN.soupM
  const bit = ing === 'v' ? KITCHEN.veg[2] : KITCHEN.meat[2]
  return mergeData([
    ...bowl(),
    at(solid(cylinder(0.02, 0.6, 20), rgba(c)), { x: 0, y: 0.285, z: 0 }),
    at(solid(rbox(0.1, 0.04, 0.08, 0.02, 1), rgba(bit)), { x: -0.12, y: 0.3, z: 0.08 }),
    at(solid(rbox(0.09, 0.04, 0.09, 0.02, 1), rgba(bit)), { x: 0.13, y: 0.3, z: 0.04 }),
    at(solid(rbox(0.08, 0.04, 0.1, 0.02, 1), rgba(bit)), { x: 0.0, y: 0.3, z: -0.14 }),
    // 白色硬點高光（借 C 案）
    at(solid(sphere(0.07, 6), rgba('#FFFFFF')), { x: -0.16, y: 0.3, z: -0.05, sy: 0.3 }),
  ])
}

/** 焦掉：同一個碗，裡面一塊變形焦炭，帶橘色裂縫 */
const burnt = (ing: Ing): MeshData => {
  const b = rgba(KITCHEN.burnt)
  const c = rgba(KITCHEN.crack)
  const coal = colorize(sphere(0.4, 12), (p, n): Rgba => (n[1] > 0.2 && Math.abs(Math.sin(p[0] * 22) + Math.cos(p[2] * 19)) < 0.28 ? c : b))
  return mergeData([
    ...bowl(),
    at(solid(cylinder(0.02, 0.6, 20), rgba(ing === 'v' ? '#3B3A26' : '#3E2A22')), { x: 0, y: 0.285, z: 0 }),
    at(coal, { x: 0, y: 0.33, z: 0, sx: 1, sy: 0.6, sz: 0.88 }),
  ])
}

export function itemData(kind: ItemKind, ing: Ing): MeshData {
  if (kind === 'raw') return ing === 'v' ? cabbage() : steak()
  if (kind === 'chop') return ing === 'v' ? vegPieces() : meatCubes()
  if (kind === 'soup') return soup(ing)
  return burnt(ing)
}
