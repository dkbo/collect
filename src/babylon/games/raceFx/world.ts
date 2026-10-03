/**
 * A「Toy Racer」場景（spec §4.2／§4.3）：桌墊＋木桌、路面、起跑線＋拱門、紅白路緣、看台與觀眾、旗子、積木、樹、錐、
 * 跳台、固定加速帶、道具箱（浮動旋轉、問號圖集）、香蕉／龜殼、blob 影、暫用甩尾火花。
 * 同形狀的東西一律 thin instance（1 個 draw call），遊戲邏輯留在 race.ts，這裡只管畫。
 */
import { Color3, Mesh, MeshBuilder, StandardMaterial, type DynamicTexture, type Material, type Scene } from '@/babylon/babylonCore'
import { composeMatrix, type MeshData, type Trs } from '@/babylon/fx/geometry'
import { rgba, toMesh, type Rgba } from '@/babylon/fx/models'
import { ThinGroup } from '@/babylon/fx/thin'
import { ThinSlots } from '@/babylon/fx/thinSlots'
import { PLAYER_PALETTE } from '@/babylon/fx/palette'
import type { Course } from '@/babylon/games/raceRules/track'
import type { ItemBox } from '@/babylon/games/raceRules/items'
import { JUMP_H, PAD_HALF_LEN, PAD_HALF_W, RAMP_HALF_W } from '@/babylon/games/raceRules/drive'
import {
  archData,
  bananaData,
  bannerData,
  blockData,
  boxData,
  coneData,
  crowdData,
  curbData,
  flagData,
  rampData,
  shellData,
  standData,
  treeData,
} from '@/babylon/games/raceFx/models'
import { RACE } from '@/babylon/games/raceFx/palette'
import { roadStrip } from '@/babylon/games/raceFx/raceGeom'
import {
  archPose,
  blockSpots,
  boxPose,
  coneSpots,
  crowdSpots,
  curbSpots,
  flagSpots,
  rampPose,
  standPose,
  treeSpots,
} from '@/babylon/games/raceFx/scenery'
import {
  createBannerTexture,
  createBlobTexture,
  createBoxAtlas,
  createMatTexture,
  createPadTexture,
  createRampTexture,
  createRoadTexture,
  createStartTexture,
  createTableTexture,
} from '@/babylon/games/raceFx/textures'

/** 光影登記用：依用途分好的 mesh 與材質（ToyLook 用） */
export interface WorldFxTargets {
  toon: Material[]
  receivers: Mesh[]
  casters: Mesh[]
  outlined: Mesh[]
  glow: { mesh: Mesh; color: string; strength: number }[]
  /** 用自己材質顏色發光的 mesh（道具箱：4 種面色各自發光，不是一片白暈） */
  glowOwn: { mesh: Mesh; strength: number }[]
}

export interface WorldItem {
  id: string
  kind: 'banana' | 'shell'
  x: number
  z: number
}

export interface WorldOptions {
  /** 桌墊貼圖邊長（手機可降 512） */
  matSize: number
  /** 觀眾彈跳（手機關） */
  crowdHop: boolean
  /** 暫用火花池上限 */
  sparkCap: number
}

const ROAD_Y = 0.02
const BLOB_Y = 0.045
const SPARK_LIFE = 0.3
const CROWD_COLORS = [...PLAYER_PALETTE.map((p) => p.base), RACE.roadEdge]

/** 平貼地面的四邊形（法線朝上），x 寬 w、z 長 d，uv 從 (0,0) 到 (1,1) */
function flatQuad(w: number, d: number): MeshData {
  const x = w / 2
  const z = d / 2
  return {
    positions: [-x, 0, -z, x, 0, -z, x, 0, z, -x, 0, z],
    normals: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    uvs: [0, 0, 1, 0, 1, 1, 0, 1],
    indices: [0, 1, 2, 0, 2, 3],
  }
}

/** 一次寫好的 thin instance（靜態場景物件）；回傳 matrix buffer 供動畫物件逐幀改寫 */
function setThin(mesh: Mesh, trs: Trs[], colors?: Rgba[], dynamic = false): Float32Array {
  const m = new Float32Array(Math.max(1, trs.length) * 16)
  trs.forEach((t, i) => composeMatrix(m, i * 16, t))
  mesh.thinInstanceSetBuffer('matrix', m, 16, !dynamic)
  if (colors) {
    const c = new Float32Array(colors.length * 4)
    colors.forEach((col, i) => c.set(col, i * 4))
    mesh.thinInstanceSetBuffer('color', c, 4, true)
  }
  mesh.thinInstanceRefreshBoundingInfo(false)
  if (dynamic) mesh.alwaysSelectAsActiveMesh = true
  return m
}

