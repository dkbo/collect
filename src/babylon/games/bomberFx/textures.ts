/**
 * 炸彈超人 A 方案的程式貼圖（DynamicTexture + Canvas 2D，不載入外部圖檔）。
 * 地面棋盤、方塊圖集（柱牆／外框／落牆／木箱三態）、道具圖集；「你」與 AI 標籤在 fx/textures。
 */
import { DynamicTexture, Texture, type Scene } from '@/babylon/babylonCore'
import { ITEM_COLORS, ITEM_ICON_DARK, TOY } from '@/babylon/games/bomberFx/palette'
import type { FaceUV } from '@/babylon/fx/geometry'
import { ctxOf, roundRect, whenFontReady, type Ctx } from '@/babylon/fx/textures'

export { createRingTexture, whenFontReady } from '@/babylon/fx/textures'

/** 決定性小亂數（貼圖點綴用，各端一致） */
const rand = (seed: number): (() => number) => {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0
    return s / 0x100000000
  }
}

/** 地面棋盤：每格 PX 像素、NEAREST 取樣；A/B 交錯、格頂緣白色 13% 亮邊、草叢點綴。
 *  canvas 上方 = 世界 +Z（CreateGround 的 v=1 在 +Z），所以 cy 由下往上畫。 */
export function createGroundTexture(scene: Scene, gridW: number, gridH: number): DynamicTexture {
  const PX = 32
  const tex = new DynamicTexture('bomber-ground-tex', { width: gridW * PX, height: gridH * PX }, scene, false, Texture.NEAREST_SAMPLINGMODE)
  const g = ctxOf(tex)
  const rnd = rand(0xb0b)
  for (let cy = 0; cy < gridH; cy++) {
    for (let cx = 0; cx < gridW; cx++) {
      const x = cx * PX
      const y = (gridH - 1 - cy) * PX
      g.fillStyle = (cx + cy) % 2 === 0 ? TOY.groundA : TOY.groundB
      g.fillRect(x, y, PX, PX)
      g.fillStyle = 'rgba(255,255,255,0.13)'
      g.fillRect(x, y, PX, Math.max(1, Math.round(PX * 0.06)))
      // 草叢：約三成的格子點 2–3 顆
      if (rnd() < 0.32) {
        g.fillStyle = TOY.grassTuft
        const n = 2 + Math.floor(rnd() * 2)
        const bx = x + 6 + Math.floor(rnd() * (PX - 14))
        const by = y + 8 + Math.floor(rnd() * (PX - 14))
        for (let i = 0; i < n; i++) g.fillRect(bx + i * 3, by + (i % 2) * 2, 2, 2)
      }
    }
  }
  tex.update()
  tex.wrapU = Texture.CLAMP_ADDRESSMODE
  tex.wrapV = Texture.CLAMP_ADDRESSMODE
  return tex
}

/** 方塊圖集 4×4 格（每格 128px）：索引見 BLOCK_TILE */
export const BLOCK_TILE = {
  pillarSide: 0,
  pillarTop: 1,
  borderSide: 2,
  borderTop: 3,
  suddenTop: 4,
  crateSide: 5,
  crateTop: 6,
  hardSide: 7,
  hardTop: 8,
  dmgSide: 9,
  dmgTop: 10,
  plain: 11,
} as const
const ATLAS_N = 4
const TILE = 128

/** 圖集第 i 格的 UV 矩形（內縮 1.5px 避免取樣滲色）；canvas 上方為 v=1 */
export function blockTileUV(i: number): FaceUV {
  const col = i % ATLAS_N
  const row = Math.floor(i / ATLAS_N)
  const size = ATLAS_N * TILE
  const pad = 1.5 / size
  return [col / ATLAS_N + pad, 1 - (row + 1) / ATLAS_N + pad, (col + 1) / ATLAS_N - pad, 1 - row / ATLAS_N - pad]
}

