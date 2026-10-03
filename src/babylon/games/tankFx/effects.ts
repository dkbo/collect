/**
 * 坦克特效（spec §8，AC7）：只管畫，什麼時候觸發由 tank.ts 決定，時間曲線在 fxModel.ts。
 *
 * - 粒子：fx_spark／fx_smoke／fx_circle／fx_star 共 4 組 ParticleSystem（上限＝檔位 particleCap），
 *   同一幀在很多位置噴時排進 BurstQueue（fx/emitter）。
 * - 碎片與木板共用 1 組 thin instance（實例色，見 chips.ts），焦痕、履帶痕各 1 組 thin instance；色票與粒子樣式在 effectsStyle.ts。
 * - 砲口焰、地面／牆面 ring、火球、拾取光柱、浮字、連殺字卡：小物件池，平常收起來不畫。
 * - 護盾泡泡與三連發光環每台各一份，材質共用（makeShield／makeAura）。
 */
import {
  Color3,
  FresnelParameters,
  Mesh,
  MeshBuilder,
  ParticleSystem,
  StandardMaterial,
  Texture,
  type DynamicTexture,
  type Scene,
} from '@/babylon/babylonCore'
import { emitCount, ringPose } from '@/babylon/fx/curves'
import { FxEmitter, fxRandom, style } from '@/babylon/fx/emitter'
import { mergeData } from '@/babylon/fx/geometry'
import type { ToyLook } from '@/babylon/fx/look'
import { at, rgba, solid, sphere, toMesh } from '@/babylon/fx/models'
import { ThinGroup } from '@/babylon/fx/thin'
import { bomberAssetUrl, createRingTexture } from '@/babylon/games/bomberFx/textures'
import {
  CARD_CELL_FROM,
  FLOAT_TEXTS,
  beamPose,
  cardPose,
  distanceSteps,
  fireballPose,
  floatCellUV,
  floatLabelIndex,
  muzzlePose,
} from '@/babylon/games/tankFx/fxModel'
import {
  bounceSparkStyle,
  cached,
  FLASH,
  FLASH_C,
  muzzleSparkStyle,
  STYLE,
  WOOD,
} from '@/babylon/games/tankFx/effectsStyle'
import { cardQuads, setCardLook, setQuadUV } from '@/babylon/games/tankFx/effectsMesh'
import { ChipField } from '@/babylon/games/tankFx/chips'
import { groundQuadData } from '@/babylon/games/tankFx/models'
import { OUTLINE, TANK } from '@/babylon/games/tankFx/palette'
import { createBeamTexture, createFloatAtlas, createScorchTexture } from '@/babylon/games/tankFx/textures'


// ---- 池化小物件 ----

interface Pooled {
  mesh: Mesh
  mat: StandardMaterial
  start: number
  x: number
  y: number
  z: number
  size: number
  /** ring 的播放時長 */
  dur: number
  /** 字卡跟著擊殺者 */
  follow?: () => { x: number; z: number } | null
}

interface Mark {
  x: number
  z: number
  yaw: number
  born: number
}

/** 碎片／木板拋射 */
const DEBRIS_MS = 900
const PLANK_MS = 600
/** 焦痕留到回合結束（池 4，滿了換最舊） */
const SCORCH_POOL = 4
const SCORCH_SIZE = 3
/** 履帶痕：每 0.42 一筆（左右各一）、2.5 秒淡出（最後 0.6 秒縮小代替淡出） */
const TREAD_SPACING = 0.42
const TREAD_MS = 2500
const TREAD_SHRINK_MS = 600
const TRACK_X = 0.53
/** 揚塵每 0.5 單位 2 顆（加速 buff ×2） */
const DUST_SPACING = 0.5
/** 子彈拖尾每秒 40 顆 */
const TRAIL_RATE = 40
const RING_POOL = 6
/** ring 時長：反彈 160ms（spec §8 #3）、道具出現 300ms、落牆落地 380ms */
const BOUNCE_RING_MS = 160
const ITEM_RING_MS = 300
const LAND_RING_MS = 380
const MUZZLE_POOL = 4
const FIREBALL_POOL = 2
const BEAM_POOL = 4
const FLOAT_POOL = 4
const FLOAT_MS = 700
const CARD_POOL = 2
const CARD_Y = 2.4
export interface TankFxOptions {
  /** 每組粒子上限（檔位 particleCap） */
  cap: number
  /** 履帶痕池（桌機 120、手機 60） */
  treadCap: number
}

