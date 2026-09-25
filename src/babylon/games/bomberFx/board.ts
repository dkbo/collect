/**
 * 炸彈超人場景物件（spec §5／§10）：地面 1 個 mesh；柱牆、外框、木箱三態、落牆、炸彈、火焰、道具
 * 各自一個 thin instance 群組，場上物件再多 draw call 也固定。遊戲邏輯留在 bomber.ts，這裡只管畫。
 */
import { Color3, MeshBuilder, StandardMaterial, type DynamicTexture, type Mesh, type Scene } from '@/babylon/babylonCore'
import type { FlameCell } from '@/babylon/games/bomberFx/flames'
import type { Trs } from '@/babylon/games/bomberFx/geometry'
import {
  bombData,
  borderBlockData,
  crateData,
  flameArmData,
  flameCapData,
  FLAME_LAYERS,
  pillarData,
  toMesh,
  tokenData,
  warnQuadData,
  type CrateVariant,
} from '@/babylon/games/bomberFx/models'
import { ITEM_COLORS, TOY } from '@/babylon/games/bomberFx/palette'
import { ThinGroup } from '@/babylon/games/bomberFx/thin'
import { BLOCK_TILE, createBlockAtlas, createGroundTexture, createItemAtlas, ITEM_ORDER } from '@/babylon/games/bomberFx/textures'

export type ItemKindName = (typeof ITEM_ORDER)[number]

export interface BoardConfig {
  gridW: number
  gridH: number
  cell: number
  toWorld: (cx: number, cy: number) => { x: number; z: number }
}

interface FlamePart {
  group: ThinGroup<number>
  key: number
  x: number
  z: number
  yaw: number
  /** 沿臂長方向的比例（臂 1、端頭半格 0.5、帽 = 截面） */
  len: number
  /** 截面比例（爆心帽放大） */
  girth: number
  isCap: boolean
}

interface ClosingWall {
  x: number
  z: number
  y: number
}

interface ItemRec {
  kind: ItemKindName
  x: number
  z: number
}

const FLAME_CENTER_GIRTH = 1.22
const WALL_DROP_FROM = 6

export class ToyBoard {
  private readonly scene: Scene
  private readonly cfg: BoardConfig
  private textures: DynamicTexture[] = []
  private mats: StandardMaterial[] = []
  private ground!: Mesh
  private warn!: Mesh
  private warnMat!: StandardMaterial
  private pillars!: ThinGroup<number>
  private border!: ThinGroup<number>
  private crates!: Record<CrateVariant, ThinGroup<number>>
  private crateOf = new Map<number, CrateVariant>()
  private sudden!: ThinGroup<number>
  private closing = new Map<number, ClosingWall>()
  private bombs!: { normal: ThinGroup<string>; flash: ThinGroup<string> }
  private flameArms: ThinGroup<number>[] = []
  private flameCaps: ThinGroup<number>[] = []
  private flames = new Map<number, FlamePart[]>()
  private flameSeq = 0
  private partSeq = 0
  private items!: Record<ItemKindName, ThinGroup<number>>
  private itemRecs = new Map<number, ItemRec>()
  private groups: ThinGroup<number | string>[] = []

  constructor(scene: Scene, cfg: BoardConfig) {
    this.scene = scene
    this.cfg = cfg
    this.build()
  }

  private mat(name: string, setup: (m: StandardMaterial) => void): StandardMaterial {
    const m = new StandardMaterial(name, this.scene)
    m.specularColor = Color3.Black()
    setup(m)
    this.mats.push(m)
    return m
  }

  private group<K extends number | string>(name: string, mesh: Mesh, mat: StandardMaterial, capacity: number): ThinGroup<K> {
    mesh.name = name
    mesh.material = mat
    const g = new ThinGroup<K>(mesh, capacity)
    this.groups.push(g as unknown as ThinGroup<number | string>)
    return g
  }

