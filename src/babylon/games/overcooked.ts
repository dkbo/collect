import {
  ArcRotateCamera,
  Color3,
  Color4,
  DynamicTexture,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  ParticleSystem,
  StandardMaterial,
  Texture,
  Vector3,
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
  RECIPES,
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

interface Avatar {
  root: Mesh
  legL: Mesh
  legR: Mesh
  armL: Mesh
  armR: Mesh
  walkPhase: number
  amp: number
  yaw: number
  prevX: number
  prevZ: number
}

interface FloatingText {
  mesh: Mesh
  life: number
  vy: number
}

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

  private selfAvatar?: Avatar
  private peerAvatars = new Map<string, Avatar>()
  private handMeshes = new Map<string, Mesh>() // playerId → 頭上手持物
  private slotMeshes = new Map<string, Mesh>() // 站點 id → 檯面物品
  private itemMats = new Map<string, StandardMaterial>()
  private camera!: ArcRotateCamera
  private hud!: TextPanel
  private banner!: TextPanel
  private ordersPanel!: TextPanel
  private recipePanel!: TextPanel
  private floatingTexts: FloatingText[] = []

  private decorations: Mesh[] = []
  private steamSystems: ParticleSystem[] = []
  private sparkSystem: ParticleSystem | null = null

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

  private makePlayer(id: string): Avatar {
    const scene = this.ctx.scene
    const color = this.colorFor(id)

    const bodyMat = new StandardMaterial(`pl-mat-${id}`, scene)
    bodyMat.diffuseColor = color
    const limbMat = new StandardMaterial(`pl-limb-${id}`, scene)
    limbMat.diffuseColor = color.scale(0.55)
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

    const face = MeshBuilder.CreateBox(`pl-face-${id}`, { width: 0.5, height: 0.22, depth: 0.1 }, scene)
    face.material = faceMat
    face.parent = root
    face.position.set(0, 1.3, 0.33)

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

  private animateAvatar(av: Avatar, dtMs: number): void {
    const dx = av.root.position.x - av.prevX
    const dz = av.root.position.z - av.prevZ
    av.prevX = av.root.position.x
    av.prevZ = av.root.position.z

    const moving = Math.hypot(dx, dz) > dtMs * 0.0005
    if (moving) av.yaw = Math.atan2(dx, dz)
    av.root.rotation.y = av.yaw

    const ease = Math.min(1, dtMs * 0.012)
    av.amp += ((moving ? 1 : 0) - av.amp) * ease
    if (av.amp > 0.01) av.walkPhase += dtMs * 0.013

    const swing = Math.sin(av.walkPhase) * 0.7 * av.amp
    av.legL.rotation.x = swing
    av.legR.rotation.x = -swing
    av.armL.rotation.x = -swing
    av.armR.rotation.x = swing
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
    const changed = applyUse(this.kitchen, playerId, stationId, performance.now())
    if (changed && st.kind === 'serve') {
      const sparkPos = new Vector3(cellToWorld(st.cx, GRID_W), 1.5, cellToWorld(st.cy, GRID_H))
      this.triggerServeSpark(sparkPos)
      this.triggerScoreFloat(sparkPos, '+20')
    }
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

    this.buildDecorations()
    this.initParticles()

    this.selfAvatar = this.makePlayer(ctx.selfId)
    this.hud = createTextPanel(scene, this.camera, 'hud', 5, 0.7, new Vector3(0, 2.6, 8))
    this.banner = createTextPanel(scene, this.camera, 'banner', 7, 4, new Vector3(0, 0.3, 8))
    this.ordersPanel = createTextPanel(scene, this.camera, 'orders', 3, 1.6, new Vector3(-3.4, 1.9, 8))
    this.recipePanel = createTextPanel(scene, this.camera, 'recipes', 3, 2.2, new Vector3(3.4, 1.9, 8))

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
    if (this.selfAvatar) {
      this.selfAvatar.root.position.x = this.state.x
      this.selfAvatar.root.position.z = this.state.z
      this.animateAvatar(this.selfAvatar, deltaMs)
    }

    this.updateSteam()
    this.updateCamera()

    // 遠端：增刪 + 插值
    const ids = new Set(this.own.remoteIds())
    for (const [id, a] of this.peerAvatars) {
      if (ids.has(id)) continue
      a.root.dispose(false, true)
      this.handMeshes.get(id)?.dispose()
      this.handMeshes.delete(id)
      this.peerAvatars.delete(id)
    }
    for (const id of ids) {
      let a = this.peerAvatars.get(id)
      if (!a) {
        a = this.makePlayer(id)
        this.peerAvatars.set(id, a)
      }
      const s = this.own.sampleRemote(id)
      if (s) {
        a.root.position.x = s.a.x + (s.b.x - s.a.x) * s.alpha
        a.root.position.z = s.a.z + (s.b.z - s.a.z) * s.alpha
      }
      this.animateAvatar(a, deltaMs)
    }

    if (view) {
      // 站點物品
      for (const sv of view.slots) {
        const mesh = this.slotMeshes.get(sv.id)
        if (mesh) this.updateItemMesh(mesh, sv.item, sv.progress)
      }
      // 手持物（自己 + 遠端，浮在頭上）
      const holders: Array<[string, Avatar | undefined]> = [
        [this.ctx.selfId, this.selfAvatar],
        ...[...this.peerAvatars.entries()],
      ]
      for (const [pid, av] of holders) {
        if (!av) continue
        let hm = this.handMeshes.get(pid)
        if (!hm) {
          hm = MeshBuilder.CreateBox(`hand-${pid}`, { size: 0.5 }, this.ctx.scene)
          this.handMeshes.set(pid, hm)
        }
        const item = view.hands[pid] ?? null
        if (item) {
          hm.setEnabled(true)
          hm.material = this.itemMat(item)
          hm.position.set(av.root.position.x, 1.9, av.root.position.z)
        } else {
          hm.setEnabled(false)
        }
      }
    }

    // 飄字效果
    this.updateFloatingTexts(deltaMs)

    // HUD / 訂單 / 食譜 / 橫幅
    if (phase === 'playing' && view) {
      const myItem = view.hands[this.ctx.selfId]
      const handNote = myItem ? `・手持 ${itemName(myItem)}` : ''
      this.hud.draw(`分數 ${view.score}・剩 ${Math.ceil(view.remainMs / 1000)}s${handNote}`, 44)
      const lines = view.orders.map((o, i) => {
        const recipe = RECIPES.find((r) => r.id === o.recipeId)
        const name = recipe?.name ?? `${ING_NAME[o.ing]}湯`
        const remain = Math.ceil(o.remainMs / 1000)
        return `${i + 1}. ${name} ${remain}s`
      })
      this.ordersPanel.draw(lines.length ? ['📋 訂單', ...lines].join('\n') : '📋 訂單\n（暫無）', 36)
      // 食譜面板：顯示所有可用食譜
      const recipeLines = RECIPES.map((r) => {
        const steps = r.steps.map((st) => {
          if (st.type === 'chop' && st.ing) return `切${ING_NAME[st.ing]}`
          if (st.type === 'cook' && st.ing) return `煮${ING_NAME[st.ing]}`
          return `混合`
        }).join(' → ')
        return `${r.name}(${r.score})\n  ${steps}`
      })
      this.recipePanel.draw(['📖 食譜', ...recipeLines].join('\n'), 32)
    } else {
      this.hud.draw('')
      this.ordersPanel.draw('')
      this.recipePanel.draw('')
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

  // ---- 場地裝飾 ----

  private buildDecorations(): void {
    const { scene } = this.ctx
    const d = this.decorations
    const add = (m: Mesh) => { d.push(m); return m }

    // --- 地板磁磚 ---
    const tileLight = new StandardMaterial('tile-light', scene)
    tileLight.diffuseColor = new Color3(0.72, 0.7, 0.65)
    const tileDark = new StandardMaterial('tile-dark', scene)
    tileDark.diffuseColor = new Color3(0.65, 0.63, 0.58)
    for (let cy = 0; cy < GRID_H; cy++) {
      for (let cx = 0; cx < GRID_W; cx++) {
        if (isBorder(cx, cy)) continue
        const tile = add(MeshBuilder.CreateBox(`tile-${cx}-${cy}`, { width: CELL * 0.95, height: 0.02, depth: CELL * 0.95 }, scene))
        tile.position.set(cellToWorld(cx, GRID_W), 0.01, cellToWorld(cy, GRID_H))
        tile.material = (cx + cy) % 2 === 0 ? tileLight : tileDark
      }
    }

    // --- 四面牆壁 ---
    const wallMat = new StandardMaterial('wall-mat', scene)
    wallMat.diffuseColor = new Color3(0.82, 0.78, 0.7)
    const wallH = 2.5
    const wallThick = 0.3
    const gw = GRID_W * CELL
    const gh = GRID_H * CELL
    const walls = [
      { w: gw + wallThick * 2, h: wallH, d: wallThick, x: 0, z: -gh / 2 - wallThick / 2 },
      { w: gw + wallThick * 2, h: wallH, d: wallThick, x: 0, z: gh / 2 + wallThick / 2 },
      { w: wallThick, h: wallH, d: gh, x: -gw / 2 - wallThick / 2, z: 0 },
      { w: wallThick, h: wallH, d: gh, x: gw / 2 + wallThick / 2, z: 0 },
    ]
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i]
      const wall = add(MeshBuilder.CreateBox(`wall-${i}`, { width: w.w, height: w.h, depth: w.d }, scene))
      wall.position.set(w.x, w.h / 2, w.z)
      wall.material = wallMat
    }

    // --- 踢腳線 ---
    const baseMat = new StandardMaterial('base-mat', scene)
    baseMat.diffuseColor = new Color3(0.4, 0.38, 0.35)
    const baseH = 0.3
    const bases = [
      { w: gw + wallThick * 2, h: baseH, d: wallThick + 0.1, x: 0, z: -gh / 2 - wallThick / 2 },
      { w: gw + wallThick * 2, h: baseH, d: wallThick + 0.1, x: 0, z: gh / 2 + wallThick / 2 },
      { w: wallThick + 0.1, h: baseH, d: gh, x: -gw / 2 - wallThick / 2, z: 0 },
      { w: wallThick + 0.1, h: baseH, d: gh, x: gw / 2 + wallThick / 2, z: 0 },
    ]
    for (let i = 0; i < bases.length; i++) {
      const b = bases[i]
      const base = add(MeshBuilder.CreateBox(`base-${i}`, { width: b.w, height: b.h, depth: b.d }, scene))
      base.position.set(b.x, b.h / 2, b.z)
      base.material = baseMat
    }

    // --- 站點裝飾 ---
    const potMat = new StandardMaterial('pot-deco-mat', scene)
    potMat.diffuseColor = new Color3(0.18, 0.18, 0.22)
    const boardMat = new StandardMaterial('board-deco-mat', scene)
    boardMat.diffuseColor = new Color3(0.75, 0.6, 0.35)
    const bellMat = new StandardMaterial('bell-mat', scene)
    bellMat.diffuseColor = new Color3(0.9, 0.8, 0.2)

    for (const s of STATIONS) {
      const bx = cellToWorld(s.cx, GRID_W)
      const bz = cellToWorld(s.cy, GRID_H)
      if (s.kind === 'pot') {
        // 鍋子：扁圓柱
        const pot = add(MeshBuilder.CreateCylinder(`pot-${s.id}`, { height: 0.4, diameter: 1.2 }, scene))
        pot.position.set(bx, 1.2, bz)
        pot.material = potMat
        // 把手
        const handle = add(MeshBuilder.CreateBox(`pot-handle-${s.id}`, { width: 0.6, height: 0.1, depth: 0.15 }, scene))
        handle.position.set(bx + 0.8, 1.3, bz)
        handle.material = potMat
      } else if (s.kind === 'board') {
        // 砧板：扁長方體
        const board = add(MeshBuilder.CreateBox(`board-${s.id}`, { width: 1.2, height: 0.12, depth: 0.8 }, scene))
        board.position.set(bx, 1.15, bz)
        board.material = boardMat
        // 刀
        const knife = add(MeshBuilder.CreateBox(`knife-${s.id}`, { width: 0.08, height: 0.04, depth: 0.6 }, scene))
        knife.position.set(bx + 0.5, 1.25, bz)
        const knifeMat = new StandardMaterial(`knife-mat-${s.id}`, scene)
        knifeMat.diffuseColor = new Color3(0.7, 0.7, 0.72)
        knife.material = knifeMat
      } else if (s.kind === 'serve') {
        // 出餐口鈴鐺
        const bell = add(MeshBuilder.CreateSphere(`bell-${s.id}`, { diameter: 0.5 }, scene))
        bell.position.set(bx, 1.35, bz)
        bell.material = bellMat
        const bellBase = add(MeshBuilder.CreateBox(`bell-base-${s.id}`, { width: 0.6, height: 0.15, depth: 0.6 }, scene))
        bellBase.position.set(bx, 1.1, bz)
        bellBase.material = bellMat
      }
    }

    // --- 掛鉤架（上牆） ---
    const rackMat = new StandardMaterial('rack-mat', scene)
    rackMat.diffuseColor = new Color3(0.35, 0.3, 0.25)
    const rackY = 2.0
    // 上牆掛架
    const rack1 = add(MeshBuilder.CreateBox('rack-top', { width: 6, height: 0.1, depth: 0.15 }, scene))
    rack1.position.set(0, rackY, -gh / 2 - 0.1)
    rack1.material = rackMat
    // 掛鉤
    for (let i = -2; i <= 2; i++) {
      const hook = add(MeshBuilder.CreateCylinder(`hook-${i}`, { height: 0.3, diameter: 0.06 }, scene))
      hook.position.set(i * 1.2, rackY - 0.2, -gh / 2 - 0.1)
      hook.material = rackMat
    }

    // --- 時鐘（左牆） ---
    const clockMat = new StandardMaterial('clock-mat', scene)
    clockMat.diffuseColor = new Color3(0.9, 0.88, 0.85)
    const clock = add(MeshBuilder.CreateCylinder('clock', { height: 0.1, diameter: 1.0 }, scene))
    clock.position.set(-gw / 2 - 0.2, 2.0, 0)
    clock.rotation.z = Math.PI / 2
    clock.material = clockMat
    const clockRim = add(MeshBuilder.CreateTorus('clock-rim', { diameter: 1.0, thickness: 0.08, tessellation: 32 }, scene))
    clockRim.position.set(-gw / 2 - 0.15, 2.0, 0)
    clockRim.rotation.z = Math.PI / 2
    const rimMat = new StandardMaterial('clock-rim-mat', scene)
    rimMat.diffuseColor = new Color3(0.3, 0.3, 0.3)
    clockRim.material = rimMat
  }

  private initParticles(): void {
    const { scene } = this.ctx

    // 蒸汽粒子材質（共用）
    const steamTex = new Texture('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', scene)

    // 為每個 pot 站點建立蒸汽系統
    for (const s of STATIONS) {
      if (s.kind !== 'pot') continue
      const ps = new ParticleSystem(`steam-${s.id}`, 15, scene)
      ps.particleTexture = steamTex
      ps.emitter = new Vector3(cellToWorld(s.cx, GRID_W), 1.6, cellToWorld(s.cy, GRID_H))
      ps.minEmitBox = new Vector3(-0.3, 0, -0.3)
      ps.maxEmitBox = new Vector3(0.3, 0, 0.3)
      ps.color1 = new Color4(0.9, 0.9, 0.95, 1)
      ps.color2 = new Color4(0.8, 0.8, 0.85, 1)
      ps.colorDead = new Color4(0.7, 0.7, 0.75, 0)
      ps.minSize = 0.15
      ps.maxSize = 0.4
      ps.minLifeTime = 0.5
      ps.maxLifeTime = 1.2
      ps.emitRate = 0
      ps.direction1 = new Vector3(-0.2, 1, -0.2)
      ps.direction2 = new Vector3(0.2, 1.5, 0.2)
      ps.minEmitPower = 0.3
      ps.maxEmitPower = 0.6
      ps.updateSpeed = 0.01
      ps.gravity = new Vector3(0, 0.2, 0)
      ps.blendMode = ParticleSystem.BLENDMODE_STANDARD
      ps.start()
      this.steamSystems.push(ps)
    }

    // 出餐閃光
    this.sparkSystem = new ParticleSystem('spark', 30, scene)
    this.sparkSystem.particleTexture = steamTex
    this.sparkSystem.minEmitBox = new Vector3(-0.3, 0, -0.3)
    this.sparkSystem.maxEmitBox = new Vector3(0.3, 0, 0.3)
    this.sparkSystem.color1 = new Color4(1, 0.9, 0.2, 1)
    this.sparkSystem.color2 = new Color4(1, 0.7, 0.1, 1)
    this.sparkSystem.colorDead = new Color4(1, 0.5, 0, 0)
    this.sparkSystem.minSize = 0.1
    this.sparkSystem.maxSize = 0.25
    this.sparkSystem.minLifeTime = 0.3
    this.sparkSystem.maxLifeTime = 0.6
    this.sparkSystem.emitRate = 0
    this.sparkSystem.direction1 = new Vector3(-1, 2, -1)
    this.sparkSystem.direction2 = new Vector3(1, 3, 1)
    this.sparkSystem.minEmitPower = 1
    this.sparkSystem.maxEmitPower = 2
    this.sparkSystem.updateSpeed = 0.01
    this.sparkSystem.gravity = new Vector3(0, -3, 0)
    this.sparkSystem.blendMode = ParticleSystem.BLENDMODE_STANDARD
    this.sparkSystem.start()
  }

  private updateSteam(): void {
    const view = this.currentView()
    if (!view) return
    let si = 0
    for (const s of STATIONS) {
      if (s.kind !== 'pot') continue
      const ps = this.steamSystems[si++]
      if (!ps) continue
      const sv = view.slots.find((sl) => sl.id === s.id)
      const cooking = sv?.item != null && sv.progress < 1
      ps.emitRate = cooking ? 12 : 0
    }
  }

  private triggerServeSpark(pos: Vector3): void {
    if (!this.sparkSystem) return
    this.sparkSystem.emitter = pos.clone()
    this.sparkSystem.emitRate = 60
    setTimeout(() => { if (this.sparkSystem) this.sparkSystem.emitRate = 0 }, 300)
  }

  private updateFloatingTexts(dt: number): void {
    const dtSec = dt * 0.001
    this.floatingTexts = this.floatingTexts.filter((ft) => {
      ft.life -= dtSec
      ft.mesh.position.y += ft.vy * dtSec
      ft.vy -= 2 * dtSec
      if (ft.life <= 0) {
        ft.mesh.dispose()
        return false
      }
      return true
    })
  }

  private triggerScoreFloat(pos: Vector3, text: string): void {
    const scene = this.ctx.scene
    const plane = MeshBuilder.CreatePlane(`float-${Date.now()}`, { width: 2, height: 0.6 }, scene)
    plane.position = pos.add(new Vector3(0, 2.2, 0))
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL
    const dt = new DynamicTexture(`float-tex-${Date.now()}`, { width: 256, height: 64 }, scene, false)
    const ctx2d = dt.getContext() as CanvasRenderingContext2D
    ctx2d.fillStyle = '#fbbf24'
    ctx2d.font = 'bold 40px sans-serif'
    ctx2d.textAlign = 'center'
    ctx2d.fillText(text, 128, 48)
    dt.update()
    const mat = new StandardMaterial(`float-mat-${Date.now()}`, scene)
    mat.diffuseTexture = dt
    mat.emissiveColor = new Color3(1, 0.85, 0.2)
    mat.disableLighting = true
    mat.backFaceCulling = false
    plane.material = mat
    this.floatingTexts.push({ mesh: plane, life: 1.2, vy: 1.5 })
  }

  private updateCamera(): void {
    let cx = this.state.x
    let cz = this.state.z
    let count = 1
    for (const [, a] of this.peerAvatars) {
      cx += a.root.position.x
      cz += a.root.position.z
      count++
    }
    cx /= count
    cz /= count
    const t = this.camera.target
    const lerp = 0.03
    t.x += (cx - t.x) * lerp
    t.z += (cz - t.z) * lerp
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    this.ticker.stop()
    this.own.stop()
    this.flow.dispose()
    this.snapSender?.stop()
    this.snapReceiver?.dispose()
    this.selfAvatar?.root.dispose(false, true)
    for (const a of this.peerAvatars.values()) a.root.dispose(false, true)
    this.peerAvatars.clear()
    for (const m of this.handMeshes.values()) m.dispose()
    this.handMeshes.clear()
    for (const m of this.slotMeshes.values()) m.dispose()
    this.slotMeshes.clear()
    for (const ft of this.floatingTexts) ft.mesh.dispose()
    this.floatingTexts = []
    this.hud.dispose()
    this.banner.dispose()
    this.ordersPanel.dispose()
    this.recipePanel.dispose()
    for (const m of this.decorations) m.dispose()
    this.decorations = []
    for (const ps of this.steamSystems) ps.dispose()
    this.steamSystems = []
    this.sparkSystem?.dispose()
    this.sparkSystem = null
  }
}

export const createOvercookedScene = (): GameModule => new OvercookedScene()
