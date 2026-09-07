#!/usr/bin/env node
// 本專案的瀏覽器驗證腳本：開頁、等載入、截圖、收 console 錯誤與 Godot bridge postMessage、可跑 eval。
// 不依賴 Playwright MCP（本機沒有 /opt/google/chrome/chrome），直接用 npx 快取的 playwright 模組 + ms-playwright 的 chromium。
//
// 用法：
//   node .claude/skills/verify-web/scripts/shot.mjs --url 'http://localhost:5173/collect/#/godot-game' --out "$S/godot" \
//        [--wait 3000] [--wait-for 'css selector'] [--width 1280 --height 800] [--full] \
//        [--messages godot-rpg] [--eval 'document.title'] [--contexts 2] [--dns] [--dark]
//
//   --contexts N   開 N 個彼此獨立的 browser context（各自 IndexedDB / Firebase 匿名 uid），/battle 多人驗證用。
//                  截圖為 <out>-1.png、<out>-2.png…；N=1 時就是 <out>.png。
//   --messages S   收 window 'message' 事件中 data.source === S 的訊息（godot-rpg / godot-candy）。
//   --dns          WSL 瀏覽器內 DNS 壞：先用 node 解析 Firebase 幾個 host，以 --host-resolver-rules 注入 chromium。
//   --eval JS      每個 context 載入完後在頁面跑一段 JS，結果進 summary。
// 輸出：stdout 一份 JSON summary（每個 context 的 screenshot / consoleErrors / pageErrors / messages / eval）。
// 截圖只寫 --out 指定的路徑（放 scratchpad），不要寫進 src/ 或 public/（PreToolUse hook 會擋 png）。

import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import dns from 'node:dns/promises'

const args = parseArgs(process.argv.slice(2))
if (!args.url || !args.out) {
  console.error('需要 --url 與 --out（截圖路徑，不含副檔名）。')
  process.exit(2)
}
const HOME = homedir()
const contexts = Number(args.contexts ?? 1)
const waitMs = Number(args.wait ?? 2500)
const width = Number(args.width ?? 1280)
const height = Number(args.height ?? 800)

const { chromium } = await loadPlaywright()
const executablePath = findChromium(chromium)
const launchArgs = ['--enable-unsafe-swiftshader'] // WebGL（Godot / Babylon）需要
if (args.dns) {
  const rule = await hostResolverRules()
  if (rule) launchArgs.push(rule)
}

const browser = await chromium.launch({ executablePath, headless: true, args: launchArgs })
const summary = { url: args.url, executablePath, contexts: [] }
try {
  const jobs = []
  for (let i = 1; i <= contexts; i++) jobs.push(runContext(i))
  summary.contexts = await Promise.all(jobs)
} finally {
  await browser.close()
}
console.log(JSON.stringify(summary, null, 2))
process.exit(summary.contexts.some((c) => c.pageErrors.length) ? 1 : 0)

// ---------------------------------------------------------------------------

async function runContext(i) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    colorScheme: args.dark ? 'dark' : 'light',
  })
  const page = await ctx.newPage()
  const consoleErrors = []
  const pageErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') consoleErrors.push(`[${m.type()}] ${m.text()}`)
  })
  page.on('pageerror', (e) => pageErrors.push(String(e)))
  if (args.messages) {
    await ctx.addInitScript((source) => {
      window.__bridgeMsgs = []
      window.addEventListener('message', (e) => {
        try {
          const d = JSON.parse(JSON.stringify(e.data))
          if (d && d.source === source) window.__bridgeMsgs.push(d)
        } catch {}
      })
    }, args.messages)
  }

  await page.goto(args.url, { waitUntil: 'load' })
  if (args['wait-for']) await page.waitForSelector(args['wait-for'], { timeout: 30_000 })
  if (waitMs > 0) await page.waitForTimeout(waitMs)

  const file = contexts > 1 ? `${args.out}-${i}.png` : `${args.out}.png`
  await page.screenshot({ path: file, fullPage: Boolean(args.full) })

  const result = { context: i, screenshot: file, consoleErrors, pageErrors }
  if (args.messages) result.messages = await page.evaluate(() => window.__bridgeMsgs ?? [])
  if (args.eval) {
    try {
      result.eval = await page.evaluate(args.eval)
    } catch (e) {
      result.eval = `EVAL ERROR: ${e.message}`
    }
  }
  await ctx.close()
  return result
}

async function loadPlaywright() {
  // 優先專案自己的 node_modules，其次 npx 快取（hash 目錄會變，動態掃）。
  const cands = [
    join(process.cwd(), 'node_modules/playwright'),
    join(process.cwd(), 'node_modules/playwright-core'),
  ]
  const npx = join(HOME, '.npm/_npx')
  if (existsSync(npx)) {
    for (const d of readdirSync(npx)) {
      cands.push(join(npx, d, 'node_modules/playwright'))
      cands.push(join(npx, d, 'node_modules/playwright-core'))
    }
  }
  for (const c of cands) {
    if (existsSync(join(c, 'index.mjs'))) return import(pathToFileURL(join(c, 'index.mjs')).href)
  }
  console.error('找不到 playwright 模組。備援：npm i --no-save --prefix /tmp/pwtest playwright-core，或 npx playwright@latest --version 讓 npx 快取一份。')
  process.exit(2)
}

function findChromium(chromium) {
  try {
    const p = chromium.executablePath()
    if (p && existsSync(p)) return p
  } catch {}
  const dir = join(HOME, '.cache/ms-playwright')
  if (!existsSync(dir)) fail()
  const versions = readdirSync(dir)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
  for (const v of versions) {
    for (const rel of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
      const p = join(dir, v, rel)
      if (existsSync(p)) return p
    }
  }
  fail()
  function fail() {
    console.error('找不到 chromium。跑 npx playwright install chromium 下載一份到 ~/.cache/ms-playwright/。')
    process.exit(2)
  }
}

async function hostResolverRules() {
  const hosts = [
    'identitytoolkit.googleapis.com',
    'securetoken.googleapis.com',
    'firestore.googleapis.com',
    'www.googleapis.com',
  ]
  const maps = []
  for (const h of hosts) {
    try {
      const [ip] = await dns.resolve4(h)
      if (ip) maps.push(`MAP ${h} ${ip}`)
    } catch (e) {
      console.error(`DNS 解析失敗 ${h}: ${e.code ?? e.message}`)
    }
  }
  return maps.length ? `--host-resolver-rules=${maps.join(',')}` : null
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const key = a.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) out[key] = true
    else {
      out[key] = next
      i++
    }
  }
  return out
}
