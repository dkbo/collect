import { ArcRotateCamera, Color4, Quaternion, SceneInstrumentation, Vector3, type Mesh } from '@/babylon/babylonCore'
import type { GameContext, GameModule, GameOverlay, KitchenHud } from '@/babylon/types'
import type { GameNetMessage } from '@/core/webrtc'
import { attachFlowAudio, playSfx, stopAllAudio } from '@/babylon/audio'
import { createCountdownPanel, type TextPanel } from '@/babylon/hud'
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
  SCORE_SERVE,
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
  type SlotView,
  type StationDef,
} from '@/babylon/games/overcookedKitchen'
import { hexToRgb, OUTLINE } from '@/babylon/fx/palette'
import { COUNTDOWN_THEME } from '@/babylon/fx/countdown'
import { AvatarKit, buildAvatar, disposeAvatar, poseAvatar, type ToyAvatar } from '@/babylon/fx/avatar'
import { ToyLook, UI_LAYER } from '@/babylon/fx/look'
import { perfLogLine } from '@/babylon/fx/perfLog'
import { uprightAxis } from '@/babylon/fx/upright'
import { colorIndexIn } from '@/babylon/games/kitchenFx/players'
import { KITCHEN_AVATAR } from '@/babylon/games/kitchenFx/chef'
import { KitchenBoard } from '@/babylon/games/kitchenFx/board'
import { chefArms, chopTarget, kitchenCellZ, kitchenZ, ITEM_KEYS, type BoardSpot } from '@/babylon/games/kitchenFx/pose'
import { counterTop } from '@/babylon/games/kitchenFx/board'
import { KitchenFx } from '@/babylon/games/kitchenFx/effects'
import {
  arcPoint,
  boardPhase,
  extrapolateProgress,
  potPhase,
  slotEvents,
  type P3,
} from '@/babylon/games/kitchenFx/effectsModel'
import { trackOrders, type OrderTrack } from '@/babylon/games/kitchenFx/orders'
import { buildKitchenHud, handFlights, idleKitchenHud } from '@/babylon/games/kitchenFx/hudModel'
import { KITCHEN } from '@/babylon/games/kitchenFx/palette'

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
/** 後製曝光：奶油地面＋白鋼檯面整片淺色，照 bomber 的 1.05 在 ACES 下會發灰，提高到接近稿的亮度（白色不爆） */
const KITCHEN_EXPOSURE = 1.3
const KITCHEN_CONTRAST = 1.2
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

/** 拾取／放下弧線（spec §7：180ms） */
const FLIGHT_MS = 180
const FLIGHT_ARC = 0.7

interface Avatar {
  root: Mesh
  toy: ToyAvatar
  walkPhase: number
  amp: number
  yaw: number
  prevX: number
  prevZ: number
}

/** 飛行中的物品：key 是目的地（hand:<pid> 或 slot:<站點 id>） */
interface Flight {
  from: P3
  start: number
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
  private banner!: TextPanel
  private fx!: KitchenFx
  private flights = new Map<string, Flight>()
  /** 上一幀特效比對用的 view（與音效的 prevView 分開：非對局中也要追） */
  private fxView: KitchenView | null = null
  /** guest：最新快照與收到的時間（進度外插用） */
  private snapSeen: KitchenView | null = null
  private snapAt = 0
  /** React HUD：訂單 id 追蹤、上一張 HUD（結算時凍結）、結算覆蓋層 */
  private orderTrack: OrderTrack | null = null
  private lastHud: KitchenHud | null = null
  private overlayKey = ''

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

