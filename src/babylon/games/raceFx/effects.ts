/**
 * 賽車特效（spec §6／§8，AC11）：只管畫，什麼時候觸發由 race.ts 決定，時間曲線在 fxModel.ts。
 *
 * - 粒子：fx_spark／fx_smoke／fx_circle／fx_star 共 4 組 ParticleSystem（每組上限＝檔位 particleCap：桌機 150、手機 60）。
 * - 胎痕、尾流風線、頭頂暈眩星各 1 組 thin instance；噴焰、地面白環、換圈字卡、加速菇是小物件池，平常收起來不畫。
 * - 速度線是 UI 相機上的一片全螢幕 plane（不經後製、不吃霧）。
 * - 道具箱碎塊、被踩香蕉、觀眾歡呼、加速帶閃光跟場景物件綁在一起，在 world.ts。
 */
import { Color3, Mesh, MeshBuilder, ParticleSystem, StandardMaterial, Texture, type DynamicTexture, type Scene } from '@/babylon/babylonCore'
import { emitCount, ringPose } from '@/babylon/fx/curves'
import { FxEmitter, fxRandom, style, type FxStyle } from '@/babylon/fx/emitter'
import type { MeshData } from '@/babylon/fx/geometry'
import { UI_LAYER, type ToyLook } from '@/babylon/fx/look'
import { toMesh } from '@/babylon/fx/models'
import { PLAYER_PALETTE } from '@/babylon/fx/palette'
import { createRingTexture } from '@/babylon/fx/textures'
import { ThinGroup } from '@/babylon/fx/thin'
import { distanceSteps } from '@/babylon/games/tankFx/fxModel'
import type { DriftTier } from '@/babylon/games/raceFx/raceNet'
import {
  DROP_MS,
  DUST_SPACING,
  FLAME,
  LAP_CARD_MS,
  SHIELD_BREAK_MS,
  SKID_SPACING,
  boostColor,
  driftSparkLook,
  SPARK_SIZE,
  sparkHot,
  finishConfetti,
  ghostVisibility,
  landSquash,
  lapCardPose,
  mushroomPose,
  respawnDropY,
  shieldPose,
  skidScale,
  spinPose,
} from '@/babylon/games/raceFx/fxModel'
import { mushroomData } from '@/babylon/games/raceFx/models'
import { RACE } from '@/babylon/games/raceFx/palette'
import { FLOAT_TEXTS, createFloatAtlas, createSpeedLineTexture, floatCellUV, fxAssetUrl, type FloatText } from '@/babylon/games/raceFx/textures'

/** 一台車這一幀的畫面狀態（自己、他車、bot 共用；他車的旗標來自 own 快照） */
export interface CarFxInput {
  id: string
  x: number
  /** 跳台高度（不含重生落下） */
  y: number
  z: number
  /** 移動方向 */
  ry: number
  /** 車身相對移動方向的偏航（甩尾） */
  yaw: number
  /** |速度|（他車用畫面位移估的） */
  speed: number
  drift: DriftTier
  /** 正在蓄甩尾（含 0 段） */
  drifting: boolean
  boost: boolean
  shield: boolean
  /** 護盾剩餘（只有自己與 host 的 bot 知道；其他 null） */
  shieldLeftMs: number | null
  offTrack: boolean
  airborne: boolean
  /** 急煞（只有自己知道） */
  braking: boolean
}

/** race.ts 套到車上的姿態修正 */
export interface CarFxPose {
  /** 重生落下（加在 root y） */
  dropY: number
  /** 打滑：額外偏航與龜殼彈起 */
  spinYaw: number
  lift: number
  /** 落地擠壓（visual 縮放） */
  sy: number
  sxz: number
  /** 重生閃爍 1／0.3 */
  visibility: number
  /** 護盾泡泡；null = 不畫 */
  shield: { scale: number; alpha: number } | null
}

export interface RaceFxOptions {
  /** 每組粒子上限（檔位 particleCap） */
  cap: number
  /** 胎痕池（桌機 160、手機 80） */
  skidCap: number
  /** 拱門橫樑兩端（衝線彩帶噴口） */
  confettiAt: readonly [number, number, number][]
  /** 重生閃爍時長（RESPAWN_GHOST_MS） */
  ghostMs: number
}

interface CarState {
  sparkAcc: number
  flameAcc: number
  dustAcc: number
  skidAcc: number
  px: number
  pz: number
  seen: boolean
  /** 最近一次非 0 的甩尾段位與時間（判斷加速是 mini-turbo 還是加速帶／菇） */
  lastTier: DriftTier
  lastTierAt: number
  boosting: boolean
  boostAt: number
  boostColor: Color3
  boostHex: string
  boostFlame: boolean
  flames: Pooled[]
  wasAir: boolean
  landAt: number
  shieldOn: boolean
  shieldOffAt: number
  brokeAt: number
  spinAt: number
  spinMs: number
  spinShell: boolean
  respawnAt: number
  mushAt: number
  mush: Mesh | null
}

