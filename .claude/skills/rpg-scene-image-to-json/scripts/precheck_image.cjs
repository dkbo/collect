// 場景圖防呆前檢（第 1~2 層：檔案 / 格式 / 尺寸）
// 用法: node precheck_image.cjs <場景圖路徑>
//   通過 → exit 0，輸出尺寸與 32px 網格換算建議
//   不過 → exit 1，輸出「❌ 防呆拒絕：<層級> — <原因> — <建議>」
// 第 3~4 層（內容判讀 / 素材對應）由 Claude Read 圖執行，見 SKILL.md。
const fs = require('fs')
const path = require('path')

const MIN_SIDE = 320 // 低於 10 格 (320px) 的場景圖資訊量不足
const MAX_SIDE = 8192 // 超過視為非場景圖（海報級原圖請先縮圖）
const MAX_ASPECT = 3 // 長寬比超過 3:1 視為橫幅/條圖，非俯視場景
const TILE = 32

const reject = (layer, reason, hint) => {
  console.error(`❌ 防呆拒絕：${layer} — ${reason} — ${hint}`)
  process.exit(1)
}

const file = process.argv[2]
if (!file) reject('用法', '未提供場景圖路徑', 'node precheck_image.cjs <image>')

// ── 第 1 層：檔案 ──────────────────────────────────────────────
if (!fs.existsSync(file)) reject('檔案層', `路徑不存在：${file}`, '確認路徑或改用絕對路徑')
const stat = fs.statSync(file)
if (!stat.isFile()) reject('檔案層', `不是檔案：${file}`, '請提供 PNG/JPG/WebP 圖檔')
if (stat.size === 0) reject('檔案層', '檔案是空的', '重新輸出場景圖')

const buf = fs.readFileSync(file)

// ── 第 1 層：格式（magic bytes，不信任副檔名）───────────────────
function sniff(b) {
  if (b.length >= 8 && b.readUInt32BE(0) === 0x89504e47) return 'png'
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg'
  if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'webp'
  if (b.length >= 4 && b.toString('ascii', 0, 4) === 'GIF8') return 'gif'
  if (b.length >= 4 && b.toString('ascii', 0, 4) === '%PDF') return 'pdf'
  if (b.length >= 2 && b.toString('ascii', 0, 2) === 'BM') return 'bmp'
  const head = b.toString('utf8', 0, Math.min(512, b.length)).trimStart().toLowerCase()
  if (head.startsWith('<?xml') || head.startsWith('<svg')) return 'svg'
  return 'unknown'
}
const fmt = sniff(buf)
if (!['png', 'jpg', 'webp'].includes(fmt)) {
  reject(
    '檔案層',
    `不支援的格式：${fmt}（僅接受 PNG/JPG/WebP 點陣圖）`,
    fmt === 'svg' || fmt === 'pdf' ? '請先轉存為 PNG 點陣圖' : '請提供場景的 PNG/JPG/WebP 截圖或繪製稿'
  )
}

// ── 尺寸解析（純標頭解析，零依賴）──────────────────────────────
function pngSize(b) {
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
}
function jpgSize(b) {
  let i = 2
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue }
    const marker = b[i + 1]
    // SOF0~SOF15（排除 DHT/DAC/RST）皆帶尺寸
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) }
    }
    i += 2 + b.readUInt16BE(i + 2)
  }
  return null
}
function webpSize(b) {
  const tag = b.toString('ascii', 12, 16)
  if (tag === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff }
  if (tag === 'VP8L') {
    const n = b.readUInt32LE(21)
    return { w: (n & 0x3fff) + 1, h: ((n >> 14) & 0x3fff) + 1 }
  }
  if (tag === 'VP8X') {
    return { w: (b.readUIntLE(24, 3) + 1), h: (b.readUIntLE(27, 3) + 1) }
  }
  return null
}
const size = fmt === 'png' ? pngSize(buf) : fmt === 'jpg' ? jpgSize(buf) : webpSize(buf)
if (!size || !size.w || !size.h) reject('檔案層', '無法解析圖片尺寸（檔案可能損毀）', '重新輸出場景圖')

// ── 第 2 層：尺寸 ──────────────────────────────────────────────
const { w, h } = size
if (w < MIN_SIDE || h < MIN_SIDE) {
  reject('尺寸層', `圖片過小 ${w}×${h}（最小 ${MIN_SIDE}×${MIN_SIDE}）`, '提供更高解析度的場景圖')
}
if (w > MAX_SIDE || h > MAX_SIDE) {
  reject('尺寸層', `圖片過大 ${w}×${h}（最大 ${MAX_SIDE}）`, '先等比縮圖到 8192px 內')
}
const aspect = Math.max(w / h, h / w)
if (aspect > MAX_ASPECT) {
  reject('尺寸層', `長寬比 ${aspect.toFixed(2)}:1 過於極端（上限 ${MAX_ASPECT}:1）`, '俯視 RPG 場景應接近常見地圖比例（如 3:2）')
}

// ── 通過：輸出網格換算建議 ─────────────────────────────────────
// 目標地圖尺寸 = 最接近的 32 倍數（四捨五入、至少 10 格）
const snap = (v) => Math.max(TILE * 10, Math.round(v / TILE) * TILE)
const mapW = snap(w)
const mapH = snap(h)
const exact = mapW === w && mapH === h

console.log('✅ 防呆前檢通過（第 1~2 層）')
console.log(`  檔案: ${path.resolve(file)}`)
console.log(`  格式: ${fmt}  尺寸: ${w}×${h}`)
if (exact) {
  console.log(`  網格: 已是 32 倍數，地圖尺寸建議 ${mapW}×${mapH}（${mapW / TILE}×${mapH / TILE} 格）`)
} else {
  console.log(`  網格: 非 32 倍數，建議換算地圖尺寸 ${mapW}×${mapH}（${mapW / TILE}×${mapH / TILE} 格）`)
  console.log(`  換算比例: x=${(mapW / w).toFixed(4)}  y=${(mapH / h).toFixed(4)}（圖片座標 × 比例 → 地圖座標，再對齊 32）`)
}
console.log('  ➜ 續行第 3 層：Read 圖判讀內容（必須為 2D 正俯視 RPG 場景）')
console.log('  ➜ 續行第 4 層：node precheck_tiles.cjs <場景圖>（逐格比對圖庫素材）')
