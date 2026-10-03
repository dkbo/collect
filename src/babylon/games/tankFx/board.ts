/**
 * 坦克場景物件（spec §4）：地面 1 個 mesh＋程式貼圖、場外延伸底色與外框基座；
 * 柱牆／外框／落牆／木箱／子彈（一般與反彈後）／5 種道具／預告格／blob 影各自一個 thin instance 群組，
 * 場上物件再多 draw call 也固定。遊戲邏輯留在 tank.ts，這裡只管畫。
 */
import { Color3, MeshBuilder, StandardMaterial, type DynamicTexture, type Mesh, type Scene } from '@/babylon/babylonCore'
import { easeOut, itemHop } from '@/babylon/fx/curves'
import { toMesh } from '@/babylon/fx/models'
import { ThinGroup } from '@/babylon/fx/thin'
import { alignIconSlots } from '@/babylon/games/tankFx/itemSlots'
import { ThinSlots } from '@/babylon/fx/thinSlots'
import { crateData } from '@/babylon/games/bomberFx/models'
import { createBlockAtlas } from '@/babylon/games/bomberFx/textures'
import type { ItemKind } from '@/babylon/games/tankFx/combat'
import { ITEM_ICON_ATTR, applyItemIcon } from '@/babylon/games/tankFx/itemIcon'
import type { CellPred } from '@/babylon/games/tankFx/grid'
import {
  BORDER_COLORS,
  BRICK_H,
  CLOSE_COLORS,
  WALL_COLORS,
  brickData,
  bulletData,
  groundQuadData,
  tokenData,
  voidData,
} from '@/babylon/games/tankFx/models'
import { ITEM_ORDER, TANK } from '@/babylon/games/tankFx/palette'
import {
  createBlobTexture,
  createGroundTexture,
  drawGroundTexture,
  createItemAtlas,
  createWarnTexture,
  tokenUV,
} from '@/babylon/games/tankFx/textures'

export interface BoardConfig {
  gridW: number
  gridH: number
  cell: number
  toWorld: (cx: number, cy: number) => { x: number; z: number }
}

/** 光影登記用：依用途分好的 mesh 與材質（ToyLook 用） */
export interface BoardFxTargets {
  toon: StandardMaterial[]
  receivers: Mesh[]
  casters: Mesh[]
  outlined: Mesh[]
  glow: { mesh: Mesh; color: string; strength: number }[]
  /** 用自己材質發光（顏色隨實例）的 mesh：道具代幣各帶自己的底色 */
  glowOwn: { mesh: Mesh; strength: number }[]
}

interface ItemRec {
  kind: ItemKind
  x: number
  z: number
  born: number
}

interface ClosingWall {
  x: number
  z: number
  born: number
  done: boolean
}

/** 木箱實例縮放（spec §4：0.9 CELL × 0.8 = 1.44 立方，比柱牆矮） */
const CRATE_SCALE = 0.8
/** 道具浮動高度與幅度、彈出時長 */
const ITEM_Y = 1.1
const ITEM_BOB = 0.12
const ITEM_HOP_MS = 300
/** 代幣往鏡頭仰的角度（同 bomber 代幣） */
const ITEM_PITCH = -0.55
export const BULLET_Y = 0.35
/** 道具色暈強度（代幣材質顏色 × 這個倍率畫進發光貼圖） */
const ITEM_GLOW = 0.35
/** 落牆：從 y +6 以 easeIn 落下 260ms，落地回彈 scaleY 0.85→1.04→1 120ms（spec §8 #15） */
const DROP_FROM = 6
export const DROP_MS = 260
const LAND_MS = 120

export class TankBoard {
  private readonly scene: Scene
  private readonly cfg: BoardConfig
  private textures: DynamicTexture[] = []
  private mats: StandardMaterial[] = []
  private meshes: Mesh[] = []
  private groups: ThinGroup<number | string>[] = []
  private toonMats: StandardMaterial[] = []
  private ground!: Mesh
  private groundTex: DynamicTexture | null = null
  /** 木箱增減後要重畫地面的箱底陰影（每幀最多重畫一次） */
  private groundDirty = false
  private isWallPred: CellPred = () => false
  private groundMat!: StandardMaterial
  private pillars!: ThinGroup<number>
  private border!: ThinGroup<number>
  private sudden!: ThinGroup<number>
  private closing = new Map<number, ClosingWall>()
  private crates!: ThinGroup<number>
  private bullets!: ThinGroup<string>
  private bounced!: ThinGroup<string>
  /** 5 種道具共用一組 thin instance；iconSlots 與 items.slots 以同樣的操作順序維護，每幀再以 alignIconSlots 核對 */
  private items!: ThinGroup<number | string>
  private iconSlots = new ThinSlots<number | string>(8, 1)
  private iconVersion = -1
  private itemRecs = new Map<number | string, ItemRec>()
  private warn!: Mesh
  private warnMat!: StandardMaterial
  private blobs!: ThinGroup<string>

