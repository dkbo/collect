import {
  ArcRotateCamera,
  Color3,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Vector3,
  VertexData,
} from '@/babylon/babylonCore'
import type { GameNetMessage } from '@/core/webrtc'
import type { GameContext, GameModule, GameOverlay, GamePlayer } from '@/babylon/types'
import { lerpAngle } from '@/babylon/math'
import { createCountdownPanel, createTextPanel, type TextPanel } from '@/babylon/hud'
import { attachFlowAudio, engineStart, engineSet, engineStop, playSfx, stopAllAudio } from '@/babylon/audio'
import {
  createFixedTicker,
  createGameFlow,
  createOwnershipSync,
  createSnapshotBuffer,
  type FixedTicker,
  type GameFlow,
  type OwnershipSync,
  type SnapshotBuffer,
} from '@/babylon/net'
import { RACE_COURSE } from '@/babylon/games/raceRules/trackData'
import { LAPS, pointAt, raceOver, sectorOf, trackProgress, normalizeProgress } from '@/babylon/games/raceRules/track'
import {
  BOOST_SPEED,
  JUMP_H,
  MAX_SPEED,
  PAD_HALF_LEN,
  PAD_HALF_W,
  RAMP_HALF_W,
  makeRacer,
  stepRacer,
  type DriveInput,
  type RacerState,
} from '@/babylon/games/raceRules/drive'
import {
  BOX_RADIUS,
  applySpin,
  boxLayout,
  claimBox,
  rollItem,
  shellTarget,
  takenBoxes,
  touchedBox,
  useItemSelf as applyItemSelf,
  type HitCar,
  type ItemKind,
} from '@/babylon/games/raceRules/items'
import { decideRaceBot, makeBotMind, stepBotMind, type BotMind } from '@/babylon/games/raceRules/raceAI'
import { makeRaceBots, raceColorIndex, raceEntityIds, type RaceRosterEntry } from '@/babylon/games/raceRules/roster'
import {
  OWN_FIN_MAX,
  decodeBotState,
  decodeBoxState,
  decodeItemGone,
  decodeItemGrant,
  decodeItemReq,
  decodeItemSpawn,
  decodeItemState,
  decodeOwn,
  decodeResult,
  decodeSpin,
  decodeStart,
  decodeUseItem,
  type BotSnap,
  type DriftTier,
  type RaceOwn,
  type RaceStanding,
} from '@/babylon/games/raceFx/raceNet'
import {
  finalStandings,
  formatRaceMs,
  liveOrder,
  makeLapClock,
  stepLapClock,
  type LapClock,
  type LiveCar,
  type StandingCar,
} from '@/babylon/games/raceFx/raceResult'
import { emptyField, spawnField, stepField, type FieldEvent, type ItemField } from '@/babylon/games/raceFx/raceField'
import { roadStrip } from '@/babylon/games/raceFx/raceGeom'
import { disposeCarVisual, makeCarVisual, type CarVisual } from '@/babylon/games/raceFx/carVisual'

/**
 * 極速賽車 v3 — A Toy Racer 玩法（波 2：玩法面；美術、特效、React HUD 在波 3／4）。
 *
 * 同步模型：分散式所有權——每人本機模擬自己的車（零輸入延遲），20Hz 廣播 own 快照
 * `{ x, z, ry, lap, cp, s, fin, ghost, drift, boost, spin, shield }`；他車插值。
 * host 裁決道具箱、道具生成、命中（以最近收到的 own 快照為準）、bot 與結算；
 * 規則全部在 raceRules／raceFx 純函式，這裡只接線與畫面。訊息表見 brief AC6b。
 */

const SIM_HZ = 30
/** botState 廣播週期（20Hz） */
const BOT_STATE_MS = 50
/** itemState 廣播週期（10Hz，只在場上有龜殼時送） */
const ITEM_STATE_MS = 100
/** guest 對同一個箱子重送 itemReq 的間隔 */
const ITEM_REQ_RETRY_MS = 400
/** host 驗 itemReq：請求者最近快照離箱子的容許距離（20Hz 延遲＋最高速） */
const ITEM_REQ_SLACK = 5
/** bot 追擊判定：龜殼在 bot 這距離內且鎖定它 */
const SHELL_CHASE_DIST = 15
/** 衝線後自己的車交給 AI 巡航的油門倍率（spec §6） */
const CRUISE_THROTTLE = 0.6
const RESULT_RESTART_MS = 10000
const GROUND_W = RACE_COURSE.bound.x * 2
const GROUND_D = RACE_COURSE.bound.z * 2
/** 甩尾段位火花色（白／藍／橘／紫，波 4 換 spec 色票） */
const DRIFT_COLORS = [new Color3(1, 1, 1), new Color3(0.3, 0.6, 1), new Color3(1, 0.55, 0.1), new Color3(0.75, 0.3, 1)]
const ITEM_LABEL: Record<ItemKind, string> = { banana: '香蕉', shell: '龜殼', mushroom: '加速菇', shield: '護盾' }

const COURSE = RACE_COURSE
const TRACK = COURSE.track
const BOXES = boxLayout(COURSE)

interface BotSim {
  racer: RacerState
  mind: BotMind
  item: ItemKind | null
  fin: number | null
}

/** 一台車在畫面上要用的姿態（自己、他車、bot 共用） */
interface CarPose {
  x: number
  z: number
  ry: number
  y: number
  drift: DriftTier
  spin: boolean
  ghost: boolean
  shield: boolean
  boost: boolean
}

interface ItemView {
  kind: 'banana' | 'shell'
  mesh: Mesh
  x: number
  z: number
  vx: number
  vz: number
}

class RaceScene implements GameModule {
  readonly gameId = 'race'
  private ctx!: GameContext
  private keys = new Set<string>()
  private useQueued = false
  private ticker!: FixedTicker
  private own!: OwnershipSync<RaceOwn>
  private flow!: GameFlow
  private offOpen: (() => void) | null = null

