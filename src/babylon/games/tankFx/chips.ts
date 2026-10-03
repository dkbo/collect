/**
 * 碎片與木板拋射（effects.ts 拆出）：1 組 thin instance＋實例色，重力拋射、落地彈一下、最後 150ms 縮小。
 * 每幀整批重寫矩陣與實例色，兩者同序。
 */
import { Mesh, StandardMaterial, type Scene } from '@/babylon/babylonCore'
import { fxRandom } from '@/babylon/fx/emitter'
import { roundedBox } from '@/babylon/fx/geometry'
import { rgba, toMesh } from '@/babylon/fx/models'
import { ThinGroup } from '@/babylon/fx/thin'
import { ThinSlots } from '@/babylon/fx/thinSlots'

const CHIP_GRAVITY = -20
const CHIP_CAP = 48

interface Chip {
  key: number
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  yaw: number
  pitch: number
  spin: number
  sx: number
  sy: number
  sz: number
  rgba: readonly [number, number, number, number]
  born: number
  life: number
}

export interface ChipSpawn {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  sx: number
  sy: number
  sz: number
  hex: string
  life: number
  now: number
}

export class ChipField {
  private readonly group: ThinGroup<number>
  private readonly colors = new ThinSlots<number>(CHIP_CAP, 4)
  private colorVersion = -1
  private chips: Chip[] = []
  private seq = 0

  constructor(scene: Scene, mat: StandardMaterial) {
    const mesh: Mesh = toMesh('tank-chips', roundedBox({ width: 0.3, height: 0.3, depth: 0.3, radius: 0.05, segments: 1 }), scene)
    mesh.material = mat
    mesh.isPickable = false
    this.group = new ThinGroup<number>(mesh, CHIP_CAP)
  }

  add(c: ChipSpawn): void {
    if (this.chips.length >= CHIP_CAP) this.chips.shift()
    this.chips.push({
      key: this.seq++,
      x: c.x,
      y: c.y,
      z: c.z,
      vx: c.vx,
      vy: c.vy,
      vz: c.vz,
      yaw: fxRandom() * Math.PI * 2,
      pitch: fxRandom() * Math.PI,
      spin: (fxRandom() * 2 - 1) * 14,
      sx: c.sx,
      sy: c.sy,
      sz: c.sz,
      rgba: rgba(c.hex),
      born: c.now,
      life: c.life,
    })
  }

  update(now: number, dt: number): void {
    if (this.chips.length === 0 && this.group.count === 0) return
    this.group.clear()
    this.colors.clear()
    this.chips = this.chips.filter((c) => {
      const age = now - c.born
      if (age >= c.life) return false
      c.vy += CHIP_GRAVITY * dt
      c.x += c.vx * dt
      c.y += c.vy * dt
      c.z += c.vz * dt
      if (c.y < 0.06) {
        c.y = 0.06
        c.vy = Math.abs(c.vy) * 0.3
        c.vx *= 0.55
        c.vz *= 0.55
        c.spin *= 0.5
      }
      c.yaw += c.spin * dt
      c.pitch += c.spin * 0.7 * dt
      const k = Math.min(1, (c.life - age) / 150)
      this.group.put(c.key, { x: c.x, y: c.y, z: c.z, yaw: c.yaw, pitch: c.pitch, sx: c.sx * k, sy: c.sy * k, sz: c.sz * k })
      this.colors.add(c.key)
      this.colors.write(c.key, (buf, o) => buf.set(c.rgba, o))
      return true
    })
    this.group.sync()
    const cs = this.colors
    if (!cs.dirty) return
    if (this.colorVersion !== cs.bufferVersion) {
      this.group.mesh.thinInstanceSetBuffer('color', cs.buffer, 4, false)
      this.colorVersion = cs.bufferVersion
    } else {
      this.group.mesh.thinInstanceBufferUpdated('color')
    }
    cs.dirty = false
  }

  clear(): void {
    this.chips = []
    this.group.clear()
    this.group.sync()
  }

  dispose(): void {
    this.chips = []
    this.group.dispose()
  }
}
