/**
 * 玩具系列 Q 版角色（bomber spec §4、kitchen spec §4）：身體、頭、臉、眼睛、四肢合併成一個頂點色 mesh
 * （1 個 draw call），四肢擺動由 CPU 改寫頂點（rig.ts）。頭飾與服裝由遊戲傳入（AvatarStyle），
 * AI 天線球、AI 小章、「你」標記、無敵金圈是另外的小 mesh，方便 GlowLayer 白名單與顯示切換。
 */
import { Color3, Mesh, MeshBuilder, StandardMaterial, type DynamicTexture, type Scene } from '@/babylon/babylonCore'
import { mergeData, roundedBox, type MeshData } from '@/babylon/fx/geometry'
import { at, radial, rgba, solid, sphere, toMesh } from '@/babylon/fx/models'
import { OUTLINE, PLAYER_PALETTE, type ColorIndex, type PlayerPalette } from '@/babylon/fx/palette'
import { swingRange } from '@/babylon/fx/rig'
import { createLabelTexture } from '@/babylon/fx/textures'

type Limb = 'legL' | 'legR' | 'armL' | 'armR'

interface LimbRange {
  limb: Limb
  start: number
  count: number
  pivot: { y: number; z: number }
}

export interface ToyAvatar {
  /** 位移錨點（不轉面向，只有俯角透視補償會微傾它）；標記掛這裡才不會跟著面向轉 */
  root: Mesh
  /** 合併後的身體，rotation.y = 面向 */
  body: Mesh
  /** AI 的發光天線球（Glow 白名單用；kit 沒設 ai 時不建） */
  antenna?: Mesh
  tag?: Mesh
  marker?: Mesh
  halo: Mesh
  colorIndex: ColorIndex
  isAI: boolean
  isSelf: boolean
  base: Float32Array
  baseN: Float32Array
  pos: Float32Array
  nrm: Float32Array
  limbs: LimbRange[]
  lastSwing: number
  /** 上次的手臂姿勢鍵（給了 arms 時才用；角度沒變就不重傳頂點） */
  lastArms: string
}

/** 遊戲決定的外觀：頭飾（頭心座標，組好後整顆頭一起仰）、服裝（身體座標）、褲子色 */
export interface AvatarStyle {
  headgear: (pal: PlayerPalette, isAI: boolean) => MeshData[]
  outfit?: (pal: PlayerPalette) => MeshData[]
  legs: string
  face: string
  eye: string
}

export interface AvatarKitOptions {
  style: AvatarStyle
  /** 無敵金圈色 */
  haloColor: string
  /** AI 發光天線球與 AI 小章；不給就不建（沒有 AI 的遊戲） */
  ai?: { color: string; ballY: number }
}

/** 外觀放大倍率：對齊 variant-A-sheet 的頭身比例（頭約 0.6 格寬） */
export const AVATAR_SCALE = 1.35
const LEG_PIVOT = { y: 0.4, z: 0 }
export const HEAD_Y = 1.24
/** 頭往鏡頭仰的角度（Babylon rotation.x，負值讓 +Z 臉朝上） */
export const HEAD_TILT = -0.42
const ARM_PIVOT = { y: 0.8, z: 0 }

/** 角色共用的材質、外觀與標籤貼圖（每個場景一份） */
export class AvatarKit {
  readonly bodyMat: StandardMaterial
  readonly haloMat: StandardMaterial
  readonly antennaMat?: StandardMaterial
  readonly style: AvatarStyle
  readonly ai?: { color: string; ballY: number }
  private labelMats = new Map<string, StandardMaterial>()
  private textures: DynamicTexture[] = []
  private readonly scene: Scene

  constructor(scene: Scene, opts: AvatarKitOptions) {
    this.scene = scene
    this.style = opts.style
    this.ai = opts.ai
    this.bodyMat = new StandardMaterial('toy-avatar-mat', scene)
    this.bodyMat.diffuseColor = Color3.White()
    this.bodyMat.specularColor = new Color3(0.18, 0.18, 0.18)
    this.haloMat = new StandardMaterial('toy-halo-mat', scene)
    this.haloMat.emissiveColor = Color3.FromHexString(opts.haloColor)
    this.haloMat.disableLighting = true
    this.haloMat.alpha = 0.32
    if (opts.ai) {
      this.antennaMat = new StandardMaterial('toy-ai-antenna-mat', scene)
      this.antennaMat.emissiveColor = Color3.FromHexString(opts.ai.color)
      this.antennaMat.disableLighting = true
    }
  }

