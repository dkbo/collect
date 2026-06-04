// 素材對應防呆（第 4 層自動化）+ 轉錄/比對工具
// 用法:
//   node precheck_tiles.cjs <場景圖> [通過比例=0.65] [--emit-grid <out.json>]
//     把場景圖對齊 32px 網格後逐格與圖庫（man/xp/xp2/bg.jpg）模糊比對：
//     匹配格數比例 >= 通過比例 → exit 0；否則 ❌ 防呆拒絕 exit 1。
//     圖庫素材帶透明 → 只比對不透明區（家具疊地板的合成格也能匹配）。
//     --emit-grid：輸出逐格匹配明細 JSON（每格匹配到的圖庫 b/x/y），
//     供 grid_to_styles.cjs 轉成 styles 草稿。
//   node precheck_tiles.cjs <場景圖> --compare <渲染圖> [通過比例=0.85]
//     原場景圖 vs render_map.cjs 渲染圖「同座標逐格」比對（場景圖縮放到渲染圖尺寸），
//     輸出匹配率與差異格清單；低於門檻 exit 1。image-to-json 的量化終驗。
// 需要 chromium：同 crop_tile.cjs，可用 PW_CORE / PW_CHROME 環境變數覆寫。
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
const SHEETS = [
  'src/assets/images/map-editor/man.png',
  'src/assets/images/map-editor/rpg_maker_xp.png',
  'src/assets/images/map-editor/rpg_maker_xp2.png',
  'src/assets/images/map-editor/bg.jpg',
]
const TILE = 32
const DIFF_TH = 18 // 單格匹配容差（0~255 平均色差，吸收 JPEG/縮放雜訊）

const reject = (reason, hint) => {
  console.error(`❌ 防呆拒絕：素材層 — ${reason} — ${hint}`)
  process.exit(1)
}

// ── 參數解析 ──
const argv = process.argv.slice(2)
const takeFlag = (name) => {
  const i = argv.indexOf(name)
  if (i === -1) return null
  const v = argv[i + 1]
  if (!v || v.startsWith('--')) reject(`${name} 缺少參數值`, `${name} <路徑>`)
  argv.splice(i, 2)
  return v
}
const emitGrid = takeFlag('--emit-grid')
const compareFile = takeFlag('--compare')
const [file, ratioArg] = argv
const PASS_RATIO = Math.min(1, Math.max(0, parseFloat(ratioArg || (compareFile ? '0.85' : '0.65'))))

if (!file || !fs.existsSync(file)) {
  reject(`場景圖不存在：${file || '(未提供)'}`, '先通過 precheck_image.cjs 再執行本檢查')
}
if (compareFile && !fs.existsSync(compareFile)) {
  reject(`渲染圖不存在：${compareFile}`, '先用 render_map.cjs 產出渲染圖')
}

const mime = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }
const dataUrl = (p) => {
  const ext = p.endsWith('.jpg') || p.endsWith('.jpeg') ? 'jpg' : p.endsWith('.webp') ? 'webp' : 'png'
  return `data:${mime[ext]};base64,` + fs.readFileSync(p).toString('base64')
}

