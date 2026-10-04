// 用法：node .src/build.mjs <name> [<name>…]
// 讀 .src/prelude.js + .src/pages/<name>.js，經 `pen interactive` 的 execute 畫進 design/<name>.pen，
// 並在同一個 execute 內 Export 成 design/<name>.webp（scale 1）。預覽圖寫 design/.exports/<name>.png。
import { readFileSync, writeFileSync, readdirSync, renameSync, mkdirSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = dirname(fileURLToPath(import.meta.url))
const DESIGN = dirname(SRC)
const tokens = JSON.parse(readFileSync(join(DESIGN, 'toybox-ds/tokens.json'), 'utf8'))
const vars = {}
const byName = Object.fromEntries(tokens.color.tokens.map((t) => [t.name, t.value]))
for (const t of tokens.color.tokens) {
  let v = t.value
  if (typeof v === 'string') v = byName[v.replace(/[{}]/g, '')]
  vars[t.name] = { type: 'color', value: [{ value: v.light, theme: { mode: 'light' } }, { value: v.dark, theme: { mode: 'dark' } }] }
}
const prelude = `const VARS=${JSON.stringify(vars)};\n` + readFileSync(join(SRC, 'prelude.js'), 'utf8')

const queue = process.argv.slice(2).map((n) => [n, 0])
while (queue.length) {
  const [name, tries] = queue.shift()
  const body = readFileSync(join(SRC, 'pages', `${name}.js`), 'utf8')
  const tmp = join(DESIGN, '.exports', `tmp-${name}`)
  rmSync(tmp, { recursive: true, force: true })
  mkdirSync(tmp, { recursive: true })
  const input = `${prelude}\n${body}\nExport([p],"webp",${JSON.stringify(tmp)},{scale:1,quality:90})`
  const cmds = `execute({ input: ${JSON.stringify(input)} })\nsave()\nexit()\n`
  const r = spawnSync('pen', ['interactive', '--out', join(DESIGN, `${name}.pen`), '--preview-output', join(DESIGN, '.exports', `${name}.png`)], { input: cmds, encoding: 'utf8', timeout: 300000 })
  const out = (r.stdout || '') + (r.stderr || '')
  if (/Failed to load font/.test(out) && tries < 2) { console.log(`[${name}] font fetch failed, retry`); queue.push([name, tries + 1]); continue }
  const errs = out.split('\n').filter((l) => /Error|error|WARN|Warning|warning/.test(l) && !/Update available/.test(l))
  const files = readdirSync(tmp).filter((f) => f.endsWith('.webp'))
  if (files.length !== 1) {
    writeFileSync(join(tmp, 'log.txt'), out)
    console.log(`[${name}] FAILED, log: ${join(tmp, 'log.txt')}\n` + errs.slice(0, 30).join('\n'))
    continue
  }
  renameSync(join(tmp, files[0]), join(DESIGN, `${name}.webp`))
  rmSync(tmp, { recursive: true, force: true })
  console.log(`[${name}] ok ${errs.length ? '\n' + errs.slice(0, 20).join('\n') : ''}`)
}