interface Pooled {
  mesh: Mesh
  mat: StandardMaterial
  start: number
  x: number
  y: number
  z: number
  size: number
}

interface Skid {
  key: number
  x: number
  z: number
  yaw: number
  born: number
}

/** 噴焰 plane 池（每台 2 根排氣管 × 4 台） */
const FLAME_POOL = 8
const FLAME_POP_MS = 120
/** 排氣管（車身座標，spec §4.1） */
const EXHAUST = { x: 0.26, y: 0.34, z: -1.2 } as const
/** 後輪外下緣（火花、胎痕） */
const REAR = { x: 0.95, y: 0.08, z: -0.7 } as const
const RING_POOL = 4
const RING_Y = 0.06
const CARD_POOL = 2
const CARD_Y = 3.2
const MUSH_POOL = 4
const MUSH_Y = 2.0
const STAR_POOL = 12
const SLIP_LINES = 6
/** 加速 mini-turbo 判定：放開甩尾到加速開始之間的容許時間 */
const TURBO_WINDOW_MS = 250
const CONFETTI = [...PLAYER_PALETTE.map((p) => p.base), '#FFFFFF']
const SKID_COLOR = '#2B2440'
/** flame 三層預建（噴焰每幀換色不再 new Color3） */
const FLAME_C = FLAME.map((h) => Color3.FromHexString(h))
/** 揚塵／胎痕瞬移判定用的速度上限（BOOST_SPEED 22 再留餘裕） */
const MAX_STEP_SPEED = 24

/** 平貼地面的長條（x 寬 w、z 長 d，法線朝上） */
function flatStrip(w: number, d: number): MeshData {
  const x = w / 2
  const z = d / 2
  return {
    positions: [-x, 0, -z, x, 0, -z, x, 0, z, -x, 0, z],
    normals: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    uvs: [0, 0, 1, 0, 1, 1, 0, 1],
    indices: [0, 1, 2, 0, 2, 3],
  }
}

/** 車身座標 → 世界（只算偏航） */
function local(x: number, z: number, ry: number, lx: number, lz: number): [number, number] {
  const s = Math.sin(ry)
  const c = Math.cos(ry)
  return [x + lx * c + lz * s, z - lx * s + lz * c]
}

export class RaceFx {
  private readonly scene: Scene
  private readonly opts: RaceFxOptions
  private readonly textures: (Texture | DynamicTexture)[] = []
  private readonly mats: StandardMaterial[] = []
  private readonly meshes: Mesh[] = []
  private readonly emitters: FxEmitter[] = []
  private readonly spark: FxEmitter
  private readonly smoke: FxEmitter
  private readonly circle: FxEmitter
  private readonly star: FxEmitter
  private readonly starTex: Texture
  private readonly cars = new Map<string, CarState>()

  private readonly flamePool: Pooled[] = []
  private readonly rings: Pooled[] = []
  private readonly cards: (Pooled & { follow: string | null })[] = []
  private readonly mushPool: Mesh[] = []

  private readonly skids: ThinGroup<number>
  private skidList: Skid[] = []
  private skidSeq = 0
  private readonly slips: ThinGroup<number>
  private readonly slipMat: StandardMaterial
  private readonly heads: ThinGroup<string>
  private readonly speedPlane: Mesh
  private readonly speedMat: StandardMaterial
  private speedSpinAt = 0
  private readonly trailAcc = new Map<string, number>()

