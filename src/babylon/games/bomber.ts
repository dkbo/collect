import { ArcRotateCamera, Quaternion, SceneInstrumentation, Vector3, type Mesh } from '@/babylon/babylonCore'
import type { GameContext, GameModule, GameOverlay } from '@/babylon/types'
import type { GameNetMessage } from '@/core/webrtc'
import { attachFlowAudio, playSfx, stopAllAudio } from '@/babylon/audio'
import { createCountdownPanel, type CountdownTheme, type TextPanel } from '@/babylon/hud'
import {
  canAdvanceMidRound,
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
import {
  botAggro,
  computeDangerMap,
  decideBotAction,
  type AiBomb,
  type AiTuning,
} from './bomberAI'
import {
  decodeBombReq,
  decodeBomberMessage,
  decodeKickReq,
  decodeThrowReq,
  type BomberMessage,
  type BomberPayloadMap,
  type BoomPayload,
  type BombMovePayload,
  type BombPayload,
  type BotEntry,
  type BotsPayload,
  type CloseWallPayload,
  type Drop,
  type ItemKind,
  type PickupPayload,
} from './bomberNet'
import { AVATAR_SCALE, AvatarKit, buildAvatar, disposeAvatar, poseAvatar, type ToyAvatar } from '@/babylon/games/bomberFx/avatar'
import { ToyBoard } from '@/babylon/games/bomberFx/board'
import { ToyFx } from '@/babylon/games/bomberFx/effects'
import { classifyFlameCells } from '@/babylon/games/bomberFx/flames'
import { armDelayMs, deathPose, flameEmissive, placeScale } from '@/babylon/games/bomberFx/fxCurves'
import { buildBomberHud, suddenDeathSeconds } from '@/babylon/games/bomberFx/hudModel'
import { colorIndexOf, invincibleBlinkOn, PLAYER_PALETTE, TOY, type ColorIndex } from '@/babylon/games/bomberFx/palette'
import { closeWarningActive, nextCloseCell } from '@/babylon/games/bomberFx/suddenDeath'
import { ToyLook, UI_LAYER } from '@/babylon/games/bomberFx/look'
import { uprightAxis } from '@/babylon/games/bomberFx/upright'

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
  id: string // 與 bombs Map 的 key 相同（applyBomb 是唯一建立處）
  cx: number // 目標/當前所在格（動畫進行中即終點格）
  cy: number
  owner: string
  explodeAt: number // host 引爆依據；各端亦用於將爆閃紅提示
  x: number // 畫面位置（移動動畫中與邏輯格不同）
  y: number
  z: number
  motion?: BombMotion // 進行中的移動動畫；結束後清除
}

interface FlameInfo {
  fx: number // ToyBoard 的火焰 id
  until: number
  bornAt: number
  showAt: number // 純視覺：臂從爆心往外依序生長（bornAt + 每格 25ms），until 與判定不變
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

interface ItemInfo {
  kind: ItemKind
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

/** 人形角色：root 為位移錨點（不旋轉），toy.body 轉面向、四肢由頂點擺動 */
interface Avatar {
  root: Mesh
  toy: ToyAvatar
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
const CLOSE_WARN_MS = 400 // 突然死亡落牆前的紅色預告格時長（純視覺）
const PERF_LOG_MS = 2000 // draw calls / fps 量測輸出間隔
// 特效時長（spec §8，純視覺）
const PLACE_POP_MS = 180 // 放炸彈彈跳＋地面 ring
const DEATH_MS = 700 // 陣亡跳起旋轉縮小
const FUSE_TIP = { x: 0.3, y: 0.84 } // 引信末端（炸彈模型座標，見 models.bombData）
const HEAD_Y = 2.4 // 拾取代幣飛向的頭頂高度
const UPRIGHT_BACK_TILT = 0.35 // 角色往後仰（遠離相機）的弧度：高俯角下頭才不會整個蓋住身體（對照 variant-A-sheet 的正面）
const PLUS_ONE_Y = 3.7 // 「+1」起飄高度：在「你」標記（約 3.3）之上，不被頭與標記擋住

/** 開局倒數 A 配色（spec §9：奶油底、深紫描邊、Fredoka）；面板走 UI 相機，不經 ACES／bloom，填的就是畫面色 */
const COUNTDOWN_THEME: CountdownTheme = {
  fontFamily: 'Fredoka, sans-serif',
  count: { glow: 'rgba(0,0,0,0.4)', fill: '#FFF6E3', border: TOY.outline, stroke: TOY.outline, text: '#FF7A1A' },
  go: { glow: 'rgba(0,0,0,0.4)', fill: '#2FCF5E', border: TOY.outline, stroke: TOY.outline, text: '#FFFFFF' },
  plain: { stroke: TOY.outline, text: '#FFF6E3' },
  shadowOffset: 0.12,
  shadowBlur: 0,
}

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

// 多回合計分制（Best-of-N）：先贏 MATCH_TARGET 場奪冠
const MATCH_TARGET = 3

// 場地縮小・突然死亡：進 playing 後 SUDDEN_DEATH_MS 啟動，每 CLOSE_INTERVAL_MS 由外圈往內落一格牆
const SUDDEN_DEATH_MS = 40000
const CLOSE_INTERVAL_MS = 650

/** 傳給 bomberAI 的場景數值（見 AiTuning） */
const AI_TUNING: AiTuning = { cellSize: CELL, fuseMs: BOMB_FUSE_MS, flameMs: FLAME_MS }

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
  private lastCloseApplied = 0 // 本端最近一次套用落牆的時刻（預告格計時，host/guest 共用）
  private closePreviewFrom = 0 // 預告格從螺旋序的這個 index 起找
  private lastBombInput = 0
  private lastKickInput = 0
  private bombSeq = 0
  private ownerBombCount = new Map<string, number>()
  private stats = new Map<string, PlayerStat>()
  private resultElapsed = 0
  private lastOverlayKey = '' // 僅在內容變動時才更新 React 覆蓋層
  private dying = new Map<string, number>() // 陣亡動畫起點（純視覺；邏輯上已死）
  private shownScores = new Map<string, number>() // HUD 勝場：取自最近一次結算（host／guest 一致）
  private shownMatchOver = false

