/**
 * Babylon.js 集中匯入點：一律走深層路徑，不從 `@babylonjs/core` 整包匯入。
 * 整包匯入會把整個引擎（約 6.4 MB）打進 vendor-babylon；深層匯入只帶實際用到的模組。
 * 不用 `*.pure` 版本：非 pure 模組會順便註冊副作用（Mesh.CreateX、scene 元件等）。
 */
import '@babylonjs/core/Culling/ray' // scene.pick：指標／觸控移動時 InputManager 會呼叫，缺了會報「Ray needs to be imported」
import '@babylonjs/core/Particles/particleSystemComponent' // ParticleSystem 的 scene 元件與 createEffectForParticles
import '@babylonjs/core/Rendering/edgesRenderer' // mesh.enableEdgesRendering()

import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder'
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder'
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder'
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder'
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder'
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder'

export { Engine } from '@babylonjs/core/Engines/engine'
export { Scene } from '@babylonjs/core/scene'
export { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera'
export type { Camera } from '@babylonjs/core/Cameras/camera'
export { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
export { Color3, Color4 } from '@babylonjs/core/Maths/math.color'
export { Vector3 } from '@babylonjs/core/Maths/math.vector'
export { Mesh } from '@babylonjs/core/Meshes/mesh'
export { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
export { Texture } from '@babylonjs/core/Materials/Textures/texture'
export { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'
export { ParticleSystem } from '@babylonjs/core/Particles/particleSystem'

/** 只收專案用到的 builder；官方 MeshBuilder 會把所有形狀一起帶進來 */
export const MeshBuilder = {
  CreateBox,
  CreateCylinder,
  CreateDisc,
  CreateGround,
  CreatePlane,
  CreateSphere,
  CreateTorus,
}