export class TankFx {
  private readonly scene: Scene
  private readonly look: ToyLook
  private readonly textures: (Texture | DynamicTexture)[] = []
  private readonly mats: StandardMaterial[] = []
  private readonly meshes: Mesh[] = []
  private readonly emitters: FxEmitter[] = []
  private readonly spark: FxEmitter
  private readonly smoke: FxEmitter
  private readonly circle: FxEmitter
  private readonly star: FxEmitter
  private readonly starTex: Texture
  private readonly ringTex: DynamicTexture
  private readonly treadCap: number

  private readonly muzzles: Pooled[] = []
  private readonly rings: Pooled[] = []
  private readonly fireballs: Pooled[] = []
  private readonly beams: Pooled[] = []
  private readonly floats: Pooled[] = []
  private readonly cards: Pooled[] = []

  private readonly chips: ChipField

  private readonly scorch: ThinGroup<number>
  private scorchSeq = 0
  private readonly scorchKeys: number[] = []

  private readonly treads: ThinGroup<number>
  private marks: Mark[] = []
  private readonly moveAcc = new Map<string, { tread: number; dust: number }>()

  private readonly trailAcc = new Map<string, number>()
  private readonly trailSeen = new Set<string>()
  private landings: { x: number; z: number; at: number }[] = []

  private readonly shieldMat: StandardMaterial
  private readonly auraRingMat: StandardMaterial
  private readonly auraOrbMat: StandardMaterial

