/**
 * 玩具系列光影與後製（bomber spec §6／§7／§10，kitchen spec §6）：雙光、陰影、GlowLayer 白名單、卡通描邊、
 * DefaultRenderingPipeline、解析度與檔位；遊戲中 fps 過低時依序關掉 描邊 → Glow → 陰影。
 * 只管「怎麼畫」，哪些 mesh 投影／發光／描邊由呼叫端登記；log 前綴、網址參數、描邊色由 LookOptions 給。
 */
import {
  Color3,
  DefaultRenderingPipeline,
  DirectionalLight,
  GlowLayer,
  HemisphericLight,
  ImageProcessingConfiguration,
  ShadowGenerator,
  TargetCamera,
  Vector3,
  type Camera,
  type Material,
  type Mesh,
  type Scene,
} from '@/babylon/babylonCore'
import {
  FpsWatch,
  nextDegrade,
  noDegradeFlag,
  pickTier,
  tierQuery,
  tierSettings,
  type Tier,
  type DegradeStep,
  type TierSettings,
} from '@/babylon/fx/quality'
import { applyToon } from '@/babylon/fx/toon'

const OUTLINE_WIDTH = 0.02
const SUN_DIR = new Vector3(-0.4, -1, 0.3)
/** 只給 UI 相機看的圖層（主相機預設 0x0FFFFFFF 看不到） */
export const UI_LAYER = 0x10000000

export interface LookOptions {
  /** 陰影正交投影要涵蓋的半徑（場地半對角線加餘裕） */
  shadowRadius: number
  /** 遊戲代號：log 前綴 `[tag]`、網址參數 `${tag}Tier`／`${tag}NoDegrade`、Babylon 物件名前綴 */
  tag: string
  /** 描邊色 hex */
  outline: string
  /** 後製曝光與對比（不給＝bomber 定案的 1.05／1.08）；淺色場景在 ACES 下會發灰，可調高曝光 */
  exposure?: number
  contrast?: number
}

/** 讀瀏覽器環境決定檔位（非瀏覽器環境一律 desktop） */
function detectTier(key: string): { tier: Tier; noDegrade: boolean } {
  if (typeof window === 'undefined') return { tier: 'desktop', noDegrade: true }
  const search = tierQuery(window.location.search, window.location.hash)
  const touch = 'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0
  const cores = navigator.hardwareConcurrency || undefined
  return { tier: pickTier({ search, touch, cores }, key), noDegrade: noDegradeFlag(search, key) }
}

export class ToyLook {
  readonly tier: Tier
  readonly settings: TierSettings
  private readonly scene: Scene
  private readonly hemi: HemisphericLight
  private readonly sun: DirectionalLight
  private readonly shadow: ShadowGenerator
  private glow: GlowLayer | null = null
  private readonly pipeline: DefaultRenderingPipeline
  private readonly glowColors = new Map<number, Color3>()
  /** 已登記發光色、但目前不在白名單的 mesh（setGlow 關掉的） */
  private readonly glowOff = new Set<number>()
  private readonly outlined = new Set<Mesh>()
  private readonly outlineColor: Color3
  private readonly tag: string
  private readonly active: Record<DegradeStep, boolean>
  private watch: FpsWatch | null
  private readonly prevScaling: number
  /** 畫 3D UI（開局倒數）的第二台相機：只看 UI_LAYER、不掛後製，顏色不被 ACES／bloom 改掉 */
  readonly uiCamera: TargetCamera

  private readonly mainCamera: Camera