  constructor(scene: Scene, look: ToyLook, opts: RaceFxOptions) {
    this.scene = scene
    this.opts = opts
    const tex = (file: string): Texture => {
      const t = new Texture(fxAssetUrl(file), scene)
      t.hasAlpha = true
      this.textures.push(t)
      return t
    }
    this.starTex = tex('fx_star.webp')
    const add = ParticleSystem.BLENDMODE_ADD
    const std = ParticleSystem.BLENDMODE_STANDARD
    const mk = (name: string, t: Texture, blend: number, gravity: number): FxEmitter => {
      const e = new FxEmitter(scene, name, t, opts.cap, blend, gravity)
      this.emitters.push(e)
      return e
    }
    this.spark = mk('race-fx-spark', tex('fx_spark.webp'), add, -6)
    this.smoke = mk('race-fx-smoke', tex('fx_smoke.webp'), std, 0.6)
    this.circle = mk('race-fx-circle', tex('fx_circle.webp'), add, 0)
    // 星：衝線彩帶要往下掉（重力 −9）；其他星粒子壽命短，看不太出來
    this.star = mk('race-fx-star', this.starTex, add, -9)

    // 噴焰：billboard 拉長的星芒（色＝段位色或 flame），自發光、不進 Glow（spec §5）
    for (let i = 0; i < FLAME_POOL; i++) {
      const mesh = MeshBuilder.CreatePlane(`race-flame-${i}`, { width: 0.5, height: 0.9 }, scene)
      mesh.billboardMode = Mesh.BILLBOARDMODE_ALL
      const mat = this.mat(`race-flame-${i}`, (m) => {
        m.diffuseTexture = this.starTex
        m.useAlphaFromDiffuseTexture = true
        m.disableLighting = true
        m.backFaceCulling = false
      })
      this.flamePool.push(this.pooled(mesh, mat))
    }

    // 地面白環（撿箱、落地、重生）
    const ringTex = createRingTexture(scene, 'race-ring-tex')
    this.textures.push(ringTex)
    for (let i = 0; i < RING_POOL; i++) {
      const mesh = MeshBuilder.CreatePlane(`race-ring-${i}`, { size: 1 }, scene)
      mesh.rotation.x = Math.PI / 2
      const mat = this.mat(`race-ring-${i}`, (m) => {
        m.diffuseTexture = ringTex
        m.useAlphaFromDiffuseTexture = true
        m.emissiveColor = Color3.White()
        m.disableLighting = true
        m.zOffset = -2
      })
      this.rings.push(this.pooled(mesh, mat))
    }

    // 換圈／完賽浮字（spec §8 #14、§8.1）：字卡 plane 3.2×1.4 billboard，各自 UV 對到圖集一格
    const atlas = createFloatAtlas(scene)
    this.textures.push(atlas)
    for (let i = 0; i < CARD_POOL; i++) {
      const mesh = MeshBuilder.CreatePlane(`race-card-${i}`, { width: 3.2, height: 1.4, updatable: true }, scene)
      mesh.billboardMode = Mesh.BILLBOARDMODE_ALL
      const mat = this.mat(`race-card-${i}`, (m) => {
        m.diffuseTexture = atlas
        m.useAlphaFromDiffuseTexture = true
        m.emissiveColor = Color3.White()
        m.disableLighting = true
        m.backFaceCulling = false
        m.fogEnabled = false
      })
      this.cards.push({ ...this.pooled(mesh, mat), follow: null })
    }

    // 加速菇（spec §4.2）：車頂彈出、描邊
    const mushMat = this.mat('race-mushroom', (m) => {
      m.diffuseColor = Color3.White()
      m.specularColor = new Color3(0.06, 0.06, 0.06)
    })
    look.toon(mushMat)
    for (let i = 0; i < MUSH_POOL; i++) {
      const mesh = toMesh(`race-mushroom-${i}`, mushroomData(), scene)
      mesh.material = mushMat
      mesh.isPickable = false
      mesh.setEnabled(false)
      look.outline(mesh)
      this.meshes.push(mesh)
      this.mushPool.push(mesh)
    }

    // 胎痕（spec §8 #6）：深紫 25%
    this.skids = new ThinGroup<number>(toMesh('race-skids', flatStrip(0.22, 0.5), scene), opts.skidCap)
    this.skids.mesh.material = this.mat('race-skid', (m) => {
      m.emissiveColor = Color3.FromHexString(SKID_COLOR)
      m.diffuseColor = Color3.Black()
      m.disableLighting = true
      m.alpha = 0.25
      m.zOffset = -1
    })
    this.meshes.push(this.skids.mesh)

    // 尾流風線（spec §8 #3）：細長平面，alpha 依蓄積／生效
    this.slips = new ThinGroup<number>(toMesh('race-slips', flatStrip(0.06, 2.4), scene), SLIP_LINES)
    this.slipMat = this.mat('race-slip', (m) => {
      m.emissiveColor = Color3.FromHexString(RACE.slip)
      m.diffuseColor = Color3.Black()
      m.disableLighting = true
      m.backFaceCulling = false
    })
    this.slips.mesh.material = this.slipMat
    this.meshes.push(this.slips.mesh)

    // 打滑頭頂暈眩星（spec §6）：3 顆繞圈，面向相機
    const head = MeshBuilder.CreatePlane('race-head-stars', { size: 0.42 }, scene)
    head.material = this.mat('race-head-star', (m) => {
      m.diffuseTexture = this.starTex
      m.useAlphaFromDiffuseTexture = true
      m.emissiveColor = Color3.FromHexString(RACE.spark)
      m.disableLighting = true
      m.backFaceCulling = false
    })
    this.heads = new ThinGroup<string>(head, STAR_POOL)
    this.meshes.push(head)

    // 速度線（spec §8 #4）：UI 相機上一片全螢幕 plane（相機在原點看 +z）
    const speedTex = createSpeedLineTexture(scene)
    this.textures.push(speedTex)
    this.speedPlane = MeshBuilder.CreatePlane('race-speedlines', { size: 1 }, scene)
    this.speedPlane.layerMask = UI_LAYER
    this.speedPlane.isPickable = false
    this.speedMat = this.mat('race-speedlines', (m) => {
      m.diffuseTexture = speedTex
      m.useAlphaFromDiffuseTexture = true
      m.emissiveColor = Color3.White()
      m.disableLighting = true
      m.fogEnabled = false
      m.backFaceCulling = false
    })
    this.speedPlane.material = this.speedMat
    this.speedPlane.position.set(0, 0, 9)
    this.speedPlane.setEnabled(false)
    this.meshes.push(this.speedPlane)
  }

