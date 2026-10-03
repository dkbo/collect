# 坦克美術＋可玩度（A Toy Army） — 波 4 審查（reviewer 切片）
你是本波的 reviewer：只讀、不改碼、不跑會寫入的指令。意見只給領導（`dk-msg leader`），不直接對 dev 說。

## 要讀的
1. 差異包 /home/bal/project/collect/.dkbo/tasks/2026-10-03-tankart/waves/4.diff（commit 清單、stat、-U10 diff；含未 commit 的工作樹）
2. 完整 brief /home/bal/project/collect/.dkbo/tasks/2026-10-03-tankart/brief.md（驗收標準、共用契約、所有權）
3. 本波成員：babylon(L) qa(M)

## 全域約束（全文，逐條當硬要求檢查）
- 路徑一律用 `@/*` 別名，不得用相對路徑引入（既有 `./tankNet` 這類同目錄引入改成 `@/` 亦可，不強制）。
- 自訂 CSS class 一律用 `@apply` 套 Tailwind；`src/index.css` 只准新增 `.tank-*` 前綴的 class，不得修改既有 class（含 `.bomber-*`、`.kitchen-*`）。
- 圖片只收 WebP，不得把 JPG／PNG 寫進 `src/`、`public/`；本任務不新增任何圖檔到 `src/`、`public/`，貼圖一律程式產生（DynamicTexture／頂點色），粒子重用 `public/battle/bomber/fx_*.webp` 原路徑（不搬、不改檔）；designer 的 webp 稿只放任務目錄 `design/`。
- 非同步請求與資料處理寫在 Zustand store action，元件只訂閱與調用。
- 不新增任何依賴：`package.json`、`pnpm-lock.yaml` 不改。
- Babylon 一律經 `src/babylon/babylonCore.ts` 深層匯入（eslint 已禁整包匯入），不用 `.pure` 版本；需要新副作用 import 才補在那裡。
- 不動共用網路層：`src/core/**`、`src/babylon/net/**`、`src/babylon/hud.ts` 只讀；坦克自己的訊息型別（`seed`／`bullet`／`hit`／`destroyed`／`item`／`pickup`／`shootReq`／`restartReq`）只准**新增**型別或在既有 payload **新增可選欄位**，不得刪改既有欄位；所有新收訊息照既有慣例先驗型別與範圍再用（`isObj`／`isNumIn`／`isOneOf`…，驗不過即丟棄、不 throw），且只信任房主廣播。
- 既有 `*.test.ts` 的斷言不得修改（`tankNet.test.ts` 全保持綠）；新純函式寫在 `src/babylon/games/tankFx/`，各附同目錄 `*.test.ts`，先寫紅測再實作。
- 既有數值不變：`SIM_HZ`、`CELL`、`GRID_W`／`GRID_H`、`MOVE_SPEED`、`TURRET_SPEED`、`BULLET_SPEED`、`BULLET_LIFETIME_MS`、`FIRE_COOLDOWN_MS`、`INIT_HP`、`CRATE_DROP_CHANCE`、既有三種道具效果；新數值一律用本 brief AC2 的具名常數。相機 α、β、fov 不調；半徑改 `38`、target 改 `(0, 0, -2)`（波 1 babylon 改，designer 實測現值 r28 時近側 2.5 排含 P1／P4 出生角在畫面外），其餘不調。
- 字型：數字用站內 Fredoka（`public/fonts/Fredoka-Bold.woff2`），中文用站內字型，不新增字型檔。
- `fx/` 共用模組只准**新增可選參數／新匯出**，bomber 與 kitchen 的呼叫端行為不變；坦克呼叫 `fx/quality`／`look`／`perfLog` 一律明傳 `key`／`tag: 'tank'`。

## 本任務累積的 Minor
（逐波審查不 triage 累積的 Minor；整枝評議才做）

上面每一條是先前各波放掉的風格／可讀性意見。逐條判：哪些**必須**在 merge 前修掉、
哪些可以留著。判定寫進報告的 `## Minor` 段開頭，一條一行。

## 報告寫到 /home/bal/project/collect/.dkbo/tasks/2026-10-03-tankart/state/reviewer-a.report.md，格式固定
## 規格合規
（逐條驗收標準 ✅/❌，缺漏寫明）
## Important
（會出錯、違反 brief 或契約、越界改檔；每條附 file:line）
## Minor
（風格、可讀性；每條附 file:line）

## 完成
state 檔 `status: done`，然後 `dk-msg leader "[DONE] review 波 4: Important N 條，見 report"`。
