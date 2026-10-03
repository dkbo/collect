/**
 * 坦克 A「Toy Army」的程式建模（spec §3／§4）：頂點色＋少量圖集 UV，原點在地面中心、車頭朝 +Z。
 * 每台坦克 2 個 mesh：hull（車身＋擋泥板＋燈＋負重輪＋履帶，履帶紋走貼圖 UV 捲動）、turret（含旗或天線與砲管；
 * 砲管後座以 CPU 平移那一段頂點，見 tankModel.ts）。
 * 場景物件（積木牆、代幣、子彈、預告格、blob 影）各一份 MeshData，交給 thin instance。
 */
import { colorize, mergeData, roundedBox, type FaceUV, type MeshData } from '@/babylon/fx/geometry'
import { at, cylinder, frustum, radial, rgba, solid, sphere, type Rgba } from '@/babylon/fx/models'
import { PLAYER_PALETTE, TANK, type ColorIndex } from '@/babylon/games/tankFx/palette'

// ---- 履帶貼圖的 UV 分區（textures.ts 的 createTrackTexture 畫同一份配置） ----

/** 貼圖上半（v 0.5–1）全白：車身各部件取這一點，頂點色就是畫面色 */
export const TRACK_WHITE_UV: FaceUV = [0.02, 0.72, 0.04, 0.78]
/** 貼圖下半（v 0–0.5）是履帶紋；u 方向重複（WRAP）；v 只取中段避開雙線性取樣滲到白區 */
const CLEAT_V: [number, number] = [0.06, 0.44]
/** 履帶長 */
export const TRACK_LEN = 1.44
/** 一張履帶紋（8 條亮紋）對應的世界長度：捲動時 uOffset += 移動距離 / TRACK_TILE */
export const TRACK_TILE = 0.72

const WHITE6: FaceUV[] = Array.from({ length: 6 }, () => TRACK_WHITE_UV)

const box = (w: number, h: number, d: number, r: number, faceUV: FaceUV[] = WHITE6, segments = 2): MeshData =>
  roundedBox({ width: w, height: h, depth: d, radius: r, segments, faceUV })

/** 圓柱的 uv 一律指到白點（不然頂點色會乘上履帶紋） */
const whiteUV = (d: MeshData): MeshData => {
  const [u0, v0] = TRACK_WHITE_UV
  const uvs = new Array(d.uvs.length)
  for (let i = 0; i < uvs.length; i += 2) {
    uvs[i] = u0
    uvs[i + 1] = v0 + 0.03
  }
  return { ...d, uvs }
}

/** 沿 X 軸的圓柱（負重輪）：pitch 先把 +Y 倒到 +Z，yaw 再把 +Z 轉到 +X */
const AXIS_X = { pitch: Math.PI / 2, yaw: Math.PI / 2 } as const
/** 沿 Z 軸的圓柱（車燈、砲管） */
const AXIS_Z = { pitch: Math.PI / 2 } as const

const darker = (c: Rgba, k: number): Rgba => [c[0] * k, c[1] * k, c[2] * k, c[3]]

// ---- 坦克 ----

/** 車身＋擋泥板＋車燈＋負重輪＋履帶（spec §3 hull／tracks；合併成一個 mesh） */
export function hullData(ci: ColorIndex): MeshData {
  const pal = PLAYER_PALETTE[ci]
  const body = at(radial(box(0.72, 0.34, 1.24, 0.12), pal.light, pal.base, pal.dark), { x: 0, y: 0.4, z: 0 })
  const fenders = [-1, 1].map((s) =>
    at(solid(box(0.36, 0.06, 0.96, 0.03, WHITE6, 1), rgba(pal.dark)), { x: s * 0.53, y: 0.39, z: 0 })
  )
  const lights = [-1, 1].map((s) =>
    at(solid(whiteUV(cylinder(0.08, 0.12, 10)), rgba(TANK.headlight)), { x: s * 0.24, y: 0.49, z: 0.6, ...AXIS_Z })
  )
  const wheels: MeshData[] = []
  for (const s of [-1, 1]) {
    for (const z of [-0.45, 0, 0.45]) {
      wheels.push(at(solid(whiteUV(cylinder(0.04, 0.24, 12)), rgba(TANK.wheel)), { x: s * 0.715, y: 0.18, z, ...AXIS_X }))
      wheels.push(at(solid(whiteUV(cylinder(0.05, 0.09, 8)), rgba(TANK.hub)), { x: s * 0.725, y: 0.18, z, ...AXIS_X }))
    }
  }
  return mergeData([body, ...fenders, ...lights, ...wheels, ...[-1, 1].map((s) => trackData(s))])
}

