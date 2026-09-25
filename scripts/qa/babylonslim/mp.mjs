#!/usr/bin/env node
// babylonslim qa：/battle 兩位玩家（兩個獨立 context）自動對戰四款遊戲，觸發必經事件、打到結算、再開一局。
// 用法：node scripts/qa/babylonslim/mp.mjs <base 例 http://localhost:5173/collect/> <out 前綴> [games] [--solo | --mobile | --net]
// stdout：JSON summary（每款每個 context 的截圖、consoleErrors、pageErrors、事件證據）。截圖只寫 out 前綴（放 scratchpad）。
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import dns from 'node:dns/promises'

const BASE = process.argv[2]
const OUT = process.argv[3]
const GAMES = (process.argv[4] && !process.argv[4].startsWith('--') ? process.argv[4] : 'tank,race,bomber,overcooked').split(',')
const MOBILE = process.argv.includes('--mobile')
const SOLO = process.argv.includes('--solo')
const NET = process.argv.includes('--net')
const HOME = homedir()
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function loadPlaywright() {
  const cands = []
  const npx = join(HOME, '.npm/_npx')
  if (existsSync(npx)) for (const d of readdirSync(npx)) cands.push(join(npx, d, 'node_modules/playwright'), join(npx, d, 'node_modules/playwright-core'))
  for (const c of cands) if (existsSync(join(c, 'index.mjs'))) return import(pathToFileURL(join(c, 'index.mjs')).href)
  throw new Error('no playwright')
}
function findChromium(chromium) {
  try { const p = chromium.executablePath(); if (p && existsSync(p)) return p } catch {}
  const dir = join(HOME, '.cache/ms-playwright')
  const vs = readdirSync(dir).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
  for (const v of vs) for (const rel of ['chrome-linux64/chrome', 'chrome-linux/chrome']) { const p = join(dir, v, rel); if (existsSync(p)) return p }
}
async function hostResolverRules() {
  const maps = []
  for (const h of ['identitytoolkit.googleapis.com', 'securetoken.googleapis.com', 'firestore.googleapis.com', 'www.googleapis.com']) {
    try { const [ip] = await dns.resolve4(h); if (ip) maps.push(`MAP ${h} ${ip}`) } catch {}
  }
  return maps.length ? `--host-resolver-rules=${maps.join(',')}` : null
}

const { chromium } = await loadPlaywright()
const launchArgs = ['--enable-unsafe-swiftshader']
const rule = await hostResolverRules()
if (rule) launchArgs.push(rule)
const browser = await chromium.launch({ executablePath: findChromium(chromium), headless: true, args: launchArgs })

async function newPlayer(tag, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts })
  const page = await ctx.newPage()
  const p = { tag, ctx, page, consoleErrors: [], pageErrors: [], shots: [] }
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') p.consoleErrors.push(`[${m.type()}] ${m.text()}`) })
  page.on('pageerror', (e) => p.pageErrors.push(String(e)))
  return p
}
const pos = (p) => p.page.evaluate(() => window.__BATTLE_POS ?? null)
const phase = (p) => p.page.evaluate(() => window.__BATTLE_PHASE ?? null)
const overlayText = (p) => p.page.evaluate(() => document.querySelector('[data-testid=battle-overlay]')?.innerText ?? null)
async function shot(p, game, label) {
  const f = `${OUT}-${game}-${label}-${p.tag}.png`
  await p.page.screenshot({ path: f })
  p.shots.push(f)
}
async function waitPhase(ps, want, timeout) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    const phs = await Promise.all(ps.map(phase))
    if (phs.every((x) => want.includes(x))) return true
    await wait(250)
  }
  return false
}
const tap = async (p, k, ms = 60) => { await p.page.keyboard.down(k); await wait(ms); await p.page.keyboard.up(k) }

