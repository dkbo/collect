import {
  ArcRotateCamera,
  Color3,
  HemisphericLight,
  MeshBuilder,
  StandardMaterial,
  Vector3,
  type Mesh,
} from '@babylonjs/core'
import type { GameContext, GameModule } from '@/babylon/types'
import type { GameNetMessage } from '@/core/webrtc'
import { createTextPanel, type TextPanel } from '@/babylon/hud'
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

interface BombInfo {
  cx: number
  cy: number
  owner: string
  explodeAt: number // host 才有意義
  mesh: Mesh
}

interface Standing {
  id: string
  name: string
  alive: boolean
}

const SIM_HZ = 30
const CELL = 2
const MOVE_SPEED = 5.5
const PLAYER_R = 0.55
const BOMB_FUSE_MS = 2000
const BLAST_RANGE = 2
const MAX_BOMBS_PER_PLAYER = 2
const FLAME_MS = 350
const BOMB_INPUT_COOLDOWN_MS = 250

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
  private flames: { mesh: Mesh; until: number }[] = []

  private state: BomberState = { x: 0, z: 0 }
  private alive = new Map<string, boolean>()
  private deathOrder: string[] = []
  private lastBombInput = 0
  private bombSeq = 0
  private ownerBombCount = new Map<string, number>()
  private resultElapsed = 0

  private selfMesh?: Mesh
  private peerMeshes = new Map<string, Mesh>()
  private camera!: ArcRotateCamera
  private hud!: TextPanel
  private banner!: TextPanel
  private crateMat!: StandardMaterial
  private flameMat!: StandardMaterial
  private bombMat!: StandardMaterial

  private onKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase()
    this.keys.add(key)
    if (key === ' ' || key === 'enter') this.requestBomb()
  }
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase())

  private colorFor(id: string): Color3 {
    let h = 0
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
    return Color3.FromHSV(h % 360, 0.7, 0.9)
  }

  private nameFor(id: string): string {
    return this.ctx.players.find((p) => p.id === id)?.name ?? id.slice(0, 6)
  }

  private isAlive(id: string): boolean {
    return this.alive.get(id) ?? false
  }

  private makePlayer(id: string): Mesh {
    const m = MeshBuilder.CreateBox(`pl-${id}`, { width: 1.1, height: 1.2, depth: 1.1 }, this.ctx.scene)
    m.position.y = 0.6
    const mat = new StandardMaterial(`pl-mat-${id}`, this.ctx.scene)
    mat.diffuseColor = this.colorFor(id)
    m.material = mat
    return m
  }

  // ---- 地圖 ----

  /** 依 seed 重建一輪：地圖/木箱/炸彈/火焰/存活/出生位置全部重置 */
  private applySeed(seed: number): void {
    this.map = generateMap(seed)

    for (const m of this.crates.values()) m.dispose()
    this.crates.clear()
    for (const b of this.bombs.values()) b.mesh.dispose()
    this.bombs.clear()
    for (const f of this.flames) f.mesh.dispose()
    this.flames = []
    this.ownerBombCount.clear()
    this.deathOrder = []
    for (const p of this.ctx.players) this.alive.set(p.id, true)

    for (let cy = 0; cy < GRID_H; cy++) {
      for (let cx = 0; cx < GRID_W; cx++) {
        if (this.map[cellIndex(cx, cy)] !== TILE_CRATE) continue
        const crate = MeshBuilder.CreateBox(`crate-${cx}-${cy}`, { size: CELL * 0.9 }, this.ctx.scene)
        crate.position = new Vector3(cellToWorld(cx, GRID_W), CELL * 0.45, cellToWorld(cy, GRID_H))
        crate.material = this.crateMat
        this.crates.set(cellIndex(cx, cy), crate)
      }
    }

    // 自己回出生角；顯示所有人
    const idx = Math.max(0, this.ctx.players.findIndex((p) => p.id === this.ctx.selfId))
    const [cx, cy] = SPAWN_CORNERS[idx % SPAWN_CORNERS.length]
    this.state = { x: cellToWorld(cx, GRID_W), z: cellToWorld(cy, GRID_H) }
    this.selfMesh?.setEnabled(true)
    for (const m of this.peerMeshes.values()) m.setEnabled(true)
  }

  /** 玩家圓身與阻擋格碰撞（牆/木箱/場外；炸彈不擋路） */
  private hitBlocked(px: number, pz: number): boolean {
    for (const ox of [-PLAYER_R, PLAYER_R]) {
      for (const oz of [-PLAYER_R, PLAYER_R]) {
        const cx = worldToCell(px + ox, GRID_W)
        const cy = worldToCell(pz + oz, GRID_H)
        if (isBlocked(this.map, cx, cy)) return true
      }
    }
    return false
  }

  // ---- 炸彈協議 ----

  /** host 本地套用 + 廣播（host 自己的訊息不會回流） */
  private hostBroadcast(type: string, payload: unknown): void {
    this.ctx.net.broadcast({ game: this.gameId, type, payload })
    this.applyMessage(type, payload)
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

  /** host：驗證放彈請求，通過即廣播 bomb */
  private validateBomb(owner: string, cx: number, cy: number): void {
    if (this.flow.state.phase !== 'playing' || !this.isAlive(owner)) return
    if (isBlocked(this.map, cx, cy)) return
    for (const b of this.bombs.values()) if (b.cx === cx && b.cy === cy) return
    if ((this.ownerBombCount.get(owner) ?? 0) >= MAX_BOMBS_PER_PLAYER) return
    this.hostBroadcast('bomb', { id: `b${this.bombSeq++}`, cx, cy, owner })
  }

  private applyBomb(p: { id: string; cx: number; cy: number; owner: string }): void {
    const mesh = MeshBuilder.CreateSphere(`bomb-${p.id}`, { diameter: 1.1 }, this.ctx.scene)
    mesh.position = new Vector3(cellToWorld(p.cx, GRID_W), 0.55, cellToWorld(p.cy, GRID_H))
    mesh.material = this.bombMat
    this.bombs.set(p.id, {
      cx: p.cx,
      cy: p.cy,
      owner: p.owner,
      explodeAt: performance.now() + BOMB_FUSE_MS,
      mesh,
    })
    this.ownerBombCount.set(p.owner, (this.ownerBombCount.get(p.owner) ?? 0) + 1)
  }

  /** host：引爆一顆（含連鎖），逐顆廣播 boom */
  private hostExplode(id: string): void {
    const bomb = this.bombs.get(id)
    if (!bomb) return
    const { cells, destroyed } = blastCells(this.map, bomb.cx, bomb.cy, BLAST_RANGE)
    const cellSet = new Set(cells.map(([x, y]) => cellIndex(x, y)))

    // 擊殺：所有存活者（自己 + 遠端最新位置）所在格落入火焰即死
    const kills: string[] = []
    const posOf = (pid: string): BomberState | null =>
      pid === this.ctx.selfId ? this.state : this.own.latestRemote(pid)
    for (const p of this.ctx.players) {
      if (!this.isAlive(p.id)) continue
      const pos = posOf(p.id)
      if (!pos) continue
      const pcx = worldToCell(pos.x, GRID_W)
      const pcy = worldToCell(pos.z, GRID_H)
      if (cellSet.has(cellIndex(pcx, pcy))) kills.push(p.id)
    }

    this.hostBroadcast('boom', { id, cells, destroyed, kills })

    // 連鎖：火焰覆蓋到的其他炸彈立即引爆（boom 已套用、地圖已更新）
    for (const [bid, b] of this.bombs) {
      if (cellSet.has(cellIndex(b.cx, b.cy))) this.hostExplode(bid)
    }
  }

  private applyBoom(p: {
    id: string
    cells: [number, number][]
    destroyed: [number, number][]
    kills: string[]
  }): void {
    const bomb = this.bombs.get(p.id)
    if (bomb) {
      bomb.mesh.dispose()
      this.bombs.delete(p.id)
      const n = (this.ownerBombCount.get(bomb.owner) ?? 1) - 1
      this.ownerBombCount.set(bomb.owner, Math.max(0, n))
    }
    for (const [cx, cy] of p.destroyed) {
      this.map[cellIndex(cx, cy)] = 0
      this.crates.get(cellIndex(cx, cy))?.dispose()
      this.crates.delete(cellIndex(cx, cy))
    }
    const until = performance.now() + FLAME_MS
    for (const [cx, cy] of p.cells) {
      const f = MeshBuilder.CreateBox(`flame-${cx}-${cy}-${p.id}`, { width: CELL * 0.9, height: 0.3, depth: CELL * 0.9 }, this.ctx.scene)
      f.position = new Vector3(cellToWorld(cx, GRID_W), 0.15, cellToWorld(cy, GRID_H))
      f.material = this.flameMat
      this.flames.push({ mesh: f, until })
    }
    for (const pid of p.kills) {
      if (!this.isAlive(pid)) continue
      this.alive.set(pid, false)
      this.deathOrder.push(pid)
      if (pid === this.ctx.selfId) this.selfMesh?.setEnabled(false)
      else this.peerMeshes.get(pid)?.setEnabled(false)
    }
  }

  /** 收到網路訊息（含 host 本地回放）統一入口 */
  private applyMessage(type: string, payload: unknown): void {
    if (type === 'seed') this.applySeed((payload as { seed: number }).seed)
    else if (type === 'bomb') this.applyBomb(payload as Parameters<BomberScene['applyBomb']>[0])
    else if (type === 'boom') this.applyBoom(payload as Parameters<BomberScene['applyBoom']>[0])
  }

  onNetworkMessage(from: string, msg: GameNetMessage): void {
    if (msg.game !== this.gameId) return
    if (msg.type === 'bombReq') {
      if (this.ctx.role !== 'host') return
      const p = msg.payload as { cx: number; cy: number }
      this.validateBomb(from, p.cx, p.cy)
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
    this.bombMat = new StandardMaterial('bomb-mat', scene)
    this.bombMat.diffuseColor = new Color3(0.12, 0.12, 0.15)
    this.flameMat = new StandardMaterial('flame-mat', scene)
    this.flameMat.emissiveColor = new Color3(1, 0.45, 0.1)
    this.flameMat.disableLighting = true

    // 地板 + 固定柱牆（柱牆不隨 seed 變動，建一次即可）
    const ground = MeshBuilder.CreateGround('ground', { width: GRID_W * CELL + 2, height: GRID_H * CELL + 2 }, scene)
    const gmat = new StandardMaterial('gmat', scene)
    gmat.diffuseColor = new Color3(0.2, 0.42, 0.25)
    ground.material = gmat
    const wallMat = new StandardMaterial('wall-mat', scene)
    wallMat.diffuseColor = new Color3(0.42, 0.45, 0.5)
    for (let cy = 1; cy < GRID_H; cy += 2) {
      for (let cx = 1; cx < GRID_W; cx += 2) {
        const w = MeshBuilder.CreateBox(`wall-${cx}-${cy}`, { size: CELL * 0.96 }, scene)
        w.position = new Vector3(cellToWorld(cx, GRID_W), CELL * 0.48, cellToWorld(cy, GRID_H))
        w.material = wallMat
      }
    }

    this.selfMesh = this.makePlayer(ctx.selfId)
    this.hud = createTextPanel(scene, this.camera, 'hud', 4, 0.7, new Vector3(0, 2.6, 8))
    this.banner = createTextPanel(scene, this.camera, 'banner', 7, 4, new Vector3(0, 0.3, 8))

    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)

    this.flow = createGameFlow({ net: ctx.net, game: this.gameId, role: ctx.role })
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
      this.hostBroadcast('seed', { seed: this.currentSeed })
      // 開局當下 guest 通道未開，channel open 時補送 seed（flow 的階段補送由 gameFlow 處理）
      this.offOpen = ctx.net.on('open', (peerId) => {
        ctx.net.send(peerId, { game: this.gameId, type: 'seed', payload: { seed: this.currentSeed } })
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

    if (playing && this.isAlive(this.ctx.selfId)) {
      const k = this.keys
      const dx = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0)
      const dz = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0)
      if (dx !== 0 || dz !== 0) {
        const len = Math.hypot(dx, dz)
        const step = (MOVE_SPEED * dt) / len
        const nx = this.state.x + dx * step
        if (!this.hitBlocked(nx, this.state.z)) this.state.x = nx
        const nz = this.state.z + dz * step
        if (!this.hitBlocked(this.state.x, nz)) this.state.z = nz
      }
    }

    if (this.ctx.role !== 'host' || !playing) return

    // 引信到期 → 引爆（含連鎖）
    const now = performance.now()
    for (const [id, b] of [...this.bombs]) {
      if (b.explodeAt <= now && this.bombs.has(id)) this.hostExplode(id)
    }

    // 勝負：2 人以上、存活 ≤ 1 → 結算
    if (this.ctx.players.length >= 2) {
      const aliveIds = this.ctx.players.filter((p) => this.isAlive(p.id)).map((p) => p.id)
      if (aliveIds.length <= 1) {
        const order = [...aliveIds, ...[...this.deathOrder].reverse()]
        const standings: Standing[] = order.map((id) => ({
          id,
          name: this.nameFor(id),
          alive: this.isAlive(id),
        }))
        this.flow.endGame(standings)
      }
    }
  }

  update(deltaMs: number): void {
    const phase = this.flow.state.phase

    // 自己
    if (this.selfMesh) {
      this.selfMesh.position.x = this.state.x
      this.selfMesh.position.z = this.state.z
    }

    // 遠端：增刪 + 插值
    const ids = new Set(this.own.remoteIds())
    for (const [id, m] of this.peerMeshes) {
      if (ids.has(id)) continue
      m.dispose()
      this.peerMeshes.delete(id)
    }
    for (const id of ids) {
      let m = this.peerMeshes.get(id)
      if (!m) {
        m = this.makePlayer(id)
        m.setEnabled(this.isAlive(id))
        this.peerMeshes.set(id, m)
      }
      const s = this.own.sampleRemote(id)
      if (s) {
        m.position.x = s.a.x + (s.b.x - s.a.x) * s.alpha
        m.position.z = s.a.z + (s.b.z - s.a.z) * s.alpha
      }
    }

    // 火焰到期清除
    const now = performance.now()
    this.flames = this.flames.filter((f) => {
      if (f.until > now) return true
      f.mesh.dispose()
      return false
    })

    // HUD / 橫幅
    const aliveCount = this.ctx.players.filter((p) => this.isAlive(p.id)).length
    const deadNote = !this.isAlive(this.ctx.selfId) && phase === 'playing' ? '・你已陣亡（觀戰中）' : ''
    this.hud.draw(phase === 'playing' ? `存活 ${aliveCount} / ${this.ctx.players.length}${deadNote}` : '', 48)

    if (phase === 'countdown') {
      const n = Math.ceil(this.flow.countdownRemaining() / 1000)
      this.banner.draw(n > 0 ? String(n) : 'GO!', 200)
    } else if (phase === 'result') {
      const standings = (this.flow.state.result as Standing[] | undefined) ?? []
      const lines = standings.map((s, i) => `${i + 1}. ${s.name}${s.alive ? '（生存）' : ''}`)
      this.banner.draw(['💥 結果', ...lines].join('\n'), 56)
      if (this.ctx.role === 'host') {
        this.resultElapsed += deltaMs
        if (this.resultElapsed > 10000) {
          this.resultElapsed = 0
          this.currentSeed = (Math.random() * 0x7fffffff) | 0
          this.hostBroadcast('seed', { seed: this.currentSeed })
          this.flow.startCountdown(3)
        }
      }
    } else {
      this.resultElapsed = 0
      this.banner.draw('')
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
    this.ticker.stop()
    this.own.stop()
    this.flow.dispose()
    this.offOpen?.()
    this.selfMesh?.dispose()
    for (const m of this.peerMeshes.values()) m.dispose()
    this.peerMeshes.clear()
    for (const m of this.crates.values()) m.dispose()
    this.crates.clear()
    for (const b of this.bombs.values()) b.mesh.dispose()
    this.bombs.clear()
    for (const f of this.flames) f.mesh.dispose()
    this.flames = []
    this.hud.dispose()
    this.banner.dispose()
  }
}

export const createBomberScene = (): GameModule => new BomberScene()
