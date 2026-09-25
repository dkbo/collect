/**
 * 炸彈超人光影與後製（spec §6／§7／§10，AC4／AC7）：雙光、陰影、GlowLayer 白名單、卡通描邊、
 * DefaultRenderingPipeline、解析度與檔位；遊戲中 fps 過低時依序關掉 描邊 → Glow → 陰影。
 * 只管「怎麼畫」，哪些 mesh 投影／發光／描邊由呼叫端登記。
 */
import {
  Color3,
  DefaultRenderingPipeline,
  DirectionalLight,
  GlowLayer,
  HemisphericLight,
  ImageProcessingConfiguration,
  ShadowGenerator,
  Vector3,
  type Camera,
  type Material,
  type Mesh,
  type Scene,
} from '@/babylon/babylonCore'
import { TOY } from '@/babylon/games/bomberFx/palette'
import {
  FpsWatch,
  nextDegrade,
  noDegradeFlag,
  pickTier,
  tierSettings,
  type BomberTier,
  type DegradeStep,
  type TierSettings,
} from '@/babylon/games/bomberFx/quality'
import { applyToon } from '@/babylon/games/bomberFx/toon'

const OUTLINE_WIDTH = 0.02
const SUN_DIR = new Vector3(-0.4, -1, 0.3)

export interface LookOptions {
  /** 陰影正交投影要涵蓋的半徑（場地半對角線加餘裕） */
  shadowRadius: number
}

/** 讀瀏覽器環境決定檔位（非瀏覽器環境一律 desktop） */
function detectTier(): { tier: BomberTier; noDegrade: boolean } {
  if (typeof window === 'undefined') return { tier: 'desktop', noDegrade: true }
  const search = window.location.search
  const touch = 'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0
  const cores = navigator.hardwareConcurrency || undefined
  return { tier: pickTier({ search, touch, cores }), noDegrade: noDegradeFlag(search) }
}

export class ToyLook {
  readonly tier: BomberTier
  readonly settings: TierSettings
  private readonly scene: Scene
  private readonly hemi: HemisphericLight
  private readonly sun: DirectionalLight
  private readonly shadow: ShadowGenerator
  private glow: GlowLayer | null = null
  private readonly pipeline: DefaultRenderingPipeline
  private readonly glowColors = new Map<number, Color3>()
  private readonly outlined = new Set<Mesh>()
  private readonly outlineColor = Color3.FromHexString(TOY.outline)
  private readonly active: Record<DegradeStep, boolean>
  private watch: FpsWatch | null
  private readonly prevScaling: number

  constructor(scene: Scene, camera: Camera, opts: LookOptions) {
    this.scene = scene
    const { tier, noDegrade } = detectTier()
    this.tier = tier
    this.settings = tierSettings(tier, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1)
    const s = this.settings
    console.info(`[bomber] tier ${tier}`)

    const engine = scene.getEngine()
    this.prevScaling = engine.getHardwareScalingLevel()
    engine.setHardwareScalingLevel(s.hardwareScaling)

    // 暖主光＋冷環境光（spec §7）
    this.hemi = new HemisphericLight('bomber-hemi', new Vector3(0.2, 1, 0.1), scene)
    this.hemi.intensity = 0.55
    this.hemi.groundColor = Color3.FromHexString('#3A3F5C')
    this.sun = new DirectionalLight('bomber-sun', SUN_DIR, scene)
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

    if (s.glow) this.glow = this.makeGlow()

    this.pipeline = new DefaultRenderingPipeline('bomber-pipeline', true, scene, [camera])
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
    ip.exposure = 1.05
    ip.contrast = 1.08

    this.active = { outline: s.outline, glow: s.glow, shadow: true }
    this.watch = noDegrade ? null : new FpsWatch()
  }

  private makeGlow(): GlowLayer {
    const glow = new GlowLayer('bomber-glow', this.scene, { blurKernelSize: 32, mainTextureRatio: 0.5 })
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
    mesh.onDisposeObservable.addOnce(() => this.glowColors.delete(mesh.uniqueId))
    this.glow?.addIncludedOnlyMesh(mesh)
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
    console.info(`[bomber] degrade ${step}`)
  }

  dispose(): void {
    this.pipeline.dispose()
    this.glow?.dispose()
    this.glow = null
    this.shadow.dispose()
    this.sun.dispose()
    this.hemi.dispose()
    this.glowColors.clear()
    this.outlined.clear()
    this.scene.getEngine().setHardwareScalingLevel(this.prevScaling)
  }
}