/**
 * 一條履帶：先沿 X 建（長面 ±Z、頂面 +Y 的 u 都沿長邊），再 yaw 轉成沿 Z。
 * 三個看得到的面 u 一律朝世界 −Z（+Z 面原本反向，faceUV 翻過來），捲動時三面同向。
 */
function trackData(side: number): MeshData {
  const u = TRACK_LEN / TRACK_TILE
  const [v0, v1] = CLEAT_V
  const end: FaceUV = [0, v0, 0.12, v1]
  const faceUV: FaceUV[] = [
    [u, v0, 0, v1], // +Z（轉後朝 +X）
    [0, v0, u, v1], // −Z（轉後朝 −X）
    end,
    end,
    [0, v0, u, v1], // +Y
    [0, v0, u, v1], // −Y
  ]
  const raw = roundedBox({ width: TRACK_LEN, height: 0.36, depth: 0.34, radius: 0.15, segments: 2, faceUV })
  const top = rgba('#FFFFFF')
  const sideC = rgba('#C9C6D8')
  const shaded = colorize(raw, (_p, n) => (n[1] > 0.6 ? top : sideC))
  return at(shaded, { x: side * 0.53, y: 0.18, z: 0, yaw: Math.PI / 2 })
}

/** 砲塔樞紐在車身座標的 z（spec §3：(0, 0, −0.05)） */
export const TURRET_PIVOT_Z = -0.05

/** 砲塔＋砲管合併；barrelStart／barrelCount 為砲管那一段頂點（後座時沿 z 平移） */
export interface TurretMesh {
  data: MeshData
  barrelStart: number
  barrelCount: number
}

export function turretMeshData(ci: ColorIndex, isBot: boolean): TurretMesh {
  const body = turretData(ci, isBot)
  const barrel = at(barrelData(), { x: 0, y: BARREL_Y, z: 0 })
  return { data: mergeData([body, barrel]), barrelStart: body.positions.length / 3, barrelCount: barrel.positions.length / 3 }
}

/** 砲塔（座圈＋圓頂＋臉板＋眼睛＋艙蓋＋旗或天線），座標以樞紐為原點 */
function turretData(ci: ColorIndex, isBot: boolean): MeshData {
  const pal = PLAYER_PALETTE[ci]
  const ring = at(radial(whiteUV(frustum(0.23, 0.72, 0.76, 20)), pal.base, pal.base, pal.dark), { x: 0, y: 0.685, z: 0 })
  const dome = at(radial(whiteUV(sphere(0.66, 16)), pal.light, pal.base, pal.dark), { x: 0, y: 0.8, z: 0, sy: 0.42 })
  const face = at(solid(box(0.36, 0.12, 0.08, 0.03), rgba(TANK.face)), { x: 0, y: 0.84, z: 0.28 })
  const eyes: MeshData[] = []
  for (const s of [-1, 1]) {
    eyes.push(at(solid(whiteUV(sphere(0.085, 8)), rgba(TANK.eye)), { x: s * 0.085, y: 0.84, z: 0.32, sz: 0.5 }))
    eyes.push(at(solid(whiteUV(sphere(0.03, 6)), rgba('#FFFFFF')), { x: s * 0.085 + 0.016, y: 0.858, z: 0.338 }))
  }
  const hatch = at(solid(whiteUV(cylinder(0.04, 0.2, 14)), rgba(pal.light)), { x: 0, y: 0.94, z: -0.1 })
  const extra = isBot ? antennaData() : flagData(pal.base)
  const parts = [ring, dome, face, ...eyes, hatch, ...extra]
  return at(mergeData(parts), { x: 0, y: 0, z: -TURRET_PIVOT_Z })
}

