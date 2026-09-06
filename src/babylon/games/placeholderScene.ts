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
import { lerpAngle } from '@/babylon/math'
import {
  createFixedTicker,
  createGameFlow,
  createOwnershipSync,
  type FixedTicker,
  type GameFlow,
  type OwnershipSync,
} from '@/babylon/net'

/** 每位玩家廣播的自身狀態（所有權制：只同步自己的方塊） */
interface BoxState {
  x: number
  z: number
  ry: number
}

const SIM_HZ = 30
const MOVE_SPEED = 5 // 單位/秒
const GROUND_HALF = 7.5 // 16x16 地板，留 0.5 邊界

/**
 * Phase A 工具層驗證場景（原 Phase 3 靜態方塊升級）。
 * 每位玩家以 WASD/方向鍵移動自己的方塊：
 * - fixedTick 30Hz 本地模擬（與 render loop 脫鉤）
 * - ownership 20Hz 廣播自身狀態，遠端方塊 100ms 插值
 * - gameFlow：host 開場倒數 3 秒，playing 後才能移動（倒數中方塊自轉提示）
 */
class PlaceholderScene implements GameModule {
  readonly gameId = 'placeholder'
  private ctx!: GameContext
  private peerBoxes = new Map<string, Mesh>()
  private self?: Mesh
  private state: BoxState = { x: 0, z: 0, ry: 0 }
  private keys = new Set<string>()
  private ticker!: FixedTicker
  private own!: OwnershipSync<BoxState>
  private flow!: GameFlow

  private onKeyDown = (e: KeyboardEvent) => this.keys.add(e.key.toLowerCase())
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase())

  /** 由 uid 推導穩定顏色，讓每位玩家方塊顏色固定 */
  private colorFor(id: string): Color3 {
    let h = 0
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
    return Color3.FromHSV(h % 360, 0.6, 0.9)
  }

  private makeBox(id: string, x: number, z: number): Mesh {
    const box = MeshBuilder.CreateBox(`box-${id}`, { size: 1 }, this.ctx.scene)
    box.position = new Vector3(x, 0.5, z)
    const mat = new StandardMaterial(`mat-${id}`, this.ctx.scene)
    mat.diffuseColor = this.colorFor(id)
    box.material = mat
    return box
  }

  init(ctx: GameContext): void {
    this.ctx = ctx
    const { scene } = ctx

    const camera = new ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 3, 18, Vector3.Zero(), scene)
    const canvas = scene.getEngine().getRenderingCanvas()
    if (canvas) camera.attachControl(canvas, true)

    new HemisphericLight('light', new Vector3(0, 1, 0), scene)

    const ground = MeshBuilder.CreateGround('ground', { width: 16, height: 16 }, scene)
    const gmat = new StandardMaterial('gmat', scene)
    gmat.diffuseColor = new Color3(0.15, 0.18, 0.28)
    ground.material = gmat

    // 出生點依玩家列表順序橫向排開（列表依 joinedAt 排序，各端一致）
    const idx = Math.max(0, ctx.players.findIndex((p) => p.id === ctx.selfId))
    this.state.x = (idx - (ctx.players.length - 1) / 2) * 3
    this.self = this.makeBox(ctx.selfId, this.state.x, this.state.z)

    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)

    // 工具層：對局流程 + 所有權同步 + 固定步長模擬
    this.flow = createGameFlow({ net: ctx.net, game: this.gameId, role: ctx.role, hostId: ctx.hostId })
    this.flow.onChange((s) => {
      ;(window as unknown as Record<string, unknown>).__BATTLE_PHASE = s.phase
    })
    ;(window as unknown as Record<string, unknown>).__BATTLE_PHASE = this.flow.state.phase

    this.own = createOwnershipSync<BoxState>({ net: ctx.net, game: this.gameId })
    this.own.start(() => ({ ...this.state }))

    this.ticker = createFixedTicker(SIM_HZ, (_tick, stepMs) => this.simulate(stepMs / 1000))
    this.ticker.start()

    if (ctx.role === 'host') this.flow.startCountdown(3)
  }

  /** 固定步長模擬：playing 階段依按鍵推進自身狀態 */
  private simulate(dt: number): void {
    if (this.flow.state.phase !== 'playing') return
    const k = this.keys
    const dx = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0)
    const dz = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0)
    if (dx === 0 && dz === 0) return
    const len = Math.hypot(dx, dz)
    this.state.x = Math.max(-GROUND_HALF, Math.min(GROUND_HALF, this.state.x + (dx / len) * MOVE_SPEED * dt))
    this.state.z = Math.max(-GROUND_HALF, Math.min(GROUND_HALF, this.state.z + (dz / len) * MOVE_SPEED * dt))
    this.state.ry = Math.atan2(dx, dz)
  }

  /** 工具層直接訂閱 NetTransport，這裡不需處理個別訊息 */
  onNetworkMessage(): void {}

  update(deltaMs: number): void {
    const playing = this.flow.state.phase === 'playing'
    const spin = playing ? 0 : deltaMs * 0.003 // 未開局時自轉提示

    // 自己的方塊：直接讀模擬狀態
    if (this.self) {
      this.self.position.x = this.state.x
      this.self.position.z = this.state.z
      this.self.rotation.y = playing ? this.state.ry : this.self.rotation.y + spin
    }

    // 遠端方塊：依 ownership 遠端清單增刪 + 插值
    const ids = new Set(this.own.remoteIds())
    for (const [id, box] of this.peerBoxes) {
      if (ids.has(id)) continue
      box.dispose()
      this.peerBoxes.delete(id)
    }
    for (const id of ids) {
      let box = this.peerBoxes.get(id)
      if (!box) {
        const init = this.own.latestRemote(id)
        box = this.makeBox(id, init?.x ?? 0, init?.z ?? 0)
        this.peerBoxes.set(id, box)
      }
      const s = this.own.sampleRemote(id)
      if (s) {
        box.position.x = s.a.x + (s.b.x - s.a.x) * s.alpha
        box.position.z = s.a.z + (s.b.z - s.a.z) * s.alpha
        box.rotation.y = playing ? lerpAngle(s.a.ry, s.b.ry, s.alpha) : box.rotation.y + spin
      }
    }

    // 驗證用：曝露自身與遠端方塊座標
    ;(window as unknown as Record<string, unknown>).__BATTLE_POS = {
      x: this.state.x,
      z: this.state.z,
    }
    ;(window as unknown as Record<string, unknown>).__BATTLE_REMOTES = Object.fromEntries(
      [...this.peerBoxes].map(([id, box]) => [id, { x: box.position.x, z: box.position.z }])
    )
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    this.ticker.stop()
    this.own.stop()
    this.flow.dispose()
    this.self?.dispose()
    for (const box of this.peerBoxes.values()) box.dispose()
    this.peerBoxes.clear()
  }
}

export const createPlaceholderScene = (): GameModule => new PlaceholderScene()
