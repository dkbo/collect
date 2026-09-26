/**
 * 廚房快手 A 方案的程式貼圖（DynamicTexture + Canvas 2D，不載入外部圖檔；kitchen spec §5）：
 * 地面棋盤（含靠檯面一圈 AO）、檯面圖集（白鋼頂／櫃門側面）、背牆（磁磚、KITCHEN 牌、掛架、時鐘、出餐牌）、出餐暖光窗。
 */
import { DynamicTexture, Texture, type Scene } from '@/babylon/babylonCore'
import type { FaceUV } from '@/babylon/fx/geometry'
import { ctxOf, roundRect, whenFontReady, type Ctx } from '@/babylon/fx/textures'
import { KITCHEN } from '@/babylon/games/kitchenFx/palette'

const FONT = 'Fredoka, "Noto Sans TC", sans-serif'

/** 地面：每格 PX 像素、NEAREST；A/B 交錯＋磚縫；可走區外圈（貼著檯面）烘一圈 AO。
 *  canvas 上方 = 世界 +Z（CreateGround 的 v=1 在 +Z）；cy=0 在 +Z（見 kitchenFx/pose 的 kitchenZ），所以 cy 由上往下畫。 */
export function createKitchenGroundTexture(scene: Scene, gridW: number, gridH: number): DynamicTexture {
  const PX = 32
  const AO = 12
  const tex = new DynamicTexture('kitchen-ground-tex', { width: gridW * PX, height: gridH * PX }, scene, false, Texture.NEAREST_SAMPLINGMODE)
  const g = ctxOf(tex)
  for (let cy = 0; cy < gridH; cy++) {
    for (let cx = 0; cx < gridW; cx++) {
      const x = cx * PX
      const y = cy * PX
      g.fillStyle = (cx + cy) % 2 === 0 ? KITCHEN.groundA : KITCHEN.groundB
      g.fillRect(x, y, PX, PX)
      g.fillStyle = KITCHEN.groundSeam
      g.fillRect(x, y, PX, 1)
      g.fillRect(x, y, 1, PX)
    }
  }
  // AO：可走區（內部 (gridW-2)×(gridH-2)）四邊，黑色 40% → 0
  const x0 = PX
  const y0 = PX
  const x1 = (gridW - 1) * PX
  const y1 = (gridH - 1) * PX
  const band = (ax: number, ay: number, bx: number, by: number, rx: number, ry: number, rw: number, rh: number) => {
    const grad = g.createLinearGradient(ax, ay, bx, by)
    grad.addColorStop(0, 'rgba(0,0,0,0.4)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grad
    g.fillRect(rx, ry, rw, rh)
  }
  band(x0, 0, x0 + AO, 0, x0, y0, AO, y1 - y0)
  band(x1, 0, x1 - AO, 0, x1 - AO, y0, AO, y1 - y0)
  band(0, y0, 0, y0 + AO, x0, y0, x1 - x0, AO)
  band(0, y1, 0, y1 - AO, x0, y1 - AO, x1 - x0, AO)
  tex.update()
  tex.wrapU = Texture.CLAMP_ADDRESSMODE
  tex.wrapV = Texture.CLAMP_ADDRESSMODE
  return tex
}

// ---- 檯面圖集：左半頂面、右半側面（256×128，各 128×128） ----

const COUNTER_W = 256
const COUNTER_H = 128
const pad = 1.5

/** 圖集格 [u0, v0, u1, v1]（內縮避免滲色） */
const counterCell = (i: 0 | 1): FaceUV => [
  (i * 128 + pad) / COUNTER_W,
  pad / COUNTER_H,
  ((i + 1) * 128 - pad) / COUNTER_W,
  (COUNTER_H - pad) / COUNTER_H,
]

/** 圓角盒 faceUV（面序 +Z, −Z, +X, −X, +Y, −Y）：四個側面都是櫃門，頂面白鋼 */
export const counterFaceUV = (): FaceUV[] => {
  const side = counterCell(1)
  const top = counterCell(0)
  return [side, side, side, side, top, side]
}

export function createCounterAtlas(scene: Scene): DynamicTexture {
  const tex = new DynamicTexture('kitchen-counter-atlas', { width: COUNTER_W, height: COUNTER_H }, scene, true, Texture.TRILINEAR_SAMPLINGMODE)
  const g = ctxOf(tex)
  // 頂面：白鋼，四周亮邊＋縫
  g.fillStyle = KITCHEN.counterTop
  g.fillRect(0, 0, 128, 128)
  g.strokeStyle = KITCHEN.counterTopEdge
  g.lineWidth = 8
  g.strokeRect(6, 6, 116, 116)
  g.strokeStyle = KITCHEN.counterDoor
  g.lineWidth = 3
  g.strokeRect(1.5, 1.5, 125, 125)
  // 側面：上淺下深的漸層（canvas 上方 = v 大 = 側面上方），中間一扇櫃門＋把手
  const grad = g.createLinearGradient(0, 0, 0, 128)
  grad.addColorStop(0, KITCHEN.counterSide[0])
  grad.addColorStop(1, KITCHEN.counterSide[1])
  g.fillStyle = grad
  g.fillRect(128, 0, 128, 128)
  g.fillStyle = KITCHEN.counterTopEdge
  g.fillRect(128, 0, 128, 10)
  roundRect(g, 128 + 14, 22, 100, 94, 10)
  g.fillStyle = KITCHEN.counterDoor
  g.fill()
  g.lineWidth = 3
  g.strokeStyle = KITCHEN.counterSide[1]
  g.stroke()
  roundRect(g, 128 + 44, 34, 40, 10, 5)
  g.fillStyle = KITCHEN.counterHandle
  g.fill()
  tex.update()
  return tex
}

// ---- 背牆 ----

export interface WallTextureLayout {
  /** 背牆寬高（世界單位） */
  width: number
  height: number
  /** 出餐窗中心 x（世界，0 = 牆中央）與窗的下緣／上緣 y */
  serveX: number
  windowY0: number
  windowY1: number
  /** 盤架（KITCHEN 牌掛在上方）的 x */
  plateX: number
}

/** 背牆貼圖的純白格（canvas 最上方、正面區塊以外；側牆與牆帽用頂點色上色時取這一格） */
export const WALL_WHITE_UV: FaceUV = [0.001, 0.996, 0.004, 0.999]

/** 背牆正面：薄荷磁磚＋縫、頂端牆帽色帶、左邊掛架、中間 KITCHEN 牌、出餐窗上方紅色「出餐」牌、右邊時鐘。
 *  回傳貼圖與正面的 UV 範圍（其餘面取 WALL_WHITE_UV 的白格）。 */
export function createWallTexture(scene: Scene, L: WallTextureLayout): { tex: DynamicTexture; faceUV: FaceUV } {
  const W = 2048
  const H = 512
  const faceH = Math.round((W * L.height) / L.width)
  const tex = new DynamicTexture('kitchen-wall-tex', { width: W, height: H }, scene, true, Texture.TRILINEAR_SAMPLINGMODE)
  const g = ctxOf(tex)
  const px = W / L.width
  // KITCHEN 牌用 Fredoka：第一次畫時字型多半還沒下載，載好再整張重畫（同 bomber 的 whenFontReady）
  const paint = (): void => {
    g.fillStyle = '#FFFFFF'
    g.fillRect(0, 0, W, H)
    // 正面畫在 canvas 底部 faceH 高的區塊（canvas 下方 = v 小）
    const top = H - faceH
    const wx = (x: number) => (x + L.width / 2) * px
    const wy = (y: number) => top + (L.height - y) * px
    // 磁磚：約 0.42 見方
    const tile = Math.max(8, Math.round(0.42 * px))
    g.fillStyle = KITCHEN.tile
    g.fillRect(0, top, W, faceH)
    g.fillStyle = KITCHEN.tileSeam
    for (let y = H; y > top; y -= tile) g.fillRect(0, y - 2, W, 3)
    let row = 0
    for (let y = H; y > top; y -= tile, row++) {
      for (let x = (row % 2) * (tile / 2); x < W; x += tile) g.fillRect(x - 1, Math.max(top, y - tile), 3, tile)
    }
    // 頂端色帶（牆帽下緣陰影）
    g.fillStyle = 'rgba(43,36,64,0.18)'
    g.fillRect(0, top, W, Math.round(0.12 * px))

    const line = (w: number) => {
      g.lineWidth = w
      g.strokeStyle = KITCHEN.outline
      g.lineJoin = 'round'
      g.lineCap = 'round'
    }
    // 掛架：木桿＋ 4 個器具剪影
    const rackY = wy(L.height - 0.55)
    line(10)
    g.strokeStyle = '#8F561D'
    g.beginPath()
    g.moveTo(wx(-8.6), rackY)
    g.lineTo(wx(-3.4), rackY)
    g.stroke()
    const icons = [-7.8, -6.4, -5.0, -3.9]
    icons.forEach((ix, i) => {
      const cx = wx(ix)
      const cy = rackY + 0.45 * px
      line(6)
      g.strokeStyle = '#6F6490'
      g.beginPath()
      if (i === 2) {
        // 叉子
        for (const dx of [-12, 0, 12]) {
          g.moveTo(cx + dx, cy - 26)
          g.lineTo(cx + dx, cy + 4)
        }
        g.moveTo(cx - 12, cy + 4)
        g.lineTo(cx + 12, cy + 4)
        g.moveTo(cx, cy + 4)
        g.lineTo(cx, cy + 30)
      } else {
        // 鍋子：碗形＋把手
        g.moveTo(cx - 26, cy - 8)
        g.lineTo(cx + 26, cy - 8)
        g.moveTo(cx - 22, cy - 8)
        g.quadraticCurveTo(cx - 22, cy + 24, cx, cy + 24)
        g.quadraticCurveTo(cx + 22, cy + 24, cx + 22, cy - 8)
        g.moveTo(cx - 8, cy - 18)
        g.lineTo(cx + 8, cy - 18)
      }
      g.stroke()
    })
    // KITCHEN 牌
    const plX = wx(L.plateX)
    const plY = wy(L.height - 0.62)
    roundRect(g, plX - 1.3 * px, plY - 0.28 * px, 2.6 * px, 0.56 * px, 0.14 * px)
    g.fillStyle = '#6F6490'
    g.fill()
    line(6)
    g.stroke()
    g.fillStyle = '#FFFFFF'
    g.font = `700 ${Math.round(0.34 * px)}px ${FONT}`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('KITCHEN', plX, plY + 2)
    // 出餐牌（窗上方）
    const sX = wx(L.serveX)
    const sY = wy(L.windowY1 + 0.26)
    roundRect(g, sX - 0.62 * px, sY - 0.19 * px, 1.24 * px, 0.38 * px, 0.14 * px)
    g.fillStyle = KITCHEN.serveSign
    g.fill()
    line(5)
    g.stroke()
    g.fillStyle = '#FFFFFF'
    g.font = `900 ${Math.round(0.26 * px)}px ${FONT}`
    g.fillText('出餐', sX, sY + 1)
    // 窗框（窗本身是另一片發光 plane）
    const wl = wx(L.serveX - 0.95)
    const wr = wx(L.serveX + 0.95)
    roundRect(g, wl - 8, wy(L.windowY1) - 8, wr - wl + 16, wy(L.windowY0) - wy(L.windowY1) + 16, 18)
    g.fillStyle = KITCHEN.outline
    g.fill()
    // 時鐘
    const cX = wx(L.serveX + 2.6)
    const cY = wy(L.height - 0.95)
    const r = 0.42 * px
    g.beginPath()
    g.arc(cX, cY, r, 0, Math.PI * 2)
    g.fillStyle = '#FFFFFF'
    g.fill()
    line(8)
    g.stroke()
    line(7)
    g.beginPath()
    g.moveTo(cX, cY)
    g.lineTo(cX, cY - r * 0.62)
    g.moveTo(cX, cY)
    g.lineTo(cX + r * 0.45, cY + r * 0.12)
    g.stroke()

    tex.update()
  }
  whenFontReady(`700 ${Math.round(0.34 * px)}px Fredoka`, tex, paint)
  const faceUV: FaceUV = [0, 0, 1, faceH / H]
  return { tex, faceUV }
}

/** 出餐暖光窗：上 #FFE9B0 → 下 #FFB84A 的漸層（emissive plane，進 Glow 白名單） */
export function createWindowTexture(scene: Scene): DynamicTexture {
  const tex = new DynamicTexture('kitchen-window-tex', { width: 64, height: 64 }, scene, false, Texture.BILINEAR_SAMPLINGMODE)
  const g: Ctx = ctxOf(tex)
  const grad = g.createLinearGradient(0, 0, 0, 64)
  grad.addColorStop(0, KITCHEN.windowTop)
  grad.addColorStop(1, KITCHEN.windowBottom)
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  tex.update()
  return tex
}

// ---- 特效（kitchen spec §7） ----

export type IndicatorMode = 'bar' | 'ring' | 'check'

export const INDICATOR_PX = 128
const GREEN = '#2FCF5E'
const CREAM = '#FFF6E3'

/**
 * 站點上方的進度提示（畫在同一張 128×128 透明貼圖上，由 effects.ts 依量化後的進度重畫）：
 * bar＝砧板進度條（中間一條）、ring＝鍋的進度環（從 12 點鐘順時針填）、check＝綠色圓形勾選章。
 */
export function paintIndicator(tex: DynamicTexture, mode: IndicatorMode, progress: number, color: string): void {
  const S = INDICATOR_PX
  const g = ctxOf(tex)
  g.clearRect(0, 0, S, S)
  g.lineJoin = 'round'
  g.lineCap = 'round'
  if (mode === 'bar') {
    const h = 30
    const y = (S - h) / 2
    roundRect(g, 6, y, S - 12, h, h / 2)
    g.fillStyle = CREAM
    g.fill()
    g.lineWidth = 6
    g.strokeStyle = KITCHEN.outline
    g.stroke()
    const w = Math.max(0, (S - 24) * progress)
    if (w > 1) {
      roundRect(g, 12, y + 6, Math.max(w, h - 12), h - 12, (h - 12) / 2)
      g.fillStyle = color
      g.fill()
    }
  } else if (mode === 'ring') {
    const r = S * 0.36
    g.beginPath()
    g.arc(S / 2, S / 2, r, 0, Math.PI * 2)
    g.lineWidth = 30
    g.strokeStyle = KITCHEN.outline
    g.stroke()
    g.lineWidth = 18
    g.strokeStyle = CREAM
    g.stroke()
    if (progress > 0) {
      g.beginPath()
      g.arc(S / 2, S / 2, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, progress))
      g.strokeStyle = color
      g.stroke()
    }
  } else {
    const r = S * 0.4
    g.beginPath()
    g.arc(S / 2, S / 2, r, 0, Math.PI * 2)
    g.fillStyle = GREEN
    g.fill()
    g.lineWidth = 8
    g.strokeStyle = KITCHEN.outline
    g.stroke()
    g.beginPath()
    g.moveTo(S * 0.3, S * 0.52)
    g.lineTo(S * 0.44, S * 0.66)
    g.lineTo(S * 0.7, S * 0.38)
    g.lineWidth = 14
    g.strokeStyle = '#FFFFFF'
    g.stroke()
  }
  tex.update()
}

