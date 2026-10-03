/**
 * A「Toy Racer」程式貼圖（spec §4.3／§10，DynamicTexture + Canvas 2D，不新增圖檔）：
 * 桌墊、木桌、路面、起跑格、道具箱圖集、跳台斜紋、加速帶箭頭、拱門橫幅、「你」標記、blob 影。
 * 粒子與火花芯重用 public/battle/bomber/fx_*.webp 原路徑。
 */
import { DynamicTexture, Texture, type Scene } from '@/babylon/babylonCore'
import { ctxOf, roundRect, whenFontReady, type Ctx } from '@/babylon/fx/textures'
import { OUTLINE } from '@/babylon/fx/palette'
import { BOX_FACE_COLORS, RACE } from '@/babylon/games/raceFx/palette'

const dyn = (scene: Scene, name: string, w: number, h: number, alpha = false): DynamicTexture => {
  const tex = new DynamicTexture(name, { width: w, height: h }, scene, true, Texture.TRILINEAR_SAMPLINGMODE)
  tex.hasAlpha = alpha
  return tex
}

/** 粒子貼圖（bomber 的 fx_*.webp，原路徑） */
export const fxAssetUrl = (file: string): string => `${import.meta.env.BASE_URL}battle/bomber/${file}`

/** 桌墊：10 單位一大格的奶茶色棋盤、每 2 單位細線、每 10 單位粗線、四邊圓角包邊、左下角尺規刻度 */
export function createMatTexture(scene: Scene, worldW: number, worldH: number, size = 1024): DynamicTexture {
  const tex = dyn(scene, 'race-mat-tex', size, size)
  const g = ctxOf(tex)
  const kx = size / worldW
  const kz = size / worldH
  for (let i = 0; i < worldW / 10; i++) {
    for (let j = 0; j < worldH / 10; j++) {
      g.fillStyle = (i + j) % 2 === 0 ? RACE.matA : RACE.matB
      g.fillRect(i * 10 * kx, j * 10 * kz, 10 * kx + 1, 10 * kz + 1)
    }
  }
  g.fillStyle = RACE.matLine
  for (let x = 0; x <= worldW; x += 2) g.fillRect(x * kx, 0, 1, size)
  for (let z = 0; z <= worldH; z += 2) g.fillRect(0, z * kz, size, 1)
  g.fillStyle = RACE.matMajor
  for (let x = 0; x <= worldW; x += 10) g.fillRect(x * kx - 1, 0, 2, size)
  for (let z = 0; z <= worldH; z += 10) g.fillRect(0, z * kz - 1, size, 2)
  // 包邊
  const b = 1.5 * kx
  g.lineWidth = b
  g.strokeStyle = RACE.matMajor
  roundRect(g, b / 2, b / 2, size - b, size - b, b * 2)
  g.stroke()
  // 尺規刻度（左下角，純裝飾）
  g.fillStyle = RACE.matMajor
  for (let i = 0; i < 30; i++) g.fillRect(b * 2 + i * kx, size - b * 2 - (i % 5 === 0 ? 14 : 7), 1.5, i % 5 === 0 ? 14 : 7)
  tex.update()
  return tex
}

/** 木桌：table 底＋6 條縱向木紋（WRAP 重複） */
export function createTableTexture(scene: Scene): DynamicTexture {
  const S = 256
  const tex = dyn(scene, 'race-table-tex', S, S)
  const g = ctxOf(tex)
  g.fillStyle = RACE.table
  g.fillRect(0, 0, S, S)
  g.fillStyle = RACE.tableGrain
  for (let i = 0; i < 6; i++) g.fillRect(i * 43 + 8, 0, 3 + (i % 3) * 2, S)
  g.globalAlpha = 0.35
  for (let i = 0; i < 6; i++) g.fillRect(i * 43 + 26, 0, 1, S)
  g.globalAlpha = 1
  tex.update()
  tex.wrapU = Texture.WRAP_ADDRESSMODE
  tex.wrapV = Texture.WRAP_ADDRESSMODE
  return tex
}

/** 路面 128×256（一格 = 沿線 8 單位）：深紫灰底、拼接縫＋兩個凸榫、兩側內緣白線 */
export function createRoadTexture(scene: Scene): DynamicTexture {
  const W = 128
  const H = 256
  const tex = dyn(scene, 'race-road-tex', W, H)
  const g = ctxOf(tex)
  g.fillStyle = RACE.road
  g.fillRect(0, 0, W, H)
  g.fillStyle = RACE.roadSeam
  g.fillRect(0, 0, W, 3)
  for (const cx of [W * 0.3, W * 0.7]) {
    g.beginPath()
    g.arc(cx, 3, 9, 0, Math.PI)
    g.fill()
  }
  g.fillStyle = RACE.roadEdge
  g.fillRect(4, 0, 6, H)
  g.fillRect(W - 10, 0, 6, H)
  tex.update()
  tex.wrapU = Texture.CLAMP_ADDRESSMODE
  tex.wrapV = Texture.WRAP_ADDRESSMODE
  tex.anisotropicFilteringLevel = 8
  return tex
}

/** 起跑線 128×32：2 列 × 8 欄黑白格 */
export function createStartTexture(scene: Scene): DynamicTexture {
  const tex = dyn(scene, 'race-start-tex', 128, 32)
  const g = ctxOf(tex)
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 === 0 ? RACE.startA : RACE.startB
      g.fillRect(i * 16, j * 16, 16, 16)
    }
  }
  tex.update()
  return tex
}

const shadeHex = (hex: string, k: number): string => {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * k))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

