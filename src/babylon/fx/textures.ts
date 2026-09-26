/**
 * 玩具系列共用的程式貼圖（DynamicTexture + Canvas 2D，不載入外部圖檔）：Canvas 小工具與 billboard 標籤。
 * 遊戲專屬的地面、圖集留在各自的 `games/<遊戲>Fx/textures.ts`。
 */
import { DynamicTexture, Texture, type Scene } from '@/babylon/babylonCore'
import { OUTLINE } from '@/babylon/fx/palette'

export type Ctx = CanvasRenderingContext2D

export const ctxOf = (tex: DynamicTexture): Ctx => tex.getContext() as unknown as Ctx

export const roundRect = (g: Ctx, x: number, y: number, w: number, h: number, r: number): void => {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

/** 膠囊標籤（「你」／AI 小章）：透明底、本色膠囊、深紫描邊、白字 */
export function createLabelTexture(scene: Scene, name: string, text: string, bg: string, w = 128, h = 64): DynamicTexture {
  const tex = new DynamicTexture(name, { width: w, height: h }, scene, false, Texture.BILINEAR_SAMPLINGMODE)
  tex.hasAlpha = true
  const g = ctxOf(tex)
  g.clearRect(0, 0, w, h)
  roundRect(g, 4, 4, w - 8, h - 8, (h - 8) / 2)
  g.fillStyle = bg
  g.fill()
  g.lineWidth = 5
  g.strokeStyle = OUTLINE
  g.stroke()
  g.fillStyle = '#FFFFFF'
  g.font = `900 ${Math.round(h * 0.56)}px Fredoka, "Noto Sans TC", sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.lineWidth = 6
  g.strokeStyle = OUTLINE
  g.strokeText(text, w / 2, h / 2 + 2)
  g.fillText(text, w / 2, h / 2 + 2)
  tex.update()
  return tex
}

/** 地面 ring（放炸彈、落牆灰塵環）：透明底白色圓環，顏色由材質 tint */
export function createRingTexture(scene: Scene, name = 'bomber-ring-tex'): DynamicTexture {
  const S = 128
  const tex = new DynamicTexture(name, { width: S, height: S }, scene, false, Texture.BILINEAR_SAMPLINGMODE)
  tex.hasAlpha = true
  const g = ctxOf(tex)
  g.clearRect(0, 0, S, S)
  const gr = g.createRadialGradient(S / 2, S / 2, S * 0.28, S / 2, S / 2, S * 0.48)
  gr.addColorStop(0, 'rgba(255,255,255,0)')
  gr.addColorStop(0.45, 'rgba(255,255,255,1)')
  gr.addColorStop(0.7, 'rgba(255,255,255,0.85)')
  gr.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = gr
  g.fillRect(0, 0, S, S)
  tex.update()
  return tex
}

/** 字型載好再重畫一次（Fredoka 由 index.css 的 @font-face 宣告，第一次用到才下載） */
export function whenFontReady(font: string, tex: DynamicTexture, draw: () => void): void {
  draw()
  const fonts = typeof document === 'undefined' ? undefined : document.fonts
  if (!fonts) return
  let alive = true
  tex.onDisposeObservable.addOnce(() => (alive = false))
  fonts.load(font).then(
    () => alive && draw(),
    () => undefined
  )
}
