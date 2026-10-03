import { ArcRotateCamera, Color4, Mesh, SceneInstrumentation, Vector3 } from '@/babylon/babylonCore'
import type { GameContext, GameModule, GameOverlay } from '@/babylon/types'
import type { GameNetMessage } from '@/core/webrtc'
import { attachFlowAudio, playSfx, stopAllAudio } from '@/babylon/audio'
import { createCountdownPanel, type TextPanel } from '@/babylon/hud'
import { COUNTDOWN_THEME } from '@/babylon/fx/countdown'
import { fxRandom } from '@/babylon/fx/emitter'
import {
  canAdvanceMidRound,
  createFixedTicker,
  createGameFlow,
  createOwnershipSync,
  isIntIn,
  isNumIn,
  isObj,
  isOneOf,
  isStr,
  type FixedTicker,
  type GameFlow,
  type OwnershipSync,
} from '@/babylon/net'
import { ToyLook, UI_LAYER } from '@/babylon/fx/look'
import { perfLogLine } from '@/babylon/fx/perfLog'
import { tierQuery } from '@/babylon/fx/quality'
import { closeWarningActive, nextCloseCell } from '@/babylon/games/bomberFx/suddenDeath'
import { validateShootReq } from '@/babylon/games/tankNet'
import { stepBullet } from '@/babylon/games/tankFx/bounce'
import { CLOSE_INTERVAL_MS, CLOSE_WARN_MS, SUDDEN_DEATH_MS, closeDue, crushedIds, spiralCells } from '@/babylon/games/tankFx/closing'
import {
  INVULN_MS,
  ITEM_KINDS,
  KNOCKBACK,
  SHIELD_MS,
  TRIPLE_MS,
  buffRemainSec,
  knockback,
  pickItemKind,
  resolveHit,
  tripleVelocities,
  type ItemKind,
} from '@/babylon/games/tankFx/combat'
import { CELL, GRID_H, GRID_W, cellIdx, cellToWorld, tankMoveBlocked, worldToCell } from '@/babylon/games/tankFx/grid'
import {
  decodeBotState,
  decodeBounce,
  decodeClose,
  decodeCrate,
  decodeHit,
  decodePickup,
  decodeSeed,
  type BotStateEntry,
} from '@/babylon/games/tankFx/messages'
import { paceTick } from '@/babylon/games/tankFx/pacing'
import { entityIds, makeBots, rankStandings, tankColorIndex, type RosterEntry, type Standing } from '@/babylon/games/tankFx/roster'
import { createAIMemory, decideTankBot, type TankAIMemory } from '@/babylon/games/tankFx/tankAI'
import { benchEnabled, benchLayout } from '@/babylon/games/tankFx/bench'
import { BULLET_Y, DROP_MS, TankBoard } from '@/babylon/games/tankFx/board'
import { TankFx } from '@/babylon/games/tankFx/effects'
import {
  expiryBlinkOn,
  invulnVisibility,
  shakeAllowed,
  shakeAmp,
  shieldPose,
  streakAfterKill,
  streakLabel,
  type Streak,
} from '@/babylon/games/tankFx/fxModel'
import { KillFeed, buildTankHud, tankTimer, type TankTimer } from '@/babylon/games/tankFx/hudModel'
import { ITEM_COLORS, OUTLINE, PLAYER_PALETTE, TANK, type ColorIndex } from '@/babylon/games/tankFx/palette'
import { TankKit, disposeTank, poseTank, type TankRig } from '@/babylon/games/tankFx/tankModel'

/**
 * 坦克對戰（Host Authority 事件制）。
 *
 * - 位置/砲塔：真人 ownership 20Hz 廣播、遠端插值；bot 由 host 模擬並以 botState 20Hz 廣播
 * - 射擊：guest 廣播 shootReq → host 驗證 → 廣播 bullet（三連發由 host 依 buff 補兩發）
 * - 子彈：各端以 tankFx/bounce 同一支純函式推進；host 判定反彈後廣播 bounce 供 guest 校正
 * - 碰撞/HP/道具/縮圈/勝負：host 裁決 → 廣播 hit/destroyed/crate/item/pickup/close
 */

interface TankState {
  x: number
  z: number
  ry: number
  turretAngle: number
}

interface BulletInfo {
  id: string
  owner: string
  x: number
  z: number
  vx: number
  vz: number
  bounces: number
  createdAt: number
}

interface TankVisual {
  rig: TankRig
  root: Mesh
  turret: Mesh
  /** 護盾泡泡與三連發光環（spec §6，平常收起） */
  shield: Mesh
  aura: Mesh
  /** 護盾被打破的時刻（播碎裂用） */
  shieldBrokeAt: number
}

interface ItemInfo {
  kind: ItemKind
}

interface PlayerStat {
  alive: boolean
  hp: number
  maxHp: number
  kills: number
  speedUntil: number
  rapidUntil: number
  shieldUntil: number
  tripleUntil: number
  invulnUntil: number
}

const SIM_HZ = 30
const MOVE_SPEED = 4.5
const TURRET_SPEED = 3.5
const BULLET_SPEED = 12
const BULLET_LIFETIME_MS = 2000
const FIRE_COOLDOWN_MS = 500
const INIT_HP = 3
const CRATE_DROP_CHANCE = 0.5
/** 既有道具效果：加速 ×1.25、連射冷卻 ×0.5，各 5 秒 */
const SPEED_MUL = 1.25
const RAPID_MUL = 0.5
const BUFF_MS = 5000
/** 世界座標容許範圍（場地半徑再放寬一格，擋掉離譜座標） */
const WORLD_LIMIT = (GRID_W * CELL) / 2 + CELL
/** 子彈速度上限（擋掉超速外掛封包） */
const VEL_LIMIT = BULLET_SPEED * 2
const LIMITS = { worldLimit: WORLD_LIMIT, velLimit: VEL_LIMIT }
/** bot 位置廣播間隔（20Hz） */
const BOT_BROADCAST_MS = 50
/** 子彈命中坦克的判定距離 */
const HIT_RADIUS = 0.7
/** 陰影正交範圍半徑（spec §5：hypot(18, 18) × CELL / 2 ≈ 25.5） */
const SHADOW_RADIUS = 26
/** draw calls／fps 量測間隔（AC10） */
const PERF_LOG_MS = 2000
/** 落牆預告格脈動頻率（spec §8 #15：6Hz） */
const WARN_PULSE_HZ = 6
/** blob 影尺寸（陰影被降級關掉時） */
const BLOB_TANK = 1.9
const BLOB_ITEM = 1.1
/** 相機注視點（spec §1 裁定）；鏡頭微震在附近抖、結束歸位 */
const CAM_TARGET = new Vector3(0, 0, -2)
/** 砲口離車心的水平距離與高度（砲口焰、火花位置） */
const MUZZLE_DIST = 1.0
const MUZZLE_Y = 0.68
/** 履帶痕池（spec §8 #11：桌機 120、手機 60） */
const TREAD_CAP = { desktop: 120, mobile: 60 } as const

const SPAWN_CORNERS: [number, number][] = [
  [1, 1],
  [GRID_W - 2, GRID_H - 2],
  [1, GRID_H - 2],
  [GRID_W - 2, 1],
]

const SPIRAL = spiralCells(GRID_W, GRID_H)

const speedMulOf = (s: PlayerStat, now: number) => (s.speedUntil > now ? SPEED_MUL : 1)
const rapidMulOf = (s: PlayerStat, now: number) => (s.rapidUntil > now ? RAPID_MUL : 1)

/** 砲塔往目標角轉，最多 maxStep（取最短方向） */
const rotateToward = (cur: number, target: number, maxStep: number): number => {
  let d = (target - cur) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return Math.abs(d) <= maxStep ? cur + d : cur + Math.sign(d) * maxStep
}