/** 道具箱圖集 1024×256：4 格各一種底色＋暗框＋白「?」深紫描邊 */
export function createBoxAtlas(scene: Scene): DynamicTexture {
  const T = 256
  const tex = dyn(scene, 'race-box-atlas', T * 4, T)
  const draw = (): void => {
    const g = ctxOf(tex)
    BOX_FACE_COLORS.forEach((c, i) => {
      const x = i * T
      g.fillStyle = shadeHex(c, 0.75)
      g.fillRect(x, 0, T, T)
      g.fillStyle = c
      roundRect(g, x + 18, 18, T - 36, T - 36, 30)
      g.fill()
      g.font = '700 190px Fredoka, sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.lineJoin = 'round'
      g.lineWidth = 20
      g.strokeStyle = OUTLINE
      g.strokeText('?', x + T / 2, T / 2 + 10)
      g.fillStyle = '#FFFFFF'
      g.fillText('?', x + T / 2, T / 2 + 10)
    })
    tex.update()
  }
  whenFontReady('700 190px Fredoka', tex, draw)
  return tex
}

/** 跳台 128×128：上 7/8 黃底 45° 深紫斜紋（頂面）、下 1/8 純白（側面／唇口用頂點色） */
export function createRampTexture(scene: Scene): DynamicTexture {
  const S = 128
  const tex = dyn(scene, 'race-ramp-tex', S, S)
  const g = ctxOf(tex)
  const top = S - S / 8
  g.fillStyle = RACE.ramp
  g.fillRect(0, 0, S, top)
  g.save()
  g.beginPath()
  g.rect(0, 0, S, top)
  g.clip()
  g.fillStyle = RACE.rampStripe
  for (let k = -S; k < S * 2; k += 32) {
    g.beginPath()
    g.moveTo(k, 0)
    g.lineTo(k + 14, 0)
    g.lineTo(k + 14 - top, top)
    g.lineTo(k - top, top)
    g.closePath()
    g.fill()
  }
  g.restore()
  g.fillStyle = '#FFFFFF'
  g.fillRect(0, top, S, S - top)
  tex.update()
  return tex
}

/** 加速帶箭頭 64×128：boostPad 底＋3 個 boostArrow V 形（v 方向 WRAP 捲動） */
export function createPadTexture(scene: Scene): DynamicTexture {
  const W = 64
  const H = 128
  const tex = dyn(scene, 'race-pad-tex', W, H)
  const g = ctxOf(tex)
  g.fillStyle = RACE.boostPad
  g.fillRect(0, 0, W, H)
  g.strokeStyle = RACE.boostArrow
  g.lineWidth = 9
  g.lineCap = 'round'
  g.lineJoin = 'round'
  for (let i = 0; i < 3; i++) {
    const y = 22 + i * 42
    g.beginPath()
    g.moveTo(12, y + 16)
    g.lineTo(W / 2, y)
    g.lineTo(W - 12, y + 16)
    g.stroke()
  }
  tex.update()
  tex.wrapU = Texture.CLAMP_ADDRESSMODE
  tex.wrapV = Texture.WRAP_ADDRESSMODE
  return tex
}

/** 拱門橫幅 1024×96：奶油底、兩端黑白格、中間 A TOY RACER */
export function createBannerTexture(scene: Scene): DynamicTexture {
  const W = 1024
  const H = 96
  const tex = dyn(scene, 'race-banner-tex', W, H)
  const draw = (): void => {
    const g = ctxOf(tex)
    g.fillStyle = RACE.banner
    g.fillRect(0, 0, W, H)
    for (const x0 of [0, W - 96]) {
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          g.fillStyle = (i + j) % 2 === 0 ? '#FFFFFF' : OUTLINE
          g.fillRect(x0 + i * 24, j * 24, 24, 24)
        }
      }
    }
    g.font = '700 70px Fredoka, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillStyle = OUTLINE
    g.fillText('A TOY RACER', W / 2, H / 2 + 4)
    tex.update()
  }
  whenFontReady('700 70px Fredoka', tex, draw)
  return tex
}

/** 「你」標記 128×96：上 64px 玩家色膠囊白字、下 32px 倒三角（指向安全帽） */
export function createYouTexture(scene: Scene, bg: string): DynamicTexture {
  const W = 128
  const H = 96
  const tex = dyn(scene, 'race-you-tex', W, H, true)
  const draw = (): void => {
    const g: Ctx = ctxOf(tex)
    g.clearRect(0, 0, W, H)
    g.lineWidth = 5
    g.strokeStyle = OUTLINE
    g.fillStyle = bg
    g.beginPath()
    g.moveTo(W / 2 - 16, 58)
    g.lineTo(W / 2 + 16, 58)
    g.lineTo(W / 2, 90)
    g.closePath()
    g.fill()
    g.stroke()
    roundRect(g, 4, 4, W - 8, 56, 28)
    g.fill()
    g.stroke()
    g.font = '900 38px Fredoka, "Noto Sans TC", sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.lineWidth = 6
    g.strokeText('你', W / 2, 34)
    g.fillStyle = '#FFFFFF'
    g.fillText('你', W / 2, 34)
    tex.update()
  }
  whenFontReady('900 38px Fredoka', tex, draw)
  return tex
}

/** blob 影 64²：深紫徑向漸層 30% → 0 */
export function createBlobTexture(scene: Scene): DynamicTexture {
  const S = 64
  const tex = dyn(scene, 'race-blob-tex', S, S, true)
  const g = ctxOf(tex)
  g.clearRect(0, 0, S, S)
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  gr.addColorStop(0, 'rgba(43,36,64,0.42)')
  gr.addColorStop(0.6, 'rgba(43,36,64,0.28)')
  gr.addColorStop(1, 'rgba(43,36,64,0)')
  g.fillStyle = gr
  g.fillRect(0, 0, S, S)
  tex.update()
  return tex
}