function flagData(base: string): MeshData[] {
  const px = -0.22
  const pz = -0.22
  const pole = at(solid(whiteUV(cylinder(0.52, 0.05, 6)), rgba(TANK.barrelDark)), { x: px, y: 1.16, z: pz })
  // 三角旗往 −Z 飄：雙面（兩組相反繞序；Babylon 正面為 cross(b−a, c−a) 與法線反向），頂點色本色
  const top = 1.42
  const bot = 1.24
  const tipZ = pz - 0.32
  const tipY = (top + bot) / 2
  const c = rgba(base)
  const [u, v] = [TRACK_WHITE_UV[0], TRACK_WHITE_UV[1] + 0.03]
  const flag: MeshData = {
    positions: [px, top, pz, px, bot, pz, px, tipY, tipZ, px, top, pz, px, bot, pz, px, tipY, tipZ],
    normals: [1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0],
    uvs: [u, v, u, v, u, v, u, v, u, v, u, v],
    indices: [0, 2, 1, 3, 4, 5],
    colors: [...c, ...c, ...c, ...darker(c, 0.85), ...darker(c, 0.85), ...darker(c, 0.85)],
  }
  return [pole, flag]
}

function antennaData(): MeshData[] {
  const px = -0.22
  const pz = -0.22
  return [
    at(solid(whiteUV(cylinder(0.45, 0.04, 6)), rgba(TANK.barrelDark)), { x: px, y: 1.125, z: pz }),
    at(solid(whiteUV(sphere(0.14, 10)), rgba(TANK.aiBall)), { x: px, y: 1.37, z: pz }),
  ]
}

/** 砲管在砲塔座標的高度（mesh 擺在這個 y，後座改 position.z） */
export const BARREL_Y = 0.68

/** 砲管＋砲口環＋砲口黑洞，座標以 (0, BARREL_Y, 0) 為原點、沿 +Z */
function barrelData(): MeshData {
  const z0 = 0.6 - TURRET_PIVOT_Z
  const tube = at(radial(whiteUV(cylinder(0.62, 0.16, 12)), '#B4BBD6', TANK.barrel, TANK.barrelDark), { x: 0, y: 0, z: z0, ...AXIS_Z })
  const ring = at(solid(whiteUV(cylinder(0.1, 0.22, 14)), rgba(TANK.barrelDark)), { x: 0, y: 0, z: z0 + 0.32, ...AXIS_Z })
  const hole = at(solid(whiteUV(cylinder(0.02, 0.12, 10)), rgba(TANK.muzzle)), { x: 0, y: 0, z: z0 + 0.372, ...AXIS_Z })
  return mergeData([tube, ring, hole])
}

/** 砲口在砲塔座標的 z（之後特效對位用） */
export const MUZZLE_Z = 0.6 - TURRET_PIVOT_Z + 0.37

// ---- 場景 ----

export interface BrickColors {
  top: string
  side: string
  sideDark: string
  band: string
  stud: string
  studSide: string
}

export const WALL_COLORS: BrickColors = {
  top: TANK.wallTop,
  side: TANK.wallSide,
  sideDark: TANK.wallSideDark,
  band: TANK.wallBand,
  stud: TANK.stud,
  studSide: TANK.studSide,
}
export const BORDER_COLORS: BrickColors = {
  top: TANK.borderTop,
  side: TANK.borderSide,
  sideDark: '#5A5078',
  band: TANK.borderStud,
  stud: TANK.borderStud,
  studSide: TANK.borderStudSide,
}
export const CLOSE_COLORS: BrickColors = {
  top: TANK.closeTop,
  side: TANK.closeSide,
  sideDark: '#9E2C27',
  band: TANK.closeStud,
  stud: TANK.closeStud,
  studSide: TANK.closeStudSide,
}