/** 圓角盒 faceUV：側面四面同一格、頂面一格、底面用 plain */
export function boxFaceUV(side: number, top: number): FaceUV[] {
  const s = blockTileUV(side)
  return [s, s, s, s, blockTileUV(top), blockTileUV(BLOCK_TILE.plain)]
}

const vGrad = (g: Ctx, x: number, y: number, h: number, c0: string, c1: string): CanvasGradient => {
  const gr = g.createLinearGradient(x, y, x, y + h)
  gr.addColorStop(0, c0)
  gr.addColorStop(1, c1)
  return gr
}

function paintStoneSide(g: Ctx, x: number, y: number, top: string, bottom: string, joint: string, moss?: string): void {
  g.fillStyle = vGrad(g, x, y, TILE, top, bottom)
  g.fillRect(x, y, TILE, TILE)
  g.strokeStyle = joint
  g.lineWidth = 4
  g.lineCap = 'round'
  // 磚縫：兩道橫縫 + 錯開的豎縫
  for (const [yy, xs] of [[0.42, [0.3, 0.72]], [0.72, [0.16, 0.54, 0.86]]] as const) {
    g.beginPath()
    g.moveTo(x + 14, y + TILE * yy)
    g.lineTo(x + TILE - 14, y + TILE * yy)
    g.stroke()
    for (const xx of xs) {
      g.beginPath()
      g.moveTo(x + TILE * xx, y + TILE * yy + 4)
      g.lineTo(x + TILE * xx, y + TILE * yy + 22)
      g.stroke()
    }
  }
  if (moss) {
    g.fillStyle = moss
    g.beginPath()
    g.ellipse(x + TILE * 0.3, y + 10, 16, 7, 0, 0, Math.PI * 2)
    g.ellipse(x + TILE * 0.78, y + 8, 10, 5, 0, 0, Math.PI * 2)
    g.fill()
  }
}

function paintStoneTop(g: Ctx, x: number, y: number, c0: string, c1: string, moss?: string): void {
  g.fillStyle = vGrad(g, x, y, TILE, c0, c1)
  g.fillRect(x, y, TILE, TILE)
  g.fillStyle = 'rgba(255,255,255,0.35)'
  roundRect(g, x + 14, y + 12, TILE - 28, 10, 5)
  g.fill()
  if (moss) {
    g.fillStyle = moss
    g.beginPath()
    g.ellipse(x + TILE * 0.5, y + TILE * 0.18, 12, 6, 0, 0, Math.PI * 2)
    g.fill()
  }
}

function paintCrateSide(g: Ctx, x: number, y: number, wood: string, brace: string): void {
  g.fillStyle = wood
  g.fillRect(x, y, TILE, TILE)
  g.strokeStyle = brace
  g.lineWidth = 10
  g.strokeRect(x + 5, y + 5, TILE - 10, TILE - 10)
  g.lineWidth = 9
  g.beginPath()
  g.moveTo(x + 12, y + 12)
  g.lineTo(x + TILE - 12, y + TILE - 12)
  g.moveTo(x + TILE - 12, y + 12)
  g.lineTo(x + 12, y + TILE - 12)
  g.stroke()
}

function paintCrateTop(g: Ctx, x: number, y: number, wood: string, line: string): void {
  g.fillStyle = wood
  g.fillRect(x, y, TILE, TILE)
  g.strokeStyle = line
  g.lineWidth = 8
  g.strokeRect(x + 4, y + 4, TILE - 8, TILE - 8)
  g.lineWidth = 4
  for (const yy of [0.37, 0.63]) {
    g.beginPath()
    g.moveTo(x + 12, y + TILE * yy)
    g.lineTo(x + TILE - 12, y + TILE * yy)
    g.stroke()
  }
}

