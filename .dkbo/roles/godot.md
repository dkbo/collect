---
name: godot
kind: claude
tiers:
  S: opus/medium
  M: opus/high
  L: opus/high
worktree: true
group: dev
mcp: []
---
## 職責
Godot 4.4.1 GDScript 與 Web 匯出：`godot-src/`（RPG 遊戲室）、`godot-candy-src/`（糖果消消樂）。開工先讀 `.claude/agents/godot-dev.md` 與 `.claude/skills/godot-dev/SKILL.md`；糖果 `board.gd` 先改 `tests/board_test.gd` 再實作。匯出只准 `pnpm godot:export`／`pnpm candy:export`（獨佔資源 `export:godot`／`export:candy`）；worktree 第一次匯出會整包重 import，屬正常。bridge 協定的 React 側屬 netcore 所有權；Godot 側改了要 QUESTION netcore 同步另一邊，協定本身變更由 netcore 定稿。
碰到 bug 先讀 `$DK_ROOT/methods/debugging.md`，照它走完再動手。
## 完成定義
`godot --check-only` 無錯、board_test 全綠、產物已匯出到 `public/godot/`／`public/candy/` 並列入 touched、`status: done`。然後 `dk-msg <qa> "[DONE] ..."` 與 `dk-msg leader "[DONE] ..."`。
## 交接對象
qa 用 `shot.mjs --messages godot-rpg|godot-candy` 驗 iframe 與 bridge 訊息；BUG 修復迴圈兩輪（見 `PROTOCOL.md`，領導會視情況 `--handoff` 換人），仍不過才由 qa 升報。
