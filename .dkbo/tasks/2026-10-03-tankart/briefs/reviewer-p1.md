# 坦克美術＋可玩度（A Toy Army） — 計畫審查（reviewer 切片）
你審的是**還沒開工的計畫**，不是程式碼，也不是差異包。只讀、不改任何檔（包含 brief）、
不派工、不寫程式。意見只給領導（dk-msg leader），不要直接對任何人說。

## 要讀的（就這兩份，依序）
1. 需求原文 /home/bal/project/collect/.dkbo/tasks/2026-10-03-tankart/request.md —— 人講的原話，領導逐字抄下來的
2. brief /home/bal/project/collect/.dkbo/tasks/2026-10-03-tankart/brief.md —— 領導的轉換產物

## 全域約束（全文）
- 路徑一律用 `@/*` 別名，不得用相對路徑引入（既有 `./tankNet` 這類同目錄引入改成 `@/` 亦可，不強制）。
- 自訂 CSS class 一律用 `@apply` 套 Tailwind；`src/index.css` 只准新增 `.tank-*` 前綴的 class，不得修改既有 class（含 `.bomber-*`、`.kitchen-*`）。
- 圖片只收 WebP，不得把 JPG／PNG 寫進 `src/`、`public/`；本任務不新增任何圖檔到 `src/`、`public/`，貼圖一律程式產生（DynamicTexture／頂點色），粒子重用 `public/battle/bomber/fx_*.webp` 原路徑（不搬、不改檔）；designer 的 webp 稿只放任務目錄 `design/`。
- 非同步請求與資料處理寫在 Zustand store action，元件只訂閱與調用。
- 不新增任何依賴：`package.json`、`pnpm-lock.yaml` 不改。
- Babylon 一律經 `src/babylon/babylonCore.ts` 深層匯入（eslint 已禁整包匯入），不用 `.pure` 版本；需要新副作用 import 才補在那裡。
- 不動共用網路層：`src/core/**`、`src/babylon/net/**`、`src/babylon/hud.ts` 只讀；坦克自己的訊息型別（`seed`／`bullet`／`hit`／`destroyed`／`item`／`pickup`／`shootReq`／`restartReq`）只准**新增**型別或在既有 payload **新增可選欄位**，不得刪改既有欄位；所有新收訊息照既有慣例先驗型別與範圍再用（`isObj`／`isNumIn`／`isOneOf`…，驗不過即丟棄、不 throw），且只信任房主廣播。
- 既有 `*.test.ts` 的斷言不得修改（`tankNet.test.ts` 全保持綠）；新純函式寫在 `src/babylon/games/tankFx/`，各附同目錄 `*.test.ts`，先寫紅測再實作。
- 既有數值不變：`SIM_HZ`、`CELL`、`GRID_W`／`GRID_H`、`MOVE_SPEED`、`TURRET_SPEED`、`BULLET_SPEED`、`BULLET_LIFETIME_MS`、`FIRE_COOLDOWN_MS`、`INIT_HP`、`CRATE_DROP_CHANCE`、既有三種道具效果；新數值一律用本 brief AC2 的具名常數。相機 β、fov、半徑不調。
- 字型：數字用站內 Fredoka（`public/fonts/Fredoka-Bold.woff2`），中文用站內字型，不新增字型檔。
- `fx/` 共用模組只准**新增可選參數／新匯出**，bomber 與 kitchen 的呼叫端行為不變；坦克呼叫 `fx/quality`／`look`／`perfLog` 一律明傳 `key`／`tag: 'tank'`。

你不需要讀專案程式碼。你要回答的是「這份計畫做出來會不會是人要的東西」，
不是「這段碼寫得好不好」。每條意見都要指名 brief 的哪一段或波次表的哪一列。

## 報告寫到 /home/bal/project/collect/.dkbo/tasks/2026-10-03-tankart/state/reviewer-p1.report.md，格式固定
## 需求覆蓋
（逐條對照 request：人要的每一件事，brief 有沒有對應的驗收標準？
  漏的列出來，指明 request 的哪一段沒有被接住）
## 驗收標準可驗證性
（逐條 AC：能不能明確判定過或不過？不能的指出來，並給一個可驗證的改寫）
## 檔案所有權
（成員之間有無重疊或遺漏？有沒有哪條 AC 要動的檔沒有任何人擁有？獨佔資源欄有無漏）
## 波次切法
（順序合理嗎？同一波裡有沒有人其實要等另一個人的產出？共用契約有沒有指定擁有者）
## Minor
（其餘建議）
## 結論
一行，只能是 `可以開工` 或 `要改 N 處`（N = 前四段裡你認為**必須**改的條數）

## 完成
state 檔 `status: done`，然後
dk-msg leader "[DONE] brief-review: <可以開工|要改 N 處>，見 report"