/** 硬磚：木板 + 四角鐵角 + 中央鐵箍與金色鉚釘；broken 時鐵箍中央斷開並疊裂痕 */
function paintHard(g: Ctx, x: number, y: number, wood: string, top: boolean, broken: boolean): void {
  g.fillStyle = wood
  g.fillRect(x, y, TILE, TILE)
  g.strokeStyle = 'rgba(90,50,20,0.55)'
  g.lineWidth = 4
  for (const yy of [0.3, 0.7]) {
    g.beginPath()
    g.moveTo(x + 8, y + TILE * yy)
    g.lineTo(x + TILE - 8, y + TILE * yy)
    g.stroke()
  }
  const [iron, ironHi] = TOY.hardIron
  if (!top) {
    // 鐵箍
    const by = y + TILE * 0.42
    g.fillStyle = iron
    if (broken) {
      g.fillRect(x, by, TILE * 0.4, 20)
      g.fillRect(x + TILE * 0.6, by, TILE * 0.4, 20)
    } else {
      g.fillRect(x, by, TILE, 20)
    }
    g.fillStyle = ironHi
    g.fillRect(x, by, broken ? TILE * 0.4 : TILE, 5)
    if (broken) g.fillRect(x + TILE * 0.6, by, TILE * 0.4, 5)
    g.fillStyle = TOY.hardRivet
    for (const xx of broken ? [0.2, 0.8] : [0.3, 0.7]) {
      g.beginPath()
      g.arc(x + TILE * xx, by + 10, 5, 0, Math.PI * 2)
      g.fill()
    }
  }
  // 四角鐵角
  for (const [ax, ay] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const cx = x + (ax ? TILE - 30 : 0)
    const cy = y + (ay ? TILE - 30 : 0)
    g.fillStyle = iron
    roundRect(g, cx, cy, 30, 30, 8)
    g.fill()
    g.fillStyle = ironHi
    roundRect(g, cx + 5, cy + 5, 20, 8, 4)
    g.fill()
  }
  if (broken) {
    g.strokeStyle = TOY.outline
    g.lineWidth = 5
    g.lineJoin = 'round'
    g.beginPath()
    g.moveTo(x + TILE * 0.55, y + 10)
    g.lineTo(x + TILE * 0.42, y + TILE * 0.35)
    g.lineTo(x + TILE * 0.6, y + TILE * 0.55)
    g.lineTo(x + TILE * 0.45, y + TILE * 0.9)
    g.stroke()
  }
}

/** 方塊圖集：柱牆、外框牆、落牆紅頂、木箱／硬磚／受損硬磚 */
export function createBlockAtlas(scene: Scene): DynamicTexture {
  const size = ATLAS_N * TILE
  const tex = new DynamicTexture('bomber-block-atlas', { width: size, height: size }, scene, false, Texture.BILINEAR_SAMPLINGMODE)
  const g = ctxOf(tex)
  const at = (i: number): [number, number] => [(i % ATLAS_N) * TILE, Math.floor(i / ATLAS_N) * TILE]

  paintStoneSide(g, ...at(BLOCK_TILE.pillarSide), TOY.pillarSide[0], TOY.pillarSide[1], TOY.pillarJoint)
  paintStoneTop(g, ...at(BLOCK_TILE.pillarTop), TOY.pillarTop[0], TOY.pillarTop[1])
  paintStoneSide(g, ...at(BLOCK_TILE.borderSide), TOY.borderTop, TOY.borderSide, '#554a78', TOY.moss)
  paintStoneTop(g, ...at(BLOCK_TILE.borderTop), TOY.borderTop, '#9d8db8', TOY.moss)
  paintStoneTop(g, ...at(BLOCK_TILE.suddenTop), TOY.suddenTop, '#d8382e')
  paintCrateSide(g, ...at(BLOCK_TILE.crateSide), TOY.crateSide, TOY.crateBrace)
  paintCrateTop(g, ...at(BLOCK_TILE.crateTop), TOY.crateTop, '#d49a4a')
  paintHard(g, ...at(BLOCK_TILE.hardSide), TOY.hardWood, false, false)
  paintHard(g, ...at(BLOCK_TILE.hardTop), TOY.hardWood, true, false)
  paintHard(g, ...at(BLOCK_TILE.dmgSide), TOY.damagedWood, false, true)
  paintHard(g, ...at(BLOCK_TILE.dmgTop), TOY.damagedWood, true, true)
  const [px, py] = at(BLOCK_TILE.plain)
  g.fillStyle = '#5a4a3a'
  g.fillRect(px, py, TILE, TILE)
  tex.update()
  return tex
}