  private mat(name: string, init: (m: StandardMaterial) => void): StandardMaterial {
    const m = new StandardMaterial(name, this.scene)
    init(m)
    this.mats.push(m)
    return m
  }

  private pooled(mesh: Mesh, mat: StandardMaterial): Pooled {
    mesh.material = mat
    mesh.isPickable = false
    mesh.setEnabled(false)
    this.meshes.push(mesh)
    return { mesh, mat, start: -Infinity, x: 0, y: 0, z: 0, size: 1 }
  }

  private stateOf(id: string): CarState {
    let s = this.cars.get(id)
    if (!s) {
      s = {
        sparkAcc: 0,
        flameAcc: 0,
        dustAcc: 0,
        skidAcc: 0,
        px: 0,
        pz: 0,
        seen: false,
        lastTier: 0,
        lastTierAt: -Infinity,
        boosting: false,
        boostAt: -Infinity,
        boostColor: FLAME_C[1].clone(),
        boostHex: FLAME[1],
        boostFlame: true,
        flames: [],
        wasAir: false,
        landAt: -Infinity,
        shieldOn: false,
        shieldOffAt: -Infinity,
        brokeAt: -Infinity,
        spinAt: -Infinity,
        spinMs: 0,
        spinShell: false,
        respawnAt: -Infinity,
        mushAt: -Infinity,
        mush: null,
      }
      this.cars.set(id, s)
    }
    return s
  }

  /** 場上正在畫的數量（給 qa 判讀） */
  liveCounts(): { skids: number; flames: number; rings: number; particles: number } {
    return {
      skids: this.skidList.length,
      flames: this.flamePool.filter((f) => f.mesh.isEnabled()).length,
      rings: this.rings.filter((r) => r.mesh.isEnabled()).length,
      particles: this.emitters.reduce((n, e) => n + e.ps.getActiveCount(), 0),
    }
  }

  // ---- 每台車每幀 ----

