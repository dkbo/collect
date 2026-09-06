// Godot Web 匯出後處理：把 shell 產生的 icon / apple-touch-icon / splash PNG 轉成 WebP，
// 並改寫 index.html 的引用（AGENTS.md：圖片一律 WebP）。Godot 匯出只會產 PNG，
// 手改 index.html 會在下次匯出被蓋掉，所以掛在 godot:export / candy:export 後面自動跑。
// 用法：node scripts/godot-webp-shell.mjs public/godot
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2]
if (!dir || !existsSync(join(dir, 'index.html'))) {
  console.error('用法：node scripts/godot-webp-shell.mjs <匯出目錄>（需含 index.html）')
  process.exit(1)
}
const names = ['index.icon', 'index.apple-touch-icon', 'index']
let html = readFileSync(join(dir, 'index.html'), 'utf8')
let converted = 0
for (const name of names) {
  const png = join(dir, `${name}.png`)
  if (!existsSync(png)) continue
  execFileSync('cwebp', ['-quiet', '-q', '85', png, '-o', join(dir, `${name}.webp`)])
  unlinkSync(png)
  converted++
}
html = html
  .replaceAll('type="image/png"', 'type="image/webp"')
  .replace(/(href|src)="(index(?:\.icon|\.apple-touch-icon)?)\.png"/g, '$1="$2.webp"')
writeFileSync(join(dir, 'index.html'), html)
console.log(`[godot-webp-shell] ${dir}: 轉了 ${converted} 張 PNG → WebP，index.html 已改寫`)