  labelMat(key: string, text: string, bg: string, w: number, h: number): StandardMaterial {
    let m = this.labelMats.get(key)
    if (m) return m
    const tex = createLabelTexture(this.scene, `toy-label-${key}`, text, bg, w, h)
    this.textures.push(tex)
    m = new StandardMaterial(`toy-label-mat-${key}`, this.scene)
    m.diffuseTexture = tex
    m.useAlphaFromDiffuseTexture = true
    m.emissiveColor = Color3.White()
    m.disableLighting = true
    m.backFaceCulling = false
    this.labelMats.set(key, m)
    return m
  }

  dispose(): void {
    this.bodyMat.dispose()
    this.haloMat.dispose()
    this.antennaMat?.dispose()
    for (const m of this.labelMats.values()) m.dispose()
    for (const t of this.textures) t.dispose()
    this.labelMats.clear()
    this.textures = []
  }
}

const rbox = (w: number, h: number, d: number, r: number): MeshData => roundedBox({ width: w, height: h, depth: d, radius: r, segments: 2 })

/** 組身體頂點；回傳合併資料與四肢頂點範圍 */
function bodyData(ci: ColorIndex, isAI: boolean, style: AvatarStyle): { data: MeshData; limbs: LimbRange[] } {
  const pal = PLAYER_PALETTE[ci]
  const legC = rgba(style.legs)
  const footC = rgba(OUTLINE)
  const white = rgba('#FFFFFF')
  const parts: { d: MeshData; limb?: Limb; pivot?: { y: number; z: number } }[] = []
  const limb = (l: Limb, pivot: { y: number; z: number }, ...ds: MeshData[]) => parts.push({ d: mergeData(ds), limb: l, pivot })

  for (const [l, sx] of [['legL', -1], ['legR', 1]] as const) {
    limb(
      l,
      LEG_PIVOT,
      at(solid(rbox(0.22, 0.34, 0.24, 0.07), legC), { x: sx * 0.14, y: 0.25, z: 0 }),
      at(solid(rbox(0.26, 0.14, 0.34, 0.06), footC), { x: sx * 0.14, y: 0.07, z: 0.04 })
    )
  }
  parts.push({ d: at(radial(rbox(0.6, 0.46, 0.44, 0.14), pal.light, pal.base, pal.dark), { x: 0, y: 0.6, z: 0 }) })
  parts.push({ d: at(solid(rbox(0.63, 0.1, 0.47, 0.05), rgba(pal.dark)), { x: 0, y: 0.47, z: 0 }) })
  for (const d of style.outfit?.(pal) ?? []) parts.push({ d })
  for (const [l, sx] of [['armL', -1], ['armR', 1]] as const) {
    limb(
      l,
      ARM_PIVOT,
      at(radial(rbox(0.16, 0.3, 0.18, 0.07), pal.light, pal.base, pal.dark), { x: sx * 0.38, y: 0.66, z: 0 }),
      at(solid(sphere(0.21, 10), white), { x: sx * 0.39, y: 0.48, z: 0 })
    )
  }
  // 頭（徑向漸層）＋臉＋眼睛（白色光點）＋頭飾：以頭心為原點組好，整顆往鏡頭仰 HEAD_TILT，
  // 俯視 3/4 角度下臉才看得到（對照 variant-A-sheet 的正臉）
  const head: MeshData[] = [
    radial(sphere(0.92, 16), pal.light, pal.base, pal.dark),
    at(solid(sphere(1, 14), rgba(style.face)), { x: 0, y: -0.04, z: 0.3, sx: 0.66, sy: 0.54, sz: 0.5 }),
  ]
  for (const sx of [-1, 1]) {
    head.push(at(solid(sphere(1, 10), rgba(style.eye)), { x: sx * 0.12, y: 0.01, z: 0.53, sx: 0.11, sy: 0.2, sz: 0.08 }))
    head.push(at(solid(sphere(0.06, 6), white), { x: sx * 0.12 - 0.025, y: 0.06, z: 0.575 }))
  }
  head.push(...style.headgear(pal, isAI))
  parts.push({ d: at(mergeData(head), { x: 0, y: HEAD_Y, z: 0, pitch: HEAD_TILT }) })

  const limbs: LimbRange[] = []
  let v = 0
  for (const p of parts) {
    const n = p.d.positions.length / 3
    if (p.limb && p.pivot) limbs.push({ limb: p.limb, start: v, count: n, pivot: p.pivot })
    v += n
  }
  return { data: mergeData(parts.map((p) => p.d)), limbs }
}