export class RaceWorld {
  readonly boxes: ThinGroup<number>
  readonly blobs: ThinGroup<string>
  readonly bananas: ThinGroup<string>
  readonly shells: ThinGroup<string>
  private readonly sparks: ThinGroup<number>
  private readonly sparkColors: ThinSlots<number>
  private sparkColorVersion = -1
  private sparkList: { key: number; x: number; y: number; z: number; vy: number; life: number }[] = []
  private sparkSeq = 0
  private readonly scene: Scene
  private readonly opts: WorldOptions
  private readonly meshes: Mesh[] = []
  private readonly mats: StandardMaterial[] = []
  private readonly lit: StandardMaterial[] = []
  private readonly fx: WorldFxTargets = { toon: [], receivers: [], casters: [], outlined: [], glow: [], glowOwn: [] }
  private readonly boxList: ItemBox[]
  private padTex!: DynamicTexture
  private flagMesh!: Mesh
  private flagBuf!: Float32Array
  private flagTrs: Trs[] = []
  private crowdMesh!: Mesh
  private crowdBuf!: Float32Array
  private crowdTrs: Trs[] = []
  private crowdHopUntil: number[] = []
  private nextHop = 0
  private hopSeed = 0x2545f491

  constructor(scene: Scene, course: Course, boxes: ItemBox[], opts: WorldOptions) {
    this.scene = scene
    this.opts = opts
    this.boxList = boxes
    const t = course.track

    // 桌墊＋木桌
    const ground = MeshBuilder.CreateGround('race-mat', { width: course.bound.x * 2, height: course.bound.z * 2 }, scene)
    ground.material = this.mat('mat', { tex: createMatTexture(scene, course.bound.x * 2, course.bound.z * 2, opts.matSize) })
    this.add(ground, { receive: true })
    const table = MeshBuilder.CreateGround('race-table', { width: 600, height: 600 }, scene)
    table.position.y = -0.05
    const tableTex = createTableTexture(scene)
    tableTex.uScale = 12
    tableTex.vScale = 12
    // disableLighting 下輸出 = clamp(emissiveColor + emissiveTexture·level)：emissiveColor 留黑、亮度 0.85 走貼圖 level（加 0.85 會整片洗白）
    tableTex.level = 0.85
    const tm = this.mat('table', { emissiveTex: tableTex, lit: false })
    table.material = tm
    this.add(table)

    // 路面（每 8 單位一格貼圖）
    const road = toMesh('race-road', roadStrip(t, t.width / 2, ROAD_Y, 1 / 8), scene)
    const rm = this.mat('road', { tex: createRoadTexture(scene) })
    rm.backFaceCulling = false
    road.material = rm
    this.add(road, { receive: true })

    // 起跑線＋拱門＋橫幅
    const ap = archPose(t)
    const start = toMesh('race-start', flatQuad(t.width, 1.4), scene)
    start.position.set(ap.x, 0.03, ap.z)
    start.rotation.y = ap.yaw
    start.material = this.mat('start', { tex: createStartTexture(scene) })
    this.add(start, { receive: true })
    const arch = toMesh('race-arch', archData(), scene)
    arch.position.set(ap.x, 0, ap.z)
    arch.rotation.y = ap.yaw
    const archMat = this.mat('arch', {})
    archMat.backFaceCulling = false
    arch.material = archMat
    // 描邊只描車、道具與道具箱（brief AC10；spec §5 的拱門描邊依 brief 拿掉）
    this.add(arch)
    const banner = toMesh('race-banner', bannerData(15, 1.2), scene)
    banner.parent = arch
    banner.position.set(0, 5.3, 0)
    const bannerMat = this.mat('banner', { tex: createBannerTexture(scene) })
    banner.material = bannerMat
    // 橫幅貼在橫樑兩面外側一點
    const bannerBack = banner.clone('race-banner-b', arch)
    banner.position.z = -0.42
    bannerBack.position.z = 0.42
    this.add(banner)
    this.add(bannerBack)

    // 紅白路緣（|κ| ≥ 1/40 的路段）
    const curbs = curbSpots(t)
    const curb = toMesh('race-curb', curbData(), scene)
    curb.material = this.mat('curb', {})
    setThin(
      curb,
      curbs.map((c) => ({ x: c.x, y: ROAD_Y, z: c.z, yaw: c.yaw })),
      curbs.map((c) => rgba(c.red ? RACE.curbRed : RACE.curbWhite))
    )
    this.add(curb, { receive: true })

    // 看台＋觀眾＋旗子
    const sp = standPose(t)
    const stand = toMesh('race-stand', standData(sp.len), scene)
    stand.position.set(sp.x, 0, sp.z)
    stand.rotation.y = sp.yaw
    stand.material = this.mat('stand', {})
    this.add(stand)
    const crowd = crowdSpots(t)
    this.crowdMesh = toMesh('race-crowd', crowdData(), scene)
    this.crowdMesh.material = this.mat('crowd', {})
    this.crowdTrs = crowd.map((c) => ({ x: c.x, y: c.y, z: c.z, yaw: c.yaw }))
    this.crowdHopUntil = crowd.map(() => 0)
    this.crowdBuf = setThin(
      this.crowdMesh,
      this.crowdTrs,
      crowd.map((c) => rgba(CROWD_COLORS[c.color])),
      opts.crowdHop
    )
    this.add(this.crowdMesh)
    const flags = flagSpots(t)
    this.flagMesh = toMesh('race-flag', flagData(), scene)
    const fm = this.mat('flag', {})
    fm.backFaceCulling = false
    this.flagMesh.material = fm
    this.flagTrs = flags.map((f) => ({ x: f.x, y: f.y, z: f.z, yaw: f.yaw }))
    this.flagBuf = setThin(
      this.flagMesh,
      this.flagTrs,
      flags.map((_, i) => rgba(PLAYER_PALETTE[i % 4].base)),
      true
    )
    this.add(this.flagMesh)

    // 場邊積木（2 種形狀各 1 組）、棒棒糖樹、三角錐
    const blocks = blockSpots(t)
    for (const kind of ['2x2', '2x4'] as const) {
      const list = blocks.filter((b) => b.kind === kind)
      const mesh = toMesh(`race-block-${kind}`, blockData(kind), scene)
      mesh.material = this.mat(`block-${kind}`, {})
      setThin(
        mesh,
        list.map((b) => ({ x: b.x, y: b.y, z: b.z, yaw: b.yaw })),
        list.map((b) => rgba(RACE.block[b.color]))
      )
      this.add(mesh)
    }
    const trees = toMesh('race-tree', treeData(), scene)
    trees.material = this.mat('tree', {})
    setThin(
      trees,
      treeSpots(t).map((p, i) => ({ x: p.x, y: 0, z: p.z, yaw: p.yaw, sx: 0.9 + (i % 3) * 0.12, sy: 0.9 + (i % 4) * 0.08, sz: 0.9 + (i % 3) * 0.12 }))
    )
    this.add(trees)
    const cones = toMesh('race-cone', coneData(), scene)
    cones.material = this.mat('cone', {})
    setThin(
      cones,
      coneSpots(t).map((c) => ({ x: c.x, y: 0, z: c.z, yaw: c.yaw }))
    )
    this.add(cones)

    // 跳台（收陰影、不投影：投影只限車與道具）
    for (const [i, [s0, s1]] of course.jumps.entries()) {
      const rp = rampPose(t, s0, s1)
      const ramp = toMesh(`race-ramp-${i}`, rampData(rp.len, RAMP_HALF_W * 2, JUMP_H), scene)
      ramp.position.set(rp.x, 0, rp.z)
      ramp.rotation.y = rp.yaw
      const m = this.mat(`ramp-${i}`, { tex: createRampTexture(scene) })
      m.backFaceCulling = false
      ramp.material = m
      this.add(ramp, { receive: true })
    }

    // 固定加速帶：箭頭往前捲動，自發光、進 Glow
    this.padTex = createPadTexture(scene)
    const pads = toMesh('race-pads', flatQuad(PAD_HALF_W * 2, PAD_HALF_LEN * 2), scene)
    const pm = this.mat('pad', { emissiveTex: this.padTex, lit: false })
    pads.material = pm
    setThin(
      pads,
      course.pads.map((p) => ({ x: p.x, y: 0.035, z: p.z, yaw: p.heading }))
    )
    this.add(pads, { glow: { color: RACE.boostPad, strength: 0.55 } })

    // 道具箱（12）＋ blob 影（道具箱常駐、車在陰影被降級後才墊）
    this.boxes = new ThinGroup<number>(toMesh('race-boxes', boxData(), scene), boxes.length)
    this.boxes.mesh.material = this.mat('box', { tex: createBoxAtlas(scene) })
    this.add(this.boxes.mesh, { cast: true, outline: true })
    this.fx.glowOwn.push({ mesh: this.boxes.mesh, strength: 0.35 })
    this.blobs = new ThinGroup<string>(toMesh('race-blobs', flatQuad(1, 1), scene), 16)
    const bm = this.mat('blob', { tex: createBlobTexture(scene), lit: false })
    bm.useAlphaFromDiffuseTexture = true
    // disableLighting：輸出 = clamp(emissive) × 貼圖色，emissive 白才是貼圖的深紫（留黑會變純黑）
    bm.emissiveColor = Color3.White()
    bm.zOffset = -2
    this.blobs.mesh.material = bm
    this.meshes.push(this.blobs.mesh)

    // 香蕉、龜殼（host 生成，各端畫）
    this.bananas = new ThinGroup<string>(toMesh('race-bananas', bananaData(), scene), 8)
    this.bananas.mesh.material = this.mat('banana', {})
    this.add(this.bananas.mesh, { cast: true, outline: true })
    this.shells = new ThinGroup<string>(toMesh('race-shells', shellData(), scene), 4)
    this.shells.mesh.material = this.mat('shell', {})
    this.add(this.shells.mesh, { cast: true, outline: true, glow: { color: '#E8413A', strength: 0.45 } })

    // 暫用甩尾火花（波 4 換 spec 特效表的粒子）：小方塊 thin instance＋實例色
    this.sparks = new ThinGroup<number>(MeshBuilder.CreateBox('race-sparks', { size: 0.14 }, scene), opts.sparkCap)
    // disableLighting 下 diffuseBase = 0：輸出 = clamp(emissive) × 實例色，emissive 要白才看得到實例色（留黑會全黑）
    const skm = this.mat('spark', { lit: false })
    skm.emissiveColor = Color3.White()
    this.sparks.mesh.material = skm
    this.sparkColors = new ThinSlots<number>(opts.sparkCap, 4)
    this.meshes.push(this.sparks.mesh)
  }