  /** 手持物：放在角色胸前雙手之間；剛拾取的沿弧線從站點飛過來；焦掉的東西冒一縷細黑煙 */
  private placeHand(pid: string, av: Avatar, item: Item | null, now: number, dtMs: number): void {
    const key = `hand:${pid}`
    if (!item) {
      this.flights.delete(key)
      this.board.removeHand(pid)
      return
    }
    const p = this.holdPoint(av)
    const fly = this.flightPose(key, p, now, false)
    this.board.setHand(pid, item, { ...(fly ?? p), yaw: av.yaw })
    if (item.kind === 'burnt') this.fx.wisp(key, p.x, p.y + 0.4, p.z, dtMs)
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
    // 出餐等特效改由前後 view 的差異觸發（host 與 guest 一致），這裡只套規則
    applyUse(this.kitchen, playerId, stationId, performance.now())
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
    this.look = new ToyLook(scene, this.camera, {
      shadowRadius: halfDiag + 2,
      tag: 'kitchen',
      outline: OUTLINE,
      exposure: KITCHEN_EXPOSURE,
      contrast: KITCHEN_CONTRAST,
    })

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
    // 場外底色（variant-A-gameplay 的深青；延伸地面在 board）
    const [cr, cg, cb] = hexToRgb(KITCHEN.clear)
    scene.clearColor = new Color4(cr, cg, cb, 1)
    // AC6：特效（粒子上限依檔位）
    this.fx = new KitchenFx(
      scene,
      { cell: CELL, top: counterTop(CELL), cap: this.look.settings.particleCap, scoreText: `+${SCORE_SERVE}` },
      {
        squashBoard: (id, sy) => this.board.squashBoard(id, sy),
        setPotAlarm: (id, on, level) => this.board.setPotAlarm(id, on, level),
        potAlarmMesh: (id) => this.board.potAlarmMesh(id),
        glow: (mesh, hex, strength) => this.look.setGlow(mesh, hex, strength),
      }
    )
    for (const s of STATIONS) {
      if (s.kind === 'board') this.fx.addBoard(s.id, toX(s.cx), toZ(s.cy))
      else if (s.kind === 'pot') this.fx.addPot(s.id, toX(s.cx), toZ(s.cy))
      else if (s.kind === 'serve') this.fx.setServe(toX(s.cx), toZ(s.cy), this.board.bellMesh)
    }
    // AC9：draw calls 量測（每 PERF_LOG_MS 印一次）
    this.instr = new SceneInstrumentation(scene)
    this.perfFill = typeof window !== 'undefined' && /[?&]kitchenPerfFill=1\b/.test(window.location.search + window.location.hash)

    this.selfAvatar = this.makePlayer(ctx.selfId)
    // 狀態列、訂單、食譜改由 React HUD（ctx.setHud）；開局倒數用玩具系列配色，掛在不經後製的 UI 相機（同 bomber）
    if (typeof document !== 'undefined') void document.fonts?.load('bold 64px Fredoka').catch(() => undefined)
    this.banner = createCountdownPanel(scene, this.look.uiCamera, 'banner', 7, 4, new Vector3(0, 0.3, 8), {
      theme: COUNTDOWN_THEME,
      layerMask: UI_LAYER,
    })

    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)

    this.kitchen = createKitchen(ctx.players.map((p) => p.id), performance.now())
    this.respawn()

    this.flow = createGameFlow({ net: ctx.net, game: this.gameId, role: ctx.role, hostId: ctx.hostId })
    attachFlowAudio(this.flow, 'overcooked', { resultSfx: () => 'round_end' })
    this.flow.onChange((s) => {
      if (s.phase === 'countdown') {
        this.respawn()
        this.fx.clearRound()
        this.flights.clear()
      }
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
    const filled = this.perfFill && view ? this.fillView(view) : view
    // guest：8Hz 快照之間本地外插加工進度（host 每幀都是新的 view，不需要）
    const shown = filled ? this.extrapolated(view, filled, now) : null
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
      // 事件特效（煮好、焦了、出餐、拾取／放下）：比對前後兩張 view，host 與 guest 一致
      this.diffFx(shown, now)
      // 站點物品與站點特效（進度條／環、爐火、煙、回彈）
      for (const sv of shown.slots) {
        const st = stationById(sv.id)
        if (st) this.drawSlot(st, sv, now, deltaMs)
      }
      // 手持物（胸前雙手之間；剛拾取的沿弧線飛過來）
      for (const [pid, av] of holders) if (av) this.placeHand(pid, av, shown.hands[pid] ?? null, now, deltaMs)
    }
    this.board.update()
    this.fx.update(now)
    this.look.update(deltaMs)

    // AC9：每 2 秒印 draw calls 與 fps（讀上一幀的完整計數；還沒渲染過的首次取樣不印）
    if (this.instr && now - this.lastPerfLog >= PERF_LOG_MS) {
      this.lastPerfLog = now
      const line = perfLogLine(this.instr.drawCallsCounter.current, this.ctx.scene.getEngine().getFps(), 'kitchen')
      if (line) console.info(line)
    }

    // React HUD 與結算覆蓋層；3D 只剩開局倒數
    this.syncHud(phase, view)
    this.syncOverlay(phase)
    if (phase === 'countdown') {
      const n = Math.ceil(this.flow.countdownRemaining() / 1000)
      this.banner.draw(n > 0 ? String(n) : 'GO!', 200)
    } else {
      this.banner.draw('')
    }
    if (phase === 'result') {
      if (this.ctx.role === 'host') {
        this.resultElapsed += deltaMs
        if (this.resultElapsed > 10000) {
          this.resultElapsed = 0
          this.flow.startCountdown(3)
        }
      }
    } else {
      this.resultElapsed = 0
    }

    // 驗證用旗標
    ;(window as unknown as Record<string, unknown>).__BATTLE_POS = {
      x: this.state.x,
      z: this.state.z,
      score: view?.score ?? 0,
    }
  }

