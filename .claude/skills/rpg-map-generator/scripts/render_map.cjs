// 地圖 JSON 離線渲染器：不開 dev server 即可預覽地圖實際渲染結果
// 用法: node render_map.cjs <map.json> <out.png> [--layers bg,npc,fg,collision,portal,event,in,area] [--grid]
//   預設 --layers bg,npc,fg（= 遊戲畫面）；--debug = 全部層 + 格線
//   debug overlay：collision=紅框 portal=藍框 event=黃框 in=綠點 area=紫框(NPC 活動範圍)
//   繪製順序與 RpgRoom/index.tsx 一致：bg.jpg 平鋪 → styles(z!=2) → NPC(Y-sort) → styles(z=2) → overlay
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
]
const BG_TILE = 'src/assets/images/map-editor/bg.jpg'

const args = process.argv.slice(2)
const flags = args.filter((a) => a.startsWith('--'))
const [mapFile, out] = args.filter((a) => !a.startsWith('--'))
const DEBUG = flags.includes('--debug')
const GRID = DEBUG || flags.includes('--grid')
const layersArg = (flags.find((a) => a.startsWith('--layers')) || '').split('=')[1]
const LAYERS = DEBUG
  ? ['bg', 'npc', 'fg', 'collision', 'portal', 'event', 'in', 'area']
  : layersArg
    ? layersArg.split(',')
    : ['bg', 'npc', 'fg']

if (!mapFile || !out) {
  console.error('用法: node render_map.cjs <map.json> <out.png> [--layers=bg,npc,fg,collision,portal,event,in,area] [--debug] [--grid]')
  process.exit(1)
}
if (!fs.existsSync(mapFile)) {
  console.error(`地圖檔不存在：${mapFile}`)
  process.exit(1)
}
let mapJson
try {
  mapJson = JSON.parse(fs.readFileSync(mapFile, 'utf8'))
} catch (e) {
  console.error(`JSON 解析失敗：${e.message}`)
  process.exit(1)
}
if (!mapJson.map || !mapJson.map.width || !mapJson.map.height) {
  console.error('map 區塊缺少 width/height，無法渲染')
  process.exit(1)
}

const mime = { png: 'image/png', jpg: 'image/jpeg' }
const dataUrl = (p) => {
  const ext = p.endsWith('.jpg') ? 'jpg' : 'png'
  return `data:${mime[ext]};base64,` + fs.readFileSync(p).toString('base64')
}

