// 接觸圖：批次裁切多個素材區域，拼成一張帶標籤的網格圖（批次驗證座標用）
// 用法: node contact_sheet.cjs <spec.json> <out.png>
//   spec: [{n:'名稱', b:0|1|2, x, y, w, h}, ...]（一張建議 ≤12 筆，輸出寬 600px 內 Read 才不會被縮圖）
// 環境變數 PW_CORE / PW_CHROME 同 crop_tile.cjs。
const fs = require('fs')
const path = require('path')

const PW_CORE =
  process.env.PW_CORE ||
  '/home/bal/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core'
const PW_CHROME =
  process.env.PW_CHROME ||
  process.env.HOME + '/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome'
const { chromium } = require(PW_CORE)

const ROOT = path.resolve(__dirname, '../../../..')
const SHEETS = {
  0: 'src/assets/images/map-editor/man.png',
  1: 'src/assets/images/map-editor/rpg_maker_xp.png',
  2: 'src/assets/images/map-editor/rpg_maker_xp2.png',
}
const CELL = 200, LABEL = 30, COLS = 3

const [specFile, out] = process.argv.slice(2)
const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'))

;(async () => {
  const browser = await chromium.launch({ executablePath: PW_CHROME })
  const page = await browser.newPage({ viewport: { width: 1200, height: 1600 } })
  await page.setContent('<canvas id="c"></canvas>')
  const imgs = {}
  for (const b of [...new Set(spec.map(s => s.b))]) {
    imgs[b] = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, SHEETS[b])).toString('base64')
  }
  await page.evaluate(async ({ spec, imgs, CELL, LABEL, COLS }) => {
    const loaded = {}
    for (const [b, url] of Object.entries(imgs)) {
      const im = new Image()
      await new Promise((res, rej) => { im.onload = res; im.onerror = rej; im.src = url })
      loaded[b] = im
    }
    const rows = Math.ceil(spec.length / COLS)
    const c = document.getElementById('c')
    c.width = COLS * CELL
    c.height = rows * (CELL + LABEL)
    const ctx = c.getContext('2d')
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = '#3a6ea5'; ctx.fillRect(0, 0, c.width, c.height)
    spec.forEach((s, i) => {
      const cx = (i % COLS) * CELL
      const cy = Math.floor(i / COLS) * (CELL + LABEL)
      ctx.fillStyle = '#222'; ctx.fillRect(cx, cy, CELL, LABEL)
      ctx.fillStyle = '#ff0'; ctx.font = 'bold 12px monospace'
      ctx.fillText(`${i}:${s.n} b${s.b}(${s.x},${s.y},${s.w},${s.h})`, cx + 3, cy + 13)
      const sc = Math.min((CELL - 8) / s.w, (CELL - 8) / s.h, 3)
      ctx.strokeStyle = '#fff'
      ctx.strokeRect(cx + 4 - 0.5, cy + LABEL + 4 - 0.5, s.w * sc + 1, s.h * sc + 1)
      ctx.drawImage(loaded[s.b], s.x, s.y, s.w, s.h, cx + 4, cy + LABEL + 4, s.w * sc, s.h * sc)
    })
  }, { spec, imgs, CELL, LABEL, COLS })
  const el = await page.$('#c')
  await el.screenshot({ path: out })
  await browser.close()
  console.log('ok', spec.length, 'tiles ->', out)
})()
