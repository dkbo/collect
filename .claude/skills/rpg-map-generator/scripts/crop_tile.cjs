// 精確裁切圖庫素材並 4x 放大（驗證 tile-catalog 座標用）
// 用法: node crop_tile.cjs <b> <x> <y> <w> <h> <out.png>
//   b: 0=man.png 1=rpg_maker_xp.png 2=rpg_maker_xp2.png
// 藍底凸顯透明區；輸出後用 Read 看圖確認物件完整、無鄰格雜物。
// 需要 chromium：預設用 playwright-core 快取，可用環境變數覆寫
//   PW_CORE=playwright-core 模組路徑  PW_CHROME=chrome 執行檔路徑
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

const [bA, xA, yA, wA, hA, out] = process.argv.slice(2)
const B = +bA, X = +xA, Y = +yA, W = +wA, H = +hA, S = 4
if (!SHEETS[B] || !out) {
  console.error('用法: node crop_tile.cjs <b:0|1|2> <x> <y> <w> <h> <out.png>')
  process.exit(1)
}

;(async () => {
  const browser = await chromium.launch({ executablePath: PW_CHROME })
  const page = await browser.newPage()
  await page.setContent('<canvas id="c"></canvas>')
  const b64 = fs.readFileSync(path.join(ROOT, SHEETS[B])).toString('base64')
  await page.evaluate(async ({ dataUrl, X, Y, W, H, S }) => {
    const img = new Image()
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl })
    const c = document.getElementById('c')
    c.width = W * S; c.height = H * S
    const ctx = c.getContext('2d')
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = '#3a6ea5'; ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(img, X, Y, W, H, 0, 0, W * S, H * S)
  }, { dataUrl: 'data:image/png;base64,' + b64, X, Y, W, H, S })
  const el = await page.$('#c')
  await el.screenshot({ path: out })
  await browser.close()
  console.log(`ok b${B}(${X},${Y},${W},${H}) -> ${out}`)
})()