export function createIndicatorTexture(scene: Scene, name: string): DynamicTexture {
  const tex = new DynamicTexture(name, { width: INDICATOR_PX, height: INDICATOR_PX }, scene, false, Texture.BILINEAR_SAMPLINGMODE)
  tex.hasAlpha = true
  return tex
}

/** 快焦「!」警示章：紅圓、深紫描邊、白色驚嘆號（兩個鍋共用一張） */
export function createAlertTexture(scene: Scene): DynamicTexture {
  const S = INDICATOR_PX
  const tex = createIndicatorTexture(scene, 'kitchen-alert-tex')
  const g = ctxOf(tex)
  g.clearRect(0, 0, S, S)
  g.beginPath()
  g.arc(S / 2, S / 2, S * 0.4, 0, Math.PI * 2)
  g.fillStyle = '#FF3B4E'
  g.fill()
  g.lineWidth = 8
  g.strokeStyle = KITCHEN.outline
  g.stroke()
  g.fillStyle = '#FFFFFF'
  roundRect(g, S / 2 - 8, S * 0.24, 16, S * 0.34, 8)
  g.fill()
  g.beginPath()
  g.arc(S / 2, S * 0.72, 9, 0, Math.PI * 2)
  g.fill()
  tex.update()
  return tex
}