export function buildAvatar(scene: Scene, kit: AvatarKit, id: string, ci: ColorIndex, opts: { isAI: boolean; isSelf: boolean }): ToyAvatar {
  const root = new Mesh(`pl-${id}`, scene)
  const { data, limbs } = bodyData(ci, opts.isAI, kit.style)
  const body = toMesh(`pl-body-${id}`, data, scene, true)
  body.material = kit.bodyMat
  body.parent = root
  body.alwaysSelectAsActiveMesh = true // 四肢改頂點會跑出原 bounding
  body.scaling.setAll(AVATAR_SCALE) // 只放大外觀，碰撞半徑不變

  let antenna: Mesh | undefined
  let tag: Mesh | undefined
  if (opts.isAI && kit.ai && kit.antennaMat) {
    // 頭心座標系中天線球的位置，轉成身體座標（AI 發光球要跟著仰）
    const ballY = kit.ai.ballY
    antenna = MeshBuilder.CreateSphere(`pl-ai-ant-${id}`, { diameter: 0.21, segments: 10 }, scene)
    antenna.material = kit.antennaMat
    antenna.parent = body
    antenna.position.set(0, HEAD_Y + ballY * Math.cos(HEAD_TILT), ballY * Math.sin(HEAD_TILT))
    tag = MeshBuilder.CreatePlane(`pl-ai-tag-${id}`, { width: 0.5, height: 0.28 }, scene)
    tag.material = kit.labelMat('ai', 'AI', kit.ai.color, 112, 64)
    tag.parent = root
    tag.position.set(0.42 * AVATAR_SCALE, 1.66 * AVATAR_SCALE, 0)
    tag.billboardMode = Mesh.BILLBOARDMODE_ALL
  }
  let marker: Mesh | undefined
  if (opts.isSelf) {
    marker = MeshBuilder.CreatePlane(`pl-you-${id}`, { width: 0.8, height: 0.42 }, scene)
    marker.material = kit.labelMat(`you-${ci}`, '你', PLAYER_PALETTE[ci].base, 128, 68)
    marker.parent = root
    marker.position.set(0, 2.45 * AVATAR_SCALE, 0)
    marker.billboardMode = Mesh.BILLBOARDMODE_ALL
  }
  const halo = MeshBuilder.CreateSphere(`pl-halo-${id}`, { diameter: 1, segments: 12 }, scene)
  halo.material = kit.haloMat
  halo.parent = root
  halo.position.set(0, 1.0 * AVATAR_SCALE, 0)
  halo.scaling.set(1.3 * AVATAR_SCALE, 2.15 * AVATAR_SCALE, 1.3 * AVATAR_SCALE)
  halo.isVisible = false
  halo.isPickable = false

  const base = new Float32Array(data.positions)
  const baseN = new Float32Array(data.normals)
  return {
    root,
    body,
    antenna,
    tag,
    marker,
    halo,
    colorIndex: ci,
    isAI: opts.isAI,
    isSelf: opts.isSelf,
    base,
    baseN,
    pos: new Float32Array(base),
    nrm: new Float32Array(baseN),
    limbs,
    lastSwing: 0,
    lastArms: '',
  }
}

const SWING_SIGN: Record<Limb, number> = { legL: 1, legR: -1, armL: -1, armR: 1 }

/** 手臂另給角度（胸前捧物、切菜）；inward 為雙手往身體中線內收的量 */
export interface AvatarArms {
  armL: number
  armR: number
  inward: number
}

/** 擺動四肢（角度沒變就不重傳頂點）；給了 arms 時手臂改用它，腿仍照 swing */
export function poseAvatar(av: ToyAvatar, swing: number, arms?: AvatarArms): void {
  const armKey = arms ? `${arms.armL.toFixed(3)}|${arms.armR.toFixed(3)}|${arms.inward.toFixed(3)}` : ''
  if (Math.abs(swing - av.lastSwing) < 1e-3 && armKey === av.lastArms) return
  av.lastSwing = swing
  av.lastArms = armKey
  for (const l of av.limbs) {
    let a = swing * SWING_SIGN[l.limb]
    let dx = 0
    if (arms && l.limb === 'armL') {
      a = arms.armL
      dx = arms.inward
    } else if (arms && l.limb === 'armR') {
      a = arms.armR
      dx = -arms.inward
    }
    swingRange(av.base, av.pos, l.start, l.count, l.pivot, a, dx)
    swingRange(av.baseN, av.nrm, l.start, l.count, null, a)
  }
  av.body.updateVerticesData('position', av.pos)
  av.body.updateVerticesData('normal', av.nrm)
}

export function disposeAvatar(av: ToyAvatar): void {
  av.root.dispose(false, false)
}