  /** guest：以收到最新快照後經過的時間外插進度（外插值只給畫面用，不回寫快照） */
  private extrapolated(raw: KitchenView | null, view: KitchenView, now: number): KitchenView {
    if (this.ctx.role === 'host') return view
    if (raw !== this.snapSeen) {
      this.snapSeen = raw
      this.snapAt = now
    }
    const age = now - this.snapAt
    if (age <= 0) return view
    const slots = view.slots.map((sv) => {
      const kind = stationById(sv.id)?.kind ?? 'counter'
      const progress = extrapolateProgress(kind, sv.item, sv.progress, age)
      return progress === sv.progress ? sv : { ...sv, progress }
    })
    return { ...view, slots }
  }

  /** 角色目前的位置（拾取／放下找最近的站點用） */
  private avatarOf(pid: string): Avatar | undefined {
    return pid === this.ctx.selfId ? this.selfAvatar : this.peerAvatars.get(pid)
  }

  /** 手持物在世界座標的位置：角色胸前雙手之間（跟著面向與俯角補償） */
  private holdPoint(av: Avatar): P3 {
    av.root.computeWorldMatrix(true)
    const wm = av.toy.body.computeWorldMatrix(true)
    const p = Vector3.TransformCoordinates(HOLD_LOCAL, wm)
    return { x: p.x, y: p.y, z: p.z }
  }

  /** 離 (x, z) 最近的站點 */
  private nearestOf(list: readonly StationDef[], x: number, z: number): StationDef | null {
    let best: StationDef | null = null
    let bestD = Infinity
    for (const s of list) {
      const d = Math.hypot(toX(s.cx) - x, toZ(s.cy) - z)
      if (d < bestD) {
        bestD = d
        best = s
      }
    }
    return best
  }

  /** 前後 view 差異 → 事件特效；非對局中與新局第一張只更新基準 */
  private diffFx(view: KitchenView, now: number): void {
    const prev = this.fxView
    this.fxView = view
    if (!prev || this.flow.state.phase !== 'playing' || view.remainMs > prev.remainMs + 1000) return
    for (const e of slotEvents(prev.slots, view.slots)) {
      if (e.type === 'cookDone') this.fx.cookDone(e.id)
      else if (e.type === 'burnt') this.fx.burnt(e.id)
    }
    const served = view.delivered > prev.delivered
    if (served) this.fx.served()

    const before = new Map(prev.slots.map((s) => [s.id, s.item]))
    const same = (a: Item | null | undefined, b: Item | null | undefined) => !!a && !!b && a.kind === b.kind && a.ing === b.ing
    const stationsOf = (pred: (sv: SlotView) => boolean) =>
      view.slots.filter(pred).map((sv) => stationById(sv.id)).filter((s): s is StationDef => !!s)
    for (const f of handFlights(prev.hands, view.hands)) {
      const av = this.avatarOf(f.pid)
      if (!av) continue
      const { x, z } = av.root.position
      if (f.type === 'pickup') {
        const item = view.hands[f.pid]
        // 從哪裡拿的：這一張剛空出來、物品相同的格子；都不是就是食材箱
        const src =
          this.nearestOf(stationsOf((sv) => sv.item === null && same(before.get(sv.id), item)), x, z) ??
          this.nearestOf(STATIONS.filter((s) => s.kind === 'crate' && s.ing === item?.ing), x, z)
        if (!src) continue
        const from = this.board.slotPoint(src)
        this.flights.set(`hand:${f.pid}`, { from, start: now })
        this.fx.landRing(from.x, from.y, from.z)
      } else {
        const item = prev.hands[f.pid]
        const dst = this.nearestOf(stationsOf((sv) => before.get(sv.id) == null && same(sv.item, item)), x, z)
        if (dst && dst.kind !== 'pot') this.flights.set(`slot:${dst.id}`, { from: this.holdPoint(av), start: now })
        else if (dst) {
          const p = this.board.slotPoint(dst)
          this.fx.landRing(p.x, p.y, p.z)
        }
      }
    }
  }

