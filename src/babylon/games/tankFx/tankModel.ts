/**
 * 玩具坦克化身（spec §3／§6）：每台 2 個 mesh（hull 含履帶、turret 含旗／天線與砲管）＋自己頭上的「你」標記。
 * 砲管不另拆 mesh（每拆一個要多主畫面、描邊 ×2、陰影共 4 個 draw call），後座改由 CPU 平移砲管那段頂點。
 * 共用材質與各色頂點資料放 TankKit；履帶紋每台一張小貼圖（uOffset 各自捲動）。
 * 動作（擠壓回彈、後座、履帶捲動）在 poseTank，遊戲邏輯留在 tank.ts。
 */
import { Color3, Mesh, MeshBuilder, StandardMaterial, type DynamicTexture, type Scene } from '@/babylon/babylonCore'
import type { MeshData } from '@/babylon/fx/geometry'
import { toMesh } from '@/babylon/fx/models'
import { createLabelTexture } from '@/babylon/fx/textures'
import { FIRE_SQUASH, HIT_SQUASH, RECOIL_MS, recoilZ, squashPose } from '@/babylon/games/tankFx/juice'
import { TRACK_TILE, TURRET_PIVOT_Z, hullData, turretMeshData, type TurretMesh } from '@/babylon/games/tankFx/models'
import { PLAYER_PALETTE, type ColorIndex } from '@/babylon/games/tankFx/palette'
import { createTrackTexture } from '@/babylon/games/tankFx/textures'

export interface TankRig {
  root: Mesh
  hull: Mesh
  turret: Mesh
  /** 砲塔原始頂點與砲管段（後座用） */
  turretBase: Float32Array
  turretPos: Float32Array
  barrelStart: number
  barrelCount: number
  /** 目前已套到頂點上的後座量 */
  recoil: number
  /** 只有自己有 */
  label: Mesh | null
  /** 投影／描邊／無敵閃爍的對象 */
  parts: Mesh[]
  trackTex: DynamicTexture
  hullMat: StandardMaterial
  colorIndex: ColorIndex
  isBot: boolean
  /** 動畫起點（performance.now；-Infinity = 沒在播） */
  fireAt: number
  hitAt: number
  /** 上一幀的位置（算履帶捲動距離） */
  lastX: number
  lastZ: number
}

/** 「你」標記高度與尺寸（spec §3） */
const LABEL_Y = 2.0
/** 單幀位移超過這個視為瞬移（重生、插值跳點），不算進履帶捲動 */
const TELEPORT = 1.5

export class TankKit {
  private readonly scene: Scene
  readonly turretMat: StandardMaterial
  private readonly hullCache = new Map<ColorIndex, MeshData>()
  private readonly turretCache = new Map<string, TurretMesh>()
  private labelMats = new Map<ColorIndex, StandardMaterial>()
  /** 新建的材質交給呼叫端掛 toon（ToyLook） */
  onMaterial: (m: StandardMaterial) => void = () => undefined

  constructor(scene: Scene) {
    this.scene = scene
    this.turretMat = this.vcMat('tank-turret-mat')
  }

  private vcMat(name: string): StandardMaterial {
    const m = new StandardMaterial(name, this.scene)
    m.specularColor = Color3.Black()
    return m
  }

  private hullOf(ci: ColorIndex): MeshData {
    let d = this.hullCache.get(ci)
    if (!d) this.hullCache.set(ci, (d = hullData(ci)))
    return d
  }

  private turretOf(ci: ColorIndex, isBot: boolean): TurretMesh {
    const k = `${ci}-${isBot ? 1 : 0}`
    let d = this.turretCache.get(k)
    if (!d) this.turretCache.set(k, (d = turretMeshData(ci, isBot)))
    return d
  }

  private labelMat(ci: ColorIndex): StandardMaterial {
    let m = this.labelMats.get(ci)
    if (m) return m
    const tex = createLabelTexture(this.scene, `tank-you-${ci}`, '你', PLAYER_PALETTE[ci].base)
    m = new StandardMaterial(`tank-you-mat-${ci}`, this.scene)
    m.diffuseTexture = tex
    m.emissiveTexture = tex
    m.useAlphaFromDiffuseTexture = true
    m.disableLighting = true
    m.backFaceCulling = false
    this.labelMats.set(ci, m)
    return m
  }

