/**
 * 廚房快手 3D 特效（kitchen spec §7，AC6）：進度條／進度環／勾選章、「!」警示章、爐火、蒸氣與焦煙、ember、
 * 切菜碎片與砧板回彈、出餐金星＋鈴回彈＋「+20」浮字、拾取／放下的小白環。
 * 只管畫；狀態分期與事件判定在 effectsModel.ts，觸發時機由 overcooked.ts 決定。
 * 粒子沿用 bomber 的 fx_*.webp（裁決⑨，原路徑）與 fx/emitter，每組上限 = 檔位的 particleCap。
 */
import { Color3, Mesh, MeshBuilder, ParticleSystem, StandardMaterial, Texture, type DynamicTexture, type Scene } from '@/babylon/babylonCore'
import { FxEmitter, fxRandom, style, type FxStyle } from '@/babylon/fx/emitter'
import { backOut, clamp01, emitCount, floatTextPose, ringPose } from '@/babylon/fx/curves'
import { createRingTexture } from '@/babylon/fx/textures'
import { bomberAssetUrl } from '@/babylon/games/bomberFx/textures'
import { advanceAlarmPhase, alarmPulse, alarmSmokeRate, type BoardPhase, type PotPhase } from '@/babylon/games/kitchenFx/effectsModel'
import { KITCHEN } from '@/babylon/games/kitchenFx/palette'
import {
  createAlertTexture,
  createIndicatorTexture,
  createScoreTexture,
  paintIndicator,
  type IndicatorMode,
} from '@/babylon/games/kitchenFx/textures'
import type { Ing } from '@/babylon/games/overcookedKitchen'

const GREEN = '#2FCF5E'
const RED = '#FF3B4E'

const STYLE = {
  steam: style('#FFFFFF', '#F1F3F8', '#FFFFFF', { size: [0.35, 0.6], life: [0.6, 1.0], power: [0.8, 1.3], dir: 'up' }, 0.75),
  bigSteam: style('#FFFFFF', '#F1F3F8', '#FFFFFF', { size: [0.6, 1.05], life: [0.5, 0.8], power: [1.4, 2.4], dir: 'fountain' }, 0.85),
  alarmSmoke: style('#8A8798', '#4A4658', '#2E2A36', { size: [0.4, 0.75], life: [0.7, 1.1], power: [0.8, 1.4], dir: 'up' }, 0.8),
  burntSmoke: style('#3A3440', '#1E1A22', '#2E2A36', { size: [0.6, 1.05], life: [0.6, 0.9], power: [1.5, 2.6], dir: 'fountain' }, 0.9),
  wisp: style('#4A4552', '#2E2A36', '#4A4552', { size: [0.2, 0.36], life: [0.8, 1.2], power: [0.4, 0.7], dir: 'up' }, 0.6),
  flame: style('#FFE08A', '#FF8A3D', '#FF5A4E', { size: [0.22, 0.36], life: [0.14, 0.26], power: [0.5, 1.0], dir: 'up' }),
  ember: style('#FFD27A', KITCHEN.crack, '#B3122A', { size: [0.1, 0.2], life: [0.5, 0.8], power: [3, 5], dir: 'fountain' }),
  star: style('#FFE38A', '#FFD23F', '#FFB800', { size: [0.3, 0.52], life: [0.5, 0.7], power: [2.5, 4], dir: 'fountain' }),
  chipV: style(KITCHEN.veg[0], KITCHEN.veg[1], KITCHEN.veg[1], { size: [0.12, 0.2], life: [0.35, 0.5], power: [2, 3.2], dir: 'burst' }),
  chipM: style(KITCHEN.fat, KITCHEN.meat[0], KITCHEN.meat[0], { size: [0.12, 0.2], life: [0.35, 0.5], power: [2, 3.2], dir: 'burst' }),
} as const satisfies Record<string, FxStyle>

/** 切一下的節奏（同 pose.CHOP_HZ 4Hz）與回彈時長 */
const CHOP_BEAT_MS = 250
const SQUASH_MS = 160
const STAMP_MS = { board: 200, pot: 300 } as const
const FLOAT_MS = 650
const SERVE_MS = 600
const RING_MS = 180
const RING_POOL = 4
const FLOAT_POOL = 3
const FLAMES = 7
const STEAM_RATE = 12
const FLAME_RATE = 16 // 每個火苗每秒
const WISP_RATE = 3
/** 進度量化格數（重畫貼圖的門檻） */
const STEPS = 48

