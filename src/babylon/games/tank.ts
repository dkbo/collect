import {
  ArcRotateCamera,
  Color3,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Vector3,
} from '@/babylon/babylonCore'
import type { GameContext, GameModule, GameOverlay } from '@/babylon/types'
import type { GameNetMessage } from '@/core/webrtc'
import { attachFlowAudio, playSfx, stopAllAudio } from '@/babylon/audio'
import { createCountdownPanel, createTextPanel, type TextPanel } from '@/babylon/hud'
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
import { PLAYER_PALETTE } from '@/babylon/fx/palette'
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
  invulnBlinkOn,
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
  mesh: Mesh
  createdAt: number
}

interface TankVisual {
  root: Mesh
  turret: Mesh
  barrel: Mesh
  hpBars: Mesh[]
  /** 無敵閃爍時要一起隱藏的部件 */
  parts: Mesh[]
  shield: Mesh
  bodyMat: StandardMaterial
  darkMat: StandardMaterial
  colorIndex: number
  alive: boolean
}

interface ItemInfo {
  kind: ItemKind
  mesh: Mesh
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
/** 落牆由高處落下的動畫時間 */
const CLOSE_DROP_MS = 250

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
  private closedWalls = new Map<number, { mesh: Mesh; born: number }>()
  private crates = new Map<number, Mesh>()
  private flames: { mesh: Mesh; until: number }[] = []
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
  private hud!: TextPanel
  private banner!: TextPanel

  private crateMat!: StandardMaterial
  private wallMat!: StandardMaterial
  private closeWallMat!: StandardMaterial
  private flameMat!: StandardMaterial
  private itemMats!: Record<ItemKind, StandardMaterial>
  private bulletMat!: StandardMaterial
  private shieldMat!: StandardMaterial
  private warnMesh!: Mesh

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
    const scene = this.ctx.scene

    const bodyMat = new StandardMaterial(`tank-body-${id}`, scene)
    const darkMat = new StandardMaterial(`tank-dark-${id}`, scene)
    const barrelMat = new StandardMaterial(`tank-barrel-${id}`, scene)
    barrelMat.diffuseColor = new Color3(0.25, 0.25, 0.28)

    const root = new Mesh(`tank-${id}`, scene)
    root.position = new Vector3(x, 0, z)
    const parts: Mesh[] = []

    // 車體
    const body = MeshBuilder.CreateBox(`tank-body-${id}`, { width: 1.2, height: 0.35, depth: 0.8 }, scene)
    body.material = bodyMat
    body.parent = root
    body.position.y = 0.25
    parts.push(body)

    // 履帶（兩側深色薄片）
    for (const side of [-1, 1]) {
      const track = MeshBuilder.CreateBox(`tank-track-${side}-${id}`, { width: 0.22, height: 0.2, depth: 0.9 }, scene)
      track.material = darkMat
      track.parent = root
      track.position.set(side * 0.58, 0.12, 0)
      parts.push(track)
    }

    // 砲塔
    const turret = MeshBuilder.CreateCylinder(`tank-turret-${id}`, { diameter: 0.7, height: 0.25 }, scene)
    turret.material = bodyMat
    turret.parent = root
    turret.position.y = 0.5
    parts.push(turret)

    // 砲管
    const barrel = MeshBuilder.CreateCylinder(`tank-barrel-${id}`, { diameter: 0.12, height: 0.65 }, scene)
    barrel.material = barrelMat
    barrel.parent = turret
    barrel.position.set(0, 0, 0.4)
    barrel.rotation.x = Math.PI / 2
    parts.push(barrel)

    // HP 條（3 個小方塊在頭頂）
    const hpBars: Mesh[] = []
    const hpMat = new StandardMaterial(`hp-${id}`, scene)
    hpMat.diffuseColor = new Color3(0.2, 0.85, 0.3)
    hpMat.emissiveColor = new Color3(0.1, 0.4, 0.15)
    for (let i = 0; i < 3; i++) {
      const bar = MeshBuilder.CreateBox(`hp-bar-${i}-${id}`, { width: 0.22, height: 0.08, depth: 0.08 }, scene)
      bar.material = hpMat
      bar.parent = root
      bar.position.set((i - 1) * 0.26, 0.78, 0)
      hpBars.push(bar)
    }

