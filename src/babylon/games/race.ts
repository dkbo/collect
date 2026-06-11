import {
  ArcRotateCamera,
  Color3,
  HemisphericLight,
  MeshBuilder,
  StandardMaterial,
  Vector3,
  type Mesh,
} from '@babylonjs/core'
import type { GameContext, GameModule, GamePlayer } from '@/babylon/types'
import { lerpAngle, quadrantOf, stepQuarters } from '@/babylon/math'
import { createTextPanel, type TextPanel } from '@/babylon/hud'
import {
  createFixedTicker,
  createGameFlow,
  createOwnershipSync,
  type FixedTicker,
  type GameFlow,
  type OwnershipSync,
} from '@/babylon/net'

/**
 * 極速賽車（Phase B，計畫見 .prompts/babylon-multiplayer-games.md §3.1）。
 *
 * 同步模型：分散式所有權——每人本地模擬自己的車（零輸入延遲），
 * 20Hz 廣播 {x,z,ry,q}，他車插值；host 只裁決名次（誰先跑滿 LAPS 圈）。
 * 計圈：環道切 4 象限，依序通過象限累計 q（quarter 數），q ≥ LAPS*4 即完賽。
 */

/** 每位玩家廣播的車輛狀態（q = 已通過的象限數，host 據此判定名次） */
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

// 環道幾何：中心線半徑 18、半寬 4
const R_INNER = 14
const R_OUTER = 22
const GROUND_SIZE = 56

// 車輛運動學
const MAX_SPEED = 16 // 單位/秒
const MAX_REVERSE = 5
const ACCEL = 12
const BRAKE = 20
const DRAG = 4
const TURN_RATE = 2.2 // rad/s（滿速時）
const OFFTRACK_FACTOR = 0.35 // 出賽道的最高速倍率

class RaceScene implements GameModule {
  readonly gameId = 'race'
  private ctx!: GameContext
  private keys = new Set<string>()
  private ticker!: FixedTicker
  private own!: OwnershipSync<CarState>
  private flow!: GameFlow

  // 自身模擬狀態
  private state: CarState = { x: 0, z: 0, ry: 0, q: 0 }
  private speed = 0
  private lastQuad = 0
  private spawnIdx = 0

  private selfCar?: Mesh
  private peerCars = new Map<string, Mesh>()
  private camera!: ArcRotateCamera
  /** result 階段已停留毫秒數（host 計時自動開新局） */
  private resultElapsed = 0

  private decorations: Mesh[] = []

  // HUD：上方圈數、中央橫幅（倒數/結算）
  private hud!: TextPanel
  private banner!: TextPanel