interface Indicator {
  mesh: Mesh
  tex: DynamicTexture
  key: string
  mode: IndicatorMode | null
  stampAt: number
}

interface Station {
  x: number
  z: number
  ind: Indicator
}

interface PotFx extends Station {
  alert: Mesh
  phase: PotPhase
  /** 快焦脈動相位（進 alarm 時歸零，之後每幀累加） */
  alarmPhase: number
}

interface BoardFx extends Station {
  phase: BoardPhase
  lastBeat: number
  squashAt: number
}

interface Pooled {
  mesh: Mesh
  mat: StandardMaterial
  start: number
  x: number
  y: number
  z: number
}

export interface KitchenFxOptions {
  cell: number
  /** 檯面頂高 */
  top: number
  /** 每組粒子上限（檔位 particleCap） */
  cap: number
  /** 「+20」浮字文字 */
  scoreText: string
}

export interface KitchenFxHooks {
  squashBoard(id: string, sy: number): void
  setPotAlarm(id: string, on: boolean, level: number): void
  /** 發光強度（ToyLook.setGlow） */
  glow(mesh: Mesh, hex: string, strength: number): void
  potAlarmMesh(id: string): Mesh | undefined
}

export class KitchenFx {
  private readonly scene: Scene
  private readonly opts: KitchenFxOptions
  private readonly hooks: KitchenFxHooks
  private readonly textures: (Texture | DynamicTexture)[] = []
  private readonly mats: StandardMaterial[] = []
  private readonly meshes: Mesh[] = []
  private readonly emitters: FxEmitter[] = []
  private readonly smoke: FxEmitter
  private readonly flame: FxEmitter
  private readonly spark: FxEmitter
  private readonly star: FxEmitter
  private readonly chip: FxEmitter
  private readonly boards = new Map<string, BoardFx>()
  private readonly pots = new Map<string, PotFx>()
  private readonly alertMat: StandardMaterial
  private readonly rings: Pooled[] = []
  private readonly floats: Pooled[] = []
  private readonly acc = new Map<string, number>()
  private serve: { x: number; z: number; bell?: Mesh; at: number } | null = null

  constructor(scene: Scene, opts: KitchenFxOptions, hooks: KitchenFxHooks) {
    this.scene = scene
    this.opts = opts
    this.hooks = hooks
    const tex = (file: string): Texture => {
      const t = new Texture(bomberAssetUrl(file), scene)
      this.textures.push(t)
      return t
    }
    const smoke = tex('fx_smoke.webp')
    const spark = tex('fx_spark.webp')
    const star = tex('fx_star.webp')
    const circle = tex('fx_circle.webp')
    const add = ParticleSystem.BLENDMODE_ADD
    const std = ParticleSystem.BLENDMODE_STANDARD
    const mk = (name: string, t: Texture, blend: number, gravity: number): FxEmitter => {
      const e = new FxEmitter(scene, name, t, opts.cap, blend, gravity)
      this.emitters.push(e)
      return e
    }
    this.smoke = mk('kitchen-fx-smoke', smoke, std, 0.6)
    this.flame = mk('kitchen-fx-flame', spark, add, 0)
    this.spark = mk('kitchen-fx-ember', spark, add, -6)
    this.star = mk('kitchen-fx-star', star, std, -4)
    this.chip = mk('kitchen-fx-chip', circle, std, -14)

    const alertTex = createAlertTexture(scene)
    this.textures.push(alertTex)
    this.alertMat = this.billboardMat('kitchen-alert-mat', alertTex)

    const ringTex = createRingTexture(scene, 'kitchen-ring-tex')
    const scoreTex = createScoreTexture(scene, opts.scoreText)
    this.textures.push(ringTex, scoreTex)
    for (let i = 0; i < RING_POOL; i++) {
      const mesh = MeshBuilder.CreateGround(`kitchen-ring-${i}`, { width: 1, height: 1 }, scene)
      const mat = this.mat(`kitchen-ring-mat-${i}`, (m) => {
        m.diffuseTexture = ringTex
        m.useAlphaFromDiffuseTexture = true
        m.disableLighting = true
        m.emissiveColor = Color3.White()
        m.zOffset = -3
      })
      this.rings.push(this.pooled(mesh, mat))
    }
    for (let i = 0; i < FLOAT_POOL; i++) {
      const mesh = MeshBuilder.CreatePlane(`kitchen-score-${i}`, { width: 1.9, height: 0.95 }, scene)
      mesh.billboardMode = Mesh.BILLBOARDMODE_ALL
      this.floats.push(this.pooled(mesh, this.billboardMat(`kitchen-score-mat-${i}`, scoreTex)))
    }
  }

