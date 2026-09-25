/**
 * 炸彈超人特效（spec §8，AC5）：粒子（AC1 的 WebP 貼圖）、木片、焦痕 decal、地面 ring、「+1」飄字。
 * 只管畫；什麼時候觸發由 bomber.ts 決定，時間曲線在 fxCurves.ts。
 *
 * 粒子：每種貼圖一組 ParticleSystem（上限 = 檔位的 particleCap），同一幀要在很多位置噴時
 * 把每顆的出生位置與樣式排進 BurstQueue，由 startPositionFunction 逐顆取出。
 */
import {
  Color3,
  Color4,
  Mesh,
  MeshBuilder,
  ParticleSystem,
  StandardMaterial,
  Texture,
  Vector3,
  type DynamicTexture,
  type Scene,
} from '@/babylon/babylonCore'
import { BurstQueue, type BurstParticle } from '@/babylon/games/bomberFx/burstQueue'
import { emitCount, floatTextPose, ringPose, scorchScale } from '@/babylon/games/bomberFx/fxCurves'
import { roundedBox, type MeshData } from '@/babylon/games/bomberFx/geometry'
import { rgba, solid, toMesh } from '@/babylon/games/bomberFx/models'
import { hexToRgb, TOY } from '@/babylon/games/bomberFx/palette'
import { ThinGroup } from '@/babylon/games/bomberFx/thin'
import {
  bomberAssetUrl,
  createPlusOneTexture,
  createRingTexture,
  createScorchTexture,
} from '@/babylon/games/bomberFx/textures'

type Dir = 'fountain' | 'up' | 'burst' | 'radial'

interface FxStyle {
  c1: Color4
  c2: Color4
  dead: Color4
  size: readonly [number, number]
  life: readonly [number, number]
  /** 初速（方向向量的長度倍率） */
  power: readonly [number, number]
  dir: Dir
}

const c4 = (hex: string, a = 1): Color4 => {
  const [r, g, b] = hexToRgb(hex)
  return new Color4(r, g, b, a)
}
/** 特效專用亂數（純視覺）：不吃 Math.random，host 的掉寶判定與 qa 的確定性亂數序列不受特效多寡影響 */
const fxRandom = (() => {
  let s = 0x9e3779b9
  return (): number => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
})()
const between = ([a, b]: readonly [number, number]): number => a + fxRandom() * (b - a)

const style = (c1: string, c2: string, dead: string, o: Omit<FxStyle, 'c1' | 'c2' | 'dead'>, a = 1): FxStyle => ({
  c1: c4(c1, a),
  c2: c4(c2, a),
  dead: c4(dead, 0),
  ...o,
})

const CREAM = '#FFF6E3'
const DUST = '#E9DCC0'
const WOOD = ['#F0B866', '#C07E33'] as const

const STYLE = {
  fuse: style('#FFF6C8', '#FFC53A', '#FF7A1A', { size: [0.16, 0.3], life: [0.15, 0.3], power: [1.2, 2.2], dir: 'up' }),
  blast: style(TOY.flame[2], TOY.flame[1], TOY.flame[0], { size: [0.22, 0.48], life: [0.25, 0.5], power: [4, 8], dir: 'burst' }),
  metal: style('#FFFFFF', '#FFE38A', '#C3CBD8', { size: [0.12, 0.26], life: [0.1, 0.25], power: [3, 6], dir: 'burst' }),
  crateSmoke: style(CREAM, '#F3E6CC', CREAM, { size: [0.9, 1.35], life: [0.45, 0.6], power: [0.4, 0.9], dir: 'up' }, 0.9),
  deathSmoke: style('#FFFFFF', CREAM, CREAM, { size: [0.7, 1.2], life: [0.5, 0.8], power: [1, 2], dir: 'fountain' }, 0.9),
  dust: style(DUST, '#D8C8A6', DUST, { size: [0.6, 1.0], life: [0.4, 0.6], power: [2.5, 4], dir: 'radial' }, 0.85),
  sparkle: style(TOY.invincible, '#FFFFFF', '#FFE38A', { size: [0.22, 0.42], life: [0.3, 0.5], power: [1.5, 3], dir: 'fountain' }),
} as const

