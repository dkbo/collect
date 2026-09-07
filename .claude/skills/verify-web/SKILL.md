---
name: verify-web
description: 本專案網頁驗證流程(Playwright、hash 路由、Godot iframe、多人對戰)。當需要在瀏覽器中驗證頁面行為、截圖、測 /battle 多人同步、或 Playwright MCP 啟不動時使用。
model: sonnet
effort: medium
---

# 網頁驗證流程

## 路由與 dev server

- 路由是 `createHashRouter`,dev 網址格式:`http://localhost:5173/collect/#/<route>`(base path `/collect/`,hash 路由)
- vite 設了 `strictPort`:5173 被占用會**直接報錯**,不會換 port。先 `ss -ltnp | grep 5173` 看是誰佔著,不要去掃 5174/5175
- dev server 沒起就 `pnpm dev` 背景起(把輸出導到 `$S/dev.log`),驗完不用關

## 瀏覽器:一律用 `scripts/shot.mjs`

本機沒有 `/opt/google/chrome/chrome`(裝要 sudo),Playwright MCP 起不來、也已從 `.mcp.json` 移除。用 skill 附的腳本,它會自己找 npx 快取的 playwright 模組與 `~/.cache/ms-playwright/` 的 chromium(hash / 版本目錄會變,不要寫死路徑):

```bash
S=<本 session scratchpad>
# 單頁截圖 + console 錯誤 + 跑一段 JS
node .claude/skills/verify-web/scripts/shot.mjs --url 'http://localhost:5173/collect/#/todos' --out "$S/todos" --wait 2000 --eval 'document.title'
# Godot iframe:等 wasm 載完(--wait 8000 起跳),收 bridge postMessage(RPG godot-rpg / 糖果 godot-candy)
node .claude/skills/verify-web/scripts/shot.mjs --url 'http://localhost:5173/collect/#/godot-game' --out "$S/godot" --wait 8000 --messages godot-rpg
# /battle 多人:N 個獨立 context(各自 IndexedDB / 匿名 uid),WSL 要帶 --dns
node .claude/skills/verify-web/scripts/shot.mjs --url 'http://localhost:5173/collect/#/battle' --out "$S/battle" --contexts 2 --wait 4000 --dns
```

- 其他旗標:`--wait-for '<css>'`、`--width/--height`、`--full`(整頁,注意固定定位元素會重複出現的假象)、`--dark`
- stdout 是 JSON summary(每個 context 的截圖路徑、consoleErrors、pageErrors、messages、eval);有 pageError 時 exit 1
- 截圖只寫 `$S`,**不要寫進 `src/`／`public/`**(PreToolUse hook 會擋 png)
- 要點擊、填表等互動流程,腳本不夠用時才另寫 node 腳本:複製 `shot.mjs` 的 `loadPlaywright()` / `findChromium()` 取得 `chromium`,不要重新猜路徑

## Godot iframe 驗證

- bridge 訊息由 `--messages` 收:RPG 為 `source === 'godot-rpg'`,糖果為 `source === 'godot-candy'`
- RPG 的 `game.gd` 支援 `DEBUG_STATE` 指令,可回報玩家/NPC 狀態(用 `--eval` 對 iframe `postMessage` 後再讀)

## 多人對戰(/battle)驗證

- **每位玩家必須用獨立的 browser context**(`--contexts N`)。同 context 開多分頁會共用 Firebase 匿名 uid → 「不同玩家」同 uid,players 子集合只有 1 筆,看起來像同步失敗
- Firestore 是具名資料庫 `dkbo-collect`(專案 `test-73ce3`),`.env.local` 需 `VITE_FIREBASE_FIRESTORE_DB=dkbo-collect`;env 留空連 `(default)` 必死(它是 Datastore Mode)
- 排查「client is offline」:SDK 訊息是包裝,先用 node 直連探針看 gRPC 真錯誤碼(initializeFirestore + signInAnonymously + getDoc/setDoc):
  - `FAILED_PRECONDITION: Cloud Firestore API is not available` → 連到 Datastore-mode 的 (default)
  - `PERMISSION_DENIED: requires billing to be enabled` → 具名 DB 需 Blaze 帳單

## WSL 環境陷阱

- 瀏覽器內 DNS 壞(WSL DNS proxy `10.255.255.254` 對瀏覽器無效)。`shot.mjs --dns` 已處理:node `dns.resolve4` 先解析 `identitytoolkit` / `securetoken` / `firestore.googleapis.com`,再以 `--host-resolver-rules=MAP <host> <ip>` 注入 chromium
- 串流仍不通時的備援:`VITE_FIREBASE_FORCE_LONG_POLLING=1`(`src/core/firebase` 支援)
