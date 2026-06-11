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
  createHostSnapshot,
  createOwnershipSync,
  createSnapshotReceiver,
  type FixedTicker,
  type GameFlow,
  type HostSnapshotSender,
  type OwnershipSync,
  type SnapshotBuffer,
} from '@/babylon/net'
import {
  GRID_H,
  GRID_W,
  STATIONS,
  applyUse,
  buildView,
  createKitchen,
  isBorder,
  stationById,
  tickKitchen,
  type Ing,
  type Item,
  type Kitchen,
  type KitchenView,
} from './overcookedKitchen'

/**
 * 廚房快手（Phase D，計畫見 .prompts/babylon-multiplayer-games.md §3.3）。
 *
 * 同步模型：Host Authority 全狀態制——
 * - 位置：ownership 20Hz + 插值（同 race/bomber）
 * - 廚房：host 持有 Kitchen，8Hz 廣播可序列化 view（snapshotSync），guest 取 latest 渲染
 * - 互動：guest 廣播 use intent（站點 id）→ host 驗證距離 + 手持物 × 站點狀態 → 套用；
 *   guest 永不直接改廚房狀態（兩人搶同格由 host 序列化天然解決）
 * - 合作計分：時限 2 分鐘，出餐得分、訂單逾期扣分，結算顯示團隊成績
 */

interface PlayerState {
  x: number
  z: number
}

const SIM_HZ = 30
const CELL = 2
const MOVE_SPEED = 5.5
const PLAYER_R = 0.5
const USE_RANGE = 2.6 // 玩家中心到站點格中心
const USE_COOLDOWN_MS = 200

const cellToWorld = (c: number, count: number): number => (c - (count - 1) / 2) * CELL
const worldToCell = (w: number, count: number): number => Math.round(w / CELL + (count - 1) / 2)

/** 室內出生點（依玩家序四角錯開） */
const SPAWNS: ReadonlyArray<readonly [number, number]> = [
  [2, 2],
  [GRID_W - 3, GRID_H - 3],
  [GRID_W - 3, 2],
  [2, GRID_H - 3],
]

const ING_NAME: Record<Ing, string> = { v: '蔬菜', m: '肉' }
const itemName = (it: Item): string =>
  it.kind === 'raw' ? `${ING_NAME[it.ing]}（生）` : it.kind === 'chop' ? `${ING_NAME[it.ing]}（已切）` : `${ING_NAME[it.ing]}湯`

class OvercookedScene implements GameModule {
  readonly gameId = 'overcooked'
  private ctx!: GameContext
  private keys = new Set<string>()
  private ticker!: FixedTicker
  private own!: OwnershipSync<PlayerState>
  private flow!: GameFlow
  private snapSender: HostSnapshotSender | null = null
  private snapReceiver: { buffer: SnapshotBuffer<KitchenView>; dispose(): void } | null = null

  /** host 專用：權威廚房狀態 */
  private kitchen!: Kitchen
  private state: PlayerState = { x: 0, z: 0 }
  private lastUse = 0
  private resultElapsed = 0

  private selfMesh?: Mesh
  private peerMeshes = new Map<string, Mesh>()
  private handMeshes = new Map<string, Mesh>() // playerId → 頭上手持物
  private slotMeshes = new Map<string, Mesh>() // 站點 id → 檯面物品
  private itemMats = new Map<string, StandardMaterial>()
  private camera!: ArcRotateCamera
  private hud!: TextPanel
  private banner!: TextPanel
  private ordersPanel!: TextPanel