;(async () => {
  const browser = await chromium.launch({ executablePath: PW_CHROME })
  const page = await browser.newPage()
  await page.setContent('<canvas id="c"></canvas>')

  const result = await page.evaluate(
    async ({ scene, sheets, compare, wantGrid, TILE, DIFF_TH }) => {
      const load = (src) =>
        new Promise((res, rej) => {
          const img = new Image()
          img.onload = () => res(img)
          img.onerror = rej
          img.src = src
        })

      const imageData = (img, w, h, dw, dh) => {
        const c = document.createElement('canvas')
        c.width = dw
        c.height = dh
        const ctx = c.getContext('2d', { willReadFrequently: true })
        ctx.imageSmoothingEnabled = dw !== w || dh !== h
        ctx.drawImage(img, 0, 0, w, h, 0, 0, dw, dh)
        return ctx.getImageData(0, 0, dw, dh).data
      }

      const CELLS = 16 // 每 32px 格降採樣為 16×16 cell（每 cell = 2×2px 平均）
      // 解析度不可再低：4×4px 平均會把雜訊/異風格圖抹成均色而誤判匹配
      const SUB = TILE / CELLS
      const NC = CELLS * CELLS
      // 取 (px,py) 起 32×32 格的簽名：每 cell 不透明像素的 RGB 平均 + 不透明覆蓋率
      const tileSig = (data, W, px, py) => {
        const rgb = new Float32Array(NC * 3)
        const op = new Uint8Array(NC)
        let opaqueCells = 0
        const avg = [0, 0, 0]
        for (let cy = 0; cy < CELLS; cy++)
          for (let cx = 0; cx < CELLS; cx++) {
            let r = 0, g = 0, b = 0, n = 0, tot = 0
            for (let dy = 0; dy < SUB; dy++)
              for (let dx = 0; dx < SUB; dx++) {
                const i = ((py + cy * SUB + dy) * W + px + cx * SUB + dx) * 4
                tot++
                if (data[i + 3] > 127) {
                  r += data[i]; g += data[i + 1]; b += data[i + 2]; n++
                }
              }
            const ci = cy * CELLS + cx
            if (n / tot > 0.5) {
              op[ci] = 1
              opaqueCells++
              rgb[ci * 3] = r / n; rgb[ci * 3 + 1] = g / n; rgb[ci * 3 + 2] = b / n
              avg[0] += r / n; avg[1] += g / n; avg[2] += b / n
            }
          }
        if (opaqueCells) { avg[0] /= opaqueCells; avg[1] /= opaqueCells; avg[2] /= opaqueCells }
        // 紋理量：各 cell 與整格平均色的偏差均值（像素拼圖必有紋理，純色塊≈0）
        let tex = 0
        for (let ci = 0; ci < NC; ci++) {
          if (!op[ci]) continue
          tex +=
            Math.abs(rgb[ci * 3] - avg[0]) +
            Math.abs(rgb[ci * 3 + 1] - avg[1]) +
            Math.abs(rgb[ci * 3 + 2] - avg[2])
        }
        tex = opaqueCells ? tex / (3 * opaqueCells) : 0
        return { rgb, op, opaqueCells, avg, tex }
      }

      const sigDiff = (a, b) => {
        // 以 a 的不透明區為準的平均色差（a 應為全不透明的場景/渲染格）
        let d = 0
        let n = 0
        for (let ci = 0; ci < NC; ci++) {
          if (!a.op[ci] || !b.op[ci]) continue
          n++
          d +=
            Math.abs(a.rgb[ci * 3] - b.rgb[ci * 3]) +
            Math.abs(a.rgb[ci * 3 + 1] - b.rgb[ci * 3 + 1]) +
            Math.abs(a.rgb[ci * 3 + 2] - b.rgb[ci * 3 + 2])
        }
        return n ? d / (3 * n) : 255
      }

      // ════ 模式 B：原圖 vs 渲染圖 同座標逐格比對 ════
      if (compare) {
        const [sceneImg, renderImg] = await Promise.all([load(scene), load(compare)])
        const mapW = renderImg.naturalWidth
        const mapH = renderImg.naturalHeight
        // 場景圖縮放到渲染圖（= 地圖實際）尺寸後逐格比
        const sceneData = imageData(sceneImg, sceneImg.naturalWidth, sceneImg.naturalHeight, mapW, mapH)
        const renderData = imageData(renderImg, renderImg.naturalWidth, renderImg.naturalHeight, mapW, mapH)
        let matched = 0
        let total = 0
        const mismatched = []
        for (let py = 0; py + TILE <= mapH; py += TILE)
          for (let px = 0; px + TILE <= mapW; px += TILE) {
            total++
            const d = sigDiff(tileSig(sceneData, mapW, px, py), tileSig(renderData, mapW, px, py))
            if (d <= DIFF_TH) matched++
            else if (mismatched.length < 60) mismatched.push({ l: px, t: py, diff: Math.round(d) })
          }
        return { mode: 'compare', mapW, mapH, total, matched, mismatched }
      }

      // ════ 模式 A：場景圖 vs 圖庫（gate + 可選 emit-grid）════
      const [sceneImg, ...sheetImgs] = await Promise.all([load(scene), ...sheets.map(load)])

      // ── 建立圖庫簽名（跳過幾乎全透明的格；記錄來源 b/x/y 供轉錄）──
      const lib = []
      sheetImgs.forEach((img, b) => {
        const W = Math.floor(img.naturalWidth / TILE) * TILE
        const H = Math.floor(img.naturalHeight / TILE) * TILE
        if (!W || !H) return
        const data = imageData(img, img.naturalWidth, img.naturalHeight, img.naturalWidth, img.naturalHeight)
        for (let py = 0; py + TILE <= H; py += TILE)
          for (let px = 0; px + TILE <= W; px += TILE) {
            const s = tileSig(data, img.naturalWidth, px, py)
            if (s.opaqueCells >= NC / 4) lib.push({ ...s, b, x: px, y: py }) // 至少 1/4 不透明才有判別力
          }
      })
      // 全不透明素材優先測試 → 合成格（家具疊地板）優先匹配到完整格而非透明家具
      lib.sort((a, b) => b.opaqueCells - a.opaqueCells)

      // ── 場景圖：對齊到最接近的 32 倍數網格後切格 ──
      const snap = (v) => Math.max(TILE * 10, Math.round(v / TILE) * TILE)
      const mapW = snap(sceneImg.naturalWidth)
      const mapH = snap(sceneImg.naturalHeight)
      const sceneData = imageData(sceneImg, sceneImg.naturalWidth, sceneImg.naturalHeight, mapW, mapH)

      const TEX_TH = 8 // 紋理門檻：低於此視為平坦格（純色/漸層）
      const unmatched = []
      const cells = wantGrid ? [] : null
      let matched = 0
      let total = 0
      let textured = 0
      let texturedMatched = 0
      for (let py = 0; py < mapH; py += TILE)
        for (let px = 0; px < mapW; px += TILE) {
          total++
          const s = tileSig(sceneData, mapW, px, py)
          const isTex = s.tex >= TEX_TH
          if (isTex) textured++
          let best = Infinity
          let hit = null
          for (const t of lib) {
            // 粗篩：全不透明素材先比整格平均色
            if (t.opaqueCells === NC) {
              const da =
                Math.abs(t.avg[0] - s.avg[0]) +
                Math.abs(t.avg[1] - s.avg[1]) +
                Math.abs(t.avg[2] - s.avg[2])
              if (da / 3 > DIFF_TH + 30) continue
            }
            const limit = DIFF_TH * 3 * t.opaqueCells
            let d = 0
            for (let ci = 0; ci < NC && d <= limit; ci++) {
              if (!t.op[ci]) continue
              d +=
                Math.abs(t.rgb[ci * 3] - s.rgb[ci * 3]) +
                Math.abs(t.rgb[ci * 3 + 1] - s.rgb[ci * 3 + 1]) +
                Math.abs(t.rgb[ci * 3 + 2] - s.rgb[ci * 3 + 2])
            }
            const mean = d / (3 * t.opaqueCells)
            if (mean < best) best = mean
            if (mean <= DIFF_TH) { hit = t; break }
          }
          if (hit) {
            matched++
            if (isTex) texturedMatched++
          } else if (isTex && unmatched.length < 40) {
            unmatched.push({ l: px, t: py, diff: Math.round(best) })
          }
          if (cells)
            cells.push(hit
              ? { l: px, t: py, b: hit.b, x: hit.x, y: hit.y }
              : { l: px, t: py, b: null, tex: isTex })
        }

      return { mode: 'gate', mapW, mapH, total, matched, textured, texturedMatched, libTiles: lib.length, unmatched, cells }
    },
    {
      scene: dataUrl(file),
      sheets: SHEETS.map((p) => dataUrl(path.join(ROOT, p))),
      compare: compareFile ? dataUrl(compareFile) : null,
      wantGrid: !!emitGrid,
      TILE,
      DIFF_TH,
    }
  )
  await browser.close()

  // ════ 模式 B 輸出 ════
  if (result.mode === 'compare') {
    const ratio = result.matched / result.total
    console.log(
      `渲染比對：${result.matched}/${result.total} 格一致（${(ratio * 100).toFixed(1)}%），` +
        `網格 ${result.mapW}×${result.mapH}，門檻 ${PASS_RATIO * 100}%`
    )
    if (result.mismatched.length) {
      console.log(`  差異格（前 ${result.mismatched.length}）：`)
      console.log('  ' + result.mismatched.map((u) => `(${u.l},${u.t})Δ${u.diff}`).join(' '))
    }
    if (ratio >= PASS_RATIO) {
      console.log('✅ 渲染比對通過')
    } else {
      console.error(`❌ 渲染比對未達門檻（${(ratio * 100).toFixed(1)}% < ${PASS_RATIO * 100}%）— 依差異格座標逐格修正地圖 JSON 後重渲染再比`)
      process.exit(1)
    }
    return
  }

  // ════ 模式 A 輸出 ════
  if (emitGrid) {
    fs.writeFileSync(
      emitGrid,
      JSON.stringify({ mapW: result.mapW, mapH: result.mapH, tile: TILE, sheets: SHEETS, cells: result.cells })
    )
    console.log(`匹配明細 -> ${emitGrid}（${result.cells.length} 格，給 grid_to_styles.cjs 轉 styles 草稿）`)
  }

  // 平坦格（純色/漸層）匹配均色素材沒有判別力 → 只看紋理格：
  // 1) 紋理格佔比 >= 35%（像素拼圖場景必有大量紋理；純色塊 mockup 過不了）
  // 2) 紋理格匹配率 >= PASS_RATIO
  const TEX_RATIO_MIN = 0.35
  const texRatio = result.textured / result.total
  const texMatchRatio = result.textured ? result.texturedMatched / result.textured : 0
  console.log(
    `素材比對：全部 ${result.matched}/${result.total} 格匹配；` +
      `紋理格 ${result.textured}/${result.total}（${(texRatio * 100).toFixed(1)}%），` +
      `其中匹配 ${result.texturedMatched}/${result.textured}（${(texMatchRatio * 100).toFixed(1)}%）；` +
      `圖庫簽名 ${result.libTiles} 格，網格 ${result.mapW}×${result.mapH}`
  )
  if (texRatio < TEX_RATIO_MIN) {
    reject(
      `紋理格僅佔 ${(texRatio * 100).toFixed(1)}%（門檻 ${TEX_RATIO_MIN * 100}%），場景缺少像素拼圖紋理`,
      '純色塊/漸層 mockup 無法直接轉換；請改用遊戲截圖或以圖庫素材拼製的場景圖'
    )
  }
  if (texMatchRatio >= PASS_RATIO) {
    console.log(`✅ 素材層通過（紋理格匹配門檻 ${PASS_RATIO * 100}%）`)
    if (result.unmatched.length) {
      console.log(`  未匹配紋理格（前 ${result.unmatched.length}，多為 NPC/疊層/雜訊）：`)
      console.log('  ' + result.unmatched.map((u) => `(${u.l},${u.t})Δ${u.diff}`).join(' '))
    }
  } else {
    console.error(`未匹配紋理格（前 ${result.unmatched.length}）：` + result.unmatched.map((u) => `(${u.l},${u.t})Δ${u.diff}`).join(' '))
    reject(
      `紋理格僅 ${(texMatchRatio * 100).toFixed(1)}% 能對應圖庫素材（門檻 ${PASS_RATIO * 100}%）`,
      '場景圖必須由本專案圖庫（man/rpg_maker_xp/rpg_maker_xp2/bg）素材構成；請改用遊戲截圖或以圖庫素材拼製的場景圖'
    )
  }
})().catch((e) => {
  reject(`比對執行失敗：${e.message}`, '確認 chromium 可用（PW_CORE / PW_CHROME）後重試')
})