  constructor(scene: Scene, look: ToyLook, opts: TankFxOptions) {
    this.scene = scene
    this.look = look
    this.treadCap = opts.treadCap
    const tex = (file: string): Texture => {
      const t = new Texture(bomberAssetUrl(file), scene)
      this.textures.push(t)
      return t
    }
    const sparkTex = tex('fx_spark.webp')
    this.starTex = tex('fx_star.webp')
    const smokeTex = tex('fx_smoke.webp')
    const circleTex = tex('fx_circle.webp')
    const add = ParticleSystem.BLENDMODE_ADD
    const std = ParticleSystem.BLENDMODE_STANDARD
    const mk = (name: string, t: Texture, blend: number, gravity: number): FxEmitter => {
      const e = new FxEmitter(scene, name, t, opts.cap, blend, gravity)
      this.emitters.push(e)
      return e
    }
    this.spark = mk('tank-fx-spark', sparkTex, add, -7)
    this.smoke = mk('tank-fx-smoke', smokeTex, std, 0.6)
    this.circle = mk('tank-fx-circle', circleTex, add, 0)
    this.star = mk('tank-fx-star', this.starTex, add, -2)

    this.ringTex = createRingTexture(scene, 'tank-ring-tex')
    this.textures.push(this.ringTex)

    // 砲口焰：billboard 星芒（alpha test 才能進 Glow；淡出改用縮小與變暗）
    for (let i = 0; i < MUZZLE_POOL; i++) {
      const mesh = MeshBuilder.CreatePlane(`tank-muzzle-${i}`, { size: 0.9 }, scene)
      mesh.billboardMode = Mesh.BILLBOARDMODE_ALL
      const mat = this.mat(`tank-muzzle-mat-${i}`, (m) => {
        m.diffuseTexture = this.starTex
        m.diffuseColor = Color3.Black()
        m.disableLighting = true
        m.transparencyMode = StandardMaterial.MATERIAL_ALPHATEST
        m.alphaCutOff = 0.3
        m.backFaceCulling = false
      })
      this.muzzles.push(this.pooled(mesh, mat))
    }
    this.starTex.hasAlpha = true

    // 地面／牆面 ring（道具出現、落牆落地、反彈）
    for (let i = 0; i < RING_POOL; i++) {
      const mesh = MeshBuilder.CreatePlane(`tank-ring-${i}`, { size: 1 }, scene)
      const mat = this.mat(`tank-ring-mat-${i}`, (m) => {
        m.diffuseTexture = this.ringTex
        m.useAlphaFromDiffuseTexture = true
        m.disableLighting = true
        m.emissiveColor = Color3.White()
        m.backFaceCulling = false
        m.zOffset = -3
      })
      this.rings.push(this.pooled(mesh, mat))
    }

    // 爆炸火球
    for (let i = 0; i < FIREBALL_POOL; i++) {
      const mesh = MeshBuilder.CreateSphere(`tank-fireball-${i}`, { diameter: 1, segments: 16 }, scene)
      const mat = this.mat(`tank-fireball-mat-${i}`, (m) => {
        m.disableLighting = true
        m.diffuseColor = Color3.Black()
      })
      this.fireballs.push(this.pooled(mesh, mat))
    }

    // 拾取光柱：開口圓柱、底部不透明往上淡
    const beamTex = createBeamTexture(scene)
    this.textures.push(beamTex)
    for (let i = 0; i < BEAM_POOL; i++) {
      const mesh = MeshBuilder.CreateCylinder(`tank-beam-${i}`, { height: 3, diameter: 0.9, tessellation: 20, cap: Mesh.NO_CAP }, scene)
      const mat = this.mat(`tank-beam-mat-${i}`, (m) => {
        m.diffuseTexture = beamTex
        m.useAlphaFromDiffuseTexture = true
        m.disableLighting = true
        m.diffuseColor = Color3.Black()
        m.backFaceCulling = false
      })
      this.beams.push(this.pooled(mesh, mat))
    }

    // 浮字與連殺字卡：共用一張圖集，各 plane 只改 UV（不新建貼圖）
    const atlas = createFloatAtlas(scene, FLOAT_TEXTS, CARD_CELL_FROM)
    this.textures.push(atlas)
    const floatMat = this.mat('tank-float-mat', (m) => {
      m.diffuseTexture = atlas
      m.useAlphaFromDiffuseTexture = true
      m.disableLighting = true
      m.emissiveColor = Color3.White()
      m.diffuseColor = Color3.Black()
      m.backFaceCulling = false
    })
    for (let i = 0; i < FLOAT_POOL; i++) {
      const mesh = MeshBuilder.CreatePlane(`tank-float-${i}`, { width: 1.8, height: 0.9, updatable: true }, scene)
      mesh.billboardMode = Mesh.BILLBOARDMODE_ALL
      this.floats.push(this.pooled(mesh, floatMat))
    }
    const cardMat = this.mat('tank-card-mat', (m) => {
      m.diffuseTexture = atlas
      m.useAlphaFromDiffuseTexture = true
      m.disableLighting = true
      m.emissiveColor = Color3.White()
      m.diffuseColor = Color3.Black()
      m.backFaceCulling = false
    })
    for (let i = 0; i < CARD_POOL; i++) {
      const mesh = toMesh(`tank-card-${i}`, cardQuads(), scene, true)
      mesh.billboardMode = Mesh.BILLBOARDMODE_ALL
      mesh.useVertexColors = true
      this.cards.push(this.pooled(mesh, cardMat))
    }

    // 碎片＋木板：1 組 thin instance，顏色走實例色
    const chipMat = this.mat('tank-chip-mat', (m) => {
      m.diffuseColor = Color3.White()
    })
    look.toon(chipMat)
    this.chips = new ChipField(scene, chipMat)

    // 焦痕
    const scorchTex = createScorchTexture(scene)
    this.textures.push(scorchTex)
    const scorchMat = this.mat('tank-scorch-mat', (m) => {
      m.diffuseTexture = scorchTex
      m.useAlphaFromDiffuseTexture = true
      m.disableLighting = true
      m.emissiveColor = Color3.White()
      m.diffuseColor = Color3.Black()
      m.zOffset = -2
    })
    const scorchMesh = toMesh('tank-scorch', groundQuadData(SCORCH_SIZE, 0.015), scene)
    scorchMesh.material = scorchMat
    scorchMesh.isPickable = false
    this.scorch = new ThinGroup<number>(scorchMesh, SCORCH_POOL)

    // 履帶痕：深紫 30% 小平面，環狀佇列
    const treadMat = this.mat('tank-tread-mat', (m) => {
      m.disableLighting = true
      m.diffuseColor = Color3.Black()
      m.emissiveColor = Color3.FromHexString(OUTLINE)
      m.alpha = 0.3
      m.zOffset = -1
    })
    const treadQuad = groundQuadData(1, 0.008)
    const treadMesh = toMesh('tank-treads', { ...treadQuad, positions: treadQuad.positions.map((v, i) => (i % 3 === 0 ? v * 0.24 : i % 3 === 2 ? v * 0.16 : v)) }, scene)
    treadMesh.material = treadMat
    treadMesh.isPickable = false
    this.treads = new ThinGroup<number>(treadMesh, opts.treadCap)

    // 護盾泡泡（spec §6）：shieldFill alpha 0.22，邊緣以 emissive fresnel 亮成 shield 色；不受光、不進 Glow
    this.shieldMat = this.mat('tank-shield-mat', (m) => {
      m.disableLighting = true
      m.diffuseColor = Color3.Black()
      m.emissiveColor = Color3.FromHexString(TANK.shieldFill)
      m.emissiveFresnelParameters = new FresnelParameters({
        leftColor: Color3.FromHexString(TANK.shield).scale(1.6),
        rightColor: Color3.FromHexString(TANK.shieldFill),
        power: 2.5,
        bias: 0.05,
      })
      m.alpha = 0.22
    })
    // 三連發光環：地上轉圈的環＋3 顆繞行小球（spec §6）
    this.auraRingMat = this.mat('tank-aura-ring-mat', (m) => {
      m.diffuseTexture = this.ringTex
      m.useAlphaFromDiffuseTexture = true
      m.disableLighting = true
      m.diffuseColor = Color3.Black()
      m.emissiveColor = Color3.FromHexString(TANK.triple)
      m.alpha = 0.55
      m.zOffset = -2
    })
    this.auraOrbMat = this.mat('tank-aura-orb-mat', (m) => {
      m.disableLighting = true
      m.diffuseColor = Color3.Black()
      m.emissiveColor = Color3.FromHexString('#D9BFFF')
    })
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
    this.meshes.push(mesh)
    return { mesh, mat, start: 0, x: 0, y: 0, z: 0, size: 1, dur: 1 }
  }

