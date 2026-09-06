import {
  ArcRotateCamera,
  Color3,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core'
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
import { validateShootReq } from './tankNet'

/**
 * 坦克對戰（Host Authority 事件制）。
 *
 * - 位置/砲塔：ownership 20Hz 廣播，遠端插值
 * - 射擊：guest 廣播 shootReq → host 驗證 → 廣播 bullet
 * - 碰撞/HP/道具/勝負：host 裁決 → 廣播 hit/destroyed/item/pickup
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
  mesh: Mesh
  createdAt: number
}

interface TankVisual {
  root: Mesh
  turret: Mesh
  barrel: Mesh
  hpBars: Mesh[]
  alive: boolean
}

type ItemKind = 'hp' | 'speed' | 'rapid'

interface ItemInfo {
  kind: ItemKind
  mesh: Mesh
}

interface PlayerStat {
  alive: boolean
  hp: number
  maxHp: number
  kills: number
  speedMul: number
  rapidMul: number
  speedUntil: number
  rapidUntil: number
}

interface Standing {
  id: string
  name: string
  alive: boolean
  kills: number
}

const SIM_HZ = 30
const CELL = 2
const GRID_W = 16
const GRID_H = 16
const MOVE_SPEED = 4.5
const TURRET_SPEED = 3.5
const BULLET_SPEED = 12
const BULLET_LIFETIME_MS = 2000
const FIRE_COOLDOWN_MS = 500
const INIT_HP = 3
const CRATE_DROP_CHANCE = 0.5
/** 合法道具種類（網路封包驗證用） */
const ITEM_KINDS = ['hp', 'speed', 'rapid'] as const
/** 世界座標容許範圍（場地半徑再放寬一格，擋掉離譜座標） */
const WORLD_LIMIT = (GRID_W * CELL) / 2 + CELL
/** 子彈速度上限（擋掉超速外掛封包） */
const VEL_LIMIT = BULLET_SPEED * 2

const SPAWN_CORNERS: [number, number][] = [
  [1, 1],
  [GRID_W - 2, GRID_H - 2],
  [1, GRID_H - 2],
  [GRID_W - 2, 1],
]

const cellToWorld = (c: number, count: number): number => (c - (count - 1) / 2) * CELL
const worldToCell = (w: number, count: number): number => Math.round(w / CELL + (count - 1) / 2)

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
  /** host：各玩家上次開火時刻（shootReq 冷卻驗證用；每局重置） */
  private lastShotAt = new Map<string, number>()
  private bullets = new Map<string, BulletInfo>()
  private items = new Map<number, ItemInfo>()
  private walls = new Set<number>()
  private crates = new Map<number, Mesh>()
  private flames: { mesh: Mesh; until: number }[] = []
  private currentSeed = 1
  private lastFireInput = 0
  private bulletSeq = 0
  private resultElapsed = 0
  private lastOverlayKey = ''

  private selfVisual?: TankVisual
  private peerVisuals = new Map<string, TankVisual>()
  private camera!: ArcRotateCamera
  private hud!: TextPanel
  private banner!: TextPanel

  private crateMat!: StandardMaterial
  private wallMat!: StandardMaterial
  private flameMat!: StandardMaterial
  private itemHpMat!: StandardMaterial
  private itemSpeedMat!: StandardMaterial
  private itemRapidMat!: StandardMaterial
  private bulletMat!: StandardMaterial

  private onKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase()
    this.keys.add(key)
    if (key === ' ' || key === 'enter') this.requestFire()
    if (key === 'r') this.requestRestart()
  }
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase())

  private colorFor(id: string): Color3 {
    let h = 0
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
    return Color3.FromHSV(h % 360, 0.65, 0.85)
  }

  private nameFor(id: string): string {
    return this.ctx.players.find((p) => p.id === id)?.name ?? id.slice(0, 6)
  }

  private isAlive(id: string): boolean {
    return this.stats.get(id)?.alive ?? false
  }

  private statOf(id: string): PlayerStat {
    let s = this.stats.get(id)
    if (!s) {
      s = { alive: true, hp: INIT_HP, maxHp: INIT_HP, kills: 0, speedMul: 1, rapidMul: 1, speedUntil: 0, rapidUntil: 0 }
      this.stats.set(id, s)
    }
    return s
  }

  private posOf(pid: string): TankState | null {
    return pid === this.ctx.selfId ? this.state : this.own.latestRemote(pid)
  }

  private makeTank(id: string, x: number, z: number): TankVisual {
    const scene = this.ctx.scene
    const color = this.colorFor(id)

    const bodyMat = new StandardMaterial(`tank-body-${id}`, this.ctx.scene)
    bodyMat.diffuseColor = color
    const darkMat = new StandardMaterial(`tank-dark-${id}`, this.ctx.scene)
    darkMat.diffuseColor = color.scale(0.5)
    const barrelMat = new StandardMaterial(`tank-barrel-${id}`, scene)
    barrelMat.diffuseColor = new Color3(0.25, 0.25, 0.28)

    const root = new Mesh(`tank-${id}`, scene)
    root.position = new Vector3(x, 0, z)

    // 車體
    const body = MeshBuilder.CreateBox(`tank-body-${id}`, { width: 1.2, height: 0.35, depth: 0.8 }, scene)
    body.material = bodyMat
    body.parent = root
    body.position.y = 0.25

    // 履帶（兩側深色薄片）
    for (const side of [-1, 1]) {
      const track = MeshBuilder.CreateBox(`tank-track-${side}-${id}`, { width: 0.22, height: 0.2, depth: 0.9 }, scene)
      track.material = darkMat
      track.parent = root
      track.position.set(side * 0.58, 0.12, 0)
    }

    // 砂塔
    const turret = MeshBuilder.CreateCylinder(`tank-turret-${id}`, { diameter: 0.7, height: 0.25 }, scene)
    turret.material = bodyMat
    turret.parent = root
    turret.position.y = 0.5

    // 砲管
    const barrel = MeshBuilder.CreateCylinder(`tank-barrel-${id}`, { diameter: 0.12, height: 0.65 }, scene)
    barrel.material = barrelMat
    barrel.parent = turret
    barrel.position.set(0, 0, 0.4)
    barrel.rotation.x = Math.PI / 2

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

    return { root, turret, barrel, hpBars, alive: true }
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

  // ---- 地圖 ----

  private generateWalls(): void {
    this.walls.clear()
    for (let cy = 1; cy < GRID_H; cy += 2) {
      for (let cx = 1; cx < GRID_W; cx += 2) {
        // 出生角（如 [1,1]）不可放牆，否則該位玩家出生即卡死在牆內
        if (SPAWN_CORNERS.some(([sx, sy]) => sx === cx && sy === cy)) continue
        this.walls.add(cy * GRID_W + cx)
      }
    }
  }

  private applySeed(seed: number): void {
    const scene = this.ctx.scene
    // 清理舊箱子和道具
    for (const m of this.crates.values()) m.dispose()
    this.crates.clear()
    for (const it of this.items.values()) it.mesh.dispose()
    this.items.clear()
    for (const b of this.bullets.values()) b.mesh.dispose()
    this.bullets.clear()
    for (const f of this.flames) f.mesh.dispose()
    this.flames = []

    // 初始化所有玩家 stats
    this.lastShotAt.clear()
    for (const p of this.ctx.players) {
      this.stats.set(p.id, {
        hp: INIT_HP,
        maxHp: INIT_HP,
        kills: 0,
        speedMul: 1,
        rapidMul: 1,
        speedUntil: 0,
        rapidUntil: 0,
        alive: true,
      })
    }

    // 確定性隨機：seed 決定木箱位置
    let rng = seed
    const nextRng = () => {
      rng = (rng * 1103515245 + 12345) & 0x7fffffff
      return rng / 0x7fffffff
    }

    for (let cy = 0; cy < GRID_H; cy++) {
      for (let cx = 0; cx < GRID_W; cx++) {
        const idx = cy * GRID_W + cx
        if (this.walls.has(idx)) continue
        // 出生點附近不放箱子
        const nearSpawn = SPAWN_CORNERS.some(
          ([sx, sy]) => Math.abs(cx - sx) <= 1 && Math.abs(cy - sy) <= 1,
        )
        if (nearSpawn) continue
        if (nextRng() < 0.3) {
          const crate = MeshBuilder.CreateBox(`crate-${cx}-${cy}`, { size: CELL * 0.85 }, scene)
          crate.position = new Vector3(cellToWorld(cx, GRID_W), CELL * 0.42, cellToWorld(cy, GRID_H))
          crate.material = this.crateMat
          this.crates.set(idx, crate)
        }
      }
    }

    // 建水泥牆 mesh
    // ( walls 在 init 時已建，這裡不需要重建)

    // 自己回出生角
    const idx = Math.max(0, this.ctx.players.findIndex((p) => p.id === this.ctx.selfId))
    const [cx, cy] = SPAWN_CORNERS[idx % SPAWN_CORNERS.length]
    this.state = {
      x: cellToWorld(cx, GRID_W),
      z: cellToWorld(cy, GRID_H),
      ry: 0,
      turretAngle: 0,
    }

    this.selfVisual?.root.setEnabled(true)
    for (const v of this.peerVisuals.values()) v.root.setEnabled(true)
  }

  private hitBlocked(px: number, pz: number): boolean {
    const R = 0.5
    for (const ox of [-R, R]) {
      for (const oz of [-R, R]) {
        const cx = worldToCell(px + ox, GRID_W)
        const cy = worldToCell(pz + oz, GRID_H)
        if (cx < 0 || cx >= GRID_W || cy < 0 || cy >= GRID_H) return true
        if (this.walls.has(cy * GRID_W + cx)) return true
        if (this.crates.has(cy * GRID_W + cx)) return true
      }
    }
    return false
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
    const cd = FIRE_COOLDOWN_MS * stat.rapidMul
    if (now - this.lastFireInput < cd) return
    this.lastFireInput = now

    const vx = Math.sin(this.state.turretAngle) * BULLET_SPEED
    const vz = Math.cos(this.state.turretAngle) * BULLET_SPEED
    const sx = this.state.x + Math.sin(this.state.turretAngle) * 0.6
    const sz = this.state.z + Math.cos(this.state.turretAngle) * 0.6

    if (this.ctx.role === 'host') {
      this.spawnBullet(this.ctx.selfId, sx, sz, vx, vz)
    } else {
      this.ctx.net.broadcast({
        game: this.gameId,
        type: 'shootReq',
        payload: { x: sx, z: sz, vx, vz },
      })
    }
  }

  private spawnBullet(owner: string, x: number, z: number, vx: number, vz: number): void {
    const id = `b${this.bulletSeq++}`
    const mesh = MeshBuilder.CreateSphere(`bullet-${id}`, { diameter: 0.2 }, this.ctx.scene)
    mesh.position = new Vector3(x, 0.35, z)
    mesh.material = this.bulletMat
    this.bullets.set(id, {
      id,
      owner,
      x,
      z,
      vx,
      vz,
      mesh,
      createdAt: performance.now(),
    })
    playSfx('tank_fire')
  }

  // ---- 道具 ----

  private spawnItem(cx: number, cy: number, kind: ItemKind): void {
    const ci = cy * GRID_W + cx
    this.items.get(ci)?.mesh.dispose()
    const mesh = MeshBuilder.CreateBox(`item-${ci}`, { size: 0.5 }, this.ctx.scene)
    mesh.position = new Vector3(cellToWorld(cx, GRID_W), 0.4, cellToWorld(cy, GRID_H))
    mesh.material = kind === 'hp' ? this.itemHpMat : kind === 'speed' ? this.itemSpeedMat : this.itemRapidMat
    this.items.set(ci, { kind, mesh })
  }

  private detectPickups(): void {
    if (this.items.size === 0) return
    for (const p of this.ctx.players) {
      if (!this.isAlive(p.id)) continue
      const pos = this.posOf(p.id)
      if (!pos) continue
      const cx = worldToCell(pos.x, GRID_W)
      const cy = worldToCell(pos.z, GRID_H)
      const ci = cy * GRID_W + cx
      if (this.items.has(ci)) this.hostBroadcast('pickup', { ci, who: p.id })
    }
  }

  private applyPickup(p: { ci: number; who: string }): void {
    const it = this.items.get(p.ci)
    if (!it) return
    playSfx('pickup')
    it.mesh.dispose()
    this.items.delete(p.ci)
    const s = this.statOf(p.who)
    const now = performance.now()
    if (it.kind === 'hp') {
      s.hp = Math.min(s.maxHp + 1, s.hp + 1)
      s.maxHp = Math.max(s.maxHp, s.hp)
    } else if (it.kind === 'speed') {
      s.speedMul = 1.25
      s.speedUntil = now + 5000
    } else {
      s.rapidMul = 0.5
      s.rapidUntil = now + 5000
    }
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
    this.hostBroadcast('seed', { seed: this.currentSeed })
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
        subtitle: standings.map((s, i) => `${i + 1}. ${s.name}${s.alive ? '（生存）' : ''} 击殺:${s.kills}`).join('\n'),
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
      if (!isNumIn(p.seed, 0, 0xffffffff)) return
      this.applySeed(p.seed)
    } else if (type === 'bullet') {
      if (!isStr(p.id) || !isStr(p.owner)) return
      if (!isNumIn(p.x, -WORLD_LIMIT, WORLD_LIMIT) || !isNumIn(p.z, -WORLD_LIMIT, WORLD_LIMIT)) return
      if (!isNumIn(p.vx, -VEL_LIMIT, VEL_LIMIT) || !isNumIn(p.vz, -VEL_LIMIT, VEL_LIMIT)) return
      if (!this.bullets.has(p.id)) this.spawnBullet(p.owner, p.x, p.z, p.vx, p.vz)
    } else if (type === 'hit') {
      if (!isStr(p.targetId) || !isIntIn(p.hp, 0, 99)) return
      const s = this.statOf(p.targetId)
      s.hp = p.hp
      playSfx('tank_hit')
      // 爆炸特效
      this.spawnExplosion(p.targetId)
    } else if (type === 'destroyed') {
      if (!isStr(p.targetId)) return
      const s = this.statOf(p.targetId)
      s.alive = false
      playSfx(p.targetId === this.ctx.selfId ? 'death' : 'kill')
      if (p.targetId === this.ctx.selfId) this.selfVisual?.root.setEnabled(false)
      else this.peerVisuals.get(p.targetId)?.root.setEnabled(false)
      // 給击杀者加分
      if (isStr(p.killerId)) {
        const ks = this.statOf(p.killerId)
        ks.kills++
      }
    } else if (type === 'item') {
      if (!isIntIn(p.cx, 0, GRID_W - 1) || !isIntIn(p.cy, 0, GRID_H - 1)) return
      if (!isOneOf<ItemKind>(p.kind, ITEM_KINDS)) return
      this.spawnItem(p.cx, p.cy, p.kind)
    } else if (type === 'pickup') {
      if (!isIntIn(p.ci, 0, GRID_W * GRID_H - 1) || !isStr(p.who)) return
      this.applyPickup({ ci: p.ci, who: p.who })
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
        cooldownMs: FIRE_COOLDOWN_MS * this.statOf(from).rapidMul,
        knownPos: this.own.latestRemote(from),
        now,
        worldLimit: WORLD_LIMIT,
        bulletSpeed: BULLET_SPEED,
      })
      if (!req) return
      this.lastShotAt.set(from, now)
      this.spawnBullet(from, req.x, req.z, req.vx, req.vz)
      return
    }
    if (msg.type === 'restartReq') {
      // 僅在結算中，或請求者已毀損且其他真人也全毀時受理
      if (this.ctx.role !== 'host' || !this.isPlayer(from)) return
      if (this.canAdvance(from)) this.hostRestart()
      return
    }
    if (this.ctx.role === 'host') return
    // seed/bullet/hit/destroyed/item/pickup 僅信任房主廣播
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

    this.camera = new ArcRotateCamera('cam', -Math.PI / 2, 0.55, 28, Vector3.Zero(), scene)
    new HemisphericLight('light', new Vector3(0.2, 1, 0.1), scene)

    // 共用材質
    this.crateMat = new StandardMaterial('crate-mat', scene)
    this.crateMat.diffuseColor = new Color3(0.62, 0.45, 0.22)
    this.wallMat = new StandardMaterial('wall-mat', scene)
    this.wallMat.diffuseColor = new Color3(0.42, 0.45, 0.5)
    this.flameMat = new StandardMaterial('flame-mat', scene)
    this.flameMat.emissiveColor = new Color3(1, 0.45, 0.1)
    this.flameMat.disableLighting = true
    this.bulletMat = new StandardMaterial('bullet-mat', scene)
    this.bulletMat.emissiveColor = new Color3(1, 0.85, 0.2)
    this.bulletMat.disableLighting = true

    this.itemHpMat = new StandardMaterial('item-hp', scene)
    this.itemHpMat.diffuseColor = new Color3(0.2, 0.85, 0.3)
    this.itemHpMat.emissiveColor = new Color3(0.1, 0.4, 0.15)
    this.itemSpeedMat = new StandardMaterial('item-speed', scene)
    this.itemSpeedMat.diffuseColor = new Color3(0.2, 0.5, 0.95)
    this.itemSpeedMat.emissiveColor = new Color3(0.1, 0.3, 0.8)
    this.itemRapidMat = new StandardMaterial('item-rapid', scene)
    this.itemRapidMat.diffuseColor = new Color3(0.95, 0.55, 0.1)
    this.itemRapidMat.emissiveColor = new Color3(0.8, 0.4, 0.05)

    // 地板
    const ground = MeshBuilder.CreateGround('ground', { width: GRID_W * CELL + 2, height: GRID_H * CELL + 2 }, scene)
    const gmat = new StandardMaterial('gmat', scene)
    gmat.diffuseColor = new Color3(0.18, 0.28, 0.18)
    ground.material = gmat

    // 水泥牆
    this.generateWalls()
    for (const idx of this.walls) {
      const cx = idx % GRID_W
      const cy = Math.floor(idx / GRID_W)
      const w = MeshBuilder.CreateBox(`wall-${cx}-${cy}`, { size: CELL * 0.95 }, scene)
      w.position = new Vector3(cellToWorld(cx, GRID_W), CELL * 0.47, cellToWorld(cy, GRID_H))
      w.material = this.wallMat
    }

    this.selfVisual = this.makeTank(ctx.selfId, 0, 0)
    this.hud = createTextPanel(scene, this.camera, 'hud', 4, 0.7, new Vector3(0, 2.6, 8))
    this.banner = createCountdownPanel(scene, this.camera, 'banner', 7, 4, new Vector3(0, 0.3, 8))

    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)

    this.flow = createGameFlow({ net: ctx.net, game: this.gameId, role: ctx.role, hostId: ctx.hostId })
    attachFlowAudio(this.flow, 'tank', {
      resultSfx: (r) => ((r as Standing[] | undefined)?.[0]?.id === ctx.selfId ? 'win' : 'lose'),
    })
    this.flow.onChange((s) => {
      ;(window as unknown as Record<string, unknown>).__BATTLE_PHASE = s.phase
    })
    ;(window as unknown as Record<string, unknown>).__BATTLE_PHASE = this.flow.state.phase

    this.own = createOwnershipSync<TankState>({ net: ctx.net, game: this.gameId })
    this.own.start(() => ({ ...this.state }))

    this.ticker = createFixedTicker(SIM_HZ, (_t, stepMs) => this.simulate(stepMs / 1000))
    this.ticker.start()

    if (ctx.role === 'host') {
      this.currentSeed = (Math.random() * 0x7fffffff) | 0
      this.hostBroadcast('seed', { seed: this.currentSeed })
      this.offOpen = ctx.net.on('open', (peerId) => {
        ctx.net.send(peerId, { game: this.gameId, type: 'seed', payload: { seed: this.currentSeed } })
      })
      this.flow.startCountdown(3)
    } else {
      this.applySeed(1)
    }
  }

  private simulate(dt: number): void {
    const playing = this.flow.state.phase === 'playing'

    // 移動
    if (playing && this.isAlive(this.ctx.selfId)) {
      const k = this.keys
      const dx = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0)
      const dz = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0)
      const stat = this.statOf(this.ctx.selfId)
      const now = performance.now()
      const speed = MOVE_SPEED * stat.speedMul * (stat.speedUntil > now ? 1 : 1)

      if (dx !== 0 || dz !== 0) {
        const len = Math.hypot(dx, dz)
        const step = (speed * dt) / len
        const nx = this.state.x + dx * step
        if (!this.hitBlocked(nx, this.state.z)) this.state.x = nx
        const nz = this.state.z + dz * step
        if (!this.hitBlocked(this.state.x, nz)) this.state.z = nz
        this.state.ry = Math.atan2(dx, dz)
      }

      // 砲塔旋轉 Q/E
      if (k.has('q')) this.state.turretAngle -= TURRET_SPEED * dt
      if (k.has('e')) this.state.turretAngle += TURRET_SPEED * dt
    }

    if (this.ctx.role !== 'host' || !playing) return

    // 道具拾取
    this.detectPickups()

    // 子彈移動 + 碰撞
    const now = performance.now()
    for (const [id, b] of [...this.bullets]) {
      b.x += b.vx * dt
      b.z += b.vz * dt
      b.mesh.position.x = b.x
      b.mesh.position.z = b.z

      // 超時
      if (now - b.createdAt > BULLET_LIFETIME_MS) {
        b.mesh.dispose()
        this.bullets.delete(id)
        continue
      }

      // 確認子彈還存在（可能被碰撞處理中刪除）
      if (!this.bullets.has(id)) continue

      // 碰牆/箱
      const cx = worldToCell(b.x, GRID_W)
      const cy = worldToCell(b.z, GRID_H)
      if (cx < 0 || cx >= GRID_W || cy < 0 || cy >= GRID_H) {
        b.mesh.dispose()
        this.bullets.delete(id)
        continue
      }
      const ci = cy * GRID_W + cx
      if (this.walls.has(ci)) {
        b.mesh.dispose()
        this.bullets.delete(id)
        continue
      }
      if (this.crates.has(ci)) {
        // 摧毀箱子
        this.crates.get(ci)?.dispose()
        this.crates.delete(ci)
        b.mesh.dispose()
        this.bullets.delete(id)
        // 掉落道具
        if (Math.random() < CRATE_DROP_CHANCE) {
          const kind: ItemKind = ['hp', 'speed', 'rapid'][Math.floor(Math.random() * 3)] as ItemKind
          this.hostBroadcast('item', { cx, cy, kind })
        }
        continue
      }

      // 碰撞坦克
      for (const p of this.ctx.players) {
        if (p.id === b.owner) continue
        if (!this.isAlive(p.id)) continue
        const pos = this.posOf(p.id)
        if (!pos) continue
        const dist = Math.hypot(b.x - pos.x, b.z - pos.z)
        if (dist < 0.7) {
          const s = this.statOf(p.id)
          s.hp--
          b.mesh.dispose()
          this.bullets.delete(id)
          this.hostBroadcast('hit', { bulletId: id, targetId: p.id, hp: s.hp, killerId: b.owner })
          if (s.hp <= 0) {
            this.hostBroadcast('destroyed', { targetId: p.id, killerId: b.owner })
          }
          break
        }
      }
    }

    // 道具浮動旋轉
    for (const it of this.items.values()) {
      it.mesh.rotation.y += dt * 3
      it.mesh.position.y = 0.4 + Math.sin(now * 0.004 + it.mesh.position.x) * 0.1
    }

    // 勝負：2 人以上、存活 ≤ 1 → 結算
    if (this.ctx.players.length >= 2) {
      const aliveIds = this.ctx.players.filter((p) => this.isAlive(p.id)).map((p) => p.id)
      if (aliveIds.length <= 1) {
        const standings: Standing[] = this.ctx.players.map((p) => ({
          id: p.id,
          name: this.nameFor(p.id),
          alive: this.isAlive(p.id),
          kills: this.statOf(p.id).kills,
        }))
        // 按存活 > 擊殺排序
        standings.sort((a, b) => (b.alive ? 1 : 0) - (a.alive ? 1 : 0) || b.kills - a.kills)
        this.flow.endGame(standings)
      }
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
      const s = this.statOf(this.ctx.selfId)
      this.updateHpBars(this.selfVisual, s.hp)
      this.selfVisual.root.setEnabled(this.isAlive(this.ctx.selfId))
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
        v.root.setEnabled(this.isAlive(id))
        this.peerVisuals.set(id, v)
      }
      const s = this.own.sampleRemote(id)
      if (s) {
        v.root.position.x = s.a.x + (s.b.x - s.a.x) * s.alpha
        v.root.position.z = s.a.z + (s.b.z - s.a.z) * s.alpha
        v.root.rotation.y = s.a.ry + (s.b.ry - s.a.ry) * s.alpha
        v.turret.rotation.y = s.a.turretAngle + (s.b.turretAngle - s.a.turretAngle) * s.alpha - v.root.rotation.y
      }
      const ps = this.statOf(id)
      this.updateHpBars(v, ps.hp)
      v.root.setEnabled(this.isAlive(id))
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
    const aliveCount = this.ctx.players.filter((p) => this.isAlive(p.id)).length
    const me = this.statOf(this.ctx.selfId)
    const hpNote = phase === 'playing' ? `・HP ${me.hp}/${me.maxHp} ・擊殺 ${me.kills}` : ''
    const deadNote = !this.isAlive(this.ctx.selfId) && phase === 'playing' ? '・已毀損（觀戰中）' : ''
    this.hud.draw(phase === 'playing' ? `存活 ${aliveCount} / ${this.ctx.players.length}${hpNote}${deadNote}` : '', 48)

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
    for (const b of this.bullets.values()) b.mesh.dispose()
    this.bullets.clear()
    for (const m of this.crates.values()) m.dispose()
    this.crates.clear()
    for (const it of this.items.values()) it.mesh.dispose()
    this.items.clear()
    for (const f of this.flames) f.mesh.dispose()
    this.flames = []
    this.hud.dispose()
    this.banner.dispose()
  }
}

export const createTankScene = (): GameModule => new TankScene()
