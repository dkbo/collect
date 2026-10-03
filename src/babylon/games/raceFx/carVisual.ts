/**
 * 賽車車輛視覺（波 2 暫用方塊車，波 3 照 spec §4 換成 Q 版玩具車）。
 * 材質由呼叫端的 mat 快取提供、多台車共用：拆一台車只拆 mesh，材質統一在場景 dispose 時釋放。
 */
import { Color3, Mesh, MeshBuilder, type Scene, type StandardMaterial } from '@/babylon/babylonCore'
import { PLAYER_PALETTE, hexToRgb, type ColorIndex } from '@/babylon/fx/palette'

export type MatCache = (name: string, color: Color3, emissive?: Color3) => StandardMaterial

export interface CarVisual {
  root: Mesh
  wheels: Mesh[]
  shield: Mesh
  spinAngle: number
  prevX: number
  prevZ: number
  sparkAcc: number
}

export function makeCarVisual(scene: Scene, id: string, colorIndex: ColorIndex, mat: MatCache): CarVisual {
  const pal = PLAYER_PALETTE[colorIndex]
  const body = mat(`car-${pal.base}`, Color3.FromArray(hexToRgb(pal.base)))
  const darkMat = mat(`car-${pal.dark}`, Color3.FromArray(hexToRgb(pal.dark)))
  const wheelMat = mat('wheel', new Color3(0.12, 0.12, 0.14))

  const root = new Mesh(`car-${id}`, scene)
  const chassis = MeshBuilder.CreateBox(`chassis-${id}`, { width: 1.3, height: 0.35, depth: 2.2 }, scene)
  chassis.material = body
  chassis.parent = root
  chassis.position.y = 0.3
  const cabin = MeshBuilder.CreateBox(`cabin-${id}`, { width: 0.85, height: 0.35, depth: 0.8 }, scene)
  cabin.material = darkMat
  cabin.parent = root
  cabin.position.set(0, 0.62, -0.1)
  const wing = MeshBuilder.CreateBox(`wing-${id}`, { width: 1.1, height: 0.08, depth: 0.25 }, scene)
  wing.material = darkMat
  wing.parent = root
  wing.position.set(0, 0.75, -0.95)

  const wheels: Mesh[] = []
  for (const [wx, wz] of [
    [-0.65, 0.6],
    [0.65, 0.6],
    [-0.65, -0.6],
    [0.65, -0.6],
  ]) {
    const wheel = MeshBuilder.CreateCylinder(`wheel-${wx}-${wz}-${id}`, { height: 0.18, diameter: 0.4 }, scene)
    wheel.material = wheelMat
    wheel.parent = root
    wheel.position.set(wx, 0.2, wz)
    wheel.rotation.z = Math.PI / 2
    wheels.push(wheel)
  }

  const shield = MeshBuilder.CreateSphere(`shield-${id}`, { diameter: 3, segments: 12 }, scene)
  const sm = mat('shield', new Color3(0.4, 0.8, 1), new Color3(0.2, 0.5, 0.8))
  sm.alpha = 0.3
  shield.material = sm
  shield.parent = root
  shield.position.y = 0.5
  shield.setEnabled(false)

  return { root, wheels, shield, spinAngle: 0, prevX: 0, prevZ: 0, sparkAcc: 0 }
}

/**
 * 拆一台車：連子 mesh 一起拆，但不帶 disposeMaterialAndTextures —— 材質是多台車共用的快取，
 * Material.dispose 會把所有用到它的 mesh 的 material 設成 null（其他車跟著變無材質）。
 */
export function disposeCarVisual(v: CarVisual): void {
  v.root.dispose()
}
