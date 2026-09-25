/**
 * 粒子發射佇列（純邏輯）：一組 ParticleSystem 在同一幀要在很多位置各噴幾顆
 * （每顆炸彈的引信、每個被炸的木箱），Babylon 的 emitter 只有一個位置，
 * 所以把每顆粒子的出生位置與樣式排進佇列，由 startPositionFunction 逐顆取出。
 */

export interface BurstRequest<S> {
  x: number
  y: number
  z: number
  /** 出生位置：x／z 在中心 ±spread、y 在中心往上 0..spread（地面爆發不鑽進地裡） */
  spread: number
  count: number
  style: S
}

export interface BurstParticle<S> {
  x: number
  y: number
  z: number
  /** 這顆所屬請求的中心（放射狀方向用） */
  cx: number
  cy: number
  cz: number
  style: S
}

export class BurstQueue<S> {
  private items: BurstRequest<S>[] = []
  private pending = 0
  private readonly rnd: () => number
  private readonly max: number

  constructor(rnd: () => number = Math.random, max = Infinity) {
    this.rnd = rnd
    this.max = max
  }

  get total(): number {
    return this.pending
  }

  push(req: BurstRequest<S>): void {
    if (req.count <= 0) return
    this.items.push({ ...req })
    this.pending += req.count
    // 超過上限：丟最舊的（粒子系統容量滿了也噴不出來）
    while (this.pending > this.max && this.items.length > 1) {
      this.pending -= this.items.shift()!.count
    }
  }

  next(): BurstParticle<S> | null {
    const head = this.items[0]
    if (!head) return null
    const j = () => (this.rnd() * 2 - 1) * head.spread
    const p: BurstParticle<S> = {
      x: head.x + j(),
      y: head.y + this.rnd() * head.spread,
      z: head.z + j(),
      cx: head.x,
      cy: head.y,
      cz: head.z,
      style: head.style,
    }
    head.count--
    this.pending--
    if (head.count <= 0) this.items.shift()
    return p
  }

  clear(): void {
    this.items = []
    this.pending = 0
  }
}