  /** 取池中閒置的一個，沒有就換最舊的 */
  private take(pool: Pooled[]): Pooled {
    const idle = pool.find((p) => !p.mesh.isEnabled())
    return idle ?? pool.reduce((a, b) => (a.start <= b.start ? a : b))
  }

  private launch(pool: Pooled[], x: number, y: number, z: number, now: number, size = 1, dur = 1): Pooled {
    const p = this.take(pool)
    p.start = now
    p.dur = dur
    p.x = x
    p.y = y
    p.z = z
    p.size = size
    p.follow = undefined
    p.mesh.position.set(x, y, z)
    p.mesh.setEnabled(true)
    return p
  }

  // ---- 每台坦克的附件 ----

  /** 護盾泡泡 d 2.1、中心 y 0.6（平常收起） */
  makeShield(id: string, parent: Mesh): Mesh {
    const m = MeshBuilder.CreateSphere(`tank-shield-${id}`, { diameter: 2.1, segments: 24 }, this.scene)
    m.material = this.shieldMat
    m.parent = parent
    m.position.y = 0.6
    m.isPickable = false
    m.setEnabled(false)
    return m
  }

  /** 三連發光環：root 底下一片地面環＋3 顆繞行小球（同一 mesh），root 轉就一起轉 */
  makeAura(id: string, parent: Mesh): Mesh {
    const root = new Mesh(`tank-aura-${id}`, this.scene)
    root.parent = parent
    const ring = toMesh(`tank-aura-ring-${id}`, groundQuadData(2.1, 0.03), this.scene)
    ring.material = this.auraRingMat
    ring.parent = root
    const orbs: ReturnType<typeof sphere>[] = []
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2
      orbs.push(at(solid(sphere(0.12, 8), rgba('#FFFFFF')), { x: Math.sin(a) * 1.0, y: 0.3, z: Math.cos(a) * 1.0 }))
    }
    const orb = toMesh(`tank-aura-orbs-${id}`, mergeData(orbs), this.scene)
    orb.material = this.auraOrbMat
    orb.parent = root
    for (const m of [ring, orb]) m.isPickable = false
    root.setEnabled(false)
    return root
  }

  // ---- 觸發 ----

  /** #1 砲口焰：星芒 90ms＋6 顆火花沿砲管方向 ±25° */
  muzzle(x: number, y: number, z: number, dx: number, dz: number, now: number): void {
    this.launch(this.muzzles, x, y, z, now)
    this.spark.emit(x, y, z, 0.05, 6, muzzleSparkStyle(dx, dz))
  }

  /** #2 子彈拖尾：每顆子彈每幀呼叫一次（色是發射者 light→base，反彈後白→紅） */
  trail(id: string, x: number, y: number, z: number, light: string, base: string, bounced: boolean, dtMs: number): void {
    this.trailSeen.add(id)
    const r = emitCount(this.trailAcc.get(id) ?? fxRandom(), TRAIL_RATE, dtMs)
    this.trailAcc.set(id, r.acc)
    if (r.count <= 0) return
    const s = bounced
      ? STYLE.bounceTrail
      : cached(`trail-${light}`, () => style(light, base, base, { size: [0.16, 0.22], life: [0.18, 0.26], power: [0.02, 0.06], dir: 'up' }))
    this.circle.emit(x, y, z, 0.03, r.count, s)
  }

  /** 每幀子彈跑完後呼叫：清掉這幀沒出現的子彈的累積量 */
  endTrailFrame(): void {
    for (const id of this.trailAcc.keys()) if (!this.trailSeen.has(id)) this.trailAcc.delete(id)
    this.trailSeen.clear()
  }

  /** #3 反彈火花：往反射後那半球 10 顆＋星芒＋牆面白環（面向撞擊面法線） */
  bounce(x: number, z: number, vx: number, vz: number, nx: number, nz: number, now: number): void {
    const len = Math.hypot(vx, vz) || 1
    this.spark.emit(x, 0.4, z, 0.04, 10, bounceSparkStyle(vx / len, vz / len))
    this.star.emit(x, 0.4, z, 0, 1, STYLE.bounceStar)
    const p = this.launch(this.rings, x, 0.45, z, now, 0.8, BOUNCE_RING_MS)
    p.mesh.rotation.set(0, Math.atan2(nx, nz), 0)
  }

  /** #4 命中火花：14 顆被打者 light→白＋星芒 0.8 */
  hit(x: number, z: number, light: string): void {
    const s = cached(`hit-${light}`, () => style(light, '#FFFFFF', light, { size: [0.12, 0.24], life: [0.12, 0.22], power: [3, 6], dir: 'burst' }))
    this.spark.emit(x, 0.6, z, 0.2, 14, s)
    this.star.emit(x, 0.7, z, 0, 1, STYLE.hitStar)
  }

  /** #8 護盾碎裂：12 片 fx_circle 往外射 */
  shieldShatter(x: number, z: number): void {
    this.circle.emit(x, 0.6, z, 0.6, 12, STYLE.shard)
  }

  /** #10 爆炸：閃光＋火花、火球、煙、6 塊碎片（玩家色與履帶色交錯）、焦痕 */
  explode(x: number, z: number, base: string, now: number): void {
    this.star.emit(x, 0.8, z, 0, 1, STYLE.boomStar)
    this.spark.emit(x, 0.6, z, 0.3, 24, STYLE.boomSpark)
    this.smoke.emit(x, 0.6, z, 0.4, 10, STYLE.boomSmoke)
    this.launch(this.fireballs, x, 0.8, z, now, 2.2)
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + fxRandom() * 0.6
      const sp = 2.5 + fxRandom() * 3
      this.chips.add({
        x: x + Math.cos(a) * 0.3,
        y: 0.5,
        z: z + Math.sin(a) * 0.3,
        vx: Math.cos(a) * sp,
        vy: 5 + fxRandom() * 3,
        vz: Math.sin(a) * sp,
        sx: 0.9,
        sy: 0.7,
        sz: 0.9,
        hex: i % 2 === 0 ? base : TANK.trackSide,
        life: DEBRIS_MS,
        now,
      })
    }
    const key = this.scorchSeq++
    this.scorchKeys.push(key)
    if (this.scorchKeys.length > SCORCH_POOL) this.scorch.remove(this.scorchKeys.shift()!)
    this.scorch.put(key, { x, y: 0, z, yaw: fxRandom() * Math.PI * 2 })
  }

  /** #12 木箱碎裂：6–8 片木板＋3 團奶白煙 */
  crateBurst(x: number, z: number, now: number): void {
    const n = 6 + Math.floor(fxRandom() * 3)
    for (let i = 0; i < n; i++) {
      const a = fxRandom() * Math.PI * 2
      const sp = 2 + fxRandom() * 2.5
      this.chips.add({
        x: x + Math.cos(a) * 0.3,
        y: 0.6 + fxRandom() * 0.6,
        z: z + Math.sin(a) * 0.3,
        vx: Math.cos(a) * sp,
        vy: 5 + fxRandom() * 3,
        vz: Math.sin(a) * sp,
        sx: 1.15,
        sy: 0.4,
        sz: 0.75,
        hex: WOOD[i % WOOD.length],
        life: PLANK_MS,
        now,
      })
    }
    this.smoke.emit(x, 0.5, z, 0.45, 3, STYLE.crateSmoke)
  }

  /** #13 道具出現：地上一圈白環（彈跳本身在 board） */
  itemAppear(x: number, z: number, now: number): void {
    const p = this.launch(this.rings, x, 0.04, z, now, 2.5, ITEM_RING_MS)
    p.mesh.rotation.set(Math.PI / 2, 0, 0)
  }

  /** #14 拾取：道具色光柱＋8 顆星往上＋頭上浮字 */
  pickup(kind: string, ix: number, iz: number, wx: number, wz: number, shell: string, now: number): void {
    const b = this.launch(this.beams, ix, 0, iz, now)
    b.mat.emissiveColor = Color3.FromHexString(shell)
    const s = cached(`pick-${shell}`, () => style('#FFFFFF', shell, shell, { size: [0.22, 0.4], life: [0.35, 0.5], power: [2, 3.5], dir: 'up' }))
    this.star.emit(ix, 0.6, iz, 0.35, 8, s)
    const idx = floatLabelIndex(kind)
    if (idx < 0) return
    const f = this.launch(this.floats, wx, 2.0, wz, now)
    setQuadUV(f.mesh, floatCellUV(idx))
  }

  /** #15 落牆：board 落下 dropMs 後落地，這時才噴塵＋白環 d 2.6 */
  wallDrop(x: number, z: number, now: number, dropMs: number): void {
    this.landings.push({ x, z, at: now + dropMs })
  }

  /** #16 連殺字卡：擊殺者頭上彈出（跟著擊殺者），兩顆星芒 */
  streakCard(label: '雙殺' | '三殺', base: string, follow: () => { x: number; z: number } | null, now: number): void {
    const pos = follow()
    if (!pos) return
    const c = this.launch(this.cards, pos.x, CARD_Y, pos.z, now)
    c.follow = follow
    setCardLook(c.mesh, floatCellUV(floatLabelIndex(label)), base)
    const s = cached(`card-${base}`, () => style('#FFFFFF', base, base, { size: [0.35, 0.55], life: [0.4, 0.6], power: [2, 3], dir: 'fountain' }))
    this.star.emit(pos.x, CARD_Y, pos.z, 0.5, 2, s)
  }

  /** #11 履帶痕＋揚塵：每台每幀呼叫一次（dist 為這幀位移） */
  move(id: string, x: number, z: number, yaw: number, dist: number, boosted: boolean, now: number): void {
    let acc = this.moveAcc.get(id)
    if (!acc) this.moveAcc.set(id, (acc = { tread: 0, dust: 0 }))
    const t = distanceSteps(acc.tread, dist, TREAD_SPACING)
    acc.tread = t.acc
    const cos = Math.cos(yaw)
    const sin = Math.sin(yaw)
    for (let i = 0; i < t.count; i++) {
      for (const side of [-1, 1]) {
        // 車身局部 (±TRACK_X, 0, -0.5)：車尾兩條履帶下方
        const lx = side * TRACK_X
        const lz = -0.5
        this.addMark(x + lx * cos + lz * sin, z - lx * sin + lz * cos, yaw, now)
      }
    }
    const d = distanceSteps(acc.dust, dist, DUST_SPACING)
    acc.dust = d.acc
    if (d.count > 0) {
      const rx = x - sin * 0.7
      const rz = z - cos * 0.7
      this.smoke.emit(rx, 0.1, rz, 0.25, d.count * (boosted ? 4 : 2), boosted ? STYLE.boostDust : STYLE.dust)
    }
  }

  private addMark(x: number, z: number, yaw: number, now: number): void {
    this.marks.push({ x, z, yaw, born: now })
    if (this.marks.length > this.treadCap) this.marks.shift()
  }

  // ---- 每幀 ----

  update(now: number, dtMs: number): void {
    const dt = Math.min(dtMs, 50) / 1000
    this.chips.update(now, dt)
    this.updateMarks(now)
    this.scorch.sync()

    for (const l of this.landings) {
      if (l.at > now) continue
      this.smoke.emit(l.x, 0.15, l.z, 0.8, 8, STYLE.landDust)
      const p = this.launch(this.rings, l.x, 0.04, l.z, now, 2.6, LAND_RING_MS)
      p.mesh.rotation.set(Math.PI / 2, 0, 0)
    }
    this.landings = this.landings.filter((l) => l.at > now)

    for (const p of this.muzzles) {
      if (!p.mesh.isEnabled()) continue
      const m = muzzlePose(now - p.start)
      if (!m) {
        p.mesh.setEnabled(false)
        this.look.setGlow(p.mesh, FLASH[1], 0)
        continue
      }
      p.mesh.scaling.setAll(m.scale * (0.6 + 0.4 * m.alpha))
      FLASH_C[m.alpha > 0.7 ? 0 : 1].scaleToRef(0.4 + 0.6 * m.alpha, p.mat.emissiveColor)
      this.look.setGlow(p.mesh, FLASH[2], 0.9 * m.alpha)
    }

    for (const p of this.rings) {
      if (!p.mesh.isEnabled()) continue
      const t = (now - p.start) / p.dur
      if (t >= 1) {
        p.mesh.setEnabled(false)
        continue
      }
      const r = ringPose(t)
      p.mesh.scaling.set(r.scale * p.size, r.scale * p.size, 1)
      p.mat.alpha = r.alpha
    }

    for (const p of this.fireballs) {
      if (!p.mesh.isEnabled()) continue
      const f = fireballPose(now - p.start)
      if (!f) {
        p.mesh.setEnabled(false)
        continue
      }
      p.mesh.scaling.setAll(f.scale * p.size)
      p.mat.emissiveColor.copyFrom(FLASH_C[f.stage])
      p.mesh.visibility = f.alpha
    }

    for (const p of this.beams) {
      if (!p.mesh.isEnabled()) continue
      const b = beamPose(now - p.start)
      if (!b) {
        p.mesh.setEnabled(false)
        continue
      }
      p.mesh.scaling.set(1, Math.max(0.01, b.sy), 1)
      p.mesh.position.y = 1.5 * b.sy
      p.mesh.visibility = b.alpha
    }

    for (const p of this.floats) {
      if (!p.mesh.isEnabled()) continue
      const t = (now - p.start) / FLOAT_MS
      if (t >= 1) {
        p.mesh.setEnabled(false)
        continue
      }
      p.mesh.position.y = p.y + 0.9 * (1 - (1 - t) * (1 - t))
      p.mesh.visibility = t < 0.4 ? 1 : 1 - (t - 0.4) / 0.6
    }

    for (const p of this.cards) {
      if (!p.mesh.isEnabled()) continue
      const c = cardPose(now - p.start)
      if (!c) {
        p.mesh.setEnabled(false)
        continue
      }
      const pos = p.follow?.()
      if (pos) {
        p.x = pos.x
        p.z = pos.z
      }
      p.mesh.position.set(p.x, p.y + c.rise, p.z)
      p.mesh.scaling.setAll(Math.max(0.001, c.scale))
      p.mesh.visibility = c.alpha
    }
  }

  /** 履帶痕：2.5 秒後消失，最後 0.6 秒縮小代替淡出（thin instance 沒有逐筆 alpha） */
  private updateMarks(now: number): void {
    if (this.marks.length === 0 && this.treads.count === 0) return
    this.marks = this.marks.filter((m) => now - m.born < TREAD_MS)
    this.treads.clear()
    this.marks.forEach((m, i) => {
      const k = Math.min(1, (TREAD_MS - (now - m.born)) / TREAD_SHRINK_MS)
      this.treads.put(i, { x: m.x, y: 0, z: m.z, yaw: m.yaw, sx: k, sy: 1, sz: k })
    })
    this.treads.sync()
  }

  /** 新回合：清掉焦痕、碎片、履帶痕、粒子與所有池中物件 */
  clearRound(): void {
    this.chips.clear()
    this.scorch.clear()
    this.scorchKeys.length = 0
    this.scorch.sync()
    this.marks = []
    this.treads.clear()
    this.treads.sync()
    this.landings = []
    this.moveAcc.clear()
    this.trailAcc.clear()
    this.trailSeen.clear()
    for (const p of [...this.muzzles, ...this.rings, ...this.fireballs, ...this.beams, ...this.floats, ...this.cards]) {
      p.mesh.setEnabled(false)
    }
    for (const p of this.muzzles) this.look.setGlow(p.mesh, FLASH[2], 0)
    for (const e of this.emitters) e.clear()
  }

  /** 拆掉某台的移動累積（離房） */
  forget(id: string): void {
    this.moveAcc.delete(id)
  }

  dispose(): void {
    for (const e of this.emitters) e.dispose()
    this.emitters.length = 0
    this.chips.dispose()
    this.scorch.dispose()
    this.treads.dispose()
    for (const m of this.meshes) m.dispose()
    this.meshes.length = 0
    for (const m of this.mats) m.dispose()
    for (const t of this.textures) t.dispose()
    this.mats.length = 0
    this.textures.length = 0
    this.marks = []
  }
}
