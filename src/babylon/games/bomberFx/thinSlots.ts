/**
 * thin instance 的 slot 管理（純邏輯，不依賴 Babylon）：key → 連續 slot，matrix 攤平在一條 Float32Array。
 * 刪除用 swap-remove（最後一筆搬進空位），所以 [0, count) 永遠是有效實例，mesh 只要設 thinInstanceCount。
 */
export class ThinSlots<K> {
  buffer: Float32Array
  count = 0
  /** 有寫入待上傳 GPU */
  dirty = true
  /** buffer 重新配置的次數（變了就要重新 thinInstanceSetBuffer） */
  bufferVersion = 0
  private slots = new Map<K, number>()
  private keyAt: K[] = []
  private readonly stride: number

  constructor(capacity: number, stride = 16) {
    this.stride = stride
    this.buffer = new Float32Array(Math.max(1, capacity) * stride)
  }

  get capacity(): number {
    return this.buffer.length / this.stride
  }

  has(key: K): boolean {
    return this.slots.has(key)
  }

  slotOf(key: K): number | undefined {
    return this.slots.get(key)
  }

  keys(): K[] {
    return this.keyAt.slice(0, this.count)
  }

  add(key: K): number {
    const cur = this.slots.get(key)
    if (cur !== undefined) return cur
    if (this.count >= this.capacity) {
      const next = new Float32Array(this.buffer.length * 2)
      next.set(this.buffer)
      this.buffer = next
      this.bufferVersion++
    }
    const slot = this.count++
    this.slots.set(key, slot)
    this.keyAt[slot] = key
    this.dirty = true
    return slot
  }

  /** 寫入 key 的那一段（offset 為 buffer 內起點）；key 不存在就不做事 */
  write(key: K, fn: (buf: Float32Array, offset: number) => void): void {
    const slot = this.slots.get(key)
    if (slot === undefined) return
    fn(this.buffer, slot * this.stride)
    this.dirty = true
  }

  remove(key: K): void {
    const slot = this.slots.get(key)
    if (slot === undefined) return
    const last = this.count - 1
    if (slot !== last) {
      const lastKey = this.keyAt[last]
      this.buffer.copyWithin(slot * this.stride, last * this.stride, (last + 1) * this.stride)
      this.keyAt[slot] = lastKey
      this.slots.set(lastKey, slot)
    }
    this.slots.delete(key)
    this.count--
    this.dirty = true
  }

  clear(): void {
    this.slots.clear()
    this.keyAt = []
    this.count = 0
    this.dirty = true
  }
}
