/**
 * 玩具系列粒子（bomber 與 kitchen 共用）：每種貼圖一組 ParticleSystem，同一幀要在很多位置噴時
 * 把每顆的出生位置與樣式排進 BurstQueue，由 startPositionFunction 逐顆取出。
 */
import { Color4, ParticleSystem, Vector3, type Scene, type Texture } from '@/babylon/babylonCore'
import { BurstQueue, type BurstParticle } from '@/babylon/fx/burstQueue'
import { hexToRgb } from '@/babylon/fx/palette'

export type Dir = 'fountain' | 'up' | 'burst' | 'radial'

export interface FxStyle {
  c1: Color4
  c2: Color4
  dead: Color4
  size: readonly [number, number]
  life: readonly [number, number]
  /** 初速（方向向量的長度倍率） */
  power: readonly [number, number]
  dir: Dir
}

export const c4 = (hex: string, a = 1): Color4 => {
  const [r, g, b] = hexToRgb(hex)
  return new Color4(r, g, b, a)
}
/** 特效專用亂數（純視覺）：不吃 Math.random，host 的掉寶判定與 qa 的確定性亂數序列不受特效多寡影響 */
export const fxRandom = (() => {
  let s = 0x9e3779b9
  return (): number => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
})()
export const between = ([a, b]: readonly [number, number]): number => a + fxRandom() * (b - a)

export const style = (c1: string, c2: string, dead: string, o: Omit<FxStyle, 'c1' | 'c2' | 'dead'>, a = 1): FxStyle => ({
  c1: c4(c1, a),
  c2: c4(c2, a),
  dead: c4(dead, 0),
  ...o,
})

/** 一組粒子：佇列裡每筆請求在自己的位置噴自己的樣式 */
export class FxEmitter {
  readonly ps: ParticleSystem
  private readonly queue: BurstQueue<FxStyle>
  private cur: BurstParticle<FxStyle> | null = null

  constructor(scene: Scene, name: string, tex: Texture, cap: number, blend: number, gravity: number) {
    this.queue = new BurstQueue<FxStyle>(fxRandom, cap)
    const ps = new ParticleSystem(name, cap, scene)
    ps.particleTexture = tex
    ps.emitter = Vector3.Zero()
    ps.emitRate = 0
    ps.manualEmitCount = 0
    ps.updateSpeed = 1 / 60 // 壽命用真實秒數（Babylon 依 animation ratio 補幀率）
    ps.gravity = new Vector3(0, gravity, 0)
    ps.blendMode = blend
    ps.minEmitPower = 1
    ps.maxEmitPower = 1 // 初速改在方向函式裡乘（emit power 在出生位置之前就抽好了）
    ps.minInitialRotation = 0
    ps.maxInitialRotation = Math.PI * 2
    ps.minAngularSpeed = -3
    ps.maxAngularSpeed = 3
    // 出生位置之後才算大小與顏色，所以在這裡換成這顆所屬請求的樣式；壽命已抽過，直接覆寫
    ps.startPositionFunction = (_m, pos, particle) => {
      const p = this.queue.next()
      this.cur = p
      if (!p) {
        pos.set(0, -50, 0)
        particle.lifeTime = 0.001
        return
      }
      pos.set(p.x, p.y, p.z)
      const s = p.style
      particle.lifeTime = between(s.life)
      ps.minSize = s.size[0]
      ps.maxSize = s.size[1]
      ps.color1 = s.c1
      ps.color2 = s.c2
      ps.colorDead = s.dead
    }
    ps.startDirectionFunction = (_m, dir) => {
      const p = this.cur
      if (!p) {
        dir.set(0, 0, 0)
        return
      }
      const k = between(p.style.power)
      const r = () => fxRandom() * 2 - 1
      if (p.style.dir === 'up') dir.set(r() * 0.25, 1, r() * 0.25)
      else if (p.style.dir === 'burst') dir.set(r(), 0.2 + fxRandom() * 1.4, r())
      else if (p.style.dir === 'radial') {
        let dx = p.x - p.cx
        let dz = p.z - p.cz
        const len = Math.hypot(dx, dz)
        if (len < 1e-4) {
          const a = fxRandom() * Math.PI * 2
          dx = Math.cos(a)
          dz = Math.sin(a)
        } else {
          dx /= len
          dz /= len
        }
        dir.set(dx, 0.12, dz)
      } else dir.set(r(), 1 + fxRandom() * 1.5, r())
      dir.scaleInPlace(k)
    }
    ps.start()
    this.ps = ps
  }

  emit(x: number, y: number, z: number, spread: number, count: number, s: FxStyle): void {
    // 上一幀沒噴完的是容量滿了噴不出來的，丟掉免得累積成延遲的一大團
    if (this.ps.manualEmitCount <= 0 && this.queue.total > 0) this.queue.clear()
    this.queue.push({ x, y, z, spread, count, style: s })
    this.ps.manualEmitCount = this.queue.total
  }

  clear(): void {
    this.queue.clear()
    this.ps.manualEmitCount = 0
    this.ps.reset()
  }

  dispose(): void {
    this.ps.dispose(false)
  }
}

