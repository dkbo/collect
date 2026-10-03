import { ArcRotateCamera, Color3, Color4, Scene, SceneInstrumentation, Vector3 } from '@/babylon/babylonCore'
import type { GameNetMessage } from '@/core/webrtc'
import type { GameContext, GameModule, GameOverlay, GamePlayer } from '@/babylon/types'
import { lerpAngle } from '@/babylon/math'
import { createCountdownPanel, type TextPanel } from '@/babylon/hud'
import { ToyLook, UI_LAYER } from '@/babylon/fx/look'
import { COUNTDOWN_THEME } from '@/babylon/fx/countdown'
import { perfLogLine } from '@/babylon/fx/perfLog'
import { fxRandom } from '@/babylon/fx/emitter'
import { tierQuery } from '@/babylon/fx/quality'
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
import { JUMP_S0, JUMP_S1, RACE_COURSE } from '@/babylon/games/raceRules/trackData'
import { LAPS, raceOver, sectorOf, trackProgress, normalizeProgress, wrapAngle } from '@/babylon/games/raceRules/track'
import {
  BOOST_SPEED,
  CAR_PUSH_DIST,
  JUMP_G,
  JUMP_H,
  MAX_SPEED,
  RESPAWN_GHOST_MS,
  makeRacer,
  rampY,
  stepRacer,
  type DriveInput,
  type RacerState,
} from '@/babylon/games/raceRules/drive'
import {
  BOX_RADIUS,
  SPIN_MS,
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
import { CarKit, disposeCarVisual, type CarVisual } from '@/babylon/games/raceFx/carVisual'
import { RaceWorld, type WorldItem } from '@/babylon/games/raceFx/world'
import { CHASE, initChase, snapGrid, stepChase, type ChaseMode, type ChaseState } from '@/babylon/games/raceFx/chaseCam'
import { bodyPose, remoteY, steerFromYaw, yawToward } from '@/babylon/games/raceFx/carPose'
import { benchEnabled, benchLayout } from '@/babylon/games/raceFx/bench'
import { WHEEL_R } from '@/babylon/games/raceFx/models'
import { DRIFT_COLORS, OUTLINE, RACE } from '@/babylon/games/raceFx/palette'
import { RaceFx } from '@/babylon/games/raceFx/effects'
import {
  CLASH_SPEED,
  clashKey,
  finishEdges,
  clashReady,
  relSpeed,
  shakeAllowed,
  shakeAmp,
  slipLook,
  speedLineAlpha,
  speedLineCap,
} from '@/babylon/games/raceFx/fxModel'
import { ROLL_MS, buildRaceHud, mapOutline, type RaceHudCarInput } from '@/babylon/games/raceFx/hudModel'
import { archPose } from '@/babylon/games/raceFx/scenery'

/**
 * 極速賽車 v3 — A Toy Racer（波 2 玩法、波 3 車輛／場景／光影／追尾相機、波 4 特效與 React HUD）。
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
/** 陰影正交範圍半徑（spec §5：跟著自己的車走） */
const SHADOW_RADIUS = 22
/** 陰影中心量化格（避免每幀微移造成 shimmering） */
const SHADOW_SNAP = 4
/** AC14：每 2 秒印一次 draw calls 與 fps */
const PERF_LOG_MS = 2000
/** 斜坡上的車身俯仰（spec §1.4：−atan(JUMP_H / 6)） */
const RAMP_PITCH = -Math.atan(JUMP_H / 6)
/** 前輪轉向擺角（spec §4.1；甩尾時 ×1.3 反打） */
const FRONT_STEER = 0.42
/** 胎痕池（spec §8 #6：桌機 160、手機 80） */
const SKID_CAP = { desktop: 160, mobile: 80 } as const
/** 碰撞火花：兩車中心距離在推擠距離＋這個餘裕內才算撞到 */
const CLASH_SLACK = 0.3
/** 小地圖輪廓最多幾個點 */
const MAP_PTS = 160

const COURSE = RACE_COURSE
const TRACK = COURSE.track
const BOXES = boxLayout(COURSE)
/** 小地圖輪廓：開局算一次、之後原參照傳給 React（共用契約：map.pts 不變） */
const HUD_PTS = mapOutline(TRACK.pts, MAP_PTS)

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
  /** 本機知道的高度；null = 他車／guest 的 bot，依 s 對照跳台推算 */
  y: number | null
  /** 沿線距離（推算跳台高度時先用它粗篩，免得每幀對每台車做投影） */
  s: number
  drift: DriftTier
  /** 正在蓄甩尾（含 0 段）；他車以 drift > 0 近似 */
  drifting: boolean
  spin: boolean
  ghost: boolean
  shield: boolean
  boost: boolean
  /** 本機輸入的轉向；他車沒有，以偏航角速度反推 */
  steer?: number
  /** 本機知道的騰空垂直速度與是否在坡上（自己與 host 的 bot） */
  air?: { vy: number } | null
  onRamp?: boolean
  /** 本機知道的離中心線距離（自己與 host 的 bot）；其他車由位置投影 */
  lateral?: number
  /** 急煞（只有自己知道，胎痕用） */
  braking?: boolean
  /** 護盾剩餘（自己與 host 的 bot；最後 2 秒閃） */
  shieldLeftMs?: number
  /** 沒有 ghost 旗標（guest 端的 bot：botState 不帶 ghost） */
  noGhost?: boolean
}