  /** 連續特效（火花、噴焰、揚塵、胎痕、暈眩星、加速菇位置）並回傳姿態修正；hidden 的車只算姿態 */
  car(c: CarFxInput, now: number, dtMs: number, camX: number, camZ: number): CarFxPose {
    const s = this.stateOf(c.id)
    const moved = s.seen ? Math.hypot(c.x - s.px, c.z - s.pz) : 0
    const px0 = s.seen ? s.px : c.x
    const pz0 = s.seen ? s.pz : c.z
    s.px = c.x
    s.pz = c.z
    s.seen = true
    const ryT = c.ry + c.yaw
    // 揚塵／胎痕依移動距離出：單幀位移上限隨幀長放寬（低 fps 時一幀正常就超過 1.5，不能當成瞬移）
    const maxStep = Math.max(1.5, (MAX_STEP_SPEED * dtMs * 1.5) / 1000)
    const respawnMs = now - s.respawnAt
    const dropY = respawnDropY(respawnMs)
    const y = c.y + dropY

    // 打滑（§6）：ms 內轉 2 圈；龜殼命中另彈起
    const spin = spinPose(now - s.spinAt, s.spinMs, s.spinShell)
    const spinning = now - s.spinAt < s.spinMs

    // 落地（§8 #12）：騰空 → 著地
    if (s.wasAir && !c.airborne) {
      s.landAt = now
      this.ring(c.x, c.z, 2.6, now)
      this.smoke.emit(c.x, 0.15, c.z, 0.9, 8, DUST_RING)
    }
    s.wasAir = c.airborne
    const sq = landSquash(now - s.landAt)

    // 甩尾火花（§8 #1）：兩後輪外下緣往後外側噴
    if (c.drifting && !c.airborne && !spinning) {
      const look = driftSparkLook(c.drift)
      const r = emitCount(s.sparkAcc, look.rate, dtMs)
      s.sparkAcc = r.acc
      for (let i = 0; i < r.count; i++) {
        const side = i % 2 === 0 ? 1 : -1
        const [wx, wz] = local(c.x, c.z, ryT, REAR.x * side, REAR.z)
        const [ax, az] = local(0, 0, ryT, side * 0.55, -1)
        this.spark.emit(wx, y + REAR.y, wz, 0.05, 1, sparkStyle(c.drift, look.size, ax, az))
      }
    } else s.sparkAcc = 0
    if (c.drift > 0) {
      s.lastTier = c.drift
      s.lastTierAt = now
    }

    // 噴焰（§8 #2）：加速剛開始時決定色（mini-turbo 段位色或 flame 三層）
    if (c.boost && !s.boosting) {
      const prev: DriftTier = now - s.lastTierAt <= TURBO_WINDOW_MS ? s.lastTier : 0
      const bc = boostColor(prev)
      s.boostAt = now
      s.boostHex = bc.color
      s.boostColor.copyFrom(Color3.FromHexString(bc.color))
      s.boostFlame = bc.kind === 'flame'
      s.flames = this.takeFlames(2)
    }
    if (!c.boost && s.boosting) this.releaseFlames(s)
    s.boosting = c.boost
    if (c.boost) this.flames(c, s, y, ryT, now, dtMs)

    // 揚塵（§8 #5）：路面外且速度 > 3
    if (c.offTrack && !c.airborne && c.speed > 3) {
      const st = distanceSteps(s.dustAcc, moved, DUST_SPACING, maxStep)
      s.dustAcc = st.acc
      if (st.count > 0) {
        const [bx, bz] = local(c.x, c.z, ryT, 0, -1)
        this.smoke.emit(bx, 0.2, bz, 0.3, 2 * st.count, DUST)
      }
    }

    // 胎痕（§8 #6）：甩尾中或急煞
    if (!c.airborne && (c.drifting || (c.braking && c.speed > 8))) {
      const st = distanceSteps(s.skidAcc, moved, SKID_SPACING, maxStep)
      s.skidAcc = st.acc
      for (let i = 0; i < st.count; i++) {
        // 一幀出多筆時沿這一幀的路徑等距擺
        const k = (i + 1) / st.count
        const cx = px0 + (c.x - px0) * k
        const cz = pz0 + (c.z - pz0) * k
        for (const side of [1, -1]) {
          const [wx, wz] = local(cx, cz, ryT, REAR.x * 0.86 * side, REAR.z)
          this.addSkid(wx, wz, ryT, now)
        }
      }
    }

    // 暈眩星（§6）：頭上 3 顆繞圈（y 2.0、半徑 0.5、2 圈/秒）
    for (let i = 0; i < 3; i++) {
      const key = `${c.id}:${i}`
      if (!spinning) {
        this.heads.remove(key)
        continue
      }
      const a = (now / 1000) * Math.PI * 4 + (i * Math.PI * 2) / 3
      const sx = c.x + Math.cos(a) * 0.5
      const sz = c.z + Math.sin(a) * 0.5
      this.heads.put(key, { x: sx, y: y + spin.lift + 2.0, z: sz, yaw: Math.atan2(camX - sx, camZ - sz) })
    }

    // 加速菇（§8 #18）：車頂彈出後縮進車身
    if (s.mush) {
      const mp = mushroomPose(now - s.mushAt)
      if (!mp) {
        s.mush.setEnabled(false)
        s.mush = null
      } else {
        const k = Math.max(0.001, mp.scale)
        s.mush.position.set(c.x, y + MUSH_Y - mp.sink * 1.2, c.z)
        s.mush.rotation.y = c.ry
        s.mush.scaling.setAll(k)
      }
    }

    // 換圈字卡跟著車
    for (const card of this.cards) {
      if (card.follow !== c.id) continue
      card.x = c.x
      card.y = y
      card.z = c.z
    }

    // 護盾（§6、§8 #11）
    if (s.shieldOn && !c.shield) s.shieldOffAt = now
    s.shieldOn = c.shield
    const shield = shieldPose({
      on: c.shield,
      leftMs: c.shieldLeftMs,
      offMs: now - s.shieldOffAt,
      broke: s.shieldOffAt - s.brokeAt >= 0 && s.shieldOffAt - s.brokeAt < SHIELD_BREAK_MS + 200,
    })

    return {
      dropY,
      spinYaw: spin.yaw,
      lift: spin.lift,
      sy: sq.sy,
      sxz: sq.sxz,
      visibility: ghostVisibility(now, s.respawnAt + this.opts.ghostMs),
      shield,
    }
  }

  private flames(c: CarFxInput, s: CarState, y: number, ryT: number, now: number, dtMs: number): void {
    const age = now - s.boostAt
    const pop = age < FLAME_POP_MS ? 1.4 - 0.4 * (age / FLAME_POP_MS) : 1
    const flick = 0.9 + 0.2 * fxRandom()
    s.flames.forEach((f, i) => {
      const side = i === 0 ? 1 : -1
      const [wx, wz] = local(c.x, c.z, ryT, EXHAUST.x * side, EXHAUST.z)
      f.mesh.position.set(wx, y + EXHAUST.y + 0.25, wz)
      f.mesh.scaling.setAll(pop * flick)
      f.mat.emissiveColor.copyFrom(s.boostFlame ? FLAME_C[Math.floor(fxRandom() * 3)] : s.boostColor)
    })
    const r = emitCount(s.flameAcc, 50, dtMs)
    s.flameAcc = r.acc
    if (r.count > 0) {
      const [bx, bz] = local(c.x, c.z, ryT, 0, EXHAUST.z - 0.2)
      this.circle.emit(bx, y + EXHAUST.y, bz, 0.2, r.count, exhaustStyle(s.boostFlame ? FLAME[0] : s.boostHex, s.boostFlame ? FLAME[2] : s.boostHex))
    }
  }

