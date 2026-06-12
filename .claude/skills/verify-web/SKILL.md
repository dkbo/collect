---
name: verify-web
description: 本專案網頁驗證流程(Playwright、hash 路由、Godot iframe、多人對戰)。當需要在瀏覽器中驗證頁面行為、截圖、測 /battle 多人同步、或 Playwright MCP 啟不動時使用。
---

# 網頁驗證流程

## 路由與 dev server

- 路由是 `createHashRouter`,dev 網址格式:`http://localhost:5173/collect/#/<route>`(base path `/collect/`,hash 路由)
- port 被占用時 vite 自動跳 5174/5175,**跑驗證前先確認實際 port**(看 `pnpm dev` 輸出)

## 瀏覽器取得方式

優先用 playwright MCP(`mcp__playwright__browser_*`)。MCP 要求 `/opt/google/chrome/chrome`(安裝需 sudo,無法自動化);缺 Chrome 時改用快取的 chromium 跑 node 腳本:

```js
// 方式一:npx 快取的 playwright(hash 目錄會變,先 ls /home/bal/.npm/_npx/*/node_modules/playwright 確認)
import { chromium } from '/home/bal/.npm/_npx/<hash>/node_modules/playwright/index.mjs'
const browser = await chromium.launch({
  // 版本目錄會變,先 ls /home/bal/.cache/ms-playwright/ 確認
  executablePath: '/home/bal/.cache/ms-playwright/chromium-<ver>/chrome-linux64/chrome',
  headless: true,
  args: ['--enable-unsafe-swiftshader'], // WebGL(Godot/Babylon)需要
})
```

```bash
# 方式二:臨時安裝 playwright-core(不會自動下載瀏覽器,須給 executablePath)
npm i --no-save --prefix /tmp/pwtest playwright-core@1.56.0
NODE_PATH=/tmp/pwtest/node_modules node script.cjs   # require('playwright-core')
# 注意:npx -p 無法讓 /tmp 下的 require 解析到模組,要用 NODE_PATH
```

## Godot iframe 驗證

- 用 `addInitScript` 監聽 `message` 事件收 bridge 訊息:RPG 為 `source === 'godot-rpg'`,糖果為 `source === 'godot-candy'`
- RPG 的 `game.gd` 支援 `DEBUG_STATE` 指令,可回報玩家/NPC 狀態

## 多人對戰(/battle)驗證

- **每位玩家必須用獨立的 `browser.newContext()`**(各自 IndexedDB)。同 context 開多分頁會共用 Firebase 匿名 uid → 「不同玩家」同 uid,players 子集合只有 1 筆,看起來像同步失敗
- Firestore 是具名資料庫 `dkbo-collect`(專案 `test-73ce3`),`.env.local` 需 `VITE_FIREBASE_FIRESTORE_DB=dkbo-collect`;env 留空連 `(default)` 必死(它是 Datastore Mode)
- 排查「client is offline」:SDK 訊息是包裝,先用 node 直連探針看 gRPC 真錯誤碼(initializeFirestore + signInAnonymously + getDoc/setDoc):
  - `FAILED_PRECONDITION: Cloud Firestore API is not available` → 連到 Datastore-mode 的 (default)
  - `PERMISSION_DENIED: requires billing to be enabled` → 具名 DB 需 Blaze 帳單

## WSL 環境陷阱

- 瀏覽器內 DNS 壞(WSL DNS proxy `10.255.255.254` 對瀏覽器無效)。解法:node `dns.resolve4` 先解析 `identitytoolkit` / `securetoken` / `firestore.googleapis.com`,再以 `--host-resolver-rules=MAP <host> <ip>` 注入 chromium 啟動參數
- 串流仍不通時的備援:`VITE_FIREBASE_FORCE_LONG_POLLING=1`(`src/core/firebase` 支援)