const deathStars = (hex: string): FxStyle =>
  style(hex, '#FFFFFF', hex, { size: [0.3, 0.52], life: [0.5, 0.7], power: [2.5, 4], dir: 'fountain' })

/** 一組粒子：佇列裡每筆請求在自己的位置噴自己的樣式 */
class FxEmitter {
  readonly ps: ParticleSystem
  private readonly queue: BurstQueue<FxStyle>
  private cur: BurstParticle<FxStyle> | null = null

  constructor(scene: Scene, name: string, tex: Texture, cap: number, blend: number, gravity: number) {
    this.queue = new BurstQueue<FxStyle>(fxRandom, cap)
    const ps = new ParticleSystem(name, cap, scene)
    ps.particleTexture = tex
    ps.emitter = Vector3.Zero()
    ps.emitRate = 0
    ps.manualEmitCount = 0
    ps.updateSpeed = 1 / 60 // 壽命用真實秒數（Babylon 依 animation ratio 補幀率）
    ps.gravity = new Vector3(0, gravity, 0)
    ps.blendMode = blend
    ps.minEmitPower = 1
    ps.maxEmitPower = 1 // 初速改在方向函式裡乘（emit power 在出生位置之前就抽好了）
    ps.minInitialRotation = 0
    ps.maxInitialRotation = Math.PI * 2
    ps.minAngularSpeed = -3
    ps.maxAngularSpeed = 3
    // 出生位置之後才算大小與顏色，所以在這裡換成這顆所屬請求的樣式；壽命已抽過，直接覆寫
    ps.startPositionFunction = (_m, pos, particle) => {
      const p = this.queue.next()
      this.cur = p
      if (!p) {
        pos.set(0, -50, 0)
        particle.lifeTime = 0.001
        return
      }
      pos.set(p.x, p.y, p.z)
      const s = p.style
      particle.lifeTime = between(s.life)
      ps.minSize = s.size[0]
      ps.maxSize = s.size[1]
      ps.color1 = s.c1
      ps.color2 = s.c2
      ps.colorDead = s.dead
    }
    ps.startDirectionFunction = (_m, dir) => {
      const p = this.cur
      if (!p) {
        dir.set(0, 0, 0)
        return
      }
      const k = between(p.style.power)
      const r = () => fxRandom() * 2 - 1
      if (p.style.dir === 'up') dir.set(r() * 0.25, 1, r() * 0.25)
      else if (p.style.dir === 'burst') dir.set(r(), 0.2 + fxRandom() * 1.4, r())
      else if (p.style.dir === 'radial') {
        let dx = p.x - p.cx
        let dz = p.z - p.cz
        const len = Math.hypot(dx, dz)
        if (len < 1e-4) {
          const a = fxRandom() * Math.PI * 2
          dx = Math.cos(a)
          dz = Math.sin(a)
        } else {
          dx /= len
          dz /= len
        }
        dir.set(dx, 0.12, dz)
      } else dir.set(r(), 1 + fxRandom() * 1.5, r())
      dir.scaleInPlace(k)
    }
    ps.start()
    this.ps = ps
  }

  emit(x: number, y: number, z: number, spread: number, count: number, s: FxStyle): void {
    // 上一幀沒噴完的是容量滿了噴不出來的，丟掉免得累積成延遲的一大團
    if (this.ps.manualEmitCount <= 0 && this.queue.total > 0) this.queue.clear()
    this.queue.push({ x, y, z, spread, count, style: s })
    this.ps.manualEmitCount = this.queue.total
  }

  clear(): void {
    this.queue.clear()
    this.ps.manualEmitCount = 0
    this.ps.reset()
  }

  dispose(): void {
    this.ps.dispose(false)
  }
}

interface Chip {
  group: ThinGroup<number>
  key: number
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  yaw: number
  pitch: number
  spin: number
  born: number
}

