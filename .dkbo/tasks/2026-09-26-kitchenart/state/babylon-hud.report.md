# kitchenart-babylon-hud 報告（波 3）
（波 1 報告見 commit 9492a12 的同一檔）

## 做了什麼
波 3 沒有收到 qa 的 HUD BUG。babylon 接上 `setHud` 後，我用真資料確認了新單、逾時、出餐三種動畫與手機版，找到一個問題並修好：

- **問題：逾時／出餐的離場卡蓋住補位的下一張卡。** 離場卡原本用 absolute 疊回原槽位，剩下的單在同一幀就往左移一格，剛好落在離場卡底下。真資料量到的重疊是 18915／19109 px²（幾乎整張），t=200ms 截圖可以看到兩張卡的菜名、秒數、徽章疊在一起（`/tmp/claude-1000/-home-bal-project-collect--worktrees-kitchenart/1dd27387-24c3-4ec8-b56c-2431706c3787/scratchpad/idle/d-fz4-expired-1-t200.png`）。
- **修法**（只動我擁有的檔）：
  - `src/pages/Battle/kitchenHud.ts`：新增純函式 `orderRow(orders, leaving)`，把離場卡依槽位由小到大插回訂單列，槽位超出現有張數就接在尾端。
  - `src/pages/Battle/KitchenHud.tsx`：訂單列改用 `orderRow` 單一列表渲染；`LeavingCard` 不再帶 `--kitchen-slot`，改掛 `kitchen-order-leaving-<reason>`。
  - `src/index.css`（只改本任務新增的 `.kitchen-*`）：
    - 離場卡改成 flex 流內的 `relative`，寬度取 `--kitchen-card-w`。
    - 新增 `kitchen-collapse` keyframes：前 55% 保持原寬，之後把寬度與右側間距收到 0，後面的單在離場尾段滑進空位。時長照 `KITCHEN_LEAVE_MS`：出餐 0.6s、逾時 0.4s。
    - `.kitchen-orders` 定義 `--kitchen-card-w`／`--kitchen-card-gap`（桌機 150/10、手機 64/6），刪掉手機版原本的 `--kitchen-slot` 位移規則。
    - 浮字改成對齊卡片中心 `calc(var(--kitchen-card-w)/2)`，外框收合時不會跟著漂。
- 形狀、契約、`types.ts`、`BabylonCanvas.tsx` 都沒改。

## 測試
### 紅
`node_modules/.bin/vitest run src/pages/Battle/kitchenHud.test.ts`（先加 4 條：離場卡排回原槽位、出餐與逾時同一幀各回各位、槽位超出接尾端、靜態渲染 DOM 順序）
`TypeError: orderRow is not a function`（前 3 條）；DOM 順序那條 `expected … to be less than …` → `Tests  4 failed | 28 passed (32)`
### 綠
`node_modules/.bin/vitest run src/pages/Battle/kitchenHud.test.ts` → `Tests  32 passed (32)`
送 DONE 前跑全套：`node_modules/.bin/eslint .` exit 0；`node_modules/.bin/tsc -b --noEmit` exit 0；`node_modules/.bin/vitest run` → `Test Files 53 passed (53)  Tests 509 passed (509)`（含 babylon 同波還沒 commit 的改動）

**真資料實機**：
- 做法：worktree 用 `vite build --outDir /tmp/claude-1000/-home-bal-project-collect--worktrees-kitchenart/1dd27387-24c3-4ec8-b56c-2431706c3787/scratchpad/dist` 建置；`/tmp/claude-1000/-home-bal-project-collect--worktrees-kitchenart/1dd27387-24c3-4ec8-b56c-2431706c3787/scratchpad/hud.mjs` 用 Playwright `page.route` 直接讀 dist，不佔 port、不起 server。
- 頁內用 MutationObserver，在卡片掛上的當下把整個 HUD 複製起來凍結，再逐時點（0/100–150/200–300/…ms）截圖，並量離場卡和其他卡的重疊。
- 為什麼這樣做：swiftshader 截一張要好幾秒，直接截圖拍不到 350–600ms 的動畫。
- `idle` 1920×1080：
  - 修前：expired 那一格重疊 18915 px²。
  - 修後：6 次逾時全部重疊 0。
  - 訂單 id 穩定遞增，跨局也不重複（第二局從 10 起）。
  - 綠→黃→紅分級切換點正確（20s／10s）。
  - 分數 0 時逾時不浮字。
  - pageErrors 0、console error 0。
