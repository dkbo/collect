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

/** 文字面板樣式：plain 維持原本整片半透明深色填滿；glass 為毛玻璃／立體玻璃感 */
export type TextPanelStyle = 'plain' | 'glass'

/** 毛玻璃／立體玻璃感背景：圓角矩形 + 由上而下微漸層 + 內側白色高光描邊 + 外框細線 + 柔和陰影 */
const drawGlassBackground = (
  c: CanvasRenderingContext2D,
  width: number,
  height: number
): void => {
  const pad = Math.min(width, height) * 0.08
  const x = pad
  const y = pad
  const w = width - pad * 2
  const h = height - pad * 2
  const r = Math.min(w, h) * 0.32

  const roundRect = () => {
    c.beginPath()
    c.roundRect(x, y, w, h, r)
  }

  // 投影：柔和陰影營造浮起的立體感
  c.save()
  c.shadowColor = 'rgba(0,0,0,0.4)'
  c.shadowBlur = h * 0.22
  c.shadowOffsetY = h * 0.08

  // 半透明填色 + 由上而下微漸層
  const grad = c.createLinearGradient(0, y, 0, y + h)
  grad.addColorStop(0, 'rgba(56,72,104,0.42)')
  grad.addColorStop(1, 'rgba(15,23,42,0.5)')
  roundRect()
  c.fillStyle = grad
  c.fill()
  c.restore()

  // 外框細線
  roundRect()
  c.strokeStyle = 'rgba(148,163,184,0.5)'
  c.lineWidth = Math.max(1, h * 0.018)
  c.stroke()

  // 內側白色低 alpha 高光描邊（上半弧較亮，模擬玻璃反光）
  c.save()
  roundRect()
  c.clip()
  c.beginPath()
  c.roundRect(x + h * 0.04, y + h * 0.04, w - h * 0.08, h - h * 0.08, r * 0.9)
  c.strokeStyle = 'rgba(255,255,255,0.22)'
  c.lineWidth = Math.max(1, h * 0.03)
  c.stroke()
  // 頂部高光帶
  const hi = c.createLinearGradient(0, y, 0, y + h * 0.5)
  hi.addColorStop(0, 'rgba(255,255,255,0.18)')
  hi.addColorStop(1, 'rgba(255,255,255,0)')
  c.beginPath()
  c.roundRect(x, y, w, h * 0.5, r)
  c.fillStyle = hi
  c.fill()
  c.restore()
}

export const createTextPanel = (
  scene: Scene,
  camera: Camera,
  name: string,
  w: number,
  h: number,
  pos: Vector3,
  style: TextPanelStyle = 'plain'
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
      if (lines.length) {
        if (style === 'glass') drawGlassBackground(ctx2d, width, height)
        else {
          ctx2d.fillStyle = 'rgba(15,23,42,0.55)'
          ctx2d.fillRect(0, 0, width, height)
        }
      }
      // 玻璃樣式文字加柔和陰影，提升在透明背景上的可讀性
      if (style === 'glass') {
        ctx2d.shadowColor = 'rgba(0,0,0,0.45)'
        ctx2d.shadowBlur = fontPx * 0.16
        ctx2d.shadowOffsetY = fontPx * 0.04
      }
      ctx2d.fillStyle = '#f1f5f9'
      const lineH = fontPx * 1.3
      const y0 = height / 2 - ((lines.length - 1) * lineH) / 2
      lines.forEach((line, i) => ctx2d.fillText(line, width / 2, y0 + i * lineH))
      ctx2d.shadowColor = 'transparent'
      ctx2d.shadowBlur = 0
      ctx2d.shadowOffsetY = 0
      tex.update()
      plane.setEnabled(lines.length > 0)
    },
    dispose() {
      tex.dispose()
      plane.dispose()
    },
  }
}
