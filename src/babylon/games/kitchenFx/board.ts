/**
 * 廚房快手場景物件（kitchen spec §5／§6）：地面 1 個 mesh、牆 1 個 mesh、一般檯面一組 thin instance、
 * 站點本體（食材箱、爐台＋鍋、出餐台、盤架）合併成 1 個靜態 mesh，砧板一組 thin instance、鈴 1 個 mesh；
 * 物品 8 種（kind × ing）各兩組 thin instance（站點上一組、手上一組：只有手上的投影）。
 * 遊戲邏輯留在 overcooked.ts，這裡只管畫；光影登記交給 fx/look（fxTargets）。
 */
import { Color3, MeshBuilder, StandardMaterial, type DynamicTexture, type Mesh, type Scene } from '@/babylon/babylonCore'
import { mergeData, roundedBox, type MeshData, type Trs } from '@/babylon/fx/geometry'
import { at, rgba, solid, toMesh } from '@/babylon/fx/models'
import { ThinGroup } from '@/babylon/fx/thin'
import type { Item, StationDef } from '@/babylon/games/overcookedKitchen'
import { ITEM_KEYS, itemKey, type ItemKey } from '@/babylon/games/kitchenFx/pose'
import {
  bellData,
  boardData,
  burnerOnData,
  counterData,
  crateData,
  emberDotsData,
  itemData,
  plateStackData,
  potAlarmRimData,
  SOUP_Y,
  serveData,
  soupDiscData,
  stoveData,
} from '@/babylon/games/kitchenFx/models'
import { KITCHEN } from '@/babylon/games/kitchenFx/palette'
import {
  createCounterAtlas,
  createKitchenGroundTexture,
  createWallTexture,
  createWindowTexture,
  WALL_WHITE_UV,
} from '@/babylon/games/kitchenFx/textures'

export interface KitchenBoardConfig {
  gridW: number
  gridH: number
  cell: number
  stations: readonly StationDef[]
  toWorld: (cx: number, cy: number) => { x: number; z: number }
}

export interface KitchenFxTargets {
  toon: StandardMaterial[]
  receivers: Mesh[]
  casters: Mesh[]
  outlined: Mesh[]
  glow: { mesh: Mesh; color: string; strength: number }[]
}

interface PotParts {
  disc: Mesh
  discMat: StandardMaterial
  burner: Mesh
  alarm: Mesh
  embers: Mesh
}

/** 檯面頂高（沿用 oc 的 CELL * 0.6） */
export const counterTop = (cell: number): number => cell * 0.6
/** 砧板頂面比檯面高多少（物品放在上面） */
const BOARD_TOP = 0.16
/** 手上物品縮放 */
export const HAND_SCALE = 0.85
const WALL_T = 0.3
const BACK_H = 3.2
const SIDE_H = 1.5
const FRONT_H = 0.45
const DISC_EMPTY = '#2F3350'
/** 盤架裝飾所在格（spec §5：(6,0) 疊 3 個白盤，純外觀）；這格同時是一般存放格 */
const PLATE_CELL = { cx: 6, cy: 0 } as const
/** 盤架疊起來的高度（plateStackData 3 盤＋盤緣約 0.3）：放在這格的物品要墊在盤子上，不然會穿模 */
const PLATE_STACK_H = 0.3

type ItemSet = Record<ItemKey, ThinGroup<string>>

export class KitchenBoard {
  private readonly scene: Scene
  private readonly cfg: KitchenBoardConfig
  private textures: DynamicTexture[] = []
  private mats: StandardMaterial[] = []
  private meshes: Mesh[] = []
  private groups: ThinGroup<string>[] = []
  private toonMats: StandardMaterial[] = []
  private receivers: Mesh[] = []
  private outlined: Mesh[] = []
  private glow: { mesh: Mesh; color: string; strength: number }[] = []
  private stationItems!: ItemSet
  private handItems!: ItemSet
  /** 實例 key → 目前所在群組 */
  private itemAt = new Map<string, { set: ItemSet; key: ItemKey }>()
  private pots = new Map<string, PotParts>()
  private boards!: ThinGroup<string>
  private bell!: Mesh
  private readonly top: number
  private plateId: string | null = null