  constructor(scene: Scene, camera: Camera, opts: LookOptions) {
    this.scene = scene
    this.mainCamera = camera
    const tag = opts.tag
    this.tag = tag
    this.outlineColor = Color3.FromHexString(opts.outline)
    const { tier, noDegrade } = detectTier(tag)
    this.tier = tier
    this.settings = tierSettings(tier, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1)
    const s = this.settings
    console.info(`[${tag}] tier ${tier}`)

    const engine = scene.getEngine()
    this.prevScaling = engine.getHardwareScalingLevel()
    engine.setHardwareScalingLevel(s.hardwareScaling)

    // 暖主光＋冷環境光（spec §7）
    this.hemi = new HemisphericLight(`${tag}-hemi`, new Vector3(0.2, 1, 0.1), scene)
    this.hemi.intensity = 0.55
    this.hemi.groundColor = Color3.FromHexString('#3A3F5C')
    this.sun = new DirectionalLight(`${tag}-sun`, SUN_DIR.clone(), scene)
    this.sun.intensity = 0.9
    this.sun.diffuse = Color3.FromHexString('#FFF4E0')
    this.sun.specular = Color3.FromHexString('#FFF4E0')
    // 固定正交範圍涵蓋整個場地：thin instance 的 bounding 只在原點，自動範圍會漏掉場上的炸彈與道具
    const r = opts.shadowRadius
    this.sun.position = SUN_DIR.normalizeToNew().scale(-40)
    this.sun.autoUpdateExtends = false
    this.sun.autoCalcShadowZBounds = false
    this.sun.orthoLeft = -r
    this.sun.orthoRight = r
    this.sun.orthoBottom = -r
    this.sun.orthoTop = r
    this.sun.shadowMinZ = 1
    this.sun.shadowMaxZ = 80

    this.shadow = new ShadowGenerator(s.shadowSize, this.sun)
    this.shadow.usePercentageCloserFiltering = true
    this.shadow.filteringQuality = ShadowGenerator.QUALITY_MEDIUM
    this.shadow.setDarkness(0.35)
    this.shadow.bias = 0.002

    if (s.glow) {
      this.glow = this.makeGlow()
      this.syncGlowEnabled() // 還沒有人登記：先關著
    }

    this.pipeline = new DefaultRenderingPipeline(`${tag}-pipeline`, true, scene, [camera])
    this.pipeline.samples = 1
    this.pipeline.fxaaEnabled = true
    this.pipeline.bloomEnabled = s.bloom
    if (s.bloom) {
      this.pipeline.bloomThreshold = 0.85
      this.pipeline.bloomWeight = 0.3
      this.pipeline.bloomKernel = 48
    }
    this.pipeline.imageProcessingEnabled = true
    const ip = this.pipeline.imageProcessing
    ip.toneMappingEnabled = true
    ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES
    ip.exposure = opts.exposure ?? 1.05
    ip.contrast = opts.contrast ?? 1.08

    // UI 相機：與主相機同 fov、位在原點看 +Z，面板以相機座標擺放（與掛在主相機下相同）
    this.uiCamera = new TargetCamera(`${tag}-ui-cam`, Vector3.Zero(), scene)
    this.uiCamera.setTarget(new Vector3(0, 0, 1))
    this.uiCamera.fov = camera.fov
    this.uiCamera.layerMask = UI_LAYER
    scene.activeCameras = [camera, this.uiCamera]
    scene.cameraToUseForPointers = camera

    this.active = { outline: s.outline, glow: s.glow, shadow: true }
    this.watch = noDegrade ? null : new FpsWatch()
  }

  private makeGlow(): GlowLayer {
    const glow = new GlowLayer(`${this.tag}-glow`, this.scene, { blurKernelSize: 32, mainTextureRatio: 0.5, camera: this.mainCamera })
    glow.intensity = 0.7
    // 白名單內每個 mesh 用登記的發光色（炸彈、道具材質本身沒有 emissive）
    glow.customEmissiveColorSelector = (mesh, _subMesh, _material, result) => {
      const c = this.glowColors.get(mesh.uniqueId)
      if (c) result.set(c.r, c.g, c.b, 1)
      else result.set(0, 0, 0, 0)
    }
    return glow
  }

  // ---- 登記 ----

  /** 卡通兩階 ramp（一般物件；發光物走 emissive，不必掛） */
  toon(...materials: Material[]): void {
    for (const m of materials) applyToon(m)
  }

  /** 投影（只登記玩家、炸彈、道具） */
  caster(...meshes: Mesh[]): void {
    for (const m of meshes) this.shadow.addShadowCaster(m, false)
  }

  receiver(...meshes: Mesh[]): void {
    for (const m of meshes) m.receiveShadows = true
  }