class TankScene implements GameModule {
  readonly gameId = 'tank'
  private ctx!: GameContext
  private keys = new Set<string>()
  private ticker!: FixedTicker
  private own!: OwnershipSync<TankState>
  private flow!: GameFlow
  private offOpen: (() => void) | null = null

  private state: TankState = { x: 0, z: 0, ry: 0, turretAngle: 0 }
  private stats = new Map<string, PlayerStat>()
  /** host：各實體上次開火時刻（shootReq／bot 冷卻驗證用；每局重置） */
  private lastShotAt = new Map<string, number>()
  private bullets = new Map<string, BulletInfo>()
  private items = new Map<number, ItemInfo>()
  /** 固定柱牆（init 時決定） */
  private baseWalls = new Set<number>()
  /** 目前所有不可破牆（柱牆＋突然死亡落下的牆） */
  private walls = new Set<number>()
  private closedWalls = new Set<number>()
  private crates = new Set<number>()
  private currentSeed = 1
  private lastFireInput = 0
  private bulletSeq = 0
  private resultElapsed = 0
  private lastOverlayKey = ''

  // 縮圈：playingSince 為本端進 playing 的時刻；closeIndex 為下一面的螺旋起點
  private playingSince = 0
  private lastClose = 0
  private closeIndex = 0
  private warnCell: { cx: number; cy: number } | null = null

  // 電腦玩家（補滿至 4 台）：名冊由 host 決定並隨 seed 廣播
  private bots: RosterEntry[] = []
  /** host：bot 模擬位置；guest：host 廣播的插值目標 */
  private botState = new Map<string, TankState>()
  /** guest：bot 顯示位置（平滑追 botState） */
  private botDraw = new Map<string, TankState>()
  private botMem = new Map<string, TankAIMemory>()
  private lastBotBroadcast = 0

  private selfVisual?: TankVisual
  private peerVisuals = new Map<string, TankVisual>()
  private botVisuals = new Map<string, TankVisual>()
  private camera!: ArcRotateCamera
  private banner!: TextPanel

  // A「Toy Army」美術（AC5／AC6／AC9）：場景物件、坦克化身、光影與檔位
  private look!: ToyLook
  private board!: TankBoard
  private kit!: TankKit
  // AC7 特效、AC8 React HUD：擊殺通知、連殺、結算凍結的計時、鏡頭微震
  private fx!: TankFx
  private feed = new KillFeed()
  private streaks = new Map<string, Streak>()
  private lastTimer: TankTimer | null = null
  private shakeAt = -Infinity
  private shakeOk = false
  private shaking = false
  /** 陰影被自動降級關掉後，坦克與道具改墊 blob 影 */
  private blobShadows = false
  // AC10：draw calls 量測；?tankBench=1（限 tankNoDegrade=1）擺固定量測場景
  private instr: SceneInstrumentation | null = null
  private lastPerfLog = 0
  private bench = false

