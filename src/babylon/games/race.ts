import {
  ArcRotateCamera,
  Color3,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core'
import type { GameContext, GameModule, GameOverlay, GamePlayer } from '@/babylon/types'
import { lerpAngle, quadrantOf, stepQuarters } from '@/babylon/math'
import { createCountdownPanel, createTextPanel, type TextPanel } from '@/babylon/hud'
import { attachFlowAudio, engineStart, engineSet, engineStop, playSfx, stopAllAudio } from '@/babylon/audio'
import {
  createFixedTicker,
  createGameFlow,
  createOwnershipSync,
  type FixedTicker,
  type GameFlow,
  type OwnershipSync,
} from '@/babylon/net'

/**
 * 極速賽車 v2 — 強化版（美術 / 音效 / 可玩性全面升級）。
 *
 * 同步模型：分散式所有權——每人本地模擬自己的車（零輸入延遲），
 * 20Hz 廣播 {x,z,ry,q}，他車插值；host 只裁決名次。
 *
 * 新增功能：
 * - 引擎持續音（音高隨速度）
 * - 漂移系統（Space 鍵甩尾，更快轉向）
 * - 碰撞推擠（車對車）
 * - 加速帶（跑道上隨機生成）
 * - 迷你地圖
 * - 更精緻的車輛模型（底盤/輪子/尾翼）
 * - 塵土粒子效果（出賽道時）
 * - 速度/名次 HUD
 */

interface CarState {
  x: number
  z: number
  ry: number
  q: number
}

interface Standing {
  id: string
  name: string
  q: number
}

const SIM_HZ = 30
const LAPS = 3
const FINISH_Q = LAPS * 4

// 賽道幾何
const R_INNER = 14
const R_OUTER = 22
const GROUND_SIZE = 56

// 車輛運動學
const MAX_SPEED = 17
const MAX_REVERSE = 5
const ACCEL = 13
const BRAKE = 22
const DRAG = 4.5
const TURN_RATE = 2.4
const OFFTRACK_FACTOR = 0.3
const DRIFT_TURN_MULT = 1.8
const DRIFT_DRAG = 2.0
const CAR_PUSH_DIST = 1.4
const CAR_PUSH_FORCE = 6

// 加速帶
const BOOST_PAD_RADIUS = 1.2
const BOOST_SPEED = 22
const BOOST_DURATION_MS = 1500

// 迷你地圖

class RaceScene implements GameModule {
  readonly gameId = 'race'
  private ctx!: GameContext
  private keys = new Set<string>()
  private ticker!: FixedTicker
  private own!: OwnershipSync<CarState>
  private flow!: GameFlow

  private state: CarState = { x: 0, z: 0, ry: 0, q: 0 }
  private speed = 0
  private lastQuad = 0
  private spawnIdx = 0
  private drifting = false
  private boostUntil = 0

  private selfVisual?: CarVisual
  private peerVisuals = new Map<string, CarVisual>()
  private camera!: ArcRotateCamera
  private resultElapsed = 0
  private lastOverlayKey = ''

  private decorations: Mesh[] = []
  private boostPads: { x: number; z: number; mesh: Mesh }[] = []
  private dustParticles: DustParticle[] = []

  private hud!: TextPanel
  private banner!: TextPanel
  private minimap!: TextPanel

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.key.toLowerCase())
    if (e.key.toLowerCase() === 'r') this.requestRestart()
  }
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase())

  private colorFor(id: string): Color3 {
    let h = 0
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
    return Color3.FromHSV(h % 360, 0.7, 0.9)
  }

  private nameFor(id: string): string {
    return this.ctx.players.find((p: GamePlayer) => p.id === id)?.name ?? id.slice(0, 6)
  }

  // ---- 車輛視覺 ----

  private makeCar(id: string): CarVisual {
    const scene = this.ctx.scene
    const color = this.colorFor(id)

    // 材質
    const bodyMat = new StandardMaterial(`car-body-${id}`, scene)
    bodyMat.diffuseColor = color
    bodyMat.specularColor = new Color3(0.4, 0.4, 0.4)

    const darkMat = new StandardMaterial(`car-dark-${id}`, scene)
    darkMat.diffuseColor = color.scale(0.45)

    const wheelMat = new StandardMaterial(`car-wheel-${id}`, scene)
    wheelMat.diffuseColor = new Color3(0.12, 0.12, 0.14)

    const glassMat = new StandardMaterial(`car-glass-${id}`, scene)
    glassMat.diffuseColor = new Color3(0.3, 0.5, 0.7)
    glassMat.alpha = 0.7

    const headlightMat = new StandardMaterial(`car-light-${id}`, scene)
    headlightMat.emissiveColor = new Color3(1, 0.95, 0.8)
    headlightMat.disableLighting = true

    const spoilerMat = new StandardMaterial(`car-spoiler-${id}`, scene)
    spoilerMat.diffuseColor = color.scale(0.6)

    // 根節點
    const root = new Mesh(`car-${id}`, scene)
    root.position.y = 0

    // 底盤（低矮流線型）
    const chassis = MeshBuilder.CreateBox(`chassis-${id}`, { width: 1.3, height: 0.3, depth: 2.2 }, scene)
    chassis.material = bodyMat
    chassis.parent = root
    chassis.position.y = 0.25

    // 引擎蓋（前方斜面）
    const hood = MeshBuilder.CreateBox(`hood-${id}`, { width: 1.1, height: 0.12, depth: 0.7 }, scene)
    hood.material = bodyMat
    hood.parent = root
    hood.position.set(0, 0.45, 0.55)
    hood.rotation.x = -0.15

    // 車頂/駕駛艙
    const cabin = MeshBuilder.CreateBox(`cabin-${id}`, { width: 0.85, height: 0.35, depth: 0.8 }, scene)
    cabin.material = glassMat
    cabin.parent = root
    cabin.position.set(0, 0.55, -0.1)

    // 尾翼
    const wingPostL = MeshBuilder.CreateBox(`wing-pl-${id}`, { width: 0.08, height: 0.3, depth: 0.08 }, scene)
    wingPostL.material = spoilerMat
    wingPostL.parent = root
    wingPostL.position.set(-0.4, 0.55, -0.95)

    const wingPostR = MeshBuilder.CreateBox(`wing-pr-${id}`, { width: 0.08, height: 0.3, depth: 0.08 }, scene)
    wingPostR.material = spoilerMat
    wingPostR.parent = root
    wingPostR.position.set(0.4, 0.55, -0.95)

    const wing = MeshBuilder.CreateBox(`wing-${id}`, { width: 1.1, height: 0.06, depth: 0.25 }, scene)
    wing.material = spoilerMat
    wing.parent = root
    wing.position.set(0, 0.72, -0.95)

    // 四個輪子
    const wheels: Mesh[] = []
    const wheelPositions: [number, number, number][] = [
      [-0.65, 0.15, 0.6],
      [0.65, 0.15, 0.6],
      [-0.65, 0.15, -0.6],
      [0.65, 0.15, -0.6],
    ]
    for (let i = 0; i < 4; i++) {
      const wheel = MeshBuilder.CreateCylinder(`wheel-${i}-${id}`, { height: 0.15, diameter: 0.35 }, scene)
      wheel.material = wheelMat
      wheel.parent = root
      const [wx, wy, wz] = wheelPositions[i]
      wheel.position.set(wx, wy, wz)
      wheel.rotation.z = Math.PI / 2
      wheels.push(wheel)
    }

    // 頭燈
    for (const side of [-0.4, 0.4]) {
      const light = MeshBuilder.CreateBox(`headlight-${side}-${id}`, { width: 0.18, height: 0.1, depth: 0.05 }, scene)
      light.material = headlightMat
      light.parent = root
      light.position.set(side, 0.35, 1.12)
    }

    return { root, wheels, driftSparks: [], prevX: 0, prevZ: 0 }
  }

  private spawnPose(idx: number): { x: number; z: number; ry: number } {
    const r = 16.5 + (idx % 2) * 3
    const a = 0.12 + Math.floor(idx / 2) * 0.14
    return { x: Math.sin(a) * r, z: Math.cos(a) * r, ry: a + Math.PI / 2 }
  }

  private resetCar(): void {
    const p = this.spawnPose(this.spawnIdx)
    this.state = { x: p.x, z: p.z, ry: p.ry, q: 0 }
    this.speed = 0
    this.lastQuad = quadrantOf(p.x, p.z)
    this.drifting = false
    this.boostUntil = 0
  }

  // ---- 加速帶 ----

  private initBoostPads(): void {
    const scene = this.ctx.scene
    const mat = new StandardMaterial('boost-mat', scene)
    mat.diffuseColor = new Color3(0.1, 0.6, 0.95)
    mat.emissiveColor = new Color3(0.05, 0.3, 0.6)

    const positions = [
      { x: 0, z: (R_INNER + R_OUTER) / 2 + 2 },   // 象限 0
      { x: (R_INNER + R_OUTER) / 2, z: 0 },        // 象限 1
      { x: 0, z: -(R_INNER + R_OUTER) / 2 - 2 },   // 象限 2
      { x: -(R_INNER + R_OUTER) / 2, z: 0 },       // 象限 3
    ]

    for (const pos of positions) {
      const mesh = MeshBuilder.CreateCylinder(`boost-${pos.x}-${pos.z}`, {
        diameter: BOOST_PAD_RADIUS * 2,
        height: 0.05,
      }, scene)
      mesh.position.set(pos.x, 0.03, pos.z)
      mesh.material = mat
      this.boostPads.push({ x: pos.x, z: pos.z, mesh })
    }
  }

  private checkBoostPad(): void {
    const now = performance.now()
    if (this.boostUntil > now) return
    for (const pad of this.boostPads) {
      const dist = Math.hypot(this.state.x - pad.x, this.state.z - pad.z)
      if (dist < BOOST_PAD_RADIUS) {
        this.boostUntil = now + BOOST_DURATION_MS
        this.speed = Math.max(this.speed, BOOST_SPEED)
        playSfx('lap')
        break
      }
    }
  }

  // ---- 塵土粒子 ----

  private spawnDust(): void {
    const r = Math.hypot(this.state.x, this.state.z)
    if (r >= R_INNER && r <= R_OUTER) return
    if (Math.abs(this.speed) < 2) return
    if (this.dustParticles.length > 20) return

    const scene = this.ctx.scene
    const mesh = MeshBuilder.CreateSphere(`dust-${Date.now()}`, { diameter: 0.3 }, scene)
    mesh.position.set(this.state.x, 0.2, this.state.z)
    const mat = new StandardMaterial(`dust-mat-${Date.now()}`, scene)
    mat.diffuseColor = new Color3(0.55, 0.45, 0.3)
    mat.alpha = 0.6
    mesh.material = mat
    this.dustParticles.push({
      mesh,
      life: 0.5,
      vx: (Math.random() - 0.5) * 2,
      vz: (Math.random() - 0.5) * 2,
    })
  }

  // ---- 漂移火花 ----

  private spawnDriftSparks(visual: CarVisual): void {
    if (!this.drifting || Math.abs(this.speed) < 5) return
    if (visual.driftSparks.length > 8) return

    const scene = this.ctx.scene
    const spark = MeshBuilder.CreateBox(`spark-${Date.now()}`, { size: 0.08 }, scene)
    spark.position.set(
      visual.root.position.x + (Math.random() - 0.5) * 0.5,
      0.1,
      visual.root.position.z + (Math.random() - 0.5) * 0.5,
    )
    const mat = new StandardMaterial(`spark-mat-${Date.now()}`, scene)
    mat.emissiveColor = new Color3(1, 0.7, 0.2)
    mat.disableLighting = true
    spark.material = mat
    visual.driftSparks.push({ mesh: spark, life: 0.3 })
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
    this.flow.startCountdown(3)
  }

  private syncOverlay(): void {
    const setOverlay = this.ctx.setOverlay
    if (!setOverlay) return

    const phase = this.flow.state.phase
    let overlay: GameOverlay | null = null

    if (phase === 'result') {
      const standings = (this.flow.state.result as Standing[] | undefined) ?? []
      const win = standings[0]?.id === this.ctx.selfId
      overlay = {
        title: win ? '🏆 你獲得勝利！' : '🏁 對局結束',
        subtitle: standings.map((s, i) => {
          const laps = Math.floor(s.q / 4)
          return `${i + 1}. ${s.name} — ${laps} 圈`
        }).join('\n'),
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
    new HemisphericLight('light', new Vector3(0, 1, 0), scene)

    // 場地
    const ground = MeshBuilder.CreateGround('ground', { width: GROUND_SIZE, height: GROUND_SIZE }, scene)
    const gmat = new StandardMaterial('gmat', scene)
    gmat.diffuseColor = new Color3(0.16, 0.32, 0.18)
    ground.material = gmat

    const track = MeshBuilder.CreateDisc('track', { radius: R_OUTER, tessellation: 96 }, scene)
    track.rotation.x = Math.PI / 2
    track.position.y = 0.01
    const tmat = new StandardMaterial('tmat', scene)
    tmat.diffuseColor = new Color3(0.22, 0.24, 0.28)
    track.material = tmat

    const infield = MeshBuilder.CreateDisc('infield', { radius: R_INNER, tessellation: 96 }, scene)
    infield.rotation.x = Math.PI / 2
    infield.position.y = 0.02
    infield.material = gmat

    // 起跑/終點線（棋盤格）
    this.buildStartFinishLine()

    // 賽道標線（內外圈虛線）
    this.buildTrackMarkings()

    // 加速帶
    this.initBoostPads()

    // 裝飾
    this.buildDecorations()

    // 自車
    this.spawnIdx = Math.max(0, ctx.players.findIndex((p) => p.id === ctx.selfId))
    this.selfVisual = this.makeCar(ctx.selfId)
    this.resetCar()

    this.hud = createTextPanel(scene, this.camera, 'hud', 4, 0.8, new Vector3(0, 2.4, 8))
    this.banner = createCountdownPanel(scene, this.camera, 'banner', 7, 4, new Vector3(0, 0.3, 8))
    this.minimap = createTextPanel(scene, this.camera, 'minimap', 2, 2, new Vector3(-3.5, 2.2, 6))

    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)

    this.flow = createGameFlow({ net: ctx.net, game: this.gameId, role: ctx.role })
    attachFlowAudio(this.flow, 'race', {
      resultSfx: (r) => ((r as Standing[] | undefined)?.[0]?.id === ctx.selfId ? 'win' : 'lose'),
    })
    this.flow.onChange((s) => {
      if (s.phase === 'countdown') {
        this.resetCar()
        engineStart()
      }
      if (s.phase === 'result') engineStop()
      this.syncOverlay()
      ;(window as unknown as Record<string, unknown>).__BATTLE_PHASE = s.phase
    })
    ;(window as unknown as Record<string, unknown>).__BATTLE_PHASE = this.flow.state.phase

    this.own = createOwnershipSync<CarState>({ net: ctx.net, game: this.gameId })
    this.own.start(() => ({ ...this.state }))

    this.ticker = createFixedTicker(SIM_HZ, (_t, stepMs) => this.simulate(stepMs / 1000))
    this.ticker.start()

    if (ctx.role === 'host') this.flow.startCountdown(3)
  }

  private buildStartFinishLine(): void {
    const scene = this.ctx.scene
    const r = (R_INNER + R_OUTER) / 2
    const w = R_OUTER - R_INNER

    // 棋盤格起跑線
    const checkerMat1 = new StandardMaterial('checker1', scene)
    checkerMat1.diffuseColor = Color3.White()
    const checkerMat2 = new StandardMaterial('checker2', scene)
    checkerMat2.diffuseColor = new Color3(0.1, 0.1, 0.1)

    const gridSize = 4
    const cellW = w / gridSize
    for (let i = 0; i < gridSize; i++) {
      const cell = MeshBuilder.CreateBox(`checker-${i}`, { width: 0.5, height: 0.02, depth: cellW }, scene)
      cell.position = new Vector3(0, 0.03, R_INNER + cellW * (i + 0.5))
      cell.material = i % 2 === 0 ? checkerMat1 : checkerMat2
      this.decorations.push(cell)
    }

    // 起跑拱門柱
    const archMat = new StandardMaterial('arch-mat', scene)
    archMat.diffuseColor = new Color3(0.8, 0.15, 0.1)

    for (const side of [-1, 1]) {
      const pillar = MeshBuilder.CreateBox(`arch-pillar-${side}`, { width: 0.4, height: 3, depth: 0.4 }, scene)
      pillar.position.set(side * (w / 2 + 0.5), 1.5, r)
      pillar.material = archMat
      this.decorations.push(pillar)
    }

    // 橫樑
    const beam = MeshBuilder.CreateBox('arch-beam', { width: w + 1.4, height: 0.3, depth: 0.4 }, scene)
    beam.position.set(0, 3, r)
    beam.material = archMat
    this.decorations.push(beam)
  }

  private buildTrackMarkings(): void {
    const scene = this.ctx.scene
    const markMat = new StandardMaterial('mark-mat', scene)
    markMat.diffuseColor = Color3.White()

    // 內圈虛線
    const innerCount = 48
    for (let i = 0; i < innerCount; i += 2) {
      const a = (i / innerCount) * Math.PI * 2
      const mark = MeshBuilder.CreateBox(`mark-inner-${i}`, { width: 0.8, height: 0.02, depth: 0.15 }, scene)
      mark.position.set(Math.sin(a) * (R_INNER + 1.5), 0.025, Math.cos(a) * (R_INNER + 1.5))
      mark.rotation.y = a
      mark.material = markMat
      this.decorations.push(mark)
    }

    // 外圈虛線
    const outerCount = 64
    for (let i = 0; i < outerCount; i += 2) {
      const a = (i / outerCount) * Math.PI * 2
      const mark = MeshBuilder.CreateBox(`mark-outer-${i}`, { width: 0.8, height: 0.02, depth: 0.15 }, scene)
      mark.position.set(Math.sin(a) * (R_OUTER - 1.5), 0.025, Math.cos(a) * (R_OUTER - 1.5))
      mark.rotation.y = a
      mark.material = markMat
      this.decorations.push(mark)
    }
  }

  onNetworkMessage(): void {}

  private simulate(dt: number): void {
    if (this.flow.state.phase !== 'playing') return
    const k = this.keys
    const up = k.has('w') || k.has('arrowup')
    const down = k.has('s') || k.has('arrowdown')
    const steer = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0)
    this.drifting = k.has(' ')

    // 油門/煞車/阻力
    if (up) this.speed += ACCEL * dt
    else if (down) this.speed -= (this.speed > 0 ? BRAKE : ACCEL) * dt
    else this.speed -= Math.sign(this.speed) * Math.min(DRAG * dt, Math.abs(this.speed))

    // 加速帶
    const now = performance.now()
    if (this.boostUntil > now) {
      this.speed = Math.max(this.speed, BOOST_SPEED * 0.8)
    } else {
      this.checkBoostPad()
    }

    // 出賽道降速
    const r = Math.hypot(this.state.x, this.state.z)
    const onTrack = r >= R_INNER && r <= R_OUTER
    const maxFwd = MAX_SPEED * (onTrack ? 1 : OFFTRACK_FACTOR)
    this.speed = Math.max(-MAX_REVERSE, Math.min(maxFwd, this.speed))

    // 轉向（漂移時更快）
    const turnMult = this.drifting ? DRIFT_TURN_MULT : 1
    const dragMult = this.drifting ? DRIFT_DRAG : DRAG
    if (steer !== 0 && Math.abs(this.speed) > 0.3) {
      const f = Math.min(1, Math.abs(this.speed) / (MAX_SPEED * 0.5)) * Math.sign(this.speed)
      this.state.ry += steer * TURN_RATE * turnMult * f * dt
    }

    // 漂移時阻力較小（更滑）
    if (this.drifting && Math.abs(this.speed) > 2) {
      this.speed -= Math.sign(this.speed) * Math.min(dragMult * 0.3 * dt, Math.abs(this.speed))
    }

    this.state.x += Math.sin(this.state.ry) * this.speed * dt
    this.state.z += Math.cos(this.state.ry) * this.speed * dt
    const bound = GROUND_SIZE / 2 - 1
    this.state.x = Math.max(-bound, Math.min(bound, this.state.x))
    this.state.z = Math.max(-bound, Math.min(bound, this.state.z))

    // 車對車碰撞推擠
    if (this.ctx.role === 'host') {
      for (const pid of this.own.remoteIds()) {
        const remote = this.own.latestRemote(pid)
        if (!remote) continue
        const dx = this.state.x - remote.x
        const dz = this.state.z - remote.z
        const dist = Math.hypot(dx, dz)
        if (dist < CAR_PUSH_DIST && dist > 0.01) {
          const push = (CAR_PUSH_DIST - dist) * CAR_PUSH_FORCE * dt
          this.state.x += (dx / dist) * push
          this.state.z += (dz / dist) * push
        }
      }
    }

    // 計圈
    const quad = quadrantOf(this.state.x, this.state.z)
    if (quad !== this.lastQuad) {
      const newQ = stepQuarters(this.state.q, this.lastQuad, quad)
      if (newQ > this.state.q) playSfx('lap')
      this.state.q = newQ
      this.lastQuad = quad
    }

    // host 裁決
    if (this.ctx.role === 'host') {
      const standings: Standing[] = [
        { id: this.ctx.selfId, name: this.nameFor(this.ctx.selfId), q: this.state.q },
        ...this.own.remoteIds().map((id) => ({
          id,
          name: this.nameFor(id),
          q: this.own.latestRemote(id)?.q ?? 0,
        })),
      ]
      if (standings.some((s) => s.q >= FINISH_Q)) {
        standings.sort((a, b) => b.q - a.q)
        this.flow.endGame(standings)
      }
    }

    // 引擎音
    const speedRatio = Math.abs(this.speed) / MAX_SPEED
    engineSet(speedRatio)
  }

  update(deltaMs: number): void {
    const dt = deltaMs * 0.001
    const phase = this.flow.state.phase
    const now = performance.now()

    // 自車
    if (this.selfVisual) {
      this.selfVisual.root.position.x = this.state.x
      this.selfVisual.root.position.z = this.state.z
      this.selfVisual.root.rotation.y = this.state.ry

      // 車輪轉動
      const wheelSpeed = this.speed * dt * 3
      for (const w of this.selfVisual.wheels) {
        w.rotation.x += wheelSpeed
      }

      // 漂移火花
      this.spawnDriftSparks(this.selfVisual)
    }

    // 追尾相機
    this.camera.target.set(this.state.x, 0.5, this.state.z)
    const wantAlpha = -this.state.ry - Math.PI / 2
    this.camera.alpha = lerpAngle(this.camera.alpha, wantAlpha, Math.min(1, dt * 5))

    // 遠端車
    const ids = new Set(this.own.remoteIds())
    for (const [id, v] of this.peerVisuals) {
      if (ids.has(id)) continue
      v.root.dispose(false, true)
      this.peerVisuals.delete(id)
    }
    for (const id of ids) {
      let v = this.peerVisuals.get(id)
      if (!v) {
        v = this.makeCar(id)
        this.peerVisuals.set(id, v)
      }
      const s = this.own.sampleRemote(id)
      if (s) {
        v.root.position.x = s.a.x + (s.b.x - s.a.x) * s.alpha
        v.root.position.z = s.a.z + (s.b.z - s.a.z) * s.alpha
        v.root.rotation.y = lerpAngle(s.a.ry, s.b.ry, s.alpha)
      }
      // 遠端車輪轉動
      const dx = v.root.position.x - v.prevX
      const dz = v.root.position.z - v.prevZ
      v.prevX = v.root.position.x
      v.prevZ = v.root.position.z
      const wheelSpeed = Math.hypot(dx, dz) * 3
      for (const w of v.wheels) w.rotation.x += wheelSpeed
    }

    // 塵土粒子更新
    this.spawnDust()
    this.dustParticles = this.dustParticles.filter((p) => {
      p.life -= dt
      if (p.life <= 0) {
        p.mesh.dispose()
        return false
      }
      p.mesh.position.x += p.vx * dt
      p.mesh.position.z += p.vz * dt
      p.mesh.scaling.scaleInPlace(0.96)
      const mat = p.mesh.material as StandardMaterial
      if (mat) mat.alpha = p.life * 1.2
      return true
    })

    // 漂移火花更新
    if (this.selfVisual) {
      this.selfVisual.driftSparks = this.selfVisual.driftSparks.filter((s) => {
        s.life -= dt
        if (s.life <= 0) {
          s.mesh.dispose()
          return false
        }
        s.mesh.position.y += dt * 2
        const mat = s.mesh.material as StandardMaterial
        if (mat) mat.alpha = s.life * 3
        return true
      })
    }

    // 加速帶閃爍
    for (const pad of this.boostPads) {
      pad.mesh.position.y = 0.03 + Math.sin(now * 0.006) * 0.02
    }

    // HUD
    const lap = Math.min(Math.floor(this.state.q / 4) + 1, LAPS)
    const speedKmh = Math.round(Math.abs(this.speed) * 15)
    const pos = this.calcPosition()
    const driftNote = this.drifting ? ' [漂移]' : ''
    const boostNote = this.boostUntil > now ? ' ⚡' : ''
    const hudText = phase === 'playing'
      ? `Lap ${lap}/${LAPS}  ${speedKmh}km/h  #${pos}${driftNote}${boostNote}`
      : ''
    this.hud.draw(hudText, 42)

    // 迷你地圖
    if (phase === 'playing') this.drawMinimap()

    // 橫幅
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

    this.syncOverlay()

    ;(window as unknown as Record<string, unknown>).__BATTLE_POS = {
      x: this.state.x,
      z: this.state.z,
      q: this.state.q,
    }
  }

  private calcPosition(): number {
    const allQ: { id: string; q: number }[] = [
      { id: this.ctx.selfId, q: this.state.q },
      ...this.own.remoteIds().map((id) => ({ id, q: this.own.latestRemote(id)?.q ?? 0 })),
    ]
    allQ.sort((a, b) => b.q - a.q)
    return allQ.findIndex((s) => s.id === this.ctx.selfId) + 1
  }

  private drawMinimap(): void {
    const lines: string[] = []
    const half = GROUND_SIZE / 2

    // 賽道用圓環表示
    lines.push('  ╭──────╮')
    lines.push(' ╭╯  ╭╮  ╰╮')
    lines.push(' │  ╭╯╰╮  │')
    lines.push(' ╰╮ ╰──╯ ╭╯')
    lines.push('  ╰──────╯')

    // 自己的位置（用 @ 表示）
    const sx = Math.round(((this.state.x + half) / GROUND_SIZE) * 10)
    const sz = Math.round(((this.state.z + half) / GROUND_SIZE) * 6)
    if (sz >= 0 && sz < lines.length && sx >= 0 && sx < lines[sz].length) {
      const row = lines[sz].split('')
      row[sx] = '@'
      lines[sz] = row.join('')
    }

    this.minimap.draw(lines.join('\n'), 24)
  }

  // ---- 場地裝飾 ----

  private buildDecorations(): void {
    const { scene } = this.ctx
    const d = this.decorations

    const add = (m: Mesh) => { d.push(m); return m }

    const barrierMat = new StandardMaterial('barrier-mat', scene)
    barrierMat.diffuseColor = new Color3(0.35, 0.35, 0.38)

    const curbRed = new StandardMaterial('curb-red', scene)
    curbRed.diffuseColor = new Color3(0.9, 0.15, 0.1)
    const curbWhite = new StandardMaterial('curb-white', scene)
    curbWhite.diffuseColor = new Color3(0.95, 0.95, 0.95)

    const trunkMat = new StandardMaterial('trunk-mat', scene)
    trunkMat.diffuseColor = new Color3(0.45, 0.3, 0.15)
    const canopyMat = new StandardMaterial('canopy-mat', scene)
    canopyMat.diffuseColor = new Color3(0.15, 0.5, 0.2)

    const bushMat = new StandardMaterial('bush-mat', scene)
    bushMat.diffuseColor = new Color3(0.1, 0.4, 0.15)

    const rockMat = new StandardMaterial('rock-mat', scene)
    rockMat.diffuseColor = new Color3(0.5, 0.48, 0.45)

    const standMat = new StandardMaterial('stand-mat', scene)
    standMat.diffuseColor = new Color3(0.6, 0.58, 0.55)
    const seatMat = new StandardMaterial('seat-mat', scene)
    seatMat.diffuseColor = new Color3(0.2, 0.35, 0.65)

    const pitMat = new StandardMaterial('pit-mat', scene)
    pitMat.diffuseColor = new Color3(0.85, 0.85, 0.82)
    const roofMat = new StandardMaterial('roof-mat', scene)
    roofMat.diffuseColor = new Color3(0.8, 0.2, 0.15)

    // 護欄
    const placeRing = (r: number, count: number, w: number, h: number, depth: number, mat: StandardMaterial) => {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2
        const b = add(MeshBuilder.CreateBox(`barrier-${r.toFixed(0)}-${i}`, { width: w, height: h, depth }, scene))
        b.position.set(Math.sin(a) * r, h / 2, Math.cos(a) * r)
        b.rotation.y = a
        b.material = mat
      }
    }
    placeRing(R_INNER - 0.6, 36, 1.3, 0.6, 0.3, barrierMat)
    placeRing(R_OUTER + 0.6, 48, 1.3, 0.6, 0.3, barrierMat)

    // 路緣石
    const placeCurb = (r: number, count: number) => {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2
        const b = add(MeshBuilder.CreateBox(`curb-${r.toFixed(0)}-${i}`, { width: 0.9, height: 0.05, depth: 0.4 }, scene))
        b.position.set(Math.sin(a) * r, 0.03, Math.cos(a) * r)
        b.rotation.y = a
        b.material = i % 2 === 0 ? curbRed : curbWhite
      }
    }
    placeCurb(R_INNER, 36)
    placeCurb(R_OUTER, 48)

    // 樹木
    const treeSpots = [
      [-22, -22], [-24, -18], [-20, -24],
      [22, -22], [24, -18], [20, -24],
      [-22, 22], [-24, 18], [-20, 24],
      [22, 22], [24, 18], [20, 24],
    ]
    for (const [tx, tz] of treeSpots) {
      const trunk = add(MeshBuilder.CreateCylinder(`trunk-${tx}-${tz}`, { height: 1.8, diameter: 0.45 }, scene))
      trunk.position.set(tx, 0.9, tz)
      trunk.material = trunkMat
      const canopy = add(MeshBuilder.CreateSphere(`canopy-${tx}-${tz}`, { diameter: 2.2 }, scene))
      canopy.position.set(tx, 2.5, tz)
      canopy.material = canopyMat
    }

    // 灌木
    const bushSpots = [
      [-5, -5], [6, -8], [-8, 4], [3, 7],
      [-3, -10], [8, 2], [-10, -3], [0, 10],
    ]
    for (let i = 0; i < bushSpots.length; i++) {
      const [bx, bz] = bushSpots[i]
      const bush = add(MeshBuilder.CreateSphere(`bush-${i}`, { diameter: 1.3 }, scene))
      bush.position.set(bx, 0.4, bz)
      bush.scaling.y = 0.55
      bush.material = bushMat
    }

    // 岩石
    const rockSpots = [
      [-25, 0, 1.0], [25, 0, 0.8], [0, -25, 0.9],
      [0, 25, 0.7], [-18, -20, 0.6], [18, 20, 0.8],
    ]
    for (let i = 0; i < rockSpots.length; i++) {
      const [rx, rz, s] = rockSpots[i]
      const rock = add(MeshBuilder.CreateBox(`rock-${i}`, { size: s }, scene))
      rock.position.set(rx, s * 0.4, rz)
      rock.rotation.y = i * 1.2
      rock.scaling.set(1, 0.7, 1.2)
      rock.material = rockMat
    }

    // 看台
    const standX = 26
    const standZ = 0
    const standBase = add(MeshBuilder.CreateBox('stand-base', { width: 14, height: 1, depth: 5 }, scene))
    standBase.position.set(standX, 0.5, standZ)
    standBase.material = standMat
    for (let row = 0; row < 3; row++) {
      const seat = add(MeshBuilder.CreateBox(`stand-seat-${row}`, { width: 12, height: 0.5, depth: 1.2 }, scene))
      seat.position.set(standX, 1.25 + row * 0.6, standZ - 1.5 + row * 1.2)
      seat.material = seatMat
    }
    const roof = add(MeshBuilder.CreateBox('stand-roof', { width: 14, height: 0.15, depth: 6 }, scene))
    roof.position.set(standX, 3.5, standZ)
    roof.material = standMat

    // 維修站
    const pitX = -26
    const pitZ = 0
    const pitBody = add(MeshBuilder.CreateBox('pit-body', { width: 7, height: 2.8, depth: 5 }, scene))
    pitBody.position.set(pitX, 1.4, pitZ)
    pitBody.material = pitMat
    const pitRoof = add(MeshBuilder.CreateBox('pit-roof', { width: 8, height: 0.2, depth: 6 }, scene))
    pitRoof.position.set(pitX, 2.9, pitZ)
    pitRoof.material = roofMat
    const pitDoor = add(MeshBuilder.CreateBox('pit-door', { width: 2.5, height: 2.2, depth: 0.1 }, scene))
    pitDoor.position.set(pitX, 1.1, pitZ + 2.55)
    pitDoor.material = roofMat
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    stopAllAudio()
    this.ticker.stop()
    this.own.stop()
    this.flow.dispose()
    this.selfVisual?.root.dispose(false, true)
    for (const v of this.peerVisuals.values()) v.root.dispose(false, true)
    this.peerVisuals.clear()
    this.hud.dispose()
    this.banner.dispose()
    this.minimap.dispose()
    for (const m of this.decorations) m.dispose()
    this.decorations = []
    for (const p of this.boostPads) p.mesh.dispose()
    this.boostPads = []
    for (const p of this.dustParticles) p.mesh.dispose()
    this.dustParticles = []
  }
}

// ---- 輔助型別 ----

interface CarVisual {
  root: Mesh
  wheels: Mesh[]
  driftSparks: { mesh: Mesh; life: number }[]
  prevX: number
  prevZ: number
}

interface DustParticle {
  mesh: Mesh
  life: number
  vx: number
  vz: number
}

export const createRaceScene = (): GameModule => new RaceScene()
