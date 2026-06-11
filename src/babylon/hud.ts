/**
 * 場景內文字面板（DynamicTexture 平面掛在相機前，不依賴 @babylonjs/gui）。
 * 用於倒數、HUD、結算板等；由 race / bomber 等遊戲共用。
 */
import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Vector3,
  type Camera,
  type Scene,
} from '@babylonjs/core'

export interface TextPanel {
  /** 重繪（多行以 \n 分隔；空字串隱藏；內容沒變就跳過） */
  draw(text: string, px?: number): void
  dispose(): void
}

export const createTextPanel = (
  scene: Scene,
  camera: Camera,
  name: string,
  w: number,
  h: number,
  pos: Vector3
): TextPanel => {
  const plane = MeshBuilder.CreatePlane(
    name,
    { width: w, height: h, sideOrientation: Mesh.DOUBLESIDE },
    scene
  )
  plane.parent = camera
  plane.position = pos
  const tex = new DynamicTexture(`${name}-tex`, { width: w * 128, height: h * 128 }, scene, true)
  tex.hasAlpha = true
  const mat = new StandardMaterial(`${name}-mat`, scene)
  mat.diffuseTexture = tex
  mat.emissiveColor = Color3.White()
  mat.disableLighting = true
  mat.useAlphaFromDiffuseTexture = true
  plane.material = mat

  let last = ''
  return {
    draw(text, px = 64) {
      if (last === text) return
      last = text
      const c = tex.getContext()
      const { width, height } = tex.getSize()
      c.clearRect(0, 0, width, height)
      const ctx2d = c as CanvasRenderingContext2D
      ctx2d.font = `bold ${px}px sans-serif`
      ctx2d.textAlign = 'center'
      ctx2d.textBaseline = 'middle'
      ctx2d.fillStyle = 'rgba(15,23,42,0.55)'
      const lines = text ? text.split('\n') : []
      if (lines.length) ctx2d.fillRect(0, 0, width, height)
      ctx2d.fillStyle = '#f1f5f9'
      const lineH = px * 1.3
      const y0 = height / 2 - ((lines.length - 1) * lineH) / 2
      lines.forEach((line, i) => ctx2d.fillText(line, width / 2, y0 + i * lineH))
      tex.update()
      plane.setEnabled(lines.length > 0)
    },
    dispose() {
      tex.dispose()
      plane.dispose()
    },
  }
}