interface Pooled {
  mesh: Mesh
  mat: StandardMaterial
  start: number
  dur: number
  x: number
  y: number
  z: number
  size: number
}

const CHIP_MS = 600
const CHIP_GRAVITY = -20
const RING_POOL = 8
const FLOAT_POOL = 4
const FLOAT_MS = 650
const SCORCH_MS = 1500
const FLASH_MS = 320

export interface FxOptions {
  cell: number
  /** 每組粒子上限（檔位 particleCap） */
  cap: number
}

export class ToyFx {
  private readonly scene: Scene
  private readonly cell: number
  private readonly cap: number
  private readonly textures: (Texture | DynamicTexture)[] = []
  private readonly mats: StandardMaterial[] = []
  private readonly emitters: FxEmitter[] = []
  private readonly fuseFx: FxEmitter
  private readonly sparkFx: FxEmitter
  private readonly flashFx: FxEmitter
  private readonly smokeFx: FxEmitter
  private readonly starFx: FxEmitter
  private readonly flashStyle: FxStyle
  private readonly chipGroups: ThinGroup<number>[]
  private chips: Chip[] = []
  private chipSeq = 0
  private readonly chipMat: StandardMaterial
  private readonly scorch: ThinGroup<number>
  private readonly scorchBorn = new Map<number, { x: number; z: number; born: number; yaw: number }>()
  private readonly rings: Pooled[] = []
  private readonly floats: Pooled[] = []
  private fuseAcc = new Map<string, number>()
  private fuseSeen = new Set<string>()

