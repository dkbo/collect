/**
 * 賽車車輛視覺（spec §4.1）：每台車 1 個合併車身 mesh（頂點色、4 色共用 1 個材質）＋全場共用的輪胎 thin instance、
 * 護盾泡泡、自己頭上的「你」標記、3 段甩尾火花芯（thin instance，進 Glow）。
 * 材質與 thin instance 群組都在 CarKit（場景共用），拆一台車只拆它自己的 mesh 與實例，材質在 kit.dispose 統一釋放。
 */
import {
  Color3,
  Matrix,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Texture,
  TransformNode,
  FresnelParameters,
  type BaseTexture,
  type Scene,
} from '@/babylon/babylonCore'
import { ThinGroup } from '@/babylon/fx/thin'
import { toMesh } from '@/babylon/fx/models'
import type { MeshData } from '@/babylon/fx/geometry'
import { PLAYER_PALETTE, type ColorIndex } from '@/babylon/fx/palette'
import { CORE_POS, WHEELS, YOU_Y, carBodyData, wheelData } from '@/babylon/games/raceFx/models'
import { DRIFT_COLORS, RACE } from '@/babylon/games/raceFx/palette'
import { createYouTexture, fxAssetUrl } from '@/babylon/games/raceFx/textures'

export interface CarVisual {
  id: string
  /** 世界位置與移動方向（ry） */
  root: TransformNode
  /** 車身姿態（側傾、甩尾偏航、打滑、俯仰、起跳） */
  visual: TransformNode
  body: Mesh
  shield: Mesh
  you: Mesh | null
  wheelSpin: number
  steer: number
  /** 由畫面位移估的速度（他車沒有速度欄位） */
  speedEst: number
  /** 暫用火花左右交替 */
  sparkSide: number
  spinAngle: number
  prevX: number
  prevZ: number
  prevRy: number
  prevY: number
  /** 甩尾按下的時間（起跳動畫），-1 = 無 */
  hopAt: number
  wasDrifting: boolean
  sparkAcc: number
  hidden: boolean
}

const WHEELS_PER_CAR = WHEELS.length
const tmpA = new Matrix()
const tmpB = new Matrix()
const tmpC = new Matrix()

export class CarKit {
  readonly bodyMat: StandardMaterial
  readonly shieldMat: StandardMaterial
  readonly wheels: ThinGroup<string>
  readonly cores: ThinGroup<string>
  private readonly wheelMat: StandardMaterial
  private readonly coreMat: StandardMaterial
  private readonly bodyData = new Map<string, MeshData>()
  private readonly youMats: StandardMaterial[] = []
  private readonly scene: Scene

  private readonly youTexture: (scene: Scene, bg: string) => BaseTexture | null

  /** youTexture：「你」標記貼圖（預設程式繪製；node 單測沒有 Canvas 時可給 () => null） */
  constructor(scene: Scene, opts: { youTexture?: (scene: Scene, bg: string) => BaseTexture | null } = {}) {
    this.scene = scene
    this.youTexture = opts.youTexture ?? createYouTexture
    this.bodyMat = new StandardMaterial('race-car-body', scene)
    this.bodyMat.diffuseColor = Color3.White()
    this.bodyMat.specularColor = new Color3(0.25, 0.25, 0.25)
    this.bodyMat.specularPower = 48

    this.wheelMat = new StandardMaterial('race-car-wheel', scene)
    this.wheelMat.diffuseColor = Color3.White()
    this.wheelMat.specularColor = new Color3(0.08, 0.08, 0.08)
    this.wheels = new ThinGroup<string>(toMesh('race-wheels', wheelData(), scene), 16)
    this.wheels.mesh.material = this.wheelMat

    this.shieldMat = new StandardMaterial('race-shield', scene)
    this.shieldMat.diffuseColor = Color3.FromHexString(RACE.shieldFill)
    this.shieldMat.emissiveColor = Color3.FromHexString(RACE.shieldFill).scale(0.35)
    this.shieldMat.specularColor = Color3.Black()
    this.shieldMat.alpha = 0.22
    const fr = new FresnelParameters()
    fr.leftColor = Color3.FromHexString(RACE.shield)
    fr.rightColor = Color3.Black()
    fr.bias = 0.15
    fr.power = 2
    this.shieldMat.emissiveFresnelParameters = fr

    // 3 段甩尾火花芯（spec §8 #1）：fx_star 平面，紫色、加亮
    const core = MeshBuilder.CreatePlane('race-drift-core', { size: 0.5 }, scene)
    this.coreMat = new StandardMaterial('race-drift-core', scene)
    const star = new Texture(fxAssetUrl('fx_star.webp'), scene)
    star.hasAlpha = true
    this.coreMat.diffuseTexture = star
    this.coreMat.useAlphaFromDiffuseTexture = true
    this.coreMat.emissiveColor = Color3.FromHexString(DRIFT_COLORS[3])
    this.coreMat.disableLighting = true
    this.coreMat.backFaceCulling = false
    core.material = this.coreMat
    this.cores = new ThinGroup<string>(core, 4)
  }

  /** 材質登記用（ToyLook.toon） */
  get litMaterials(): StandardMaterial[] {
    return [this.bodyMat, this.wheelMat]
  }

  private bodyFor(ci: ColorIndex, isBot: boolean): MeshData {
    const key = `${ci}-${isBot ? 'bot' : 'p'}`
    let d = this.bodyData.get(key)
    if (!d) this.bodyData.set(key, (d = carBodyData(ci, isBot)))
    return d
  }