  constructor(scene: Scene, cfg: BoardConfig) {
    this.scene = scene
    this.cfg = cfg
    this.build()
  }

  private mat(name: string, setup: (m: StandardMaterial) => void, toon = true): StandardMaterial {
    const m = new StandardMaterial(name, this.scene)
    m.specularColor = Color3.Black()
    setup(m)
    this.mats.push(m)
    if (toon) this.toonMats.push(m)
    return m
  }

  private group<K extends number | string>(name: string, mesh: Mesh, mat: StandardMaterial, capacity: number): ThinGroup<K> {
    mesh.name = name
    mesh.material = mat
    mesh.isPickable = false
    const g = new ThinGroup<K>(mesh, capacity)
    this.groups.push(g as unknown as ThinGroup<number | string>)
    return g
  }

  private build(): void {
    const { scene } = this
    const { gridW, gridH, cell } = this.cfg
    const gw = gridW * cell
    const gh = gridH * cell

    // 場外延伸底色＋外框底下的深色基座：同一個頂點色 mesh、不受光（避免被 ACES 拉灰）
    const voidMat = this.mat(
      'tank-void-mat',
      (m) => {
        m.disableLighting = true
        m.diffuseColor = Color3.Black()
        m.emissiveColor = Color3.White()
      },
      false
    )
    const voidMesh = toMesh('tank-void', voidData(gw + cell * 2 + 1.4), scene)
    voidMesh.material = voidMat
    voidMesh.isPickable = false
    this.meshes.push(voidMesh)

    // 地面：1 個 mesh，貼圖在 setWalls 時畫（要烘牆根陰影）
    this.ground = MeshBuilder.CreateGround('tank-ground', { width: gw, height: gh }, scene)
    this.ground.isPickable = false
    this.groundMat = this.mat('tank-ground-mat', () => undefined)
    this.ground.material = this.groundMat
    this.meshes.push(this.ground)

    // 積木：柱牆、外框、落牆同一個模型，三組頂點色
    const brickMat = this.mat('tank-brick-mat', () => undefined)
    this.pillars = this.group('tank-pillars', toMesh('tp', brickData(WALL_COLORS), scene), brickMat, 64)
    this.border = this.group('tank-border', toMesh('tb', brickData(BORDER_COLORS), scene), brickMat, 72)
    this.sudden = this.group('tank-sudden', toMesh('ts', brickData(CLOSE_COLORS), scene), brickMat, 128)
    let bk = 0
    const sy = 1.9 / BRICK_H
    for (let c = -1; c <= gridW; c++) {
      for (const r of [-1, gridH]) {
        const { x, z } = this.cfg.toWorld(c, r)
        this.border.put(bk++, { x, y: 0, z, sy })
      }
    }
    for (let r = 0; r < gridH; r++) {
      for (const c of [-1, gridW]) {
        const { x, z } = this.cfg.toWorld(c, r)
        this.border.put(bk++, { x, y: 0, z, sy })
      }
    }

    // 木箱：沿用 bomber 的木箱模型與方塊圖集（只讀），實例縮 0.8
    const atlas = createBlockAtlas(scene)
    this.textures.push(atlas)
    const crateMat = this.mat('tank-crate-mat', (m) => {
      m.diffuseTexture = atlas
    })
    this.crates = this.group('tank-crates', toMesh('tc', crateData(cell, 'soft'), scene), crateMat, 96)

    // 子彈：一般與反彈後兩組（反彈後換紅暈），材質走 emissive
    const bulletMat = this.mat(
      'tank-bullet-mat',
      (m) => {
        m.disableLighting = true
        m.emissiveColor = Color3.FromHexString(TANK.bullet)
      },
      false
    )
    const bounceMat = this.mat(
      'tank-bullet-bounce-mat',
      (m) => {
        m.disableLighting = true
        m.emissiveColor = Color3.FromHexString('#FFB4A8')
      },
      false
    )
    this.bullets = this.group('tank-bullets', toMesh('tbl', bulletData(), scene), bulletMat, 32)
    this.bounced = this.group('tank-bullets-bounce', toMesh('tbb', bulletData(), scene), bounceMat, 16)

    // 道具：5 種代幣共用一組 thin instance＋圖集材質，實例屬性 tankItemIcon 選圖集欄（itemIcon.ts）
    const itemAtlas = createItemAtlas(scene)
    this.textures.push(itemAtlas)
    const itemMat = this.mat('tank-item-mat', (m) => {
      m.diffuseTexture = itemAtlas
      m.specularColor = new Color3(0.45, 0.45, 0.45)
      m.specularPower = 40
    })
    applyItemIcon(itemMat)
    this.items = this.group('tank-items', toMesh('ti', tokenData(tokenUV()), scene), itemMat, 8)

    // 落牆預告格（一次最多 1 筆，用一般 mesh）
    const warnTex = createWarnTexture(scene)
    this.textures.push(warnTex)
    this.warnMat = this.mat(
      'tank-warn-mat',
      (m) => {
        m.diffuseTexture = warnTex
        m.emissiveTexture = warnTex
        m.useAlphaFromDiffuseTexture = true
        m.disableLighting = true
      },
      false
    )
    this.warn = toMesh('tank-warn', groundQuadData(cell * 0.9, 0.02), scene)
    this.warn.material = this.warnMat
    this.warn.isVisible = false
    this.warn.isPickable = false
    this.meshes.push(this.warn)

    // blob 影：陰影被降級關掉時墊在坦克與道具底下
    const blobTex = createBlobTexture(scene)
    this.textures.push(blobTex)
    const blobMat = this.mat(
      'tank-blob-mat',
      (m) => {
        m.diffuseTexture = blobTex
        m.useAlphaFromDiffuseTexture = true
        m.disableLighting = true
        m.emissiveColor = Color3.White()
      },
      false
    )
    this.blobs = this.group('tank-blobs', toMesh('tbo', groundQuadData(1, 0.012), scene), blobMat, 16)
    this.syncAll()
  }