;(async () => {
  const browser = await chromium.launch({ executablePath: PW_CHROME })
  const page = await browser.newPage()
  await page.setContent('<canvas id="c"></canvas>')

  const stats = await page.evaluate(
    async ({ mapJson, sheets, bgTile, layers, grid }) => {
      const load = (src) =>
        new Promise((res, rej) => {
          const img = new Image()
          img.onload = () => res(img)
          img.onerror = rej
          img.src = src
        })
      const [bgImg, ...sheetImgs] = await Promise.all([load(bgTile), ...sheets.map(load)])
      const has = (l) => layers.includes(l)

      const W = mapJson.map.width
      const H = mapJson.map.height
      const c = document.getElementById('c')
      c.width = W
      c.height = H
      const ctx = c.getContext('2d')
      ctx.imageSmoothingEnabled = false

      const styles = mapJson.styles || []
      const isMove = mapJson.isMove || []
      const npcs = mapJson.npc || []
      const messages = mapJson.messages || []

      const drawStyles = (wantFg) => {
        for (const t of styles) {
          if ((t.z === 2) !== wantFg) continue
          const sheet = sheetImgs[t.b]
          if (!sheet) continue
          const rx = t.rx ?? 1
          const ry = t.ry ?? 1
          for (let ix = 0; ix < rx; ix++)
            for (let iy = 0; iy < ry; iy++)
              ctx.drawImage(sheet, t.x, t.y, t.w, t.h, t.l + ix * t.w, t.t + iy * t.h, t.w, t.h)
        }
      }

      // 1. 草地底圖平鋪
      if (has('bg')) {
        for (let x = 0; x < W; x += 32)
          for (let y = 0; y < H; y += 32) ctx.drawImage(bgImg, 0, 0, 32, 32, x, y, 32, 32)
        // 2. 背景層 styles（陣列順序）
        drawStyles(false)
      }

      // 3. NPC（messages[e] 不存在的不繪製；Y-sort 同遊戲）
      let npcDrawn = 0
      if (has('npc')) {
        const renderable = npcs
          .filter((n) => messages[n.e])
          .sort((a, b) => a.pY + (a.h || 48) - (b.pY + (b.h || 48)))
        for (const n of renderable) {
          const sheet = sheetImgs[n.b]
          if (!sheet) continue
          const dirOffset = n.d === 1 ? 48 : n.d === 2 ? 96 : n.d === 3 ? 144 : 0
          const nW = n.w || 32
          const nH = n.h || 48
          ctx.drawImage(sheet, n.x ?? 0, (n.y ?? 0) + dirOffset, nW, nH, n.pX, n.pY, nW, nH)
          npcDrawn++
        }
      }

      // 4. 前景層 styles（z=2，蓋在角色上）
      if (has('fg')) drawStyles(true)

      // 5. debug overlays
      ctx.font = '10px monospace'
      ctx.textBaseline = 'top'
      const box = (r, stroke, fill, label) => {
        ctx.fillStyle = fill
        ctx.fillRect(r.x, r.y, r.w, r.h)
        ctx.strokeStyle = stroke
        ctx.lineWidth = 1
        ctx.strokeRect(r.x + 0.5, r.y + 0.5, Math.max(r.w - 1, 1), Math.max(r.h - 1, 1))
        if (label) {
          ctx.fillStyle = stroke
          ctx.fillText(label, r.x + 2, r.y + 2)
        }
      }
      let counts = { collision: 0, portal: 0, event: 0 }
      isMove.forEach((m, i) => {
        const isPortal = m.cm !== undefined || m.cmm !== undefined
        const isEvent = m.e !== undefined
        if (isPortal && has('portal')) {
          box(m, '#00bfff', 'rgba(0,191,255,.25)', `P${i}→${m.cm}/${m.cmm}`)
          counts.portal++
        } else if (isEvent && !isPortal && has('event')) {
          box(m, '#ffd700', 'rgba(255,215,0,.3)', `E${i} e=${m.e}`)
          counts.event++
        } else if (!isPortal && !isEvent && has('collision')) {
          box(m, '#ff3030', 'rgba(255,48,48,.25)', m.h >= 12 ? `C${i}` : '')
          counts.collision++
        }
      })
      if (has('area'))
        npcs.forEach((n, i) => {
          if (n.type === 4 && n.aW)
            box({ x: n.aX, y: n.aY, w: n.aW, h: n.aH }, '#c060ff', 'rgba(192,96,255,.12)', `A${i}`)
        })
      if (has('in'))
        (mapJson.map.in || []).forEach((p, i) => {
          box({ x: p.x, y: p.y, w: 32, h: 48 }, '#00e000', 'rgba(0,224,0,.3)', `in${i}`)
        })
      if (grid) {
        ctx.strokeStyle = 'rgba(255,255,255,.15)'
        ctx.lineWidth = 1
        for (let x = 0; x <= W; x += 32) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke() }
        for (let y = 0; y <= H; y += 32) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke() }
      }

      return {
        W, H,
        styles: styles.length,
        fgStyles: styles.filter((t) => t.z === 2).length,
        npcTotal: npcs.length,
        npcDrawn,
        ...counts,
        inPoints: (mapJson.map.in || []).length,
      }
    },
    {
      mapJson,
      sheets: SHEETS.map((p) => dataUrl(path.join(ROOT, p))),
      bgTile: dataUrl(path.join(ROOT, BG_TILE)),
      layers: LAYERS,
      grid: GRID,
    }
  )

  const el = await page.$('#c')
  await el.screenshot({ path: out })
  await browser.close()
  console.log(
    `ok ${stats.W}×${stats.H} -> ${out}\n` +
      `  styles ${stats.styles}（前景 ${stats.fgStyles}）｜NPC 繪出 ${stats.npcDrawn}/${stats.npcTotal}` +
      (stats.npcDrawn < stats.npcTotal ? '（有 NPC 缺 messages[e] 未繪製！）' : '') +
      `\n  碰撞 ${stats.collision}｜傳送 ${stats.portal}｜事件 ${stats.event}｜出生點 ${stats.inPoints}（debug 層才顯示框）`
  )
})().catch((e) => {
  console.error(`渲染失敗：${e.message}`)
  process.exit(1)
})