- `serve` 844×390（這個尺寸同時走手機版版面）：
  - 出餐：score 20、「出餐 1」；gone 判成 served；卡片打勾後飛出，下一張補位。
  - 之後兩次逾時各浮出 `-10`（分數 20→10→0），第三次逾時分數已是 0，不浮字，完全照契約。
  - 手機版：訂單卡縮成 64×40 膠囊、計時膠囊 140 寬、玩家卡隱藏、食譜收成圓鈕。
  - 玩家卡手持物槽即時顯示生菜。
- 截圖：
  - 修前：`/tmp/claude-1000/-home-bal-project-collect--worktrees-kitchenart/1dd27387-24c3-4ec8-b56c-2431706c3787/scratchpad/idle/d-fz4-expired-1-t{100,200}.png`
  - 修後逾時：`/tmp/claude-1000/-home-bal-project-collect--worktrees-kitchenart/1dd27387-24c3-4ec8-b56c-2431706c3787/scratchpad/idle2/d-fz4-new-4-t{120,330,390}.png`
  - 手機出餐：`/tmp/claude-1000/-home-bal-project-collect--worktrees-kitchenart/1dd27387-24c3-4ec8-b56c-2431706c3787/scratchpad/serveM2/d-fz2-served-1-t{150,450}.png`
  - 手機扣分浮字：`/tmp/claude-1000/-home-bal-project-collect--worktrees-kitchenart/1dd27387-24c3-4ec8-b56c-2431706c3787/scratchpad/exp/d-fz7-expired-3-t{200,390}.png`
- 新單滑入 back-out 正常，桌機與手機都有凍結截圖：`/tmp/claude-1000/-home-bal-project-collect--worktrees-kitchenart/1dd27387-24c3-4ec8-b56c-2431706c3787/scratchpad/idle2/d-fz1-new-2-*`、`/tmp/claude-1000/-home-bal-project-collect--worktrees-kitchenart/1dd27387-24c3-4ec8-b56c-2431706c3787/scratchpad/serveM2/d-fz1-new-2-*`。

## 自我審查
- 離場卡在 DOM 中排回原槽位，React key 仍是 `leave-<seq>`，在場卡仍用 id 當 key，補位時不會重新掛載、不會重播滑入。
- 移除離場卡的 setTimeout 與收合動畫同長，收合結束時寬度和間距都已是 0，移除那一刻不會跳。
- 最多同時 4 格（3 張在場＋1 張離場）：
  - 桌機 4×160×scale 仍在計時膠囊左邊。
  - 手機 4×70=280px，不碰右上計時。
- `prefers-reduced-motion`：沿用站台全域 `*` 規則（動畫 0.01ms），離場、收合都瞬間完成，紅框仍在。
- 全域約束：路徑用 `@/*`；樣式用 `@apply`（keyframes 以外）；只改 `.kitchen-*`，其他既有 class 零改動；沒有新圖檔、沒有新依賴；既有測試斷言沒動。

## 疑慮
- **站台浮動導覽列蓋住 HUD 頂列**（手機 844×390）：捲到畫布頂端時，`.floating-header` 會蓋住訂單膠囊與計時（`/tmp/claude-1000/-home-bal-project-collect--worktrees-kitchenart/1dd27387-24c3-4ec8-b56c-2431706c3787/scratchpad/serveM2/d-30-view.png`）。這屬於頁面版面（`src/components`，不是我的檔），bomber 應該也一樣；手機實際遊玩多半會按全螢幕鈕。是否處理請領導裁定。
- 桌機的出餐飛出沒有真資料截圖：1280 以上 swiftshader 只有 2–3fps，走位機器人到不了出餐口（場上 score 0）。桌機和手機的收合／浮字都走同一組 CSS 變數，桌機逾時路徑已經用真資料驗過。