interface ItemView {
  kind: 'banana' | 'shell'
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
  private chase!: ChaseState
  private look!: ToyLook
  private world!: RaceWorld
  private kit!: CarKit
  /** 陰影被自動降級關掉後，車改墊 blob 影 */
  private blobShadows = false
  private shadowKey = ''
  private lastInput: DriveInput = { throttle: 0, steer: 0, drifting: false }
  private resultElapsed = 0
  private lastOverlayKey = ''
  private banner!: TextPanel
  // 特效（AC11）與 React HUD（AC12）
  private fx!: RaceFx
  /** 道具欄轉盤到這個時刻（撿到道具箱 + ROLL_MS） */
  private rollUntil = 0
  /** HUD 的本圈時間：只在比賽中、未完賽時前進，其餘時候凍結 */
  private hudLapMs = 0
  private lastHudKey = ''
  private shakeAt = -Infinity
  private shakeOk = false
  private reducedMotion = false
  private readonly clashLast = new Map<string, number>()
  /** 衝線彩帶：各車上一幀的 fin（null → 數值時播） */
  private readonly fxFin = new Map<string, number | null>()
  /** 本端播過的特效計數（給 qa 從 __BATTLE_POS 判讀特效表連拍） */
  private fxSeen = { respawn: 0, land: 0, lapCard: 0, confetti: 0, boxBreak: 0, pad: 0, mushroom: 0, shieldBreak: 0, shellBoom: 0, bananaDie: 0, clash: 0, shake: 0 }
  // AC14：draw calls 量測；?raceBench=1（限 raceNoDegrade=1）擺固定量測場景
  private instr: SceneInstrumentation | null = null
  private lastPerfLog = 0
  private bench = false
  private benchItems: WorldItem[] = []
  /** 本端看到的道具事件計數（給 qa 從 __BATTLE_POS 判讀）；clash＝香蕉與龜殼互撞消失（itemGone reason），車對車碰撞火花在 fxSeen.clash */
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
    this.itemViews.clear()
    this.sentTakenKey = ''
    this.seen = { grant: 0, spawn: 0, spin: 0, blocked: 0, hit: 0, expire: 0, clash: 0 }
    this.rollUntil = 0
    this.hudLapMs = 0
    this.lastHudKey = ''
    this.shakeAt = -Infinity
    this.clashLast.clear()
    this.fxFin.clear()
    this.fx.reset()
    this.fxSeen = { respawn: 0, land: 0, lapCard: 0, confetti: 0, boxBreak: 0, pad: 0, mushroom: 0, shieldBreak: 0, shellBoom: 0, bananaDie: 0, clash: 0, shake: 0 }
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
    if (this.bench) this.applyBench()
  }

  /** ?raceBench=1：每台車各持一種道具（bot 不會用掉，量測條件固定） */
  private applyBench(): void {
    const held = benchLayout(COURSE).held
    const kindOf = (id: string) => held[this.slotOf(id) % held.length]
    this.item = kindOf(this.ctx.selfId)
    if (this.ctx.role !== 'host') return
    this.hold.set(this.ctx.selfId, this.item)
    for (const [id, b] of this.botSims) {
      b.item = kindOf(id)
      this.hold.set(id, b.item)
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

    // 追尾相機（spec §7）
    this.camera = new ArcRotateCamera('cam', -Math.PI / 2, CHASE.beta, CHASE.radius[0], Vector3.Zero(), scene)
    this.camera.minZ = CHASE.minZ
    this.camera.maxZ = CHASE.maxZ
    // 光影與後製（AC10）：雙光、陰影（跟車走）、Glow 白名單、描邊、後製、解析度與檔位（AC13）；陰影被降級關掉時車改墊 blob 影
    this.look = new ToyLook(scene, this.camera, {
      shadowRadius: SHADOW_RADIUS,
      tag: 'race',
      outline: OUTLINE,
      exposure: 1.08,
      contrast: 1.08,
      onDegrade: (step) => {
        if (step === 'shadow') this.blobShadows = true
      },
    })
    // 天色＝霧色（同一個後製轉換，地平線才接得上）；用 skyClear 預先補償 ACES 壓掉的飽和度
    scene.clearColor = Color4.FromHexString(`${RACE.skyClear}FF`)
    scene.fogMode = Scene.FOGMODE_LINEAR
    scene.fogStart = 110
    scene.fogEnd = 230
    scene.fogColor = Color3.FromHexString(RACE.skyClear)

    // 場景（AC9）：桌墊、路面、路緣、拱門、看台、積木、樹、錐、跳台、加速帶、道具箱、香蕉、龜殼
    const mobile = this.look.tier === 'mobile'
    this.world = new RaceWorld(scene, COURSE, BOXES, {
      matSize: mobile ? 512 : 1024,
      crowdHop: !mobile,
    })
    const fx = this.world.fxTargets()
    this.look.toon(...fx.toon)
    this.look.receiver(...fx.receivers)
    this.look.caster(...fx.casters)
    this.look.outline(...fx.outlined)
    for (const g of fx.glow) this.look.glowMesh(g.mesh, g.color, g.strength)
    for (const g of fx.glowOwn) this.look.glowOwnMaterial(g.mesh, g.strength)
    // 車：合併車身（投影＋描邊在 makeCar 登記）、共用輪胎 thin instance（投影、不描邊）、3 段火花芯（Glow）
    this.kit = new CarKit(scene)
    this.look.toon(...this.kit.litMaterials)
    this.look.caster(this.kit.wheels.mesh)
    this.look.glowMesh(this.kit.cores.mesh, DRIFT_COLORS[3], 1)
    // 特效（AC11、spec §8）：粒子每組上限依檔位；鏡頭微震在 prefers-reduced-motion 或手機檔關閉
    const ap = archPose(TRACK)
    const beamEnd = (lx: number): [number, number, number] => [ap.x + lx * Math.cos(ap.yaw), 6.2, ap.z - lx * Math.sin(ap.yaw)]
    this.fx = new RaceFx(scene, this.look, {
      cap: this.look.settings.particleCap,
      skidCap: SKID_CAP[this.look.tier],
      confettiAt: [beamEnd(-7.6), beamEnd(7.6)],
      ghostMs: RESPAWN_GHOST_MS,
    })
    this.reducedMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    this.shakeOk = shakeAllowed({ reducedMotion: this.reducedMotion, mobile })

    // AC14：draw calls 量測；量測場景只在 raceNoDegrade=1 下生效
    this.instr = new SceneInstrumentation(scene)
    this.bench = typeof window !== 'undefined' && benchEnabled(tierQuery(window.location.search, window.location.hash))
    if (this.bench) {
      const lay = benchLayout(COURSE)
      this.benchItems = [
        ...lay.bananas.map((p, i): WorldItem => ({ id: `bench-b${i}`, kind: 'banana', ...p })),
        ...lay.shells.map((p, i): WorldItem => ({ id: `bench-s${i}`, kind: 'shell', ...p })),
      ]
    }

    if (ctx.role === 'host') this.bots = makeRaceBots(ctx.players.length)
    this.resetRace()
    this.selfVisual = this.makeCar(ctx.selfId)
    this.chase = initChase(this.chaseInput('playing'))

    // 開局倒數：玩具系列配色，掛在不經後製的 UI 相機
    if (typeof document !== 'undefined') void document.fonts?.load('bold 64px Fredoka').catch(() => undefined)
    this.banner = createCountdownPanel(scene, this.look.uiCamera, 'banner', 7, 4, new Vector3(0, 0.3, 8), {
      theme: COUNTDOWN_THEME,
      layerMask: UI_LAYER,
    })

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

  // ---- 車輛視覺（spec §4.1） ----

  private makeCar(id: string): CarVisual {
    const v = this.kit.make(id, this.colorIndexOf(id), !this.isPlayer(id), id === this.ctx.selfId)
    // 投影只限車與道具（AC10）；描邊車身（輪胎不描）
    this.look.caster(v.body)
    this.look.outline(v.body)
    return v
  }

  private visualFor(id: string): CarVisual {
    let v = this.carVisuals.get(id)
    if (!v) {
      v = this.makeCar(id)
      this.carVisuals.set(id, v)
    }
    return v
  }

  private removeCar(v: CarVisual): void {
    this.world.setCarBlob(v.id, 0, 0, false)
    this.fx.dropCar(v.id)
    disposeCarVisual(this.kit, v)
  }

  private applyPose(v: CarVisual, p: CarPose, dt: number, now: number): void {
    const dx = p.x - v.prevX
    const dz = p.z - v.prevZ
    // 起跑、重生是瞬移：不算輪胎轉動、不估轉向（門檻隨幀長放寬：低 fps 時一幀正常就能跑超過 5）
    const teleport = Math.hypot(dx, dz) > Math.max(5, BOOST_SPEED * dt * 1.5)
    // 剛建好的車 prev 在原點：第一幀的瞬移不算重生
    const fresh = v.prevX === 0 && v.prevZ === 0
    const fwd = teleport ? 0 : dx * Math.sin(p.ry) + dz * Math.cos(p.ry)
    const dRy = teleport ? 0 : wrapAngle(p.ry - v.prevRy)
    v.prevX = p.x
    v.prevZ = p.z
    v.prevRy = p.ry
    v.wheelSpin += fwd / WHEEL_R
    if (dt > 0) v.speedEst += (Math.abs(fwd) / dt - v.speedEst) * Math.min(1, dt * 8)
    const steer = p.steer ?? steerFromYaw(dRy, dt, v.speedEst)
    v.steer += (steer - v.steer) * Math.min(1, dt * 10)

    // 高度：自己與 host 的 bot 用模擬值；他車／guest 的 bot 由 s 對照跳台推算（波 2 Minor）
    let y = p.y
    let onRamp = p.onRamp ?? false
    let lateral = p.lateral
    if (y === null) {
      y = 0
      // 快照的 s 比插值後的位置新（最多一個快照間隔），只拿來粗篩；高度用插值位置投影出來的 s
      if (p.s > JUMP_S0 - 3 && p.s < JUMP_S1 + 32) {
        const prog = trackProgress(TRACK, p.x, p.z)
        y = remoteY(COURSE, prog.s, prog.lateral, v.speedEst)
        onRamp = rampY(COURSE, prog.s, prog.lateral) > 0
        lateral = prog.lateral
      }
    }
    lateral ??= trackProgress(TRACK, p.x, p.z).lateral
    const vy = dt > 0 ? (y - v.prevY) / dt : 0
    v.prevY = y
    const airborne = p.air !== undefined ? p.air !== null : y > 0 && !onRamp
    if (p.drifting && !v.wasDrifting) v.hopAt = now
    v.wasDrifting = p.drifting
    const pose = bodyPose({
      steer: v.steer,
      speedRatio: Math.min(1, v.speedEst / MAX_SPEED),
      drifting: p.drifting,
      boosting: p.boost,
      vy: p.air ? p.air.vy : vy,
      airborne,
      hopMs: v.hopAt < 0 ? -1 : now - v.hopAt,
      rampPitch: onRamp ? RAMP_PITCH : 0,
    })
    // 甩尾放開 120ms 回正（波 3 Minor M5）
    v.driftYaw = yawToward(v.driftYaw, pose.yaw, dt * 1000)

    // 重生（spec §8 #13）：ghost 由 false→true；guest 的 bot 沒有 ghost 旗標，以比賽中瞬移判定
    const respawned = (p.ghost && !v.wasGhost) || (p.noGhost === true && teleport && !fresh && this.flow.state.phase === 'playing')
    v.wasGhost = p.ghost
    if (respawned) {
      this.fx.respawn(v.id, p.x, p.z, now)
      this.fxSeen.respawn++
    }
    if (v.wasAirFx && !airborne) this.fxSeen.land++
    v.wasAirFx = airborne

    const cam = this.camera.position
    const fx = this.fx.car(
      {
        id: v.id,
        x: p.x,
        y,
        z: p.z,
        ry: p.ry,
        yaw: v.driftYaw,
        speed: v.speedEst,
        drift: p.drift,
        drifting: p.drifting,
        boost: p.boost,
        shield: p.shield,
        shieldLeftMs: p.shieldLeftMs ?? null,
        offTrack: Math.abs(lateral) > TRACK.width / 2,
        airborne,
        braking: p.braking ?? false,
      },
      now,
      dt * 1000,
      cam.x,
      cam.z
    )
    v.root.position.set(p.x, y + fx.dropY + fx.lift, p.z)
    v.root.rotation.y = p.ry
    v.visual.position.y = pose.dy
    v.visual.rotation.set(pose.rx, v.driftYaw + fx.spinYaw, pose.rz)
    v.visual.scaling.set(fx.sxz, fx.sy, fx.sxz)
    // 重生閃爍（spec §6）：visibility 1↔0.3 方波 10Hz；暗的半週期輪胎、火花芯、blob 影收起來
    v.body.visibility = fx.visibility
    if (v.you) v.you.visibility = fx.visibility
    v.hidden = fx.visibility < 1
    v.shield.setEnabled(fx.shield !== null)
    if (fx.shield) {
      v.shield.rotation.y += dt * 0.6
      v.shield.scaling.setAll(fx.shield.scale)
      v.shield.visibility = fx.shield.alpha
    }

    this.kit.putWheels(v, v.steer * FRONT_STEER * (p.drifting ? -1.3 : 1))
    this.kit.putCore(v, p.drift === 3 && p.drifting, cam.x, cam.z, now)
    this.world.setCarBlob(v.id, p.x, p.z, this.blobShadows && !v.hidden)
  }

  // ---- 道具畫面（香蕉、龜殼由 RaceWorld 的 thin instance 畫） ----

  private spawnItemView(id: string, kind: 'banana' | 'shell', x: number, z: number, vx: number, vz: number): void {
    if (this.itemViews.has(id)) return
    this.seen.spawn++
    this.itemViews.set(id, { kind, x, z, vx, vz })
  }

  /** reason 'hit' 的香蕉留一個被踩飛的動畫（spec §8 #9） */
  private removeItemView(id: string, reason?: string): void {
    const v = this.itemViews.get(id)
    if (v && reason === 'hit' && v.kind === 'banana') {
      this.world.killBanana(v.x, v.z, performance.now())
      this.fxSeen.bananaDie++
    }
    if (v?.kind === 'shell') this.fx.forgetTrail(id)
    this.itemViews.delete(id)
  }

  // ---- 事件特效（spec §8） ----

  /** 撿道具箱：箱子碎裂（所有人播）；撿到的是自己就開始道具欄轉盤 */
  private grantFx(box: number, who: string): void {
    const now = performance.now()
    const b = BOXES[box]
    this.world.breakBox(box, now)
    this.fx.boxBreak(b.x, b.z, now)
    this.fxSeen.boxBreak++
    if (who === this.ctx.selfId) this.rollUntil = now + ROLL_MS
  }

  /** 命中：打滑轉圈（龜殼另加爆炸與彈起）、護盾擋下碎裂、自己被打中鏡頭微震 */
  private spinFx(target: string, ms: number, blocked: boolean): void {
    const now = performance.now()
    const v = target === this.ctx.selfId ? this.selfVisual : this.carVisuals.get(target)
    const x = v?.root.position.x ?? 0
    const z = v?.root.position.z ?? 0
    if (blocked) {
      if (v) this.fx.shieldBlock(target, x, z, now)
      this.fxSeen.shieldBreak++
      return
    }
    const shell = ms > SPIN_MS
    this.fx.spin(target, ms, shell, now)
    if (shell && v) {
      this.fx.shellBoom(x, z)
      this.fxSeen.shellBoom++
    }
    if (target === this.ctx.selfId && this.shakeOk) {
      this.shakeAt = now
      this.fxSeen.shake++
    }
  }

  private mushroomFx(who: string): void {
    this.fx.mushroom(who, performance.now())
    this.fxSeen.mushroom++
  }

  private *worldItems(): Iterable<WorldItem> {
    for (const [id, v] of this.itemViews) yield { id, kind: v.kind, x: v.x, z: v.z }
    yield* this.benchItems
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
        this.grantFx(d.box, d.who)
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
        this.removeItemView(d.id, d.reason)
        this.seen[d.reason]++
        break
      }
      case 'spin': {
        const d = decodeSpin(p, ids)
        if (!d) return
        this.seen[d.blocked ? 'blocked' : 'spin']++
        this.spinFx(d.target, d.ms, d.blocked)
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
    this.grantFx(box, who)
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
    // 自己的加速菇在本機使用時就播了
    if (kind === 'mushroom' && who !== this.ctx.selfId) this.mushroomFx(who)
    if (kind !== 'banana' && kind !== 'shell') return
    const target = kind === 'shell' ? shellTarget(who, this.order()) : null
    const r = spawnField(this.field, kind, who, pose, target)
    this.field = r.field
    const e = r.entry
    this.broadcast('itemSpawn', { id: e.id, kind: e.kind, owner: who, x: e.x, z: e.z, vx: e.vx, vz: e.vz, target: e.target })
    this.spawnItemView(e.id, e.kind, e.x, e.z, e.vx, e.vz)
    for (const id of r.overflow) {
      this.broadcast('itemGone', { id, reason: 'expire' })
      this.removeItemView(id, 'expire')
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
      this.removeItemView(ev.id, ev.reason)
      this.seen[ev.reason]++
      return
    }
    this.broadcast('spin', { target: ev.target, ms: ev.ms, blocked: ev.blocked })
    this.seen[ev.blocked ? 'blocked' : 'spin']++
    this.spinFx(ev.target, ev.ms, ev.blocked)
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
      if (out.useItem && b.item && b.fin === null && !this.bench) {
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

    // 過線順序（以 host 觀察到的先後；最佳圈在 stepClocks，各端都算）
    const cars = this.liveCars()
    for (const c of cars) {
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

  /** 各車圈時（最佳圈給 HUD 與結算；各端都算，host 的結算用自己這份） */
  private stepClocks(now: number): void {
    for (const c of this.liveCars()) {
      const clock = this.lapClocks.get(c.id) ?? makeLapClock(this.playStart)
      this.lapClocks.set(c.id, stepLapClock(clock, c.lap, now))
    }
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
    this.lastInput = input
    const step = stepRacer(this.racer, input, { course: COURSE, others: this.positionsExcept(this.ctx.selfId) }, dt)
    this.racer = step.state
    for (const ev of step.events) {
      if (ev === 'lap') {
        playSfx('lap')
        // 換圈 3D 浮字（spec §8 #14）：LAP 2、LAP 3
        const shown = this.racer.lap.lap + 1
        if (shown === 2 || shown === 3) {
          this.fx.card(shown === 2 ? 'LAP 2' : 'LAP 3', this.ctx.selfId, now)
          this.fxSeen.lapCard++
        }
      } else if (ev === 'finish') {
        if (this.fin === null) this.fin = Math.min(OWN_FIN_MAX, Math.round(now - this.playStart))
        this.fx.card('完賽', this.ctx.selfId, now)
        playSfx('round_end')
      } else if (ev === 'turbo') playSfx('tank_bounce')
      else if (ev === 'pad') {
        playSfx('tank_bounce')
        // 加速帶觸發閃光（spec §8 #17）
        this.world.flashPads(now)
        this.fx.padBurst(this.racer.car.x, this.racer.car.z, this.racer.car.ry)
        this.fxSeen.pad++
      }
    }

    // 使用道具（e）
    if (this.useQueued) {
      this.useQueued = false
      const kind = this.item
      // 過線後不撿不用道具，不干擾還在比賽的車
      // bench 量測條件固定：自己手上的道具也不用掉（不然會再去撿箱子）
      if (kind && this.fin === null && !this.bench) {
        this.item = null
        this.racer = applyItemSelf(this.racer, kind)
        if (kind === 'mushroom') this.mushroomFx(this.ctx.selfId)
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

    this.stepClocks(now)
    if (this.ctx.role === 'host') this.hostTick(dt, now)
    if (this.fin === null) this.hudLapMs = now - (this.lapClocks.get(this.ctx.selfId)?.startAt ?? this.playStart)

    engineSet(Math.min(1, Math.abs(this.racer.car.speed) / MAX_SPEED))
  }

  // ---- 畫面更新 ----

  private chaseMode(): ChaseMode {
    if (this.fin !== null) return 'finished'
    return this.flow?.state.phase === 'countdown' ? 'countdown' : 'playing'
  }

  private chaseInput(mode: ChaseMode) {
    const r = this.racer
    return {
      x: r.car.x,
      z: r.car.z,
      y: r.y,
      ry: r.car.ry,
      speed: r.car.speed,
      boosting: r.boostMs > 0,
      mode,
      countdownMs: mode === 'countdown' ? this.flow.countdownRemaining() : 0,
    }
  }

  private selfPose(): CarPose {
    const r = this.racer
    return {
      x: r.car.x,
      z: r.car.z,
      ry: r.car.ry,
      y: r.y,
      s: r.s,
      drift: r.drift.tier,
      drifting: r.drift.charge > 0,
      spin: r.spinMs > 0,
      ghost: r.ghostMs > 0,
      shield: r.shieldMs > 0,
      boost: r.boostMs > 0,
      steer: this.lastInput.steer,
      air: r.air ? { vy: r.air.vy - JUMP_G * r.air.t } : null,
      onRamp: r.onRamp,
      lateral: r.lateral,
      braking: this.lastInput.throttle < 0 && r.car.speed > 0,
      shieldLeftMs: r.shieldMs,
    }
  }

  update(deltaMs: number): void {
    const dt = deltaMs * 0.001
    const phase = this.flow.state.phase
    const now = performance.now()
    const r = this.racer

    if (this.selfVisual) this.applyPose(this.selfVisual, this.selfPose(), dt, now)

    // 追尾相機（spec §7）：甩尾時跟移動方向，不跟車身偏航
    this.chase = stepChase(this.chase, this.chaseInput(this.chaseMode()), dt)
    const c = this.chase
    this.camera.alpha = c.alpha
    this.camera.beta = c.beta
    this.camera.radius = c.radius
    this.camera.fov = c.fov
    this.camera.target.set(c.target[0], c.target[1], c.target[2])
    // 鏡頭微震（spec §7、§8 #16）：自己被命中 220ms ±0.18 線性衰減
    const amp = this.shakeOk ? shakeAmp(now - this.shakeAt) : 0
    if (amp > 0) this.camera.target.addInPlaceFromFloats((fxRandom() * 2 - 1) * amp, (fxRandom() * 2 - 1) * amp, (fxRandom() * 2 - 1) * amp)
    // 陰影框跟著自己的車走（4 單位量化）
    const sx = snapGrid(r.car.x, SHADOW_SNAP)
    const sz = snapGrid(r.car.z, SHADOW_SNAP)
    const key = `${sx},${sz}`
    if (key !== this.shadowKey) {
      this.shadowKey = key
      this.look.setShadowCenter(sx, sz)
    }

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
            s: br.s,
            drift: br.drift.tier,
            drifting: br.drift.charge > 0,
            spin: br.spinMs > 0,
            ghost: br.ghostMs > 0,
            shield: br.shieldMs > 0,
            boost: br.boostMs > 0,
            air: br.air ? { vy: br.air.vy - JUMP_G * br.air.t } : null,
            onRamp: br.onRamp,
            lateral: br.lateral,
            shieldLeftMs: br.shieldMs,
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
      this.removeCar(v)
      this.carVisuals.delete(id)
    }

    // 香蕉／龜殼外插（guest）、場景動畫、thin instance 上傳、自動降級
    if (this.ctx.role !== 'host') {
      for (const v of this.itemViews.values()) {
        v.x += v.vx * dt
        v.z += v.vz * dt
      }
    }
    this.world.update(now, dt, this.taken, this.worldItems())
    this.updateFx(phase, now, deltaMs)
    this.kit.sync()
    this.look.update(deltaMs)

    // AC14：每 2 秒印 draw calls 與 fps（讀上一幀的完整計數；還沒渲染過的首次取樣不印）
    if (this.instr && now - this.lastPerfLog >= PERF_LOG_MS) {
      this.lastPerfLog = now
      const line = perfLogLine(this.instr.drawCallsCounter.current, this.ctx.scene.getEngine().getFps(), 'race')
      if (line) console.info(line)
    }

    this.syncHud(phase, now)
    this.writeDebugPos()

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
    a: { x: number; z: number; ry: number; s: number; drift: DriftTier; spin: boolean },
    b: { x: number; z: number; ry: number; s: number; drift: DriftTier; spin: boolean },
    alpha: number,
    flags: RaceOwn | null
  ): CarPose {
    return {
      x: a.x + (b.x - a.x) * alpha,
      z: a.z + (b.z - a.z) * alpha,
      ry: lerpAngle(a.ry, b.ry, alpha),
      y: null,
      s: b.s,
      drift: b.drift,
      drifting: b.drift > 0,
      spin: b.spin,
      ghost: flags?.ghost ?? false,
      shield: flags?.shield ?? false,
      boost: flags?.boost ?? false,
      noGhost: flags === null,
    }
  }

  /** 畫面上的所有車（自己、他車、bot），特效與 HUD 小地圖用 */
  private visuals(): CarVisual[] {
    return this.selfVisual ? [this.selfVisual, ...this.carVisuals.values()] : [...this.carVisuals.values()]
  }

  /** 自己的尾流風線、速度線、鏡頭微震以外的全場特效：碰撞火花、衝線彩帶、龜殼拖尾 */
  private updateFx(phase: string, now: number, deltaMs: number): void {
    const r = this.racer
    const playing = phase === 'playing'

    // 碰撞火花（spec §8 #7）：各端播自己參與的那一對；bot 對 bot 由 host 播
    const vis = this.visuals()
    for (let i = 0; i < vis.length; i++) {
      for (let j = i + 1; j < vis.length; j++) {
        const a = vis[i]
        const b = vis[j]
        const mine = a.id === this.ctx.selfId || b.id === this.ctx.selfId
        const botPair = this.ctx.role === 'host' && !this.isPlayer(a.id) && !this.isPlayer(b.id)
        if (!playing || (!mine && !botPair)) continue
        const pa = a.root.position
        const pb = b.root.position
        if (Math.hypot(pa.x - pb.x, pa.z - pb.z) > CAR_PUSH_DIST + CLASH_SLACK) continue
        if (relSpeed({ speed: a.speedEst, ry: a.root.rotation.y }, { speed: b.speedEst, ry: b.root.rotation.y }) <= CLASH_SPEED) continue
        if (!clashReady(this.clashLast, clashKey(a.id, b.id), now)) continue
        this.fx.clash((pa.x + pb.x) / 2, Math.max(pa.y, pb.y), (pa.z + pb.z) / 2)
        this.fxSeen.clash++
      }
    }

    // 衝線彩帶（spec §8 #15）：任何車 fin 由 null 變成數值
    for (const id of finishEdges(this.fxFin, this.liveCars(), playing)) {
      this.fx.finish(id === this.ctx.selfId)
      this.world.cheer(now)
      this.fxSeen.confetti++
    }

    // 龜殼拖尾（spec §8 #10）
    for (const [id, v] of this.itemViews) if (v.kind === 'shell') this.fx.shellTrail(id, v.x, v.z, deltaMs)

    // 尾流風線（spec §8 #3，只畫自己）與速度線（§8 #4）
    const slip = playing ? slipLook(r.slipChargeMs > 0, r.slipMs > 0) : { count: 0, alpha: 0 }
    this.fx.slip(slip.count, slip.alpha, r.car.x, r.y, r.car.z, r.car.ry, now)
    const cap = speedLineCap({ reducedMotion: this.reducedMotion, mobile: this.look.tier === 'mobile' })
    const alpha = playing && this.fin === null ? speedLineAlpha(Math.abs(r.car.speed) / MAX_SPEED, r.boostMs > 0, cap) : 0
    const engine = this.ctx.scene.getEngine()
    this.fx.speedLines(alpha, now, this.look.uiCamera.fov, engine.getRenderWidth() / Math.max(1, engine.getRenderHeight()))
    this.fx.update(now)
  }

  /** React HUD（AC12，共用契約 RaceHud）：比賽中每幀一張；結算凍結在最後一張 */
  private syncHud(phase: string, now: number): void {
    const setHud = this.ctx.setHud
    if (!setHud || phase === 'result') return
    const pos = new Map(this.visuals().map((v) => [v.id, v.root.position]))
    const cars: RaceHudCarInput[] = this.liveCars().map((c) => {
      const p = pos.get(c.id)
      return {
        id: c.id,
        colorIndex: this.colorIndexOf(c.id),
        x: p?.x ?? 0,
        z: p?.z ?? 0,
        fin: c.fin,
        name: this.nameFor(c.id),
        bestLapMs: this.lapClocks.get(c.id)?.bestMs ?? null,
      }
    })
    const r = this.racer
    const hud = buildRaceHud({
      selfId: this.ctx.selfId,
      order: this.order(),
      laps: LAPS,
      ownLap: r.lap.lap,
      lapMs: phase === 'playing' ? this.hudLapMs : 0,
      bestLapMs: this.lapClocks.get(this.ctx.selfId)?.bestMs ?? null,
      item: this.item,
      rollingUntil: this.rollUntil,
      now,
      wrongWay: phase === 'playing' && r.wrongWay,
      fin: this.fin,
      pts: HUD_PTS,
      cars: cars.filter((c) => pos.has(c.id)),
    })
    const key = JSON.stringify({ ...hud, map: hud.map.cars })
    if (key === this.lastHudKey) return
    this.lastHudKey = key
    setHud(hud)
  }

  /** 給 qa 判讀的數值（AC17：bot 座標兩端比對用 botPos，host 為模擬值、guest 為最新 botState） */
  private writeDebugPos(): void {
    const r = this.racer
    const order = this.order()
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
      rank: order.indexOf(this.ctx.selfId) + 1,
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
      botPos: this.botStates().map((b) => ({ id: b.id, x: b.x, z: b.z, ry: b.ry, lap: b.lap, cp: b.cp, s: b.s, fin: b.fin })),
      order,
      items: this.itemViews.size,
      taken: this.taken.length,
      seen: { ...this.seen },
      fx: { ...this.fxSeen },
      fxLive: this.fx.liveCounts(),
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
    if (this.selfVisual) this.removeCar(this.selfVisual)
    for (const v of this.carVisuals.values()) this.removeCar(v)
    this.carVisuals.clear()
    this.itemViews.clear()
    this.ctx.setHud?.(null)
    this.banner.dispose()
    this.instr?.dispose()
    this.instr = null
    this.fx.dispose()
    this.world.dispose()
    this.kit.dispose()
    this.look.dispose()
    this.ctx.scene.fogMode = Scene.FOGMODE_NONE
  }
}

export const createRaceScene = (): GameModule => new RaceScene()