  private mat(name: string, setup: (m: StandardMaterial) => void): StandardMaterial {
    const m = new StandardMaterial(name, this.scene)
    m.specularColor = Color3.Black()
    setup(m)
    this.mats.push(m)
    return m
  }

  private billboardMat(name: string, tex: DynamicTexture): StandardMaterial {
    return this.mat(name, (m) => {
      m.diffuseTexture = tex
      m.useAlphaFromDiffuseTexture = true
      m.disableLighting = true
      m.emissiveColor = Color3.White()
      m.backFaceCulling = false
    })
  }

  private pooled(mesh: Mesh, mat: StandardMaterial): Pooled {
    mesh.material = mat
    mesh.isPickable = false
    mesh.setEnabled(false)
    this.meshes.push(mesh)
    return { mesh, mat, start: 0, x: 0, y: 0, z: 0 }
  }

  private take(pool: Pooled[]): Pooled {
    const idle = pool.find((p) => !p.mesh.isEnabled())
    return idle ?? pool.reduce((a, b) => (a.start <= b.start ? a : b))
  }

  private indicator(id: string): Indicator {
    const tex = createIndicatorTexture(this.scene, `kitchen-ind-tex-${id}`)
    this.textures.push(tex)
    const mesh = MeshBuilder.CreatePlane(`kitchen-ind-${id}`, { size: 1 }, this.scene)
    mesh.billboardMode = Mesh.BILLBOARDMODE_ALL
    mesh.material = this.billboardMat(`kitchen-ind-mat-${id}`, tex)
    mesh.isPickable = false
    mesh.setEnabled(false)
    this.meshes.push(mesh)
    return { mesh, tex, key: '', mode: null, stampAt: 0 }
  }

  // ---- 登記站點 ----

  addBoard(id: string, x: number, z: number): void {
    const ind = this.indicator(id)
    ind.mesh.position.set(x - 0.12, this.opts.top + 1.25, z)
    this.boards.set(id, { x, z, ind, phase: 'empty', lastBeat: 0, squashAt: -Infinity })
  }

  addPot(id: string, x: number, z: number): void {
    const ind = this.indicator(id)
    ind.mesh.position.set(x, this.opts.top + 1.85, z)
    const alert = MeshBuilder.CreatePlane(`kitchen-alert-${id}`, { size: 0.9 }, this.scene)
    alert.billboardMode = Mesh.BILLBOARDMODE_ALL
    alert.material = this.alertMat
    alert.isPickable = false
    alert.setEnabled(false)
    // 「!」在鍋靠廚房內側那邊（鍋在右排，往 −x）
    alert.position.set(x - this.opts.cell * 0.75, this.opts.top + 1.2, z)
    this.meshes.push(alert)
    this.pots.set(id, { x, z, ind, alert, phase: 'empty', alarmPhase: 0 })
  }

  setServe(x: number, z: number, bell?: Mesh): void {
    this.serve = { x, z, bell, at: -Infinity }
  }

  // ---- 進度提示 ----

  /** 換模式／進度（量化後才重畫）；切到 check 時開始彈出動畫 */
  private show(ind: Indicator, mode: IndicatorMode | null, progress: number, color: string, now: number): void {
    if (!mode) {
      ind.mesh.setEnabled(false)
      ind.mode = null
      return
    }
    if (mode === 'check' && ind.mode !== 'check') ind.stampAt = now
    ind.mode = mode
    ind.mesh.setEnabled(true)
    const q = Math.round(clamp01(progress) * STEPS)
    const key = `${mode}:${q}:${color}`
    if (key === ind.key) return
    ind.key = key
    paintIndicator(ind.tex, mode, q / STEPS, color)
  }