  private takeFlames(n: number): Pooled[] {
    const out: Pooled[] = []
    for (const f of this.flamePool) {
      if (out.length >= n) break
      if (f.mesh.isEnabled()) continue
      f.mesh.setEnabled(true)
      out.push(f)
    }
    return out
  }

  private releaseFlames(s: CarState): void {
    for (const f of s.flames) f.mesh.setEnabled(false)
    s.flames = []
  }

  private addSkid(x: number, z: number, yaw: number, now: number): void {
    if (this.skidList.length >= this.opts.skidCap) this.skids.remove(this.skidList.shift()!.key)
    const key = this.skidSeq++
    this.skidList.push({ key, x, z, yaw, born: now })
    this.skids.put(key, { x, y: 0.025, z, yaw })
  }

  /** 車從畫面上消失（離線、重開局）：收掉它的噴焰、菇、星 */
  dropCar(id: string): void {
    const s = this.cars.get(id)
    if (!s) return
    this.releaseFlames(s)
    s.mush?.setEnabled(false)
    for (let i = 0; i < 3; i++) this.heads.remove(`${id}:${i}`)
    for (const card of this.cards) if (card.follow === id) card.follow = null
    this.cars.delete(id)
  }

  // ---- 事件 ----

  /** 重生（§8 #13）：落下＋閃爍、落點白環與星 */
  respawn(id: string, x: number, z: number, now: number): void {
    const s = this.stateOf(id)
    if (now - s.respawnAt < DROP_MS) return
    s.respawnAt = now
    s.wasAir = false
    // 打滑中出界重生：落下後不再把剩下的圈轉完（頭頂星在下一幀 car() 收掉）
    s.spinAt = -Infinity
    this.ring(x, z, 3.0, now)
    this.star.emit(x, 0.6, z, 0.6, 4, RESPAWN_STAR)
  }

  /** 打滑（§8 #9／#10）：ms 為這次打滑時長；shell 時另加彈起 */
  spin(id: string, ms: number, shell: boolean, now: number): void {
    const s = this.stateOf(id)
    s.spinAt = now
    s.spinMs = ms
    s.spinShell = shell
  }

  /** 龜殼命中爆炸（§8 #10） */
  shellBoom(x: number, z: number): void {
    this.star.emit(x, 0.9, z, 0.1, 1, BOOM_STAR)
    this.spark.emit(x, 0.6, z, 0.3, 18, BOOM_SPARK)
    this.smoke.emit(x, 0.5, z, 0.5, 6, BOOM_SMOKE)
  }

  /** 龜殼拖尾（§8 #10）：存活期間每秒 45 顆 */
  shellTrail(id: string, x: number, z: number, dtMs: number): void {
    const r = emitCount(this.trailAcc.get(id) ?? 0, 45, dtMs)
    this.trailAcc.set(id, r.acc)
    if (r.count > 0) this.circle.emit(x, 0.35, z, 0.15, r.count, SHELL_TRAIL)
  }

  forgetTrail(id: string): void {
    this.trailAcc.delete(id)
  }

  /** 護盾擋下（§6、§8 #11）：泡泡膨脹碎掉、12 顆 shieldFill 往外射、接觸點小煙 */
  shieldBlock(id: string, x: number, z: number, now: number): void {
    this.stateOf(id).brokeAt = now
    this.circle.emit(x, 0.8, z, 1.4, 12, SHIELD_SHARD)
    this.smoke.emit(x, 0.6, z, 0.4, 4, BOOM_SMOKE)
  }

  /** 碰撞火花（§8 #7） */
  clash(x: number, y: number, z: number): void {
    this.spark.emit(x, y + 0.5, z, 0.2, 10, CLASH_SPARK)
    this.star.emit(x, y + 0.6, z, 0.1, 1, CLASH_STAR)
  }

  /** 撿道具箱（§8 #8）：星往上、白環（碎塊在 world） */
  boxBreak(x: number, z: number, now: number): void {
    this.star.emit(x, 1.1, z, 0.4, 6, BOX_STAR)
    this.ring(x, z, 1.8, now)
  }

  /** 加速帶觸發（§8 #17）：8 顆 boostArrow 往前噴 */
  padBurst(x: number, z: number, ry: number): void {
    this.spark.emit(x, 0.3, z, 0.4, 8, padStyle(Math.sin(ry), Math.cos(ry)))
  }

  /** 加速菇彈出（§8 #18）；池用完就不播 */
  mushroom(id: string, now: number): void {
    const s = this.stateOf(id)
    if (!s.mush) {
      const free = this.mushPool.find((m) => !m.isEnabled())
      if (!free) return
      s.mush = free
      free.setEnabled(true)
    }
    s.mushAt = now
  }

  /** 換圈／完賽字卡（§8 #14），跟著 id 的車 */
  card(text: FloatText, id: string, now: number): void {
    const card = this.cards.find((c) => c.follow === null || now - c.start >= LAP_CARD_MS) ?? this.cards[0]
    card.follow = id
    card.start = now
    card.mesh.setVerticesData('uv', quadUV(floatCellUV(FLOAT_TEXTS.indexOf(text))), true)
    card.mesh.setEnabled(true)
  }

