# 賽車美術＋可玩度（A Toy Racer） — 波 5 審查（reviewer 切片）
你是本波的 reviewer：只讀、不改碼、不跑會寫入的指令。意見只給領導（`dk-msg leader`），不直接對 dev 說。

## 要讀的
1. 差異包 /home/bal/project/collect/.dkbo/tasks/2026-10-03-raceart/waves/5.diff（commit 清單、stat、-U10 diff；含未 commit 的工作樹）
2. 完整 brief /home/bal/project/collect/.dkbo/tasks/2026-10-03-raceart/brief.md（驗收標準、共用契約、所有權）
3. 本波成員：babylon-rules(M) babylon(M)

## 全域約束（全文，逐條當硬要求檢查）
- 路徑一律用 `@/*` 別名，不得用相對路徑引入。
- 自訂 CSS class 一律用 `@apply` 套 Tailwind；`src/index.css` 只准新增 `.race-*` 前綴的 class，不得修改既有 class。
- 圖片只收 WebP，不得把 JPG／PNG 寫進 `src/`、`public/`；本任務不新增圖檔到 `src/`、`public/`，貼圖一律程式產生，粒子重用 `public/battle/bomber/fx_*.webp` 原路徑；designer 的 webp 稿只放任務目錄 `design/`。
- 非同步請求與資料處理寫在 Zustand store action，元件只訂閱與調用。
- 不新增任何依賴：`package.json`、`pnpm-lock.yaml` 不改。
- Babylon 一律經 `src/babylon/babylonCore.ts` 深層匯入，不用 `.pure` 版本；需要新副作用 import 才補在那裡。
- 不動共用網路層：`src/core/**`、`src/babylon/net/**`、`src/babylon/hud.ts` 只讀；賽車維持分散式所有權（每人本機模擬自己的車、`createOwnershipSync` 廣播），新訊息一律先驗型別與範圍（`isObj`／`isNumIn`／`isOneOf`…，驗不過即丟棄、不 throw），道具、命中、bot、結算只信任房主廣播。
- 純邏輯一律寫成純函式（`src/babylon/games/raceRules/**`、`raceFx/**`，HUD 格式化寫在 `src/pages/Battle/raceHud.ts`），各附同目錄 `*.test.ts`，先寫紅測再實作；既有 `*.test.ts` 的斷言不得修改。
- `fx/` 共用模組只准新增可選參數／新匯出，炸彈超人、廚房、坦克呼叫端行為不變；賽車呼叫 `fx/quality`／`look`／`perfLog` 一律明傳 `key`／`tag: 'race'`。
- 字型：數字用站內 Fredoka（`public/fonts/Fredoka-Bold.woff2`），中文用站內字型，不新增字型檔。
- 相機：可改成追尾相機並依 spec 調整距離與俯角（賽車需要），但不得改其他遊戲的相機。

## 本任務累積的 Minor
（逐波審查不 triage 累積的 Minor；整枝評議才做）

上面每一條是先前各波放掉的風格／可讀性意見。逐條判：哪些**必須**在 merge 前修掉、
哪些可以留著。判定寫進報告的 `## Minor` 段開頭，一條一行。

## 報告寫到 /home/bal/project/collect/.dkbo/tasks/2026-10-03-raceart/state/reviewer-a.report.md，格式固定
## 規格合規
（逐條驗收標準 ✅/❌，缺漏寫明）
## Important
（會出錯、違反 brief 或契約、越界改檔；每條附 file:line）
## Minor
（風格、可讀性；每條附 file:line）

## 完成
state 檔 `status: done`，然後 `dk-msg leader "[DONE] review 波 5: Important N 條，見 report"`。
