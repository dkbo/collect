import { describe, it, expect, afterEach } from 'vitest'
import { NullEngine } from '@babylonjs/core/Engines/nullEngine'
import { Scene, StandardMaterial } from '@/babylon/babylonCore'
import { disposeCarVisual, makeCarVisual, type MatCache } from '@/babylon/games/raceFx/carVisual'

let engine: NullEngine | null = null
afterEach(() => {
  engine?.dispose()
  engine = null
})

const setup = () => {
  engine = new NullEngine()
  const scene = new Scene(engine)
  const cache = new Map<string, StandardMaterial>()
  const mat: MatCache = (name, color) => {
    let m = cache.get(name)
    if (!m) {
      m = new StandardMaterial(name, scene)
      m.diffuseColor = color
      cache.set(name, m)
    }
    return m
  }
  return { scene, cache, mat }
}

describe('disposeCarVisual（共用材質）', () => {
  it('拆掉一台車後，其他車的輪胎／護盾／同色車身材質仍在、未被釋放', () => {
    const { scene, cache, mat } = setup()
    const self = makeCarVisual(scene, 'p1', 0, mat)
    const bot = makeCarVisual(scene, 'bot-0', 0, mat)
    disposeCarVisual(bot)
    expect(bot.root.isDisposed()).toBe(true)
    for (const m of self.root.getChildMeshes()) {
      expect(m.material).not.toBeNull()
      expect(scene.materials).toContain(m.material)
    }
    for (const m of cache.values()) expect(scene.materials).toContain(m)
    // 之後新建的車拿到的快取材質也還能用
    const again = makeCarVisual(scene, 'bot-0', 0, mat)
    expect(again.wheels[0].material).toBe(cache.get('wheel'))
    expect(scene.materials).toContain(again.wheels[0].material)
  })

  it('子 mesh 一併拆掉', () => {
    const { scene, mat } = setup()
    const v = makeCarVisual(scene, 'p1', 1, mat)
    const kids = v.root.getChildMeshes()
    disposeCarVisual(v)
    for (const k of kids) expect(k.isDisposed()).toBe(true)
  })
})