  fxTargets(): BoardFxTargets {
    const items = [this.items.mesh]
    return {
      toon: [...this.toonMats],
      receivers: [this.ground],
      casters: items,
      outlined: [this.crates.mesh, ...items],
      glow: [
        { mesh: this.bullets.mesh, color: TANK.bulletHot, strength: 0.9 },
        { mesh: this.bounced.mesh, color: TANK.bounce, strength: 1 },
        { mesh: this.warn, color: TANK.warn, strength: 0.6 },
      ],
      // 5 種道具共用一個 mesh：發光貼圖改用代幣自己的材質（含圖集欄平移），各自帶底色的暈；
      // 代幣本身不發光又疊 bloom，全強度會糊成一團，壓暗只留色暈
      glowOwn: [{ mesh: this.items.mesh, strength: ITEM_GLOW }],
    }
  }

  // ---- 牆 ----

  /** 固定柱牆（init 一次）；地面貼圖同時烘牆根與箱底陰影（之後木箱增減時重畫） */
  setWalls(walls: Iterable<number>, isWall: CellPred): void {
    const { gridW, gridH } = this.cfg
    this.pillars.clear()
    for (const ci of walls) {
      const { x, z } = this.cfg.toWorld(ci % gridW, Math.floor(ci / gridW))
      this.pillars.put(ci, { x, y: 0, z })
    }
    this.isWallPred = isWall
    this.groundTex?.dispose()
    this.groundTex = createGroundTexture(this.scene, gridW, gridH, this.shadowed)
    this.groundMat.diffuseTexture = this.groundTex
    this.groundDirty = false
  }

  /** 接地陰影：牆（含已落下的牆）與木箱 */
  private shadowed: CellPred = (cx, cy) => this.isWallPred(cx, cy) || this.crates.has(cy * this.cfg.gridW + cx)

  // ---- 木箱 ----

  setCrate(ci: number, on: boolean): void {
    if (on !== this.crates.has(ci)) this.groundDirty = true
    if (!on) {
      this.crates.remove(ci)
      return
    }
    const { x, z } = this.cfg.toWorld(ci % this.cfg.gridW, Math.floor(ci / this.cfg.gridW))
    this.crates.put(ci, { x, y: 0, z, sx: CRATE_SCALE, sy: CRATE_SCALE, sz: CRATE_SCALE })
  }

  clearCrates(): void {
    if (this.crates.count > 0) this.groundDirty = true
    this.crates.clear()
  }

  // ---- 突然死亡 ----

  addClosingWall(ci: number, now: number): void {
    const { x, z } = this.cfg.toWorld(ci % this.cfg.gridW, Math.floor(ci / this.cfg.gridW))
    this.closing.set(ci, { x, z, born: now, done: false })
    this.groundDirty = true
    this.sudden.put(ci, { x, y: DROP_FROM, z })
  }

  clearClosingWalls(): void {
    this.closing.clear()
    this.sudden.clear()
  }

  /** 紅色預告格：null 收起；pulse 0..1 */
  setWarning(cell: { cx: number; cy: number } | null, pulse: number): void {
    if (!cell) {
      this.warn.isVisible = false
      return
    }
    const { x, z } = this.cfg.toWorld(cell.cx, cell.cy)
    this.warn.position.set(x, 0, z)
    this.warn.isVisible = true
    this.warnMat.alpha = 0.35 + 0.3 * pulse
  }

