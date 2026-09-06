---
name: godot-dev
description: Godot 遊戲開發循環(匯出、測試、產物 commit)。當需要修改 godot-src/(RPG)或 godot-candy-src/(糖果)的 GDScript/場景/關卡,或要重新匯出 Web build、同步地圖 JSON 時使用。
model: sonnet
effort: high
---

# Godot 開發循環

本專案有兩套**完全獨立**的 Godot 4.4 Web 遊戲,匯出產物進版控(CI 無 Godot 環境,必須本機匯出後 commit)。

## 工具鏈

- Godot 4.4.1-stable 安裝於 `~/tools/godot/`,CLI 符號連結 `~/.local/bin/godot`(已在 PATH)
- 匯出模板:`~/.local/share/godot/export_templates/4.4.1.stable/`
- 系統無 `unzip`,解壓改用 `python3 -m zipfile -e`(之後記得 `chmod +x` 還原執行權限)

## 兩套遊戲

| | RPG(/godot-game) | 糖果(/candy-crush) |
|---|---|---|
| 原始碼 | `godot-src/` | `godot-candy-src/` |
| 匯出產物 | `public/godot/` | `public/candy/` |
| 匯出指令 | `pnpm godot:export` | `pnpm candy:export` |
| React 橋接 | `src/lib/godotBridge.ts`(source: `godot-rpg`) | `src/lib/candyBridge.ts`(source: `godot-candy`,協定 v1) |
| React 外殼 | `src/pages/GodotGame/` | `src/pages/CandyCrush/` + `src/store/useCandyStore.ts` |

兩者不共用任何場景/腳本/匯出產物。

## RPG 開發流程

```bash
# 1. 修改 godot-src/ 腳本或場景
# 2. 匯出(自動先 sync:maps 同步地圖 JSON 到 public/godot/maps/)
pnpm godot:export
# 3. 本機驗證後 commit public/godot 產物
pnpm dev   # 開 /collect/#/godot-game 對照 /collect/#/rpgroom 驗收
```

- 地圖 JSON 單一來源在 `src/pages/RpgRoom/data/`,由 `scripts/sync-godot-maps.mjs` 同步(`pnpm build` 也含 `sync:maps`)——**改地圖後不要手動複製到 public/**
- `game.gd` 有 `DEBUG_STATE` 指令可透過 postMessage 回報玩家/NPC 狀態,驗證時可用

## 糖果開發流程

```bash
# 1. 修改 godot-candy-src/ 腳本、場景或 data/candy_levels.json 關卡
# 2. 先跑純邏輯單測(board.gd 盤面邏輯)
godot --headless --path godot-candy-src --script res://tests/board_test.gd
# 3. 匯出後 commit public/candy 產物
pnpm candy:export
```

- 關卡定義 `data/candy_levels.json` 打進 pck,不走 fetch;export preset 的 `include_filter` 含 `*.json`

## 匯出注意事項

- **Web 匯出 Threads 必須 OFF**:靜態託管(Firebase Hosting)無法回 COOP/COEP header,Threads ON 會直接黑屏
- 匯出指令已含 `--import`(重建 .godot 快取),首次或資源變動後匯出較慢屬正常
- 匯出指令尾端會跑 `scripts/godot-webp-shell.mjs`:把 Godot shell 產的 icon / apple-touch-icon / splash PNG 轉 WebP 並改寫 index.html(AGENTS.md 圖片一律 WebP)。**不要手改 index.html 的圖片引用**,重匯出會被蓋掉,規則寫在那支腳本
- 素材一律 WebP(`godot-src/assets/*.webp`);長條圖庫 `rpg_maker_xp*.webp` 的 `.import` 是 `importer="image"`(CPU Image 供切塊),新增素材時沿用同款 .import 設定
- `godot --check-only -s` 不會註冊 autoload(Bridge / CandyBridge / CandySfx),單獨檢查用到它們的腳本會報 `Identifier not found`,是工具限制;PostToolUse hook 已濾掉
- 匯出後 `git status` 確認 `public/godot/` 或 `public/candy/` 產物有更新,連同源碼一起 commit

## 瀏覽器驗證

匯出後的實際運行驗證(iframe bridge 事件、多人對戰)見 `verify-web` skill。