    // 護盾泡泡（暫用半透明球，波 3 換美術）
    const shield = MeshBuilder.CreateSphere(`tank-shield-${id}`, { diameter: 1.7, segments: 12 }, scene)
    shield.material = this.shieldMat
    shield.parent = root
    shield.position.y = 0.35
    shield.isPickable = false
    shield.setEnabled(false)

    const v: TankVisual = { root, turret, barrel, hpBars, parts, shield, bodyMat, darkMat, colorIndex: -1, alive: true }
    this.paintTank(v, this.colorIndex(id))
    return v
  }

  /** 固定 4 色：名冊變動（bot 補位、有人離房）時顏色跟著改 */
  private paintTank(v: TankVisual, ci: number): void {
    if (v.colorIndex === ci) return
    v.colorIndex = ci
    const pal = PLAYER_PALETTE[ci]
    v.bodyMat.diffuseColor = Color3.FromHexString(pal.base)
    v.darkMat.diffuseColor = Color3.FromHexString(pal.dark)
  }

  private updateHpBars(visual: TankVisual, hp: number): void {
    for (let i = 0; i < visual.hpBars.length; i++) {
      const bar = visual.hpBars[i]
      if (i < hp) {
        bar.setEnabled(true)
        const mat = bar.material as StandardMaterial
        if (hp <= 1) {
          mat.diffuseColor = new Color3(0.9, 0.2, 0.15)
          mat.emissiveColor = new Color3(0.5, 0.1, 0.05)
        } else if (hp <= 2) {
          mat.diffuseColor = new Color3(0.9, 0.75, 0.1)
          mat.emissiveColor = new Color3(0.45, 0.35, 0.05)
        } else {
          mat.diffuseColor = new Color3(0.2, 0.85, 0.3)
          mat.emissiveColor = new Color3(0.1, 0.4, 0.15)
        }
      } else {
        bar.setEnabled(false)
      }
    }
  }

  /** 每幀同步一台坦克的顏色、HP、護盾、無敵閃爍與存活 */
  private syncTankVisual(v: TankVisual, id: string, now: number): void {
    const s = this.statOf(id)
    this.paintTank(v, this.colorIndex(id))
    this.updateHpBars(v, s.hp)
    v.shield.setEnabled(s.shieldUntil > now)
    const on = invulnBlinkOn(now, s.invulnUntil)
    for (const m of v.parts) m.isVisible = on
    v.root.setEnabled(this.isAlive(id))
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
    const scene = this.ctx.scene
    // 清理舊箱子、道具、子彈、碎片與落牆
    for (const m of this.crates.values()) m.dispose()
    this.crates.clear()
    for (const it of this.items.values()) it.mesh.dispose()
    this.items.clear()
    for (const b of this.bullets.values()) b.mesh.dispose()
    this.bullets.clear()
    for (const f of this.flames) f.mesh.dispose()
    this.flames = []
    for (const w of this.closedWalls.values()) w.mesh.dispose()
    this.closedWalls.clear()
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
          const crate = MeshBuilder.CreateBox(`crate-${cx}-${cy}`, { size: CELL * 0.85 }, scene)
          crate.position = new Vector3(cellToWorld(cx, GRID_W), CELL * 0.42, cellToWorld(cy, GRID_H))
          crate.material = this.crateMat
          this.crates.set(idx, crate)
        }
      }
    }

    // 自己回出生角（依「真人＋bot」合併名冊的序）
    this.state = this.spawnOf(this.ctx.selfId)

    // bot 位置與化身：依名冊重建
    for (const [id, v] of this.botVisuals) {
      if (this.bots.some((b) => b.id === id)) continue
      v.root.dispose(false, true)
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
    const mesh = MeshBuilder.CreateSphere(`bullet-${id}`, { diameter: 0.2 }, this.ctx.scene)
    mesh.position = new Vector3(x, 0.35, z)
    mesh.material = this.bulletMat
    this.bullets.set(id, { id, owner, x, z, vx, vz, bounces: 0, mesh, createdAt: performance.now() })
    playSfx('tank_fire')
  }

  private removeBullet(id: string): void {
    const b = this.bullets.get(id)
    if (!b) return
    b.mesh.dispose()
    this.bullets.delete(id)
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
      b.x = r.x
      b.z = r.z
      b.vx = r.vx
      b.vz = r.vz
      b.bounces = r.bounces
      b.mesh.position.x = b.x
      b.mesh.position.z = b.z
      if (r.kind === 'bounce' && host) {
        this.ctx.net.broadcast({
          game: this.gameId,
          type: 'bounce',
          payload: { bulletId: id, x: b.x, z: b.z, vx: b.vx, vz: b.vz },
        })
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
        this.hostBroadcast('destroyed', { targetId: e.id, killerId: b.owner === e.id ? null : b.owner })
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
    playSfx('tank_hit')
    this.spawnExplosion(h.targetId)
  }

  // ---- 道具 ----

  private spawnItem(cx: number, cy: number, kind: ItemKind): void {
    const ci = cellIdx(cx, cy)
    this.items.get(ci)?.mesh.dispose()
    const mesh = MeshBuilder.CreateBox(`item-${ci}`, { size: 0.5 }, this.ctx.scene)
    mesh.position = new Vector3(cellToWorld(cx, GRID_W), 0.4, cellToWorld(cy, GRID_H))
    mesh.material = this.itemMats[kind]
    this.items.set(ci, { kind, mesh })
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
      it.mesh.dispose()
      this.items.delete(p.ci)
    }
    playSfx('pickup')
    const s = this.statOf(p.who)
    const now = performance.now()
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
    this.crates.get(ci)?.dispose()
    this.crates.delete(ci)
    this.items.get(ci)?.mesh.dispose()
    this.items.delete(ci)
    for (const b of [...this.bullets.values()]) {
      if (worldToCell(b.x, GRID_W) === cx && worldToCell(b.z, GRID_H) === cy) this.removeBullet(b.id)
    }
    const mesh = MeshBuilder.CreateBox(`close-${cx}-${cy}`, { size: CELL * 0.95 }, this.ctx.scene)
    mesh.position = new Vector3(cellToWorld(cx, GRID_W), CELL * 4, cellToWorld(cy, GRID_H))
    mesh.material = this.closeWallMat
    this.closedWalls.set(ci, { mesh, born: now })
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
      // guest 已用同一函式預測過反彈就只對齊速度；還沒反彈（預測落後）就直接校正到 host 狀態
      if (b.bounces === 0) {
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
      const s = this.statOf(p.targetId)
      s.alive = false
      playSfx(p.targetId === this.ctx.selfId ? 'death' : 'kill')
      if (p.targetId === this.ctx.selfId) this.selfVisual?.root.setEnabled(false)
      else (this.peerVisuals.get(p.targetId) ?? this.botVisuals.get(p.targetId))?.root.setEnabled(false)
      // 給擊殺者加分（killerId 為 null＝落牆或自己反彈打死自己）
      if (isStr(p.killerId)) {
        const ks = this.statOf(p.killerId)
        ks.kills++
      }
    } else if (type === 'crate') {
      const d = decodeCrate(p)
      if (!d) return
      this.crates.get(d.ci)?.dispose()
      this.crates.delete(d.ci)
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

  // ---- 爆炸特效 ----

  private spawnExplosion(targetId: string): void {
    const pos = this.posOf(targetId)
    if (!pos) return
    const now = performance.now()
    const until = now + 400
    for (let i = 0; i < 6; i++) {
      const frag = MeshBuilder.CreateBox(`exp-frag-${i}`, { size: 0.15 }, this.ctx.scene)
      frag.position = new Vector3(pos.x, 0.4, pos.z)
      const mat = new StandardMaterial(`exp-mat-${i}`, this.ctx.scene)
      mat.emissiveColor = new Color3(1, 0.5 + Math.random() * 0.3, 0.1)
      mat.disableLighting = true
      frag.material = mat
      // 隨機方向飛散
      const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.5
      const speed = 2 + Math.random() * 3
      frag.metadata = {
        vx: Math.cos(angle) * speed,
        vy: 3 + Math.random() * 2,
        vz: Math.sin(angle) * speed,
      }
      this.flames.push({ mesh: frag, until })
    }
  }

  // ---- 生命週期 ----

  init(ctx: GameContext): void {
    this.ctx = ctx
    const { scene } = ctx

    this.camera = new ArcRotateCamera('cam', -Math.PI / 2, 0.55, 38, new Vector3(0, 0, -2), scene)
    new HemisphericLight('light', new Vector3(0.2, 1, 0.1), scene)

    // 共用材質
    this.crateMat = new StandardMaterial('crate-mat', scene)
    this.crateMat.diffuseColor = new Color3(0.62, 0.45, 0.22)
    this.wallMat = new StandardMaterial('wall-mat', scene)
    this.wallMat.diffuseColor = new Color3(0.42, 0.45, 0.5)
    this.closeWallMat = new StandardMaterial('close-wall-mat', scene)
    this.closeWallMat.diffuseColor = new Color3(0.62, 0.3, 0.3)
    this.flameMat = new StandardMaterial('flame-mat', scene)
    this.flameMat.emissiveColor = new Color3(1, 0.45, 0.1)
    this.flameMat.disableLighting = true
    this.bulletMat = new StandardMaterial('bullet-mat', scene)
    this.bulletMat.emissiveColor = new Color3(1, 0.85, 0.2)
    this.bulletMat.disableLighting = true
    this.shieldMat = new StandardMaterial('shield-mat', scene)
    this.shieldMat.diffuseColor = new Color3(0.3, 0.8, 1)
    this.shieldMat.emissiveColor = new Color3(0.15, 0.45, 0.6)
    this.shieldMat.alpha = 0.3

    const itemMat = (name: string, diffuse: Color3, emissive: Color3) => {
      const m = new StandardMaterial(name, scene)
      m.diffuseColor = diffuse
      m.emissiveColor = emissive
      return m
    }
    this.itemMats = {
      hp: itemMat('item-hp', new Color3(0.2, 0.85, 0.3), new Color3(0.1, 0.4, 0.15)),
      speed: itemMat('item-speed', new Color3(0.2, 0.5, 0.95), new Color3(0.1, 0.3, 0.8)),
      rapid: itemMat('item-rapid', new Color3(0.95, 0.55, 0.1), new Color3(0.8, 0.4, 0.05)),
      shield: itemMat('item-shield', new Color3(0.3, 0.85, 1), new Color3(0.15, 0.55, 0.7)),
      triple: itemMat('item-triple', new Color3(0.75, 0.4, 1), new Color3(0.5, 0.2, 0.75)),
    }

    // 地板
    const ground = MeshBuilder.CreateGround('ground', { width: GRID_W * CELL + 2, height: GRID_H * CELL + 2 }, scene)
    const gmat = new StandardMaterial('gmat', scene)
    gmat.diffuseColor = new Color3(0.18, 0.28, 0.18)
    ground.material = gmat

    // 落牆預告格（地上紅色薄片，波 3 換美術）
    this.warnMesh = MeshBuilder.CreateGround('close-warn', { width: CELL * 0.95, height: CELL * 0.95 }, scene)
    const warnMat = new StandardMaterial('close-warn-mat', scene)
    warnMat.emissiveColor = new Color3(1, 0.2, 0.15)
    warnMat.disableLighting = true
    warnMat.alpha = 0.7
    this.warnMesh.material = warnMat
    this.warnMesh.position.y = 0.02
    this.warnMesh.setEnabled(false)

    // 水泥牆
    this.generateWalls()
    this.walls = new Set(this.baseWalls)
    for (const idx of this.baseWalls) {
      const cx = idx % GRID_W
      const cy = Math.floor(idx / GRID_W)
      const w = MeshBuilder.CreateBox(`wall-${cx}-${cy}`, { size: CELL * 0.95 }, scene)
      w.position = new Vector3(cellToWorld(cx, GRID_W), CELL * 0.47, cellToWorld(cy, GRID_H))
      w.material = this.wallMat
    }

    this.selfVisual = this.makeTank(ctx.selfId, 0, 0)
    this.hud = createTextPanel(scene, this.camera, 'hud', 4, 1.1, new Vector3(0, 2.45, 8))
    this.banner = createCountdownPanel(scene, this.camera, 'banner', 7, 4, new Vector3(0, 0.3, 8))

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

  /** 除錯文字行（波 3 換 React HUD 時整段刪除）：自己的護盾／buff 與縮圈倒數，供 qa 判讀 */
  private debugLine(now: number): string {
    const s = this.statOf(this.ctx.selfId)
    const parts: string[] = []
    const add = (label: string, until: number) => {
      const sec = buffRemainSec(until, now)
      if (sec > 0) parts.push(`${label} ${sec}s`)
    }
    add('護盾', s.shieldUntil)
    add('加速', s.speedUntil)
    add('連射', s.rapidUntil)
    add('三連', s.tripleUntil)
    if (this.playingSince !== 0) {
      const left = SUDDEN_DEATH_MS - (now - this.playingSince)
      parts.push(left > 0 ? `縮圈 ${Math.ceil(left / 1000)}s` : '縮圈中')
    }
    return parts.join('・')
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
      this.syncTankVisual(this.selfVisual, this.ctx.selfId, now)
    }

    // 遠端
    const ids = new Set(this.own.remoteIds())
    for (const [id, v] of this.peerVisuals) {
      if (ids.has(id)) continue
      v.root.dispose(false, true)
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
      this.syncTankVisual(v, id, now)
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
      this.syncTankVisual(v, id, now)
    }

    // 道具浮動旋轉
    for (const it of this.items.values()) {
      it.mesh.rotation.y += deltaMs * 0.003
      it.mesh.position.y = 0.4 + Math.sin(now * 0.004 + it.mesh.position.x) * 0.1
    }

    // 落牆落下 + 預告格
    for (const w of this.closedWalls.values()) {
      const t = Math.min(1, (now - w.born) / CLOSE_DROP_MS)
      w.mesh.position.y = CELL * 0.47 + (CELL * 4 - CELL * 0.47) * (1 - t * t)
    }
    const warn = this.warnCell
    this.warnMesh.setEnabled(warn !== null)
    if (warn) {
      this.warnMesh.position.x = cellToWorld(warn.cx, GRID_W)
      this.warnMesh.position.z = cellToWorld(warn.cy, GRID_H)
    }

    // 爆炸碎片動畫
    this.flames = this.flames.filter((f) => {
      if (f.until > now) {
        const meta = f.mesh.metadata as { vx: number; vy: number; vz: number } | undefined
        if (meta) {
          f.mesh.position.x += meta.vx * deltaMs * 0.001
          f.mesh.position.y += meta.vy * deltaMs * 0.001
          f.mesh.position.z += meta.vz * deltaMs * 0.001
          meta.vy -= 9.8 * deltaMs * 0.001
        }
        f.mesh.scaling.scaleInPlace(0.97)
        return true
      }
      f.mesh.dispose()
      return false
    })

    // HUD
    const ents = this.entities()
    const aliveCount = ents.filter((e) => this.isAlive(e.id)).length
    const me = this.statOf(this.ctx.selfId)
    const hpNote = phase === 'playing' ? `・HP ${me.hp}/${me.maxHp} ・擊殺 ${me.kills}` : ''
    const deadNote = !this.isAlive(this.ctx.selfId) && phase === 'playing' ? '・已毀損（觀戰中）' : ''
    this.hud.draw(
      phase === 'playing' ? `存活 ${aliveCount} / ${ents.length}${hpNote}${deadNote}\n${this.debugLine(now)}` : '',
      44
    )

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
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    stopAllAudio()
    this.ticker.stop()
    this.own.stop()
    this.flow.dispose()
    this.offOpen?.()
    this.selfVisual?.root.dispose(false, true)
    for (const v of this.peerVisuals.values()) v.root.dispose(false, true)
    this.peerVisuals.clear()
    for (const v of this.botVisuals.values()) v.root.dispose(false, true)
    this.botVisuals.clear()
    this.botState.clear()
    this.botDraw.clear()
    this.bots = []
    for (const b of this.bullets.values()) b.mesh.dispose()
    this.bullets.clear()
    for (const m of this.crates.values()) m.dispose()
    this.crates.clear()
    for (const it of this.items.values()) it.mesh.dispose()
    this.items.clear()
    for (const w of this.closedWalls.values()) w.mesh.dispose()
    this.closedWalls.clear()
    for (const f of this.flames) f.mesh.dispose()
    this.flames = []
    this.hud.dispose()
    this.banner.dispose()
  }
}

export const createTankScene = (): GameModule => new TankScene()
