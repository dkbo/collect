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

type ItemKind = 'bomb' | 'fire'

interface ItemInfo {
  kind: ItemKind
  mesh: Mesh
}

/** 玩家能力值（每輪重置；吃道具成長） */
interface PlayerStat {
  bombs: number // 同時可放炸彈數上限
  fire: number // 爆炸延伸格數
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
const PLAYER_R = 0.55
const BOMB_FUSE_MS = 2000
const FLAME_MS = 350
const BOMB_INPUT_COOLDOWN_MS = 250

// 道具：初始一顆彈、火力 1，吃道具才成長
const INIT_BOMBS = 1
const INIT_FIRE = 1
const MAX_BOMBS = 6
const MAX_FIRE = 6
const ITEM_DROP_CHANCE = 0.45 // 木箱炸毀後掉落道具的機率（host 決定）

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
  private items = new Map<number, ItemInfo>() // 場上道具，keyed by cellIndex

  private state: BomberState = { x: 0, z: 0 }
  private alive = new Map<string, boolean>()
  private deathOrder: string[] = []
  private lastBombInput = 0
  private bombSeq = 0
  private ownerBombCount = new Map<string, number>()
  private stats = new Map<string, PlayerStat>()
  private resultElapsed = 0
  private lastOverlayKey = '' // 僅在內容變動時才更新 React 覆蓋層

  private selfAvatar?: Avatar
  private peerAvatars = new Map<string, Avatar>()
  private camera!: ArcRotateCamera
  private hud!: TextPanel
  private banner!: TextPanel
  private crateMat!: StandardMaterial
  private flameMat!: StandardMaterial
  private bombMat!: StandardMaterial
  private itemBombMat!: StandardMaterial
  private itemFireMat!: StandardMaterial

  private onKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase()
    this.keys.add(key)
    if (key === ' ' || key === 'enter') this.requestBomb()
    if (key === 'r') this.requestRestart()
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

  /** 取得玩家能力值（首次存取給初始值） */
  private statOf(id: string): PlayerStat {
    let s = this.stats.get(id)
    if (!s) {
      s = { bombs: INIT_BOMBS, fire: INIT_FIRE }
      this.stats.set(id, s)
    }
    return s
  }