  private selfAvatar?: Avatar
  private peerAvatars = new Map<string, Avatar>()
  // 電腦玩家（補滿至 4 人）：名冊由 host 決定並隨 seed 廣播
  private bots: BotEntry[] = []
  private botAvatars = new Map<string, Avatar>()
  private botState = new Map<string, { x: number; z: number }>() // host 模擬位置
  private botTarget = new Map<string, { x: number; z: number }>() // guest 插值目標
  private botBombInput = new Map<string, number>() // 每隻 bot 放彈冷卻
  private lastBotBroadcast = 0
  private camera!: ArcRotateCamera
  private banner!: TextPanel
  private board!: ToyBoard
  private avatarKit!: AvatarKit
  private look!: ToyLook
  private instr: SceneInstrumentation | null = null
  private lastPerfLog = 0
  private fx!: ToyFx

  private onKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase()
    this.keys.add(key)
    if (key === ' ' || key === 'enter') this.requestBomb()
    if (key === 'f' || key === 'shift') this.requestThrow()
    if (key === 'r') this.requestRestart()
  }
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase())

  /** 固定 4 色：依實體序（= 出生角 SPAWN_CORNERS 順序）取色，各端一致 */
  private colorIndex(id: string): ColorIndex {
    return colorIndexOf(id, this.entities().map((e) => e.id))
  }

  private nameFor(id: string): string {
    return (
      this.ctx.players.find((p) => p.id === id)?.name ??
      this.bots.find((b) => b.id === id)?.name ??
      id.slice(0, 6)
    )
  }

  /** 所有實體（真人 players 在前、bots 在後），上限 4 */
  private entities(): BotEntry[] {
    return [...this.ctx.players, ...this.bots]
  }

  private isBot(id: string): boolean {
    return id.startsWith('bot-')
  }

  /** host：依真人數量產生 bot 名冊，補滿至 4 人 */
  private makeBots(): BotEntry[] {
    const count = Math.max(0, Math.min(4, 4 - this.ctx.players.length))
    const bots: BotEntry[] = []
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

  /** 建立 Q 版角色（程式建模，單一 mesh），可走路擺動、面向移動方向 */
  private makePlayer(id: string): Avatar {
    const toy = buildAvatar(this.ctx.scene, this.avatarKit, id, this.colorIndex(id), {
      isAI: this.isBot(id),
      isSelf: id === this.ctx.selfId,
    })
    // 光影登記：投影＋描邊；AI 天線球進 Glow 白名單
    this.look.caster(toy.body)
    this.look.outline(toy.body)
    if (toy.antenna) this.look.glowMesh(toy.antenna, TOY.aiAntenna)
    const av: Avatar = { root: toy.root, toy, walkPhase: 0, amp: 0, yaw: 0, prevX: 0, prevZ: 0 }
    this.faceCamera(av)
    return av
  }

  /** 開局面向鏡頭（−Z），與 variant-A 稿一致；之後依移動方向更新 */
  private faceCamera(av: Avatar): void {
    av.yaw = Math.PI
    av.toy.body.rotation.y = Math.PI
  }

  /** 名冊變動（seed 帶來 bot、玩家序改變）後顏色不對的化身就重建 */
  private recolor(av: Avatar | undefined, id: string): Avatar | undefined {
    if (!av || av.toy.colorIndex === this.colorIndex(id)) return av
    const enabled = av.root.isEnabled()
    const next = this.makePlayer(id)
    next.root.position.copyFrom(av.root.position)
    next.yaw = av.yaw
    next.prevX = av.prevX
    next.prevZ = av.prevZ
    next.root.setEnabled(enabled)
    disposeAvatar(av.toy)
    return next
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
    // 一幀跨超過一格＝出生／重生瞬移，不當成走路（否則會轉去面向瞬移方向）
    if (Math.hypot(dx, dz) > CELL) return

    const moving = Math.hypot(dx, dz) > dtMs * 0.0005
    if (moving) av.yaw = Math.atan2(dx, dz)
    av.toy.body.rotation.y = av.yaw

    // 擺幅平滑進出，避免起步/停步跳動
    const ease = Math.min(1, dtMs * 0.012)
    av.amp += ((moving ? 1 : 0) - av.amp) * ease
    if (av.amp > 0.01) av.walkPhase += dtMs * 0.013

    poseAvatar(av.toy, Math.sin(av.walkPhase) * 0.7 * av.amp)
  }

  // ---- 地圖 ----

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

  /** 某格在螺旋序中的 index（找不到回 -1） */
  private spiralIndexOf(cx: number, cy: number): number {
    return this.spiralCells().findIndex(([x, y]) => x === cx && y === cy)
  }

  /** host：所有實體勝場歸零（新比賽開始時呼叫；單局重置不動 scores） */
  private resetMatchScores(): void {
    for (const e of this.entities()) this.scores.set(e.id, 0)
  }

  /** 依 seed 重建一輪：地圖/木箱/炸彈/火焰/存活/出生位置全部重置 */
  private applySeed(seed: number): void {
    this.currentSeed = seed
    this.map = generateMap(seed)

    this.board.clearCrates()
    this.board.clearBombs()
    this.bombs.clear()
    this.board.clearFlames()
    this.flames = []
    this.board.clearItems()
    this.items.clear()
    // 突然死亡：場地復原——清掉已落下的牆、重置螺旋進度與計時（scores 不在此清，跨回合保留）
    this.board.clearClosingWalls()
    this.board.setWarning(null, 0)
    this.fx.clearRound()
    this.dying.clear()
    // 上一場已奪冠 → 新比賽，HUD 勝場歸零（host 的 scores 已在 resetMatchScores 清掉）
    if (this.shownMatchOver) {
      this.shownScores.clear()
      this.shownMatchOver = false
    }
    this.lastCloseApplied = 0
    this.closePreviewFrom = 0
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
        this.board.setCrate(cellIndex(cx, cy), cx, cy, tile === TILE_CRATE_HARD ? 'hard' : 'soft')
      }
    }