  private onKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase()
    this.keys.add(key)
    if (key === ' ' || key === 'enter') this.requestFire()
    if (key === 'r') this.requestRestart()
  }
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase())

  /** 所有實體（真人 players 在前、bots 在後） */
  private entities(): RosterEntry[] {
    return [...this.ctx.players, ...this.bots]
  }

  private isBot(id: string): boolean {
    return this.bots.some((b) => b.id === id)
  }

  private colorIndex(id: string): number {
    return tankColorIndex(id, this.ctx.players, this.bots)
  }

  private nameFor(id: string): string {
    return this.entities().find((p) => p.id === id)?.name ?? id.slice(0, 6)
  }

  private isAlive(id: string): boolean {
    return this.stats.get(id)?.alive ?? false
  }

  private freshStat(): PlayerStat {
    return {
      alive: true,
      hp: INIT_HP,
      maxHp: INIT_HP,
      kills: 0,
      speedUntil: 0,
      rapidUntil: 0,
      shieldUntil: 0,
      tripleUntil: 0,
      invulnUntil: 0,
    }
  }

  private statOf(id: string): PlayerStat {
    let s = this.stats.get(id)
    if (!s) {
      s = this.freshStat()
      this.stats.set(id, s)
    }
    return s
  }

  /** 某實體當前位置（自己用本地、bot 用 host 模擬／廣播目標、其餘遠端用最新樣本） */
  private posOf(pid: string): TankState | null {
    if (pid === this.ctx.selfId) return this.state
    if (this.isBot(pid)) return this.botState.get(pid) ?? null
    return this.own.latestRemote(pid)
  }

  private spawnOf(id: string): TankState {
    const idx = Math.max(0, entityIds(this.ctx.players, this.bots).indexOf(id))
    const [cx, cy] = SPAWN_CORNERS[idx % SPAWN_CORNERS.length]
    return { x: cellToWorld(cx, GRID_W), z: cellToWorld(cy, GRID_H), ry: 0, turretAngle: 0 }
  }

  private makeTank(id: string, x: number, z: number): TankVisual {
    const rig = this.kit.build(id, this.colorIndex(id) as ColorIndex, this.isBot(id), id === this.ctx.selfId, x, z)
    // 光影登記（AC6）：坦克 2 個 mesh（hull、turret）投影＋描邊（mobile 檔描邊關著，ToyLook 依檔位決定）
    this.look.caster(...rig.parts)
    this.look.outline(...rig.parts)
    const shield = this.fx.makeShield(id, rig.root)
    const aura = this.fx.makeAura(id, rig.root)
    return { rig, root: rig.root, turret: rig.turret, shield, aura, shieldBrokeAt: -Infinity }
  }

  /** 拆一台坦克化身（護盾、光環是 root 的子物件，一起清；每台自己的履帶貼圖也清） */
  private disposeVisual(id: string, v: TankVisual): void {
    this.fx.forget(id)
    disposeTank(v.rig)
  }

  /** 固定 4 色：名冊變動（bot 補位、有人離房）時顏色跟著改 */
  private paintTank(v: TankVisual, ci: number): void {
    this.kit.repaint(v.rig, ci as ColorIndex)
  }

  /**
   * 每幀同步一台坦克的顏色、殘骸、無敵閃爍、護盾泡泡、三連發光環與連射砲口環（spec §6），
   * 再擺姿勢；回傳這一幀的位移（出履帶痕用）。
   */
  private syncTankVisual(v: TankVisual, id: string, now: number): number {
    const s = this.statOf(id)
    const alive = this.isAlive(id)
    this.paintTank(v, this.colorIndex(id))
    this.kit.setWreck(v.rig, !alive, now)
    this.kit.setRapid(v.rig, alive && s.rapidUntil > now)
    const vis = alive ? invulnVisibility(now, s.invulnUntil) : 1
    for (const m of v.rig.parts) m.visibility = vis
    v.rig.label?.setEnabled(alive)

    const sp = shieldPose(now, alive ? s.shieldUntil : 0, v.shieldBrokeAt)
    v.shield.setEnabled(sp !== null)
    if (sp) {
      v.shield.scaling.setAll(sp.scale)
      v.shield.visibility = sp.alpha
      v.shield.rotation.y = (now / 1000) * 0.6
    }
    const auraOn = alive && expiryBlinkOn(now, s.tripleUntil)
    v.aura.setEnabled(auraOn)
    if (auraOn) v.aura.rotation.y = (now / 1000) * 1.2
    return poseTank(v.rig, now)
  }

  /** 移動中的坦克出履帶痕與揚塵（加速 buff 揚塵加倍、換色） */
  private trackFx(v: TankVisual, id: string, dist: number, now: number): void {
    if (dist <= 0 || !this.isAlive(id)) return
    const p = v.root.position
    this.fx.move(id, p.x, p.z, v.root.rotation.y, dist, this.statOf(id).speedUntil > now, now)
  }

  // ---- 地圖 ----

  private generateWalls(): void {
    this.baseWalls.clear()
    for (let cy = 1; cy < GRID_H; cy += 2) {
      for (let cx = 1; cx < GRID_W; cx += 2) {
        // 出生角（如 [1,1]）不可放牆，否則該位玩家出生即卡死在牆內
        if (SPAWN_CORNERS.some(([sx, sy]) => sx === cx && sy === cy)) continue
        this.baseWalls.add(cellIdx(cx, cy))
      }
    }
  }

  private isWall = (cx: number, cy: number): boolean => this.walls.has(cellIdx(cx, cy))
  private isCrate = (cx: number, cy: number): boolean => this.crates.has(cellIdx(cx, cy))

  private applySeed(seed: number): void {
    // 清理舊箱子、道具、子彈、碎片與落牆（thin instance 只清 buffer，不 dispose mesh）
    this.crates.clear()
    this.board.clearCrates()
    this.items.clear()
    this.board.clearItems()
    this.bullets.clear()
    this.board.clearBullets()
    this.fx.clearRound()
    this.feed.clear()
    this.streaks.clear()
    this.lastTimer = null
    this.closedWalls.clear()
    this.board.clearClosingWalls()
    this.walls = new Set(this.baseWalls)
    this.lastClose = 0
    this.closeIndex = 0
    this.warnCell = null

    // 初始化所有實體 stats（含 bot）
    this.lastShotAt.clear()
    this.stats.clear()
    for (const e of this.entities()) this.stats.set(e.id, this.freshStat())

    // 確定性隨機：seed 決定木箱位置
    let rng = seed
    const nextRng = () => {
      rng = (rng * 1103515245 + 12345) & 0x7fffffff
      return rng / 0x7fffffff
    }

    for (let cy = 0; cy < GRID_H; cy++) {
      for (let cx = 0; cx < GRID_W; cx++) {
        const idx = cellIdx(cx, cy)
        if (this.walls.has(idx)) continue
        // 出生點附近不放箱子
        const nearSpawn = SPAWN_CORNERS.some(([sx, sy]) => Math.abs(cx - sx) <= 1 && Math.abs(cy - sy) <= 1)
        if (nearSpawn) continue
        if (nextRng() < 0.3) {
          this.crates.add(idx)
          this.board.setCrate(idx, true)
        }
      }
    }

    // 自己回出生角（依「真人＋bot」合併名冊的序）
    this.state = this.spawnOf(this.ctx.selfId)

    // bot 位置與化身：依名冊重建
    for (const [id, v] of this.botVisuals) {
      if (this.bots.some((b) => b.id === id)) continue
      this.disposeVisual(id, v)
      this.botVisuals.delete(id)
    }
    this.botState.clear()
    this.botDraw.clear()
    this.botMem.clear()
    for (const b of this.bots) {
      const sp = this.spawnOf(b.id)
      this.botState.set(b.id, { ...sp })
      this.botDraw.set(b.id, { ...sp })
      this.botMem.set(b.id, createAIMemory())
      if (!this.botVisuals.has(b.id)) this.botVisuals.set(b.id, this.makeTank(b.id, sp.x, sp.z))
    }

    this.selfVisual?.root.setEnabled(true)
    for (const v of this.peerVisuals.values()) v.root.setEnabled(true)
    if (this.bench) this.placeBench()
  }

  /** AC10 N1 量測場景：5 種道具各一、10 顆靜止子彈（純視覺，不進遊戲邏輯） */
  private placeBench(): void {
    const lay = benchLayout((cx, cy) => this.isWall(cx, cy) || this.isCrate(cx, cy))
    lay.items.forEach((it, i) => this.board.addItem(`bench-${i}`, it.kind, it.cx, it.cy))
    lay.bullets.forEach((b, i) =>
      this.board.putBullet(`bench-${i}`, cellToWorld(b.cx, GRID_W), cellToWorld(b.cy, GRID_H), false)
    )
  }

  /** 從 (fx,fz) 移到 (tx,tz) 是否被擋：只擋新碰到或更深入的牆／木箱（落牆擦到的坦克仍能脫困） */
  private moveBlocked(fx: number, fz: number, tx: number, tz: number): boolean {
    return tankMoveBlocked(fx, fz, tx, tz, (cx, cy) => this.isWall(cx, cy) || this.isCrate(cx, cy))
  }

  // ---- 射擊 ----

  private hostBroadcast(type: string, payload: unknown): void {
    this.ctx.net.broadcast({ game: this.gameId, type, payload })
    this.applyMessage(type, payload)
  }

  private requestFire(): void {
    if (this.flow.state.phase !== 'playing' || !this.isAlive(this.ctx.selfId)) return
    const now = performance.now()
    const stat = this.statOf(this.ctx.selfId)
    const cd = FIRE_COOLDOWN_MS * rapidMulOf(stat, now)
    if (now - this.lastFireInput < cd) return
    this.lastFireInput = now

    const vx = Math.sin(this.state.turretAngle) * BULLET_SPEED
    const vz = Math.cos(this.state.turretAngle) * BULLET_SPEED
    const sx = this.state.x + Math.sin(this.state.turretAngle) * 0.6
    const sz = this.state.z + Math.cos(this.state.turretAngle) * 0.6

    if (this.ctx.role === 'host') {
      this.lastShotAt.set(this.ctx.selfId, now)
      this.hostFire(this.ctx.selfId, sx, sz, vx, vz)
    } else {
      this.ctx.net.broadcast({
        game: this.gameId,
        type: 'shootReq',
        payload: { x: sx, z: sz, vx, vz },
      })
    }
  }

  /** host：開火（真人、guest 請求、bot 共用）。三連發 buff 中由 host 補左右兩發，各自廣播 bullet */
  private hostFire(owner: string, x: number, z: number, vx: number, vz: number): void {
    const s = this.statOf(owner)
    const vels: [number, number][] = s.tripleUntil > performance.now() ? tripleVelocities(vx, vz) : [[vx, vz]]
    for (const [bvx, bvz] of vels) {
      this.hostBroadcast('bullet', { id: `b${this.bulletSeq++}`, owner, x, z, vx: bvx, vz: bvz })
    }
  }

  private spawnBullet(id: string, owner: string, x: number, z: number, vx: number, vz: number): void {
    const now = performance.now()
    this.bullets.set(id, { id, owner, x, z, vx, vz, bounces: 0, createdAt: now })
    this.board.putBullet(id, x, z, false)
    // 開砲後座＋車身擠壓回彈＋砲口焰（三連發同一刻的三發共用一次；第一發是中央那發）
    const v = this.visualOf(owner)
    if (v && now - v.rig.fireAt > 40) {
      v.rig.fireAt = now
      const len = Math.hypot(vx, vz) || 1
      const dx = vx / len
      const dz = vz / len
      const p = v.root.position
      this.fx.muzzle(p.x + dx * MUZZLE_DIST, MUZZLE_Y, p.z + dz * MUZZLE_DIST, dx, dz, now)
      playSfx('tank_fire')
    }
  }

  /** 反彈火花＋牆面白環：法線由反射前後的速度差推得（角落反彈即對角線） */
  private bounceFx(x: number, z: number, ivx: number, ivz: number, vx: number, vz: number): void {
    const nx = vx - ivx
    const nz = vz - ivz
    const n = Math.hypot(nx, nz) || 1
    this.fx.bounce(x, z, vx, vz, nx / n, nz / n, performance.now())
    playSfx('tank_bounce')
  }

  private removeBullet(id: string): void {
    if (!this.bullets.delete(id)) return
    this.board.removeBullet(id)
  }

  private visualOf(id: string): TankVisual | undefined {
    if (id === this.ctx.selfId) return this.selfVisual
    return this.peerVisuals.get(id) ?? this.botVisuals.get(id)
  }

  /** 各端推進子彈（同一支 stepBullet）；host 另判反彈廣播、木箱、命中 */
  private stepBullets(dt: number, now: number): void {
    const host = this.ctx.role === 'host'
    for (const [id, b] of [...this.bullets]) {
      if (!this.bullets.has(id)) continue
      if (now - b.createdAt > BULLET_LIFETIME_MS) {
        this.removeBullet(id)
        continue
      }
      const r = stepBullet(b, dt, this.isWall, this.isCrate)
      if (r.kind === 'expire') {
        this.removeBullet(id)
        continue
      }
      if (r.kind === 'crate') {
        this.removeBullet(id)
        if (host) {
          const ci = cellIdx(r.cx, r.cy)
          this.hostBroadcast('crate', { ci, bulletId: id })
          if (Math.random() < CRATE_DROP_CHANCE) {
            this.hostBroadcast('item', { cx: r.cx, cy: r.cy, kind: pickItemKind(Math.random()) })
          }
        }
        continue
      }
      const ovx = b.vx
      const ovz = b.vz
      b.x = r.x
      b.z = r.z
      b.vx = r.vx
      b.vz = r.vz
      b.bounces = r.bounces
      this.board.putBullet(id, b.x, b.z, b.bounces > 0)
      if (r.kind === 'bounce') {
        // 反彈火花：host 判定與 guest 預測都播（spec §8 #3）；法線取反射前後速度差
        this.bounceFx(b.x, b.z, ovx, ovz, b.vx, b.vz)
        if (host) {
          this.ctx.net.broadcast({
            game: this.gameId,
            type: 'bounce',
            payload: { bulletId: id, x: b.x, z: b.z, vx: b.vx, vz: b.vz },
          })
        }
      }
      if (host) this.hostBulletHits(b, now)
    }
  }

  /** host：子彈與坦克碰撞。反彈過的子彈可命中發射者 */
  private hostBulletHits(b: BulletInfo, now: number): void {
    for (const e of this.entities()) {
      if (e.id === b.owner && b.bounces === 0) continue
      if (!this.isAlive(e.id)) continue
      const pos = this.posOf(e.id)
      if (!pos) continue
      if (Math.hypot(b.x - pos.x, b.z - pos.z) >= HIT_RADIUS) continue
      const s = this.statOf(e.id)
      const out = resolveHit(s, now)
      const len = Math.hypot(b.vx, b.vz) || 1
      this.hostBroadcast('hit', {
        bulletId: b.id,
        targetId: e.id,
        hp: out.hp,
        killerId: b.owner,
        dirX: b.vx / len,
        dirZ: b.vz / len,
        shieldBroken: out.shieldBroken,
        invuln: out.invuln,
      })
      if (out.damaged && out.hp <= 0) {
        // 反彈打死自己：killerId 照舊為 null（不加分），另帶可選 self 讓擊殺通知不誤寫成落牆
        const self = b.owner === e.id
        this.hostBroadcast('destroyed', { targetId: e.id, killerId: self ? null : b.owner, ...(self ? { self: true } : {}) })
      }
      return
    }
  }

  private applyHit(h: NonNullable<ReturnType<typeof decodeHit>>): void {
    if (h.bulletId) this.removeBullet(h.bulletId)
    const now = performance.now()
    const s = this.statOf(h.targetId)
    s.hp = h.hp
    if (!h.invuln) s.invulnUntil = now + INVULN_MS
    if (h.shieldBroken) s.shieldUntil = 0
    // 擊退：真人由受擊者本機套用（再經 ownership 同步）、bot 由 host 套用（再經 botState 同步）；
    // 無敵期間被命中不擊退（避免連續命中把坦克一路推走）
    if (!h.invuln && (h.dirX !== 0 || h.dirZ !== 0)) {
      const target =
        h.targetId === this.ctx.selfId
          ? this.state
          : this.ctx.role === 'host' && this.isBot(h.targetId)
            ? this.botState.get(h.targetId)
            : undefined
      if (target) {
        const { x: fx, z: fz } = target
        const p = knockback(fx, fz, h.dirX, h.dirZ, KNOCKBACK, (x, z) => this.moveBlocked(fx, fz, x, z))
        target.x = p.x
        target.z = p.z
      }
    }
    if (h.invuln) return
    // 命中火花＋閃白＋擠壓彈跳（含護盾擋下）；護盾被打破另播碎裂；自己受擊鏡頭微震（spec §6、§8 #4–#8、#17）
    const v = this.visualOf(h.targetId)
    if (v) {
      v.rig.hitAt = now
      const p = v.root.position
      this.fx.hit(p.x, p.z, PLAYER_PALETTE[this.colorIndex(h.targetId)].light)
      if (h.shieldBroken) {
        v.shieldBrokeAt = now
        this.fx.shieldShatter(p.x, p.z)
        playSfx('tank_shield_break')
      }
    }
    if (h.targetId === this.ctx.selfId) this.shakeAt = now
    playSfx('tank_hit')
  }

  // ---- 道具 ----

  private spawnItem(cx: number, cy: number, kind: ItemKind): void {
    const ci = cellIdx(cx, cy)
    const now = performance.now()
    this.items.set(ci, { kind })
    this.board.addItem(ci, kind, cx, cy, now)
    this.fx.itemAppear(cellToWorld(cx, GRID_W), cellToWorld(cy, GRID_H), now)
  }

  private detectPickups(): void {
    if (this.items.size === 0) return
    for (const e of this.entities()) {
      if (!this.isAlive(e.id)) continue
      const pos = this.posOf(e.id)
      if (!pos) continue
      const ci = cellIdx(worldToCell(pos.x, GRID_W), worldToCell(pos.z, GRID_H))
      const it = this.items.get(ci)
      if (it) this.hostBroadcast('pickup', { ci, who: e.id, kind: it.kind })
    }
  }

  /** buff／護盾到期時刻由本端收到 pickup 的時刻自算 */
  private applyPickup(p: { ci: number; who: string; kind: ItemKind | null }): void {
    const it = this.items.get(p.ci)
    const kind = p.kind ?? it?.kind
    if (!kind) return
    if (it) {
      this.items.delete(p.ci)
      this.board.removeItem(p.ci)
    }
    playSfx('pickup')
    const s = this.statOf(p.who)
    const now = performance.now()
    // 拾取光柱＋星星（道具那格）、浮字（拾取者頭上）（spec §8 #14）
    const ix = cellToWorld(p.ci % GRID_W, GRID_W)
    const iz = cellToWorld(Math.floor(p.ci / GRID_W), GRID_H)
    const who = this.visualOf(p.who)?.root.position
    this.fx.pickup(kind, ix, iz, who?.x ?? ix, who?.z ?? iz, ITEM_COLORS[kind].shell, now)
    if (kind === 'hp') {
      s.hp = Math.min(s.maxHp + 1, s.hp + 1)
      s.maxHp = Math.max(s.maxHp, s.hp)
    } else if (kind === 'speed') {
      s.speedUntil = now + BUFF_MS
    } else if (kind === 'rapid') {
      s.rapidUntil = now + BUFF_MS
    } else if (kind === 'shield') {
      s.shieldUntil = now + SHIELD_MS
    } else {
      s.tripleUntil = now + TRIPLE_MS
    }
  }

  // ---- 縮圈突然死亡 ----

  /** host：時間到就沿螺旋落下一面牆；中心在該格的坦克壓毀 */
  private tickSuddenDeath(now: number): void {
    if (!closeDue({ now, playingSince: this.playingSince, lastClose: this.lastClose })) return
    const next = nextCloseCell(SPIRAL, this.isWall, this.closeIndex)
    if (!next) return
    const alive = this.entities()
      .filter((e) => this.isAlive(e.id))
      .map((e) => ({ id: e.id, pos: this.posOf(e.id) }))
      .filter((e): e is { id: string; pos: TankState } => e.pos !== null)
      .map((e) => ({ id: e.id, x: e.pos.x, z: e.pos.z }))
    const crushed = crushedIds(next.cx, next.cy, alive)
    this.hostBroadcast('close', { cx: next.cx, cy: next.cy })
    for (const id of crushed) this.hostBroadcast('destroyed', { targetId: id, killerId: null })
  }

  /** 套用落牆（host 本地 + guest）：該格成牆、清木箱／道具／子彈、建落牆 mesh */
  private applyClose(cx: number, cy: number): void {
    const ci = cellIdx(cx, cy)
    const now = performance.now()
    this.lastClose = now
    this.closeIndex = SPIRAL.findIndex(([x, y]) => x === cx && y === cy) + 1
    if (this.walls.has(ci)) return
    this.walls.add(ci)
    this.crates.delete(ci)
    this.board.setCrate(ci, false)
    this.items.delete(ci)
    this.board.removeItem(ci)
    for (const b of [...this.bullets.values()]) {
      if (worldToCell(b.x, GRID_W) === cx && worldToCell(b.z, GRID_H) === cy) this.removeBullet(b.id)
    }
    this.closedWalls.add(ci)
    this.board.addClosingWall(ci, now)
    this.fx.wallDrop(cellToWorld(cx, GRID_W), cellToWorld(cy, GRID_H), now, DROP_MS)
    playSfx('tank_wall_drop', DROP_MS / 1000)
  }

  /** 各端：落牆前 CLOSE_WARN_MS 算出下一面的預告格 */
  private updateWarnCell(now: number): void {
    const active =
      this.flow.state.phase === 'playing' &&
      closeWarningActive({
        now,
        playingSince: this.playingSince,
        lastClose: this.lastClose,
        suddenMs: SUDDEN_DEATH_MS,
        intervalMs: CLOSE_INTERVAL_MS,
        leadMs: CLOSE_WARN_MS,
      })
    const next = active ? nextCloseCell(SPIRAL, this.isWall, this.closeIndex) : null
    this.warnCell = next ? { cx: next.cx, cy: next.cy } : null
  }

  // ---- 電腦玩家（僅 host 模擬）----

  private simulateBots(dt: number, now: number): void {
    if (this.bots.length === 0) return
    const bullets = [...this.bullets.values()].map((b) => ({
      x: b.x,
      z: b.z,
      vx: b.vx,
      vz: b.vz,
      owner: b.owner,
      bounces: b.bounces,
    }))
    const items = [...this.items.keys()].map((ci) => ({ cx: ci % GRID_W, cy: Math.floor(ci / GRID_W) }))
    const warn = this.warnCell
    const isDanger = (cx: number, cy: number) => warn !== null && warn.cx === cx && warn.cy === cy

    for (const bot of this.bots) {
      if (!this.isAlive(bot.id)) continue
      const pos = this.botState.get(bot.id)
      if (!pos) continue
      const enemies = this.entities()
        .filter((e) => e.id !== bot.id && this.isAlive(e.id))
        .map((e) => ({ id: e.id, pos: this.posOf(e.id) }))
        .filter((e): e is { id: string; pos: TankState } => e.pos !== null)
        .map((e) => ({ id: e.id, x: e.pos.x, z: e.pos.z }))
      // 開火走 host 內部路徑：同受冷卻與 buff 規則
      const stat = this.statOf(bot.id)
      const last = this.lastShotAt.get(bot.id)
      const fireReady = last === undefined || now - last >= FIRE_COOLDOWN_MS * rapidMulOf(stat, now)
      const { action, memory } = decideTankBot(
        {
          self: { id: bot.id, x: pos.x, z: pos.z, turretAngle: pos.turretAngle },
          now,
          isWall: this.isWall,
          isCrate: this.isCrate,
          isDanger,
          enemies,
          bullets,
          items,
          rand: Math.random,
          fireReady,
        },
        this.botMem.get(bot.id) ?? createAIMemory()
      )
      this.botMem.set(bot.id, memory)

      if (action.moveX !== 0 || action.moveZ !== 0) {
        const len = Math.hypot(action.moveX, action.moveZ)
        const step = (MOVE_SPEED * speedMulOf(stat, now) * dt) / len
        const nx = pos.x + action.moveX * step
        if (!this.moveBlocked(pos.x, pos.z, nx, pos.z)) pos.x = nx
        const nz = pos.z + action.moveZ * step
        if (!this.moveBlocked(pos.x, pos.z, pos.x, nz)) pos.z = nz
        pos.ry = Math.atan2(action.moveX, action.moveZ)
      }
      if (action.aim !== null) pos.turretAngle = rotateToward(pos.turretAngle, action.aim, TURRET_SPEED * dt)

      if (action.fire && fireReady) {
        this.lastShotAt.set(bot.id, now)
        const a = pos.turretAngle
        this.hostFire(
          bot.id,
          pos.x + Math.sin(a) * 0.6,
          pos.z + Math.cos(a) * 0.6,
          Math.sin(a) * BULLET_SPEED,
          Math.cos(a) * BULLET_SPEED
        )
      }
    }

    // 30Hz tick 下以累加節拍維持平均 20Hz（直接設 last = now 只會每 2 tick 送一次 ≈ 15Hz）
    const pace = paceTick(now, this.lastBotBroadcast, BOT_BROADCAST_MS)
    this.lastBotBroadcast = pace.last
    if (pace.due) {
      const states: BotStateEntry[] = []
      for (const b of this.bots) {
        const s = this.botState.get(b.id)
        if (s) states.push({ id: b.id, x: s.x, z: s.z, ry: s.ry, ta: s.turretAngle })
      }
      this.ctx.net.broadcast({ game: this.gameId, type: 'botState', payload: { states } })
    }
  }

  /** guest 套用 host 廣播的 bot 位置（更新插值目標，update() 平滑追上） */
  private applyBotStates(states: BotStateEntry[]): void {
    for (const s of states) this.botState.set(s.id, { x: s.x, z: s.z, ry: s.ry, turretAngle: s.ta })
  }

  // ---- 重開 ----

  /** 可重開的時機：結算畫面，或自己已毀損且場上其他真人也全毀 */
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

  private requestRestart(): void {
    if (!this.canRestart()) return
    if (this.ctx.role === 'host') this.hostRestart()
    else this.ctx.net.broadcast({ game: this.gameId, type: 'restartReq', payload: {} })
  }

  private hostRestart(): void {
    if (this.ctx.role !== 'host') return
    this.resultElapsed = 0
    this.currentSeed = (Math.random() * 0x7fffffff) | 0
    this.bots = makeBots(this.ctx.players.length)
    this.hostBroadcast('seed', { seed: this.currentSeed, bots: this.bots })
    this.flow.startCountdown(3)
  }

  private syncOverlay(): void {
    const setOverlay = this.ctx.setOverlay
    if (!setOverlay) return

    const phase = this.flow.state.phase
    const dead = !this.isAlive(this.ctx.selfId)
    let overlay: GameOverlay | null = null

    if (phase === 'result') {
      const standings = (this.flow.state.result as Standing[] | undefined) ?? []
      const win = standings[0]?.id === this.ctx.selfId
      overlay = {
        title: win ? '🏆 你獲勝了！' : '💥 對局結束',
        subtitle: standings.map((s, i) => `${i + 1}. ${s.name}${s.alive ? '（生存）' : ''} 擊殺:${s.kills}`).join('\n'),
        actions: [{ label: '🔄 重新開始', onClick: () => this.requestRestart(), variant: 'primary' }],
      }
    } else if (phase === 'playing' && dead) {
      overlay = {
        title: '💥 坦克已毀損',
        subtitle: '觀戰中——可立即重開一局',
        actions: [{ label: '🔄 重新開始', onClick: () => this.requestRestart(), variant: 'primary' }],
      }
    }

    const key = overlay ? `${overlay.title}|${overlay.subtitle ?? ''}` : ''
    if (key === this.lastOverlayKey) return
    this.lastOverlayKey = key
    setOverlay(overlay)
  }

  // ---- 網路訊息 ----

  /** 訊息 payload 一律先驗型別與範圍（安全審查 C2）；驗不過即丟棄該則訊息 */
  private applyMessage(type: string, payload: unknown): void {
    const p = payload
    if (!isObj(p)) return
    if (type === 'seed') {
      const d = decodeSeed(p)
      if (!d) return
      this.bots = d.bots
      this.applySeed(d.seed)
    } else if (type === 'bullet') {
      if (!isStr(p.id) || !isStr(p.owner)) return
      if (!isNumIn(p.x, -WORLD_LIMIT, WORLD_LIMIT) || !isNumIn(p.z, -WORLD_LIMIT, WORLD_LIMIT)) return
      if (!isNumIn(p.vx, -VEL_LIMIT, VEL_LIMIT) || !isNumIn(p.vz, -VEL_LIMIT, VEL_LIMIT)) return
      if (!this.bullets.has(p.id)) this.spawnBullet(p.id, p.owner, p.x, p.z, p.vx, p.vz)
    } else if (type === 'bounce') {
      const d = decodeBounce(p, LIMITS)
      const b = d && this.bullets.get(d.bulletId)
      if (!d || !b) return
      // guest 已用同一函式預測過反彈就只對齊速度；還沒反彈（預測落後）就直接校正到 host 狀態，並補播反彈火花
      if (b.bounces === 0) {
        this.bounceFx(d.x, d.z, b.vx, b.vz, d.vx, d.vz)
        b.x = d.x
        b.z = d.z
        b.bounces = 1
      }
      b.vx = d.vx
      b.vz = d.vz
    } else if (type === 'hit') {
      const d = decodeHit(p)
      if (d) this.applyHit(d)
    } else if (type === 'destroyed') {
      if (!isStr(p.targetId)) return
      const victim = p.targetId
      const s = this.statOf(victim)
      if (!s.alive) return
      s.alive = false
      playSfx(victim === this.ctx.selfId ? 'death' : 'kill')
      const killer = isStr(p.killerId) && p.killerId !== victim ? p.killerId : null
      this.onDestroyed(victim, killer, p.self === true)
    } else if (type === 'crate') {
      const d = decodeCrate(p)
      if (!d) return
      if (this.crates.has(d.ci)) {
        this.fx.crateBurst(cellToWorld(d.ci % GRID_W, GRID_W), cellToWorld(Math.floor(d.ci / GRID_W), GRID_H), performance.now())
      }
      this.crates.delete(d.ci)
      this.board.setCrate(d.ci, false)
      // 打掉木箱的那發：guest 端的副本還在半路，木箱先刪會讓它穿過去（幽靈子彈）
      if (d.bulletId) this.removeBullet(d.bulletId)
    } else if (type === 'item') {
      if (!isIntIn(p.cx, 0, GRID_W - 1) || !isIntIn(p.cy, 0, GRID_H - 1)) return
      if (!isOneOf<ItemKind>(p.kind, ITEM_KINDS)) return
      this.spawnItem(p.cx, p.cy, p.kind)
    } else if (type === 'pickup') {
      const d = decodePickup(p)
      if (d) this.applyPickup(d)
    } else if (type === 'close') {
      const d = decodeClose(p)
      if (d) this.applyClose(d.cx, d.cy)
    } else if (type === 'botState') {
      if (this.ctx.role === 'host') return
      const d = decodeBotState(
        p,
        this.bots.map((b) => b.id),
        LIMITS
      )
      if (d) this.applyBotStates(d.states)
    }
  }

  /** 是否為本局玩家（host 只受理已知玩家的上行請求） */
  private isPlayer(id: string): boolean {
    return this.ctx.players.some((pl) => pl.id === id)
  }

  onNetworkMessage(from: string, msg: GameNetMessage): void {
    if (msg.game !== this.gameId) return
    if (msg.type === 'shootReq') {
      // host 不只驗座標：存活、冷卻、起點與已知位置的距離、速度大小都要重新裁決
      if (this.ctx.role !== 'host' || !this.isPlayer(from)) return
      const now = performance.now()
      const req = validateShootReq(msg.payload, {
        alive: this.isAlive(from),
        lastShotAt: this.lastShotAt.get(from),
        cooldownMs: FIRE_COOLDOWN_MS * rapidMulOf(this.statOf(from), now),
        knownPos: this.own.latestRemote(from),
        now,
        worldLimit: WORLD_LIMIT,
        bulletSpeed: BULLET_SPEED,
      })
      if (!req) return
      this.lastShotAt.set(from, now)
      this.hostFire(from, req.x, req.z, req.vx, req.vz)
      return
    }
    if (msg.type === 'restartReq') {
      // 僅在結算中，或請求者已毀損且其他真人也全毀時受理
      if (this.ctx.role !== 'host' || !this.isPlayer(from)) return
      if (this.canAdvance(from)) this.hostRestart()
      return
    }
    if (this.ctx.role === 'host') return
    // seed/bullet/bounce/hit/destroyed/crate/item/pickup/close/botState 僅信任房主廣播
    if (from !== this.ctx.hostId) return
    this.applyMessage(msg.type, msg.payload)
  }

  // ---- 陣亡：爆炸、殘骸、擊殺通知、連殺 ----

  /**
   * 擊殺者加分、擊殺通知（killer 為 null＝落牆；反彈打死自己記成自己）、連殺字卡（同一條命 4 秒內再殺），
   * 爆炸與殘骸（spec §8 #10、#16）；自己陣亡鏡頭微震。
   */
  private onDestroyed(victim: string, killer: string | null, selfKill: boolean): void {
    const now = performance.now()
    this.streaks.delete(victim)
    if (killer) this.statOf(killer).kills++
    this.feed.push(killer ? this.nameFor(killer) : selfKill ? this.nameFor(victim) : null, this.nameFor(victim))
    const v = this.visualOf(victim)
    if (v) {
      const p = v.root.position
      this.fx.explode(p.x, p.z, PLAYER_PALETTE[this.colorIndex(victim)].base, now)
    }
    if (victim === this.ctx.selfId) this.shakeAt = now
    if (!killer || !this.isAlive(killer)) return
    const st = streakAfterKill(this.streaks.get(killer), now)
    this.streaks.set(killer, st)
    const label = streakLabel(st.count)
    if (!label) return
    const follow = () => {
      const kv = this.visualOf(killer)
      return kv ? { x: kv.root.position.x, z: kv.root.position.z } : null
    }
    this.fx.streakCard(label, PLAYER_PALETTE[this.colorIndex(killer)].base, follow, now)
  }

  // ---- 生命週期 ----

  init(ctx: GameContext): void {
    this.ctx = ctx
    const { scene } = ctx

    this.camera = new ArcRotateCamera('cam', -Math.PI / 2, 0.55, 38, CAM_TARGET.clone(), scene)
    // 光影與後製（AC6／AC9）：雙光、陰影、Glow 白名單、描邊、後製、解析度與檔位；陰影被降級關掉時改墊 blob 影
    this.look = new ToyLook(scene, this.camera, {
      shadowRadius: SHADOW_RADIUS,
      tag: 'tank',
      outline: OUTLINE,
      onDegrade: (step) => {
        if (step === 'shadow') this.blobShadows = true
      },
    })
    scene.clearColor = Color4.FromHexString(`${TANK.void}FF`)

    // 場景物件（AC5，A「Toy Army」）：地面單 mesh＋程式貼圖，積木牆／外框／落牆／木箱／子彈／道具走 thin instance
    this.board = new TankBoard(scene, {
      gridW: GRID_W,
      gridH: GRID_H,
      cell: CELL,
      toWorld: (cx, cy) => ({ x: cellToWorld(cx, GRID_W), z: cellToWorld(cy, GRID_H) }),
    })
    const fx = this.board.fxTargets()
    this.look.toon(...fx.toon)
    this.look.receiver(...fx.receivers)
    this.look.caster(...fx.casters)
    this.look.outline(...fx.outlined)
    for (const g of fx.glow) this.look.glowMesh(g.mesh, g.color, g.strength)
    for (const g of fx.glowOwn) this.look.glowOwnMaterial(g.mesh, g.strength)
    this.kit = new TankKit(scene)
    this.kit.onMaterial = (m) => this.look.toon(m)
    this.look.toon(this.kit.turretMat)
    // AC7 特效（粒子上限、履帶痕池依檔位）；鏡頭微震在 prefers-reduced-motion 或手機檔關閉
    this.fx = new TankFx(scene, this.look, { cap: this.look.settings.particleCap, treadCap: TREAD_CAP[this.look.tier] })
    const reducedMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    this.shakeOk = shakeAllowed({ reducedMotion, tier: this.look.tier })

    // 柱牆（固定）：地面貼圖同時烘牆根陰影
    this.generateWalls()
    this.walls = new Set(this.baseWalls)
    this.board.setWalls(this.baseWalls, this.isWall)

    // AC10：draw calls 量測；偵錯量測場景只在 tankNoDegrade=1 下生效
    this.instr = new SceneInstrumentation(scene)
    this.bench = typeof window !== 'undefined' && benchEnabled(tierQuery(window.location.search, window.location.hash))

    this.selfVisual = this.makeTank(ctx.selfId, 0, 0)
    // 狀態列改由 React HUD（ctx.setHud）顯示；開局倒數用玩具系列配色，掛在不經後製的 UI 相機
    if (typeof document !== 'undefined') void document.fonts?.load('bold 64px Fredoka').catch(() => undefined)
    this.banner = createCountdownPanel(scene, this.look.uiCamera, 'banner', 7, 4, new Vector3(0, 0.3, 8), {
      theme: COUNTDOWN_THEME,
      layerMask: UI_LAYER,
    })

    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)

    this.flow = createGameFlow({ net: ctx.net, game: this.gameId, role: ctx.role, hostId: ctx.hostId })
    attachFlowAudio(this.flow, 'tank', {
      resultSfx: (r) => ((r as Standing[] | undefined)?.[0]?.id === ctx.selfId ? 'win' : 'lose'),
    })
    this.flow.onChange((s) => {
      ;(window as unknown as Record<string, unknown>).__BATTLE_PHASE = s.phase
      // 縮圈計時以本端進 playing 的時刻起算
      if (s.phase === 'playing') {
        if (this.playingSince === 0) this.playingSince = performance.now()
      } else {
        this.playingSince = 0
      }
    })
    ;(window as unknown as Record<string, unknown>).__BATTLE_PHASE = this.flow.state.phase

    this.own = createOwnershipSync<TankState>({ net: ctx.net, game: this.gameId })
    this.own.start(() => ({ ...this.state }))

    this.ticker = createFixedTicker(SIM_HZ, (_t, stepMs) => this.simulate(stepMs / 1000))
    this.ticker.start()

    if (ctx.role === 'host') {
      this.currentSeed = (Math.random() * 0x7fffffff) | 0
      this.bots = makeBots(ctx.players.length)
      this.hostBroadcast('seed', { seed: this.currentSeed, bots: this.bots })
      this.offOpen = ctx.net.on('open', (peerId) => {
        ctx.net.send(peerId, { game: this.gameId, type: 'seed', payload: { seed: this.currentSeed, bots: this.bots } })
      })
      this.flow.startCountdown(3)
    } else {
      this.applySeed(1)
    }
  }

  private simulate(dt: number): void {
    const playing = this.flow.state.phase === 'playing'
    const now = performance.now()

    // 移動
    if (playing && this.isAlive(this.ctx.selfId)) {
      const k = this.keys
      const dx = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0)
      const dz = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0)
      const speed = MOVE_SPEED * speedMulOf(this.statOf(this.ctx.selfId), now)

      if (dx !== 0 || dz !== 0) {
        const len = Math.hypot(dx, dz)
        const step = (speed * dt) / len
        const nx = this.state.x + dx * step
        if (!this.moveBlocked(this.state.x, this.state.z, nx, this.state.z)) this.state.x = nx
        const nz = this.state.z + dz * step
        if (!this.moveBlocked(this.state.x, this.state.z, this.state.x, nz)) this.state.z = nz
        this.state.ry = Math.atan2(dx, dz)
      }

      // 砲塔旋轉 Q/E
      if (k.has('q')) this.state.turretAngle -= TURRET_SPEED * dt
      if (k.has('e')) this.state.turretAngle += TURRET_SPEED * dt
    }

    if (!playing) return

    // 子彈：各端同一支純函式推進（guest 為預測，host 為裁決）
    this.stepBullets(dt, now)
    this.updateWarnCell(now)

    if (this.ctx.role !== 'host') return

    this.detectPickups()
    this.tickSuddenDeath(now)
    this.simulateBots(dt, now)

    // 勝負：2 實體以上（含 bot）、存活 ≤ 1 → 結算
    const ents = this.entities()
    if (ents.length >= 2 && ents.filter((e) => this.isAlive(e.id)).length <= 1) {
      const standings = rankStandings(
        ents.map((e) => ({
          id: e.id,
          name: this.nameFor(e.id),
          alive: this.isAlive(e.id),
          kills: this.statOf(e.id).kills,
        }))
      )
      this.flow.endGame(standings)
    }
  }

  update(deltaMs: number): void {
    const phase = this.flow.state.phase
    const now = performance.now()

    // 自己
    if (this.selfVisual) {
      this.selfVisual.root.position.x = this.state.x
      this.selfVisual.root.position.z = this.state.z
      this.selfVisual.root.rotation.y = this.state.ry
      this.selfVisual.turret.rotation.y = this.state.turretAngle - this.state.ry
      this.trackFx(this.selfVisual, this.ctx.selfId, this.syncTankVisual(this.selfVisual, this.ctx.selfId, now), now)
    }

    // 遠端
    const ids = new Set(this.own.remoteIds())
    for (const [id, v] of this.peerVisuals) {
      if (ids.has(id)) continue
      this.disposeVisual(id, v)
      this.peerVisuals.delete(id)
    }
    for (const id of ids) {
      let v = this.peerVisuals.get(id)
      if (!v) {
        const init = this.own.latestRemote(id)
        v = this.makeTank(id, init?.x ?? 0, init?.z ?? 0)
        this.peerVisuals.set(id, v)
      }
      const s = this.own.sampleRemote(id)
      if (s) {
        v.root.position.x = s.a.x + (s.b.x - s.a.x) * s.alpha
        v.root.position.z = s.a.z + (s.b.z - s.a.z) * s.alpha
        v.root.rotation.y = s.a.ry + (s.b.ry - s.a.ry) * s.alpha
        v.turret.rotation.y = s.a.turretAngle + (s.b.turretAngle - s.a.turretAngle) * s.alpha - v.root.rotation.y
      }
      this.trackFx(v, id, this.syncTankVisual(v, id, now), now)
    }

    // bot：host 直接用模擬位置；guest 平滑追 host 廣播的目標
    const k = Math.min(1, deltaMs / 60)
    for (const [id, v] of this.botVisuals) {
      const target = this.botState.get(id)
      if (!target) continue
      let draw = target
      if (this.ctx.role !== 'host') {
        draw = this.botDraw.get(id) ?? { ...target }
        draw.x += (target.x - draw.x) * k
        draw.z += (target.z - draw.z) * k
        draw.ry = rotateToward(draw.ry, target.ry, Math.PI * k)
        draw.turretAngle = rotateToward(draw.turretAngle, target.turretAngle, Math.PI * k)
        this.botDraw.set(id, draw)
      }
      v.root.position.x = draw.x
      v.root.position.z = draw.z
      v.root.rotation.y = draw.ry
      v.turret.rotation.y = draw.turretAngle - draw.ry
      this.trackFx(v, id, this.syncTankVisual(v, id, now), now)
    }

    // 子彈拖尾（發射者 light→base，反彈後白→紅）；結算時場上子彈清掉，不停在原地到下一局
    if (phase === 'result' && this.bullets.size > 0) {
      this.bullets.clear()
      this.board.clearBullets()
    }
    for (const b of this.bullets.values()) {
      const pal = PLAYER_PALETTE[this.colorIndex(b.owner)]
      this.fx.trail(b.id, b.x, BULLET_Y, b.z, pal.light, pal.base, b.bounces > 0, deltaMs)
    }
    this.fx.endTrailFrame()

    // 預告格脈動、blob 影、道具浮動、落牆落下回彈、所有 thin instance 上傳（每幀一次）
    this.board.setWarning(this.warnCell, 0.5 + 0.5 * Math.sin((now / 1000) * WARN_PULSE_HZ * Math.PI * 2))
    if (this.blobShadows) this.syncBlobs()
    this.board.update(now)
    this.fx.update(now, deltaMs)
    this.look.update(deltaMs)
    this.updateShake(now)
    this.syncHud(phase, now)

    // AC10：每 2 秒印 draw calls 與 fps（讀上一幀的完整計數；還沒渲染過的首次取樣不印）
    if (this.instr && now - this.lastPerfLog >= PERF_LOG_MS) {
      this.lastPerfLog = now
      const line = perfLogLine(this.instr.drawCallsCounter.current, this.ctx.scene.getEngine().getFps(), 'tank')
      if (line) console.info(line)
    }

    this.syncOverlay()

    if (phase === 'countdown') {
      const n = Math.ceil(this.flow.countdownRemaining() / 1000)
      this.banner.draw(n > 0 ? String(n) : 'GO!', 200)
    } else if (phase === 'result') {
      this.banner.draw('')
      if (this.ctx.role === 'host') {
        this.resultElapsed += deltaMs
        if (this.resultElapsed > 10000) this.hostRestart()
      }
    } else {
      this.resultElapsed = 0
      this.banner.draw('')
    }

    // 驗證用
    ;(window as unknown as Record<string, unknown>).__BATTLE_POS = {
      x: this.state.x,
      z: this.state.z,
      alive: this.isAlive(this.ctx.selfId),
    }
    if (now - this.lastDebugAt > 250) {
      this.lastDebugAt = now
      ;(window as unknown as Record<string, unknown>).__TANK_STATE = this.debugState(now)
    }
  }

  private lastDebugAt = 0

  /** 鏡頭微震（spec §8 #17）：注視點在 (0, 0, −2) 附近抖，振幅線性衰減，結束歸位 */
  private updateShake(now: number): void {
    const amp = this.shakeOk ? shakeAmp(now - this.shakeAt) : 0
    if (amp <= 0 && !this.shaking) return
    this.shaking = amp > 0
    const j = () => (fxRandom() * 2 - 1) * amp
    this.camera.target.set(CAM_TARGET.x + j(), CAM_TARGET.y, CAM_TARGET.z + j())
  }

  /** 組 HUD 資料交給 React（AC8）：每次傳新物件；計時在結算凍結在最後一次 playing 的值 */
  private syncHud(phase: string, now: number): void {
    const setHud = this.ctx.setHud
    if (!setHud) return
    const timer = tankTimer({ phase, now, playingSince: this.playingSince, suddenMs: SUDDEN_DEATH_MS, last: this.lastTimer })
    if (phase === 'playing') this.lastTimer = timer
    setHud(
      buildTankHud({
        entities: this.entities().map((e) => ({
          id: e.id,
          name: this.nameFor(e.id),
          colorIndex: this.colorIndex(e.id),
          isBot: this.isBot(e.id),
        })),
        selfId: this.ctx.selfId,
        now,
        timer,
        stat: (id) => this.statOf(id),
        feed: this.feed.items(),
      })
    )
  }

  /** 陰影被降級關掉後：存活坦克與場上道具底下墊 blob 影 */
  private syncBlobs(): void {
    this.board.clearBlobs()
    const all: [string, TankVisual | undefined][] = [
      [this.ctx.selfId, this.selfVisual],
      ...[...this.peerVisuals].map(([id, v]): [string, TankVisual] => [id, v]),
      ...[...this.botVisuals].map(([id, v]): [string, TankVisual] => [id, v]),
    ]
    for (const [id, v] of all) {
      if (!v || !this.isAlive(id)) continue
      this.board.putBlob(`t-${id}`, v.root.position.x, v.root.position.z, BLOB_TANK)
    }
    for (const it of this.board.itemSpots()) this.board.putBlob(it.key, it.x, it.z, BLOB_ITEM)
  }

  /** 驗證用快照（qa 腳本取樣 window.__TANK_*）：名冊、配色、存活、buff、子彈、縮圈 */
  private debugState(now: number) {
    return {
      entities: this.entities().map((e) => {
        const s = this.statOf(e.id)
        const p = this.posOf(e.id)
        return {
          id: e.id,
          name: this.nameFor(e.id),
          colorIndex: this.colorIndex(e.id),
          alive: s.alive,
          hp: s.hp,
          kills: s.kills,
          shield: s.shieldUntil > now,
          triple: buffRemainSec(s.tripleUntil, now),
          invuln: s.invulnUntil > now,
          x: p ? Math.round(p.x * 100) / 100 : null,
          z: p ? Math.round(p.z * 100) / 100 : null,
        }
      }),
      bullets: [...this.bullets.values()].map((b) => ({ id: b.id, owner: b.owner, bounces: b.bounces })),
      items: [...this.items.values()].map((i) => i.kind),
      crates: this.crates.size,
      closed: this.closedWalls.size,
      warn: this.warnCell,
      suddenDeath: this.playingSince !== 0 && now - this.playingSince >= SUDDEN_DEATH_MS,
    }
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
    if (this.selfVisual) this.disposeVisual(this.ctx.selfId, this.selfVisual)
    for (const [id, v] of this.peerVisuals) this.disposeVisual(id, v)
    this.peerVisuals.clear()
    for (const [id, v] of this.botVisuals) this.disposeVisual(id, v)
    this.botVisuals.clear()
    this.botState.clear()
    this.botDraw.clear()
    this.bots = []
    this.bullets.clear()
    this.crates.clear()
    this.items.clear()
    this.closedWalls.clear()
    this.banner.dispose()
    this.fx.dispose()
    this.board.dispose()
    this.kit.dispose()
    this.instr?.dispose()
    this.instr = null
    this.look.dispose()
  }
}

export const createTankScene = (): GameModule => new TankScene()