  /** 某玩家當前位置（自己用本地、遠端用最新插值樣本） */
  private posOf(pid: string): BomberState | null {
    return pid === this.ctx.selfId ? this.state : this.own.latestRemote(pid)
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

  /** 依 seed 重建一輪：地圖/木箱/炸彈/火焰/存活/出生位置全部重置 */
  private applySeed(seed: number): void {
    this.map = generateMap(seed)

    for (const m of this.crates.values()) m.dispose()
    this.crates.clear()
    for (const b of this.bombs.values()) b.mesh.dispose()
    this.bombs.clear()
    for (const f of this.flames) f.mesh.dispose()
    this.flames = []
    for (const it of this.items.values()) it.mesh.dispose()
    this.items.clear()
    this.ownerBombCount.clear()
    this.deathOrder = []
    this.stats.clear()
    for (const p of this.ctx.players) {
      this.alive.set(p.id, true)
      this.stats.set(p.id, { bombs: INIT_BOMBS, fire: INIT_FIRE })
    }

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
    this.selfAvatar?.root.setEnabled(true)
    for (const a of this.peerAvatars.values()) a.root.setEnabled(true)
  }

  /** 玩家圓身與阻擋格碰撞（牆/木箱/場外/炸彈） */
  private hitBlocked(px: number, pz: number): boolean {
    for (const ox of [-PLAYER_R, PLAYER_R]) {
      for (const oz of [-PLAYER_R, PLAYER_R]) {
        const cx = worldToCell(px + ox, GRID_W)
        const cy = worldToCell(pz + oz, GRID_H)
        if (isBlocked(this.map, cx, cy)) return true
        // 炸彈碰撞：檢查該格是否有炸彈
        for (const b of this.bombs.values()) {
          if (b.cx === cx && b.cy === cy) return true
        }
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

  /** 可重開的時機：結算畫面，或自己已陣亡（觀戰中） */
  private canRestart(): boolean {
    const phase = this.flow.state.phase
    return phase === 'result' || (phase === 'playing' && !this.isAlive(this.ctx.selfId))
  }

  /** 按 R 重開：host 直接重啟一局，guest 送請求給 host */
  private requestRestart(): void {
    if (!this.canRestart()) return
    if (this.ctx.role === 'host') this.hostRestart()
    else this.ctx.net.broadcast({ game: this.gameId, type: 'restartReq', payload: {} })
  }

  /** host：重啟一局（新地圖 seed + 倒數） */
  private hostRestart(): void {
    if (this.ctx.role !== 'host') return
    this.resultElapsed = 0
    this.currentSeed = (Math.random() * 0x7fffffff) | 0
    this.hostBroadcast('seed', { seed: this.currentSeed })
    this.flow.startCountdown(3)
  }

  /** 依當前階段/存活狀態，推送陣亡/結算的覆蓋層 UI（只在內容變動時更新） */
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
        subtitle: standings.map((s, i) => `${i + 1}. ${s.name}${s.alive ? '（生存）' : ''}`).join('\n'),
        actions: [{ label: '🔄 重新開始', onClick: () => this.requestRestart(), variant: 'primary' }],
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

  /** host：驗證放彈請求，通過即廣播 bomb */
  private validateBomb(owner: string, cx: number, cy: number): void {
    if (this.flow.state.phase !== 'playing' || !this.isAlive(owner)) return
    if (isBlocked(this.map, cx, cy)) return
    for (const b of this.bombs.values()) if (b.cx === cx && b.cy === cy) return
    if ((this.ownerBombCount.get(owner) ?? 0) >= this.statOf(owner).bombs) return
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
    const { cells, destroyed } = blastCells(this.map, bomb.cx, bomb.cy, this.statOf(bomb.owner).fire)
    const cellSet = new Set(cells.map(([x, y]) => cellIndex(x, y)))

    // 擊殺：所有存活者（自己 + 遠端最新位置）所在格落入火焰即死
    const kills: string[] = []
    for (const p of this.ctx.players) {
      if (!this.isAlive(p.id)) continue
      const pos = this.posOf(p.id)
      if (!pos) continue
      const pcx = worldToCell(pos.x, GRID_W)
      const pcy = worldToCell(pos.z, GRID_H)
      if (cellSet.has(cellIndex(pcx, pcy))) kills.push(p.id)
    }

    // 火焰燒毀範圍內既有道具
    const itemKills: [number, number][] = []
    for (const [cx, cy] of cells) {
      if (this.items.has(cellIndex(cx, cy))) itemKills.push([cx, cy])
    }

    // 木箱炸毀後依機率掉落道具（host 決定，種類隨機）
    const drops: { cx: number; cy: number; kind: ItemKind }[] = []
    for (const [cx, cy] of destroyed) {
      if (Math.random() >= ITEM_DROP_CHANCE) continue
      const kind: ItemKind = Math.random() < 0.5 ? 'bomb' : 'fire'
      drops.push({ cx, cy, kind })
    }

    this.hostBroadcast('boom', { id, cells, destroyed, kills, itemKills, drops })

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
    itemKills?: [number, number][]
    drops?: { cx: number; cy: number; kind: ItemKind }[]
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
    // 燒毀既有道具
    for (const [cx, cy] of p.itemKills ?? []) {
      const ci = cellIndex(cx, cy)
      this.items.get(ci)?.mesh.dispose()
      this.items.delete(ci)
    }
    // 掉落新道具
    for (const d of p.drops ?? []) this.spawnItem(d.cx, d.cy, d.kind)
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
      if (pid === this.ctx.selfId) this.selfAvatar?.root.setEnabled(false)
      else this.peerAvatars.get(pid)?.root.setEnabled(false)
    }
  }

  /** 道具落地：建立旋轉小物件，存入 items（同格已有則先清除） */
  private spawnItem(cx: number, cy: number, kind: ItemKind): void {
    const ci = cellIndex(cx, cy)
    this.items.get(ci)?.mesh.dispose()
    const mesh =
      kind === 'bomb'
        ? MeshBuilder.CreateSphere(`item-${ci}`, { diameter: 0.8 }, this.ctx.scene)
        : MeshBuilder.CreateBox(`item-${ci}`, { width: 0.7, height: 0.7, depth: 0.7 }, this.ctx.scene)
    mesh.position = new Vector3(cellToWorld(cx, GRID_W), 0.55, cellToWorld(cy, GRID_H))
    mesh.material = kind === 'bomb' ? this.itemBombMat : this.itemFireMat
    this.items.set(ci, { kind, mesh })
  }

  /** host：偵測站到道具上的存活玩家，發放並廣播 pickup */
  private detectPickups(): void {
    if (this.items.size === 0) return
    for (const p of this.ctx.players) {
      if (!this.isAlive(p.id)) continue
      const pos = this.posOf(p.id)
      if (!pos) continue
      const ci = cellIndex(worldToCell(pos.x, GRID_W), worldToCell(pos.z, GRID_H))
      if (this.items.has(ci)) this.hostBroadcast('pickup', { ci, who: p.id })
    }
  }

  /** 套用拾取：移除道具、提升該玩家能力值（上限封頂） */
  private applyPickup(p: { ci: number; who: string }): void {
    const it = this.items.get(p.ci)
    if (!it) return
    it.mesh.dispose()
    this.items.delete(p.ci)
    const s = this.statOf(p.who)
    if (it.kind === 'bomb') s.bombs = Math.min(MAX_BOMBS, s.bombs + 1)
    else s.fire = Math.min(MAX_FIRE, s.fire + 1)
  }

  /** 收到網路訊息（含 host 本地回放）統一入口 */
  private applyMessage(type: string, payload: unknown): void {
    if (type === 'seed') this.applySeed((payload as { seed: number }).seed)
    else if (type === 'bomb') this.applyBomb(payload as Parameters<BomberScene['applyBomb']>[0])
    else if (type === 'boom') this.applyBoom(payload as Parameters<BomberScene['applyBoom']>[0])
    else if (type === 'pickup') this.applyPickup(payload as Parameters<BomberScene['applyPickup']>[0])
  }

  onNetworkMessage(from: string, msg: GameNetMessage): void {
    if (msg.game !== this.gameId) return
    if (msg.type === 'bombReq') {
      if (this.ctx.role !== 'host') return
      const p = msg.payload as { cx: number; cy: number }
      this.validateBomb(from, p.cx, p.cy)
      return
    }
    if (msg.type === 'restartReq') {
      // 僅在結算中、或請求者已陣亡時受理，避免對局中誤觸重開
      if (this.ctx.role !== 'host') return
      if (this.flow.state.phase === 'result' || !this.isAlive(from)) this.hostRestart()
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
    // 道具材質：炸彈 up 為青色、火力 up 為橘紅，emissive 讓它在地圖上醒目
    this.itemBombMat = new StandardMaterial('item-bomb-mat', scene)
    this.itemBombMat.diffuseColor = new Color3(0.1, 0.6, 0.9)
    this.itemBombMat.emissiveColor = new Color3(0.1, 0.5, 0.85)
    this.itemFireMat = new StandardMaterial('item-fire-mat', scene)
    this.itemFireMat.diffuseColor = new Color3(0.95, 0.35, 0.1)
    this.itemFireMat.emissiveColor = new Color3(0.85, 0.3, 0.05)

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

    this.selfAvatar = this.makePlayer(ctx.selfId)
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

    // 道具拾取（host 裁決）
    this.detectPickups()

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

    // 火焰到期清除
    const now = performance.now()
    this.flames = this.flames.filter((f) => {
      if (f.until > now) return true
      f.mesh.dispose()
      return false
    })

    // 道具旋轉浮動，提示可拾取
    for (const it of this.items.values()) {
      it.mesh.rotation.y += deltaMs * 0.004
      it.mesh.position.y = 0.55 + Math.sin(now * 0.004 + it.mesh.position.x) * 0.12
    }

    // HUD / 橫幅
    const aliveCount = this.ctx.players.filter((p) => this.isAlive(p.id)).length
    const deadNote = !this.isAlive(this.ctx.selfId) && phase === 'playing' ? '・你已陣亡（觀戰中）' : ''
    const me = this.statOf(this.ctx.selfId)
    const statsNote = phase === 'playing' ? `・💣${me.bombs} 🔥${me.fire}` : ''
    this.hud.draw(phase === 'playing' ? `存活 ${aliveCount} / ${this.ctx.players.length}${statsNote}${deadNote}` : '', 48)

    // 陣亡/結算的「重新開始」UI 交給 React 覆蓋層
    this.syncOverlay()

    if (phase === 'countdown') {
      const n = Math.ceil(this.flow.countdownRemaining() / 1000)
      this.banner.draw(n > 0 ? String(n) : 'GO!', 200)
    } else if (phase === 'result') {
      // 結算內容由覆蓋層顯示；此處僅維持 host 自動重開計時
      this.banner.draw('')
      if (this.ctx.role === 'host') {
        this.resultElapsed += deltaMs
        if (this.resultElapsed > 10000) this.hostRestart()
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
    this.selfAvatar?.root.dispose(false, true)
    for (const a of this.peerAvatars.values()) a.root.dispose(false, true)
    this.peerAvatars.clear()
    for (const m of this.crates.values()) m.dispose()
    this.crates.clear()
    for (const b of this.bombs.values()) b.mesh.dispose()
    this.bombs.clear()
    for (const f of this.flames) f.mesh.dispose()
    this.flames = []
    for (const it of this.items.values()) it.mesh.dispose()
    this.items.clear()
    this.hud.dispose()
    this.banner.dispose()
  }
}

export const createBomberScene = (): GameModule => new BomberScene()