  build(id: string, ci: ColorIndex, isBot: boolean, isSelf: boolean, x: number, z: number): TankRig {
    const scene = this.scene
    const root = new Mesh(`tank-${id}`, scene)
    root.position.set(x, 0, z)

    const trackTex = createTrackTexture(scene, `tank-track-tex-${id}`)
    const hullMat = this.vcMat(`tank-hull-mat-${id}`)
    hullMat.diffuseTexture = trackTex
    this.onMaterial(hullMat)

    const hull = toMesh(`tank-hull-${id}`, this.hullOf(ci), scene, true)
    hull.material = hullMat
    hull.parent = root
    const tm = this.turretOf(ci, isBot)
    const turret = toMesh(`tank-turret-${id}`, tm.data, scene, true)
    turret.material = this.turretMat
    turret.parent = hull
    turret.position.z = TURRET_PIVOT_Z

    let label: Mesh | null = null
    if (isSelf) {
      label = MeshBuilder.CreatePlane(`tank-you-${id}`, { width: 0.9, height: 0.45 }, scene)
      label.material = this.labelMat(ci)
      label.parent = root
      label.position.y = LABEL_Y
      label.billboardMode = Mesh.BILLBOARDMODE_ALL
      label.isPickable = false
    }
    for (const m of [hull, turret]) m.isPickable = false

    return {
      root,
      hull,
      turret,
      turretBase: new Float32Array(tm.data.positions),
      turretPos: new Float32Array(tm.data.positions),
      barrelStart: tm.barrelStart,
      barrelCount: tm.barrelCount,
      recoil: 0,
      label,
      parts: [hull, turret],
      trackTex,
      hullMat,
      colorIndex: ci,
      isBot,
      fireAt: -Infinity,
      hitAt: -Infinity,
      lastX: x,
      lastZ: z,
    }
  }

  /** 名冊變動（bot 補位、有人離房）換色：只換頂點色，不重建 mesh */
  repaint(rig: TankRig, ci: ColorIndex): void {
    if (rig.colorIndex === ci) return
    rig.colorIndex = ci
    const hc = this.hullOf(ci).colors
    const tc = this.turretOf(ci, rig.isBot).data.colors
    if (hc) rig.hull.setVerticesData('color', hc, true)
    if (tc) rig.turret.setVerticesData('color', tc, true)
    if (rig.label) rig.label.material = this.labelMat(ci)
  }

  dispose(): void {
    this.turretMat.dispose()
    for (const m of this.labelMats.values()) {
      m.diffuseTexture?.dispose()
      m.dispose()
    }
    this.labelMats.clear()
  }
}

/** 拆一台坦克（含每台自己的履帶貼圖與材質） */
export function disposeTank(rig: TankRig): void {
  rig.root.dispose(false, false)
  rig.hullMat.dispose()
  rig.trackTex.dispose()
}

/**
 * 每幀擺姿勢：擠壓回彈（受擊優先於開砲，作用在 hull，砲塔是子物件一起壓）、砲管後座、履帶依實際位移捲動。
 * root 的位置與朝向、砲塔角度由呼叫端先寫好。
 */
export function poseTank(rig: TankRig, now: number): void {
  const hitT = (now - rig.hitAt) / HIT_SQUASH.ms
  const fireT = (now - rig.fireAt) / FIRE_SQUASH.ms
  const sq = hitT >= 0 && hitT < 1 ? squashPose(hitT, HIT_SQUASH.amp) : squashPose(fireT, FIRE_SQUASH.amp)
  rig.hull.scaling.set(sq.sxz, sq.sy, sq.sxz)
  setRecoil(rig, recoilZ((now - rig.fireAt) / RECOIL_MS))

  const p = rig.root.position
  const dx = p.x - rig.lastX
  const dz = p.z - rig.lastZ
  const dist = Math.hypot(dx, dz)
  rig.lastX = p.x
  rig.lastZ = p.z
  if (dist > 1e-4 && dist < TELEPORT) {
    // 位移與車頭同向為前進、反向（擊退）為後退
    const ry = rig.root.rotation.y
    const sign = dx * Math.sin(ry) + dz * Math.cos(ry) >= 0 ? 1 : -1
    rig.trackTex.uOffset = (((rig.trackTex.uOffset + (sign * dist) / TRACK_TILE) % 1) + 1) % 1
  }
}

/** 砲管那段頂點沿 z 平移到 dz（沒變就不上傳） */
function setRecoil(rig: TankRig, dz: number): void {
  if (Math.abs(dz - rig.recoil) < 1e-4) return
  rig.recoil = dz
  const base = rig.turretBase
  const out = rig.turretPos
  const end = (rig.barrelStart + rig.barrelCount) * 3
  for (let o = rig.barrelStart * 3 + 2; o < end; o += 3) out[o] = base[o] + dz
  rig.turret.updateVerticesData('position', out)
}