  constructor(scene: Scene, cfg: KitchenBoardConfig) {
    this.scene = scene
    this.cfg = cfg
    this.top = counterTop(cfg.cell)
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

  private mesh(name: string, d: MeshData, mat: StandardMaterial): Mesh {
    const m = toMesh(name, d, this.scene)
    m.material = mat
    this.meshes.push(m)
    return m
  }

  private group(name: string, d: MeshData, mat: StandardMaterial, capacity: number): ThinGroup<string> {
    const g = new ThinGroup<string>(this.mesh(name, d, mat), capacity)
    this.groups.push(g)
    return g
  }

  private build(): void {
    const { scene } = this
    const { gridW, gridH, cell, stations, toWorld } = this.cfg
    const gw = gridW * cell
    const gh = gridH * cell
    const top = this.top

    // 地面：1 個 mesh + 程式棋盤（含靠檯面 AO）
    const groundTex = createKitchenGroundTexture(scene, gridW, gridH)
    this.textures.push(groundTex)
    const ground = MeshBuilder.CreateGround('kitchen-ground', { width: gw, height: gh }, scene)
    ground.material = this.mat('kitchen-ground-mat', (m) => {
      m.diffuseTexture = groundTex
    })
    this.meshes.push(ground)
    this.receivers.push(ground)

    // 牆：背牆（cy=0 那一側，磁磚貼圖）＋兩側與前方的紫色矮牆，合併成 1 個 mesh
    const backSign = Math.sign(toWorld(0, 0).z) || 1
    const serve = stations.find((s) => s.kind === 'serve')
    const plates = stations.find((s) => s.cx === PLATE_CELL.cx && s.cy === PLATE_CELL.cy)
    this.plateId = plates?.id ?? null
    const serveX = serve ? toWorld(serve.cx, serve.cy).x : 0
    const windowY0 = top + 0.35
    const windowY1 = top + 1.25
    const wallW = gw + WALL_T * 2
    const { tex: wallTex, faceUV } = createWallTexture(scene, {
      width: wallW,
      height: BACK_H,
      serveX,
      windowY0,
      windowY1,
      plateX: plates ? toWorld(plates.cx, plates.cy).x : 2,
    })
    this.textures.push(wallTex)
    const wallMat = this.mat('kitchen-wall-mat', (m) => {
      m.diffuseTexture = wallTex
    })
    const white = WALL_WHITE_UV
    // 背牆正面朝廚房：背牆在 +z 時是 −Z 面（面序 index 1）
    const backFaces = [white, white, white, white, white, white]
    backFaces[backSign > 0 ? 1 : 0] = faceUV
    const capTop = rgba(KITCHEN.wallCapTop)
    const capSide = rgba(KITCHEN.wallCapSide)
    const purple = (d: MeshData) => solid(d, capSide)
    const box = (w: number, h: number, dd: number, faces: typeof backFaces = [white, white, white, white, white, white]) =>
      roundedBox({ width: w, height: h, depth: dd, radius: 0.04, segments: 1, faceUV: faces })
    const zBack = backSign * (gh / 2 + WALL_T / 2)
    const walls: MeshData[] = [
      at(box(wallW, BACK_H, WALL_T, backFaces), { x: 0, y: BACK_H / 2, z: zBack }),
      at(solid(box(wallW + 0.12, 0.22, WALL_T + 0.16), capTop), { x: 0, y: BACK_H + 0.08, z: zBack }),
      at(purple(box(wallW, FRONT_H, WALL_T)), { x: 0, y: FRONT_H / 2, z: -zBack }),
    ]
    for (const sx of [-1, 1]) {
      walls.push(at(purple(box(WALL_T, SIDE_H, gh + WALL_T * 2)), { x: sx * (gw / 2 + WALL_T / 2), y: SIDE_H / 2, z: 0 }))
      walls.push(at(solid(box(WALL_T + 0.12, 0.16, gh + WALL_T * 2 + 0.12), capTop), { x: sx * (gw / 2 + WALL_T / 2), y: SIDE_H + 0.05, z: 0 }))
    }
    const wall = this.mesh('kitchen-walls', mergeData(walls), wallMat)
    this.receivers.push(wall)

    // 出餐暖光窗（背牆上、出餐口正後方；emissive，進 Glow 白名單）
    if (serve) {
      const winTex = createWindowTexture(scene)
      this.textures.push(winTex)
      const winMat = this.mat(
        'kitchen-window-mat',
        (m) => {
          m.emissiveTexture = winTex
          m.diffuseColor = Color3.Black()
          m.disableLighting = true
        },
        false
      )
      const win = MeshBuilder.CreatePlane('kitchen-window', { width: 1.9, height: windowY1 - windowY0 }, scene)
      win.material = winMat
      win.position.set(serveX, (windowY0 + windowY1) / 2, zBack - backSign * (WALL_T / 2 + 0.01))
      if (backSign < 0) win.rotation.y = Math.PI
      this.meshes.push(win)
      this.glow.push({ mesh: win, color: '#FFC46A', strength: 0.55 })
    }

    // 檯面：外圈（爐台以外）一組 thin instance；頂面與櫃門走圖集
    const atlas = createCounterAtlas(scene)
    this.textures.push(atlas)
    const counterMat = this.mat('kitchen-counter-mat', (m) => {
      m.diffuseTexture = atlas
    })
    const counters = this.group('kitchen-counters', counterData(cell), counterMat, 32)
    // 站點本體與物品：頂點色材質（共用）
    const vcMat = this.mat('kitchen-vc-mat', (m) => {
      m.diffuseColor = Color3.White()
      m.specularColor = new Color3(0.25, 0.25, 0.25)
      m.specularPower = 48
    })
    const statics: MeshData[] = []
    this.boards = this.group('kitchen-boards', boardData(), vcMat, 2)

    for (const s of stations) {
      const { x, z } = toWorld(s.cx, s.cy)
      if (s.kind !== 'pot') counters.put(s.id, { x, y: 0, z })
      if (s.kind === 'crate') statics.push(at(crateData(s.ing ?? 'v'), { x, y: top, z }))
      else if (s.kind === 'board') this.boards.put(s.id, { x, y: top, z })
      else if (s.kind === 'serve') statics.push(at(serveData(), { x, y: top, z }))
      else if (s.kind === 'pot') {
        statics.push(at(stoveData(), { x, y: top, z }), at(counterBase(cell), { x, y: 0, z }))
        this.buildPot(s.id, x, z)
      } else if (plates && s.id === plates.id) statics.push(at(plateStackData(), { x, y: top, z }))
    }
    const stat = this.mesh('kitchen-stations', mergeData(statics), vcMat)
    this.receivers.push(stat, counters.mesh, this.boards.mesh)
    this.outlined.push(stat, this.boards.mesh)

    // 服務鈴（波 3 回彈）
    if (serve) {
      const { x, z } = toWorld(serve.cx, serve.cy)
      this.bell = this.mesh('kitchen-bell', bellData(), vcMat)
      this.bell.position.set(x + 0.5, top + 0.3, z + 0.1)
      this.outlined.push(this.bell)
      this.glow.push({ mesh: this.bell, color: '#FFD23F', strength: 0 })
    }

    // 物品：8 種 × 站點／手上
    const mk = (prefix: string, cap: number): ItemSet => {
      const set = {} as ItemSet
      for (const k of ITEM_KEYS) {
        const [kind, ing] = k.split('-') as [Item['kind'], Item['ing']]
        set[k] = this.group(`kitchen-${prefix}-${k}`, itemData(kind, ing), vcMat, cap)
        this.outlined.push(set[k].mesh)
      }
      return set
    }
    this.stationItems = mk('item', 8)
    this.handItems = mk('hand', 4)

    // 食材箱上的食材堆（5 顆縮小的生食材）
    const pile: [number, number, number][] = [
      [-0.42, 0, -0.2],
      [0.0, 0, -0.26],
      [0.42, 0, -0.18],
      [-0.2, 0.06, 0.22],
      [0.24, 0.06, 0.2],
    ]
    for (const s of stations) {
      if (s.kind !== 'crate') continue
      const { x, z } = toWorld(s.cx, s.cy)
      pile.forEach(([dx, dy, dz], i) =>
        this.putItem(this.stationItems, `crate:${s.id}:${i}`, { kind: 'raw', ing: s.ing ?? 'v' }, { x: x + dx, y: top + 0.44 + dy, z: z + dz, yaw: i * 1.3, sx: 0.62, sy: 0.62, sz: 0.62 })
      )
    }
  }

  private buildPot(id: string, x: number, z: number): void {
    const top = this.top
    const discMat = this.mat(`kitchen-soup-${id}`, (m) => {
      m.diffuseColor = Color3.FromHexString(DISC_EMPTY)
      m.specularColor = new Color3(0.3, 0.3, 0.3)
      m.specularPower = 32
    })
    const disc = this.mesh(`kitchen-soup-${id}`, soupDiscData(), discMat)
    disc.position.set(x, top + SOUP_Y, z)
    this.receivers.push(disc)
    const emissive = (name: string, hex: string) =>
      this.mat(
        name,
        (m) => {
          m.emissiveColor = Color3.FromHexString(hex)
          m.diffuseColor = Color3.Black()
          m.disableLighting = true
        },
        false
      )
    const burner = this.mesh(`kitchen-burner-${id}`, burnerOnData(), emissive(`kitchen-burner-mat-${id}`, KITCHEN.burnerOn))
    burner.position.set(x, top, z)
    burner.isVisible = false
    this.glow.push({ mesh: burner, color: KITCHEN.burnerOn, strength: 0.6 })
    const alarm = this.mesh(`kitchen-alarm-${id}`, potAlarmRimData(), emissive(`kitchen-alarm-mat-${id}`, '#FF3B4E'))
    alarm.position.set(x, top, z)
    alarm.isVisible = false
    this.glow.push({ mesh: alarm, color: '#FF3B4E', strength: 1 })
    const embers = this.mesh(`kitchen-embers-${id}`, emberDotsData(), emissive(`kitchen-ember-mat-${id}`, KITCHEN.crack))
    embers.position.set(x, top + SOUP_Y + 0.02, z)
    embers.isVisible = false
    this.pots.set(id, { disc, discMat, burner, alarm, embers })
  }

  private putItem(set: ItemSet, id: string, item: Item | null, t: Trs): void {
    const cur = this.itemAt.get(id)
    const key = item ? itemKey(item) : null
    if (cur && (cur.set !== set || cur.key !== key)) {
      cur.set[cur.key].remove(id)
      this.itemAt.delete(id)
    }
    if (!item || !key) return
    set[key].put(id, t)
    this.itemAt.set(id, { set, key })
  }

  // ---- 每幀 ----

  /** 站點存放格：檯面／砧板放物品實例；鍋改湯面顏色、開火爐圈、焦了的 ember */
  setSlot(st: StationDef, item: Item | null): void {
    const { x, z } = this.cfg.toWorld(st.cx, st.cy)
    if (st.kind === 'pot') {
      const p = this.pots.get(st.id)
      if (!p) return
      const hex = !item ? DISC_EMPTY : item.kind === 'burnt' ? KITCHEN.burnt : item.ing === 'v' ? KITCHEN.soupV : KITCHEN.soupM
      p.discMat.diffuseColor.copyFrom(Color3.FromHexString(hex))
      p.burner.isVisible = item?.kind === 'chop' || item?.kind === 'soup'
      p.embers.isVisible = item?.kind === 'burnt'
      return
    }
    const y = this.top + (st.kind === 'board' ? BOARD_TOP : st.id === this.plateId ? PLATE_STACK_H : 0)
    const dx = st.kind === 'board' ? -0.12 : 0
    this.putItem(this.stationItems, `slot:${st.id}`, item, { x: x + dx, y, z })
  }

  /** 快焦鍋緣（波 3 脈動；這裡只切顯示） */
  setPotAlarm(stationId: string, on: boolean): void {
    const p = this.pots.get(stationId)
    if (p) p.alarm.isVisible = on
  }

  /** 手上物品（t 由呼叫端依角色胸前位置算好） */
  setHand(playerId: string, item: Item | null, t: Trs): void {
    this.putItem(this.handItems, `hand:${playerId}`, item, { ...t, sx: HAND_SCALE, sy: HAND_SCALE, sz: HAND_SCALE })
  }

  removeHand(playerId: string): void {
    this.putItem(this.handItems, `hand:${playerId}`, null, { x: 0, y: 0, z: 0 })
  }

  /** 所有 thin instance 上傳（每幀一次） */
  update(): void {
    for (const g of this.groups) g.sync()
  }

  fxTargets(): KitchenFxTargets {
    return {
      toon: this.toonMats,
      receivers: this.receivers,
      casters: Object.values(this.handItems).map((g) => g.mesh),
      outlined: this.outlined,
      glow: this.glow,
    }
  }

  get bellMesh(): Mesh | undefined {
    return this.bell
  }

  dispose(): void {
    for (const m of this.meshes) m.dispose()
    for (const m of this.mats) m.dispose()
    for (const t of this.textures) t.dispose()
    this.meshes = []
    this.mats = []
    this.textures = []
    this.groups = []
    this.itemAt.clear()
    this.pots.clear()
  }
}

/** 爐台下方的深色櫃體（取代一般檯面，爐台格不放白鋼檯面） */
const counterBase = (cell: number): MeshData => {
  const h = cell * 0.6
  return at(
    solid(roundedBox({ width: cell * 0.96, height: h, depth: cell * 0.96, radius: cell * 0.05, segments: 2 }), rgba(KITCHEN.counterSide[1])),
    { x: 0, y: h / 2, z: 0 }
  )
}