  private onKeyDown = (e: KeyboardEvent) => this.keys.add(e.key.toLowerCase())
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase())

  private colorFor(id: string): Color3 {
    let h = 0
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
    return Color3.FromHSV(h % 360, 0.7, 0.9)
  }

  private nameFor(id: string): string {
    return this.ctx.players.find((p: GamePlayer) => p.id === id)?.name ?? id.slice(0, 6)
  }

  /** 車：車身 + 車頂小方塊，回傳車身（車頂為子節點一併移動/釋放） */
  private makeCar(id: string): Mesh {
    const scene = this.ctx.scene
    const body = MeshBuilder.CreateBox(`car-${id}`, { width: 1.2, height: 0.5, depth: 2 }, scene)
    body.position.y = 0.3
    const mat = new StandardMaterial(`car-mat-${id}`, scene)
    mat.diffuseColor = this.colorFor(id)
    body.material = mat
    const cabin = MeshBuilder.CreateBox(`cab-${id}`, { width: 0.9, height: 0.4, depth: 0.9 }, scene)
    cabin.parent = body
    cabin.position = new Vector3(0, 0.4, -0.2)
    cabin.material = mat
    return body
  }

  /** 出生點：起跑線（+z 象限 0 起點）後方，依玩家序錯開內外側與前後 */
  private spawnPose(idx: number): { x: number; z: number; ry: number } {
    const r = 16.5 + (idx % 2) * 3 // 內外兩道
    const a = 0.12 + Math.floor(idx / 2) * 0.14 // 起跑線後依排錯開（象限 0 內）
    return { x: Math.sin(a) * r, z: Math.cos(a) * r, ry: a + Math.PI / 2 } // 朝切線方向
  }

  private resetCar(): void {
    const p = this.spawnPose(this.spawnIdx)
    this.state = { x: p.x, z: p.z, ry: p.ry, q: 0 }
    this.speed = 0
    this.lastQuad = quadrantOf(p.x, p.z)
  }

  init(ctx: GameContext): void {
    this.ctx = ctx
    const { scene } = ctx

    // 相機：追尾視角（不開放手動操作）
    this.camera = new ArcRotateCamera('cam', -Math.PI / 2, 1.12, 14, Vector3.Zero(), scene)
    new HemisphericLight('light', new Vector3(0, 1, 0), scene)

    // 場地：草地 + 賽道環（疊三層圓盤避免 z-fighting）
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

    // 起跑線：象限 0 起點（+z 方向）橫跨賽道
    const startLine = MeshBuilder.CreateBox(
      'start-line',
      { width: 0.5, height: 0.02, depth: R_OUTER - R_INNER },
      scene
    )
    startLine.position = new Vector3(0, 0.03, (R_INNER + R_OUTER) / 2)
    const smat = new StandardMaterial('smat', scene)
    smat.diffuseColor = Color3.White()
    startLine.material = smat

    this.buildDecorations()

    // 自車
    this.spawnIdx = Math.max(0, ctx.players.findIndex((p) => p.id === ctx.selfId))
    this.selfCar = this.makeCar(ctx.selfId)
    this.resetCar()

    this.hud = createTextPanel(scene, this.camera, 'hud', 3, 0.7, new Vector3(0, 2.3, 8))
    this.banner = createTextPanel(scene, this.camera, 'banner', 7, 4, new Vector3(0, 0.3, 8))

    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)

    // 工具層
    this.flow = createGameFlow({ net: ctx.net, game: this.gameId, role: ctx.role })
    this.flow.onChange((s) => {
      if (s.phase === 'countdown') this.resetCar() // 新一局：歸位
      ;(window as unknown as Record<string, unknown>).__BATTLE_PHASE = s.phase
    })
    ;(window as unknown as Record<string, unknown>).__BATTLE_PHASE = this.flow.state.phase

    this.own = createOwnershipSync<CarState>({ net: ctx.net, game: this.gameId })
    this.own.start(() => ({ ...this.state }))

    this.ticker = createFixedTicker(SIM_HZ, (_t, stepMs) => this.simulate(stepMs / 1000))
    this.ticker.start()

    if (ctx.role === 'host') this.flow.startCountdown(3)
  }

  /** 固定步長：車輛運動學 + 計圈 +（host）完賽裁決 */
  private simulate(dt: number): void {
    if (this.flow.state.phase !== 'playing') return
    const k = this.keys
    const up = k.has('w') || k.has('arrowup')
    const down = k.has('s') || k.has('arrowdown')
    const steer = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0)

    // 油門/煞車/阻力
    if (up) this.speed += ACCEL * dt
    else if (down) this.speed -= (this.speed > 0 ? BRAKE : ACCEL) * dt
    else this.speed -= Math.sign(this.speed) * Math.min(DRAG * dt, Math.abs(this.speed))

    // 出賽道降速
    const r = Math.hypot(this.state.x, this.state.z)
    const onTrack = r >= R_INNER && r <= R_OUTER
    const maxFwd = MAX_SPEED * (onTrack ? 1 : OFFTRACK_FACTOR)
    this.speed = Math.max(-MAX_REVERSE, Math.min(maxFwd, this.speed))

    // 轉向量隨速度比例（停止時不轉）
    if (steer !== 0 && Math.abs(this.speed) > 0.3) {
      const f = Math.min(1, Math.abs(this.speed) / (MAX_SPEED * 0.5)) * Math.sign(this.speed)
      this.state.ry += steer * TURN_RATE * f * dt
    }

    this.state.x += Math.sin(this.state.ry) * this.speed * dt
    this.state.z += Math.cos(this.state.ry) * this.speed * dt
    const bound = GROUND_SIZE / 2 - 1
    this.state.x = Math.max(-bound, Math.min(bound, this.state.x))
    this.state.z = Math.max(-bound, Math.min(bound, this.state.z))

    // 計圈：象限只認 ±1 步進（防穿場跳格）
    const quad = quadrantOf(this.state.x, this.state.z)
    if (quad !== this.lastQuad) {
      this.state.q = stepQuarters(this.state.q, this.lastQuad, quad)
      this.lastQuad = quad
    }

    // host 裁決：任何人 q 達標 → 結算（含自己）
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
  }

  onNetworkMessage(): void {}

  update(deltaMs: number): void {
    const dt = deltaMs * 0.001
    const phase = this.flow.state.phase

    // 自車位姿
    if (this.selfCar) {
      this.selfCar.position.x = this.state.x
      this.selfCar.position.z = this.state.z
      this.selfCar.rotation.y = this.state.ry
    }

    // 追尾相機：目標跟車、方位平滑朝車頭後方
    this.camera.target.set(this.state.x, 0.5, this.state.z)
    const wantAlpha = -this.state.ry - Math.PI / 2
    this.camera.alpha = lerpAngle(this.camera.alpha, wantAlpha, Math.min(1, dt * 4))

    // 遠端車：增刪 + 插值
    const ids = new Set(this.own.remoteIds())
    for (const [id, car] of this.peerCars) {
      if (ids.has(id)) continue
      car.dispose()
      this.peerCars.delete(id)
    }
    for (const id of ids) {
      let car = this.peerCars.get(id)
      if (!car) {
        car = this.makeCar(id)
        this.peerCars.set(id, car)
      }
      const s = this.own.sampleRemote(id)
      if (s) {
        car.position.x = s.a.x + (s.b.x - s.a.x) * s.alpha
        car.position.z = s.a.z + (s.b.z - s.a.z) * s.alpha
        car.rotation.y = lerpAngle(s.a.ry, s.b.ry, s.alpha)
      }
    }

    // HUD：圈數
    const lap = Math.min(Math.floor(this.state.q / 4) + 1, LAPS)
    this.hud.draw(phase === 'playing' ? `Lap ${lap} / ${LAPS}` : '')

    // 橫幅：倒數 / 結算
    if (phase === 'countdown') {
      const n = Math.ceil(this.flow.countdownRemaining() / 1000)
      this.banner.draw(n > 0 ? String(n) : 'GO!', 200)
    } else if (phase === 'result') {
      const standings = (this.flow.state.result as Standing[] | undefined) ?? []
      const lines = standings.map(
        (s, i) => `${i + 1}. ${s.name}${s.q >= FINISH_Q ? '' : `（${Math.floor(s.q / 4)} 圈）`}`
      )
      this.banner.draw(['🏁 結果', ...lines].join('\n'), 56)
      // host 10 秒後自動開新局
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
      q: this.state.q,
    }
  }

  // ---- 場地裝飾 ----

  private buildDecorations(): void {
    const { scene } = this.ctx
    const d = this.decorations

    const add = (m: Mesh) => { d.push(m); return m }

    // --- 共用材質 ---
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

    // --- 1. 護欄：內圈 36 個 + 外圈 48 個 ---
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

    // --- 2. 路緣石：紅白交替 ---
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

    // --- 3. 樹木：場地四角各 3 棵 ---
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

    // --- 4. 灌木：內場散佈 ---
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

    // --- 5. 岩石：場地邊緣 ---
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

    // --- 6. 看台：+x 側 ---
    const standX = 26
    const standZ = 0
    // 底座
    const standBase = add(MeshBuilder.CreateBox('stand-base', { width: 14, height: 1, depth: 5 }, scene))
    standBase.position.set(standX, 0.5, standZ)
    standBase.material = standMat
    // 三層階梯座位
    for (let row = 0; row < 3; row++) {
      const seat = add(MeshBuilder.CreateBox(`stand-seat-${row}`, { width: 12, height: 0.5, depth: 1.2 }, scene))
      seat.position.set(standX, 1.25 + row * 0.6, standZ - 1.5 + row * 1.2)
      seat.material = seatMat
    }
    // 頂棚
    const roof = add(MeshBuilder.CreateBox('stand-roof', { width: 14, height: 0.15, depth: 6 }, scene))
    roof.position.set(standX, 3.5, standZ)
    roof.material = standMat

    // --- 7. 維修站：-x 側 ---
    const pitX = -26
    const pitZ = 0
    // 主體
    const pitBody = add(MeshBuilder.CreateBox('pit-body', { width: 7, height: 2.8, depth: 5 }, scene))
    pitBody.position.set(pitX, 1.4, pitZ)
    pitBody.material = pitMat
    // 屋頂
    const pitRoof = add(MeshBuilder.CreateBox('pit-roof', { width: 8, height: 0.2, depth: 6 }, scene))
    pitRoof.position.set(pitX, 2.9, pitZ)
    pitRoof.material = roofMat
    // 門口
    const pitDoor = add(MeshBuilder.CreateBox('pit-door', { width: 2.5, height: 2.2, depth: 0.1 }, scene))
    pitDoor.position.set(pitX, 1.1, pitZ + 2.55)
    pitDoor.material = roofMat
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    this.ticker.stop()
    this.own.stop()
    this.flow.dispose()
    this.selfCar?.dispose()
    for (const car of this.peerCars.values()) car.dispose()
    this.peerCars.clear()
    this.hud.dispose()
    this.banner.dispose()
    for (const m of this.decorations) m.dispose()
    this.decorations = []
  }
}

export const createRaceScene = (): GameModule => new RaceScene()