  /** 卡通描邊（玩家、炸彈、箱子、道具） */
  outline(...meshes: Mesh[]): void {
    for (const m of meshes) {
      this.outlined.add(m)
      m.outlineColor = this.outlineColor
      m.outlineWidth = OUTLINE_WIDTH
      m.renderOutline = this.active.outline
      m.onDisposeObservable.addOnce(() => this.outlined.delete(m))
    }
  }

  /** GlowLayer 白名單（火焰外層、將爆炸彈、無敵代幣、AI 天線）；strength 縮放發光色 */
  glowMesh(mesh: Mesh, hex: string, strength = 1): void {
    this.glowColors.set(mesh.uniqueId, Color3.FromHexString(hex).scale(strength))
    this.glowOff.delete(mesh.uniqueId)
    mesh.onDisposeObservable.addOnce(() => {
      this.glowColors.delete(mesh.uniqueId)
      this.glowOff.delete(mesh.uniqueId)
      this.syncGlowEnabled()
    })
    this.glow?.addIncludedOnlyMesh(mesh)
    this.syncGlowEnabled()
  }

  /**
   * GlowLayer 的 includedOnly 名單一旦空了會變成「全部 mesh 都畫進發光貼圖」（顏色雖是黑的，
   * 但多一個 pass 還會遮掉後面的光暈），所以名單空時整層關掉、有人進名單再開。
   */
  private syncGlowEnabled(): void {
    if (this.glow) this.glow.isEnabled = this.glowColors.size - this.glowOff.size > 0
  }

  /**
   * 已登記的發光物改強度（脈動、閃光）；strength ≤ 0 時暫時移出白名單，
   * 免得以黑色寫進發光貼圖、把後面的光暈遮掉。
   */
  setGlow(mesh: Mesh, hex: string, strength: number): void {
    const id = mesh.uniqueId
    const on = strength > 0
    let c = this.glowColors.get(id)
    if (!c) {
      // 第一次見到：登記顏色，但先不進白名單（下面依 on 決定）
      c = new Color3()
      this.glowColors.set(id, c)
      this.glowOff.add(id)
      mesh.onDisposeObservable.addOnce(() => {
        this.glowColors.delete(id)
        this.glowOff.delete(id)
        this.syncGlowEnabled()
      })
    }
    if (on) this.hexColor(hex).scaleToRef(strength, c)
    const glow = this.glow
    const listed = !this.glowOff.has(id)
    if (!glow || on === listed) return
    if (on) {
      this.glowOff.delete(id)
      glow.addIncludedOnlyMesh(mesh)
    } else {
      this.glowOff.add(id)
      glow.removeIncludedOnlyMesh(mesh)
    }
    this.syncGlowEnabled()
  }

  private readonly hexCache = new Map<string, Color3>()
  private hexColor(hex: string): Color3 {
    let c = this.hexCache.get(hex)
    if (!c) this.hexCache.set(hex, (c = Color3.FromHexString(hex)))
    return c
  }

  // ---- 每幀 ----

  /** 餵幀時間；連續 60 幀平均低於 45fps 就降一級 */
  update(deltaMs: number): void {
    if (!this.watch || !this.watch.push(deltaMs)) return
    const step = nextDegrade(this.active)
    if (!step) {
      this.watch = null
      return
    }
    this.degrade(step)
    // 關掉一項後重新暖機（材質重編譯的那幾幀不算）
    this.watch = nextDegrade(this.active) ? new FpsWatch() : null
  }

  private degrade(step: DegradeStep): void {
    this.active[step] = false
    if (step === 'outline') for (const m of this.outlined) m.renderOutline = false
    else if (step === 'glow') {
      this.glow?.dispose()
      this.glow = null
    } else this.sun.shadowEnabled = false
    console.info(`[${this.tag}] degrade ${step}`)
  }

  dispose(): void {
    this.pipeline.dispose()
    this.glow?.dispose()
    this.glow = null
    this.shadow.dispose()
    this.sun.dispose()
    this.hemi.dispose()
    this.glowColors.clear()
    this.glowOff.clear()
    this.outlined.clear()
    this.scene.activeCameras = []
    this.scene.activeCamera = this.mainCamera
    this.scene.cameraToUseForPointers = null
    this.uiCamera.dispose()
    this.scene.getEngine().setHardwareScalingLevel(this.prevScaling)
  }
}
