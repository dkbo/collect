import { describe, it, expect, afterEach } from 'vitest'
import { NullEngine } from '@babylonjs/core/Engines/nullEngine'
import { Scene } from '@/babylon/babylonCore'
import { CarKit, disposeCarVisual } from '@/babylon/games/raceFx/carVisual'

let engine: NullEngine | null = null
afterEach(() => {
  engine?.dispose()
  engine = null
})

const setup = () => {
  engine = new NullEngine()
  const scene = new Scene(engine)
  return { scene, kit: new CarKit(scene, { youTexture: () => null }) }
}

describe('disposeCarVisual（共用材質）', () => {
  it('拆掉一台車後，其他車的車身／輪胎／護盾材質仍在、未被釋放', () => {
    const { scene, kit } = setup()
    const self = kit.make('p1', 0, false, true)
    const bot = kit.make('bot-0', 0, true, false)
    kit.putWheels(self, 0)
    kit.putWheels(bot, 0)
    expect(kit.wheels.count).toBe(8)
    disposeCarVisual(kit, bot)
    expect(bot.body.isDisposed()).toBe(true)
    expect(kit.wheels.count).toBe(4)
    for (const m of [self.body, self.shield]) {
      expect(m.material).not.toBeNull()
      expect(scene.materials).toContain(m.material)
    }
    for (const m of kit.litMaterials) expect(scene.materials).toContain(m)
    expect(scene.materials).toContain(kit.shieldMat)
    // 之後新建的車拿到的共用材質也還能用
    const again = kit.make('bot-0', 0, true, false)
    expect(again.body.material).toBe(kit.bodyMat)
    expect(scene.materials).toContain(again.body.material)
  })

  it('子 mesh（車身、護盾、你標記）一併拆掉', () => {
    const { kit } = setup()
    const v = kit.make('p1', 1, false, true)
    const kids = v.root.getChildMeshes()
    expect(kids.length).toBeGreaterThanOrEqual(3)
    disposeCarVisual(kit, v)
    for (const k of kids) expect(k.isDisposed()).toBe(true)
  })
})