  constructor(scene: Scene, opts: FxOptions) {
    this.scene = scene
    this.cell = opts.cell
    this.cap = opts.cap
    const tex = (file: string): Texture => {
      const t = new Texture(bomberAssetUrl(file), scene)
      this.textures.push(t)
      return t
    }
    const spark = tex('fx_spark.webp')
    const star = tex('fx_star.webp')
    const smoke = tex('fx_smoke.webp')
    const circle = tex('fx_circle.webp')
    const add = ParticleSystem.BLENDMODE_ADD
    const std = ParticleSystem.BLENDMODE_STANDARD
    const mk = (name: string, t: Texture, blend: number, gravity: number): FxEmitter => {
      const e = new FxEmitter(scene, name, t, opts.cap, blend, gravity)
      this.emitters.push(e)
      return e
    }
    this.fuseFx = mk('bomber-fx-fuse', circle, add, -2)
    this.sparkFx = mk('bomber-fx-spark', spark, add, -7)
    this.flashFx = mk('bomber-fx-flash', star, add, 0)
    this.smokeFx = mk('bomber-fx-smoke', smoke, std, 0.8)
    this.starFx = mk('bomber-fx-star', star, std, -4)

    // 爆心星芒：0.3 → 1.2 放大再淡出（大小與透明度走漸層，這組只噴星芒）
    const F = this.cell * 1.8
    const fp = this.flashFx.ps
    fp.addSizeGradient(0, 0.3 * F)
    fp.addSizeGradient(0.55, 1.2 * F)
    fp.addSizeGradient(1, 1.25 * F)
    fp.addColorGradient(0, c4(TOY.flame[2], 1))
    fp.addColorGradient(0.5, c4('#FFE7A0', 1))
    fp.addColorGradient(1, c4(TOY.flame[1], 0))
    fp.minAngularSpeed = -1.2
    fp.maxAngularSpeed = 1.2
    this.flashStyle = style('#FFFFFF', '#FFFFFF', '#FFFFFF', { size: [1, 1], life: [FLASH_MS / 1000, FLASH_MS / 1000], power: [0, 0], dir: 'up' })

    // 木片：兩種木色的小圓角塊，thin instance、CPU 模擬拋射
    this.chipMat = this.mat('bomber-chip-mat', (m) => {
      m.diffuseColor = Color3.White()
    })
    this.chipGroups = WOOD.map((hex, i) => {
      const d: MeshData = solid(roundedBox({ width: 0.34, height: 0.12, depth: 0.22, radius: 0.04, segments: 1 }), rgba(hex))
      const mesh = toMesh(`bomber-chips-${i}`, d, scene)
      mesh.material = this.chipMat
      mesh.isPickable = false
      return new ThinGroup<number>(mesh, 32)
    })

    // 焦痕 decal：貼地正方形，thin instance（沒有逐顆 alpha，最後 400ms 用縮小代替淡出）
    const scorchTex = createScorchTexture(scene)
    this.textures.push(scorchTex)
    const scorchMat = this.mat('bomber-scorch-mat', (m) => {
      m.diffuseTexture = scorchTex
      m.useAlphaFromDiffuseTexture = true
      m.disableLighting = true // 不受光：顏色全靠 emissive（× 貼圖）
      m.emissiveColor = Color3.White()
      m.zOffset = -2
    })
    const q = this.cell * 0.5
    const scorchMesh = toMesh(
      'bomber-scorch',
      {
        positions: [-q, 0.025, -q, q, 0.025, -q, q, 0.025, q, -q, 0.025, q],
        normals: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
        uvs: [0, 0, 1, 0, 1, 1, 0, 1],
        indices: [0, 1, 2, 0, 2, 3],
      },
      scene
    )
    scorchMesh.material = scorchMat
    scorchMesh.isPickable = false
    this.scorch = new ThinGroup<number>(scorchMesh, 64)

    // 地面 ring 與「+1」：數量少、各自淡出，用小物件池（各有一份材質才能各自調 alpha）
    const ringTex = createRingTexture(scene)
    const plusTex = createPlusOneTexture(scene)
    this.textures.push(ringTex, plusTex)
    for (let i = 0; i < RING_POOL; i++) {
      const mesh = MeshBuilder.CreateGround(`bomber-ring-${i}`, { width: 1, height: 1 }, scene)
      const mat = this.mat(`bomber-ring-mat-${i}`, (m) => {
        m.diffuseTexture = ringTex
        m.useAlphaFromDiffuseTexture = true
        m.disableLighting = true
        m.emissiveColor = Color3.White()
        m.zOffset = -3
      })
      this.rings.push(this.pooled(mesh, mat))
    }
    for (let i = 0; i < FLOAT_POOL; i++) {
      const mesh = MeshBuilder.CreatePlane(`bomber-plus1-${i}`, { width: 1.4, height: 1.05 }, scene)
      mesh.billboardMode = Mesh.BILLBOARDMODE_ALL
      const mat = this.mat(`bomber-plus1-mat-${i}`, (m) => {
        m.diffuseTexture = plusTex
        m.useAlphaFromDiffuseTexture = true
        m.disableLighting = true
        m.emissiveColor = Color3.White()
        m.backFaceCulling = false
      })
      this.floats.push(this.pooled(mesh, mat))
    }
  }

  private mat(name: string, setup: (m: StandardMaterial) => void): StandardMaterial {
    const m = new StandardMaterial(name, this.scene)
    m.specularColor = Color3.Black()
    setup(m)
    this.mats.push(m)
    return m
  }

  private pooled(mesh: Mesh, mat: StandardMaterial): Pooled {
    mesh.material = mat
    mesh.isPickable = false
    mesh.setEnabled(false)
    return { mesh, mat, start: 0, dur: 1, x: 0, y: 0, z: 0, size: 1 }
  }

  /** 取池中最舊（或閒置）的一個 */
  private take(pool: Pooled[]): Pooled {
    const idle = pool.find((p) => !p.mesh.isEnabled())
    return idle ?? pool.reduce((a, b) => (a.start <= b.start ? a : b))
  }

  /** 卡通 ramp 要掛的材質（木片） */
  toonMaterials(): StandardMaterial[] {
    return [this.chipMat]
  }

  // ---- 觸發 ----

  /** 放炸彈：地上擴散一圈白色 ring */
  bombPlaced(x: number, z: number, durMs: number): void {
    this.ring(x, z, '#FFFFFF', durMs, this.cell * 1.25)
  }