  // 自己的車
  private racer: RacerState = makeRacer(COURSE, 0)
  private item: ItemKind | null = null
  private fin: number | null = null
  private playStart = 0
  private cruiseMind: BotMind = makeBotMind(7)
  private reqBox: { box: number; at: number } | null = null

  // 名冊與 bot
  private bots: RaceRosterEntry[] = []
  private botSims = new Map<string, BotSim>()
  private botBufs = new Map<string, SnapshotBuffer<BotSnap>>()
  private botSeq = 0
  private botLatest = new Map<string, BotSnap>()

  // 道具（taken 為全員共用的畫面狀態；其餘為 host 權威）
  private taken: number[] = []
  private respawnAt: number[] = BOXES.map(() => 0)
  private hold = new Map<string, ItemKind | null>()
  private field: ItemField = emptyField()
  private itemViews = new Map<string, ItemView>()
  private sentTakenKey = ''
  private botStateAcc = 0
  private itemStateAcc = 0

  // 結算（host）
  private finishOrder: string[] = []
  private firstFinAt: number | null = null
  private prevFin = new Map<string, number | null>()
  private lapClocks = new Map<string, LapClock>()

  // 畫面
  private selfVisual?: CarVisual
  private carVisuals = new Map<string, CarVisual>()
  private camera!: ArcRotateCamera
  private resultElapsed = 0
  private lastOverlayKey = ''
  private statics: Mesh[] = []
  private boxMeshes: Mesh[] = []
  private boostPads: Mesh[] = []
  private sparks: { mesh: Mesh; life: number }[] = []
  private hud!: TextPanel
  private banner!: TextPanel
  private mats = new Map<string, StandardMaterial>()
  /** 本端看到的道具事件計數（給 qa 從 __BATTLE_POS 判讀，波 4 隨文字 HUD 一起整理） */
  private seen = { grant: 0, spawn: 0, spin: 0, blocked: 0, hit: 0, expire: 0, clash: 0 }

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase()
    this.keys.add(k)
    if (k === 'r') this.requestRestart()
    if (k === 'e' && !e.repeat) this.useQueued = true
  }
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase())

  // ---- 名冊 ----

  private entityIds(): string[] {
    return raceEntityIds(this.ctx.players, this.bots)
  }

  private isPlayer(id: string): boolean {
    return this.ctx.players.some((p) => p.id === id)
  }

  private nameFor(id: string): string {
    return (
      this.ctx.players.find((p: GamePlayer) => p.id === id)?.name ?? this.bots.find((b) => b.id === id)?.name ?? id.slice(0, 6)
    )
  }

  private colorIndexOf(id: string): 0 | 1 | 2 | 3 {
    return raceColorIndex(id, this.ctx.players, this.bots)
  }

  private slotOf(id: string): number {
    return Math.max(0, this.entityIds().indexOf(id))
  }

  // ---- 快照 ----

  private ownSnapshot(): RaceOwn {
    const r = this.racer
    return {
      x: r.car.x,
      z: r.car.z,
      ry: r.car.ry,
      lap: r.lap.lap,
      cp: r.lap.cp,
      s: r.s,
      fin: this.fin,
      ghost: r.ghostMs > 0,
      drift: r.drift.tier,
      boost: r.boostMs > 0,
      spin: r.spinMs > 0,
      shield: r.shieldMs > 0,
    }
  }

  /** 他車最新快照（驗過範圍；只收本局真人） */
  private remoteOwn(id: string): RaceOwn | null {
    if (!this.isPlayer(id)) return null
    return decodeOwn(this.own.latestRemote(id), TRACK.len)
  }

  private remotePlayers(): { id: string; snap: RaceOwn }[] {
    const out: { id: string; snap: RaceOwn }[] = []
    for (const id of this.own.remoteIds()) {
      const snap = this.remoteOwn(id)
      if (snap) out.push({ id, snap })
    }
    return out
  }

  private botSnap(id: string, b: BotSim): BotSnap {
    const r = b.racer
    return { id, x: r.car.x, z: r.car.z, ry: r.car.ry, lap: r.lap.lap, cp: r.lap.cp, s: r.s, fin: b.fin, drift: r.drift.tier, spin: r.spinMs > 0 }
  }

  /** 所有 bot 目前狀態（host 用模擬值，guest 用最新 botState） */
  private botStates(): BotSnap[] {
    if (this.ctx.role === 'host') return [...this.botSims].map(([id, b]) => this.botSnap(id, b))
    return [...this.botLatest.values()]
  }

  /** 名次用的全場車輛（自己、他車、bot） */
  private liveCars(): LiveCar[] {
    const r = this.racer
    return [
      { id: this.ctx.selfId, lap: r.lap.lap, cp: r.lap.cp, s: r.s, fin: this.fin },
      ...this.remotePlayers().map(({ id, snap }) => ({ id, lap: snap.lap, cp: snap.cp, s: snap.s, fin: snap.fin })),
      ...this.botStates().map((b) => ({ id: b.id, lap: b.lap, cp: b.cp, s: b.s, fin: b.fin })),
    ]
  }

  private order(): string[] {
    return liveOrder(TRACK, this.liveCars())
  }

  /** 其他車的位置（推擠、尾流用），排除 exclude */
  private positionsExcept(exclude: string): { x: number; z: number }[] {
    const out: { x: number; z: number }[] = []
    if (exclude !== this.ctx.selfId) out.push({ x: this.racer.car.x, z: this.racer.car.z })
    for (const { id, snap } of this.remotePlayers()) if (id !== exclude) out.push({ x: snap.x, z: snap.z })
    for (const b of this.botStates()) if (b.id !== exclude) out.push({ x: b.x, z: b.z })
    return out
  }

  // ---- 重置 ----

  private resetRace(): void {
    this.racer = makeRacer(COURSE, this.slotOf(this.ctx.selfId))
    this.item = null
    this.fin = null
    this.reqBox = null
    this.useQueued = false
    this.cruiseMind = makeBotMind(7)
    this.taken = []
    this.respawnAt = BOXES.map(() => 0)
    this.hold.clear()
    this.field = emptyField()
    for (const v of this.itemViews.values()) v.mesh.dispose()
    this.itemViews.clear()
    this.sentTakenKey = ''
    this.seen = { grant: 0, spawn: 0, spin: 0, blocked: 0, hit: 0, expire: 0, clash: 0 }
    this.finishOrder = []
    this.firstFinAt = null
    this.prevFin.clear()
    this.lapClocks.clear()
    this.botLatest.clear()
    for (const b of this.botBufs.values()) b.clear()
    this.botSims.clear()
    if (this.ctx.role === 'host') {
      this.bots.forEach((b, i) => {
        this.botSims.set(b.id, {
          racer: makeRacer(COURSE, this.slotOf(b.id)),
          mind: makeBotMind(0x9e3779b9 + i * 7919),
          item: null,
          fin: null,
        })
      })
    }
  }

  private onPlaying(): void {
    const now = performance.now()
    this.playStart = now
    for (const id of this.entityIds()) this.lapClocks.set(id, makeLapClock(now))
  }

  // ---- 重開 ----

  private canRestart(): boolean {
    const phase = this.flow.state.phase
    return phase === 'result' || phase === 'playing'
  }

  private requestRestart(): void {
    if (!this.canRestart()) return
    if (this.ctx.role === 'host') this.hostRestart()
    else this.ctx.net.broadcast({ game: this.gameId, type: 'restartReq', payload: {} })
  }

  private hostRestart(): void {
    if (this.ctx.role !== 'host') return
    this.resultElapsed = 0
    this.bots = makeRaceBots(this.ctx.players.length)
    this.broadcast('start', { bots: this.bots })
    this.flow.startCountdown(3)
  }

  private broadcast(type: string, payload: unknown): void {
    this.ctx.net.broadcast({ game: this.gameId, type, payload })
  }

  private results(): RaceStanding[] {
    return decodeResult(this.flow.state.result) ?? []
  }

  private syncOverlay(): void {
    const setOverlay = this.ctx.setOverlay
    if (!setOverlay) return

    let overlay: GameOverlay | null = null
    if (this.flow.state.phase === 'result') {
      const rows = this.results()
      const win = rows[0]?.id === this.ctx.selfId
      overlay = {
        title: win ? '🏆 你獲得勝利！' : '🏁 對局結束',
        subtitle: rows
          .map((r) => {
            const total = r.totalMs === null ? '未完賽' : formatRaceMs(r.totalMs)
            return `${r.rank}. ${r.name} — ${total}（最佳圈 ${formatRaceMs(r.bestLapMs)}）`
          })
          .join('\n'),
        actions: [{ label: '🔄 重新開始', onClick: () => this.requestRestart(), variant: 'primary' }],
      }
    }

    const key = overlay ? `${overlay.title}|${overlay.subtitle ?? ''}` : ''
    if (key === this.lastOverlayKey) return
    this.lastOverlayKey = key
    setOverlay(overlay)
  }

  // ---- 生命週期 ----

  init(ctx: GameContext): void {
    this.ctx = ctx
    const { scene } = ctx

    this.camera = new ArcRotateCamera('cam', -Math.PI / 2, 1.05, 12, Vector3.Zero(), scene)
    this.camera.maxZ = 600
    new HemisphericLight('light', new Vector3(0, 1, 0), scene)

    this.buildTrack()
    this.buildBoxes()

    if (ctx.role === 'host') this.bots = makeRaceBots(ctx.players.length)
    this.resetRace()
    this.selfVisual = this.makeCar(ctx.selfId)

    this.hud = createTextPanel(scene, this.camera, 'hud', 6, 0.8, new Vector3(0, 2.4, 8))
    this.banner = createCountdownPanel(scene, this.camera, 'banner', 7, 4, new Vector3(0, 0.3, 8))

    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)

    this.flow = createGameFlow({ net: ctx.net, game: this.gameId, role: ctx.role, hostId: ctx.hostId })
    attachFlowAudio(this.flow, 'race', {
      resultSfx: (r) => (decodeResult(r)?.[0]?.id === ctx.selfId ? 'win' : 'lose'),
    })
    this.flow.onChange((s) => {
      if (s.phase === 'countdown') {
        this.resetRace()
        engineStart()
      }
      if (s.phase === 'playing') this.onPlaying()
      if (s.phase === 'result') engineStop()
      this.syncOverlay()
      ;(window as unknown as Record<string, unknown>).__BATTLE_PHASE = s.phase
    })
    ;(window as unknown as Record<string, unknown>).__BATTLE_PHASE = this.flow.state.phase

    this.own = createOwnershipSync<RaceOwn>({ net: ctx.net, game: this.gameId })
    this.own.start(() => this.ownSnapshot())

    this.ticker = createFixedTicker(SIM_HZ, (_t, stepMs) => this.simulate(stepMs / 1000))
    this.ticker.start()

    if (ctx.role === 'host') {
      this.broadcast('start', { bots: this.bots })
      // 晚開的通道補送名冊與道具箱狀態
      this.offOpen = ctx.net.on('open', (peerId) => {
        ctx.net.send(peerId, { game: this.gameId, type: 'start', payload: { bots: this.bots } })
        ctx.net.send(peerId, { game: this.gameId, type: 'boxState', payload: { taken: this.taken } })
      })
      this.flow.startCountdown(3)
    }
  }

  // ---- 場景（波 2 暫用簡單 mesh，波 3 照 spec 換掉） ----

  private mat(name: string, color: Color3, emissive?: Color3): StandardMaterial {
    let m = this.mats.get(name)
    if (!m) {
      m = new StandardMaterial(`race-${name}`, this.ctx.scene)
      m.diffuseColor = color
      if (emissive) m.emissiveColor = emissive
      this.mats.set(name, m)
    }
    return m
  }

  private buildTrack(): void {
    const scene = this.ctx.scene
    const ground = MeshBuilder.CreateGround('race-ground', { width: GROUND_W, height: GROUND_D }, scene)
    ground.material = this.mat('ground', new Color3(0.36, 0.62, 0.4))
    this.statics.push(ground)

    const addStrip = (name: string, halfW: number, y: number, color: Color3) => {
      const g = roadStrip(TRACK, halfW, y)
      const mesh = new Mesh(name, scene)
      const vd = new VertexData()
      vd.positions = g.positions
      vd.indices = g.indices
      vd.normals = g.normals
      vd.uvs = g.uvs
      vd.applyToMesh(mesh)
      const m = this.mat(name, color)
      m.backFaceCulling = false
      mesh.material = m
      this.statics.push(mesh)
    }
    // 路緣（稍寬一圈紅色帶）＋路面
    addStrip('curb', TRACK.width / 2 + 0.6, 0.01, new Color3(0.9, 0.25, 0.22))
    addStrip('road', TRACK.width / 2, 0.02, new Color3(0.3, 0.32, 0.38))

    // 起跑線（棋盤格）＋拱門
    const start = pointAt(TRACK, 0)
    const cells = 8
    for (let i = 0; i < cells; i++) {
      const lat = ((i + 0.5) / cells - 0.5) * TRACK.width
      const cell = MeshBuilder.CreateBox(`race-start-${i}`, { width: TRACK.width / cells, height: 0.02, depth: 0.8 }, scene)
      cell.position.set(start.x + Math.cos(start.heading) * lat, 0.035, start.z - Math.sin(start.heading) * lat)
      cell.rotation.y = start.heading
      cell.material = i % 2 === 0 ? this.mat('white', Color3.White()) : this.mat('black', new Color3(0.1, 0.1, 0.1))
      this.statics.push(cell)
    }
    for (const side of [-1, 1]) {
      const lat = side * (TRACK.width / 2 + 0.8)
      const pillar = MeshBuilder.CreateBox(`race-arch-${side}`, { width: 0.5, height: 4, depth: 0.5 }, scene)
      pillar.position.set(start.x + Math.cos(start.heading) * lat, 2, start.z - Math.sin(start.heading) * lat)
      pillar.material = this.mat('arch', new Color3(0.85, 0.2, 0.15))
      this.statics.push(pillar)
    }
    const beam = MeshBuilder.CreateBox('race-arch-beam', { width: TRACK.width + 2.2, height: 0.5, depth: 0.5 }, scene)
    beam.position.set(start.x, 4, start.z)
    beam.rotation.y = start.heading
    beam.material = this.mat('arch', new Color3(0.85, 0.2, 0.15))
    this.statics.push(beam)

    // 固定加速帶
    for (const [i, p] of COURSE.pads.entries()) {
      const pad = MeshBuilder.CreateBox(`race-pad-${i}`, { width: PAD_HALF_W * 2, height: 0.04, depth: PAD_HALF_LEN * 2 }, scene)
      pad.position.set(p.x, 0.04, p.z)
      pad.rotation.y = p.heading
      pad.material = this.mat('pad', new Color3(0.1, 0.6, 0.95), new Color3(0.05, 0.35, 0.7))
      this.boostPads.push(pad)
    }

    // 跳台斜坡：從 s0 升到 s1（唇口 JUMP_H）
    for (const [i, [s0, s1]] of COURSE.jumps.entries()) {
      const a = pointAt(TRACK, s0)
      const b = pointAt(TRACK, s1)
      const run = Math.hypot(b.x - a.x, b.z - a.z)
      const ramp = MeshBuilder.CreateBox(
        `race-ramp-${i}`,
        { width: RAMP_HALF_W * 2, height: 0.2, depth: Math.hypot(run, JUMP_H) },
        scene
      )
      ramp.position.set((a.x + b.x) / 2, JUMP_H / 2, (a.z + b.z) / 2)
      ramp.rotation.set(-Math.atan2(JUMP_H, run), Math.atan2(b.x - a.x, b.z - a.z), 0)
      ramp.material = this.mat('ramp', new Color3(0.95, 0.75, 0.2))
      this.statics.push(ramp)
    }
  }

  private buildBoxes(): void {
    const scene = this.ctx.scene
    const m = this.mat('box', new Color3(1, 0.8, 0.2), new Color3(0.4, 0.25, 0))
    for (const b of BOXES) {
      const mesh = MeshBuilder.CreateBox(`race-box-${b.id}`, { size: 1.1 }, scene)
      mesh.position.set(b.x, 1, b.z)
      mesh.material = m
      this.boxMeshes.push(mesh)
    }
  }

  // ---- 車輛視覺（波 3 換成 spec 的 Q 版玩具車） ----

  private makeCar(id: string): CarVisual {
    return makeCarVisual(this.ctx.scene, id, this.colorIndexOf(id), (name, color, emissive) => this.mat(name, color, emissive))
  }

  private visualFor(id: string): CarVisual {
    let v = this.carVisuals.get(id)
    if (!v) {
      v = this.makeCar(id)
      this.carVisuals.set(id, v)
    }
    return v
  }

  private applyPose(v: CarVisual, p: CarPose, dt: number, now: number): void {
    const moved = Math.hypot(p.x - v.prevX, p.z - v.prevZ)
    v.prevX = p.x
    v.prevZ = p.z
    for (const w of v.wheels) w.rotation.x += moved * 3
    v.spinAngle = p.spin ? v.spinAngle + dt * Math.PI * 5 : 0
    v.root.position.set(p.x, p.y, p.z)
    v.root.rotation.y = p.ry + v.spinAngle
    v.root.setEnabled(!p.ghost || Math.floor(now / 100) % 2 === 0)
    v.shield.setEnabled(p.shield)
    if (p.drift > 0 || p.boost) {
      v.sparkAcc += dt
      if (v.sparkAcc > 0.05) {
        v.sparkAcc = 0
        this.spawnSpark(p, p.boost && p.drift === 0 ? DRIFT_COLORS[2] : DRIFT_COLORS[p.drift])
      }
    }
  }

  private spawnSpark(p: CarPose, color: Color3): void {
    if (this.sparks.length > 60) return
    const scene = this.ctx.scene
    const spark = MeshBuilder.CreateBox('race-spark', { size: 0.14 }, scene)
    const back = 1.1
    spark.position.set(p.x - Math.sin(p.ry) * back + (Math.random() - 0.5) * 0.8, p.y + 0.15, p.z - Math.cos(p.ry) * back)
    const m = new StandardMaterial('race-spark-mat', scene)
    m.emissiveColor = color
    m.disableLighting = true
    spark.material = m
    this.sparks.push({ mesh: spark, life: 0.3 })
  }

  // ---- 道具畫面 ----

  private spawnItemView(id: string, kind: 'banana' | 'shell', x: number, z: number, vx: number, vz: number): void {
    if (this.itemViews.has(id)) return
    this.seen.spawn++
    const scene = this.ctx.scene
    const mesh =
      kind === 'banana'
        ? MeshBuilder.CreateCylinder(`race-banana-${id}`, { diameterTop: 0.3, diameterBottom: 0.9, height: 0.5 }, scene)
        : MeshBuilder.CreateSphere(`race-shell-${id}`, { diameter: 0.9, segments: 8 }, scene)
    mesh.material = kind === 'banana' ? this.mat('banana', new Color3(1, 0.9, 0.2)) : this.mat('shell', new Color3(0.9, 0.15, 0.15))
    mesh.position.set(x, 0.4, z)
    this.itemViews.set(id, { kind, mesh, x, z, vx, vz })
  }

  private removeItemView(id: string): void {
    const v = this.itemViews.get(id)
    if (!v) return
    v.mesh.dispose()
    this.itemViews.delete(id)
  }

  // ---- 網路 ----

  onNetworkMessage(from: string, msg: GameNetMessage): void {
    if (msg.game !== this.gameId) return
    const p = msg.payload
    if (this.ctx.role === 'host') {
      // 上行請求只收本局真人
      if (!this.isPlayer(from) || from === this.ctx.selfId) return
      if (msg.type === 'restartReq') {
        if (this.flow.state.phase === 'result') this.hostRestart()
      } else if (msg.type === 'itemReq') {
        const d = decodeItemReq(p, BOXES.length)
        const snap = this.remoteOwn(from)
        if (!d || !snap || snap.fin !== null || this.flow.state.phase !== 'playing') return
        const box = BOXES[d.box]
        if (Math.hypot(box.x - snap.x, box.z - snap.z) > BOX_RADIUS + ITEM_REQ_SLACK) return
        this.hostClaim(from, d.box)
      } else if (msg.type === 'useItem') {
        const d = decodeUseItem(p)
        const snap = this.remoteOwn(from)
        if (!d || !snap || snap.fin !== null || this.flow.state.phase !== 'playing') return
        this.hostUseItem(from, d.kind, snap)
      }
      return
    }
    // 其餘皆為 host → 全體的權威訊息，只信任房主
    if (from !== this.ctx.hostId) return
    const ids = this.entityIds()
    switch (msg.type) {
      case 'start': {
        const d = decodeStart(p)
        if (d) this.bots = d.bots
        break
      }
      case 'itemGrant': {
        const d = decodeItemGrant(p, BOXES.length, ids)
        if (!d) return
        this.seen.grant++
        if (!this.taken.includes(d.box)) this.taken = [...this.taken, d.box]
        if (d.who === this.ctx.selfId) {
          this.item = d.kind
          this.reqBox = null
          playSfx('pickup')
        }
        break
      }
      case 'boxState': {
        const d = decodeBoxState(p, BOXES.length)
        if (d) this.taken = d.taken
        break
      }
      case 'itemSpawn': {
        const d = decodeItemSpawn(p, ids)
        if (d) this.spawnItemView(d.id, d.kind, d.x, d.z, d.vx, d.vz)
        break
      }
      case 'itemState': {
        const d = decodeItemState(p)
        if (!d) return
        for (const e of d.list) {
          const v = this.itemViews.get(e.id)
          if (!v) continue
          v.vx = (e.x - v.x) / (ITEM_STATE_MS / 1000)
          v.vz = (e.z - v.z) / (ITEM_STATE_MS / 1000)
          v.x = e.x
          v.z = e.z
        }
        break
      }
      case 'itemGone': {
        const d = decodeItemGone(p)
        if (!d) return
        this.removeItemView(d.id)
        this.seen[d.reason]++
        break
      }
      case 'spin': {
        const d = decodeSpin(p, ids)
        if (!d) return
        this.seen[d.blocked ? 'blocked' : 'spin']++
        if (d.target === this.ctx.selfId) this.applySpinSelf(d.ms, d.blocked)
        break
      }
      case 'botState': {
        const d = decodeBotState(
          p,
          this.bots.map((b) => b.id),
          TRACK.len
        )
        if (!d) return
        for (const s of d.states) {
          let buf = this.botBufs.get(s.id)
          if (!buf) {
            buf = createSnapshotBuffer<BotSnap>(100)
            this.botBufs.set(s.id, buf)
          }
          buf.push(this.botSeq++, s)
          this.botLatest.set(s.id, s)
        }
        break
      }
    }
  }

  private applySpinSelf(ms: number, blocked: boolean): void {
    this.racer = applySpin(this.racer, ms, blocked)
    playSfx(blocked ? 'tank_shield_break' : 'tank_hit')
  }

  // ---- host 裁決 ----

  private hostClaim(who: string, box: number): void {
    const now = performance.now()
    const r = claimBox(this.respawnAt, box, this.hold.get(who) ?? null, now)
    if (!r.ok) return
    this.respawnAt = r.respawnAt
    const order = this.order()
    const rank = Math.max(1, order.indexOf(who) + 1)
    const kind = rollItem(rank, order.length, Math.random())
    this.hold.set(who, kind)
    this.broadcast('itemGrant', { box, who, kind })
    this.seen.grant++
    this.taken = takenBoxes(this.respawnAt, now)
    if (who === this.ctx.selfId) {
      this.item = kind
      playSfx('pickup')
    }
    const bot = this.botSims.get(who)
    if (bot) bot.item = kind
  }

  /** host 生成香蕉／龜殼（加速菇、護盾在使用者本機生效，host 只清持有） */
  private hostUseItem(who: string, kind: ItemKind, pose: { x: number; z: number; ry: number }): void {
    if (this.hold.get(who) !== kind) return
    this.hold.set(who, null)
    if (kind !== 'banana' && kind !== 'shell') return
    const target = kind === 'shell' ? shellTarget(who, this.order()) : null
    const r = spawnField(this.field, kind, who, pose, target)
    this.field = r.field
    const e = r.entry
    this.broadcast('itemSpawn', { id: e.id, kind: e.kind, owner: who, x: e.x, z: e.z, vx: e.vx, vz: e.vz, target: e.target })
    this.spawnItemView(e.id, e.kind, e.x, e.z, e.vx, e.vz)
    for (const id of r.overflow) {
      this.broadcast('itemGone', { id, reason: 'expire' })
      this.removeItemView(id)
    }
  }

  private hitCars(): HitCar[] {
    const r = this.racer
    return [
      { id: this.ctx.selfId, x: r.car.x, z: r.car.z, ghost: r.ghostMs > 0, shield: r.shieldMs > 0 },
      ...this.remotePlayers().map(({ id, snap }) => ({ id, x: snap.x, z: snap.z, ghost: snap.ghost, shield: snap.shield })),
      ...[...this.botSims].map(([id, b]) => ({
        id,
        x: b.racer.car.x,
        z: b.racer.car.z,
        ghost: b.racer.ghostMs > 0,
        shield: b.racer.shieldMs > 0,
      })),
    ]
  }

  private applyFieldEvent(ev: FieldEvent): void {
    if (ev.type === 'gone') {
      this.broadcast('itemGone', { id: ev.id, reason: ev.reason })
      this.removeItemView(ev.id)
      this.seen[ev.reason]++
      return
    }
    this.broadcast('spin', { target: ev.target, ms: ev.ms, blocked: ev.blocked })
    this.seen[ev.blocked ? 'blocked' : 'spin']++
    if (ev.target === this.ctx.selfId) this.applySpinSelf(ev.ms, ev.blocked)
    const bot = this.botSims.get(ev.target)
    if (bot) bot.racer = applySpin(bot.racer, ev.ms, ev.blocked)
  }

  private stepBots(dt: number, now: number): void {
    const dtMs = dt * 1000
    const cars = this.liveCars()
    const dist = new Map(
      cars.map((c) => {
        const n = normalizeProgress(TRACK, c)
        return [c.id, n.lap * TRACK.len + n.s]
      })
    )
    const lateralOf = new Map<string, number>()
    lateralOf.set(this.ctx.selfId, this.racer.lateral)
    for (const { id, snap } of this.remotePlayers()) lateralOf.set(id, trackProgress(TRACK, snap.x, snap.z).lateral)
    for (const [id, b] of this.botSims) lateralOf.set(id, b.racer.lateral)

    for (const [id, b] of this.botSims) {
      const r = b.racer
      b.mind = stepBotMind(b.mind, { sector: sectorOf(TRACK, r.s), item: b.item }, dtMs)
      const shellChasing = this.field.items.some(
        (it) => it.kind === 'shell' && it.target === id && Math.hypot(it.x - r.car.x, it.z - r.car.z) < SHELL_CHASE_DIST
      )
      const out = decideRaceBot({
        course: COURSE,
        car: r.car,
        s: r.s,
        lateral: r.lateral,
        dist: dist.get(id) ?? 0,
        item: b.item,
        others: cars.filter((c) => c.id !== id).map((c) => ({ dist: dist.get(c.id) ?? 0, lateral: lateralOf.get(c.id) ?? 0 })),
        shellChasing,
        mind: b.mind,
      })
      const input: DriveInput = { throttle: out.throttle, steer: out.steer, drifting: out.drift }
      const step = stepRacer(r, input, { course: COURSE, others: this.positionsExcept(id) }, dt)
      b.racer = step.state
      if (step.events.includes('finish') && b.fin === null) b.fin = Math.min(OWN_FIN_MAX, Math.round(now - this.playStart))
      if (out.useItem && b.item && b.fin === null) {
        const kind = b.item
        b.item = null
        b.racer = applyItemSelf(b.racer, kind)
        this.hostUseItem(id, kind, b.racer.car)
      }
      if (!b.item && b.fin === null) {
        const box = touchedBox(BOXES, this.taken, b.racer.car.x, b.racer.car.z)
        if (box !== null) this.hostClaim(id, box)
      }
    }
  }

  private hostTick(dt: number, now: number): void {
    this.stepBots(dt, now)

    // 道具箱重生 → boxState
    this.taken = takenBoxes(this.respawnAt, now)
    const key = this.taken.join(',')
    if (key !== this.sentTakenKey) {
      this.sentTakenKey = key
      this.broadcast('boxState', { taken: this.taken })
    }

    // 場上道具與命中
    const r = stepField(this.field, this.hitCars(), COURSE, dt)
    this.field = r.field
    for (const ev of r.events) this.applyFieldEvent(ev)
    for (const it of this.field.items) {
      const v = this.itemViews.get(it.id)
      if (v) {
        v.x = it.x
        v.z = it.z
        v.vx = 0
        v.vz = 0
      }
    }
    this.itemStateAcc += dt * 1000
    if (this.itemStateAcc >= ITEM_STATE_MS) {
      this.itemStateAcc = 0
      const shells = this.field.items.filter((it) => it.kind === 'shell')
      if (shells.length) this.broadcast('itemState', { list: shells.map((s) => ({ id: s.id, x: s.x, z: s.z })) })
    }

    this.sendBotState(dt)

    // 最佳圈與過線順序（以 host 觀察到的先後）
    const cars = this.liveCars()
    for (const c of cars) {
      const clock = this.lapClocks.get(c.id) ?? makeLapClock(this.playStart)
      this.lapClocks.set(c.id, stepLapClock(clock, c.lap, now))
      const was = this.prevFin.get(c.id) ?? null
      if (was === null && c.fin !== null) {
        this.finishOrder.push(c.id)
        if (this.firstFinAt === null) this.firstFinAt = now
      }
      this.prevFin.set(c.id, c.fin)
    }
    if (raceOver(
      cars.map((c) => c.fin),
      this.firstFinAt,
      now
    )) {
      const best: Record<string, number | null> = {}
      for (const [id, c] of this.lapClocks) best[id] = c.bestMs
      const rows: StandingCar[] = cars.map((c) => ({ ...c, name: this.nameFor(c.id), colorIndex: this.colorIndexOf(c.id) }))
      this.flow.endGame(finalStandings(TRACK, rows, this.finishOrder, best))
    }
  }

  // ---- 模擬 ----

  private readInput(): DriveInput {
    const k = this.keys
    const up = k.has('w') || k.has('arrowup')
    const down = k.has('s') || k.has('arrowdown')
    const steer = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0)
    return { throttle: up ? 1 : down ? -1 : 0, steer, drifting: k.has(' ') }
  }

  /** 衝線後交給 AI 慢慢巡航（spec §6） */
  private cruiseInput(dt: number): DriveInput {
    const r = this.racer
    this.cruiseMind = stepBotMind(this.cruiseMind, { sector: sectorOf(TRACK, r.s), item: null }, dt * 1000)
    const out = decideRaceBot({
      course: COURSE,
      car: r.car,
      s: r.s,
      lateral: r.lateral,
      dist: 0,
      item: null,
      others: [],
      shellChasing: false,
      mind: this.cruiseMind,
    })
    return { throttle: out.throttle * CRUISE_THROTTLE, steer: out.steer, drifting: false }
  }

  /** host：botState 20Hz（倒數期間也送，guest 起跑格才看得到 bot） */
  private sendBotState(dt: number): void {
    this.botStateAcc += dt * 1000
    if (this.botStateAcc < BOT_STATE_MS || !this.botSims.size) return
    this.botStateAcc = 0
    this.broadcast('botState', { states: this.botStates() })
  }

  private simulate(dt: number): void {
    const phase = this.flow.state.phase
    if (phase === 'countdown' && this.ctx.role === 'host') this.sendBotState(dt)
    if (phase !== 'playing') return
    const now = performance.now()

    const input = this.fin === null ? this.readInput() : this.cruiseInput(dt)
    const step = stepRacer(this.racer, input, { course: COURSE, others: this.positionsExcept(this.ctx.selfId) }, dt)
    this.racer = step.state
    for (const ev of step.events) {
      if (ev === 'lap') playSfx('lap')
      else if (ev === 'finish') {
        if (this.fin === null) this.fin = Math.min(OWN_FIN_MAX, Math.round(now - this.playStart))
        playSfx('round_end')
      } else if (ev === 'turbo' || ev === 'pad') playSfx('tank_bounce')
    }

    // 使用道具（e）
    if (this.useQueued) {
      this.useQueued = false
      const kind = this.item
      // 過線後不撿不用道具，不干擾還在比賽的車
      if (kind && this.fin === null) {
        this.item = null
        this.racer = applyItemSelf(this.racer, kind)
        if (this.ctx.role === 'host') this.hostUseItem(this.ctx.selfId, kind, this.racer.car)
        else this.broadcast('useItem', { kind })
      }
    }

    // 撿道具箱：host 直接裁決，guest 送 itemReq 等 itemGrant
    if (!this.item && this.fin === null) {
      const box = touchedBox(BOXES, this.taken, this.racer.car.x, this.racer.car.z)
      if (box !== null) {
        if (this.ctx.role === 'host') this.hostClaim(this.ctx.selfId, box)
        else if (!this.reqBox || this.reqBox.box !== box || now - this.reqBox.at > ITEM_REQ_RETRY_MS) {
          this.reqBox = { box, at: now }
          this.broadcast('itemReq', { box })
        }
      }
    }

    if (this.ctx.role === 'host') this.hostTick(dt, now)

    engineSet(Math.min(1, Math.abs(this.racer.car.speed) / MAX_SPEED))
  }

  // ---- 畫面更新 ----

  update(deltaMs: number): void {
    const dt = deltaMs * 0.001
    const phase = this.flow.state.phase
    const now = performance.now()
    const r = this.racer

    if (this.selfVisual) {
      this.applyPose(
        this.selfVisual,
        {
          x: r.car.x,
          z: r.car.z,
          ry: r.car.ry,
          y: r.y,
          drift: r.drift.tier,
          spin: r.spinMs > 0,
          ghost: r.ghostMs > 0,
          shield: r.shieldMs > 0,
          boost: r.boostMs > 0,
        },
        dt,
        now
      )
    }

    // 追尾相機（波 3 照 spec §7 換掉）
    this.camera.target.set(r.car.x, 0.5 + r.y, r.car.z)
    this.camera.alpha = lerpAngle(this.camera.alpha, -r.car.ry - Math.PI / 2, Math.min(1, dt * 5))

    // 他車與 bot
    const live = new Set<string>()
    for (const id of this.own.remoteIds()) {
      if (!this.isPlayer(id)) continue
      const s = this.own.sampleRemote(id)
      const a = s && decodeOwn(s.a, TRACK.len)
      const b = s && decodeOwn(s.b, TRACK.len)
      if (!s || !a || !b) continue
      live.add(id)
      this.applyPose(this.visualFor(id), this.lerpPose(a, b, s.alpha, b), dt, now)
    }
    for (const bot of this.bots) {
      let pose: CarPose | null = null
      if (this.ctx.role === 'host') {
        const sim = this.botSims.get(bot.id)
        if (sim) {
          const br = sim.racer
          pose = {
            x: br.car.x,
            z: br.car.z,
            ry: br.car.ry,
            y: br.y,
            drift: br.drift.tier,
            spin: br.spinMs > 0,
            ghost: br.ghostMs > 0,
            shield: br.shieldMs > 0,
            boost: br.boostMs > 0,
          }
        }
      } else {
        const s = this.botBufs.get(bot.id)?.sample()
        if (s) pose = this.lerpPose(s.a, s.b, s.alpha, null)
      }
      if (!pose) continue
      live.add(bot.id)
      this.applyPose(this.visualFor(bot.id), pose, dt, now)
    }
    for (const [id, v] of this.carVisuals) {
      if (live.has(id)) continue
      disposeCarVisual(v)
      this.carVisuals.delete(id)
    }

    // 道具箱、道具
    const bob = Math.sin(now * 0.004) * 0.15
    for (const [i, m] of this.boxMeshes.entries()) {
      m.setEnabled(!this.taken.includes(i))
      m.position.y = 1 + bob
      m.rotation.y += dt * 1.5
      m.rotation.x += dt * 0.7
    }
    for (const v of this.itemViews.values()) {
      if (this.ctx.role !== 'host') {
        v.x += v.vx * dt
        v.z += v.vz * dt
      }
      v.mesh.position.set(v.x, 0.4, v.z)
      if (v.kind === 'shell') v.mesh.rotation.y += dt * 10
    }
    for (const pad of this.boostPads) pad.position.y = 0.04 + Math.sin(now * 0.006) * 0.02

    this.sparks = this.sparks.filter((s) => {
      s.life -= dt
      if (s.life <= 0) {
        s.mesh.material?.dispose()
        s.mesh.dispose()
        return false
      }
      s.mesh.position.y += dt * 1.5
      return true
    })

    this.drawHud(phase)

    if (phase === 'countdown') {
      const n = Math.ceil(this.flow.countdownRemaining() / 1000)
      this.banner.draw(n > 0 ? String(n) : 'GO!', 200)
    } else if (phase === 'result') {
      this.banner.draw('')
      if (this.ctx.role === 'host') {
        this.resultElapsed += deltaMs
        if (this.resultElapsed > RESULT_RESTART_MS) this.hostRestart()
      }
    } else {
      this.resultElapsed = 0
      this.banner.draw('')
    }

    this.syncOverlay()
  }

  private lerpPose(
    a: { x: number; z: number; ry: number; drift: DriftTier; spin: boolean },
    b: { x: number; z: number; ry: number; drift: DriftTier; spin: boolean },
    alpha: number,
    flags: RaceOwn | null
  ): CarPose {
    return {
      x: a.x + (b.x - a.x) * alpha,
      z: a.z + (b.z - a.z) * alpha,
      ry: lerpAngle(a.ry, b.ry, alpha),
      y: 0,
      drift: b.drift,
      spin: b.spin,
      ghost: flags?.ghost ?? false,
      shield: flags?.shield ?? false,
      boost: flags?.boost ?? false,
    }
  }

  /** 暫用文字 HUD（波 4 改 React setHud 後刪）：名次／圈數／道具供 qa 判讀 */
  private drawHud(phase: string): void {
    const r = this.racer
    const order = this.order()
    const rank = order.indexOf(this.ctx.selfId) + 1
    const lapShown = Math.min(r.lap.lap + 1, LAPS)
    const kmh = Math.round(Math.abs(r.car.speed) * 15)
    const tags = [
      r.drift.tier > 0 ? `甩尾${r.drift.tier}` : '',
      r.boostMs > 0 ? '⚡' : '',
      r.slipMs > 0 ? '尾流' : '',
      r.shieldMs > 0 ? '🛡' : '',
      r.spinMs > 0 ? '打滑' : '',
      r.wrongWay ? '逆向!' : '',
      r.lap.lap === LAPS - 1 && this.fin === null ? '最後一圈' : '',
      this.fin !== null ? `完賽 ${formatRaceMs(this.fin)}` : '',
    ].filter(Boolean)
    const text =
      phase === 'playing'
        ? `第${rank}/${order.length}名  LAP ${lapShown}/${LAPS}  ${kmh}km/h  道具:${this.item ? ITEM_LABEL[this.item] : '—'}  ${tags.join(' ')}`
        : ''
    this.hud.draw(text, 34)

    ;(window as unknown as Record<string, unknown>).__BATTLE_POS = {
      x: r.car.x,
      z: r.car.z,
      y: r.y,
      ry: r.car.ry,
      lap: r.lap.lap,
      cp: r.lap.cp,
      s: r.s,
      lateral: r.lateral,
      speed: r.car.speed,
      rank,
      total: order.length,
      item: this.item,
      fin: this.fin,
      wrongWay: r.wrongWay,
      drift: r.drift.tier,
      boostMs: r.boostMs,
      slipMs: r.slipMs,
      spinMs: r.spinMs,
      shieldMs: r.shieldMs,
      ghostMs: r.ghostMs,
      bots: this.bots.length,
      items: this.itemViews.size,
      taken: this.taken.length,
      seen: { ...this.seen },
      boostMax: BOOST_SPEED,
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
    if (this.selfVisual) disposeCarVisual(this.selfVisual)
    for (const v of this.carVisuals.values()) disposeCarVisual(v)
    this.carVisuals.clear()
    for (const v of this.itemViews.values()) v.mesh.dispose()
    this.itemViews.clear()
    for (const s of this.sparks) {
      s.mesh.material?.dispose()
      s.mesh.dispose()
    }
    this.sparks = []
    this.hud.dispose()
    this.banner.dispose()
    for (const m of [...this.statics, ...this.boxMeshes, ...this.boostPads]) m.dispose()
    this.statics = []
    this.boxMeshes = []
    this.boostPads = []
    for (const m of this.mats.values()) m.dispose()
    this.mats.clear()
  }
}

export const createRaceScene = (): GameModule => new RaceScene()