/** 道具圖集：8 格橫排，0–5 依 ITEM_ORDER 畫底色＋圖示，6 為純白（代幣外殼取色用） */
export const ITEM_ORDER = ['bomb', 'fire', 'speed', 'kick', 'throw', 'invincible'] as const
export const ITEM_WHITE_CELL = 6
const ITEM_CELLS = 8

export function itemCellUV(i: number): FaceUV {
  const pad = 1.5 / (ITEM_CELLS * TILE)
  return [i / ITEM_CELLS + pad, 0.02, (i + 1) / ITEM_CELLS - pad, 0.98]
}

function paintIcon(g: Ctx, kind: (typeof ITEM_ORDER)[number], x: number, y: number): void {
  const c = (kind === 'speed' || kind === 'invincible') ? ITEM_ICON_DARK : '#FFFFFF'
  g.fillStyle = c
  g.strokeStyle = c
  g.lineWidth = 10
  g.lineCap = 'round'
  g.lineJoin = 'round'
  const m = TILE / 2
  if (kind === 'bomb') {
    g.beginPath()
    g.arc(x + m - 6, y + m + 8, 30, 0, Math.PI * 2)
    g.stroke()
    g.beginPath()
    g.moveTo(x + m + 16, y + m - 14)
    g.quadraticCurveTo(x + m + 30, y + m - 36, x + m + 40, y + m - 30)
    g.stroke()
  } else if (kind === 'fire') {
    g.beginPath()
    g.moveTo(x + m, y + 22)
    g.bezierCurveTo(x + m + 40, y + 56, x + m + 34, y + 104, x + m, y + 106)
    g.bezierCurveTo(x + m - 34, y + 104, x + m - 40, y + 64, x + m - 12, y + 44)
    g.bezierCurveTo(x + m - 8, y + 60, x + m + 4, y + 62, x + m, y + 22)
    g.fill()
  } else if (kind === 'speed') {
    g.beginPath()
    g.moveTo(x + m + 12, y + 18)
    g.lineTo(x + m - 26, y + 70)
    g.lineTo(x + m - 2, y + 70)
    g.lineTo(x + m - 12, y + 110)
    g.lineTo(x + m + 26, y + 56)
    g.lineTo(x + m + 2, y + 56)
    g.closePath()
    g.fill()
  } else if (kind === 'kick') {
    for (const [ox, oy] of [[-18, -6], [18, 10]]) {
      g.beginPath()
      g.ellipse(x + m + ox, y + m + oy - 8, 12, 22, 0, 0, Math.PI * 2)
      g.fill()
      g.beginPath()
      g.ellipse(x + m + ox, y + m + oy + 26, 9, 8, 0, 0, Math.PI * 2)
      g.fill()
    }
  } else if (kind === 'throw') {
    roundRect(g, x + m - 28, y + m - 6, 56, 44, 16)
    g.fill()
    for (let i = 0; i < 4; i++) {
      roundRect(g, x + m - 28 + i * 15, y + m - 34, 12, 36, 6)
      g.fill()
    }
    roundRect(g, x + m - 44, y + m + 2, 20, 12, 6)
    g.fill()
  } else {
    g.beginPath()
    g.moveTo(x + m, y + 20)
    g.lineTo(x + m + 36, y + 34)
    g.quadraticCurveTo(x + m + 36, y + 90, x + m, y + 108)
    g.quadraticCurveTo(x + m - 36, y + 90, x + m - 36, y + 34)
    g.closePath()
    g.stroke()
  }
}

/** public/battle/bomber/ 下的素材網址（AC1；vite base 為 /collect/） */
export const bomberAssetUrl = (file: string): string => `${import.meta.env.BASE_URL}battle/bomber/${file}`