  /** 飛行中的物品位置；飛完回 null 並冒落點白環（ring 為 false 時不冒） */
  private flightPose(key: string, to: P3, now: number, ring: boolean): P3 | null {
    const f = this.flights.get(key)
    if (!f) return null
    const t = (now - f.start) / FLIGHT_MS
    if (t >= 1) {
      this.flights.delete(key)
      if (ring) this.fx.landRing(to.x, to.y, to.z)
      return null
    }
    return arcPoint(f.from, to, t, FLIGHT_ARC)
  }

  /** 一格站點：物品（放下時沿弧線飛到）＋該站的特效 */
  private drawSlot(st: StationDef, sv: SlotView, now: number, dtMs: number): void {
    const key = `slot:${st.id}`
    if (!sv.item) this.flights.delete(key)
    const to = this.board.slotPoint(st)
    const pose = sv.item ? this.flightPose(key, to, now, true) : null
    this.board.setSlot(st, sv.item, pose ?? undefined)
    if (st.kind === 'board') this.fx.updateBoard(st.id, boardPhase(sv.item), sv.progress, sv.item?.ing ?? null, now)
    else if (st.kind === 'pot') this.fx.updatePot(st.id, potPhase(sv.item, sv.progress), sv.progress, now, dtMs)
    else if (sv.item?.kind === 'burnt') this.fx.wisp(st.id, to.x, to.y + 0.5, to.z, dtMs)
  }

  /** 組 React HUD（共用契約 KitchenHud）：對局中每幀一張新物件、結算凍結在最後一張、倒數時是新局的樣子 */
  private syncHud(phase: string, view: KitchenView | null): void {
    const setHud = this.ctx.setHud
    if (!setHud) return
    if (phase === 'playing' && view) {
      const { track, gone } = trackOrders(this.orderTrack, view)
      this.orderTrack = track
      this.lastHud = buildKitchenHud({ view, ids: track.ids, gone, players: this.ctx.players, selfId: this.ctx.selfId })
      setHud(this.lastHud)
    } else if (phase === 'result' && this.lastHud) {
      setHud({ ...this.lastHud, gone: [] })
    } else {
      this.lastHud = null
      setHud(idleKitchenHud(this.ctx.players, this.ctx.selfId))
    }
  }

  /** 結算：沿用 setOverlay（不加星數，裁決⑧）；host 10 秒後自動再開一局 */
  private syncOverlay(phase: string): void {
    const setOverlay = this.ctx.setOverlay
    if (!setOverlay) return
    let overlay: GameOverlay | null = null
    if (phase === 'result') {
      const r = (this.flow.state.result as { score: number; delivered: number } | undefined) ?? { score: 0, delivered: 0 }
      overlay = { title: '🍲 時間到！', subtitle: `團隊分數 ${r.score}\n出餐 ${r.delivered} 份`, actions: [] }
    }
    const key = overlay ? `${overlay.title}|${overlay.subtitle ?? ''}` : ''
    if (key === this.overlayKey) return
    this.overlayKey = key
    setOverlay(overlay)
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
    this.ctx.setHud?.(null)
    this.ctx.setOverlay?.(null)
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
    this.flights.clear()
    this.fx.dispose()
    this.board.dispose()
    this.avatarKit.dispose()
    this.instr?.dispose()
    this.instr = null
    this.banner.dispose()
    this.look.dispose()
  }
}

export const createOvercookedScene = (): GameModule => new OvercookedScene()