  make(id: string, ci: ColorIndex, isBot: boolean, isSelf: boolean): CarVisual {
    const scene = this.scene
    const root = new TransformNode(`race-car-${id}`, scene)
    const visual = new TransformNode(`race-car-visual-${id}`, scene)
    visual.parent = root
    const body = toMesh(`race-car-body-${id}`, this.bodyFor(ci, isBot), scene)
    body.material = this.bodyMat
    body.parent = visual

    const shield = MeshBuilder.CreateSphere(`race-shield-${id}`, { diameter: 3.2, segments: 24 }, scene)
    shield.material = this.shieldMat
    shield.parent = root
    shield.position.y = 0.75
    shield.isPickable = false
    shield.setEnabled(false)

    let you: Mesh | null = null
    if (isSelf) {
      you = MeshBuilder.CreatePlane(`race-you-${id}`, { width: 0.9, height: 0.675 }, scene)
      const m = new StandardMaterial(`race-you-${id}`, scene)
      const tex = this.youTexture(scene, PLAYER_PALETTE[ci].base)
      // disableLighting：輸出 = clamp(emissive) × 貼圖色。只掛 diffuse（色＋alpha）＋白 emissive；
      // 同一張再掛 emissiveTexture 會變成 貼圖 × 貼圖，玩家色偏暗
      m.diffuseTexture = tex
      m.emissiveColor = Color3.White()
      m.useAlphaFromDiffuseTexture = true
      m.disableLighting = true
      m.backFaceCulling = false
      m.fogEnabled = false
      you.material = m
      this.youMats.push(m)
      you.billboardMode = Mesh.BILLBOARDMODE_ALL
      you.parent = root
      // 三角尖端在安全帽正上方：標記中心 YOU_Y、整張往上偏半個三角
      you.position.set(0, YOU_Y + 0.11, -0.18)
      you.isPickable = false
    }

    return {
      id,
      root,
      visual,
      body,
      shield,
      you,
      wheelSpin: 0,
      steer: 0,
      speedEst: 0,
      sparkSide: 1,
      spinAngle: 0,
      prevX: 0,
      prevZ: 0,
      prevRy: 0,
      prevY: 0,
      hopAt: -1,
      wasDrifting: false,
      sparkAcc: 0,
      hidden: false,
    }
  }

  /** 依車身姿態寫 4 個輪胎的實例矩陣（前輪 steerYaw 擺動）；hidden 時移除 */
  putWheels(v: CarVisual, steerYaw: number): void {
    if (v.hidden) {
      for (let i = 0; i < WHEELS_PER_CAR; i++) this.wheels.remove(`${v.id}:${i}`)
      return
    }
    // 父節點本幀剛改過位置：先算它，子節點才不會拿到上一幀的矩陣（輪胎慢一幀）
    v.root.computeWorldMatrix(true)
    const world = v.visual.computeWorldMatrix(true)
    WHEELS.forEach((w, i) => {
      const key = `${v.id}:${i}`
      Matrix.ScalingToRef(w.scale, w.scale, w.scale, tmpA)
      Matrix.RotationXToRef(v.wheelSpin, tmpB)
      tmpA.multiplyToRef(tmpB, tmpC)
      Matrix.RotationYToRef(w.front ? steerYaw : 0, tmpB)
      tmpC.multiplyToRef(tmpB, tmpA)
      tmpA.setTranslationFromFloats(w.x, w.y, w.z)
      tmpA.multiplyToRef(world, tmpC)
      this.wheels.slots.add(key)
      this.wheels.slots.write(key, (buf, o) => tmpC.copyToArray(buf, o))
    })
  }

  /** 3 段甩尾時兩後輪之間的火花芯（面向相機） */
  putCore(v: CarVisual, on: boolean, camX: number, camZ: number, now: number): void {
    const key = v.id
    if (!on || v.hidden) {
      this.cores.remove(key)
      return
    }
    const p = v.visual.getAbsolutePosition()
    const ry = v.root.rotation.y + v.visual.rotation.y
    const x = p.x - Math.sin(ry) * -CORE_POS.z
    const z = p.z - Math.cos(ry) * -CORE_POS.z
    const pulse = 1 + 0.15 * Math.sin(now * 0.03)
    this.cores.put(key, { x, y: p.y + CORE_POS.y, z, yaw: Math.atan2(camX - x, camZ - z), sx: pulse, sy: pulse })
  }

  /** 每幀一次：上傳有變動的實例 */
  sync(): void {
    this.wheels.sync()
    this.cores.sync()
  }

  /** 拆一台車：自己的 mesh 與實例；材質是共用的，不帶 disposeMaterialAndTextures（「你」標記材質例外，只有自己有） */
  remove(v: CarVisual): void {
    for (let i = 0; i < WHEELS_PER_CAR; i++) this.wheels.remove(`${v.id}:${i}`)
    this.cores.remove(v.id)
    v.root.dispose()
  }

  dispose(): void {
    this.wheels.dispose()
    this.cores.dispose()
    for (const m of [this.bodyMat, this.wheelMat, this.shieldMat, this.coreMat, ...this.youMats]) m.dispose(true, true)
    this.youMats.length = 0
    this.bodyData.clear()
  }
}

/** 拆一台車（相容舊介面）：見 CarKit.remove */
export function disposeCarVisual(kit: CarKit, v: CarVisual): void {
  kit.remove(v)
}
