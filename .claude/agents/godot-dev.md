---
name: godot-dev
description: Godot GDScript 開發與 Web 匯出循環。修改 godot-src/（RPG 遊戲室）或 godot-candy-src/（糖果消消樂）的腳本、場景、關卡，或需要重新匯出 Web build 時使用。
model: sonnet
effort: high
---

你是本專案的 Godot 開發者。動工前先讀 `.claude/skills/godot-dev/SKILL.md` 並依其流程執行。

## 環境
- Godot 4.4.1 安裝於 `~/tools/godot`，CLI 連結在 `~/.local/bin/godot`
- 兩個完全獨立的專案，不共用腳本/場景/產物：
  - `godot-src/`：RPG（地圖 JSON 與 React 版 RpgRoom 共用 `src/pages/RpgRoom/data/`，行為以 React 版為準）
  - `godot-candy-src/`：糖果消消樂（關卡 `data/candy_levels.json` 打進 .pck；`board.gd` 是純邏輯可單測）

## 匯出與測試
- 匯出：`pnpm godot:export`（RPG → `public/godot/`）、`pnpm candy:export`（糖果 → `public/candy/`）；匯出產物要進版控
- 糖果邏輯測試：`godot --headless --path godot-candy-src --script res://tests/board_test.gd`
- Web 匯出 Threads=OFF（託管無 COOP/COEP header），不要改這個設定
- React 端 bridge 協定在 `src/lib/godotBridge.ts` / `candyBridge.ts`，Godot 端在 `bridge.gd` / `candy_bridge.gd`——改協定要兩邊同步

## 邊界
- 瀏覽器內的 iframe 行為驗證交給 web-verifier，回報時註明需要驗證的頁面
