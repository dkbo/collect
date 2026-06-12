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

/** 倒數面板：圓角膠囊背景 + 描邊發光文字 + 脈衝動畫 */
export const createCountdownPanel = (
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
  const tex = new DynamicTexture(`${name}-tex`, { width: w * 256, height: h * 256 }, scene, true)
  tex.hasAlpha = true
  const mat = new StandardMaterial(`${name}-mat`, scene)
  mat.diffuseTexture = tex
  mat.emissiveColor = Color3.White()
  mat.disableLighting = true
  mat.useAlphaFromDiffuseTexture = true
  plane.material = mat

  let last = ''
  let pulsePhase = 0
  const pulseFn = () => {
    pulsePhase += scene.getEngine().getDeltaTime() * 0.006
  }
  const observer = scene.onBeforeRenderObservable.add(pulseFn)

  return {
    draw(text, px = 64) {
      if (last === text && text !== 'GO!') {
        // GO! 持續動畫所以不跳過
        if (text !== 'GO!' && last === text) return
      }
      last = text
      const c = tex.getContext()
      const { width, height } = tex.getSize()
      c.clearRect(0, 0, width, height)
      const ctx2d = c as CanvasRenderingContext2D

      if (!text) {
        plane.setEnabled(false)
        return
      }
      plane.setEnabled(true)

      const lines = text.split('\n')
      const isCountdown = /^\d+$/.test(text)
      const isGo = text === 'GO!'

      // 脈衝縮放
      const pulse = isCountdown ? 1 + Math.sin(pulsePhase) * 0.06 : isGo ? 1.15 : 1
      const fontPx = px * pulse

      // 自動縮放字級
      const maxLineW = width * 0.88
      ctx2d.font = `bold ${fontPx}px sans-serif`
      let widest = 0
      for (const line of lines) {
        const lw = ctx2d.measureText(line).width
        if (lw > widest) widest = lw
      }
      const scale = widest > maxLineW ? maxLineW / widest : 1
      const finalPx = fontPx * scale

      // 膠囊背景（倒數 / GO 專用）
      if (isCountdown || isGo) {
        const bgW = Math.min(width * 0.7, finalPx * 3.2)
        const bgH = finalPx * 2.8
        const rx = bgW / 2
        const ry = bgH / 2
        const cx = width / 2
        const cy = height / 2
        const r = finalPx * 0.45

        // 外發光
        ctx2d.shadowColor = isGo ? 'rgba(74,222,128,0.6)' : 'rgba(251,191,36,0.5)'
        ctx2d.shadowBlur = finalPx * 0.6

        // 膠囊形狀
        ctx2d.beginPath()
        ctx2d.roundRect(cx - rx, cy - ry, bgW, bgH, r)
        ctx2d.fillStyle = isGo
          ? 'rgba(20,83,45,0.82)'
          : 'rgba(30,41,59,0.78)'
        ctx2d.fill()
        ctx2d.shadowBlur = 0

        // 邊框
        ctx2d.strokeStyle = isGo
          ? 'rgba(74,222,128,0.7)'
          : 'rgba(251,191,36,0.55)'
        ctx2d.lineWidth = Math.max(2, finalPx * 0.06)
        ctx2d.stroke()
      }

      // 文字
      ctx2d.textAlign = 'center'
      ctx2d.textBaseline = 'middle'
      ctx2d.font = `bold ${finalPx}px sans-serif`

      const lineH = finalPx * 1.3
      const y0 = height / 2 - ((lines.length - 1) * lineH) / 2

      lines.forEach((line, i) => {
        const y = y0 + i * lineH

        // 文字描邊
        ctx2d.strokeStyle = isGo
          ? 'rgba(74,222,128,0.9)'
          : isCountdown
            ? 'rgba(251,191,36,0.85)'
            : 'rgba(15,23,42,0.7)'
        ctx2d.lineWidth = Math.max(3, finalPx * 0.08)
        ctx2d.lineJoin = 'round'
        ctx2d.strokeText(line, width / 2, y)

        // 文字填色
        ctx2d.fillStyle = isGo
          ? '#bbf7d0'
          : isCountdown
            ? '#fef3c7'
            : '#f1f5f9'
        ctx2d.fillText(line, width / 2, y)
      })

      tex.update()
    },
    dispose() {
      scene.onBeforeRenderObservable.remove(observer)
      tex.dispose()
      plane.dispose()
    },
  }
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
      ctx2d.textAlign = 'center'
      ctx2d.textBaseline = 'middle'
      const lines = text ? text.split('\n') : []

      const maxLineW = width * 0.94
      ctx2d.font = `bold ${px}px sans-serif`
      let widest = 0
      for (const line of lines) {
        const w = ctx2d.measureText(line).width
        if (w > widest) widest = w
      }
      const scale = widest > maxLineW ? maxLineW / widest : 1
      const fontPx = px * scale

      ctx2d.font = `bold ${fontPx}px sans-serif`
      ctx2d.fillStyle = 'rgba(15,23,42,0.55)'
      if (lines.length) ctx2d.fillRect(0, 0, width, height)
      ctx2d.fillStyle = '#f1f5f9'
      const lineH = fontPx * 1.3
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