  private mat(name: string, o: { tex?: DynamicTexture; emissiveTex?: DynamicTexture; lit?: boolean }): StandardMaterial {
    const m = new StandardMaterial(`race-${name}`, this.scene)
    m.diffuseColor = Color3.White()
    m.specularColor = new Color3(0.06, 0.06, 0.06)
    if (o.tex) m.diffuseTexture = o.tex
    if (o.emissiveTex) m.emissiveTexture = o.emissiveTex
    if (o.lit === false) m.disableLighting = true
    else this.lit.push(m)
    this.mats.push(m)
    return m
  }

  private add(
    mesh: Mesh,
    o: { receive?: boolean; cast?: boolean; outline?: boolean; glow?: { color: string; strength: number } } = {}
  ): void {
    mesh.isPickable = false
    this.meshes.push(mesh)
    if (o.receive) this.fx.receivers.push(mesh)
    if (o.cast) this.fx.casters.push(mesh)
    if (o.outline) this.fx.outlined.push(mesh)
    if (o.glow) this.fx.glow.push({ mesh, ...o.glow })
  }

  fxTargets(): WorldFxTargets {
    return { ...this.fx, toon: [...this.lit] }
  }

  /** 每幀：道具箱浮動與被撿走、香蕉／龜殼、加速帶箭頭、旗子、觀眾、火花，最後上傳所有 thin instance */
  update(now: number, dt: number, taken: readonly number[], items: Iterable<WorldItem>): void {
    const tSec = now / 1000
    for (const b of this.boxList) {
      if (taken.includes(b.id)) {
        this.boxes.remove(b.id)
        this.blobs.remove(`box-${b.id}`)
        continue
      }
      const p = boxPose(b.id, tSec)
      this.boxes.put(b.id, { x: b.x, y: p.y, z: b.z, yaw: p.yaw, pitch: p.pitch })
      this.blobs.put(`box-${b.id}`, { x: b.x, y: BLOB_Y, z: b.z, sx: 1.4, sz: 1.4 })
    }

    const live = new Set<string>()
    for (const it of items) {
      live.add(it.id)
      if (it.kind === 'banana') this.bananas.put(it.id, { x: it.x, y: 0, z: it.z, yaw: hashYaw(it.id) })
      else this.shells.put(it.id, { x: it.x, y: 0.3, z: it.z, yaw: tSec * 10 })
    }
    for (const g of [this.bananas, this.shells]) for (const k of g.keys()) if (!live.has(k)) g.remove(k)

    this.padTex.vOffset -= dt * 2.2

    // 旗面擺動
    this.flagTrs.forEach((f, i) => composeMatrix(this.flagBuf, i * 16, { ...f, yaw: (f.yaw ?? 0) + 0.25 * Math.sin(tSec * 3 + i) }))
    this.flagMesh.thinInstanceBufferUpdated('matrix')

    // 觀眾：每 0.6 s 隨機 20% 的人彈一下（手機檔靜止）
    if (this.opts.crowdHop) {
      if (now >= this.nextHop) {
        this.nextHop = now + 600
        for (let i = 0; i < this.crowdHopUntil.length; i++) if (this.rand() < 0.2) this.crowdHopUntil[i] = now + 300
      }
      this.crowdTrs.forEach((c, i) => {
        const left = this.crowdHopUntil[i] - now
        const lift = left > 0 ? 0.2 * Math.sin((Math.PI * left) / 300) : 0
        composeMatrix(this.crowdBuf, i * 16, { ...c, y: c.y + lift })
      })
      this.crowdMesh.thinInstanceBufferUpdated('matrix')
    }

    this.updateSparks(dt)
    for (const g of [this.boxes, this.blobs, this.bananas, this.shells]) g.sync()
  }