  private onKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase()
    this.keys.add(key)
    if (key === ' ' || key === 'enter' || key === 'e') this.requestUse()
  }
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase())

  private colorFor(id: string): Color3 {
    let h = 0
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
    return Color3.FromHSV(h % 360, 0.7, 0.9)
  }

  private itemColor(it: Item): Color3 {
    if (it.kind === 'soup') return it.ing === 'v' ? new Color3(0.3, 0.62, 0.95) : new Color3(0.95, 0.6, 0.2)
    const base = it.ing === 'v' ? new Color3(0.2, 0.7, 0.3) : new Color3(0.85, 0.28, 0.28)
    return it.kind === 'chop' ? Color3.Lerp(base, Color3.White(), 0.4) : base
  }

  private itemMat(it: Item): StandardMaterial {
    const key = `${it.kind}-${it.ing}`
    let mat = this.itemMats.get(key)
    if (!mat) {
      mat = new StandardMaterial(`item-${key}`, this.ctx.scene)
      mat.diffuseColor = this.itemColor(it)
      this.itemMats.set(key, mat)
    }
    return mat
  }

  private makePlayer(id: string): Mesh {
    const m = MeshBuilder.CreateBox(`pl-${id}`, { width: 1, height: 1.2, depth: 1 }, this.ctx.scene)
    m.position.y = 0.6
    const mat = new StandardMaterial(`pl-mat-${id}`, this.ctx.scene)
    mat.diffuseColor = this.colorFor(id)
    m.material = mat
    return m
  }

  /** 玩家圓身 vs 外圈檯面碰撞 */
  private hitBlocked(px: number, pz: number): boolean {
    for (const ox of [-PLAYER_R, PLAYER_R]) {
      for (const oz of [-PLAYER_R, PLAYER_R]) {
        if (isBorder(worldToCell(px + ox, GRID_W), worldToCell(pz + oz, GRID_H))) return true
      }
    }
    return false
  }

  /** 目前渲染依據的廚房 view：host 直接建、guest 取快照 latest */
  private currentView(): KitchenView | null {
    if (this.ctx.role === 'host') return buildView(this.kitchen, performance.now())
    return this.snapReceiver?.buffer.latest() ?? null
  }

  // ---- 互動 intent ----

  /** 找玩家身邊最近的站點（範圍內） */
  private nearestStation(): string | null {
    let best: string | null = null
    let bestD = USE_RANGE
    for (const s of STATIONS) {
      const d = Math.hypot(
        cellToWorld(s.cx, GRID_W) - this.state.x,
        cellToWorld(s.cy, GRID_H) - this.state.z
      )
      if (d < bestD) {
        bestD = d
        best = s.id
      }
    }
    return best
  }

  private requestUse(): void {
    if (this.flow.state.phase !== 'playing') return
    const now = performance.now()
    if (now - this.lastUse < USE_COOLDOWN_MS) return
    this.lastUse = now
    const station = this.nearestStation()
    if (!station) return
    if (this.ctx.role === 'host') this.hostUse(this.ctx.selfId, station)
    else this.ctx.net.broadcast({ game: this.gameId, type: 'use', payload: { station } })
  }

  /** host：驗證距離後套用互動 */
  private hostUse(playerId: string, stationId: string): void {
    if (this.flow.state.phase !== 'playing') return
    const st = stationById(stationId)
    if (!st) return
    const pos = playerId === this.ctx.selfId ? this.state : this.own.latestRemote(playerId)
    if (!pos) return
    const d = Math.hypot(
      cellToWorld(st.cx, GRID_W) - pos.x,
      cellToWorld(st.cy, GRID_H) - pos.z
    )
    if (d > USE_RANGE + 0.6) return // 寬限：對端位置有傳輸延遲
    applyUse(this.kitchen, playerId, stationId, performance.now())
  }

  onNetworkMessage(from: string, msg: GameNetMessage): void {
    if (msg.game !== this.gameId) return
    if (msg.type === 'use' && this.ctx.role === 'host') {
      this.hostUse(from, (msg.payload as { station: string }).station)
    }
  }

  // ---- 生命週期 ----

  init(ctx: GameContext): void {
    this.ctx = ctx
    const { scene } = ctx

    this.camera = new ArcRotateCamera('cam', -Math.PI / 2, 0.5, 26, Vector3.Zero(), scene)
    new HemisphericLight('light', new Vector3(0.2, 1, 0.1), scene)

    // 地板
    const ground = MeshBuilder.CreateGround('ground', { width: GRID_W * CELL + 2, height: GRID_H * CELL + 2 }, scene)
    const gmat = new StandardMaterial('gmat', scene)
    gmat.diffuseColor = new Color3(0.75, 0.68, 0.55)
    ground.material = gmat

    // 站點底座（一圈檯面，依類型上色）
    const baseColors: Record<string, Color3> = {
      crate: new Color3(0.5, 0.36, 0.2),
      board: new Color3(0.85, 0.85, 0.8),
      pot: new Color3(0.25, 0.25, 0.3),
      serve: new Color3(0.9, 0.75, 0.2),
      counter: new Color3(0.55, 0.57, 0.6),
    }
    const baseMats = new Map<string, StandardMaterial>()
    for (const [kind, color] of Object.entries(baseColors)) {
      const m = new StandardMaterial(`st-${kind}`, scene)
      m.diffuseColor = color
      baseMats.set(kind, m)
    }
    for (const s of STATIONS) {
      const box = MeshBuilder.CreateBox(`st-${s.id}`, { width: CELL * 0.96, height: CELL * 0.6, depth: CELL * 0.96 }, scene)
      box.position = new Vector3(cellToWorld(s.cx, GRID_W), CELL * 0.3, cellToWorld(s.cy, GRID_H))
      box.material = baseMats.get(s.kind)!
      // crate 上放一顆固定示意物（該食材原色）
      if (s.kind === 'crate') {
        const top = MeshBuilder.CreateBox(`st-${s.id}-top`, { size: 0.7 }, scene)
        top.position = box.position.add(new Vector3(0, CELL * 0.45, 0))
        top.material = this.itemMat({ kind: 'raw', ing: s.ing! })
      }
      // 有存放格的站點：物品指示方塊（依 view 顯示/上色）
      if (s.kind === 'board' || s.kind === 'pot' || s.kind === 'counter') {
        const item = MeshBuilder.CreateBox(`slot-${s.id}`, { size: 0.7 }, scene)
        item.position = box.position.add(new Vector3(0, CELL * 0.45, 0))
        item.setEnabled(false)
        this.slotMeshes.set(s.id, item)
      }
    }

    this.selfMesh = this.makePlayer(ctx.selfId)
    this.hud = createTextPanel(scene, this.camera, 'hud', 5, 0.7, new Vector3(0, 2.6, 8))
    this.banner = createTextPanel(scene, this.camera, 'banner', 7, 4, new Vector3(0, 0.3, 8))
    this.ordersPanel = createTextPanel(scene, this.camera, 'orders', 3, 1.6, new Vector3(-3.4, 1.9, 8))

    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)

    this.kitchen = createKitchen(ctx.players.map((p) => p.id), performance.now())
    this.respawn()

    this.flow = createGameFlow({ net: ctx.net, game: this.gameId, role: ctx.role })
    this.flow.onChange((s) => {
      if (s.phase === 'countdown') this.respawn()
      if (s.phase === 'playing' && ctx.role === 'host') {
        // 開局重建廚房（roundEndAt 從現在起算）
        this.kitchen = createKitchen(ctx.players.map((p) => p.id), performance.now())
      }
      ;(window as unknown as Record<string, unknown>).__BATTLE_PHASE = s.phase
    })
    ;(window as unknown as Record<string, unknown>).__BATTLE_PHASE = this.flow.state.phase

    this.own = createOwnershipSync<PlayerState>({ net: ctx.net, game: this.gameId })
    this.own.start(() => ({ ...this.state }))

    if (ctx.role === 'host') {
      this.snapSender = createHostSnapshot<KitchenView>({
        net: ctx.net,
        game: this.gameId,
        hz: 8,
        getState: () => buildView(this.kitchen, performance.now()),
      })
      this.snapSender.start()
    } else {
      this.snapReceiver = createSnapshotReceiver<KitchenView>({ net: ctx.net, game: this.gameId })
    }

    this.ticker = createFixedTicker(SIM_HZ, (_t, stepMs) => this.simulate(stepMs / 1000))
    this.ticker.start()

    if (ctx.role === 'host') this.flow.startCountdown(3)
  }

  private respawn(): void {
    const idx = Math.max(0, this.ctx.players.findIndex((p) => p.id === this.ctx.selfId))
    const [cx, cy] = SPAWNS[idx % SPAWNS.length]
    this.state = { x: cellToWorld(cx, GRID_W), z: cellToWorld(cy, GRID_H) }
  }

  private simulate(dt: number): void {
    const playing = this.flow.state.phase === 'playing'

    if (playing) {
      const k = this.keys
      const dx = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0)
      const dz = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0)
      if (dx !== 0 || dz !== 0) {
        const step = (MOVE_SPEED * dt) / Math.hypot(dx, dz)
        const nx = this.state.x + dx * step
        if (!this.hitBlocked(nx, this.state.z)) this.state.x = nx
        const nz = this.state.z + dz * step
        if (!this.hitBlocked(this.state.x, nz)) this.state.z = nz
      }
    }

    // host：推進廚房（加工/訂單），時間到結算
    if (this.ctx.role === 'host' && playing) {
      const ended = tickKitchen(this.kitchen, performance.now(), Math.random)
      if (ended) {
        this.flow.endGame({ score: this.kitchen.score, delivered: this.kitchen.delivered })
      }
    }
  }

  /** 依 view 更新一個物品指示方塊 */
  private updateItemMesh(mesh: Mesh, item: Item | null, progress: number): void {
    if (!item) {
      mesh.setEnabled(false)
      return
    }
    mesh.setEnabled(true)
    mesh.material = this.itemMat(item)
    const s = 0.5 + 0.5 * progress // 加工中由小變大提示進度
    mesh.scaling.set(s, s, s)
  }

  update(deltaMs: number): void {
    const phase = this.flow.state.phase
    const view = this.currentView()

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
      this.handMeshes.get(id)?.dispose()
      this.handMeshes.delete(id)
      this.peerMeshes.delete(id)
    }
    for (const id of ids) {
      let m = this.peerMeshes.get(id)
      if (!m) {
        m = this.makePlayer(id)
        this.peerMeshes.set(id, m)
      }
      const s = this.own.sampleRemote(id)
      if (s) {
        m.position.x = s.a.x + (s.b.x - s.a.x) * s.alpha
        m.position.z = s.a.z + (s.b.z - s.a.z) * s.alpha
      }
    }

    if (view) {
      // 站點物品
      for (const sv of view.slots) {
        const mesh = this.slotMeshes.get(sv.id)
        if (mesh) this.updateItemMesh(mesh, sv.item, sv.progress)
      }
      // 手持物（自己 + 遠端，浮在頭上）
      const holders: Array<[string, Mesh | undefined]> = [
        [this.ctx.selfId, this.selfMesh],
        ...[...this.peerMeshes.entries()],
      ]
      for (const [pid, body] of holders) {
        if (!body) continue
        let hm = this.handMeshes.get(pid)
        if (!hm) {
          hm = MeshBuilder.CreateBox(`hand-${pid}`, { size: 0.5 }, this.ctx.scene)
          this.handMeshes.set(pid, hm)
        }
        const item = view.hands[pid] ?? null
        if (item) {
          hm.setEnabled(true)
          hm.material = this.itemMat(item)
          hm.position.set(body.position.x, 1.7, body.position.z)
        } else {
          hm.setEnabled(false)
        }
      }
    }

    // HUD / 訂單 / 橫幅
    if (phase === 'playing' && view) {
      const myItem = view.hands[this.ctx.selfId]
      const handNote = myItem ? `・手持 ${itemName(myItem)}` : ''
      this.hud.draw(`分數 ${view.score}・剩 ${Math.ceil(view.remainMs / 1000)}s${handNote}`, 44)
      const lines = view.orders.map((o, i) => `${i + 1}. ${ING_NAME[o.ing]}湯 ${Math.ceil(o.remainMs / 1000)}s`)
      this.ordersPanel.draw(lines.length ? ['📋 訂單', ...lines].join('\n') : '📋 訂單\n（暫無）', 36)
    } else {
      this.hud.draw('')
      this.ordersPanel.draw('')
    }

    if (phase === 'countdown') {
      const n = Math.ceil(this.flow.countdownRemaining() / 1000)
      this.banner.draw(n > 0 ? String(n) : 'GO!', 200)
    } else if (phase === 'result') {
      const r = (this.flow.state.result as { score: number; delivered: number } | undefined) ?? {
        score: 0,
        delivered: 0,
      }
      this.banner.draw(`🍲 時間到！\n團隊分數 ${r.score}\n出餐 ${r.delivered} 份`, 56)
      if (this.ctx.role === 'host') {
        this.resultElapsed += deltaMs
        if (this.resultElapsed > 10000) {
          this.resultElapsed = 0
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
      score: view?.score ?? 0,
    }
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    this.ticker.stop()
    this.own.stop()
    this.flow.dispose()
    this.snapSender?.stop()
    this.snapReceiver?.dispose()
    this.selfMesh?.dispose()
    for (const m of this.peerMeshes.values()) m.dispose()
    this.peerMeshes.clear()
    for (const m of this.handMeshes.values()) m.dispose()
    this.handMeshes.clear()
    for (const m of this.slotMeshes.values()) m.dispose()
    this.slotMeshes.clear()
    this.hud.dispose()
    this.banner.dispose()
    this.ordersPanel.dispose()
  }
}

export const createOvercookedScene = (): GameModule => new OvercookedScene()
