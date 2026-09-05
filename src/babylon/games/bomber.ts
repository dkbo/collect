import {
  ArcRotateCamera,
  Color3,
  Color4,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  ParticleSystem,
  StandardMaterial,
  Texture,
  Vector3,
} from '@babylonjs/core'
import type { GameContext, GameModule, GameOverlay } from '@/babylon/types'
import type { GameNetMessage } from '@/core/webrtc'
import { attachFlowAudio, playSfx, stopAllAudio } from '@/babylon/audio'
import { createCountdownPanel, createTextPanel, type TextPanel } from '@/babylon/hud'
import {
  createFixedTicker,
  createGameFlow,
  createOwnershipSync,
  type FixedTicker,
  type GameFlow,
  type OwnershipSync,
} from '@/babylon/net'
import {
  GRID_H,
  GRID_W,
  SPAWN_CORNERS,
  TILE_CRATE,
  TILE_CRATE_HARD,
  TILE_WALL,
  blastCells,
  cellIndex,
  generateMap,
  isBlocked,
} from './bomberMap'

/**
 * 炸彈超人（Phase C，計畫見 .prompts/babylon-multiplayer-games.md §3.2）。
 *
 * 同步模型：Host Authority 事件制——
 * - 位置：各自模擬自己的人（ownership 20Hz 廣播 {x,z}，他人插值）
 * - 地圖：host 播種 seed（reliable + channel open 補送），各端決定性生成
 * - 炸彈：guest 廣播 bombReq → host 驗證 → 廣播 bomb（放置）/ boom（爆炸格、毀箱、擊殺）
 * - 勝負：host 裁決最後生存者 → flow.endGame
 */

/** 自身廣播狀態 */
interface BomberState {
  x: number
  z: number
}

/** 炸彈移動動畫（踢滑行 / 丟拋物）；各端依時間插值 mesh 位置 */
interface BombMotion {
  fromX: number // 起點世界座標
  fromZ: number
  toX: number // 終點世界座標
  toZ: number
  startAt: number // 動畫起始時刻
  endAt: number // 動畫結束時刻
  arc: number // 拋物線高度（0 表示貼地滑行，>0 表示丟出的弧）
}

interface BombInfo {
  cx: number // 目標/當前所在格（動畫進行中即終點格）
  cy: number
  owner: string
  explodeAt: number // host 引爆依據；各端亦用於將爆閃紅提示
  mesh: Mesh
  motion?: BombMotion // 進行中的移動動畫；結束後清除
}

interface FlameInfo {
  mesh: Mesh
  until: number
  bornAt: number
  cx: number
  cy: number
}

interface Standing {
  id: string
  name: string
  alive: boolean
}

/** 多回合計分制的結算 payload（取代直接傳 Standing[]）；host 算好後隨 flow.endGame 廣播。 */
interface RoundResult {
  standings: Standing[] // 本局名次（沿用既有計算）
  scores: { id: string; name: string; score: number }[] // 累積勝場（分數高→低）
  target: number // = MATCH_TARGET
  matchOver: boolean // 是否已有人達標奪冠
  championId: string | null // matchOver 時的冠軍 id
}

type ItemKind = 'bomb' | 'fire' | 'speed' | 'kick' | 'throw' | 'invincible'

interface ItemInfo {
  kind: ItemKind
  mesh: Mesh
}

/** 玩家能力值（每輪重置；吃道具成長） */
interface PlayerStat {
  bombs: number // 同時可放炸彈數上限
  fire: number // 爆炸延伸格數
  speed: number // 移速等級（0 起算）
  kick: boolean // 能否踢炸彈（撞到炸彈時推著滑行）
  throw: boolean // 能否丟炸彈（站在自己炸彈上往面向拋幾格）
  invincibleUntil: number // 無敵到期時間戳（performance.now()，0 表示無）
}

/** 人形角色：root 為位移錨點，四肢相對 root 擺動 */
interface Avatar {
  root: Mesh
  legL: Mesh
  legR: Mesh
  armL: Mesh
  armR: Mesh
  walkPhase: number
  amp: number // 走路擺幅（0~1），停步時平滑歸零
  yaw: number // 面向角度
  prevX: number
  prevZ: number
}

const SIM_HZ = 30
const CELL = 2
const MOVE_SPEED = 5.5
const SPEED_STEP = 0.9 // 每級速度道具增加的移速
const PLAYER_R = 0.55
const BOMB_FUSE_MS = 2000
const BOMB_FLASH_MS = 600 // 將爆前閃紅提示時長
const FLAME_MS = 550
const FLAME_GROW_MS = 90 // 火焰冒出的生長時間
const FLAME_FADE_MS = 180 // 火焰消退的收縮時間
const BOMB_INPUT_COOLDOWN_MS = 250
const SHAKE_MS = 220 // 爆炸相機震動時長

// 道具：初始一顆彈、火力 1，吃道具才成長
const INIT_BOMBS = 1
const INIT_FIRE = 1
const MAX_BOMBS = 6
const MAX_FIRE = 6
const MAX_SPEED_LV = 3
const ITEM_DROP_CHANCE = 0.45 // 木箱炸毀後掉落道具的機率（host 決定）
const INVINCIBLE_MS = 7000 // 無敵 buff 持續時間
const KICK_STEP_MS = 120 // 踢炸彈每滑一格的時間（各端依此插值）
const THROW_HOP_MS = 110 // 丟炸彈每飛一格的時間
const THROW_MAX_TILES = 4 // 丟炸彈最遠飛幾格

// 電腦 AI 調校（皆為 host 端決策用的時間視窗，單位 ms）
const AI_HOT_MS = 850 // 距引爆在此時間內的格視為「即將爆、絕不踏入」
const AI_FLEE_MS = 1500 // 站在會於此時間內爆的格就立刻開逃
const AI_ESCAPE_MARGIN_MS = 280 // 逃離自放炸彈須預留的安全餘裕
const AI_ITEM_MAX_DIST = 8 // 主動撿道具的最遠曼哈頓距離

// 多回合計分制（Best-of-N）：先贏 MATCH_TARGET 場奪冠
const MATCH_TARGET = 3

// 場地縮小・突然死亡：進 playing 後 SUDDEN_DEATH_MS 啟動，每 CLOSE_INTERVAL_MS 由外圈往內落一格牆
const SUDDEN_DEATH_MS = 40000
const CLOSE_INTERVAL_MS = 650

const cellToWorld = (c: number, count: number): number => (c - (count - 1) / 2) * CELL
const worldToCell = (w: number, count: number): number => Math.round(w / CELL + (count - 1) / 2)

class BomberScene implements GameModule {
  readonly gameId = 'bomber'
  private ctx!: GameContext
  private keys = new Set<string>()
  private ticker!: FixedTicker
  private own!: OwnershipSync<BomberState>
  private flow!: GameFlow
  private offOpen: (() => void) | null = null

  private map: Uint8Array = new Uint8Array(GRID_W * GRID_H)
  private crates = new Map<number, Mesh>()
  private bombs = new Map<string, BombInfo>()
  private flames: FlameInfo[] = []
  private items = new Map<number, ItemInfo>() // 場上道具，keyed by cellIndex
  private shakeUntil = 0 // 爆炸相機震動截止時刻

  private state: BomberState = { x: 0, z: 0 }
  private alive = new Map<string, boolean>()
  private deathOrder: string[] = []
  // 多回合計分制：累積勝場（host 權威，跨回合保留，僅 resetMatchScores 歸零）
  private scores = new Map<string, number>()
  // 突然死亡：本局 playing 起始、螺旋落牆進度、上次落牆時刻、已落下的牆 mesh
  private playingSince = 0
  private closeIndex = 0
  private lastClose = 0
  private wasPlaying = false // 偵測 phase 轉入 playing
  private closingWalls: Mesh[] = []
  private lastBombInput = 0
  private lastKickInput = 0
  private bombSeq = 0
  private ownerBombCount = new Map<string, number>()
  private stats = new Map<string, PlayerStat>()
  private resultElapsed = 0
  private lastOverlayKey = '' // 僅在內容變動時才更新 React 覆蓋層

  private selfAvatar?: Avatar
  private peerAvatars = new Map<string, Avatar>()
  // 電腦玩家（補滿至 4 人）：名冊由 host 決定並隨 seed 廣播
  private bots: { id: string; name: string }[] = []
  private botAvatars = new Map<string, Avatar>()
  private botState = new Map<string, { x: number; z: number }>() // host 模擬位置
  private botTarget = new Map<string, { x: number; z: number }>() // guest 插值目標
  private botBombInput = new Map<string, number>() // 每隻 bot 放彈冷卻
  private lastBotBroadcast = 0
  private camera!: ArcRotateCamera
  private hud!: TextPanel
  private banner!: TextPanel
  private crateMat!: StandardMaterial
  private wallMat!: StandardMaterial // 固定柱牆材質，突然死亡落牆重用
  // 木箱皮膚調色盤（共用材質，依 cell hash 挑選，避免每箱新建）
  private crateSkinMats: StandardMaterial[] = []
  private crateHardMat!: StandardMaterial
  private crateHardTrimMat!: StandardMaterial
  private crateDamagedMat!: StandardMaterial
  private flameMat!: StandardMaterial
  private flameCoreMat!: StandardMaterial
  private bombMat!: StandardMaterial
  private bombFlashMat!: StandardMaterial
  private itemBombMat!: StandardMaterial
  private itemFireMat!: StandardMaterial
  private itemSpeedMat!: StandardMaterial
  // 道具美化用調色盤（組合 mesh 共用，避免每顆道具建大量材質）
  private itemMats: Record<string, StandardMaterial> = {}
  private decorations: Mesh[] = []
  private explosionPs: ParticleSystem | null = null
  private debrisPs: ParticleSystem | null = null
  private puffPs: ParticleSystem | null = null
  private sparklePs: ParticleSystem | null = null

