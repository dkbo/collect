/**
 * 玩具坦克化身（spec §3／§6）：每台 2 個 mesh（hull 含履帶、turret 含旗／天線與砲管）＋自己頭上的「你」標記。
 * 砲管不另拆 mesh（每拆一個要多主畫面、描邊 ×2、陰影共 4 個 draw call），後座改由 CPU 平移砲管那段頂點。
 * 共用材質與各色頂點資料放 TankKit；履帶紋每台一張小貼圖（uOffset 各自捲動）。
 * 動作（擠壓回彈、後座、履帶捲動）在 poseTank，遊戲邏輯留在 tank.ts。
 */
import { Color3, Mesh, MeshBuilder, StandardMaterial, type DynamicTexture, type Scene } from '@/babylon/babylonCore'
import { easeOut } from '@/babylon/fx/curves'
import type { MeshData } from '@/babylon/fx/geometry'
import { toMesh } from '@/babylon/fx/models'
import { createLabelTexture } from '@/babylon/fx/textures'
import { hitFlashAlpha, wreckColors } from '@/babylon/games/tankFx/fxModel'
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
  /** 砲口環頂點（連射 buff 換色） */
  ringStart: number
  ringCount: number
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
  /** 陣亡成殘骸的時刻（-Infinity = 活著）：換 wreck 色、砲塔噴飛落到旁邊 */
  wreckAt: number
  /** 連射 buff 中（砲口環亮橘） */
  rapid: boolean
  /** 受擊閃白目前是否掛著 overlay */
  flashing: boolean
  /** 上一幀的位置（算履帶捲動距離） */
  lastX: number
  lastZ: number
}

/**
 * 「你」標記高度（spec §3 已回寫 3.0，原為 2.0）。相機俯角 β=0.55 下，畫面上「往上」的位移 ≈ z·cosβ + y·sinβ：
 * 砲管朝畫面上方時砲口約在 0.97·0.85 + 0.68·0.52 ≈ 1.18，2.0 高的標記（半高 0.225）下緣約 0.82 會蓋住砲口；
 * 提到 3.0（下緣 ≈ 1.34）讓砲管任何朝向都露得出來。
 */
const LABEL_Y = 3.0
/** 單幀位移超過這個視為瞬移（重生、插值跳點），不算進履帶捲動 */
const TELEPORT = 1.5
/** 連射 buff 的砲口環色（spec §6：#FF6B3D，頂點色拉亮一點代替 emissive） */
const RAPID_RING = [1, 0.5, 0.3, 1] as const
/** 殘骸砲塔：跳起 1.5、落到右側 0.8、躺在地上（砲塔底在車身座標 y≈0.57） */
const WRECK_HOP_MS = 600
const WRECK_LIFT = 1.5
const WRECK_SIDE = 0.8
const WRECK_DROP = -0.57
const WRECK_TILT = 0.5

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
      ringStart: tm.ringStart,
      ringCount: tm.ringCount,
      recoil: 0,
      label,
      parts: [hull, turret],
      trackTex,
      hullMat,
      colorIndex: ci,
      isBot,
      fireAt: -Infinity,
      hitAt: -Infinity,
      wreckAt: -Infinity,
      rapid: false,
      flashing: false,
      lastX: x,
      lastZ: z,
    }
  }

  /** 名冊變動（bot 補位、有人離房）換色：只換頂點色，不重建 mesh */
  repaint(rig: TankRig, ci: ColorIndex): void {
    if (rig.colorIndex === ci) return
    rig.colorIndex = ci
    this.paint(rig)
    if (rig.label) rig.label.material = this.labelMat(ci)
  }

  /** 陣亡成殘骸（spec §3）或回合重來復原：換 wreck 色、砲塔噴飛／歸位 */
  setWreck(rig: TankRig, on: boolean, now: number): void {
    if (on === rig.wreckAt > -Infinity) return
    rig.wreckAt = on ? now : -Infinity
    if (!on) {
      rig.turret.position.set(0, 0, TURRET_PIVOT_Z)
      rig.turret.rotation.z = 0
    }
    this.paint(rig)
  }

  /** 連射 buff：砲口環換亮橘 */
  setRapid(rig: TankRig, on: boolean): void {
    if (rig.rapid === on) return
    rig.rapid = on
    this.paint(rig)
  }

  /** 依 玩家色 → 連射砲口環 → 殘骸 疊出頂點色 */
  private paint(rig: TankRig): void {
    const wreck = rig.wreckAt > -Infinity
    const hc = this.hullOf(rig.colorIndex).colors
    if (hc) rig.hull.setVerticesData('color', wreck ? wreckColors(hc) : hc, true)
    const base = this.turretOf(rig.colorIndex, rig.isBot).data.colors
    if (!base) return
    let tc: ArrayLike<number> = base
    if (rig.rapid && !wreck) {
      const out = Float32Array.from(base)
      for (let v = rig.ringStart; v < rig.ringStart + rig.ringCount; v++) out.set(RAPID_RING, v * 4)
      tc = out
    }
    rig.turret.setVerticesData('color', wreck ? wreckColors(tc) : Array.from(tc), true)
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
 * 每幀擺姿勢：擠壓回彈（受擊優先於開砲，作用在 hull，砲塔是子物件一起壓）、砲管後座、受擊閃白、
 * 履帶依實際位移捲動；殘骸只播砲塔噴飛。root 的位置與朝向、砲塔角度由呼叫端先寫好。
 * 回傳這一幀的位移（瞬移與殘骸為 0），呼叫端拿來出履帶痕與揚塵。
 */
export function poseTank(rig: TankRig, now: number): number {
  setFlash(rig, hitFlashAlpha(now - rig.hitAt))
  if (rig.wreckAt > -Infinity) {
    rig.hull.scaling.set(1, 1, 1)
    setRecoil(rig, 0)
    const t = Math.min(1, (now - rig.wreckAt) / WRECK_HOP_MS)
    const e = easeOut(t)
    rig.turret.position.set(WRECK_SIDE * e, WRECK_LIFT * Math.sin(Math.PI * t) + WRECK_DROP * e, TURRET_PIVOT_Z)
    rig.turret.rotation.z = WRECK_TILT * e
    rig.lastX = rig.root.position.x
    rig.lastZ = rig.root.position.z
    return 0
  }
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
    return dist
  }
  return 0
}

/** 受擊閃白（spec §6）：hull 與砲塔掛白色 overlay；alpha 0 時拿掉（overlay 每個 mesh 多一次 draw） */
function setFlash(rig: TankRig, alpha: number): void {
  const on = alpha > 0
  if (!on && !rig.flashing) return
  rig.flashing = on
  for (const m of rig.parts) {
    m.renderOverlay = on
    if (on) {
      m.overlayColor = Color3.White()
      m.overlayAlpha = alpha
    }
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