  // ---- 子彈 ----

  putBullet(id: string, x: number, z: number, bounced: boolean): void {
    const on = bounced ? this.bounced : this.bullets
    const off = bounced ? this.bullets : this.bounced
    off.remove(id)
    on.put(id, { x, y: BULLET_Y, z })
  }

  removeBullet(id: string): void {
    this.bullets.remove(id)
    this.bounced.remove(id)
  }

  clearBullets(): void {
    this.bullets.clear()
    this.bounced.clear()
  }

  // ---- 道具 ----

  /** bornAt 給了就播出現彈跳（從木箱高度彈起、轉一圈） */
  addItem(key: number | string, kind: ItemKind, cx: number, cy: number, bornAt = -Infinity): void {
    this.removeItem(key)
    const { x, z } = this.cfg.toWorld(cx, cy)
    this.itemRecs.set(key, { kind, x, z, born: bornAt })
  }

  removeItem(key: number | string): void {
    if (this.itemRecs.has(key)) {
      this.items.remove(key)
      this.iconSlots.remove(key)
    }
    this.itemRecs.delete(key)
  }

  clearItems(): void {
    this.items.clear()
    this.iconSlots.clear()
    this.itemRecs.clear()
  }

  // ---- blob 影 ----

  putBlob(key: string, x: number, z: number, size: number): void {
    this.blobs.put(key, { x, y: 0, z, sx: size, sy: 1, sz: size })
  }

  clearBlobs(): void {
    this.blobs.clear()
  }

  /** 道具位置（blob 影用） */
  itemSpots(): { key: string; x: number; z: number }[] {
    return [...this.itemRecs].map(([k, r]) => ({ key: `item-${k}`, x: r.x, z: r.z }))
  }

  // ---- 每幀 ----

  update(now: number): void {
    const { cell } = this.cfg
    for (const [key, r] of this.itemRecs) {
      const hop = itemHop((now - r.born) / ITEM_HOP_MS, cell)
      const y = ITEM_Y + Math.sin(now * 0.004 + r.x) * ITEM_BOB + hop.lift
      const yaw = Math.sin(now * 0.002 + r.x + r.z) * 0.5 + hop.spin
      this.items.put(key, { x: r.x, y, z: r.z, pitch: ITEM_PITCH, yaw })
      if (!this.iconSlots.has(key)) {
        const icon = ITEM_ORDER.indexOf(r.kind)
        this.iconSlots.add(key)
        this.iconSlots.write(key, (buf, o) => (buf[o] = icon))
      }
    }
    alignIconSlots(this.items.slots, this.iconSlots, (k) => ITEM_ORDER.indexOf(this.itemRecs.get(k)?.kind ?? 'hp'))
    for (const [ci, w] of this.closing) {
      if (w.done) continue
      const t = (now - w.born) / DROP_MS
      if (t < 1) {
        this.sudden.put(ci, { x: w.x, y: DROP_FROM * (1 - t * t), z: w.z })
        continue
      }
      const u = (now - w.born - DROP_MS) / LAND_MS
      if (u >= 1) {
        w.done = true
        this.sudden.put(ci, { x: w.x, y: 0, z: w.z })
        continue
      }
      // 落地回彈：0.85 → 1.04 → 1
      const s = u < 0.5 ? 0.85 + 0.19 * easeOut(u / 0.5) : 1.04 - 0.04 * ((u - 0.5) / 0.5)
      this.sudden.put(ci, { x: w.x, y: 0, z: w.z, sy: s })
    }
    if (this.groundDirty && this.groundTex) {
      drawGroundTexture(this.groundTex, this.cfg.gridW, this.cfg.gridH, this.shadowed)
      this.groundDirty = false
    }
    this.syncAll()
  }

  private syncAll(): void {
    for (const g of this.groups) g.sync()
    // 道具圖示屬性：在 matrix 之後上傳（buffer 擴充過就重新綁定）
    const ic = this.iconSlots
    if (!ic.dirty) return
    if (this.iconVersion !== ic.bufferVersion) {
      this.items.mesh.thinInstanceSetBuffer(ITEM_ICON_ATTR, ic.buffer, 1, false)
      this.iconVersion = ic.bufferVersion
    } else {
      this.items.mesh.thinInstanceBufferUpdated(ITEM_ICON_ATTR)
    }
    ic.dirty = false
  }

  dispose(): void {
    for (const g of this.groups) g.dispose()
    this.groups = []
    for (const m of this.meshes) m.dispose()
    this.meshes = []
    this.groundTex?.dispose()
    this.groundTex = null
    for (const m of this.mats) m.dispose()
    for (const t of this.textures) t.dispose()
    this.mats = []
    this.toonMats = []
    this.textures = []
    this.itemRecs.clear()
    this.closing.clear()
  }
}
