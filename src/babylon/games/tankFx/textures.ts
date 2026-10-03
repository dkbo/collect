/**
 * 坦克 A「Toy Army」的程式貼圖（DynamicTexture + Canvas 2D，不載入外部圖檔；spec §4／§10）：
 * 地面沙盤（棋盤＋格縫＋迷彩斑點＋烘進去的牆根陰影）、履帶紋、道具圖集、落牆預告格、blob 影。
 * canvas 上方 = 貼圖 v=1（CreateGround 的 v=1 在世界 +Z），所以格子 cy 由下往上畫。
 */
import { DynamicTexture, Texture, type Scene } from '@/babylon/babylonCore'
import type { FaceUV } from '@/babylon/fx/geometry'
import { ctxOf, roundRect } from '@/babylon/fx/textures'
import { ITEM_COLORS, ITEM_ORDER, OUTLINE, TANK } from '@/babylon/games/tankFx/palette'
import type { CellPred } from '@/babylon/games/tankFx/grid'

/** 決定性小亂數（貼圖點綴用，各端一致） */
const rand = (seed: number): (() => number) => {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0
    return s / 0x100000000
  }
}

/** 地面每格像素（16 格 × 32 = 512²） */
const GROUND_PX = 32

/** 玩具沙盤：A／B 棋盤、1px 格縫、每 4×4 格 1–2 塊迷彩斑點；isWall 的格子四周烘 3px 接地陰影 */
export function createGroundTexture(scene: Scene, gridW: number, gridH: number, isWall: CellPred): DynamicTexture {
  const PX = GROUND_PX
  const W = gridW * PX
  const H = gridH * PX
  const tex = new DynamicTexture('tank-ground-tex', { width: W, height: H }, scene, false, Texture.BILINEAR_SAMPLINGMODE)
  const g = ctxOf(tex)
  const yOf = (cy: number) => (gridH - 1 - cy) * PX
  for (let cy = 0; cy < gridH; cy++) {
    for (let cx = 0; cx < gridW; cx++) {
      g.fillStyle = (cx + cy) % 2 === 0 ? TANK.groundA : TANK.groundB
      g.fillRect(cx * PX, yOf(cy), PX, PX)
    }
  }
  // 迷彩斑點：每 4×4 區塊 1–2 塊不規則橢圓
  const rnd = rand(0x7a4c)
  g.fillStyle = TANK.camo
  g.globalAlpha = 0.55
  for (let by = 0; by < gridH; by += 4) {
    for (let bx = 0; bx < gridW; bx += 4) {
      const n = 1 + Math.floor(rnd() * 2)
      for (let i = 0; i < n; i++) {
        const x = (bx + rnd() * 4) * PX
        const y = (gridH - by - rnd() * 4) * PX
        const rx = PX * (0.35 + rnd() * 0.4)
        const ry = PX * (0.25 + rnd() * 0.3)
        g.beginPath()
        g.ellipse(x, y, rx, ry, rnd() * Math.PI, 0, Math.PI * 2)
        g.fill()
      }
    }
  }
  // 格縫
  g.globalAlpha = 0.5
  g.fillStyle = TANK.groundSeam
  for (let i = 0; i <= gridW; i++) g.fillRect(i * PX, 0, 1, H)
  for (let i = 0; i <= gridH; i++) g.fillRect(0, i * PX, W, 1)
  g.globalAlpha = 1
  // 牆根接地陰影（牆不投即時影，靠烘焙）：牆格四周外擴 3px
  g.fillStyle = 'rgba(43,36,64,0.18)'
  const SH = 3
  for (let cy = 0; cy < gridH; cy++) {
    for (let cx = 0; cx < gridW; cx++) {
      if (!isWall(cx, cy)) continue
      const inset = PX * 0.025
      roundRect(g, cx * PX + inset - SH, yOf(cy) + inset - SH, PX - inset * 2 + SH * 2, PX - inset * 2 + SH * 2, 6)
      g.fill()
    }
  }
  // 外框積木壓在場地四周：邊緣再壓一道暗邊
  g.fillStyle = 'rgba(43,36,64,0.18)'
  g.fillRect(0, 0, W, SH)
  g.fillRect(0, H - SH, W, SH)
  g.fillRect(0, 0, SH, H)
  g.fillRect(W - SH, 0, SH, H)
  tex.update()
  tex.wrapU = Texture.CLAMP_ADDRESSMODE
  tex.wrapV = Texture.CLAMP_ADDRESSMODE
  return tex
}

/** 履帶貼圖 64×32：上半全白（車身部件取這裡），下半 trackTop 底＋每 8px 一條 cleat 亮紋；u 方向 WRAP 捲動 */
export function createTrackTexture(scene: Scene, name: string): DynamicTexture {
  const W = 64
  const H = 32
  const tex = new DynamicTexture(name, { width: W, height: H }, scene, false, Texture.BILINEAR_SAMPLINGMODE)
  const g = ctxOf(tex)
  g.fillStyle = '#FFFFFF'
  g.fillRect(0, 0, W, H / 2)
  g.fillStyle = TANK.trackTop
  g.fillRect(0, H / 2, W, H / 2)
  g.fillStyle = TANK.cleat
  for (let x = 0; x < W; x += 8) g.fillRect(x + 1, H / 2 + 2, 3, H / 2 - 4)
  g.fillStyle = TANK.trackSide
  for (let x = 0; x < W; x += 8) g.fillRect(x + 4, H / 2 + 2, 1, H / 2 - 4)
  tex.update()
  tex.wrapU = Texture.WRAP_ADDRESSMODE
  tex.wrapV = Texture.CLAMP_ADDRESSMODE
  return tex
}

// ---- 道具圖集：5 欄（每種道具一欄），上半圖示格、下半外殼／下唇／白三塊色票 ----

