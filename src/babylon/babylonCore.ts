/**
 * Babylon.js 集中匯入點：一律走深層路徑，不從 `@babylonjs/core` 整包匯入。
 * 整包匯入會把整個引擎（約 6.4 MB）打進 vendor-babylon；深層匯入只帶實際用到的模組。
 * 不用 `*.pure` 版本：非 pure 模組會順便註冊副作用（scene 元件、engine extension 等）；
 * 非 pure 入口也不會帶的（scene.pick 的 Ray、ParticleSystem 的 scene 元件、edges renderer）在下方明確補上。
 */
import '@babylonjs/core/Culling/ray' // scene.pick：指標／觸控移動時 InputManager 會呼叫，缺了會報「Ray needs to be imported」
import '@babylonjs/core/Particles/particleSystemComponent' // ParticleSystem 的 scene 元件與 createEffectForParticles
import '@babylonjs/core/Rendering/edgesRenderer' // mesh.enableEdgesRendering()
import '@babylonjs/core/Meshes/thinInstanceMesh' // mesh.thinInstanceSetBuffer()／thinInstanceCount（bomber 的牆、箱、炸彈、火焰、道具）
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent' // ShadowGenerator 的 scene 元件（bomber 陰影）
import '@babylonjs/core/Layers/effectLayerSceneComponent' // GlowLayer 的 scene 元件（bomber 發光白名單）
import '@babylonjs/core/Rendering/outlineRenderer' // mesh.renderOutline（bomber 卡通描邊）
import '@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent' // DefaultRenderingPipeline 掛到 scene

import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { CreateCylinder, CreateCylinderVertexData } from '@babylonjs/core/Meshes/Builders/cylinderBuilder'
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder'
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder'
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder'
import { CreateSphere, CreateSphereVertexData } from '@babylonjs/core/Meshes/Builders/sphereBuilder'
import { CreateTorus, CreateTorusVertexData } from '@babylonjs/core/Meshes/Builders/torusBuilder'

export { Engine } from '@babylonjs/core/Engines/engine'
export { Scene } from '@babylonjs/core/scene'
export { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera'
export type { Camera } from '@babylonjs/core/Cameras/camera'
export { TargetCamera } from '@babylonjs/core/Cameras/targetCamera'
export { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
export { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'
export { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator'
export { GlowLayer } from '@babylonjs/core/Layers/glowLayer'
export { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline'
export { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration'
export { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase'
export type { MaterialDefines } from '@babylonjs/core/Materials/materialDefines'
export type { Material } from '@babylonjs/core/Materials/material'
export { ShaderLanguage } from '@babylonjs/core/Materials/shaderLanguage'
export { Color3, Color4 } from '@babylonjs/core/Maths/math.color'
export { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector'
export { Mesh } from '@babylonjs/core/Meshes/mesh'
export { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
export { Texture } from '@babylonjs/core/Materials/Textures/texture'
export { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'
export { ParticleSystem } from '@babylonjs/core/Particles/particleSystem'
export { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData'
export { SceneInstrumentation } from '@babylonjs/core/Instrumentation/sceneInstrumentation'

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

/** 只取頂點資料、不建 mesh（程式建模合併多個部件用） */
export const VertexBuilders = {
  CreateCylinderVertexData,
  CreateSphereVertexData,
  CreateTorusVertexData,
}