/** 道具圖集：底色＋C 式高光由程式畫，圖示取自 items_atlas.webp（6 格橫排、每格 128，順序同 ITEM_ORDER）。
 *  圖檔載入前只有底色；載入失敗時退回程式畫的圖示。 */
export function createItemAtlas(scene: Scene, iconUrl: string = bomberAssetUrl('items_atlas.webp')): DynamicTexture {
  const tex = new DynamicTexture('bomber-item-atlas', { width: ITEM_CELLS * TILE, height: TILE }, scene, false, Texture.BILINEAR_SAMPLINGMODE)
  const g = ctxOf(tex)
  const paint = (icons: HTMLImageElement | 'fallback' | null): void => {
    g.clearRect(0, 0, ITEM_CELLS * TILE, TILE)
    ITEM_ORDER.forEach((kind, i) => {
      const x = i * TILE
      g.fillStyle = ITEM_COLORS[kind]
      g.fillRect(x, 0, TILE, TILE)
      // C 式鏡面高光（左上白色硬點）
      g.fillStyle = 'rgba(255,255,255,0.55)'
      g.beginPath()
      g.ellipse(x + 30, 22, 16, 8, -0.4, 0, Math.PI * 2)
      g.fill()
      if (icons === 'fallback') paintIcon(g, kind, x, 0)
      else if (icons) g.drawImage(icons, i * TILE, 0, TILE, TILE, x + 8, 8, TILE - 16, TILE - 16)
    })
    g.fillStyle = '#FFFFFF'
    g.fillRect(ITEM_WHITE_CELL * TILE, 0, TILE, TILE)
    tex.update()
  }
  paint(null)
  if (typeof Image === 'undefined') {
    paint('fallback')
    return tex
  }
  let alive = true
  tex.onDisposeObservable.addOnce(() => (alive = false))
  const img = new Image()
  img.onload = () => alive && paint(img)
  img.onerror = () => alive && paint('fallback')
  img.src = iconUrl
  return tex
}

/** 焦痕 decal：深紫褐色不規則斑塊，邊緣柔化 */
export function createScorchTexture(scene: Scene): DynamicTexture {
  const S = 128
  const tex = new DynamicTexture('bomber-scorch-tex', { width: S, height: S }, scene, false, Texture.BILINEAR_SAMPLINGMODE)
  tex.hasAlpha = true
  const g = ctxOf(tex)
  g.clearRect(0, 0, S, S)
  const rnd = rand(0x5c0)
  const blot = (x: number, y: number, r: number, a: number) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r)
    gr.addColorStop(0, `rgba(40,28,36,${a})`)
    gr.addColorStop(0.6, `rgba(52,36,40,${a * 0.7})`)
    gr.addColorStop(1, 'rgba(60,40,40,0)')
    g.fillStyle = gr
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.fill()
  }
  blot(S / 2, S / 2, S * 0.44, 0.6)
  for (let i = 0; i < 4; i++) {
    const a = rnd() * Math.PI * 2
    const d = S * (0.16 + rnd() * 0.12)
    blot(S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, S * (0.14 + rnd() * 0.06), 0.4)
  }
  tex.update()
  return tex
}

/** 拾取飄字「+1」：金色字、深紫描邊、透明底 */
export function createPlusOneTexture(scene: Scene): DynamicTexture {
  const W = 128
  const H = 96
  const font = 'bold 72px Fredoka, sans-serif'
  const tex = new DynamicTexture('bomber-plus1-tex', { width: W, height: H }, scene, false, Texture.BILINEAR_SAMPLINGMODE)
  tex.hasAlpha = true
  const g = ctxOf(tex)
  whenFontReady(font, tex, () => {
    g.clearRect(0, 0, W, H)
    g.font = font
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.lineJoin = 'round'
    g.lineWidth = 12
    g.strokeStyle = TOY.outline
    g.strokeText('+1', W / 2, H / 2 + 4)
    g.fillStyle = TOY.invincible
    g.fillText('+1', W / 2, H / 2 + 4)
    tex.update()
  })
  return tex
}