  /** 衝線彩帶（§8 #15）：拱門橫樑兩端噴，自己 60 顆、他人 20 顆 */
  finish(self: boolean): void {
    const n = finishConfetti(self)
    const per = Math.max(1, Math.round(n / this.opts.confettiAt.length / CONFETTI_STYLES.length))
    for (const [x, y, z] of this.opts.confettiAt) for (const st of CONFETTI_STYLES) this.star.emit(x, y, z, 0.4, per, st)
  }

  /** 尾流風線（§8 #3，只畫自己）：count 條繞車身半徑 1.2、往後流 */
  slip(count: number, alpha: number, x: number, y: number, z: number, ry: number, now: number): void {
    for (let i = 0; i < SLIP_LINES; i++) {
      if (i >= count) {
        this.slips.remove(i)
        continue
      }
      // 每條 0.3s 一個循環，從車頭往車尾流；角度固定在上半圈
      const phase = (now / 300 + i * 0.37) % 1
      const a = Math.PI * (0.1 + (0.8 * ((i * 5) % SLIP_LINES)) / (SLIP_LINES - 1))
      const lx = Math.cos(a) * 1.2
      const ly = 0.4 + Math.sin(a) * 0.9
      const lz = 1.2 - phase * 3.6
      const [wx, wz] = local(x, z, ry, lx, lz)
      const k = Math.sin(Math.PI * phase)
      this.slips.put(i, { x: wx, y: y + ly, z: wz, yaw: ry, sx: 1, sy: 1, sz: Math.max(0.05, k) })
    }
    this.slipMat.alpha = alpha
  }

  /** 速度線（§8 #4）：alpha 0 收起；每 60ms 隨機轉 0–10° 製造閃動 */
  speedLines(alpha: number, now: number, fov: number, aspect: number): void {
    const on = alpha > 0.01
    this.speedPlane.setEnabled(on)
    if (!on) return
    this.speedMat.alpha = alpha
    const h = 2 * this.speedPlane.position.z * Math.tan(fov / 2) * 1.1
    this.speedPlane.scaling.set(h * Math.max(1, aspect), h * Math.max(1, aspect), 1)
    if (now - this.speedSpinAt >= 60) {
      this.speedSpinAt = now
      this.speedPlane.rotation.z = fxRandom() * ((10 * Math.PI) / 180)
    }
  }

  private ring(x: number, z: number, d: number, now: number): void {
    const r = this.rings.find((p) => !p.mesh.isEnabled()) ?? this.rings.reduce((a, b) => (a.start < b.start ? a : b))
    r.start = now
    r.x = x
    r.z = z
    r.size = d
    r.mesh.setEnabled(true)
  }

  // ---- 每幀收尾 ----

  update(now: number): void {
    for (const r of this.rings) {
      if (!r.mesh.isEnabled()) continue
      const t = (now - r.start) / RING_MS
      if (t >= 1) {
        r.mesh.setEnabled(false)
        continue
      }
      const p = ringPose(t)
      r.mesh.position.set(r.x, RING_Y, r.z)
      r.mesh.scaling.setAll(r.size * p.scale)
      r.mat.alpha = p.alpha
    }
    for (const c of this.cards) {
      if (!c.mesh.isEnabled()) continue
      const p = lapCardPose(now - c.start)
      if (!p) {
        c.mesh.setEnabled(false)
        c.follow = null
        continue
      }
      c.mesh.position.set(c.x, c.y + CARD_Y + p.rise, c.z)
      c.mesh.scaling.setAll(Math.max(0.001, p.scale))
      c.mat.alpha = p.alpha
    }
    // 胎痕：最後 0.6 秒縮小，到期拿掉
    while (this.skidList.length && skidScale(now - this.skidList[0].born) === null) this.skids.remove(this.skidList.shift()!.key)
    for (const m of this.skidList) {
      const k = skidScale(now - m.born)
      if (k !== null && k < 1) this.skids.put(m.key, { x: m.x, y: 0.025, z: m.z, yaw: m.yaw, sx: k, sz: k })
    }
    for (const g of [this.skids, this.slips, this.heads]) g.sync()
  }

  /** 重開局：清掉場上所有特效 */
  reset(): void {
    for (const e of this.emitters) e.clear()
    for (const id of [...this.cars.keys()]) this.dropCar(id)
    for (const p of [...this.rings, ...this.cards]) p.mesh.setEnabled(false)
    this.skids.clear()
    this.skidList = []
    this.slips.clear()
    this.heads.clear()
    this.trailAcc.clear()
    this.speedPlane.setEnabled(false)
  }

  dispose(): void {
    for (const e of this.emitters) e.dispose()
    for (const m of this.meshes) m.dispose()
    for (const m of this.mats) m.dispose()
    for (const t of this.textures) t.dispose()
    this.meshes.length = 0
    this.mats.length = 0
    this.textures.length = 0
    this.cars.clear()
  }
}