const ITEM_TILE = 64
/** 圖集欄數（itemIcon 外掛依實例把 uv.x 平移 kindIndex / ITEM_COLUMNS） */
export const ITEM_COLUMNS = ITEM_ORDER.length

/** 代幣各部位在第 0 欄的 UV；其他道具由 shader 平移整欄 */
export interface TokenUV {
  icon: FaceUV
  shell: FaceUV
  lip: FaceUV
  white: FaceUV
}

export function tokenUV(): TokenUV {
  const W = ITEM_TILE * ITEM_COLUMNS
  const pad = 1 / W
  const col = 1 / ITEM_COLUMNS
  // 下半三塊色票各取中心一小點（外殼 0–21px、下唇 21–42px、白 42–64px）
  const swatch = (cx: number): FaceUV => [cx / W - pad, 0.22, cx / W + pad, 0.28]
  return {
    icon: [pad, 0.5 + 0.02, col - pad, 0.98],
    shell: swatch(10.5),
    lip: swatch(31.5),
    white: swatch(53),
  }
}

/** lucide 圖示（24×24 viewBox）的 path；triple 為 spec §9.5 的自訂三道扇形彈軌 */
const ICON_PATHS: Record<string, string[]> = {
  hp: ['M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'],
  speed: [
    'M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z',
  ],
  rapid: [
    'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z',
  ],
  shield: [
    'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
  ],
}

function drawTriple(g: CanvasRenderingContext2D, color: string): void {
  g.strokeStyle = color
  g.fillStyle = color
  g.lineWidth = 2.6
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(12, 20)
  g.lineTo(12, 6)
  g.moveTo(12, 20)
  g.lineTo(6.5, 7.5)
  g.moveTo(12, 20)
  g.lineTo(17.5, 7.5)
  g.stroke()
  for (const [x, y] of [
    [12, 5],
    [6, 6.5],
    [18, 6.5],
  ]) {
    g.beginPath()
    g.arc(x, y, 2.4, 0, Math.PI * 2)
    g.fill()
  }
}

/** 道具圖集 320×128：canvas 上半（v 0.5–1）每欄外殼底色上一個圖示，下半是外殼／下唇／白三塊色票 */
export function createItemAtlas(scene: Scene): DynamicTexture {
  const T = ITEM_TILE
  const tex = new DynamicTexture('tank-item-atlas', { width: T * ITEM_COLUMNS, height: T * 2 }, scene, false, Texture.BILINEAR_SAMPLINGMODE)
  const g = ctxOf(tex)
  ITEM_ORDER.forEach((kind, i) => {
    const c = ITEM_COLORS[kind]
    const x0 = i * T
    g.fillStyle = c.shell
    g.fillRect(x0, 0, T, T)
    g.fillRect(x0, T, 21, T)
    g.fillStyle = c.lip
    g.fillRect(x0 + 21, T, 21, T)
    g.fillStyle = '#FFFFFF'
    g.fillRect(x0 + 42, T, T - 42, T)
    g.save()
    g.translate(x0 + T * 0.14, T * 0.14)
    g.scale((T * 0.72) / 24, (T * 0.72) / 24)
    if (kind === 'triple') {
      drawTriple(g, c.icon)
    } else {
      g.lineJoin = 'round'
      for (const d of ICON_PATHS[kind]) {
        const p = new Path2D(d)
        g.fillStyle = c.icon
        g.fill(p)
        g.lineWidth = 1.6
        g.strokeStyle = kind === 'speed' ? c.icon : OUTLINE
        g.globalAlpha = kind === 'speed' ? 1 : 0.35
        g.stroke(p)
        g.globalAlpha = 1
      }
    }
    g.restore()
  })
  tex.update()
  return tex
}

/** 落牆預告格 64²：圓角紅底 50%＋紅邊 100%＋白色 triangle-alert */
export function createWarnTexture(scene: Scene): DynamicTexture {
  const S = 64
  const tex = new DynamicTexture('tank-warn-tex', { width: S, height: S }, scene, false, Texture.BILINEAR_SAMPLINGMODE)
  tex.hasAlpha = true
  const g = ctxOf(tex)
  g.clearRect(0, 0, S, S)
  roundRect(g, 3, 3, S - 6, S - 6, 9)
  g.fillStyle = 'rgba(255,59,48,0.5)'
  g.fill()
  g.lineWidth = 4
  g.strokeStyle = TANK.warn
  g.stroke()
  g.save()
  g.translate(S * 0.2, S * 0.2)
  g.scale((S * 0.6) / 24, (S * 0.6) / 24)
  g.strokeStyle = '#FFFFFF'
  g.lineWidth = 2.4
  g.lineCap = 'round'
  g.lineJoin = 'round'
  g.stroke(new Path2D('m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3'))
  g.stroke(new Path2D('M12 9v4'))
  g.stroke(new Path2D('M12 17h.01'))
  g.restore()
  tex.update()
  return tex
}

/** blob 影 64²：深紫徑向漸層（陰影被降級關掉時墊在坦克與道具下面） */
export function createBlobTexture(scene: Scene): DynamicTexture {
  const S = 64
  const tex = new DynamicTexture('tank-blob-tex', { width: S, height: S }, scene, false, Texture.BILINEAR_SAMPLINGMODE)
  tex.hasAlpha = true
  const g = ctxOf(tex)
  g.clearRect(0, 0, S, S)
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  gr.addColorStop(0, 'rgba(43,36,64,0.55)')
  gr.addColorStop(0.6, 'rgba(43,36,64,0.35)')
  gr.addColorStop(1, 'rgba(43,36,64,0)')
  g.fillStyle = gr
  g.fillRect(0, 0, S, S)
  tex.update()
  return tex
}