  private sizeInd(ind: Indicator, base: number, stampMs: number, now: number): void {
    const k = ind.mode === 'check' ? Math.max(0, backOut((now - ind.stampAt) / stampMs)) * 0.9 : 1
    ind.mesh.scaling.setAll(base * k)
  }

  /** 砧板每幀：進度條、切好綠勾、每 250ms 砍一下（回彈＋碎片） */
  updateBoard(id: string, phase: BoardPhase, progress: number, ing: Ing | null, now: number): void {
    const b = this.boards.get(id)
    if (!b) return
    b.phase = phase
    this.show(b.ind, phase === 'chopping' ? 'bar' : phase === 'done' ? 'check' : null, progress, GREEN, now)
    this.sizeInd(b.ind, phase === 'chopping' ? this.opts.cell * 0.8 * 1.05 : 0.95, STAMP_MS.board, now)
    if (phase === 'chopping' && progress < 1 && now - b.lastBeat >= CHOP_BEAT_MS) {
      b.lastBeat = now
      b.squashAt = now
      const n = 2 + Math.floor(fxRandom() * 2)
      this.chip.emit(b.x - 0.12, this.opts.top + 0.35, b.z, 0.15, n, ing === 'm' ? STYLE.chipM : STYLE.chipV)
    }
    // 壓到 0.95 再彈回
    const t = (now - b.squashAt) / SQUASH_MS
    const sy = t >= 1 ? 1 : t < 0.35 ? 1 - 0.05 * (t / 0.35) : 0.95 + 0.05 * backOut((t - 0.35) / 0.65)
    this.hooks.squashBoard(id, sy)
  }

  /** 鍋每幀：進度環（綠→快焦紅）、煮好綠勾、「!」脈動、鍋緣紅光、爐火與煙 */
  updatePot(id: string, phase: PotPhase, progress: number, now: number, dtMs: number): void {
    const p = this.pots.get(id)
    if (!p) return
    const top = this.opts.top
    const ringMode: IndicatorMode | null = phase === 'cooking' || phase === 'alarm' ? 'ring' : phase === 'done' ? 'check' : null
    this.show(p.ind, ringMode, progress, phase === 'alarm' ? RED : GREEN, now)
    this.sizeInd(p.ind, 1.15, STAMP_MS.pot, now)

    const alarm = phase === 'alarm'
    // 脈動：頻率 2Hz → 6Hz，每鍋累加相位（effectsModel.advanceAlarmPhase）；剛進快焦從 0 起算
    p.alarmPhase = !alarm ? 0 : p.phase === 'alarm' ? advanceAlarmPhase(p.alarmPhase, progress, dtMs) : 0
    const pulse = alarm ? alarmPulse(p.alarmPhase) : 0
    p.alert.setEnabled(alarm)
    if (alarm) p.alert.scaling.setAll(0.9 + 0.25 * pulse)
    this.hooks.setPotAlarm(id, alarm, pulse)
    const rim = this.hooks.potAlarmMesh(id)
    if (rim) this.hooks.glow(rim, RED, alarm ? 0.35 + 0.65 * pulse : 0)

    const y = top + 0.95
    if (phase === 'cooking' || alarm) {
      // 爐圈旁 7 個小火苗
      const r = emitCount(this.acc.get(`flame:${id}`) ?? 0, FLAME_RATE * FLAMES, dtMs)
      this.acc.set(`flame:${id}`, r.acc)
      for (let i = 0; i < r.count; i++) {
        const a = (Math.floor(fxRandom() * FLAMES) / FLAMES) * Math.PI * 2
        this.flame.emit(p.x + Math.cos(a) * 0.72, top + 0.3, p.z + Math.sin(a) * 0.72, 0.03, 1, STYLE.flame)
      }
    }
    if (phase === 'cooking') this.stream(`steam:${id}`, p.x, y, p.z, STEAM_RATE, dtMs, STYLE.steam)
    else if (alarm) this.stream(`steam:${id}`, p.x, y, p.z, alarmSmokeRate(progress), dtMs, STYLE.alarmSmoke)
    else if (phase === 'burnt') this.stream(`steam:${id}`, p.x, y, p.z, WISP_RATE, dtMs, STYLE.wisp)
    p.phase = phase
  }

  private stream(key: string, x: number, y: number, z: number, rate: number, dtMs: number, s: FxStyle): void {
    const r = emitCount(this.acc.get(key) ?? fxRandom(), rate, dtMs)
    this.acc.set(key, r.acc)
    if (r.count > 0) this.smoke.emit(x, y, z, 0.3, r.count, s)
  }