  private build(): void {
    const { scene } = this
    const { gridW, gridH, cell } = this.cfg
    const gw = gridW * cell
    const gh = gridH * cell

    // 地面：1 個 mesh + 程式棋盤貼圖（取代逐格 143 塊 Box）
    const groundTex = createGroundTexture(scene, gridW, gridH)
    this.textures.push(groundTex)
    this.ground = MeshBuilder.CreateGround('bomber-ground', { width: gw, height: gh }, scene)
    this.ground.material = this.mat('bomber-ground-mat', (m) => {
      m.diffuseTexture = groundTex
    })

    const atlas = createBlockAtlas(scene)
    this.textures.push(atlas)
    const blockMat = this.mat('bomber-block-mat', (m) => {
      m.diffuseTexture = atlas
    })

    // 柱牆：固定在（奇, 奇）格
    this.pillars = this.group('bomber-pillars', toMesh('p', pillarData(cell), scene), blockMat, 32)
    for (let cy = 1; cy < gridH; cy += 2) {
      for (let cx = 1; cx < gridW; cx += 2) {
        const { x, z } = this.cfg.toWorld(cx, cy)
        this.pillars.put(cy * gridW + cx, { x, y: 0, z })
      }
    }

    // 外框：沿場邊一格一段的紫灰石牆（高 1.3，沿用現有高度）
    this.border = this.group('bomber-border', toMesh('b', borderBlockData(), scene), blockMat, 64)
    let bk = 0
    const H = 1.3
    const edgeX = gw / 2 + 0.5
    const edgeZ = gh / 2 + 0.5
    for (let cx = 0; cx < gridW; cx++) {
      const { x } = this.cfg.toWorld(cx, 0)
      this.border.put(bk++, { x, y: 0, z: -edgeZ, sx: cell * 0.98, sy: H, sz: 1 })
      this.border.put(bk++, { x, y: 0, z: edgeZ, sx: cell * 0.98, sy: H, sz: 1 })
    }
    for (let cy = 0; cy < gridH; cy++) {
      const { z } = this.cfg.toWorld(0, cy)
      this.border.put(bk++, { x: -edgeX, y: 0, z, sx: 1, sy: H, sz: cell * 0.98 })
      this.border.put(bk++, { x: edgeX, y: 0, z, sx: 1, sy: H, sz: cell * 0.98 })
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.border.put(bk++, { x: sx * edgeX, y: 0, z: sz * edgeZ, sx: 1, sy: H, sz: 1 })

    // 木箱三態（統一箱形，只差圖集格）
    this.crates = {
      soft: this.group('bomber-crates', toMesh('c', crateData(cell, 'soft'), scene), blockMat, 96),
      hard: this.group('bomber-crates-hard', toMesh('ch', crateData(cell, 'hard'), scene), blockMat, 32),
      damaged: this.group('bomber-crates-damaged', toMesh('cd', crateData(cell, 'damaged'), scene), blockMat, 32),
    }

    // 突然死亡落牆：柱牆模型換紅色警示頂；落下前 400ms 的紅色預告格
    this.sudden = this.group('bomber-sudden', toMesh('s', pillarData(cell, BLOCK_TILE.suddenTop), scene), blockMat, 64)
    this.warnMat = this.mat('bomber-warn-mat', (m) => {
      m.emissiveColor = Color3.FromHexString(TOY.suddenWarn)
      m.disableLighting = true
      m.alpha = 0.4
    })
    this.warn = toMesh('bomber-warn', warnQuadData(cell), scene)
    this.warn.material = this.warnMat
    this.warn.isVisible = false
    this.warn.isPickable = false

    // 炸彈：一般與將爆各一組（將爆組之後進 GlowLayer 白名單）
    const bombMat = this.mat('bomber-bomb-mat', (m) => {
      m.diffuseColor = Color3.White()
      m.specularColor = new Color3(0.55, 0.55, 0.6)
      m.specularPower = 48
    })
    this.bombs = {
      normal: this.group('bomber-bombs', toMesh('bn', bombData(false), scene), bombMat, 24),
      flash: this.group('bomber-bombs-flash', toMesh('bf', bombData(true), scene), bombMat, 24),
    }

    // 火焰：外／中／芯三層，各有臂與帽兩種形狀
    FLAME_LAYERS.forEach((_, i) => {
      const m = this.mat(`bomber-flame-mat-${i}`, (mm) => {
        mm.emissiveColor = Color3.FromHexString(TOY.flame[i])
        mm.disableLighting = true
      })
      this.flameArms.push(this.group(`bomber-flame-arm-${i}`, toMesh('fa', flameArmData(cell, i), scene), m, 64))
      this.flameCaps.push(this.group(`bomber-flame-cap-${i}`, toMesh('fc', flameCapData(cell, i), scene), m, 32))
    })

    // 道具代幣：6 種各一組，共用圖集材質（外殼頂點色 × 圖集白格；正面 quad 取圖示格）
    const itemAtlas = createItemAtlas(scene)
    this.textures.push(itemAtlas)
    const itemMat = this.mat('bomber-item-mat', (m) => {
      m.diffuseTexture = itemAtlas
      m.specularColor = new Color3(0.45, 0.45, 0.45)
      m.specularPower = 40
    })
    const items = {} as Record<ItemKindName, ThinGroup<number>>
    ITEM_ORDER.forEach((kind, i) => {
      items[kind] = this.group(`bomber-item-${kind}`, toMesh('it', tokenData(cell, i, ITEM_COLORS[kind]), scene), itemMat, 16)
    })
    this.items = items
    this.syncAll()
  }

  // ---- 木箱 ----

  /** 設定某格木箱外觀；null 代表清掉（炸毀時只更新 matrix buffer，不 dispose mesh） */
  setCrate(ci: number, cx: number, cy: number, v: CrateVariant | null): void {
    const cur = this.crateOf.get(ci)
    if (cur) this.crates[cur].remove(ci)
    this.crateOf.delete(ci)
    if (!v) return
    const { x, z } = this.cfg.toWorld(cx, cy)
    this.crates[v].put(ci, { x, y: 0, z })
    this.crateOf.set(ci, v)
  }

  clearCrates(): void {
    for (const g of Object.values(this.crates)) g.clear()
    this.crateOf.clear()
  }

  // ---- 突然死亡 ----

  addClosingWall(ci: number, cx: number, cy: number): void {
    const { x, z } = this.cfg.toWorld(cx, cy)
    this.closing.set(ci, { x, z, y: WALL_DROP_FROM })
    this.sudden.put(ci, { x, y: WALL_DROP_FROM, z })
  }

  clearClosingWalls(): void {
    this.closing.clear()
    this.sudden.clear()
  }

  /** 紅色預告格：傳 null 收起；pulse 0..1 */
  setWarning(cell: { cx: number; cy: number } | null, pulse: number): void {
    if (!cell) {
      this.warn.isVisible = false
      return
    }
    const { x, z } = this.cfg.toWorld(cell.cx, cell.cy)
    this.warn.position.set(x, 0, z)
    this.warn.isVisible = true
    this.warnMat.alpha = 0.4 + 0.25 * pulse
  }

  // ---- 炸彈 ----

  setBomb(id: string, x: number, y: number, z: number, scale: number, flash: boolean): void {
    const on = flash ? this.bombs.flash : this.bombs.normal
    const off = flash ? this.bombs.normal : this.bombs.flash
    off.remove(id)
    on.put(id, { x, y, z, sx: scale, sy: scale, sz: scale })
  }

  removeBomb(id: string): void {
    this.bombs.normal.remove(id)
    this.bombs.flash.remove(id)
  }

  clearBombs(): void {
    this.bombs.normal.clear()
    this.bombs.flash.clear()
  }

  // ---- 火焰 ----

  /** 建一格火焰（三層），回傳 id；形狀依 classifyFlameCells 的分類 */
  addFlame(c: FlameCell): number {
    const id = this.flameSeq++
    const { x, z } = this.cfg.toWorld(c.cx, c.cy)
    const yaw = c.axis === 'z' ? Math.PI / 2 : 0
    const parts: FlamePart[] = []
    const cellHalf = this.cfg.cell / 4
    for (let layer = 0; layer < FLAME_LAYERS.length; layer++) {
      const push = (group: ThinGroup<number>, px: number, pz: number, len: number, girth: number, isCap: boolean) =>
        parts.push({ group, key: this.partSeq++, x: px, z: pz, yaw, len, girth, isCap })
      if (c.kind === 'center') {
        push(this.flameCaps[layer], x, z, 1, FLAME_CENTER_GIRTH, true)
      } else if (c.kind === 'arm') {
        push(this.flameArms[layer], x, z, 1, 1, false)
      } else {
        // 端頭：往爆心那半格的臂 + 圓帽
        const ox = c.axis === 'x' ? -c.dir * cellHalf : 0
        const oz = c.axis === 'z' ? -c.dir * cellHalf : 0
        push(this.flameArms[layer], x + ox, z + oz, 0.5, 1, false)
        push(this.flameCaps[layer], x, z, 1, 1, true)
      }
    }
    this.flames.set(id, parts)
    this.poseFlame(id, 0.01, 0.01, 1)
    return id
  }

  /** grow：沿臂生長 0..1；girth：截面 0..1；wobble：高度抖動倍率 */
  poseFlame(id: number, grow: number, girth: number, wobble: number): void {
    const parts = this.flames.get(id)
    if (!parts) return
    for (const p of parts) {
      const g = girth * p.girth
      const t: Trs = p.isCap
        ? { x: p.x, y: 0, z: p.z, sx: g, sy: g * wobble, sz: g }
        : { x: p.x, y: 0, z: p.z, yaw: p.yaw, sx: p.len * Math.max(0.01, grow), sy: g * wobble, sz: g }
      p.group.put(p.key, t)
    }
  }

  removeFlame(id: number): void {
    for (const p of this.flames.get(id) ?? []) p.group.remove(p.key)
    this.flames.delete(id)
  }

  clearFlames(): void {
    for (const g of [...this.flameArms, ...this.flameCaps]) g.clear()
    this.flames.clear()
  }

  // ---- 道具 ----

  addItem(ci: number, kind: ItemKindName, cx: number, cy: number): void {
    this.removeItem(ci)
    const { x, z } = this.cfg.toWorld(cx, cy)
    this.itemRecs.set(ci, { kind, x, z })
  }

  removeItem(ci: number): void {
    const r = this.itemRecs.get(ci)
    if (r) this.items[r.kind].remove(ci)
    this.itemRecs.delete(ci)
  }

  itemPos(ci: number): { x: number; y: number; z: number } | null {
    const r = this.itemRecs.get(ci)
    return r ? { x: r.x, y: 0.6, z: r.z } : null
  }

  clearItems(): void {
    for (const g of Object.values(this.items)) g.clear()
    this.itemRecs.clear()
  }

  // ---- 每幀 ----

  update(now: number, deltaMs: number): void {
    // 道具：面朝鏡頭傾斜、左右輕擺、上下浮動
    for (const [ci, r] of this.itemRecs) {
      const y = 0.55 + Math.sin(now * 0.004 + r.x) * 0.12
      this.items[r.kind].put(ci, { x: r.x, y, z: r.z, pitch: -0.55, yaw: Math.sin(now * 0.003 + r.x + r.z) * 0.35 })
    }
    // 落牆：由高處快速落到定位
    for (const [ci, w] of this.closing) {
      if (w.y <= 0) continue
      w.y += (0 - w.y) * Math.min(1, deltaMs * 0.02)
      if (w.y < 0.02) w.y = 0
      this.sudden.put(ci, { x: w.x, y: w.y, z: w.z })
    }
    this.syncAll()
  }

  private syncAll(): void {
    for (const g of this.groups) g.sync()
  }

  dispose(): void {
    for (const g of this.groups) g.dispose()
    this.groups = []
    this.ground.dispose()
    this.warn.dispose()
    for (const m of this.mats) m.dispose()
    for (const t of this.textures) t.dispose()
    this.mats = []
    this.textures = []
    this.flames.clear()
    this.itemRecs.clear()
    this.closing.clear()
    this.crateOf.clear()
  }
}