    // 出生角：依 entities 合併排序（players 在前、bots 在後）對應 SPAWN_CORNERS
    const spawnOf = (id: string): { x: number; z: number } => {
      const idx = Math.max(0, ents.findIndex((e) => e.id === id))
      const [cx, cy] = SPAWN_CORNERS[idx % SPAWN_CORNERS.length]
      return { x: cellToWorld(cx, GRID_W), z: cellToWorld(cy, GRID_H) }
    }

    // 自己回出生角；名冊（bot 補位）可能改變實體序 → 顏色不對的化身重建
    this.state = spawnOf(this.ctx.selfId)
    this.selfAvatar = this.recolor(this.selfAvatar, this.ctx.selfId)
    if (this.selfAvatar) this.faceCamera(this.selfAvatar)
    this.selfAvatar?.root.setEnabled(true)
    for (const [id, a] of this.peerAvatars) {
      const next = this.recolor(a, id) as Avatar
      this.faceCamera(next)
      this.peerAvatars.set(id, next)
      next.root.setEnabled(true)
    }

    // bot 化身與位置：依名冊重建（不走 own.remoteIds）
    for (const [id, a] of this.botAvatars) {
      if (this.bots.some((b) => b.id === id)) continue
      disposeAvatar(a.toy)
      this.botAvatars.delete(id)
    }
    this.botState.clear()
    this.botTarget.clear()
    for (const b of this.bots) {
      const sp = spawnOf(b.id)
      this.botState.set(b.id, { ...sp })
      this.botTarget.set(b.id, { ...sp })
      let a = this.recolor(this.botAvatars.get(b.id), b.id)
      if (!a) a = this.makePlayer(b.id)
      this.botAvatars.set(b.id, a)
      a.root.position.set(sp.x, 0, sp.z)
      a.prevX = sp.x
      a.prevZ = sp.z
      this.faceCamera(a)
      a.root.setEnabled(true)
    }
    // 陣亡動畫改過的身體姿勢復原
    for (const av of [this.selfAvatar, ...this.peerAvatars.values(), ...this.botAvatars.values()]) if (av) this.resetPose(av)
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
  private hostBroadcast<T extends keyof BomberPayloadMap>(type: T, payload: BomberPayloadMap[T]): void {
    this.ctx.net.broadcast({ game: this.gameId, type, payload })
    // host 自組的 payload 已由 BomberPayloadMap 保證形狀，本地回放不再解碼驗證一次
    this.applyDecoded({ type, ...payload } as BomberMessage)
  }