/** 出餐浮字（「+20」）：金色字、深紫描邊、透明底；整局共用一張，Fredoka 載好後重畫 */
export function createScoreTexture(scene: Scene, text: string): DynamicTexture {
  const W = 192
  const H = 96
  const font = 'bold 72px Fredoka, sans-serif'
  const tex = new DynamicTexture('kitchen-score-tex', { width: W, height: H }, scene, false, Texture.BILINEAR_SAMPLINGMODE)
  tex.hasAlpha = true
  const g = ctxOf(tex)
  whenFontReady(font, tex, () => {
    g.clearRect(0, 0, W, H)
    g.font = font
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.lineJoin = 'round'
    g.lineWidth = 12
    g.strokeStyle = KITCHEN.outline
    g.strokeText(text, W / 2, H / 2 + 4)
    g.fillStyle = '#FFD23F'
    g.fillText(text, W / 2, H / 2 + 4)
    tex.update()
  })
  return tex
}

/** 場外延伸地面：深青色，中央稍亮、往外壓暗（對齊 variant-A-gameplay 的場外底色） */
export function createYardTexture(scene: Scene): DynamicTexture {
  const S = 256
  const tex = new DynamicTexture('kitchen-yard-tex', { width: S, height: S }, scene, false, Texture.BILINEAR_SAMPLINGMODE)
  const g = ctxOf(tex)
  const grad = g.createRadialGradient(S / 2, S / 2, S * 0.08, S / 2, S / 2, S * 0.5)
  grad.addColorStop(0, KITCHEN.yard[0])
  grad.addColorStop(1, KITCHEN.yard[1])
  g.fillStyle = grad
  g.fillRect(0, 0, S, S)
  tex.update()
  tex.wrapU = Texture.CLAMP_ADDRESSMODE
  tex.wrapV = Texture.CLAMP_ADDRESSMODE
  return tex
}