const RING_MS = 380

const quadUV = ([u0, v0, u1, v1]: [number, number, number, number]): number[] => [u0, v0, u1, v0, u1, v1, u0, v1]

// ---- 粒子樣式（色票 spec §3.2；顏色 c1 → c2 → 透明） ----

const sparkStyles = new Map<string, FxStyle>()
/** 甩尾火花：aim 每幀不同，依 8 方位量化快取，免得每顆都新建樣式 */
function sparkStyle(tier: DriftTier, size: number, ax: number, az: number): FxStyle {
  const oct = Math.round((Math.atan2(ax, az) / (Math.PI * 2)) * 16) & 15
  const key = `${tier}:${oct}`
  let st = sparkStyles.get(key)
  if (!st) {
    const a = (oct / 16) * Math.PI * 2
    const col = driftSparkLook(tier).color
    // 亮芯（段位色往白拉）→ 段位色 → 透明：ADD 混色在深紫路面上才看得出段位
    st = style(sparkHot(col), col, col, {
      size: [SPARK_SIZE * size, SPARK_SIZE * 1.3 * size],
      life: [0.2, 0.32],
      power: [2, 3.5],
      dir: 'aim',
      aim: [Math.sin(a), 0.45, Math.cos(a)],
      cone: (35 * Math.PI) / 180,
    })
    sparkStyles.set(key, st)
  }
  return st
}

const exhaustStyles = new Map<string, FxStyle>()
function exhaustStyle(c1: string, c2: string): FxStyle {
  const key = `${c1}|${c2}`
  let st = exhaustStyles.get(key)
  if (!st) {
    st = style(c1, c2, c2, { size: [0.3, 0.45], life: [0.1, 0.14], power: [0.4, 0.9], dir: 'up' })
    exhaustStyles.set(key, st)
  }
  return st
}

const padStyles = new Map<string, FxStyle>()
function padStyle(dx: number, dz: number): FxStyle {
  const key = `${Math.round(dx * 8)}:${Math.round(dz * 8)}`
  let st = padStyles.get(key)
  if (!st) {
    st = style(RACE.boostArrow, RACE.boostPad, RACE.boostPad, {
      size: [0.2, 0.3],
      life: [0.2, 0.3],
      power: [5, 8],
      dir: 'aim',
      aim: [dx, 0.3, dz],
      cone: 0.3,
    })
    padStyles.set(key, st)
  }
  return st
}

const DUST = style(RACE.dust, RACE.dust, RACE.dust, { size: [0.4, 0.9], life: [0.45, 0.55], power: [0.4, 1], dir: 'up' }, 0.6)
const DUST_RING = style(RACE.dust, RACE.dust, RACE.dust, { size: [0.5, 0.9], life: [0.35, 0.5], power: [2, 3], dir: 'radial' }, 0.7)
const RESPAWN_STAR = style('#FFFFFF', RACE.spark, RACE.spark, { size: [0.5, 0.7], life: [0.3, 0.45], power: [1.5, 2.5], dir: 'up' })
const BOOM_STAR = style('#FFFFFF', '#FFC53A', '#FFC53A', { size: [2, 2], life: [0.2, 0.25], power: [0, 0], dir: 'up' })
const BOOM_SPARK = style('#FFFFFF', '#FFC53A', '#FFC53A', { size: [0.2, 0.3], life: [0.25, 0.4], power: [4, 7], dir: 'burst' })
const BOOM_SMOKE = style('#FFF6E3', '#FFF6E3', '#FFF6E3', { size: [0.6, 1], life: [0.35, 0.4], power: [0.5, 1.2], dir: 'up' }, 0.8)
const SHELL_TRAIL = style('#FF8A80', '#FFFFFF', '#FFFFFF', { size: [0.3, 0.35], life: [0.22, 0.25], power: [0, 0.2], dir: 'up' })
const SHIELD_SHARD = style(RACE.shieldFill, RACE.shield, RACE.shield, { size: [0.25, 0.35], life: [0.2, 0.25], power: [5, 7], dir: 'radial' })
const CLASH_SPARK = style('#FFFFFF', RACE.spark, RACE.spark, { size: [0.14, 0.22], life: [0.12, 0.16], power: [3, 5], dir: 'burst' })
const CLASH_STAR = style('#FFFFFF', RACE.spark, RACE.spark, { size: [0.6, 0.6], life: [0.14, 0.16], power: [0, 0], dir: 'up' })
const BOX_STAR = style('#FFFFFF', '#FFF6C8', '#FFF6C8', { size: [0.35, 0.5], life: [0.35, 0.45], power: [3, 5], dir: 'up' })
const CONFETTI_STYLES = CONFETTI.map((c) => style(c, c, c, { size: [0.3, 0.45], life: [1.2, 1.6], power: [5, 9], dir: 'fountain' }))
