import {
  ArcRotateCamera,
  Color3,
  Color4,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  ParticleSystem,
  Quaternion,
  SceneInstrumentation,
  StandardMaterial,
  Texture,
  Vector3,
} from '@/babylon/babylonCore'
import type { GameContext, GameModule } from '@/babylon/types'
import type { GameNetMessage } from '@/core/webrtc'
import { attachFlowAudio, playSfx, stopAllAudio } from '@/babylon/audio'
import { createCountdownPanel, createTextPanel, type TextPanel } from '@/babylon/hud'
import {
  createFixedTicker,
  createGameFlow,
  createHostSnapshot,
  createOwnershipSync,
  createSnapshotReceiver,
  isObj,
  isStr,
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
} from '@/babylon/games/overcookedKitchen'
import { OUTLINE } from '@/babylon/fx/palette'
import { AvatarKit, buildAvatar, disposeAvatar, poseAvatar, type ToyAvatar } from '@/babylon/fx/avatar'
import { ToyLook } from '@/babylon/fx/look'
import { perfLogLine } from '@/babylon/fx/perfLog'
import { uprightAxis } from '@/babylon/fx/upright'
import { colorIndexIn } from '@/babylon/games/kitchenFx/players'
import { KITCHEN_AVATAR } from '@/babylon/games/kitchenFx/chef'
import { KitchenBoard } from '@/babylon/games/kitchenFx/board'
import { chefArms, chopTarget, kitchenCellZ, kitchenZ, ITEM_KEYS, type BoardSpot } from '@/babylon/games/kitchenFx/pose'

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

const PERF_LOG_MS = 2000
const UPRIGHT_BACK_TILT = 0.35 // 角色往後仰（遠離相機）的弧度，同 bomber：高俯角下頭才不會整個蓋住身體
/** 手持物在身體座標（未乘 AVATAR_SCALE）的位置：胸前雙手之間（spec §4：y ≈ 1.0、往前 0.45） */
const HOLD_LOCAL = new Vector3(0, 0.52, 0.36)

// 渲染座標：cx 往 +x；cy=0（食材箱／出餐口排）在遠側 +z、靠背牆（kitchenFx/pose）。各端同一份函式，位置同步不受影響
const toX = (cx: number): number => (cx - (GRID_W - 1) / 2) * CELL
const toZ = (cy: number): number => kitchenZ(cy, GRID_H, CELL)
const cellX = (x: number): number => Math.round(x / CELL + (GRID_W - 1) / 2)
const cellZ = (z: number): number => kitchenCellZ(z, GRID_H, CELL)

/** 室內出生點（依玩家序四角錯開） */
const SPAWNS: ReadonlyArray<readonly [number, number]> = [
  [2, 2],
  [GRID_W - 3, GRID_H - 3],
  [GRID_W - 3, 2],
  [2, GRID_H - 3],
]

const ING_NAME: Record<Ing, string> = { v: '蔬菜', m: '肉' }
const itemName = (it: Item): string =>
  it.kind === 'raw' ? `${ING_NAME[it.ing]}（生）` : it.kind === 'chop' ? `${ING_NAME[it.ing]}（已切）` : it.kind === 'burnt' ? `${ING_NAME[it.ing]}（焦了）` : `${ING_NAME[it.ing]}湯`

interface Avatar {
  root: Mesh
  toy: ToyAvatar
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
  /** 上一幀 view（diff 觸發音效；host/guest 同一機制） */
  private prevView: KitchenView | null = null

  private selfAvatar?: Avatar
  private peerAvatars = new Map<string, Avatar>()
  private camera!: ArcRotateCamera
  private look!: ToyLook
  private board!: KitchenBoard
  private avatarKit!: AvatarKit
  private instr: SceneInstrumentation | null = null
  private lastPerfLog = 0
  /** ?kitchenPerfFill=1：只在畫面上把所有存放格與自己手上填滿物品（AC9 量 N1 用，不動廚房狀態） */
  private perfFill = false
  private hud!: TextPanel
  private banner!: TextPanel
  private ordersPanel!: TextPanel
  private recipePanel!: TextPanel
  private floatingTexts: FloatingText[] = []

  private steamSystems: ParticleSystem[] = []
  private sparkSystem: ParticleSystem | null = null