  /** 引信火花：每顆炸彈每幀呼叫一次（每秒 30 顆，將爆時加倍） */
  fuse(id: string, x: number, y: number, z: number, flashing: boolean, dtMs: number): void {
    this.fuseSeen.add(id)
    const r = emitCount(this.fuseAcc.get(id) ?? fxRandom(), flashing ? 60 : 30, dtMs)
    this.fuseAcc.set(id, r.acc)
    if (r.count > 0) this.fuseFx.emit(x, y, z, 0.04, r.count, STYLE.fuse)
  }

  /** 每幀炸彈跑完後呼叫：清掉這幀沒出現的炸彈的累積量 */
  endFuseFrame(): void {
    for (const id of this.fuseAcc.keys()) if (!this.fuseSeen.has(id)) this.fuseAcc.delete(id)
    this.fuseSeen.clear()
  }

  /** 爆心：星芒＋火花 */
  explosion(x: number, z: number): void {
    this.flashFx.emit(x, 0.9, z, 0, 1, this.flashStyle)
    this.sparkFx.emit(x, 0.6, z, 0.3, 40, STYLE.blast)
  }

  /** 焦痕 decal（同一格再被炸就重新計時） */
  scorchAt(key: number, x: number, z: number, now: number): void {
    this.scorchBorn.set(key, { x, z, born: now, yaw: (key * 2.399) % (Math.PI * 2) })
  }

  /** 木箱炸毀：6–8 塊木片拋射＋3 團奶白煙 */
  crateBurst(x: number, z: number): void {
    const now = performance.now()
    const n = 6 + Math.floor(fxRandom() * 3)
    for (let i = 0; i < n && this.chips.length < this.cap; i++) {
      const a = fxRandom() * Math.PI * 2
      const sp = 2 + fxRandom() * 2.5
      const chip: Chip = {
        group: this.chipGroups[i % this.chipGroups.length],
        key: this.chipSeq++,
        x: x + Math.cos(a) * 0.3,
        y: 0.6 + fxRandom() * 0.6,
        z: z + Math.sin(a) * 0.3,
        vx: Math.cos(a) * sp,
        vy: 5 + fxRandom() * 3,
        vz: Math.sin(a) * sp,
        yaw: fxRandom() * Math.PI * 2,
        pitch: fxRandom() * Math.PI,
        spin: (fxRandom() * 2 - 1) * 14,
        born: now,
      }
      this.chips.push(chip)
    }
    this.smokeFx.emit(x, 0.5, z, 0.45, 3, STYLE.crateSmoke)
  }

  /** 硬磚受損：幾顆金屬火花 */
  metalSparks(x: number, z: number): void {
    this.sparkFx.emit(x, 0.9, z, 0.35, 10, STYLE.metal)
  }

  /** 拾取：道具位置噴金色星星 */
  itemSparkle(x: number, y: number, z: number): void {
    this.starFx.emit(x, y, z, 0.25, 12, STYLE.sparkle)
  }

  /** 拾取：頭頂飄出「+1」 */
  plusOne(x: number, y: number, z: number): void {
    const p = this.take(this.floats)
    p.start = performance.now()
    p.dur = FLOAT_MS
    p.x = x
    p.y = y
    p.z = z
    p.mesh.position.set(x, y, z)
    p.mat.alpha = 1
    p.mesh.setEnabled(true)
  }

  /** 陣亡：一團白煙＋頭盔色的星星 */
  death(x: number, y: number, z: number, helmetHex: string): void {
    this.smokeFx.emit(x, y, z, 0.4, 14, STYLE.deathSmoke)
    this.starFx.emit(x, y + 0.4, z, 0.3, 12, deathStars(helmetHex))
  }

  /** 突然死亡落牆落地：灰塵環＋往外噴的塵土 */
  dust(x: number, z: number): void {
    this.ring(x, z, DUST, 380, this.cell * 2.2)
    this.smokeFx.emit(x, 0.15, z, this.cell * 0.4, 16, STYLE.dust)
  }