// 沿單軸走到目標：遠時按住，距離 < 1 放鍵改短按微調（輪詢延遲下按住會來回震盪）；可同時每 fireEvery ms 按一次 fireKey
async function goAxis(p, axis, target, { tol = 0.3, timeout = 30000, fireKey, fireEvery = 550 } = {}) {
  const t0 = Date.now()
  let held = null
  let lastFire = 0
  let result = false
  const release = async () => { if (held) { await p.page.keyboard.up(held); held = null } }
  while (Date.now() - t0 < timeout) {
    const q = await pos(p)
    if (!q) { await wait(50); continue }
    const d = target - q[axis]
    if (Math.abs(d) <= tol) { result = true; break }
    const k = axis === 'x' ? (d > 0 ? 'd' : 'a') : (d > 0 ? 'w' : 's')
    if (fireKey && Date.now() - lastFire > fireEvery) { lastFire = Date.now(); await tap(p, fireKey, 40) }
    if (Math.abs(d) < 1) { await release(); await tap(p, k, 35); await wait(90); continue }
    if (held !== k) { await release(); await p.page.keyboard.down(k); held = k }
    await wait(30)
  }
  await release()
  return result
}
async function goTo(p, x, z, o) { const a = await goAxis(p, 'x', x, o); const b = await goAxis(p, 'z', z, o); return a && b }

// ---- 各款必經事件 ----
const PLANS = {
  // 兩台都移到無牆的偶數欄 cx=2（x=-11）；低角者砲塔不轉（+z）持續射擊，高角者清箱後沿欄往下靠近
  async tank(A, B, ev) {
    if (!B) { // 單人：移到 cx=2 往 +z 射擊清箱（命中木箱），無結算可打
      await goAxis(A, 'x', -11, { tol: 0.2 })
      for (let i = 0; i < 14; i++) { await tap(A, ' ', 40); await wait(550) }
      return
    }
    const [pa, pb] = [await pos(A), await pos(B)]
    const [low, high] = pa.z < pb.z ? [A, B] : [B, A]
    ev.low = low.tag
    let stop = false
    const lowJob = (async () => {
      await goAxis(low, 'x', -11, { tol: 0.2 })
      while (!stop) { await tap(low, ' ', 40); await wait(520) }
    })()
    await tap(high, 'q', 449) // 砲塔轉向 -x
    await goAxis(high, 'x', -11, { tol: 0.2, fireKey: ' ', timeout: 45000 })
    await tap(high, 'q', 449) // 再轉向 -z
    const t0 = Date.now()
    while (Date.now() - t0 < 60000) {
      if ((await phase(A)) === 'result') break
      const hp = await pos(high)
      if (hp && hp.alive && hp.z > -7) { await high.page.keyboard.down('s'); await wait(150); await high.page.keyboard.up('s') }
      await tap(high, ' ', 40)
      await wait(350)
    }
    stop = true
    await lowJob
    ev.highPos = await pos(high)
  },
  // 環道 r∈[14,22]：各自沿出生半徑繞行（依位置算切線方向＋半徑修正，a/d 轉向）
  async race(A, B, ev) {
    const drive = async (p) => {
      const start = await pos(p)
      const rt = Math.min(20.5, Math.max(15.5, Math.hypot(start.x, start.z)))
      let prev = start
      let steer = null
      await p.page.keyboard.down('w')
      const t0 = Date.now()
      while (Date.now() - t0 < 90000) {
        await wait(40)
        const q = await pos(p)
        if (!q) continue
        if ((await phase(p)) !== 'playing') break
        const dx = q.x - prev.x, dz = q.z - prev.z
        const moved = Math.hypot(dx, dz)
        let want = null
        if (moved > 0.05) {
          const heading = Math.atan2(dx, dz)
          const a = Math.atan2(q.x, q.z)
          const r = Math.hypot(q.x, q.z)
          const target = a + Math.PI / 2 + Math.max(-0.7, Math.min(0.7, (r - rt) * 0.25))
          let err = target - heading
          while (err > Math.PI) err -= 2 * Math.PI
          while (err < -Math.PI) err += 2 * Math.PI
          want = err > 0.04 ? 'd' : err < -0.04 ? 'a' : null
          prev = q
        }
        if (want !== steer) { if (steer) await p.page.keyboard.up(steer); if (want) await p.page.keyboard.down(want); steer = want }
      }
      if (steer) await p.page.keyboard.up(steer)
      await p.page.keyboard.up('w')
      return pos(p)
    }
    const ps = [A, B].filter(Boolean)
    const midShot = (async () => { await wait(12000); ev.midQ = await Promise.all(ps.map(async (p) => (await pos(p))?.q)) })()
    const rs = await Promise.all(ps.map(drive))
    await midShot
    ev.finalQ = rs.map((r) => r?.q)
  },
  // 13×11：走到相鄰格放彈、躲到角落另一側，炸 (2,0)/(10,10) 一帶木箱；之後原地放彈自盡讓回合結束（bot 收尾）
  async bomber(A, B, ev) {
    const cw = (c, n) => (c - (n - 1) / 2) * 2
    const one = async (p) => {
      const s = await pos(p)
      const steps = [s]
      const left = s.x < 0
      const cx0 = left ? 0 : 12, cy0 = left ? 0 : 10
      const cx1 = left ? 1 : 11
      const cy1 = left ? 1 : 9
      steps.push([await goTo(p, cw(cx1, 13), cw(cy0, 11)), await pos(p)])
      await tap(p, " ", 60)
      steps.push([await goTo(p, cw(cx0, 13), cw(cy0, 11)), await pos(p)])
      steps.push([await goTo(p, cw(cx0, 13), cw(cy1, 11)), await pos(p)])
      await wait(3500)
      const afterBomb = await pos(p)
      await tap(p, ' ', 60) // 原地放彈
      await wait(3000)
      return { steps, afterBomb, afterSelf: await pos(p) }
    }
    ev.players = await Promise.all([A, B].filter(Boolean).map(one))
  },
  // 11×7 廚房：A 做蔬菜湯、B 做肉湯，出餐口對上訂單 ing 就得分
  async overcooked(A, B, ev) {
    const cw = (c, n) => (c - (n - 1) / 2) * 2
    const cook = async (p, crateCx, boardCy, potCy) => {
      const log = []
      const t0 = Date.now()
      const step = async (x, z) => log.push([await goTo(p, x, z), Math.round((Date.now() - t0) / 100) / 10])
      await step(cw(crateCx, 11), cw(1, 7)); await tap(p, "e")
      await step(cw(1, 11), cw(boardCy, 7)); await tap(p, 'e')
      await wait(1800); await tap(p, 'e')
      await step(cw(9, 11), cw(potCy, 7)); await tap(p, 'e')
      await wait(3300); await tap(p, 'e')
      await step(cw(8, 11), cw(1, 7))
      for (let i = 0; i < 30; i++) {
        await tap(p, 'e')
        await wait(1000)
        const q = await pos(p)
        log.push(q?.score)
        if (q?.score > 0) break
      }
      return log
    }
    if (B) { const [la, lb] = await Promise.all([cook(A, 2, 2, 2), cook(B, 4, 4, 4)]); ev.scoreLogA = la; ev.scoreLogB = lb; return }
    ev.scoreLogA = await cook(A, 2, 2, 2) // 單人：先蔬菜、沒對上訂單再做肉
    if (!(ev.scoreLogA.at(-1) > 0)) ev.scoreLogA2 = await cook(A, 4, 4, 4)
  },
}