  private onKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase()
    this.keys.add(key)
    if (key === ' ' || key === 'enter' || key === 'e') this.requestUse()
  }
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase())


  /** 建立廚師角色（fx/avatar 合併 mesh，廚師帽＋圍裙）；顏色依 ctx.players 序號 */
  private makePlayer(id: string): Avatar {
    const toy = buildAvatar(this.ctx.scene, this.avatarKit, id, colorIndexIn(this.ctx.players, id), {
      isAI: false,
      isSelf: id === this.ctx.selfId,
    })
    // 光影登記：投影＋描邊
    this.look.caster(toy.body)
    this.look.outline(toy.body)
    // 開局面向鏡頭（−Z），與方向稿一致；之後依移動方向更新
    toy.body.rotation.y = Math.PI
    return { root: toy.root, toy, walkPhase: 0, amp: 0, yaw: Math.PI, prevX: 0, prevZ: 0 }
  }

  /** 走路擺動與面向；站在加工中的砧板旁（且停著）時面向砧板砍菜，手上有東西時雙手捧在胸前 */
  private animateAvatar(av: Avatar, dtMs: number, now: number, holding: boolean, boards: readonly BoardSpot[]): void {
    const dx = av.root.position.x - av.prevX
    const dz = av.root.position.z - av.prevZ
    av.prevX = av.root.position.x
    av.prevZ = av.root.position.z
    // 一幀跨超過一格＝出生／重生瞬移，不當成走路
    if (Math.hypot(dx, dz) > CELL) return

    const moving = Math.hypot(dx, dz) > dtMs * 0.0005
    if (moving) av.yaw = Math.atan2(dx, dz)
    const chop = moving ? null : chopTarget(av.root.position.x, av.root.position.z, boards, USE_RANGE)
    if (chop) av.yaw = Math.atan2(chop.x - av.root.position.x, chop.z - av.root.position.z)
    av.toy.body.rotation.y = av.yaw

    const ease = Math.min(1, dtMs * 0.012)
    av.amp += ((moving ? 1 : 0) - av.amp) * ease
    if (av.amp > 0.01) av.walkPhase += dtMs * 0.013

    const swing = Math.sin(av.walkPhase) * 0.7 * av.amp
    poseAvatar(av.toy, swing, chefArms({ swing, holding, chopping: chop !== null, tMs: now }))
  }

  /** 抵銷俯角透視：依角色位置微傾 root，讓身體在畫面上直立（同 bomber；相機不動）。
   *  「你」標記是 billboard，父節點的旋轉不會套到它的位置上，這裡手動轉。 */
  private leanUpright(av: Avatar, cam: Vector3, camUp: Vector3): void {
    const p = av.root.position
    const [x, y, z] = uprightAxis([p.x, 0, p.z], [cam.x, cam.y, cam.z], [camUp.x, camUp.y, camUp.z], {
      backTilt: UPRIGHT_BACK_TILT,
    })
    const q = (av.root.rotationQuaternion ??= new Quaternion())
    Quaternion.FromUnitVectorsToRef(Vector3.UpReadOnly, new Vector3(x, y, z), q)
    const m = av.toy.marker
    if (!m) return
    let base = this.billboardBase.get(m)
    if (!base) {
      base = m.position.clone()
      this.billboardBase.set(m, base)
    }
    base.rotateByQuaternionToRef(q, m.position)
  }
  private billboardBase = new WeakMap<Mesh, Vector3>()

  /** 手持物：放在角色胸前雙手之間（跟著面向與俯角補償） */
  private placeHand(pid: string, av: Avatar, item: Item | null): void {
    if (!item) {
      this.board.removeHand(pid)
      return
    }
    av.root.computeWorldMatrix(true)
    const wm = av.toy.body.computeWorldMatrix(true)
    const p = Vector3.TransformCoordinates(HOLD_LOCAL, wm)
    this.board.setHand(pid, item, { x: p.x, y: p.y, z: p.z, yaw: av.yaw })
  }

  /** 玩家圓身 vs 外圈檯面碰撞 */
  private hitBlocked(px: number, pz: number): boolean {
    for (const ox of [-PLAYER_R, PLAYER_R]) {
      for (const oz of [-PLAYER_R, PLAYER_R]) {
        if (isBorder(cellX(px + ox), cellZ(pz + oz))) return true
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
      const d = Math.hypot(toX(s.cx) - this.state.x, toZ(s.cy) - this.state.z)
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
    const d = Math.hypot(toX(st.cx) - pos.x, toZ(st.cy) - pos.z)
    if (d > USE_RANGE + 0.6) return // 寬限：對端位置有傳輸延遲
    const changed = applyUse(this.kitchen, playerId, stationId, performance.now())
    if (changed && st.kind === 'serve') {
      const sparkPos = new Vector3(toX(st.cx), 1.5, toZ(st.cy))
      this.triggerServeSpark(sparkPos)
      this.triggerScoreFloat(sparkPos, '+20')
    }
  }

  onNetworkMessage(from: string, msg: GameNetMessage): void {
    if (msg.game !== this.gameId) return
    // 'use' 是 guest → host 的唯一上行請求：驗來源為本局玩家、payload 為合法字串
    // （站點是否存在、距離是否夠近由 hostUse 再驗一次）。
    // 廚房狀態（'snap'）只信任房主，由 createSnapshotReceiver 的 hostId 過濾。
    if (msg.type !== 'use' || this.ctx.role !== 'host') return
    if (!this.ctx.players.some((pl) => pl.id === from)) return
    const p = msg.payload
    if (!isObj(p) || !isStr(p.station)) return
    this.hostUse(from, p.station)
  }

  // ---- 生命週期 ----

  init(ctx: GameContext): void {
    this.ctx = ctx
    const { scene } = ctx

    this.camera = new ArcRotateCamera('cam', -Math.PI / 2, 0.5, 26, Vector3.Zero(), scene)
    // 光影與後製（AC5／AC8）：雙光、陰影、Glow 白名單、描邊、後製、解析度與檔位；log 前綴與網址參數都是 kitchen
    const halfDiag = Math.hypot(GRID_W * CELL, GRID_H * CELL) / 2
    this.look = new ToyLook(scene, this.camera, { shadowRadius: halfDiag + 2, tag: 'kitchen', outline: OUTLINE })

    // 場景物件（A「Toy Kitchen」）：地面、牆、檯面、站點、物品（kitchenFx/board）
    this.board = new KitchenBoard(scene, {
      gridW: GRID_W,
      gridH: GRID_H,
      cell: CELL,
      stations: STATIONS,
      toWorld: (cx, cy) => ({ x: toX(cx), z: toZ(cy) }),
    })
    this.avatarKit = new AvatarKit(scene, KITCHEN_AVATAR)
    const fx = this.board.fxTargets()
    this.look.toon(...fx.toon, this.avatarKit.bodyMat)
    this.look.receiver(...fx.receivers)
    this.look.caster(...fx.casters)
    this.look.outline(...fx.outlined)
    for (const g of fx.glow) this.look.glowMesh(g.mesh, g.color, g.strength)
    // AC9：draw calls 量測（每 PERF_LOG_MS 印一次）
    this.instr = new SceneInstrumentation(scene)
    this.perfFill = typeof window !== 'undefined' && /[?&]kitchenPerfFill=1\b/.test(window.location.search + window.location.hash)

    this.initParticles()

    this.selfAvatar = this.makePlayer(ctx.selfId)
    this.hud = createTextPanel(scene, this.camera, 'hud', 5, 0.7, new Vector3(0, 2.6, 8))
    this.banner = createCountdownPanel(scene, this.camera, 'banner', 7, 4, new Vector3(0, 0.3, 8))
    this.ordersPanel = createTextPanel(scene, this.camera, 'orders', 3, 1.6, new Vector3(-3.4, 1.9, 8))
    this.recipePanel = createTextPanel(scene, this.camera, 'recipes', 3, 2.2, new Vector3(3.4, 1.9, 8))

    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)

    this.kitchen = createKitchen(ctx.players.map((p) => p.id), performance.now())
    this.respawn()

    this.flow = createGameFlow({ net: ctx.net, game: this.gameId, role: ctx.role, hostId: ctx.hostId })
    attachFlowAudio(this.flow, 'overcooked', { resultSfx: () => 'round_end' })
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
      this.snapReceiver = createSnapshotReceiver<KitchenView>({ net: ctx.net, game: this.gameId, hostId: ctx.hostId })
    }

    this.ticker = createFixedTicker(SIM_HZ, (_t, stepMs) => this.simulate(stepMs / 1000))
    this.ticker.start()

    if (ctx.role === 'host') this.flow.startCountdown(3)
  }

  private respawn(): void {
    const idx = Math.max(0, this.ctx.players.findIndex((p) => p.id === this.ctx.selfId))
    const [cx, cy] = SPAWNS[idx % SPAWNS.length]
    this.state = { x: toX(cx), z: toZ(cy) }
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

  /** view diff → 音效：廚房事件不掛純邏輯層（guest 只有快照），改比對前後 view */
  private diffViewAudio(view: KitchenView | null): void {
    const prev = this.prevView
    this.prevView = view
    if (!prev || !view) return
    if (view.delivered > prev.delivered) playSfx('serve')
    if (view.orders.length > prev.orders.length) playSfx('order_new')
    else if (view.orders.length < prev.orders.length && view.delivered === prev.delivered) playSfx('order_fail')
    const prevItems = new Map(prev.slots.map((s) => [s.id, s.item?.kind ?? null]))
    for (const sv of view.slots) {
      const a = prevItems.get(sv.id) ?? null
      const b = sv.item?.kind ?? null
      if (a === b) continue
      if (sv.id.startsWith('board') && b === 'raw') playSfx('chop')
      else if (sv.id.startsWith('pot') && a === 'chop' && b === 'soup') playSfx('cook_done')
      else if (sv.id.startsWith('pot') && b === 'burnt') playSfx('burnt')
    }
    const hadItem = prev.hands[this.ctx.selfId] != null
    if (!hadItem && view.hands[this.ctx.selfId] != null) playSfx('pickup')
  }

  update(deltaMs: number): void {
    const phase = this.flow.state.phase
    const view = this.currentView()

    if (phase === 'playing') this.diffViewAudio(view)
    else this.prevView = view // 非對局中（重開新局等）只同步基準，不發音

    const now = performance.now()
    const shown = this.perfFill && view ? this.fillView(view) : view
    // 加工中的砧板（旁邊的人播砍菜動作）
    const boards: BoardSpot[] = []
    for (const sv of shown?.slots ?? []) {
      const st = stationById(sv.id)
      if (st?.kind === 'board') boards.push({ x: toX(st.cx), z: toZ(st.cy), chopping: sv.item?.kind === 'raw' && sv.progress < 1 })
    }
    const holding = (id: string): boolean => (shown?.hands[id] ?? null) !== null

    // 自己
    if (this.selfAvatar) {
      this.selfAvatar.root.position.x = this.state.x
      this.selfAvatar.root.position.z = this.state.z
      this.animateAvatar(this.selfAvatar, deltaMs, now, holding(this.ctx.selfId), boards)
    }

    this.updateSteam()
    this.updateCamera()

    // 遠端：增刪 + 插值
    const ids = new Set(this.own.remoteIds())
    for (const [id, a] of this.peerAvatars) {
      if (ids.has(id)) continue
      disposeAvatar(a.toy)
      this.board.removeHand(id)
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
      this.animateAvatar(a, deltaMs, now, holding(id), boards)
    }

    // 俯角透視補償：每隻角色依位置微傾
    const camPos = this.camera.position
    const camUp = this.camera.getDirection(Vector3.Up())
    const holders: Array<[string, Avatar | undefined]> = [[this.ctx.selfId, this.selfAvatar], ...this.peerAvatars.entries()]
    for (const [, av] of holders) if (av) this.leanUpright(av, camPos, camUp)

    if (shown) {
      // 站點物品（檯面／砧板放實例、鍋換湯面）
      for (const sv of shown.slots) {
        const st = stationById(sv.id)
        if (st) this.board.setSlot(st, sv.item)
      }
      // 手持物（胸前雙手之間）
      for (const [pid, av] of holders) if (av) this.placeHand(pid, av, shown.hands[pid] ?? null)
    }
    this.board.update()
    this.look.update(deltaMs)

    // AC9：每 2 秒印 draw calls 與 fps（讀上一幀的完整計數；還沒渲染過的首次取樣不印）
    if (this.instr && now - this.lastPerfLog >= PERF_LOG_MS) {
      this.lastPerfLog = now
      const line = perfLogLine(this.instr.drawCallsCounter.current, this.ctx.scene.getEngine().getFps(), 'kitchen')
      if (line) console.info(line)
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

  /** ?kitchenPerfFill=1：畫面上把每個存放格都填上物品（8 種輪流）、自己手上拿湯（量 N1 的固定條件） */
  private fillView(view: KitchenView): KitchenView {
    let i = 0
    const slots = view.slots.map((sv) => {
      const [kind, ing] = ITEM_KEYS[i++ % ITEM_KEYS.length].split('-') as [Item['kind'], Ing]
      const st = stationById(sv.id)
      const item: Item = st?.kind === 'board' ? { kind: 'raw', ing } : st?.kind === 'pot' ? { kind: 'soup', ing } : { kind, ing }
      return { ...sv, item, progress: st?.kind === 'counter' ? 1 : 0.5 }
    })
    return { ...view, slots, hands: { ...view.hands, [this.ctx.selfId]: { kind: 'soup', ing: 'v' } } }
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
      ps.emitter = new Vector3(toX(s.cx), 2.1, toZ(s.cy))
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
    stopAllAudio()
    this.ticker.stop()
    this.own.stop()
    this.flow.dispose()
    this.snapSender?.stop()
    this.snapReceiver?.dispose()
    if (this.selfAvatar) disposeAvatar(this.selfAvatar.toy)
    for (const a of this.peerAvatars.values()) disposeAvatar(a.toy)
    this.peerAvatars.clear()
    this.board.dispose()
    this.avatarKit.dispose()
    this.instr?.dispose()
    this.instr = null
    for (const ft of this.floatingTexts) ft.mesh.dispose()
    this.floatingTexts = []
    this.hud.dispose()
    this.banner.dispose()
    this.ordersPanel.dispose()
    this.recipePanel.dispose()
    for (const ps of this.steamSystems) ps.dispose()
    this.steamSystems = []
    this.sparkSystem?.dispose()
    this.sparkSystem = null
    this.look.dispose()
  }
}

export const createOvercookedScene = (): GameModule => new OvercookedScene()