  /** 車的 blob 影（陰影被降級關掉、或 ghost 時拿掉） */
  setCarBlob(id: string, x: number, z: number, on: boolean): void {
    if (on) this.blobs.put(`car-${id}`, { x, y: BLOB_Y, z, sx: 1.9, sz: 2.4 })
    else this.blobs.remove(`car-${id}`)
  }

  /** 暫用甩尾火花 */
  spark(x: number, y: number, z: number, hex: string): void {
    if (this.sparkList.length >= this.opts.sparkCap) return
    const key = this.sparkSeq++
    this.sparkList.push({ key, x, y, z, vy: 1.5, life: SPARK_LIFE })
    this.sparkColors.add(key)
    const c = rgba(hex)
    this.sparkColors.write(key, (buf, o) => buf.set(c, o))
  }

  private updateSparks(dt: number): void {
    this.sparkList = this.sparkList.filter((s) => {
      s.life -= dt
      if (s.life <= 0) {
        this.sparks.remove(s.key)
        this.sparkColors.remove(s.key)
        return false
      }
      s.y += s.vy * dt
      const k = s.life / SPARK_LIFE
      this.sparks.put(s.key, { x: s.x, y: s.y, z: s.z, sx: k, sy: k, sz: k })
      return true
    })
    this.sparks.sync()
    const cs = this.sparkColors
    if (!cs.dirty) return
    if (this.sparkColorVersion !== cs.bufferVersion) {
      this.sparks.mesh.thinInstanceSetBuffer('color', cs.buffer, 4, false)
      this.sparkColorVersion = cs.bufferVersion
    } else {
      this.sparks.mesh.thinInstanceBufferUpdated('color')
    }
    cs.dirty = false
  }

  private rand(): number {
    let s = this.hopSeed
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    this.hopSeed = s
    return ((s >>> 0) % 10000) / 10000
  }

  dispose(): void {
    for (const m of this.meshes) m.dispose()
    this.meshes.length = 0
    for (const m of this.mats) m.dispose(true, true)
    this.mats.length = 0
    this.sparkList = []
  }
}

const hashYaw = (id: string): number => {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return ((h >>> 0) % 628) / 100
}
