// 地圖 JSON 單一來源同步：src/pages/RpgRoom/data/*.json → public/godot/maps/
// build 與 godot:export 前執行，讓 Godot 執行期 fetch 與 RpgRoom 同一份地圖。
import { cpSync, mkdirSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = join(root, 'src/pages/RpgRoom/data')
const outDir = join(root, 'public/godot/maps')

mkdirSync(outDir, { recursive: true })

const maps = readdirSync(srcDir).filter((f) => /^\d+_map\.json$/.test(f))
for (const file of maps) {
  cpSync(join(srcDir, file), join(outDir, file))
}
console.log(`[sync-godot-maps] 已同步 ${maps.length} 張地圖 → public/godot/maps/`)
