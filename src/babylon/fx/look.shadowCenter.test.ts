import { describe, it, expect, afterEach } from 'vitest'
import { NullEngine } from '@babylonjs/core/Engines/nullEngine'
import { ArcRotateCamera, DirectionalLight, Scene, Vector3 } from '@/babylon/babylonCore'
import { ToyLook } from '@/babylon/fx/look'

let engine: NullEngine | null = null
afterEach(() => {
  engine?.dispose()
  engine = null
})

const setup = (tag: string) => {
  engine = new NullEngine()
  const scene = new Scene(engine)
  const cam = new ArcRotateCamera('cam', 0, 1, 10, Vector3.Zero(), scene)
  const look = new ToyLook(scene, cam, { shadowRadius: 22, tag, outline: '#2B2440' })
  const sun = scene.lights.find((l) => l.name === `${tag}-sun`) as DirectionalLight
  return { look, sun }
}

describe('ToyLook.setShadowCenter（賽車陰影框跟車，新增可選方法）', () => {
  it('不呼叫＝建構時的原點中心；(0, 0) 等於原行為', () => {
    const { look, sun } = setup('t1')
    const before = sun.position.clone()
    look.setShadowCenter(0, 0)
    expect(sun.position.x).toBeCloseTo(before.x, 6)
    expect(sun.position.y).toBeCloseTo(before.y, 6)
    expect(sun.position.z).toBeCloseTo(before.z, 6)
  })

  it('移到 (x, z)：主光沿原方向平移 x／z，高度與方向不變', () => {
    const { look, sun } = setup('t2')
    const before = sun.position.clone()
    const dir = sun.direction.clone()
    look.setShadowCenter(12, -20)
    expect(sun.position.x).toBeCloseTo(before.x + 12, 6)
    expect(sun.position.y).toBeCloseTo(before.y, 6)
    expect(sun.position.z).toBeCloseTo(before.z - 20, 6)
    expect(sun.direction.equalsWithEpsilon(dir, 1e-9)).toBe(true)
  })
})