  private onKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase()
    this.keys.add(key)
    if (key === ' ' || key === 'enter') this.requestBomb()
    if (key === 'f' || key === 'shift') this.requestThrow()
    if (key === 'r') this.requestRestart()
  }
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase())

  private colorFor(id: string): Color3 {
    let h = 0
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
    return Color3.FromHSV(h % 360, 0.7, 0.9)
  }

  private nameFor(id: string): string {
    return (
      this.ctx.players.find((p) => p.id === id)?.name ??
      this.bots.find((b) => b.id === id)?.name ??
      id.slice(0, 6)
    )
  }

  /** 所有實體（真人 players 在前、bots 在後），上限 4 */
  private entities(): { id: string; name: string }[] {
    return [...this.ctx.players, ...this.bots]
  }

  private isBot(id: string): boolean {
    return id.startsWith('bot-')
  }

  /** host：依真人數量產生 bot 名冊，補滿至 4 人 */
  private makeBots(): { id: string; name: string }[] {
    const count = Math.max(0, Math.min(4, 4 - this.ctx.players.length))
    const bots: { id: string; name: string }[] = []
    for (let i = 0; i < count; i++) bots.push({ id: `bot-${i}`, name: `電腦${i + 1}` })
    return bots
  }

  private isAlive(id: string): boolean {
    return this.alive.get(id) ?? false
  }

  /** 是否處於無敵中（依各端共用的 invincibleUntil 時間戳判定） */
  private isInvincible(id: string): boolean {
    return this.statOf(id).invincibleUntil > performance.now()
  }

  /** 取得玩家能力值（首次存取給初始值） */
  private statOf(id: string): PlayerStat {
    let s = this.stats.get(id)
    if (!s) {
      s = { bombs: INIT_BOMBS, fire: INIT_FIRE, speed: 0, kick: false, throw: false, invincibleUntil: 0 }
      this.stats.set(id, s)
    }
    return s
  }

  /** 某實體當前位置（自己用本地、bot 用模擬/目標位置、其餘遠端用最新插值樣本） */
  private posOf(pid: string): BomberState | null {
    if (pid === this.ctx.selfId) return this.state
    if (this.isBot(pid)) return this.botState.get(pid) ?? this.botTarget.get(pid) ?? null
    return this.own.latestRemote(pid)
  }

  /** 建立人形角色（頭/身/雙臂/雙腿），可走路擺動、面向移動方向 */
  private makePlayer(id: string): Avatar {
    const scene = this.ctx.scene
    const color = this.colorFor(id)

    const bodyMat = new StandardMaterial(`pl-mat-${id}`, scene)
    bodyMat.diffuseColor = color
    const limbMat = new StandardMaterial(`pl-limb-${id}`, scene)
    limbMat.diffuseColor = color.scale(0.55) // 四肢用較深的同色
    const faceMat = new StandardMaterial(`pl-face-${id}`, scene)
    faceMat.diffuseColor = new Color3(0.12, 0.13, 0.18)

    const root = new Mesh(`pl-${id}`, scene)
    root.position.y = 0

    const body = MeshBuilder.CreateBox(`pl-body-${id}`, { width: 0.6, height: 0.55, depth: 0.45 }, scene)
    body.material = bodyMat
    body.parent = root
    body.position.set(0, 0.78, 0)

    const head = MeshBuilder.CreateSphere(`pl-head-${id}`, { diameter: 0.74 }, scene)
    head.material = bodyMat
    head.parent = root
    head.position.set(0, 1.32, 0)

    // 面罩（朝預設正面 +Z），讓面向方向看得出來
    const face = MeshBuilder.CreateBox(`pl-face-${id}`, { width: 0.5, height: 0.22, depth: 0.1 }, scene)
    face.material = faceMat
    face.parent = root
    face.position.set(0, 1.3, 0.33)

    // 經典炸彈人頭盔：淺色半罩 + 天線 + 天線球
    const helmMat = new StandardMaterial(`pl-helm-${id}`, scene)
    helmMat.diffuseColor = Color3.Lerp(color, Color3.White(), 0.35)
    const helm = MeshBuilder.CreateSphere(`pl-helm-${id}`, { diameter: 0.8, slice: 0.5 }, scene)
    helm.material = helmMat
    helm.parent = root
    helm.position.set(0, 1.38, 0)
    const antenna = MeshBuilder.CreateCylinder(`pl-ant-${id}`, { height: 0.22, diameter: 0.05 }, scene)
    antenna.material = faceMat
    antenna.parent = root
    antenna.position.set(0, 1.78, 0)
    const antBall = MeshBuilder.CreateSphere(`pl-antball-${id}`, { diameter: 0.16 }, scene)
    antBall.material = helmMat
    antBall.parent = root
    antBall.position.set(0, 1.92, 0)

    // 電腦玩家細微標記：頭頂小齒輪狀環，與真人區分
    if (id.startsWith('bot-')) {
      const botMat = new StandardMaterial(`pl-bot-${id}`, scene)
      botMat.diffuseColor = new Color3(0.85, 0.85, 0.9)
      botMat.emissiveColor = new Color3(0.4, 0.42, 0.5)
      const ring = MeshBuilder.CreateTorus(`pl-botring-${id}`, { diameter: 0.5, thickness: 0.07, tessellation: 8 }, scene)
      ring.material = botMat
      ring.parent = root
      ring.position.set(0, 2.08, 0)
      ring.rotation.x = Math.PI / 2
    }

    // 雙腿：樞紐設在髖部（腿頂），繞 X 軸前後擺動
    const mkLeg = (sx: number): Mesh => {
      const leg = MeshBuilder.CreateBox(`pl-leg-${sx < 0 ? 'L' : 'R'}-${id}`, { width: 0.26, height: 0.5, depth: 0.3 }, scene)
      leg.material = limbMat
      leg.parent = root
      leg.position.set(sx * 0.16, 0.25, 0)
      leg.setPivotPoint(new Vector3(0, 0.25, 0))
      return leg
    }
    const legL = mkLeg(-1)
    const legR = mkLeg(1)

    // 雙臂：樞紐設在肩部（臂頂），與對側腿同相擺動
    const mkArm = (sx: number): Mesh => {
      const arm = MeshBuilder.CreateBox(`pl-arm-${sx < 0 ? 'L' : 'R'}-${id}`, { width: 0.18, height: 0.46, depth: 0.2 }, scene)
      arm.material = limbMat
      arm.parent = root
      arm.position.set(sx * 0.42, 0.78, 0)
      arm.setPivotPoint(new Vector3(0, 0.23, 0))
      return arm
    }
    const armL = mkArm(-1)
    const armR = mkArm(1)

    return { root, legL, legR, armL, armR, walkPhase: 0, amp: 0, yaw: 0, prevX: 0, prevZ: 0 }
  }

  /** 取得任一實體的化身（自己 / 遠端 / bot） */
  private avatarOf(id: string): Avatar | undefined {
    if (id === this.ctx.selfId) return this.selfAvatar
    return this.peerAvatars.get(id) ?? this.botAvatars.get(id)
  }

  /** 依本幀位移驅動走路擺動與面向（自己與遠端皆共用） */
  private animateAvatar(av: Avatar, dtMs: number): void {
    const dx = av.root.position.x - av.prevX
    const dz = av.root.position.z - av.prevZ
    av.prevX = av.root.position.x
    av.prevZ = av.root.position.z

    const moving = Math.hypot(dx, dz) > dtMs * 0.0005
    if (moving) av.yaw = Math.atan2(dx, dz)
    av.root.rotation.y = av.yaw

    // 擺幅平滑進出，避免起步/停步跳動
    const ease = Math.min(1, dtMs * 0.012)
    av.amp += ((moving ? 1 : 0) - av.amp) * ease
    if (av.amp > 0.01) av.walkPhase += dtMs * 0.013

    const swing = Math.sin(av.walkPhase) * 0.7 * av.amp
    av.legL.rotation.x = swing
    av.legR.rotation.x = -swing
    av.armL.rotation.x = -swing
    av.armR.rotation.x = swing
  }

  // ---- 地圖 ----

  /** 依 (cx,cy,seed) 的決定性 hash（各端一致，不可用 Math.random） */
  private cellHash(cx: number, cy: number): number {
    let h = (this.currentSeed ^ 0x9e3779b1) >>> 0
    h = Math.imul(h ^ cx, 0x85ebca6b) >>> 0
    h = Math.imul(h ^ cy, 0xc2b2ae35) >>> 0
    h ^= h >>> 13
    return h >>> 0
  }

  /** 突然死亡用：由外圈往內、順時針的螺旋格序列（涵蓋整個 GRID_W×GRID_H）。
   *  各端決定性一致（純由 GRID 推導，無隨機），快取避免每幀重算。 */
  private spiralCells(): [number, number][] {
    if (this.spiralCache) return this.spiralCache
    const cells: [number, number][] = []
    let top = 0
    let bottom = GRID_H - 1
    let left = 0
    let right = GRID_W - 1
    while (top <= bottom && left <= right) {
      for (let cx = left; cx <= right; cx++) cells.push([cx, top]) // 上排左→右
      for (let cy = top + 1; cy <= bottom; cy++) cells.push([right, cy]) // 右排上→下
      if (top < bottom) for (let cx = right - 1; cx >= left; cx--) cells.push([cx, bottom]) // 下排右→左
      if (left < right) for (let cy = bottom - 1; cy > top; cy--) cells.push([left, cy]) // 左排下→上
      top++
      bottom--
      left++
      right--
    }
    this.spiralCache = cells
    return cells
  }
  private spiralCache: [number, number][] | null = null

  /** host：所有實體勝場歸零（新比賽開始時呼叫；單局重置不動 scores） */
  private resetMatchScores(): void {
    for (const e of this.entities()) this.scores.set(e.id, 0)
  }

  /** 木箱工廠：軟箱依 hash 挑形狀/皮膚變體；硬箱套用高辨識度「強化」外觀（要炸兩次）。
   *  共用調色盤材質，不每箱新建材質。 */
  private makeCrate(cx: number, cy: number, hard: boolean): Mesh {
    const scene = this.ctx.scene
    const h = this.cellHash(cx, cy)
    const sz = CELL * 0.9
    const wx = cellToWorld(cx, GRID_W)
    const wz = cellToWorld(cy, GRID_H)

    if (hard) {
      // 強化箱：金屬/石材方體 + 四角鉚釘 + 中央箍帶，較亮 edges
      const root = MeshBuilder.CreateBox(`crate-${cx}-${cy}`, { size: sz }, scene)
      root.position = new Vector3(wx, CELL * 0.45, wz)
      root.material = this.crateHardMat
      root.enableEdgesRendering()
      root.edgesWidth = 3.5
      root.edgesColor = new Color4(0.85, 0.8, 0.5, 1)
      // 水平箍帶
      const band = MeshBuilder.CreateBox(`crate-band-${cx}-${cy}`, { width: sz * 1.02, height: sz * 0.16, depth: sz * 1.02 }, scene)
      band.parent = root
      band.material = this.crateHardTrimMat
      // 四角鉚釘
      const d = sz * 0.42
      for (const sx of [-1, 1]) {
        for (const sz2 of [-1, 1]) {
          const rivet = MeshBuilder.CreateSphere(`crate-rivet-${cx}-${cy}-${sx}-${sz2}`, { diameter: sz * 0.16 }, scene)
          rivet.parent = root
          rivet.position.set(sx * d, sz * 0.35, sz2 * d)
          rivet.material = this.crateHardTrimMat
        }
      }
      return root
    }

    // 軟箱：形狀在 方塊 / 圓角體 / 圓柱(木桶) / 略球感 間變化
    const shape = h % 4
    const matIdx = (h >>> 3) % this.crateSkinMats.length
    let m: Mesh
    if (shape === 0) {
      m = MeshBuilder.CreateBox(`crate-${cx}-${cy}`, { size: sz }, scene)
    } else if (shape === 1) {
      // 圓角體（多段、近似圓角箱）
      m = MeshBuilder.CreateBox(`crate-${cx}-${cy}`, { size: sz * 0.92 }, scene)
      m.scaling.set(1, 0.94, 1)
    } else if (shape === 2) {
      // 木桶
      m = MeshBuilder.CreateCylinder(`crate-${cx}-${cy}`, { height: sz, diameterTop: sz * 0.78, diameterBottom: sz * 0.92, tessellation: 12 }, scene)
    } else {
      // 略球感（壓扁球）
      m = MeshBuilder.CreateSphere(`crate-${cx}-${cy}`, { diameter: sz * 0.98, segments: 8 }, scene)
      m.scaling.set(1, 0.86, 1)
    }
    m.position = new Vector3(wx, CELL * 0.45, wz)
    m.material = this.crateSkinMats[matIdx]
    m.enableEdgesRendering()
    m.edgesWidth = 2
    m.edgesColor = new Color4(0.32, 0.2, 0.08, 1)
    return m
  }

  /** 依 seed 重建一輪：地圖/木箱/炸彈/火焰/存活/出生位置全部重置 */
  private applySeed(seed: number): void {
    this.currentSeed = seed // makeCrate 的 cellHash 依此
    this.map = generateMap(seed)

    for (const m of this.crates.values()) m.dispose()
    this.crates.clear()
    for (const b of this.bombs.values()) b.mesh.dispose()
    this.bombs.clear()
    for (const f of this.flames) f.mesh.dispose()
    this.flames = []
    for (const it of this.items.values()) it.mesh.dispose()
    this.items.clear()
    // 突然死亡：場地復原——清掉已落下的牆、重置螺旋進度與計時（scores 不在此清，跨回合保留）
    for (const w of this.closingWalls) w.dispose()
    this.closingWalls = []
    this.closeIndex = 0
    this.lastClose = 0
    this.playingSince = 0
    this.wasPlaying = false
    this.ownerBombCount.clear()
    this.deathOrder = []
    this.stats.clear()
    this.botBombInput.clear()
    const ents = this.entities()
    for (const e of ents) {
      this.alive.set(e.id, true)
      this.stats.set(e.id, { bombs: INIT_BOMBS, fire: INIT_FIRE, speed: 0, kick: false, throw: false, invincibleUntil: 0 })
      if (!this.scores.has(e.id)) this.scores.set(e.id, 0)
    }

    for (let cy = 0; cy < GRID_H; cy++) {
      for (let cx = 0; cx < GRID_W; cx++) {
        const tile = this.map[cellIndex(cx, cy)]
        if (tile !== TILE_CRATE && tile !== TILE_CRATE_HARD) continue
        this.crates.set(cellIndex(cx, cy), this.makeCrate(cx, cy, tile === TILE_CRATE_HARD))
      }
    }

    // 出生角：依 entities 合併排序（players 在前、bots 在後）對應 SPAWN_CORNERS
    const spawnOf = (id: string): { x: number; z: number } => {
      const idx = Math.max(0, ents.findIndex((e) => e.id === id))
      const [cx, cy] = SPAWN_CORNERS[idx % SPAWN_CORNERS.length]
      return { x: cellToWorld(cx, GRID_W), z: cellToWorld(cy, GRID_H) }
    }

    // 自己回出生角
    this.state = spawnOf(this.ctx.selfId)
    this.selfAvatar?.root.setEnabled(true)
    for (const a of this.peerAvatars.values()) a.root.setEnabled(true)

    // bot 化身與位置：依名冊重建（不走 own.remoteIds）
    for (const [id, a] of this.botAvatars) {
      if (this.bots.some((b) => b.id === id)) continue
      a.root.dispose(false, true)
      this.botAvatars.delete(id)
    }
    this.botState.clear()
    this.botTarget.clear()
    for (const b of this.bots) {
      const sp = spawnOf(b.id)
      this.botState.set(b.id, { ...sp })
      this.botTarget.set(b.id, { ...sp })
      let a = this.botAvatars.get(b.id)
      if (!a) {
        a = this.makePlayer(b.id)
        this.botAvatars.set(b.id, a)
      }
      a.root.position.set(sp.x, 0, sp.z)
      a.prevX = sp.x
      a.prevZ = sp.z
      a.root.setEnabled(true)
    }
  }

  /** 玩家目前圓身覆蓋的格（站在炸彈上時允許走出） */
  private overlapCells(px: number, pz: number): Set<number> {
    const cells = new Set<number>()
    for (const ox of [-PLAYER_R, PLAYER_R])
      for (const oz of [-PLAYER_R, PLAYER_R])
        cells.add(cellIndex(worldToCell(px + ox, GRID_W), worldToCell(pz + oz, GRID_H)))
    return cells
  }

  /** 玩家圓身與阻擋格碰撞（牆/木箱/場外/炸彈）。
   *  腳下的炸彈不阻擋（剛放彈可走出），離開該格後才變實體。 */
  private hitBlocked(px: number, pz: number): boolean {
    const standing = this.overlapCells(this.state.x, this.state.z)
    for (const ox of [-PLAYER_R, PLAYER_R]) {
      for (const oz of [-PLAYER_R, PLAYER_R]) {
        const cx = worldToCell(px + ox, GRID_W)
        const cy = worldToCell(pz + oz, GRID_H)
        if (isBlocked(this.map, cx, cy)) return true
        for (const b of this.bombs.values()) {
          if (b.cx === cx && b.cy === cy && !standing.has(cellIndex(cx, cy))) return true
        }
      }
    }
    return false
  }

  /** 找出擋住此次移動的炸彈（供踢炸彈判定用），無則回 null。
   *  只回報非腳下、且非牆/木箱阻擋造成的碰撞炸彈。 */
  private blockingBomb(px: number, pz: number): BombInfo | null {
    const standing = this.overlapCells(this.state.x, this.state.z)
    for (const ox of [-PLAYER_R, PLAYER_R]) {
      for (const oz of [-PLAYER_R, PLAYER_R]) {
        const cx = worldToCell(px + ox, GRID_W)
        const cy = worldToCell(pz + oz, GRID_H)
        if (isBlocked(this.map, cx, cy)) continue
        for (const b of this.bombs.values()) {
          if (b.cx === cx && b.cy === cy && !standing.has(cellIndex(cx, cy)) && !b.motion) return b
        }
      }
    }
    return null
  }

  // ---- 炸彈協議 ----

  /** host 本地套用 + 廣播（host 自己的訊息不會回流） */
  private hostBroadcast(type: string, payload: unknown): void {
    this.ctx.net.broadcast({ game: this.gameId, type, payload })
    this.applyMessage(type, payload)
  }

  /** guest 套用 host 廣播的 bot 位置（更新插值目標，update() 平滑 lerp） */
  private applyBotStates(p: { states: { id: string; x: number; z: number }[] }): void {
    for (const s of p.states) {
      const t = this.botTarget.get(s.id)
      if (t) {
        t.x = s.x
        t.z = s.z
      } else {
        this.botTarget.set(s.id, { x: s.x, z: s.z })
      }
    }
  }

  /** 可重開的時機：結算畫面，或自己已陣亡（觀戰中） */
  private canRestart(): boolean {
    const phase = this.flow.state.phase
    return phase === 'result' || (phase === 'playing' && !this.isAlive(this.ctx.selfId))
  }

  /** 按 R / 結算按鈕：host 直接推進，guest 送請求給 host（由 host 的 hostAdvance 決定走法） */
  private requestRestart(): void {
    if (!this.canRestart()) return
    if (this.ctx.role === 'host') this.hostAdvance()
    else this.ctx.net.broadcast({ game: this.gameId, type: 'restartReq', payload: {} })
  }

  /** host：依當前結算是否 matchOver 決定走法——已奪冠 → 新比賽（清分）；否則 → 下一回合（保留分數）。 */
  private hostAdvance(): void {
    if (this.ctx.role !== 'host') return
    const matchOver = (this.flow.state.result as RoundResult | undefined)?.matchOver ?? false
    if (matchOver) this.hostNewMatch()
    else this.hostNextRound()
  }

  /** host：開新一局共用流程（新地圖 seed + 倒數）；scores 由呼叫端決定是否先清。 */
  private hostStartRound(): void {
    this.resultElapsed = 0
    this.currentSeed = (Math.random() * 0x7fffffff) | 0
    this.bots = this.makeBots()
    this.hostBroadcast('seed', { seed: this.currentSeed, bots: this.bots })
    this.flow.startCountdown(3)
  }

  /** host：下一回合——保留累積勝場 */
  private hostNextRound(): void {
    if (this.ctx.role !== 'host') return
    this.hostStartRound()
  }

  /** host：再來一場——先把勝場歸零 */
  private hostNewMatch(): void {
    if (this.ctx.role !== 'host') return
    this.resetMatchScores()
    this.hostStartRound()
  }

  /** 依當前階段/存活狀態，推送陣亡/結算的覆蓋層 UI（只在內容變動時更新） */
  private syncOverlay(): void {
    const setOverlay = this.ctx.setOverlay
    if (!setOverlay) return

    const phase = this.flow.state.phase
    const dead = !this.isAlive(this.ctx.selfId)
    let overlay: GameOverlay | null = null

    if (phase === 'result') {
      const result = this.flow.state.result as RoundResult | undefined
      const standings = result?.standings ?? []
      const scores = result?.scores ?? []
      const target = result?.target ?? MATCH_TARGET
      const matchOver = result?.matchOver ?? false
      const win = standings[0]?.id === this.ctx.selfId
      // 標題：奪冠 / 本局勝負
      const title = matchOver
        ? `🏆 ${this.nameFor(result?.championId ?? '')} 奪冠！`
        : win
          ? '🏆 本局獲勝！'
          : '💥 本局結束'
      // 副標：先列計分榜（含奪冠目標），再列本局名次
      const scoreLine = scores.length
        ? `📊 勝場（先到 ${target} 勝）：${scores.map((s) => `${s.name} ${s.score}`).join('／')}`
        : ''
      const standLines = standings.map((s, i) => `${i + 1}. ${s.name}${s.alive ? '（生存）' : ''}`)
      overlay = {
        title,
        subtitle: [scoreLine, ...standLines].filter(Boolean).join('\n'),
        actions: [
          {
            label: matchOver ? '🔄 再來一場' : '下一回合',
            onClick: () => this.requestRestart(),
            variant: 'primary',
          },
        ],
      }
    } else if (phase === 'playing' && dead) {
      overlay = {
        title: '💥 你已陣亡',
        subtitle: '觀戰中——可立即重開一局',
        actions: [{ label: '🔄 重新開始', onClick: () => this.requestRestart(), variant: 'primary' }],
      }
    }

    const key = overlay ? `${overlay.title}|${overlay.subtitle ?? ''}` : ''
    if (key === this.lastOverlayKey) return
    this.lastOverlayKey = key
    setOverlay(overlay)
  }

  /** 按鍵放彈：host 直接驗證，guest 廣播請求（僅 host 處理） */
  private requestBomb(): void {
    if (this.flow.state.phase !== 'playing' || !this.isAlive(this.ctx.selfId)) return
    const now = performance.now()
    if (now - this.lastBombInput < BOMB_INPUT_COOLDOWN_MS) return
    this.lastBombInput = now
    const cx = worldToCell(this.state.x, GRID_W)
    const cy = worldToCell(this.state.z, GRID_H)
    if (this.ctx.role === 'host') this.validateBomb(this.ctx.selfId, cx, cy)
    else this.ctx.net.broadcast({ game: this.gameId, type: 'bombReq', payload: { cx, cy } })
  }

  /** 按鍵丟彈：站在自己腳下的炸彈上、且具備 throw 能力時，往面向方向拋。
   *  host 直接驗證，guest 送請求附上面向方向（host 不信任 guest 的格子，只取方向）。 */
  private requestThrow(): void {
    if (this.flow.state.phase !== 'playing' || !this.isAlive(this.ctx.selfId)) return
    if (!this.statOf(this.ctx.selfId).throw) return
    const yaw = this.selfAvatar?.yaw ?? 0
    // 面向 → 主軸方向（yaw=atan2(dx,dz)，+Z 為 0）
    const dir = this.yawToDir(yaw)
    if (this.ctx.role === 'host') this.validateThrow(this.ctx.selfId, dir.dx, dir.dy)
    else this.ctx.net.broadcast({ game: this.gameId, type: 'throwReq', payload: { dx: dir.dx, dy: dir.dy } })
  }

  /** 本地偵測撞到炸彈、發起踢炸彈：host 直接驗證模擬，guest 送請求附炸彈格與方向。 */
  private tryKick(px: number, pz: number, dx: number, dy: number): void {
    if (dx === 0 && dy === 0) return
    const bomb = this.blockingBomb(px, pz)
    if (!bomb) return
    const now = performance.now()
    if (now - this.lastKickInput < KICK_STEP_MS) return // 避免同一炸彈每幀重複踢
    this.lastKickInput = now
    if (this.ctx.role === 'host') this.validateKick(bomb, dx, dy)
    else this.ctx.net.broadcast({ game: this.gameId, type: 'kickReq', payload: { cx: bomb.cx, cy: bomb.cy, dx, dy } })
  }

  /** 面向角 → 四方格主軸（取絕對值較大者，化為單位格步進） */
  private yawToDir(yaw: number): { dx: number; dy: number } {
    const fx = Math.sin(yaw)
    const fz = Math.cos(yaw)
    if (Math.abs(fx) >= Math.abs(fz)) return { dx: fx >= 0 ? 1 : -1, dy: 0 }
    return { dx: 0, dy: fz >= 0 ? 1 : -1 }
  }

  /** host：驗證放彈請求，通過即廣播 bomb */
  private validateBomb(owner: string, cx: number, cy: number): void {
    if (this.flow.state.phase !== 'playing' || !this.isAlive(owner)) return
    if (isBlocked(this.map, cx, cy)) return
    for (const b of this.bombs.values()) if (b.cx === cx && b.cy === cy) return
    if ((this.ownerBombCount.get(owner) ?? 0) >= this.statOf(owner).bombs) return
    this.hostBroadcast('bomb', { id: `b${this.bombSeq++}`, cx, cy, owner })
  }

  private applyBomb(p: { id: string; cx: number; cy: number; owner: string }): void {
    playSfx('bomb_place')
    const scene = this.ctx.scene
    const mesh = MeshBuilder.CreateSphere(`bomb-${p.id}`, { diameter: 1.1 }, scene)
    mesh.position = new Vector3(cellToWorld(p.cx, GRID_W), 0.55, cellToWorld(p.cy, GRID_H))
    mesh.material = this.bombMat
    // 頂部引信（子節點，隨炸彈脈動/釋放）
    const fuse = MeshBuilder.CreateCylinder(`bomb-fuse-${p.id}`, { height: 0.35, diameter: 0.1 }, scene)
    fuse.parent = mesh
    fuse.position.set(0.05, 0.62, 0)
    fuse.rotation.z = 0.35
    fuse.material = this.itemFireMat // 橘紅 emissive，像點燃的引信
    this.bombs.set(p.id, {
      cx: p.cx,
      cy: p.cy,
      owner: p.owner,
      explodeAt: performance.now() + BOMB_FUSE_MS,
      mesh,
    })
    this.ownerBombCount.set(p.owner, (this.ownerBombCount.get(p.owner) ?? 0) + 1)
  }

  /** 某格是否可作為炸彈落點（空地、無炸彈、無玩家站位）。
   *  ignoreId：滑行/拋出中忽略自身炸彈所在格。 */
  private cellFreeForBomb(cx: number, cy: number, ignoreId?: string): boolean {
    if (isBlocked(this.map, cx, cy)) return false
    for (const [bid, b] of this.bombs) {
      if (bid === ignoreId) continue
      if (b.cx === cx && b.cy === cy) return false
    }
    for (const e of this.entities()) {
      if (!this.isAlive(e.id)) continue
      const pos = this.posOf(e.id)
      if (!pos) continue
      if (worldToCell(pos.x, GRID_W) === cx && worldToCell(pos.z, GRID_H) === cy) return false
    }
    return true
  }

  /** host：踢炸彈——沿 (dx,dy) 逐格推進直到下一格不可滑行，廣播最終落點與滑行時間。
   *  不在滑行期間提早結束引信；引信到期照常在當前（終點）格爆炸。 */
  private validateKick(bomb: BombInfo, dx: number, dy: number): void {
    if (this.ctx.role !== 'host') return
    if (bomb.motion) return // 已在動中不重複踢
    const id = this.bombIdOf(bomb)
    let tx = bomb.cx
    let ty = bomb.cy
    let steps = 0
    // 一路滑到撞牆/木箱/其他炸彈/場邊/玩家為止（玩家用 cellFreeForBomb 一併擋）
    while (this.cellFreeForBomb(tx + dx, ty + dy, id)) {
      tx += dx
      ty += dy
      steps++
    }
    if (steps === 0) return // 前方就是阻擋，踢不動
    this.hostBroadcast('bombMove', { id, toCx: tx, toCy: ty, durMs: steps * KICK_STEP_MS, arc: 0 })
  }

  /** host：丟炸彈——把站在腳下的自己炸彈往面向拋，越過障礙落在第一個可放置空格。 */
  private validateThrow(owner: string, dx: number, dy: number): void {
    if (this.ctx.role !== 'host') return
    const pos = this.posOf(owner)
    if (!pos) return
    const pcx = worldToCell(pos.x, GRID_W)
    const pcy = worldToCell(pos.z, GRID_H)
    // 找腳下、屬於自己、靜止的炸彈
    let target: BombInfo | null = null
    for (const b of this.bombs.values()) {
      if (b.owner === owner && b.cx === pcx && b.cy === pcy && !b.motion) {
        target = b
        break
      }
    }
    if (!target) return
    // 從相鄰格起，往前找第一個可落點（越過障礙），最多 THROW_MAX_TILES 格
    let landCx = -1
    let landCy = -1
    for (let i = 1; i <= THROW_MAX_TILES; i++) {
      const nx = pcx + dx * i
      const ny = pcy + dy * i
      if (this.cellFreeForBomb(nx, ny, this.bombIdOf(target))) {
        landCx = nx
        landCy = ny
      }
    }
    if (landCx < 0) return // 無可落點
    const tiles = Math.max(Math.abs(landCx - pcx), Math.abs(landCy - pcy))
    this.hostBroadcast('bombMove', {
      id: this.bombIdOf(target),
      toCx: landCx,
      toCy: landCy,
      durMs: tiles * THROW_HOP_MS,
      arc: 0.6 + tiles * 0.35, // 拋物線高度隨距離增加
    })
  }

  /** 反查炸彈 id（bombs 以 id 為 key；BombInfo 未存自身 id 故反查） */
  private bombIdOf(bomb: BombInfo): string {
    for (const [id, b] of this.bombs) if (b === bomb) return id
    return ''
  }

  /** 套用炸彈移動（踢滑行 / 丟拋物）：更新邏輯格與動畫，各端依時間插值。 */
  private applyBombMove(p: { id: string; toCx: number; toCy: number; durMs: number; arc: number }): void {
    const b = this.bombs.get(p.id)
    if (!b) return
    playSfx(p.arc > 0 ? 'bomb_place' : 'pickup')
    const now = performance.now()
    b.motion = {
      fromX: b.mesh.position.x,
      fromZ: b.mesh.position.z,
      toX: cellToWorld(p.toCx, GRID_W),
      toZ: cellToWorld(p.toCy, GRID_H),
      startAt: now,
      endAt: now + Math.max(1, p.durMs),
      arc: p.arc,
    }
    // 邏輯格立即更新為終點（爆炸/連鎖/再踢一律以終點格為準）
    b.cx = p.toCx
    b.cy = p.toCy
  }

  /** host：引爆一顆（含連鎖），逐顆廣播 boom */
  private hostExplode(id: string): void {
    const bomb = this.bombs.get(id)
    if (!bomb) return
    const { cells, destroyed, damaged } = blastCells(this.map, bomb.cx, bomb.cy, this.statOf(bomb.owner).fire)
    const cellSet = new Set(cells.map(([x, y]) => cellIndex(x, y)))

    // 擊殺：所有存活者（自己 + 遠端最新位置）所在格落入火焰即死（無敵中跳過）
    const kills: string[] = []
    for (const e of this.entities()) {
      if (!this.isAlive(e.id) || this.isInvincible(e.id)) continue
      const pos = this.posOf(e.id)
      if (!pos) continue
      const pcx = worldToCell(pos.x, GRID_W)
      const pcy = worldToCell(pos.z, GRID_H)
      if (cellSet.has(cellIndex(pcx, pcy))) kills.push(e.id)
    }

    // 火焰燒毀範圍內既有道具
    const itemKills: [number, number][] = []
    for (const [cx, cy] of cells) {
      if (this.items.has(cellIndex(cx, cy))) itemKills.push([cx, cy])
    }

    // 木箱炸毀後依機率掉落道具（host 決定）。
    // 機率分佈：基礎三種較常見，能力類（踢/丟）較稀有，無敵中等。
    const drops: { cx: number; cy: number; kind: ItemKind }[] = []
    for (const [cx, cy] of destroyed) {
      if (Math.random() >= ITEM_DROP_CHANCE) continue
      const r = Math.random()
      const kind: ItemKind =
        r < 0.26 ? 'bomb'
        : r < 0.52 ? 'fire'
        : r < 0.72 ? 'speed'
        : r < 0.82 ? 'kick'
        : r < 0.9 ? 'throw'
        : 'invincible'
      drops.push({ cx, cy, kind })
    }

    this.hostBroadcast('boom', { id, cells, destroyed, damaged, kills, itemKills, drops })

    // 連鎖：火焰覆蓋到的其他炸彈立即引爆（boom 已套用、地圖已更新）
    for (const [bid, b] of this.bombs) {
      if (cellSet.has(cellIndex(b.cx, b.cy))) this.hostExplode(bid)
    }
  }

  private applyBoom(p: {
    id: string
    cells: [number, number][]
    destroyed: [number, number][]
    damaged?: [number, number][]
    kills: string[]
    itemKills?: [number, number][]
    drops?: { cx: number; cy: number; kind: ItemKind }[]
  }): void {
    playSfx('explosion')
    this.shakeUntil = performance.now() + SHAKE_MS
    const bomb = this.bombs.get(p.id)
    if (bomb) {
      bomb.mesh.dispose()
      this.bombs.delete(p.id)
      const n = (this.ownerBombCount.get(bomb.owner) ?? 1) - 1
      this.ownerBombCount.set(bomb.owner, Math.max(0, n))
    }
    // 爆心火花
    const [ccx, ccy] = p.cells[0]
    this.burst(this.explosionPs, new Vector3(cellToWorld(ccx, GRID_W), 0.8, cellToWorld(ccy, GRID_H)), 40)
    for (const [cx, cy] of p.destroyed) {
      this.map[cellIndex(cx, cy)] = 0
      this.crates.get(cellIndex(cx, cy))?.dispose()
      this.crates.delete(cellIndex(cx, cy))
      // 木箱碎片
      this.burst(this.debrisPs, new Vector3(cellToWorld(cx, GRID_W), 1, cellToWorld(cy, GRID_H)), 14)
    }
    // 硬箱降級：map 由硬箱降為軟箱，mesh 換成受損外觀（重建為軟箱）+ 一小撮碎片
    for (const [cx, cy] of p.damaged ?? []) {
      const ci = cellIndex(cx, cy)
      if (this.map[ci] !== TILE_CRATE_HARD) continue
      this.map[ci] = TILE_CRATE
      this.crates.get(ci)?.dispose()
      const dmg = this.makeCrate(cx, cy, false)
      dmg.material = this.crateDamagedMat
      this.crates.set(ci, dmg)
      this.burst(this.debrisPs, new Vector3(cellToWorld(cx, GRID_W), 1, cellToWorld(cy, GRID_H)), 6)
    }
    // 燒毀既有道具
    for (const [cx, cy] of p.itemKills ?? []) {
      const ci = cellIndex(cx, cy)
      this.items.get(ci)?.mesh.dispose()
      this.items.delete(ci)
    }
    // 掉落新道具
    for (const d of p.drops ?? []) this.spawnItem(d.cx, d.cy, d.kind)
    // 火焰格：中心亮黃、延伸橘紅；生長/收縮動畫於 update 驅動
    const born = performance.now()
    const until = born + FLAME_MS
    p.cells.forEach(([cx, cy], i) => {
      const f = MeshBuilder.CreateBox(`flame-${cx}-${cy}-${p.id}`, { width: CELL * 0.9, height: 0.6, depth: CELL * 0.9 }, this.ctx.scene)
      f.position = new Vector3(cellToWorld(cx, GRID_W), 0.3, cellToWorld(cy, GRID_H))
      f.material = i === 0 ? this.flameCoreMat : this.flameMat
      f.scaling.setAll(0.01) // 從極小生長，避免首幀閃現
      this.flames.push({ mesh: f, until, bornAt: born, cx, cy })
    })
    this.killPlayers(p.kills)
  }

  /** host：突然死亡推進——時間到後，每 CLOSE_INTERVAL_MS 沿螺旋取下一個「尚非牆」的格落牆。
   *  落牆 kills = 站在該格、仍 alive 的所有實體（無視無敵，落牆即死，確保逼出結局）。 */
  private tickSuddenDeath(): void {
    if (this.playingSince === 0) return
    const now = performance.now()
    if (now - this.playingSince <= SUDDEN_DEATH_MS) return
    if (this.lastClose !== 0 && now - this.lastClose < CLOSE_INTERVAL_MS) return
    const spiral = this.spiralCells()
    // 跳過已是牆的格，找下一個可落點
    while (this.closeIndex < spiral.length) {
      const [cx, cy] = spiral[this.closeIndex]
      if (this.map[cellIndex(cx, cy)] === TILE_WALL) {
        this.closeIndex++
        continue
      }
      // 站在該格、仍存活的實體（無視無敵）
      const kills: string[] = []
      for (const e of this.entities()) {
        if (!this.isAlive(e.id)) continue
        const pos = this.posOf(e.id)
        if (!pos) continue
        if (worldToCell(pos.x, GRID_W) === cx && worldToCell(pos.z, GRID_H) === cy) kills.push(e.id)
      }
      this.closeIndex++
      this.lastClose = now
      this.hostBroadcast('closeWall', { cx, cy, kills })
      return
    }
    // index 走完即停止（整張圖已封）
  }

  /** 套用突然死亡落牆（host 本地 + guest 套用）：該格設為牆、清掉既有物件、建落牆 mesh、致死。 */
  private applyCloseWall(p: { cx: number; cy: number; kills: string[] }): void {
    const ci = cellIndex(p.cx, p.cy)
    this.map[ci] = TILE_WALL

    // 清該格既有木箱
    this.crates.get(ci)?.dispose()
    this.crates.delete(ci)
    // 清該格既有道具
    this.items.get(ci)?.mesh.dispose()
    this.items.delete(ci)
    // 清該格既有炸彈（直接 dispose、不引爆；修正 ownerBombCount）
    for (const [bid, b] of [...this.bombs]) {
      if (b.cx === p.cx && b.cy === p.cy) {
        b.mesh.dispose()
        this.bombs.delete(bid)
        const n = (this.ownerBombCount.get(b.owner) ?? 1) - 1
        this.ownerBombCount.set(b.owner, Math.max(0, n))
      }
    }

    // 落下的牆 mesh（重用 wallMat、尺寸同固定柱牆）；由上落下 + 著地縮放動畫
    const scene = this.ctx.scene
    const wx = cellToWorld(p.cx, GRID_W)
    const wz = cellToWorld(p.cy, GRID_H)
    const w = MeshBuilder.CreateBox(`close-${p.cx}-${p.cy}`, { size: CELL * 0.96 }, scene)
    w.material = this.wallMat
    w.enableEdgesRendering()
    w.edgesWidth = 1.5
    w.edgesColor = new Color4(0.25, 0.27, 0.32, 1)
    w.position = new Vector3(wx, CELL * 0.48 + 6, wz) // 從高處落下
    this.closingWalls.push(w)

    // 打擊感：碎片 + 相機震動
    this.burst(this.debrisPs, new Vector3(wx, CELL * 0.5, wz), 12)
    playSfx('explosion')
    this.shakeUntil = performance.now() + SHAKE_MS

    this.killPlayers(p.kills)
  }

  /** 套用陣亡（boom 與 burn 共用）：音效 + 白煙 + 隱藏角色 */
  private killPlayers(kills: string[]): void {
    for (const pid of kills) {
      if (!this.isAlive(pid)) continue
      this.alive.set(pid, false)
      this.deathOrder.push(pid)
      playSfx(pid === this.ctx.selfId ? 'death' : 'kill')
      const av = this.avatarOf(pid)
      if (av) {
        this.burst(this.puffPs, av.root.position.add(new Vector3(0, 1, 0)), 24)
        av.root.setEnabled(false)
      }
    }
  }

  /** 對指定粒子系統在某位置噴一波（fire-and-forget 爆發） */
  private burst(ps: ParticleSystem | null, pos: Vector3, count: number): void {
    if (!ps) return
    ps.emitter = pos.clone()
    ps.manualEmitCount = Math.max(0, ps.manualEmitCount) + count
  }

  /** 道具落地：建立旋轉小物件，存入 items（同格已有則先清除） */
  private spawnItem(cx: number, cy: number, kind: ItemKind): void {
    const ci = cellIndex(cx, cy)
    this.items.get(ci)?.mesh.dispose() // 同格舊道具連同子節點一併清除
    const scene = this.ctx.scene
    const M = this.itemMats

    // root 為位移/旋轉/浮動錨點（自身無幾何）；子節點組成造型，dispose(root) 連帶清除
    const root = new Mesh(`item-${ci}`, scene)
    root.position = new Vector3(cellToWorld(cx, GRID_W), 0.55, cellToWorld(cy, GRID_H))

    const child = (m: Mesh, matKey: string): Mesh => {
      m.parent = root
      m.material = M[matKey]
      return m
    }
    // 共用底座光環：torus 圈 + 中心微亮，無敵另加金色強化
    const ring = MeshBuilder.CreateTorus(`item-ring-${ci}`, { diameter: 0.85, thickness: 0.09, tessellation: 20 }, scene)
    ring.rotation.x = Math.PI / 2
    ring.position.y = -0.35
    child(ring, kind === 'invincible' ? 'gold' : 'ring')

    if (kind === 'bomb') {
      // 小炸彈造型：黑球 + 點燃引信
      const ball = MeshBuilder.CreateSphere(`item-b-${ci}`, { diameter: 0.62 }, scene)
      child(ball, 'dark')
      const fuse = MeshBuilder.CreateCylinder(`item-bf-${ci}`, { height: 0.28, diameter: 0.07 }, scene)
      fuse.position.set(0.06, 0.4, 0)
      fuse.rotation.z = 0.4
      child(fuse, 'cyan')
      const spark = MeshBuilder.CreateSphere(`item-bs-${ci}`, { diameter: 0.16 }, scene)
      spark.position.set(0.12, 0.55, 0)
      child(spark, 'fireHot')
    } else if (kind === 'fire') {
      // 火焰/星形：橘紅水滴 + 內層亮黃 + 上揚尖端
      const flame = MeshBuilder.CreateSphere(`item-f-${ci}`, { diameter: 0.62, slice: 0.85 }, scene)
      flame.scaling.set(1, 1.25, 1)
      child(flame, 'fire')
      const core = MeshBuilder.CreateSphere(`item-fc-${ci}`, { diameter: 0.34 }, scene)
      core.position.y = 0.05
      child(core, 'fireHot')
      const tip = MeshBuilder.CreateCylinder(`item-ft-${ci}`, { height: 0.4, diameterTop: 0, diameterBottom: 0.32 }, scene)
      tip.position.y = 0.42
      child(tip, 'fire')
    } else if (kind === 'speed') {
      // 翅膀/箭頭：黃色箭頭主體 + 兩側白翼
      const arrow = MeshBuilder.CreateCylinder(`item-s-${ci}`, { height: 0.6, diameterTop: 0, diameterBottom: 0.46, tessellation: 4 }, scene)
      child(arrow, 'yellow')
      for (const sx of [-1, 1]) {
        const wing = MeshBuilder.CreateBox(`item-sw${sx}-${ci}`, { width: 0.38, height: 0.06, depth: 0.22 }, scene)
        wing.position.set(sx * 0.28, 0.02, -0.05)
        wing.rotation.z = sx * 0.5
        child(wing, 'wing')
      }
    } else if (kind === 'kick') {
      // 踢：靴子（鞋身 + 鞋頭）+ 方向箭環
      const boot = MeshBuilder.CreateBox(`item-k-${ci}`, { width: 0.34, height: 0.4, depth: 0.3 }, scene)
      boot.position.y = 0.05
      child(boot, 'boot')
      const toe = MeshBuilder.CreateBox(`item-kt-${ci}`, { width: 0.34, height: 0.18, depth: 0.34 }, scene)
      toe.position.set(0, -0.12, 0.28)
      child(toe, 'boot')
      const arrow = MeshBuilder.CreateCylinder(`item-ka-${ci}`, { height: 0.3, diameterTop: 0, diameterBottom: 0.26, tessellation: 4 }, scene)
      arrow.rotation.x = Math.PI / 2
      arrow.position.set(0, 0.05, 0.5)
      child(arrow, 'wing')
    } else if (kind === 'throw') {
      // 丟：手套（掌 + 拇指）+ 上方拋出的小球（拋物提示）
      const palm = MeshBuilder.CreateBox(`item-t-${ci}`, { width: 0.4, height: 0.34, depth: 0.22 }, scene)
      child(palm, 'glove')
      const thumb = MeshBuilder.CreateBox(`item-tt-${ci}`, { width: 0.12, height: 0.22, depth: 0.18 }, scene)
      thumb.position.set(-0.24, 0.06, 0)
      thumb.rotation.z = 0.5
      child(thumb, 'glove')
      const proj = MeshBuilder.CreateSphere(`item-tp-${ci}`, { diameter: 0.24 }, scene)
      proj.position.set(0.1, 0.42, 0)
      child(proj, 'dark')
    } else {
      // 無敵：金色星核 + 護盾光環（更醒目）
      const star = MeshBuilder.CreateSphere(`item-i-${ci}`, { diameter: 0.52 }, scene)
      child(star, 'gold')
      const shield = MeshBuilder.CreateTorus(`item-is-${ci}`, { diameter: 0.78, thickness: 0.1, tessellation: 24 }, scene)
      child(shield, 'shield')
      const shield2 = MeshBuilder.CreateTorus(`item-is2-${ci}`, { diameter: 0.78, thickness: 0.1, tessellation: 24 }, scene)
      shield2.rotation.z = Math.PI / 2
      child(shield2, 'shield')
    }

    this.items.set(ci, { kind, mesh: root })
  }

  /** host：偵測站到道具上的存活玩家，發放並廣播 pickup */
  private detectPickups(): void {
    if (this.items.size === 0) return
    for (const e of this.entities()) {
      if (!this.isAlive(e.id)) continue
      const pos = this.posOf(e.id)
      if (!pos) continue
      const ci = cellIndex(worldToCell(pos.x, GRID_W), worldToCell(pos.z, GRID_H))
      if (this.items.has(ci)) this.hostBroadcast('pickup', { ci, who: e.id })
    }
  }

  /** 套用拾取：移除道具、提升該玩家能力值（上限封頂） */
  private applyPickup(p: { ci: number; who: string }): void {
    const it = this.items.get(p.ci)
    if (!it) return
    playSfx('pickup')
    this.burst(this.sparklePs, it.mesh.position.clone(), 14)
    it.mesh.dispose()
    this.items.delete(p.ci)
    const s = this.statOf(p.who)
    if (it.kind === 'bomb') s.bombs = Math.min(MAX_BOMBS, s.bombs + 1)
    else if (it.kind === 'fire') s.fire = Math.min(MAX_FIRE, s.fire + 1)
    else if (it.kind === 'speed') s.speed = Math.min(MAX_SPEED_LV, s.speed + 1)
    else if (it.kind === 'kick') s.kick = true
    else if (it.kind === 'throw') s.throw = true
    else if (it.kind === 'invincible') s.invincibleUntil = performance.now() + INVINCIBLE_MS
  }

  /** 收到網路訊息（含 host 本地回放）統一入口 */
  private applyMessage(type: string, payload: unknown): void {
    if (type === 'seed') {
      const p = payload as { seed: number; bots?: { id: string; name: string }[] }
      this.bots = p.bots ?? []
      this.applySeed(p.seed)
    } else if (type === 'bots') this.applyBotStates(payload as { states: { id: string; x: number; z: number }[] })
    else if (type === 'bomb') this.applyBomb(payload as Parameters<BomberScene['applyBomb']>[0])
    else if (type === 'boom') this.applyBoom(payload as Parameters<BomberScene['applyBoom']>[0])
    else if (type === 'burn') this.killPlayers((payload as { kills: string[] }).kills)
    else if (type === 'pickup') this.applyPickup(payload as Parameters<BomberScene['applyPickup']>[0])
    else if (type === 'bombMove') this.applyBombMove(payload as Parameters<BomberScene['applyBombMove']>[0])
    else if (type === 'closeWall') this.applyCloseWall(payload as Parameters<BomberScene['applyCloseWall']>[0])
  }

  onNetworkMessage(from: string, msg: GameNetMessage): void {
    if (msg.game !== this.gameId) return
    if (msg.type === 'bombReq') {
      if (this.ctx.role !== 'host') return
      const p = msg.payload as { cx: number; cy: number }
      this.validateBomb(from, p.cx, p.cy)
      return
    }
    if (msg.type === 'kickReq') {
      // guest 送踢炸彈請求：host 依目前炸彈狀態重新驗證（不信任 guest 格子，僅用方向）
      if (this.ctx.role !== 'host') return
      if (!this.statOf(from).kick) return
      const p = msg.payload as { cx: number; cy: number; dx: number; dy: number }
      let bomb: BombInfo | null = null
      for (const b of this.bombs.values()) {
        if (b.cx === p.cx && b.cy === p.cy && !b.motion) {
          bomb = b
          break
        }
      }
      if (bomb) this.validateKick(bomb, Math.sign(p.dx), Math.sign(p.dy))
      return
    }
    if (msg.type === 'throwReq') {
      // guest 送丟炸彈請求：host 依該玩家當前位置與面向驗證
      if (this.ctx.role !== 'host') return
      if (!this.statOf(from).throw) return
      const p = msg.payload as { dx: number; dy: number }
      this.validateThrow(from, Math.sign(p.dx), Math.sign(p.dy))
      return
    }
    if (msg.type === 'restartReq') {
      // 僅在結算中、或請求者已陣亡時受理，避免對局中誤觸重開
      if (this.ctx.role !== 'host') return
      if (this.flow.state.phase === 'result' || !this.isAlive(from)) this.hostAdvance()
      return
    }
    // seed/bomb/boom 僅信任 host 廣播；guest 之間不互發這些訊息
    if (this.ctx.role === 'host') return
    this.applyMessage(msg.type, msg.payload)
  }

  // ---- 生命週期 ----

  init(ctx: GameContext): void {
    this.ctx = ctx
    const { scene } = ctx

    // 固定俯視相機（不開放操作）
    this.camera = new ArcRotateCamera('cam', -Math.PI / 2, 0.55, 30, Vector3.Zero(), scene)
    new HemisphericLight('light', new Vector3(0.2, 1, 0.1), scene)

    // 共用材質
    this.crateMat = new StandardMaterial('crate-mat', scene)
    this.crateMat.diffuseColor = new Color3(0.62, 0.45, 0.22)
    // 木箱皮膚調色盤（數種木質/苔綠/舊木色，共用少量材質）
    const skin = (name: string, c: Color3): StandardMaterial => {
      const m = new StandardMaterial(name, scene)
      m.diffuseColor = c
      return m
    }
    this.crateSkinMats = [
      skin('crate-skin-0', new Color3(0.62, 0.45, 0.22)), // 木質
      skin('crate-skin-1', new Color3(0.72, 0.52, 0.28)), // 淺木
      skin('crate-skin-2', new Color3(0.5, 0.36, 0.18)), // 深木
      skin('crate-skin-3', new Color3(0.42, 0.5, 0.28)), // 苔綠
      skin('crate-skin-4', new Color3(0.58, 0.48, 0.36)), // 舊木
    ]
    // 硬箱：灰金屬／石材主體 + 較亮鉚釘箍帶
    this.crateHardMat = new StandardMaterial('crate-hard-mat', scene)
    this.crateHardMat.diffuseColor = new Color3(0.46, 0.49, 0.55)
    this.crateHardMat.specularColor = new Color3(0.6, 0.62, 0.68)
    this.crateHardTrimMat = new StandardMaterial('crate-hard-trim-mat', scene)
    this.crateHardTrimMat.diffuseColor = new Color3(0.78, 0.72, 0.4)
    this.crateHardTrimMat.emissiveColor = new Color3(0.22, 0.2, 0.1)
    // 硬箱降級後的受損外觀（裂痕色）
    this.crateDamagedMat = new StandardMaterial('crate-damaged-mat', scene)
    this.crateDamagedMat.diffuseColor = new Color3(0.5, 0.38, 0.2)
    this.bombMat = new StandardMaterial('bomb-mat', scene)
    this.bombMat.diffuseColor = new Color3(0.12, 0.12, 0.15)
    this.bombFlashMat = new StandardMaterial('bomb-flash-mat', scene)
    this.bombFlashMat.diffuseColor = new Color3(0.9, 0.15, 0.1)
    this.bombFlashMat.emissiveColor = new Color3(0.7, 0.1, 0.05)
    this.flameMat = new StandardMaterial('flame-mat', scene)
    this.flameMat.emissiveColor = new Color3(1, 0.45, 0.1)
    this.flameMat.disableLighting = true
    this.flameCoreMat = new StandardMaterial('flame-core-mat', scene)
    this.flameCoreMat.emissiveColor = new Color3(1, 0.85, 0.3)
    this.flameCoreMat.disableLighting = true
    // 道具材質：炸彈 up 青色、火力 up 橘紅、速度 up 亮黃，emissive 讓它在地圖上醒目
    this.itemBombMat = new StandardMaterial('item-bomb-mat', scene)
    this.itemBombMat.diffuseColor = new Color3(0.1, 0.6, 0.9)
    this.itemBombMat.emissiveColor = new Color3(0.1, 0.5, 0.85)
    this.itemFireMat = new StandardMaterial('item-fire-mat', scene)
    this.itemFireMat.diffuseColor = new Color3(0.95, 0.35, 0.1)
    this.itemFireMat.emissiveColor = new Color3(0.85, 0.3, 0.05)
    this.itemSpeedMat = new StandardMaterial('item-speed-mat', scene)
    this.itemSpeedMat.diffuseColor = new Color3(0.95, 0.85, 0.15)
    this.itemSpeedMat.emissiveColor = new Color3(0.85, 0.75, 0.1)

    // 道具美化調色盤：組合 mesh 用的發光材質（底座/主體/圖示），各道具共用同一組
    const mat = (name: string, diff: Color3, emis: Color3): StandardMaterial => {
      const m = new StandardMaterial(name, scene)
      m.diffuseColor = diff
      m.emissiveColor = emis
      return m
    }
    this.itemMats = {
      base: mat('it-base', new Color3(0.1, 0.12, 0.18), new Color3(0.05, 0.06, 0.1)), // 深色底座
      ring: mat('it-ring', new Color3(0.85, 0.9, 1), new Color3(0.4, 0.55, 0.85)), // 光環
      dark: mat('it-dark', new Color3(0.1, 0.1, 0.13), new Color3(0.02, 0.02, 0.03)), // 炸彈黑
      cyan: mat('it-cyan', new Color3(0.15, 0.7, 0.95), new Color3(0.1, 0.55, 0.85)),
      fire: mat('it-fire', new Color3(1, 0.45, 0.12), new Color3(0.9, 0.32, 0.06)),
      fireHot: mat('it-firehot', new Color3(1, 0.85, 0.3), new Color3(1, 0.7, 0.2)),
      wing: mat('it-wing', new Color3(0.95, 0.97, 1), new Color3(0.65, 0.72, 0.85)),
      yellow: mat('it-yellow', new Color3(1, 0.9, 0.2), new Color3(0.9, 0.78, 0.12)),
      boot: mat('it-boot', new Color3(0.7, 0.25, 0.2), new Color3(0.4, 0.12, 0.08)),
      glove: mat('it-glove', new Color3(0.95, 0.55, 0.15), new Color3(0.6, 0.32, 0.08)),
      gold: mat('it-gold', new Color3(1, 0.82, 0.2), new Color3(0.95, 0.7, 0.12)),
      shield: mat('it-shield', new Color3(0.4, 0.85, 1), new Color3(0.3, 0.7, 0.95)),
    }

    // 地板 + 固定柱牆（柱牆不隨 seed 變動，建一次即可）
    const ground = MeshBuilder.CreateGround('ground', { width: GRID_W * CELL + 2, height: GRID_H * CELL + 2 }, scene)
    const gmat = new StandardMaterial('gmat', scene)
    gmat.diffuseColor = new Color3(0.16, 0.34, 0.2)
    ground.material = gmat

    // 棋盤格草地（雙色交錯，經典炸彈人場地感）
    const tileA = new StandardMaterial('tile-a', scene)
    tileA.diffuseColor = new Color3(0.24, 0.48, 0.28)
    const tileB = new StandardMaterial('tile-b', scene)
    tileB.diffuseColor = new Color3(0.2, 0.42, 0.24)
    for (let cy = 0; cy < GRID_H; cy++) {
      for (let cx = 0; cx < GRID_W; cx++) {
        const tile = MeshBuilder.CreateBox(`tile-${cx}-${cy}`, { width: CELL * 0.98, height: 0.02, depth: CELL * 0.98 }, scene)
        tile.position = new Vector3(cellToWorld(cx, GRID_W), 0.01, cellToWorld(cy, GRID_H))
        tile.material = (cx + cy) % 2 === 0 ? tileA : tileB
        this.decorations.push(tile)
      }
    }

    // 外圍邊框牆：包住場地
    const borderMat = new StandardMaterial('border-mat', scene)
    borderMat.diffuseColor = new Color3(0.36, 0.4, 0.46)
    const gw = GRID_W * CELL
    const gh = GRID_H * CELL
    const borders = [
      { w: gw + 4, d: 1, x: 0, z: -(gh / 2 + 0.5) },
      { w: gw + 4, d: 1, x: 0, z: gh / 2 + 0.5 },
      { w: 1, d: gh + 2, x: -(gw / 2 + 0.5), z: 0 },
      { w: 1, d: gh + 2, x: gw / 2 + 0.5, z: 0 },
    ]
    for (let i = 0; i < borders.length; i++) {
      const b = borders[i]
      const wall = MeshBuilder.CreateBox(`border-${i}`, { width: b.w, height: 1.3, depth: b.d }, scene)
      wall.position.set(b.x, 0.65, b.z)
      wall.material = borderMat
      wall.enableEdgesRendering()
      wall.edgesWidth = 1.5
      wall.edgesColor = new Color4(0.2, 0.22, 0.27, 1)
      this.decorations.push(wall)
    }

    this.wallMat = new StandardMaterial('wall-mat', scene)
    this.wallMat.diffuseColor = new Color3(0.42, 0.45, 0.5)
    for (let cy = 1; cy < GRID_H; cy += 2) {
      for (let cx = 1; cx < GRID_W; cx += 2) {
        const w = MeshBuilder.CreateBox(`wall-${cx}-${cy}`, { size: CELL * 0.96 }, scene)
        w.position = new Vector3(cellToWorld(cx, GRID_W), CELL * 0.48, cellToWorld(cy, GRID_H))
        w.material = this.wallMat
        w.enableEdgesRendering()
        w.edgesWidth = 1.5
        w.edgesColor = new Color4(0.25, 0.27, 0.32, 1)
      }
    }

    this.initParticles()

    this.selfAvatar = this.makePlayer(ctx.selfId)
    this.hud = createTextPanel(scene, this.camera, 'hud', 3.4, 0.56, new Vector3(0, 2.72, 8), 'glass')
    this.banner = createCountdownPanel(scene, this.camera, 'banner', 7, 4, new Vector3(0, 0.3, 8))

    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)

    this.flow = createGameFlow({ net: ctx.net, game: this.gameId, role: ctx.role })
    attachFlowAudio(this.flow, 'bomber', {
      resultSfx: (r) => ((r as RoundResult | undefined)?.standings?.[0]?.id === ctx.selfId ? 'win' : 'lose'),
    })
    this.flow.onChange((s) => {
      ;(window as unknown as Record<string, unknown>).__BATTLE_PHASE = s.phase
    })
    ;(window as unknown as Record<string, unknown>).__BATTLE_PHASE = this.flow.state.phase

    this.own = createOwnershipSync<BomberState>({ net: ctx.net, game: this.gameId })
    this.own.start(() => ({ ...this.state }))

    this.ticker = createFixedTicker(SIM_HZ, (_t, stepMs) => this.simulate(stepMs / 1000))
    this.ticker.start()

    if (ctx.role === 'host') {
      this.currentSeed = (Math.random() * 0x7fffffff) | 0
      this.bots = this.makeBots()
      this.hostBroadcast('seed', { seed: this.currentSeed, bots: this.bots })
      // 開局當下 guest 通道未開，channel open 時補送 seed（flow 的階段補送由 gameFlow 處理）
      this.offOpen = ctx.net.on('open', (peerId) => {
        ctx.net.send(peerId, { game: this.gameId, type: 'seed', payload: { seed: this.currentSeed, bots: this.bots } })
      })
      this.flow.startCountdown(3)
    } else {
      this.applySeed(1) // 佔位地圖；host 的 seed 到達後重建
    }
  }

  private currentSeed = 1

  /** 四組爆發型粒子系統（爆炸火花/木箱碎片/陣亡白煙/拾取閃光），以 manualEmitCount 觸發 */
  private initParticles(): void {
    const scene = this.ctx.scene
    const px = new Texture(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      scene
    )
    const makeBurst = (
      name: string,
      c1: Color4,
      c2: Color4,
      o: { size: [number, number]; life: [number, number]; power: [number, number]; gravity: number }
    ): ParticleSystem => {
      const ps = new ParticleSystem(name, 150, scene)
      ps.particleTexture = px
      ps.emitter = Vector3.Zero()
      ps.minEmitBox = new Vector3(-0.3, 0, -0.3)
      ps.maxEmitBox = new Vector3(0.3, 0.3, 0.3)
      ps.color1 = c1
      ps.color2 = c2
      ps.colorDead = new Color4(c2.r, c2.g, c2.b, 0)
      ps.minSize = o.size[0]
      ps.maxSize = o.size[1]
      ps.minLifeTime = o.life[0]
      ps.maxLifeTime = o.life[1]
      ps.emitRate = 0
      ps.manualEmitCount = 0
      ps.direction1 = new Vector3(-1, 1, -1)
      ps.direction2 = new Vector3(1, 2.5, 1)
      ps.minEmitPower = o.power[0]
      ps.maxEmitPower = o.power[1]
      ps.updateSpeed = 0.012
      ps.gravity = new Vector3(0, o.gravity, 0)
      ps.blendMode = ParticleSystem.BLENDMODE_STANDARD
      ps.start()
      return ps
    }
    this.explosionPs = makeBurst('explosion-ps', new Color4(1, 0.85, 0.3, 1), new Color4(1, 0.4, 0.05, 1), {
      size: [0.25, 0.5], life: [0.25, 0.5], power: [3, 7], gravity: -4,
    })
    this.debrisPs = makeBurst('debris-ps', new Color4(0.62, 0.45, 0.22, 1), new Color4(0.4, 0.28, 0.12, 1), {
      size: [0.15, 0.3], life: [0.4, 0.7], power: [2, 5], gravity: -9,
    })
    this.puffPs = makeBurst('puff-ps', new Color4(0.95, 0.95, 1, 1), new Color4(0.7, 0.7, 0.8, 1), {
      size: [0.2, 0.45], life: [0.5, 0.9], power: [1, 2.5], gravity: 1.5,
    })
    this.sparklePs = makeBurst('sparkle-ps', new Color4(0.4, 1, 0.9, 1), new Color4(1, 0.95, 0.3, 1), {
      size: [0.12, 0.25], life: [0.3, 0.5], power: [1.5, 3], gravity: -1,
    })
  }

  /** 固定步長：移動 +（host）引信與勝負裁決 */
  private simulate(dt: number): void {
    const playing = this.flow.state.phase === 'playing'

    // 偵測 phase 轉入/離開 playing：記錄本局起始時刻（突然死亡計時依此，各端一致地以本地 now 起算）
    if (playing && !this.wasPlaying) {
      this.playingSince = performance.now()
      this.lastClose = 0
      this.closeIndex = 0
    } else if (!playing && this.wasPlaying) {
      this.playingSince = 0
    }
    this.wasPlaying = playing

    if (playing && this.isAlive(this.ctx.selfId)) {
      const k = this.keys
      const dx = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0)
      const dz = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0)
      if (dx !== 0 || dz !== 0) {
        const len = Math.hypot(dx, dz)
        const speed = MOVE_SPEED + this.statOf(this.ctx.selfId).speed * SPEED_STEP
        const step = (speed * dt) / len
        const canKick = this.statOf(this.ctx.selfId).kick
        const nx = this.state.x + dx * step
        if (!this.hitBlocked(nx, this.state.z)) this.state.x = nx
        else if (canKick && dx !== 0) this.tryKick(nx, this.state.z, Math.sign(dx), 0)
        const nz = this.state.z + dz * step
        if (!this.hitBlocked(this.state.x, nz)) this.state.z = nz
        else if (canKick && dz !== 0) this.tryKick(this.state.x, nz, 0, Math.sign(dz))
      }
    }

    if (this.ctx.role !== 'host' || !playing) return

    // 電腦玩家 AI 模擬（host 權威）
    this.simulateBots(dt)

    // 突然死亡：playing 滿 SUDDEN_DEATH_MS 後，由外圈往內逐格落牆逼出結局（host 權威廣播）
    this.tickSuddenDeath()

    // 道具拾取（host 裁決）
    this.detectPickups()

    // 殘留火焰滯留致死（爆炸瞬間之外，走進未熄的火焰也算）
    if (this.flames.length > 0) {
      const nowBurn = performance.now()
      const burnKills: string[] = []
      for (const e of this.entities()) {
        if (!this.isAlive(e.id) || this.isInvincible(e.id)) continue
        const pos = this.posOf(e.id)
        if (!pos) continue
        const pcx = worldToCell(pos.x, GRID_W)
        const pcy = worldToCell(pos.z, GRID_H)
        if (this.flames.some((f) => f.until > nowBurn && f.cx === pcx && f.cy === pcy)) burnKills.push(e.id)
      }
      if (burnKills.length > 0) this.hostBroadcast('burn', { kills: burnKills })
    }

    // 引信到期 → 引爆（含連鎖）
    const now = performance.now()
    for (const [id, b] of [...this.bombs]) {
      if (b.explodeAt <= now && this.bombs.has(id)) this.hostExplode(id)
    }

    // 勝負：2 實體以上、存活 ≤ 1 → 結算（涵蓋單人 + 電腦）。本局勝者累積一勝；達標即奪冠。
    if (this.entities().length >= 2) {
      const aliveIds = this.entities().filter((e) => this.isAlive(e.id)).map((e) => e.id)
      if (aliveIds.length <= 1) {
        const order = [...aliveIds, ...[...this.deathOrder].reverse()]
        const standings: Standing[] = order.map((id) => ({
          id,
          name: this.nameFor(id),
          alive: this.isAlive(id),
        }))
        // 本局勝者 = standings[0]（存活者或最後陣亡者）；host 為其加一勝
        const winnerId = standings[0]?.id
        if (winnerId) this.scores.set(winnerId, (this.scores.get(winnerId) ?? 0) + 1)
        const winnerScore = winnerId ? (this.scores.get(winnerId) ?? 0) : 0
        const matchOver = winnerScore >= MATCH_TARGET
        const scores = this.entities()
          .map((e) => ({ id: e.id, name: this.nameFor(e.id), score: this.scores.get(e.id) ?? 0 }))
          .sort((a, b) => b.score - a.score)
        const result: RoundResult = {
          standings,
          scores,
          target: MATCH_TARGET,
          matchOver,
          championId: matchOver ? (winnerId ?? null) : null,
        }
        this.flow.endGame(result)
      }
    }

    // bot 位置同步：約 18Hz 廣播給 guest（只信任 host）
    if (this.bots.length > 0 && now - this.lastBotBroadcast > 55) {
      this.lastBotBroadcast = now
      const states = this.bots
        .filter((b) => this.botState.has(b.id))
        .map((b) => {
          const s = this.botState.get(b.id) as { x: number; z: number }
          return { id: b.id, x: s.x, z: s.z }
        })
      this.ctx.net.broadcast({ game: this.gameId, type: 'bots', payload: { states } })
    }
  }

  // ---- 電腦玩家 AI（僅 host）----

  /**
   * 危險時間圖：每格 → 最早會致命的時刻（performance.now 毫秒）。未列入者代表目前安全。
   * - 現存火焰：當下即致命（now）。
   * - 炸彈：以各自引信時刻標記整條爆風；並模擬「連鎖」——某炸彈爆風覆蓋另一炸彈所在格時，
   *   被覆蓋者的有效引爆時刻提前為觸發者的時刻（迭代到收斂）。
   * 有了時間維度，bot 才能分辨「剛放下、還很久才爆」與「即將引爆」的格，不再過度膽小。
   */
  private computeDangerMap(): Map<number, number> {
    const now = performance.now()
    const dmap = new Map<number, number>()
    const setMin = (ci: number, t: number) => {
      const cur = dmap.get(ci)
      if (cur === undefined || t < cur) dmap.set(ci, t)
    }
    for (const f of this.flames) if (f.until > now) setMin(cellIndex(f.cx, f.cy), now)

    const arr = [...this.bombs.values()]
    const eff = arr.map((b) => b.explodeAt)
    const blasts = arr.map((b) =>
      blastCells(this.map, b.cx, b.cy, this.statOf(b.owner).fire).cells.map(([x, y]) => cellIndex(x, y)),
    )
    // 連鎖傳遞：最多迭代 N 輪（N = 炸彈數）即收斂
    for (let iter = 0; iter < arr.length; iter++) {
      let changed = false
      for (let i = 0; i < arr.length; i++) {
        for (let j = 0; j < arr.length; j++) {
          if (i === j) continue
          if (blasts[i].includes(cellIndex(arr[j].cx, arr[j].cy)) && eff[i] < eff[j]) {
            eff[j] = eff[i]
            changed = true
          }
        }
      }
      if (!changed) break
    }
    for (let i = 0; i < arr.length; i++) for (const ci of blasts[i]) setMin(ci, eff[i])
    return dmap
  }

  /** 某格是否可踏入（空地、非阻擋、無炸彈） */
  private cellWalkable(cx: number, cy: number): boolean {
    if (isBlocked(this.map, cx, cy)) return false
    for (const b of this.bombs.values()) if (b.cx === cx && b.cy === cy) return false
    return true
  }

  /**
   * 格圖 BFS：從 (sx,sy) 找到最近滿足 goalFn 的格，回傳第一步鄰格與步數距離。
   * blockedFn 為真的格不可踏入（也不能當終點）。起點滿足 goalFn 或無路徑皆回 null。
   * grid 13×11，每幀每隻 bot 跑成本極低。
   */
  private bfsToGoal(
    sx: number,
    sy: number,
    goalFn: (cx: number, cy: number) => boolean,
    blockedFn: (cx: number, cy: number) => boolean,
  ): { first: [number, number]; dist: number } | null {
    if (goalFn(sx, sy)) return null
    const dirs: [number, number][] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]
    const visited = new Set<number>([cellIndex(sx, sy)])
    const queue: { x: number; y: number; first: [number, number] | null; dist: number }[] = [
      { x: sx, y: sy, first: null, dist: 0 },
    ]
    let head = 0
    while (head < queue.length) {
      const cur = queue[head++]
      for (const [dx, dy] of dirs) {
        const nx = cur.x + dx
        const ny = cur.y + dy
        if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) continue
        const ci = cellIndex(nx, ny)
        if (visited.has(ci)) continue
        if (!this.cellWalkable(nx, ny) || blockedFn(nx, ny)) continue
        visited.add(ci)
        const first: [number, number] = cur.first ?? [nx, ny]
        const dist = cur.dist + 1
        if (goalFn(nx, ny)) return { first, dist }
        queue.push({ x: nx, y: ny, first, dist })
      }
    }
    return null
  }

  /**
   * bot 在 (cx,cy) 放彈後是否還來得及逃到安全格。
   * 把「假想新炸彈」（引信 = now + fuse）疊上目前危險圖，BFS 找一個放彈後仍安全、
   * 且在引信時間內（依移速換算步數）能抵達的格。比舊版只看兩步拓樸更可靠，避免自殺。
   */
  private canEscapeAfterBomb(
    cx: number,
    cy: number,
    fire: number,
    dmap: Map<number, number>,
    now: number,
    speed: number,
  ): boolean {
    const detonate = now + BOMB_FUSE_MS
    const blast = new Set(blastCells(this.map, cx, cy, fire).cells.map(([x, y]) => cellIndex(x, y)))
    const dAt = (gx: number, gy: number): number => {
      const ci = cellIndex(gx, gy)
      let t = dmap.get(ci) ?? Infinity
      if (blast.has(ci)) t = Math.min(t, detonate)
      return t
    }
    const timePerCell = (CELL / speed) * 1000
    const maxSteps = Math.floor((BOMB_FUSE_MS - AI_ESCAPE_MARGIN_MS) / timePerCell)
    if (maxSteps < 1) return false
    const res = this.bfsToGoal(
      cx,
      cy,
      // 終點：放彈後不會被波及（含火焰殘留時間）
      (gx, gy) => dAt(gx, gy) > detonate + FLAME_MS,
      // 不穿越即將爆炸的格
      (gx, gy) => dAt(gx, gy) - now <= AI_HOT_MS,
    )
    return !!res && res.dist <= maxSteps
  }

  /** 每隻 bot 的固定性格（依 id 雜湊），讓三隻電腦行為分歧、不擠成一團 */
  private botAggro(id: string): number {
    let h = 0
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
    return 0.35 + (h % 100) / 100 / 1.6 // 0.35 ~ 0.97
  }

  /** 對每隻 alive bot 跑 AI：時間感知避險 → 撿道具 → 攻擊放彈 */
  private simulateBots(dt: number): void {
    if (this.bots.length === 0) return
    const dmap = this.computeDangerMap()
    const now = performance.now()
    const dirs: [number, number][] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]
    const dAt = (ci: number): number => dmap.get(ci) ?? Infinity
    const flamingNow = (gx: number, gy: number): boolean => dAt(cellIndex(gx, gy)) <= now
    const hotSoon = (gx: number, gy: number): boolean => dAt(cellIndex(gx, gy)) - now <= AI_HOT_MS
    const safeToStand = (gx: number, gy: number): boolean => {
      const t = dAt(cellIndex(gx, gy))
      return t === Infinity || t - now > AI_FLEE_MS
    }

    for (const bot of this.bots) {
      if (!this.isAlive(bot.id)) continue
      const pos = this.botState.get(bot.id)
      if (!pos) continue
      const cx = worldToCell(pos.x, GRID_W)
      const cy = worldToCell(pos.z, GRID_H)
      const stat = this.statOf(bot.id)
      const speed = MOVE_SPEED + stat.speed * SPEED_STEP

      const moveToward = (tcx: number, tcy: number): void => {
        const tx = cellToWorld(tcx, GRID_W)
        const tz = cellToWorld(tcy, GRID_H)
        const dx = tx - pos.x
        const dz = tz - pos.z
        const len = Math.hypot(dx, dz)
        if (len < 0.001) return
        const step = Math.min(len, speed * dt)
        pos.x += (dx / len) * step
        pos.z += (dz / len) * step
      }

      // (a) 避險：站在會於 AI_FLEE_MS 內爆的格 → BFS 找最近安全格逃離（只避開當下火焰）。
      const myDanger = dAt(cellIndex(cx, cy)) - now
      if (myDanger <= AI_FLEE_MS) {
        const res = this.bfsToGoal(cx, cy, safeToStand, flamingNow)
        if (res) {
          moveToward(res.first[0], res.first[1])
        } else {
          // 退路全被堵：朝「最晚才爆」的可走鄰格拖延
          let best: [number, number] | null = null
          let bestT = -Infinity
          for (const [dx, dy] of dirs) {
            const nx = cx + dx
            const ny = cy + dy
            if (!this.cellWalkable(nx, ny) || flamingNow(nx, ny)) continue
            const t = dAt(cellIndex(nx, ny))
            if (t > bestT) {
              bestT = t
              best = [nx, ny]
            }
          }
          if (best) moveToward(best[0], best[1])
        }
        continue
      }

      // (b) 撿道具：BFS（避開即將爆的格）走向最近道具，撿取/套用交給 detectPickups。
      if (this.items.size > 0) {
        const res = this.bfsToGoal(
          cx,
          cy,
          (gx, gy) =>
            this.items.has(cellIndex(gx, gy)) &&
            Math.abs(gx - cx) + Math.abs(gy - cy) <= AI_ITEM_MAX_DIST,
          hotSoon,
        )
        if (res) {
          moveToward(res.first[0], res.first[1])
          continue
        }
      }

      // (c) 攻擊/開路。蒐集 alive 敵人格。
      const enemyCells: [number, number][] = []
      for (const e of this.entities()) {
        if (e.id === bot.id || !this.isAlive(e.id)) continue
        const ep = this.posOf(e.id)
        if (ep) enemyCells.push([worldToCell(ep.x, GRID_W), worldToCell(ep.z, GRID_H)])
      }

      // 放彈判定：以「實際爆風」(blastCells，會被箱子擋住) 判斷能否打到敵人；或相鄰箱子。
      const myBlast = new Set(blastCells(this.map, cx, cy, stat.fire).cells.map(([x, y]) => cellIndex(x, y)))
      const hitsEnemy = enemyCells.some(([ecx, ecy]) => myBlast.has(cellIndex(ecx, ecy)))
      let adjacentCrate = false
      for (const [dx, dy] of dirs) {
        const t = this.map[cellIndex(cx + dx, cy + dy)]
        if (t === TILE_CRATE || t === TILE_CRATE_HARD) adjacentCrate = true
      }
      const cooldownOk = now - (this.botBombInput.get(bot.id) ?? 0) > BOMB_INPUT_COOLDOWN_MS * 3
      if (
        (adjacentCrate || hitsEnemy) &&
        cooldownOk &&
        this.canEscapeAfterBomb(cx, cy, stat.fire, dmap, now, speed)
      ) {
        this.botBombInput.set(bot.id, now)
        this.validateBomb(bot.id, cx, cy)
        continue // 下一 tick 新炸彈進入危險圖，以 (a) 逃離
      }

      // 攻擊位：正交相鄰箱子，或站該格放彈其實際爆風能打到敵人。
      // 性格 aggro 高者更傾向追敵；低者偏好炸箱farm。
      const aggro = this.botAggro(bot.id)
      const isAttackSpot = (gx: number, gy: number): boolean => {
        if (enemyCells.length > 0 && aggro > 0.5) {
          const spotBlast = new Set(
            blastCells(this.map, gx, gy, stat.fire).cells.map(([x, y]) => cellIndex(x, y)),
          )
          if (enemyCells.some(([ecx, ecy]) => spotBlast.has(cellIndex(ecx, ecy)))) return true
        }
        for (const [dx, dy] of dirs) {
          const t = this.map[cellIndex(gx + dx, gy + dy)]
          if (t === TILE_CRATE || t === TILE_CRATE_HARD) return true
        }
        return false
      }

      const res = this.bfsToGoal(cx, cy, (gx, gy) => isAttackSpot(gx, gy), hotSoon)
      if (res) {
        moveToward(res.first[0], res.first[1])
      } else {
        // 找不到攻擊位（多被危險封住）：朝最近箱子/敵人方向、避開即將爆的格走一步
        let target: [number, number] | null = null
        let bestDist = Infinity
        const consider = (tx: number, ty: number) => {
          const d = Math.abs(tx - cx) + Math.abs(ty - cy)
          if (d < bestDist) {
            bestDist = d
            target = [tx, ty]
          }
        }
        for (let gy = 0; gy < GRID_H; gy++) {
          for (let gx = 0; gx < GRID_W; gx++) {
            const t = this.map[cellIndex(gx, gy)]
            if (t === TILE_CRATE || t === TILE_CRATE_HARD) consider(gx, gy)
          }
        }
        for (const [ecx, ecy] of enemyCells) consider(ecx, ecy)
        if (target) {
          const [tx, ty] = target as [number, number]
          const sx = Math.sign(tx - cx)
          const sy = Math.sign(ty - cy)
          const tryAxes: [number, number][] =
            Math.abs(tx - cx) >= Math.abs(ty - cy) ? [[sx, 0], [0, sy]] : [[0, sy], [sx, 0]]
          for (const [dx, dy] of tryAxes) {
            if (dx === 0 && dy === 0) continue
            const nx = cx + dx
            const ny = cy + dy
            if (this.cellWalkable(nx, ny) && !hotSoon(nx, ny)) {
              moveToward(nx, ny)
              break
            }
          }
        }
      }
    }
  }

  update(deltaMs: number): void {
    const phase = this.flow.state.phase

    // 自己
    if (this.selfAvatar) {
      this.selfAvatar.root.position.x = this.state.x
      this.selfAvatar.root.position.z = this.state.z
      this.animateAvatar(this.selfAvatar, deltaMs)
    }

    // 遠端：增刪 + 插值
    const ids = new Set(this.own.remoteIds())
    for (const [id, a] of this.peerAvatars) {
      if (ids.has(id)) continue
      a.root.dispose(false, true)
      this.peerAvatars.delete(id)
    }
    for (const id of ids) {
      let a = this.peerAvatars.get(id)
      if (!a) {
        a = this.makePlayer(id)
        a.root.setEnabled(this.isAlive(id))
        this.peerAvatars.set(id, a)
      }
      const s = this.own.sampleRemote(id)
      if (s) {
        a.root.position.x = s.a.x + (s.b.x - s.a.x) * s.alpha
        a.root.position.z = s.a.z + (s.b.z - s.a.z) * s.alpha
      }
      this.animateAvatar(a, deltaMs)
    }

    // bot 化身：host 直接用模擬位置；guest 平滑 lerp 到 host 廣播的目標
    for (const [id, a] of this.botAvatars) {
      if (this.ctx.role === 'host') {
        const s = this.botState.get(id)
        if (s) {
          a.root.position.x = s.x
          a.root.position.z = s.z
        }
      } else {
        const t = this.botTarget.get(id)
        if (t) {
          const k = Math.min(1, deltaMs * 0.012)
          a.root.position.x += (t.x - a.root.position.x) * k
          a.root.position.z += (t.z - a.root.position.z) * k
        }
      }
      a.root.setEnabled(this.isAlive(id))
      this.animateAvatar(a, deltaMs)
    }

    // 無敵視覺：閃爍半透明（無敵結束自動恢復為實心）
    const nowVis = performance.now()
    const applyInvis = (av: Avatar | undefined, id: string) => {
      if (!av || !av.root.isEnabled()) return
      const inv = this.statOf(id).invincibleUntil
      const vis = inv > nowVis ? 0.35 + 0.35 * (Math.sin(nowVis * 0.02) * 0.5 + 0.5) : 1
      for (const child of av.root.getChildMeshes()) child.visibility = vis
    }
    applyInvis(this.selfAvatar, this.ctx.selfId)
    for (const [id, a] of this.peerAvatars) applyInvis(a, id)
    for (const [id, a] of this.botAvatars) applyInvis(a, id)

    // 火焰：到期清除 + 生長/收縮動畫
    const now = performance.now()
    this.flames = this.flames.filter((f) => {
      if (f.until <= now) {
        f.mesh.dispose()
        return false
      }
      const grow = Math.min(1, (now - f.bornAt) / FLAME_GROW_MS)
      const fade = Math.min(1, (f.until - now) / FLAME_FADE_MS)
      const s = grow * (0.4 + 0.6 * fade)
      f.mesh.scaling.set(s, s * (1 + 0.3 * Math.sin(now * 0.02 + f.cx + f.cy)), s)
      return true
    })

    // 炸彈脈動；將爆前轉紅快閃；踢滑行/丟拋物的位置插值
    for (const b of this.bombs.values()) {
      const left = b.explodeAt - now
      const pulse = 1 + 0.07 * Math.sin(now * (left < BOMB_FLASH_MS ? 0.035 : 0.012))
      b.mesh.scaling.set(pulse, pulse, pulse)
      b.mesh.material = left < BOMB_FLASH_MS && Math.sin(now * 0.04) > 0 ? this.bombFlashMat : this.bombMat
      // 移動動畫：依時間插值 mesh 位置；拋物加上弧高；結束後吸附終點並清除 motion
      const m = b.motion
      if (m) {
        const t = Math.min(1, (now - m.startAt) / (m.endAt - m.startAt))
        b.mesh.position.x = m.fromX + (m.toX - m.fromX) * t
        b.mesh.position.z = m.fromZ + (m.toZ - m.fromZ) * t
        b.mesh.position.y = 0.55 + m.arc * Math.sin(Math.PI * t)
        if (t >= 1) {
          b.mesh.position.set(m.toX, 0.55, m.toZ)
          b.motion = undefined
        }
      }
    }

    // 突然死亡落牆：由高處快速落到定位（著地後維持）
    const groundY = CELL * 0.48
    for (const w of this.closingWalls) {
      if (w.position.y > groundY) {
        w.position.y += (groundY - w.position.y) * Math.min(1, deltaMs * 0.02)
        if (w.position.y - groundY < 0.02) w.position.y = groundY
      }
    }

    // 爆炸相機震動（衰減的隨機偏移）
    const shakeLeft = this.shakeUntil - now
    if (shakeLeft > 0) {
      const k = (shakeLeft / SHAKE_MS) * 0.4
      this.camera.target.set((Math.random() - 0.5) * k, 0, (Math.random() - 0.5) * k)
    } else {
      this.camera.target.set(0, 0, 0)
    }

    // 道具旋轉浮動，提示可拾取
    for (const it of this.items.values()) {
      it.mesh.rotation.y += deltaMs * 0.004
      it.mesh.position.y = 0.55 + Math.sin(now * 0.004 + it.mesh.position.x) * 0.12
    }

    // HUD / 橫幅：精簡單行——存活數 + 能力值（能力旗標/無敵僅在持有時顯示）；
    // hud.draw 會在超寬時自動縮字級，常見比例下完整不被切。
    if (phase === 'playing') {
      const aliveCount = this.entities().filter((e) => this.isAlive(e.id)).length
      const me = this.statOf(this.ctx.selfId)
      const flags: string[] = []
      if (me.kick) flags.push('👟')
      if (me.throw) flags.push('🧤')
      const invLeft = me.invincibleUntil - now
      if (invLeft > 0) flags.push(`🛡️${Math.ceil(invLeft / 1000)}s`)
      const flagsNote = flags.length ? `  ${flags.join(' ')}` : ''
      const stats = `💣${me.bombs} 🔥${me.fire} ⚡${me.speed}`
      // 比分摘要（精簡）：依勝場高→低取前幾名以 : 串接，如 🏆2:1
      const scoreVals = this.entities()
        .map((e) => this.scores.get(e.id) ?? 0)
        .sort((a, b) => b - a)
      const scoreNote = scoreVals.some((v) => v > 0) ? `  🏆${scoreVals.join(':')}` : ''
      // 陣亡觀戰提示換行，避免主資訊行過長被擠壓
      const deadLine = !this.isAlive(this.ctx.selfId) ? '\n（你已陣亡・觀戰中）' : ''
      this.hud.draw(`存活 ${aliveCount}/${this.entities().length}   ${stats}${flagsNote}${scoreNote}${deadLine}`, 32)
    } else {
      this.hud.draw('', 32)
    }

    // 陣亡/結算的「重新開始」UI 交給 React 覆蓋層
    this.syncOverlay()

    if (phase === 'countdown') {
      const n = Math.ceil(this.flow.countdownRemaining() / 1000)
      this.banner.draw(n > 0 ? String(n) : 'GO!', 200)
    } else if (phase === 'result') {
      // 結算內容由覆蓋層顯示；此處僅維持 host 自動推進計時（約 6s 後進下一回合/新比賽）
      this.banner.draw('')
      if (this.ctx.role === 'host') {
        this.resultElapsed += deltaMs
        if (this.resultElapsed > 6000) this.hostAdvance()
      }
    } else {
      this.resultElapsed = 0
      // 突然死亡啟動後，於 banner 顯示精簡警示
      const sdActive = phase === 'playing' && this.playingSince > 0 && now - this.playingSince > SUDDEN_DEATH_MS
      this.banner.draw(sdActive ? '⚠️ 場地縮小！' : '', sdActive ? 48 : undefined)
    }

    // 驗證用旗標
    ;(window as unknown as Record<string, unknown>).__BATTLE_POS = {
      x: this.state.x,
      z: this.state.z,
      alive: this.isAlive(this.ctx.selfId),
    }
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    stopAllAudio()
    this.ticker.stop()
    this.own.stop()
    this.flow.dispose()
    this.offOpen?.()
    this.selfAvatar?.root.dispose(false, true)
    for (const a of this.peerAvatars.values()) a.root.dispose(false, true)
    this.peerAvatars.clear()
    for (const a of this.botAvatars.values()) a.root.dispose(false, true)
    this.botAvatars.clear()
    this.botState.clear()
    this.botTarget.clear()
    this.bots = []
    for (const m of this.crates.values()) m.dispose()
    this.crates.clear()
    for (const b of this.bombs.values()) b.mesh.dispose()
    this.bombs.clear()
    for (const f of this.flames) f.mesh.dispose()
    this.flames = []
    for (const it of this.items.values()) it.mesh.dispose()
    this.items.clear()
    for (const w of this.closingWalls) w.dispose()
    this.closingWalls = []
    for (const m of this.decorations) m.dispose()
    this.decorations = []
    this.explosionPs?.dispose()
    this.debrisPs?.dispose()
    this.puffPs?.dispose()
    this.sparklePs?.dispose()
    this.explosionPs = this.debrisPs = this.puffPs = this.sparklePs = null
    this.hud.dispose()
    this.banner.dispose()
  }
}

export const createBomberScene = (): GameModule => new BomberScene()
