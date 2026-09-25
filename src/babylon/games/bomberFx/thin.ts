/**
 * thin instance 群組：一個 mesh 畫同形狀的所有實例（1 個 draw call）。
 * slot 管理在 ThinSlots（純邏輯），這裡只負責把 buffer 同步給 Babylon。
 */
import type { Mesh } from '@/babylon/babylonCore'
import { composeMatrix, type Trs } from '@/babylon/games/bomberFx/geometry'
import { ThinSlots } from '@/babylon/games/bomberFx/thinSlots'

export class ThinGroup<K> {
  readonly mesh: Mesh
  readonly slots: ThinSlots<K>
  private version: number

  constructor(mesh: Mesh, capacity: number) {
    this.mesh = mesh
    this.slots = new ThinSlots<K>(capacity)
    this.version = this.slots.bufferVersion
    // 實例散在整張地圖、數量常變，不做 culling（省得每次重算 bounding）
    mesh.alwaysSelectAsActiveMesh = true
    mesh.thinInstanceSetBuffer('matrix', this.slots.buffer, 16, false)
    mesh.thinInstanceCount = 0
    mesh.isVisible = false
  }

  get count(): number {
    return this.slots.count
  }

  has(key: K): boolean {
    return this.slots.has(key)
  }

  keys(): K[] {
    return this.slots.keys()
  }

  /** 新增或更新一個實例的 TRS */
  put(key: K, t: Trs): void {
    this.slots.add(key)
    this.slots.write(key, (buf, o) => composeMatrix(buf, o, t))
  }

  remove(key: K): void {
    this.slots.remove(key)
  }

  clear(): void {
    this.slots.clear()
  }

  /** 每幀呼叫一次：有變動才上傳；buffer 擴充過就重新綁定 */
  sync(): void {
    if (!this.slots.dirty) return
    if (this.version !== this.slots.bufferVersion) {
      this.mesh.thinInstanceSetBuffer('matrix', this.slots.buffer, 16, false)
      this.version = this.slots.bufferVersion
    } else {
      this.mesh.thinInstanceBufferUpdated('matrix')
    }
    this.mesh.thinInstanceCount = this.slots.count
    this.mesh.isVisible = this.slots.count > 0
    this.slots.dirty = false
  }

  dispose(): void {
    this.mesh.dispose()
  }
}