const summary = []
if (NET) {
  // AC7：非 /battle 路由不下載 vendor-babylon；進 /battle 單人才下載
  const P = await newPlayer('net')
  const reqs = []
  P.page.on('request', (q) => reqs.push(q.url()))
  const routes = ['', 'todos', 'resume', 'search', 'directions', 'miniGame', 'battle']
  for (const rt of routes) {
    const n0 = reqs.length
    if (rt === '') await P.page.goto(`${BASE}#/`, { waitUntil: 'load' })
    else await P.page.evaluate((h) => { location.hash = h }, `#/${rt}`)
    await wait(2500)
    const got = reqs.slice(n0).map((u) => u.split('/').pop())
    summary.push({ route: `#/${rt}`, babylon: got.filter((u) => /vendor-babylon/.test(u)), battleChunk: got.filter((u) => /^Battle-/.test(u)), requests: got.length })
  }
  const n0 = reqs.length
  await P.page.click('[data-testid="battle-game-card-tank"]')
  await P.page.click('[data-testid="battle-solo-btn"]')
  await P.page.waitForSelector('[data-testid="battle-canvas"]', { timeout: 30000 })
  const ok = await waitPhase([P], ['countdown', 'playing'], 30000)
  summary.push({ route: '#/battle solo tank', phaseOk: ok, babylon: reqs.slice(n0).map((u) => u.split('/').pop()).filter((u) => /vendor-babylon/.test(u)) })
  await shot(P, 'net', 'battle-solo')
  summary.push({ allBabylonRequests: reqs.filter((u) => /vendor-babylon/.test(u)).map((u) => u.split('/').pop()), shots: P.shots, consoleErrors: P.consoleErrors, pageErrors: P.pageErrors })
  await P.ctx.close()
} else if (MOBILE) {
  for (const [w, h] of [[390, 844], [844, 390]]) {
    const P = await newPlayer(`m${w}x${h}`, { viewport: { width: w, height: h }, hasTouch: true, isMobile: true })
    const pg = P.page
    await pg.goto(`${BASE}#/battle`, { waitUntil: 'load' })
    await pg.click('[data-testid="battle-game-card-tank"]')
    await pg.click('[data-testid="battle-solo-btn"]')
    await pg.waitForSelector('[data-testid="battle-canvas"]', { timeout: 30000 })
    await wait(5000)
    const r = { tag: P.tag, rotatePrompt: await pg.locator('[data-testid=rotate-prompt]').isVisible().catch(() => false) }
    await pg.evaluate(() => document.querySelector('[data-testid=battle-canvas]')?.scrollIntoView({ block: 'end' })) // 視窗矮，搖桿在 viewport 外時觸控點打不到
    await wait(400)
    const joy = await pg.locator('[data-testid="touch-joystick"]').boundingBox().catch(() => null)
    r.joystick = Boolean(joy)
    r.pos0 = await pos(P)
    if (joy) {
      const cdp = await P.ctx.newCDPSession(pg)
      const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1, radiusX: 5, radiusY: 5, force: 1 }] })
      const cx = joy.x + joy.width / 2, cy = joy.y + joy.height / 2
      await tp('touchStart', cx, cy)
      for (let i = 1; i <= 10; i++) { await tp('touchMove', cx + 4 * i, cy - 4 * i); await wait(100) }
      await wait(1200)
      await shot(P, 'tank', 'touch-mid')
      await tp('touchEnd', cx, cy)
    }
    r.pos1 = await pos(P)
    await shot(P, 'tank', 'touch-end')
    Object.assign(r, { shots: P.shots, consoleErrors: P.consoleErrors, pageErrors: P.pageErrors })
    summary.push(r)
    await P.ctx.close()
  }
} else if (SOLO) {
  for (const game of GAMES) {
    const A = await newPlayer('solo')
    const ev = {}
    const r = { game, mode: 'solo', ev }
    try {
      await A.page.goto(`${BASE}#/battle`, { waitUntil: 'load' })
      await A.page.click(`[data-testid="battle-game-card-${game}"]`)
      await A.page.click('[data-testid="battle-solo-btn"]')
      await A.page.waitForSelector('[data-testid="battle-canvas"]', { timeout: 30000 })
      await waitPhase([A], ['countdown', 'playing'], 30000)
      await wait(800)
      await shot(A, game, '1-countdown')
      r.playing = await waitPhase([A], ['playing'], 40000)
      await wait(1500)
      await shot(A, game, '2-playing')
      r.startPos = await pos(A)
      const planJob = PLANS[game](A, null, ev)
      await wait(game === 'race' ? 12000 : 7000)
      await shot(A, game, '3-mid')
      await planJob
      r.afterPlanPos = await pos(A)
      if (game === 'tank') {
        await shot(A, game, '4-after-fire')
        await tap(A, 'r') // 單人坦克沒有結算（2 人以上才裁決），以 R 重開
      } else {
        r.result = await waitPhase([A], ['result'], 200000)
        await wait(1200)
        r.resultOverlay = await overlayText(A)
        await shot(A, game, '4-result')
        await A.page.click('[data-testid="battle-overlay-action"]', { timeout: 3000 }).catch(() => { r.autoAdvance = true }) // bomber 6s／overcooked 10s 會自動進下一局
      }
      r.restart = await waitPhase([A], ['countdown'], 15000)
      r.restartPlaying = await waitPhase([A], ['playing'], 30000)
      await wait(1500)
      r.restartPos = await pos(A)
      await shot(A, game, '5-restart')
    } catch (e) {
      r.error = String(e)
      await shot(A, game, 'error').catch(() => {})
    }
    Object.assign(r, { shots: A.shots, consoleErrors: A.consoleErrors, pageErrors: A.pageErrors })
    summary.push(r)
    await A.ctx.close()
  }
} else {
  for (const game of GAMES) {
    const A = await newPlayer('A')
    const B = await newPlayer('B')
    const ev = {}
    const r = { game, ev }
    try {
      await A.page.goto(`${BASE}#/battle`, { waitUntil: 'load' })
      await B.page.goto(`${BASE}#/battle`, { waitUntil: 'load' })
      await A.page.click(`[data-testid="battle-game-card-${game}"]`)
      await A.page.fill('[data-testid="battle-name-input"]', 'QA-A')
      await A.page.click('[data-testid="battle-create-btn"]')
      await A.page.waitForSelector('[data-testid="battle-room-code"]', { timeout: 30000 })
      const code = ((await A.page.innerText('[data-testid="battle-room-code"]')).match(/[A-Z0-9]{4,8}/) ?? [])[0]
      r.code = code
      await B.page.click(`[data-testid="battle-game-card-${game}"]`)
      await B.page.fill('[data-testid="battle-name-input"]', 'QA-B')
      await B.page.fill('[data-testid="battle-code-input"]', code)
      await B.page.click('[data-testid="battle-join-btn"]')
      await B.page.waitForSelector('[data-testid="battle-room"]', { timeout: 30000 })
      await A.page.waitForFunction(() => document.querySelectorAll('[data-testid=battle-player-list] li').length >= 2, null, { timeout: 30000 })
      await A.page.click('[data-testid="battle-start-btn"]')
      await Promise.all([A, B].map((p) => p.page.waitForSelector('[data-testid="battle-canvas"]', { timeout: 30000 })))
      await waitPhase([A, B], ['countdown', 'playing'], 30000)
      await wait(800)
      await Promise.all([A, B].map((p) => shot(p, game, '1-countdown')))
      r.playing = await waitPhase([A, B], ['playing'], 40000)
      await wait(1500)
      r.peers = await Promise.all([A, B].map((p) => p.page.evaluate(() => document.querySelector('[data-testid=net-peer-count]')?.innerText ?? null)))
      await Promise.all([A, B].map((p) => shot(p, game, '2-playing')))
      r.startPos = { A: await pos(A), B: await pos(B) }
      const planJob = PLANS[game](A, B, ev)
      await wait(game === 'race' ? 12000 : 9000)
      await Promise.all([A, B].map((p) => shot(p, game, '3-mid')))
      await planJob
      r.result = await waitPhase([A, B], ['result'], 200000)
      await wait(1200)
      r.resultOverlay = { A: await overlayText(A), B: await overlayText(B) }
      await Promise.all([A, B].map((p) => shot(p, game, '4-result')))
      // 再開一局（房主按結算面板的按鈕）
      await A.page.click('[data-testid="battle-overlay-action"]', { timeout: 3000 }).catch(() => { r.autoAdvance = true })
      r.restart = await waitPhase([A, B], ['countdown', 'playing'], 30000)
      r.restartPlaying = await waitPhase([A, B], ['playing'], 30000)
      await wait(1500)
      await Promise.all([A, B].map((p) => shot(p, game, '5-restart')))
    } catch (e) {
      r.error = String(e)
      await Promise.all([A, B].map((p) => shot(p, game, 'error').catch(() => {})))
    }
    r.contexts = [A, B].map((p) => ({ tag: p.tag, shots: p.shots, consoleErrors: p.consoleErrors, pageErrors: p.pageErrors }))
    summary.push(r)
    await A.page.click('[data-testid="battle-leave-btn"]').catch(() => {})
    await B.page.click('[data-testid="battle-leave-btn"]').catch(() => {})
    await wait(500)
    await A.ctx.close(); await B.ctx.close()
  }
}
await browser.close()
console.log(JSON.stringify(summary, null, 2))
