import { describe, expect, it } from 'vitest'
import type { Mesh } from '@/babylon/babylonCore'
import { ThinGroup } from '@/babylon/games/bomberFx/thin'

/**
 * 假 mesh：照 Babylon thinInstanceMesh 的行為模擬 GPU 端——
 * thinInstanceBufferUpdated 只上傳「當下 thinInstanceCount 筆」矩陣（thinInstanceMesh.pure.js:308），
 * thinInstanceSetBuffer 整份上傳並把 count 設成 buffer 容量。
 */
function fakeMesh() {
  const gpu: number[] = []
  let data: Float32Array = new Float32Array(0)
  const m = {
    alwaysSelectAsActiveMesh: false,
    isVisible: true,
    thinInstanceCount: 0,
    thinInstanceSetBuffer(_kind: string, buf: Float32Array) {
      data = buf
      gpu.length = 0
      gpu.push(...buf)
      m.thinInstanceCount = buf.length / 16
    },
    thinInstanceBufferUpdated() {
      for (let i = 0; i < m.thinInstanceCount * 16; i++) gpu[i] = data[i]
    },
    dispose() {},
  }
  /** GPU 上第 i 個實例的平移 x（矩陣第 12 個元素） */
  const gpuX = (i: number) => gpu[i * 16 + 12]
  return { mesh: m as unknown as Mesh, gpuX }
}

describe('ThinGroup.sync', () => {
  it('新增實例（count 變大）後，新 slot 的矩陣要上傳到 GPU', () => {
    const { mesh, gpuX } = fakeMesh()
    const g = new ThinGroup<number>(mesh, 8)
    g.put(1, { x: 3, y: 0, z: 0 })
    g.sync()
    g.put(2, { x: 7, y: 0, z: 0 })
    g.sync()
    expect(mesh.thinInstanceCount).toBe(2)
    expect(gpuX(0)).toBe(3)
    expect(gpuX(1)).toBe(7)
  })

  it('移除後補上新實例，沿用的 slot 要是新矩陣，不是前任的', () => {
    const { mesh, gpuX } = fakeMesh()
    const g = new ThinGroup<number>(mesh, 8)
    g.put(1, { x: 1, y: 0, z: 0 })
    g.put(2, { x: 2, y: 0, z: 0 })
    g.sync()
    g.remove(2)
    g.sync()
    g.put(3, { x: 9, y: 0, z: 0 })
    g.sync()
    expect(mesh.thinInstanceCount).toBe(2)
    expect(gpuX(1)).toBe(9)
  })
})