/** 積木塊高（柱牆、落牆）；外框以實例 sy 撐到 1.9 */
export const BRICK_H = 1.7

/** 積木：圓角盒 1.9×1.7×1.9＋頂面 2×2 凸點（spec §4），底面貼地 */
export function brickData(c: BrickColors): MeshData {
  const w = 1.9
  const h = BRICK_H
  const top = rgba(c.top)
  const side = rgba(c.side)
  const sideDark = rgba(c.sideDark)
  const band = rgba(c.band)
  const body = colorize(at(box(w, h, w, 0.18), { x: 0, y: h / 2, z: 0 }), (p, n) => {
    if (n[1] > 0.7) return top
    if (p[1] > h * 0.82) return band
    if (p[1] < h * 0.12) return sideDark
    return side
  })
  const stud = rgba(c.stud)
  const studSide = rgba(c.studSide)
  const studs: MeshData[] = []
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const s = colorize(whiteUV(cylinder(0.16, 0.54, 16)), (_p, n) => (n[1] > 0.7 ? stud : studSide))
      studs.push(at(s, { x: sx * 0.45, y: h + 0.08, z: sz * 0.45 }))
    }
  }
  return mergeData([body, ...studs])
}

/** 子彈：球 d 0.3（材質給 emissive，頂點色全白） */
export const bulletData = (): MeshData => solid(sphere(0.3, 10), rgba('#FFFFFF'))

/**
 * 道具代幣：圓角方塊外殼＋下唇＋高光條＋正面圖示 quad，頂點色全白、顏色全取圖集第 0 欄
 * （5 種道具共用這一份 mesh，shader 依實例屬性平移到各自那一欄，見 itemIcon.ts）。
 * 圖示朝 +Y，實例以 pitch 往鏡頭仰（同 bomber 代幣）。
 */
export function tokenData(uv: { icon: FaceUV; shell: FaceUV; lip: FaceUV; white: FaceUV }): MeshData {
  const W = 0.9
  const D = 0.86
  const six = (f: FaceUV) => Array.from({ length: 6 }, () => f)
  const shellBox = roundedBox({ width: W, height: 0.22, depth: D, radius: 0.1, segments: 2, faceUV: six(uv.shell) })
  const lipBox = at(roundedBox({ width: W, height: 0.18, depth: D, radius: 0.08, segments: 1, faceUV: six(uv.lip) }), { x: 0, y: -0.1, z: 0 })
  const shine = at(roundedBox({ width: 0.26, height: 0.02, depth: 0.08, radius: 0.01, segments: 1, faceUV: six(uv.white) }), {
    x: -0.2,
    y: 0.112,
    z: 0.32,
  })
  const q = 0.66
  const y = 0.113
  const [u0, v0, u1, v1] = uv.icon
  const icon: MeshData = {
    positions: [-q / 2, y, -q / 2, q / 2, y, -q / 2, q / 2, y, q / 2, -q / 2, y, q / 2],
    normals: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    uvs: [u0, v0, u1, v0, u1, v1, u0, v1],
    indices: [0, 1, 2, 0, 2, 3],
  }
  return mergeData([shellBox, lipBox, shine, icon])
}

/** 場外延伸底色（120²）＋外框底下的深色基座（plinth）合成一個 mesh，頂點色、不受光 */
export function voidData(plinthSize: number): MeshData {
  const quad = (size: number, y: number, hex: string): MeshData => solid(groundQuadData(size, y), rgba(hex))
  return mergeData([quad(120, -0.02, TANK.void), quad(plinthSize, -0.01, TANK.plinth)])
}

/** 貼地正方形（預告格、blob 影）：邊長 size，y 高度 */
export const groundQuadData = (size: number, y: number): MeshData => {
  const q = size / 2
  return {
    positions: [-q, y, -q, q, y, -q, q, y, q, -q, y, q],
    normals: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    uvs: [0, 0, 1, 0, 1, 1, 0, 1],
    indices: [0, 1, 2, 0, 2, 3],
  }
}