  private ring(x: number, z: number, hex: string, durMs: number, size: number): void {
    const p = this.take(this.rings)
    p.start = performance.now()
    p.dur = Math.max(1, durMs)
    p.x = x
    p.y = 0.04
    p.z = z
    p.size = size
    p.mat.emissiveColor = Color3.FromHexString(hex)
    p.mesh.position.set(x, 0.04, z)
    p.mesh.scaling.setAll(0.01)
    p.mesh.setEnabled(true)
  }

  // ---- 每幀 ----

  /** 木片：重力拋射、落地彈一下、最後 150ms 縮小 */
  private updateChips(now: number, dt: number): void {
    for (const g of this.chipGroups) g.clear()
    this.chips = this.chips.filter((c) => {
      const age = now - c.born
      if (age >= CHIP_MS) return false
      c.vy += CHIP_GRAVITY * dt
      c.x += c.vx * dt
      c.y += c.vy * dt
      c.z += c.vz * dt
      if (c.y < 0.06) {
        c.y = 0.06
        c.vy = Math.abs(c.vy) * 0.3
        c.vx *= 0.55
        c.vz *= 0.55
        c.spin *= 0.5
      }
      c.yaw += c.spin * dt
      c.pitch += c.spin * 0.7 * dt
      const k = Math.min(1, (CHIP_MS - age) / 150)
      c.group.put(c.key, { x: c.x, y: c.y, z: c.z, yaw: c.yaw, pitch: c.pitch, sx: k, sy: k, sz: k })
      return true
    })
    for (const g of this.chipGroups) g.sync()
  }

  update(now: number, dtMs: number): void {
    const dt = Math.min(dtMs, 50) / 1000
    if (this.chips.length > 0 || this.chipGroups.some((g) => g.count > 0)) this.updateChips(now, dt)

    // 焦痕
    for (const [key, s] of this.scorchBorn) {
      const k = scorchScale(now - s.born, SCORCH_MS)
      if (k <= 0) {
        this.scorchBorn.delete(key)
        this.scorch.remove(key)
        continue
      }
      this.scorch.put(key, { x: s.x, y: 0, z: s.z, yaw: s.yaw, sx: k, sy: 1, sz: k })
    }
    this.scorch.sync()

    for (const p of this.rings) {
      if (!p.mesh.isEnabled()) continue
      const t = (now - p.start) / p.dur
      if (t >= 1) {
        p.mesh.setEnabled(false)
        continue
      }
      const r = ringPose(t)
      p.mesh.scaling.set(r.scale * p.size, 1, r.scale * p.size)
      p.mat.alpha = r.alpha
    }
    for (const p of this.floats) {
      if (!p.mesh.isEnabled()) continue
      const t = (now - p.start) / p.dur
      if (t >= 1) {
        p.mesh.setEnabled(false)
        continue
      }
      const f = floatTextPose(t)
      p.mesh.position.set(p.x, p.y + f.rise, p.z)
      p.mat.alpha = f.alpha
    }
  }

  /** 新回合：清掉殘留的焦痕、木片、ring、飄字與粒子 */
  clearRound(): void {
    this.chips = []
    for (const g of this.chipGroups) {
      g.clear()
      g.sync()
    }
    this.scorchBorn.clear()
    this.scorch.clear()
    this.scorch.sync()
    for (const p of [...this.rings, ...this.floats]) p.mesh.setEnabled(false)
    for (const e of this.emitters) e.clear()
    this.fuseAcc.clear()
    this.fuseSeen.clear()
  }

  dispose(): void {
    for (const e of this.emitters) e.dispose()
    this.emitters.length = 0
    for (const g of this.chipGroups) g.dispose()
    this.scorch.dispose()
    for (const p of [...this.rings, ...this.floats]) p.mesh.dispose()
    for (const m of this.mats) m.dispose()
    for (const t of this.textures) t.dispose()
    this.mats.length = 0
    this.textures.length = 0
    this.chips = []
    this.scorchBorn.clear()
  }
}