  /** guest 套用 host 廣播的 bot 位置（更新插值目標，update() 平滑 lerp） */
  private applyBotStates(p: BotsPayload): void {
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

  /** 可重開的時機：結算畫面，或自己已陣亡且場上真人全滅（只剩 bot 在打） */
  private canRestart(): boolean {
    return this.canAdvance(this.ctx.selfId)
  }

  /** 重開/推進回合的受理條件（host 收 restartReq 與客端提示共用同一條規則） */
  private canAdvance(requester: string): boolean {
    return canAdvanceMidRound(
      this.flow.state.phase,
      this.ctx.players.map((p) => p.id),
      (id) => this.isAlive(id),
      requester
    )
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

  private applyBomb(p: BombPayload): void {
    playSfx('bomb_place')
    const x = cellToWorld(p.cx, GRID_W)
    const z = cellToWorld(p.cy, GRID_H)
    this.board.setBomb(p.id, x, 0.55, z, placeScale(0), false)
    this.fx.bombPlaced(x, z, PLACE_POP_MS)
    this.bombs.set(p.id, {
      id: p.id,
      cx: p.cx,
      cy: p.cy,
      owner: p.owner,
      explodeAt: performance.now() + BOMB_FUSE_MS,
      x,
      y: 0.55,
      z,
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
    const id = bomb.id
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
      if (this.cellFreeForBomb(nx, ny, target.id)) {
        landCx = nx
        landCy = ny
      }
    }
    if (landCx < 0) return // 無可落點
    const tiles = Math.max(Math.abs(landCx - pcx), Math.abs(landCy - pcy))
    this.hostBroadcast('bombMove', {
      id: target.id,
      toCx: landCx,
      toCy: landCy,
      durMs: tiles * THROW_HOP_MS,
      arc: 0.6 + tiles * 0.35, // 拋物線高度隨距離增加
    })
  }

  /** 套用炸彈移動（踢滑行 / 丟拋物）：更新邏輯格與動畫，各端依時間插值。 */
  private applyBombMove(p: BombMovePayload): void {
    const b = this.bombs.get(p.id)
    if (!b) return
    playSfx(p.arc > 0 ? 'bomb_place' : 'pickup')
    const now = performance.now()
    b.motion = {
      fromX: b.x,
      fromZ: b.z,
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
    const drops: Drop[] = []
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

  private applyBoom(p: BoomPayload): void {
    playSfx('explosion')
    this.shakeUntil = performance.now() + SHAKE_MS
    const bomb = this.bombs.get(p.id)
    if (bomb) {
      this.board.removeBomb(p.id)
      this.bombs.delete(p.id)
      const n = (this.ownerBombCount.get(bomb.owner) ?? 1) - 1
      this.ownerBombCount.set(bomb.owner, Math.max(0, n))
    }
    // 爆心星芒＋火花；每個火焰格留焦痕 1.5 秒
    const [ccx, ccy] = p.cells[0]
    const born = performance.now()
    this.fx.explosion(cellToWorld(ccx, GRID_W), cellToWorld(ccy, GRID_H))
    for (const [cx, cy] of p.cells) this.fx.scorchAt(cellIndex(cx, cy), cellToWorld(cx, GRID_W), cellToWorld(cy, GRID_H), born)
    for (const [cx, cy] of p.destroyed) {
      this.map[cellIndex(cx, cy)] = 0
      this.board.setCrate(cellIndex(cx, cy), cx, cy, null)
      // 木片拋射＋奶白煙
      this.fx.crateBurst(cellToWorld(cx, GRID_W), cellToWorld(cy, GRID_H))
    }
    // 硬箱降級：map 由硬箱降為軟箱，外觀換成受損硬磚（鐵箍斷開＋裂痕）＋閃白＋金屬火花
    for (const [cx, cy] of p.damaged ?? []) {
      const ci = cellIndex(cx, cy)
      if (this.map[ci] !== TILE_CRATE_HARD) continue
      this.map[ci] = TILE_CRATE
      this.board.setCrate(ci, cx, cy, 'damaged')
      this.board.flashCrate(ci, cx, cy, born)
      this.fx.metalSparks(cellToWorld(cx, GRID_W), cellToWorld(cy, GRID_H))
    }
    // 燒毀既有道具
    for (const [cx, cy] of p.itemKills ?? []) {
      const ci = cellIndex(cx, cy)
      this.board.removeItem(ci)
      this.items.delete(ci)
    }
    // 掉落新道具
    for (const d of p.drops ?? []) this.spawnItem(d.cx, d.cy, d.kind)
    // 火焰格：爆心圓帽、臂圓角條、端頭半格＋圓帽（外／中／芯三層）；生長/收縮動畫於 update 驅動，
    // 臂從爆心往外每格晚 25ms 冒出（純視覺；until 與燒傷判定照舊）
    const until = born + FLAME_MS
    for (const c of classifyFlameCells(p.cells)) {
      const showAt = born + armDelayMs(c.cx, c.cy, ccx, ccy)
      this.flames.push({ fx: this.board.addFlame(c), until, bornAt: born, showAt, cx: c.cx, cy: c.cy })
    }
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
  private applyCloseWall(p: CloseWallPayload): void {
    const ci = cellIndex(p.cx, p.cy)
    this.map[ci] = TILE_WALL

    // 清該格既有木箱
    this.board.setCrate(ci, p.cx, p.cy, null)
    // 清該格既有道具
    this.board.removeItem(ci)
    this.items.delete(ci)
    // 清該格既有炸彈（直接 dispose、不引爆；修正 ownerBombCount）
    for (const [bid, b] of [...this.bombs]) {
      if (b.cx === p.cx && b.cy === p.cy) {
        this.board.removeBomb(bid)
        this.bombs.delete(bid)
        const n = (this.ownerBombCount.get(b.owner) ?? 1) - 1
        this.ownerBombCount.set(b.owner, Math.max(0, n))
      }
    }

    // 落牆：柱牆模型＋紅色警示頂，由高處落下（board.update 驅動）；預告格往下一格推進。
    // 落地那一幀才有灰塵環、音效與震動（見 update 的 landed）
    this.board.addClosingWall(ci, p.cx, p.cy)
    this.lastCloseApplied = performance.now()
    this.closePreviewFrom = this.spiralIndexOf(p.cx, p.cy) + 1

    this.killPlayers(p.kills)
  }

  /** 套用陣亡（boom 與 burn 共用）：音效 + 白煙與頭盔色星星 + 陣亡動畫（播完才隱藏角色） */
  private killPlayers(kills: string[]): void {
    for (const pid of kills) {
      if (!this.isAlive(pid)) continue
      this.alive.set(pid, false)
      this.deathOrder.push(pid)
      playSfx(pid === this.ctx.selfId ? 'death' : 'kill')
      const av = this.avatarOf(pid)
      if (av && av.root.isEnabled()) {
        const { x, z } = av.root.position
        this.fx.death(x, 1, z, PLAYER_PALETTE[av.toy.colorIndex].base)
        this.dying.set(pid, performance.now())
        // 頭上的「你」與 AI 小章不跟著縮，陣亡當下先收起
        if (av.toy.marker) av.toy.marker.isVisible = false
        if (av.toy.tag) av.toy.tag.isVisible = false
      }
    }
  }

  /** 陣亡動畫：往上跳、旋轉、縮小；播完隱藏角色並復原姿勢 */
  private applyDeath(av: Avatar, id: string, now: number): void {
    const start = this.dying.get(id)
    if (start === undefined) return
    const t = (now - start) / DEATH_MS
    if (t >= 1 || this.isAlive(id)) {
      this.dying.delete(id)
      this.resetPose(av)
      av.root.setEnabled(this.isAlive(id))
      return
    }
    const p = deathPose(t)
    av.toy.body.position.y = p.lift
    av.toy.body.rotation.y = av.yaw + p.spin
    av.toy.body.scaling.setAll(AVATAR_SCALE * Math.max(0.001, p.scale))
    av.toy.halo.isVisible = false
  }

  /** 抵銷俯角透視：依角色所在位置微傾 root，讓身體在畫面上直立（近側出生角不再像橫躺；相機不動）。
   *  「你」與 AI 小章是 billboard，Babylon 不會把父節點的旋轉套到它們的位置上，這裡手動轉。 */
  private leanUpright(av: Avatar, cam: Vector3, camUp: Vector3): void {
    const p = av.root.position
    const [x, y, z] = uprightAxis([p.x, 0, p.z], [cam.x, cam.y, cam.z], [camUp.x, camUp.y, camUp.z], {
      backTilt: UPRIGHT_BACK_TILT,
    })
    const q = (av.root.rotationQuaternion ??= new Quaternion())
    Quaternion.FromUnitVectorsToRef(Vector3.UpReadOnly, new Vector3(x, y, z), q)
    for (const m of [av.toy.marker, av.toy.tag]) {
      if (!m) continue
      let base = this.billboardBase.get(m)
      if (!base) {
        base = m.position.clone()
        this.billboardBase.set(m, base)
      }
      base.rotateByQuaternionToRef(q, m.position)
    }
  }
  private billboardBase = new WeakMap<Mesh, Vector3>()

  private resetPose(av: Avatar): void {
    av.toy.body.position.y = 0
    av.toy.body.scaling.setAll(AVATAR_SCALE)
    av.toy.body.rotation.y = av.yaw
    if (av.toy.marker) av.toy.marker.isVisible = true
    if (av.toy.tag) av.toy.tag.isVisible = true
  }

  /** 某實體頭頂（拾取代幣飛向這裡；化身不在就回 null） */
  private headOf(id: string): { x: number; y: number; z: number } | null {
    const av = this.avatarOf(id)
    return av ? { x: av.root.position.x, y: HEAD_Y, z: av.root.position.z } : null
  }

  /** 道具落地：代幣（board 的 thin instance），存入 items（同格已有則先清除） */
  private spawnItem(cx: number, cy: number, kind: ItemKind): void {
    const ci = cellIndex(cx, cy)
    this.board.addItem(ci, kind, cx, cy, performance.now())
    this.items.set(ci, { kind })
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
  private applyPickup(p: PickupPayload): void {
    const it = this.items.get(p.ci)
    if (!it) return
    playSfx('pickup')
    // 代幣縮小飛向頭頂，到了飄「+1」（純視覺；邏輯上道具立即移除）
    const ip = this.board.itemPos(p.ci)
    if (ip) {
      this.fx.itemSparkle(ip.x, ip.y, ip.z)
      const target = () => this.headOf(p.who) ?? ip
      this.board.collectItem(p.ci, target, performance.now(), () => {
        const h = target()
        this.fx.plusOne(h.x + 0.5, PLUS_ONE_Y, h.z)
      })
    }
    this.board.removeItem(p.ci)
    this.items.delete(p.ci)
    const s = this.statOf(p.who)
    if (it.kind === 'bomb') s.bombs = Math.min(MAX_BOMBS, s.bombs + 1)
    else if (it.kind === 'fire') s.fire = Math.min(MAX_FIRE, s.fire + 1)
    else if (it.kind === 'speed') s.speed = Math.min(MAX_SPEED_LV, s.speed + 1)
    else if (it.kind === 'kick') s.kick = true
    else if (it.kind === 'throw') s.throw = true
    else if (it.kind === 'invincible') s.invincibleUntil = performance.now() + INVINCIBLE_MS
  }

  /**
   * 套用一則「已驗證」的訊息到場景狀態。
   * guest 走 onNetworkMessage 的 decodeBomberMessage（安全審查 C2）；
   * host 本地回放的 payload 形狀由 hostBroadcast 的 BomberPayloadMap 保證，直接進來。
   */
  private applyDecoded(msg: BomberMessage): void {
    if (msg.type === 'seed') {
      this.bots = msg.bots
      this.applySeed(msg.seed)
    } else if (msg.type === 'bots') {
      this.applyBotStates(msg)
    } else if (msg.type === 'bomb') {
      this.applyBomb(msg)
    } else if (msg.type === 'boom') {
      this.applyBoom(msg)
    } else if (msg.type === 'burn') {
      this.killPlayers(msg.kills)
    } else if (msg.type === 'pickup') {
      this.applyPickup(msg)
    } else if (msg.type === 'bombMove') {
      this.applyBombMove(msg)
    } else if (msg.type === 'closeWall') {
      this.applyCloseWall(msg)
    }
  }

  /** 是否為本局玩家（host 只受理已知玩家的上行請求） */
  private isPlayer(id: string): boolean {
    return this.ctx.players.some((pl) => pl.id === id)
  }

  onNetworkMessage(from: string, msg: GameNetMessage): void {
    if (msg.game !== this.gameId) return
    // ---- guest → host 的上行請求：來源須為本局玩家，payload 驗過才交給 host 裁決 ----
    if (msg.type === 'bombReq') {
      if (this.ctx.role !== 'host' || !this.isPlayer(from)) return
      const req = decodeBombReq(msg.payload)
      if (!req) return
      this.validateBomb(from, req.cx, req.cy)
      return
    }
    if (msg.type === 'kickReq') {
      // guest 送踢炸彈請求：host 依目前炸彈狀態重新驗證（不信任 guest 格子，僅用方向）
      if (this.ctx.role !== 'host' || !this.isPlayer(from)) return
      if (!this.statOf(from).kick) return
      const req = decodeKickReq(msg.payload)
      if (!req) return
      let bomb: BombInfo | null = null
      for (const b of this.bombs.values()) {
        if (b.cx === req.cx && b.cy === req.cy && !b.motion) {
          bomb = b
          break
        }
      }
      if (bomb) this.validateKick(bomb, Math.sign(req.dx), Math.sign(req.dy))
      return
    }
    if (msg.type === 'throwReq') {
      // guest 送丟炸彈請求：host 依該玩家當前位置與面向驗證
      if (this.ctx.role !== 'host' || !this.isPlayer(from)) return
      if (!this.statOf(from).throw) return
      const req = decodeThrowReq(msg.payload)
      if (!req) return
      this.validateThrow(from, Math.sign(req.dx), Math.sign(req.dy))
      return
    }
    if (msg.type === 'restartReq') {
      // 僅在結算中，或請求者已陣亡且真人全滅（只剩 bot）時受理，避免陣亡者切掉活人的回合
      if (this.ctx.role !== 'host' || !this.isPlayer(from)) return
      if (this.canAdvance(from)) this.hostAdvance()
      return
    }
    // seed/bomb/boom 僅信任 host 廣播；guest 之間不互發這些訊息
    if (this.ctx.role === 'host') return
    if (from !== this.ctx.hostId) return
    const decoded = decodeBomberMessage(msg.type, msg.payload)
    if (decoded) this.applyDecoded(decoded)
  }

  // ---- 生命週期 ----

  init(ctx: GameContext): void {
    this.ctx = ctx
    const { scene } = ctx

    // 固定俯視相機（不開放操作）
    this.camera = new ArcRotateCamera('cam', -Math.PI / 2, 0.55, 30, Vector3.Zero(), scene)
    // 光影與後製（AC4／AC7）：雙光、陰影、Glow 白名單、描邊、後製、解析度與檔位
    const halfDiag = Math.hypot(GRID_W * CELL, GRID_H * CELL) / 2
    this.look = new ToyLook(scene, this.camera, { shadowRadius: halfDiag + CELL })

    // 場景物件（A「Toy Box」）：地面單 mesh＋程式棋盤，柱牆／外框／木箱／落牆／炸彈／火焰／道具走 thin instance
    this.board = new ToyBoard(scene, {
      gridW: GRID_W,
      gridH: GRID_H,
      cell: CELL,
      toWorld: (cx, cy) => ({ x: cellToWorld(cx, GRID_W), z: cellToWorld(cy, GRID_H) }),
    })
    this.avatarKit = new AvatarKit(scene)
    const fx = this.board.fxTargets()
    this.look.toon(...fx.toon, this.avatarKit.bodyMat)
    this.look.receiver(...fx.receivers)
    this.look.caster(...fx.casters)
    this.look.outline(...fx.outlined)
    for (const g of fx.glow) this.look.glowMesh(g.mesh, g.color, g.strength)
    // AC5：特效（粒子上限依檔位）
    this.fx = new ToyFx(scene, { cell: CELL, cap: this.look.settings.particleCap })
    this.look.toon(...this.fx.toonMaterials())
    // AC8：draw calls 量測（每 PERF_LOG_MS 印一次）
    this.instr = new SceneInstrumentation(scene)

    this.selfAvatar = this.makePlayer(ctx.selfId)
    // 狀態列改由 React HUD（ctx.setHud）顯示；開局倒數用 A 配色，掛在不經後製的 UI 相機
    if (typeof document !== 'undefined') void document.fonts?.load('bold 64px Fredoka').catch(() => undefined)
    this.banner = createCountdownPanel(scene, this.look.uiCamera, 'banner', 7, 4, new Vector3(0, 0.3, 8), {
      theme: COUNTDOWN_THEME,
      layerMask: UI_LAYER,
    })

    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)

    this.flow = createGameFlow({ net: ctx.net, game: this.gameId, role: ctx.role, hostId: ctx.hostId })
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

  /** 固定步長：移動 +（host）引信與勝負裁決 */
  private simulate(dt: number): void {
    const playing = this.flow.state.phase === 'playing'

    // 偵測 phase 轉入/離開 playing：記錄本局起始時刻（突然死亡計時依此，各端一致地以本地 now 起算）
    if (playing && !this.wasPlaying) {
      this.playingSince = performance.now()
      this.lastClose = 0
      this.closeIndex = 0
      this.lastCloseApplied = 0
      this.closePreviewFrom = 0
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
  // 尋路與決策為純邏輯，已抽至 bomberAI.ts；此處只負責取快照、套用結果。

  /** 現存炸彈轉為 AI 用的純資料（帶擁有者火力） */
  private aiBombs(): AiBomb[] {
    return [...this.bombs.values()].map((b) => ({
      cx: b.cx,
      cy: b.cy,
      fire: this.statOf(b.owner).fire,
      explodeAt: b.explodeAt,
    }))
  }

  /** 對每隻 alive bot 跑 AI 決策，並套用移動／放彈 */
  private simulateBots(dt: number): void {
    if (this.bots.length === 0) return
    const dmap = computeDangerMap(this.map, this.aiBombs(), this.flames, performance.now())
    const now = performance.now()
    const itemCells = new Set(this.items.keys())

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

      // 其他存活實體所在格（自己以外）
      const enemyCells: [number, number][] = []
      for (const e of this.entities()) {
        if (e.id === bot.id || !this.isAlive(e.id)) continue
        const ep = this.posOf(e.id)
        if (ep) enemyCells.push([worldToCell(ep.x, GRID_W), worldToCell(ep.z, GRID_H)])
      }

      const action = decideBotAction({
        map: this.map,
        bombs: this.aiBombs(),
        danger: dmap,
        now,
        cx,
        cy,
        speed,
        fire: stat.fire,
        aggro: botAggro(bot.id),
        itemCells,
        enemyCells,
        bombReady: now - (this.botBombInput.get(bot.id) ?? 0) > BOMB_INPUT_COOLDOWN_MS * 3,
        tuning: AI_TUNING,
      })

      if (action.type === 'move') {
        moveToward(action.cx, action.cy)
      } else if (action.type === 'bomb') {
        this.botBombInput.set(bot.id, now)
        this.validateBomb(bot.id, cx, cy)
      }
    }
  }

  update(deltaMs: number): void {
    const phase = this.flow.state.phase
    // AC7：連續 60 幀平均過低就自動降一級（描邊 → Glow → 陰影）
    this.look.update(deltaMs)

    const now = performance.now()

    // 自己
    if (this.selfAvatar) {
      this.selfAvatar.root.position.x = this.state.x
      this.selfAvatar.root.position.z = this.state.z
      this.animateAvatar(this.selfAvatar, deltaMs)
      this.applyDeath(this.selfAvatar, this.ctx.selfId, now)
    }

    // 遠端：增刪 + 插值
    const ids = new Set(this.own.remoteIds())
    for (const [id, a] of this.peerAvatars) {
      if (ids.has(id)) continue
      disposeAvatar(a.toy)
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
      this.applyDeath(a, id, now)
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
      a.root.setEnabled(this.isAlive(id) || this.dying.has(id))
      this.animateAvatar(a, deltaMs)
      this.applyDeath(a, id, now)
    }

    // 俯角透視補償：每隻角色依位置微傾（用本幀相機位置；震動的偏移很小，一併吃進去）
    const camPos = this.camera.position
    const camUp = this.camera.getDirection(Vector3.Up())
    for (const av of [this.selfAvatar, ...this.peerAvatars.values(), ...this.botAvatars.values()]) {
      if (av?.root.isEnabled()) this.leanUpright(av, camPos, camUp)
    }

    // 無敵視覺：身體外圈金色光殼閃爍（8Hz，最後 1.5 秒 16Hz）
    const applyInvis = (av: Avatar | undefined, id: string) => {
      if (!av || !av.root.isEnabled() || this.dying.has(id)) return
      av.toy.halo.isVisible = invincibleBlinkOn(now, this.statOf(id).invincibleUntil)
    }
    applyInvis(this.selfAvatar, this.ctx.selfId)
    for (const [id, a] of this.peerAvatars) applyInvis(a, id)
    for (const [id, a] of this.botAvatars) applyInvis(a, id)

    // 火焰：到期清除 + 生長/收縮動畫（臂依 showAt 由爆心往外依序冒出）；emissive 隨最新一波爆炸 1.0 → 0.4
    let youngest = -Infinity
    this.flames = this.flames.filter((f) => {
      if (f.until <= now) {
        this.board.removeFlame(f.fx)
        return false
      }
      youngest = Math.max(youngest, f.bornAt)
      const grow = Math.min(1, (now - f.showAt) / FLAME_GROW_MS)
      if (grow <= 0) {
        this.board.poseFlame(f.fx, 0.01, 0.01, 1)
        return true
      }
      const fade = Math.min(1, (f.until - now) / FLAME_FADE_MS)
      const s = grow * (0.4 + 0.6 * fade)
      this.board.poseFlame(f.fx, grow, s, 1 + 0.3 * Math.sin(now * 0.02 + f.cx + f.cy))
      return true
    })
    if (this.flames.length > 0) this.board.setFlameIntensity(flameEmissive(now - youngest, FLAME_MS))

    // 炸彈：放下時 0.6 → 1.0 彈跳；脈動；將爆前閃紅並放大脈動（1.0↔1.12）、引信火花加倍；踢滑行/丟拋物的位置插值
    for (const [id, b] of this.bombs) {
      const left = b.explodeAt - now
      const flashing = left < BOMB_FLASH_MS
      const pulse = flashing ? 1.06 + 0.06 * Math.sin(now * 0.035) : 1 + 0.04 * Math.sin(now * 0.012)
      // 移動動畫：依時間插值位置；拋物加上弧高；結束後吸附終點並清除 motion
      const m = b.motion
      if (m) {
        const t = Math.min(1, (now - m.startAt) / (m.endAt - m.startAt))
        b.x = m.fromX + (m.toX - m.fromX) * t
        b.z = m.fromZ + (m.toZ - m.fromZ) * t
        b.y = 0.55 + m.arc * Math.sin(Math.PI * t)
        if (t >= 1) {
          b.x = m.toX
          b.y = 0.55
          b.z = m.toZ
          b.motion = undefined
        }
      }
      const scale = pulse * placeScale((now - (b.explodeAt - BOMB_FUSE_MS)) / PLACE_POP_MS)
      this.board.setBomb(id, b.x, b.y, b.z, scale, flashing && Math.sin(now * 0.04) > 0)
      this.fx.fuse(id, b.x + FUSE_TIP.x * scale, b.y + FUSE_TIP.y * scale, b.z, flashing, deltaMs)
    }
    this.fx.endFuseFrame()

    // 突然死亡預告格：下一面牆落下前 CLOSE_WARN_MS 在該格畫紅色脈動格（純視覺，時刻對齊 host 的落牆節奏）
    const warnOn =
      phase === 'playing' &&
      closeWarningActive({
        now,
        playingSince: this.playingSince,
        lastClose: this.lastCloseApplied,
        suddenMs: SUDDEN_DEATH_MS,
        intervalMs: CLOSE_INTERVAL_MS,
        leadMs: CLOSE_WARN_MS,
      })
    const warnCell = warnOn
      ? nextCloseCell(this.spiralCells(), (cx, cy) => this.map[cellIndex(cx, cy)] === TILE_WALL, this.closePreviewFrom)
      : null
    this.board.setWarning(warnCell, 0.5 + 0.5 * Math.sin(now * 0.025))

    // 爆炸相機震動（衰減的隨機偏移）
    const shakeLeft = this.shakeUntil - now
    if (shakeLeft > 0) {
      const k = (shakeLeft / SHAKE_MS) * 0.4
      this.camera.target.set((Math.random() - 0.5) * k, 0, (Math.random() - 0.5) * k)
    } else {
      this.camera.target.set(0, 0, 0)
    }

    // 道具浮動擺盪、拾取飛行、落牆下落、所有 thin instance 上傳（每幀一次）；落牆落地：灰塵環＋音效＋震動
    const landed = this.board.update(now, deltaMs)
    for (const w of landed) {
      this.fx.dust(w.x, w.z)
      playSfx('explosion')
      this.shakeUntil = now + SHAKE_MS
    }
    this.fx.update(now, deltaMs)

    // AC8：每 2 秒印 draw calls 與 fps（讀的是上一幀的完整計數）
    if (this.instr && now - this.lastPerfLog >= PERF_LOG_MS) {
      this.lastPerfLog = now
      const calls = this.instr.drawCallsCounter.current
      const fps = Math.round(this.ctx.scene.getEngine().getFps())
      console.info(`[bomber] drawCalls=${calls} fps=${fps}`)
    }

    // HUD：React 玩家卡＋計時器（共用契約 GameHud；每幀傳新物件，量化後內容沒變就不重繪）
    this.syncHud(phase, now)

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

  /** 組 HUD 資料交給 React（勝場取最近一次結算，host 與 guest 看到的一致） */
  private syncHud(phase: string, now: number): void {
    const setHud = this.ctx.setHud
    if (!setHud) return
    const result = this.flow.state.result as RoundResult | undefined
    if (phase === 'result' && result) {
      for (const sc of result.scores) this.shownScores.set(sc.id, sc.score)
      this.shownMatchOver = result.matchOver
    }
    setHud(
      buildBomberHud({
        entities: this.entities().map((e) => ({
          id: e.id,
          name: this.nameFor(e.id),
          isAI: this.isBot(e.id),
          colorIndex: this.colorIndex(e.id),
        })),
        selfId: this.ctx.selfId,
        now,
        timer: suddenDeathSeconds({
          now,
          playingSince: phase === 'playing' ? this.playingSince : 0,
          suddenMs: SUDDEN_DEATH_MS,
        }),
        alive: (id) => this.isAlive(id),
        wins: (id) => this.shownScores.get(id) ?? 0,
        stat: (id) => this.statOf(id),
      })
    )
  }

  dispose(): void {
    this.ctx.setHud?.(null)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    stopAllAudio()
    this.ticker.stop()
    this.own.stop()
    this.flow.dispose()
    this.offOpen?.()
    if (this.selfAvatar) disposeAvatar(this.selfAvatar.toy)
    this.selfAvatar = undefined
    for (const a of this.peerAvatars.values()) disposeAvatar(a.toy)
    this.peerAvatars.clear()
    for (const a of this.botAvatars.values()) disposeAvatar(a.toy)
    this.botAvatars.clear()
    this.avatarKit.dispose()
    this.botState.clear()
    this.botTarget.clear()
    this.bots = []
    this.bombs.clear()
    this.flames = []
    this.items.clear()
    this.board.dispose()
    this.instr?.dispose()
    this.instr = null
    this.fx.dispose()
    this.look.dispose()
    this.dying.clear()
    this.banner.dispose()
  }
}

export const createBomberScene = (): GameModule => new BomberScene()
