// 逐格匹配明細 → styles[] 草稿（rx/ry 壓縮合併）
// 用法: node grid_to_styles.cjs <grid.json（precheck_tiles --emit-grid 輸出）> [out.json]
//   輸出 { styles, npcCells, unmatchedCells }：
//   - styles：b=1/2 的匹配格合併成草稿（先橫向 rx、再縱向 ry），全部背景層（z=2 要人工拆）
//   - npcCells：匹配到 man.png(b=0) 的格 → NPC 候選位置
//   - unmatchedCells：未匹配格 → 疊層/NPC/雜訊，人工判讀
//   b=3（bg.jpg 草地）不產 style（引擎自動平鋪底圖）。
// 純 JSON 轉換，不需要 chromium。
const fs = require('fs')

const [gridFile, outFile] = process.argv.slice(2)
if (!gridFile || !fs.existsSync(gridFile)) {
  console.error('用法: node grid_to_styles.cjs <grid.json> [out.json]')
  process.exit(1)
}
const { mapW, mapH, tile: TILE, cells } = JSON.parse(fs.readFileSync(gridFile, 'utf8'))
const cols = mapW / TILE

// 格座標索引：cell[row][col]
const at = (col, row) => cells[row * cols + col] || null
const rows = mapH / TILE

const npcCells = []
const unmatchedCells = []
const used = new Set() // 已被合併消耗的格 "col,row"

for (const c of cells) {
  if (c.b === 0) npcCells.push({ l: c.l, t: c.t })
  else if (c.b === null && c.tex) unmatchedCells.push({ l: c.l, t: c.t })
}

const sameTile = (a, b) => a && b && a.b === b.b && a.x === b.x && a.y === b.y && a.b !== 0 && a.b !== 3 && a.b !== null

// 貪婪合併：先找最大橫向 run（rx），再嘗試整條向下延伸（ry）
const styles = []
for (let row = 0; row < rows; row++) {
  for (let col = 0; col < cols; col++) {
    const key = `${col},${row}`
    if (used.has(key)) continue
    const c = at(col, row)
    if (!c || c.b === null || c.b === 0 || c.b === 3) continue
    // 橫向延伸
    let rx = 1
    while (col + rx < cols && !used.has(`${col + rx},${row}`) && sameTile(c, at(col + rx, row))) rx++
    // 縱向延伸（整條 rx 寬都相同才算一列）
    let ry = 1
    outer: while (row + ry < rows) {
      for (let i = 0; i < rx; i++) {
        if (used.has(`${col + i},${row + ry}`) || !sameTile(c, at(col + i, row + ry))) break outer
      }
      ry++
    }
    for (let dy = 0; dy < ry; dy++)
      for (let dx = 0; dx < rx; dx++) used.add(`${col + dx},${row + dy}`)
    const s = { n: `auto b${c.b}(${c.x},${c.y})`, l: c.l, t: c.t, w: TILE, h: TILE, b: c.b, x: c.x, y: c.y }
    if (rx > 1) s.rx = rx
    if (ry > 1) s.ry = ry
    styles.push(s)
  }
}

const result = { mapW, mapH, styles, npcCells, unmatchedCells }
if (outFile) {
  fs.writeFileSync(outFile, JSON.stringify(result, null, 1))
  console.log(`ok -> ${outFile}`)
} else {
  console.log(JSON.stringify(result, null, 1))
}
console.error(
  `styles 草稿 ${styles.length} 筆（合併自 ${[...used].length} 格）｜` +
    `NPC 候選格 ${npcCells.length}｜未匹配紋理格 ${unmatchedCells.length}\n` +
    `注意：草稿全在背景層 — 樹冠/屋簷/天花板/家具上半要人工改 z:2；` +
    `n 欄位請替換為語意名稱；家具疊地板的格可能被轉錄成合成格素材，渲染比對時微調`
)