  /** 焦掉的東西端在手上或放在檯面：一縷細黑煙 */
  wisp(key: string, x: number, y: number, z: number, dtMs: number): void {
    this.stream(`wisp:${key}`, x, y, z, WISP_RATE, dtMs, STYLE.wisp)
  }

  // ---- 事件 ----

  /** 煮好：湯面冒一陣大蒸氣 */
  cookDone(id: string): void {
    const p = this.pots.get(id)
    if (p) this.smoke.emit(p.x, this.opts.top + 0.95, p.z, 0.35, 14, STYLE.bigSteam)
  }

  /** 焦了：一陣黑煙＋6 顆 ember 往上噴 */
  burnt(id: string): void {
    const p = this.pots.get(id)
    if (!p) return
    this.smoke.emit(p.x, this.opts.top + 0.95, p.z, 0.35, 14, STYLE.burntSmoke)
    this.spark.emit(p.x, this.opts.top + 0.9, p.z, 0.3, 6, STYLE.ember)
  }

  /** 拾取／放下的落點：小白環 */
  landRing(x: number, y: number, z: number): void {
    const p = this.take(this.rings)
    p.start = performance.now()
    p.x = x
    p.y = y + 0.03
    p.z = z
    p.mesh.position.set(p.x, p.y, p.z)
    p.mesh.scaling.setAll(0.01)
    p.mesh.setEnabled(true)
  }

  /** 出餐：金星 12 顆、鈴壓扁回彈並閃光、「+20」浮字 */
  served(): void {
    const s = this.serve
    if (!s) return
    const now = performance.now()
    s.at = now
    const y = this.opts.top + 0.6
    this.star.emit(s.x, y, s.z, 0.35, 12, STYLE.star)
    const f = this.take(this.floats)
    f.start = now
    f.x = s.x
    f.y = this.opts.top + 1.6
    f.z = s.z
    f.mesh.position.set(f.x, f.y, f.z)
    f.mat.alpha = 1
    f.mesh.setEnabled(true)
  }

  // ---- 每幀 ----

  update(now: number): void {
    for (const p of this.rings) {
      if (!p.mesh.isEnabled()) continue
      const t = (now - p.start) / RING_MS
      if (t >= 1) {
        p.mesh.setEnabled(false)
        continue
      }
      const r = ringPose(t)
      const k = r.scale * this.opts.cell * 0.55
      p.mesh.scaling.set(k, 1, k)
      p.mat.alpha = r.alpha
    }
    for (const p of this.floats) {
      if (!p.mesh.isEnabled()) continue
      const t = (now - p.start) / FLOAT_MS
      if (t >= 1) {
        p.mesh.setEnabled(false)
        continue
      }
      const f = floatTextPose(t)
      p.mesh.position.set(p.x, p.y + f.rise, p.z)
      p.mat.alpha = f.alpha
    }
    const s = this.serve
    if (s?.bell) {
      // 鈴：前 20% 壓到 0.7，之後 back-out 彈回；閃光 1 → 0
      const t = (now - s.at) / SERVE_MS
      const sy = t >= 1 ? 1 : t < 0.2 ? 1 - 0.3 * (t / 0.2) : 0.7 + 0.3 * backOut((t - 0.2) / 0.8)
      s.bell.scaling.set(1 + (1 - sy) * 0.5, sy, 1 + (1 - sy) * 0.5)
      this.hooks.glow(s.bell, '#FFD23F', t >= 1 ? 0 : 1 - t)
    }
  }

  /** 新局：清掉殘留的特效 */
  clearRound(): void {
    for (const p of [...this.rings, ...this.floats]) p.mesh.setEnabled(false)
    for (const e of this.emitters) e.clear()
    this.acc.clear()
    if (this.serve) this.serve.at = -Infinity
  }

  dispose(): void {
    for (const e of this.emitters) e.dispose()
    this.emitters.length = 0
    for (const m of this.meshes) m.dispose()
    for (const m of this.mats) m.dispose()
    for (const t of this.textures) t.dispose()
    this.meshes.length = 0
    this.mats.length = 0
    this.textures.length = 0
    this.boards.clear()
    this.pots.clear()
    this.acc.clear()
  }
}
