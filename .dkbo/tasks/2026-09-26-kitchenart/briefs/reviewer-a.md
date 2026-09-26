# 廚房快手美術優化（A Toy Kitchen） — 波 task 審查（reviewer 切片）
你是本波的 reviewer：只讀、不改碼、不跑會寫入的指令。意見只給領導（`dk-msg leader`），不直接對 dev 說。

## 要讀的
1. 差異包 /home/bal/project/collect/.dkbo/tasks/2026-09-26-kitchenart/waves/task.diff（commit 清單、stat、-U10 diff；含未 commit 的工作樹）
2. 完整 brief /home/bal/project/collect/.dkbo/tasks/2026-09-26-kitchenart/brief.md（驗收標準、共用契約、所有權）
3. 本波成員：

## 全域約束（全文，逐條當硬要求檢查）
- 路徑一律用 `@/*` 別名，不得用相對路徑引入。
- 自訂 CSS class 一律用 `@apply` 套 Tailwind；`src/index.css` 只准新增 `.kitchen-*` 前綴的 class，不得修改既有 class（含 `.bomber-*`）。
- 圖片只收 WebP，不得把 JPG／PNG 寫進 `src/`、`public/`；本任務不新增任何圖檔，貼圖一律程式產生（DynamicTexture／頂點色），粒子重用 `public/battle/bomber/fx_*.webp` 原路徑（不搬、不改檔）。
- 非同步請求與資料處理寫在 Zustand store action，元件只訂閱與調用。
- 不新增任何依賴：`package.json`、`pnpm-lock.yaml` 不改。
- Babylon 一律經 `src/babylon/babylonCore.ts` 深層匯入（eslint 已禁整包匯入），不用 `.pure` 版本；需要新副作用 import 才補在那裡。
- 不動多人同步：`src/core/**`、`src/babylon/net/**` 只讀；overcooked 的快照訊息與 `KitchenView` 形狀不變；`overcookedKitchen.ts` 只准改 AC2 那一處取湯條件；外插等新純函式寫在 `kitchenFx/`。
- 遊戲規則與數值不變：`ROUND_MS`、`CHOP_MS`、`COOK_MS`、`OVERCOOK_MS`、`ORDER_LIFE_MS`、`ORDER_EVERY_MS`、`MAX_ORDERS`、`SCORE_*`、`RECIPES`、`STATIONS`、格數；相機 β、fov、半徑、跟隨不調。
- 字型：數字用站內 Fredoka（`public/fonts/Fredoka-Bold.woff2`），中文用站內字型，不新增字型檔。
- `src/babylon/hud.ts` 不改（`createCountdownPanel` 已收 `opts.theme`）。
- 既有 `*.test.ts` 的斷言不得修改；AC1 搬移時只准改 import 路徑（`git diff -M` 看得出是 rename＋import 行）。
- 待裁決 12 條採使用者 2026-09-26 回「ok」的建議（見 request.md）：①A；②抽 `src/babylon/fx/`；③共用 `setHud` 加 `kind` 標記的聯集、不另開通道；④盤子只做外觀；⑤HUD 照實顯示（見 AC7）；⑥快焦用現有 progress 判定、不改協定、補單測；⑦依 `ctx.players` 序號固定 4 色；⑧不做結算星數；⑨粒子貼圖沿用 `public/battle/bomber/`；⑩相機不調；⑪`vendor-babylon` gzip 增量 ≤ 10 KB、遊戲程式（`Battle-*.js`）gzip 增量 ≤ 25 KB；⑫取湯 bug 併第一波修。

## 本任務累積的 Minor
- minor 1: fx/perfLog.ts 加 tag 後 git diff -M 判成刪除＋新增，失去 follow 歷史 src/babylon/fx/perfLog.ts:1
- minor 1: isReady 對 burnt 恆真屬冗餘；applyUse 在 tick 前 ≤1 幀窗口可取到 soup src/babylon/games/overcookedKitchen.ts:192
- minor 1: 刪 colorFor 後留連續兩個空行 src/babylon/games/overcooked.ts:148
- minor 1: kitchenRoster 以 i % len 重算，未重用 colorIndexIn src/babylon/games/kitchenFx/players.ts:23
- minor 1: R 鍵監聽未排除 input/textarea/contentEditable 焦點 src/pages/Battle/KitchenHud.tsx:329
- minor 1: export default KitchenHud 無人用且與型別同名 src/pages/Battle/KitchenHud.tsx:352
- minor 1: fx 共用模組預設 key/tag 為 bomber，kitchen 漏傳會悄悄讀 bomberTier src/babylon/fx/quality.ts:1
- minor 2: KITCHEN 牌建構時即用 Fredoka 畫，未等字型載入 src/babylon/games/kitchenFx/textures.ts:207
- minor 2: setSlot 每幀重寫 matrix 且鍋分支每幀 new Color3 src/babylon/games/kitchenFx/board.ts:323
- minor 2: chopTarget 手上有物也轉向砧板 src/babylon/games/overcooked.ts:191
- minor 2: 面板與開局倒數仍在主相機、會過 ACES/bloom，波 3 倒數需掛 uiCamera src/babylon/games/overcooked.ts:340
- minor 2: kitchenPerfFill 偵錯參數會進 production src/babylon/games/overcooked.ts:335
- minor 2: 砧板尺寸為 spec §5 的兩倍未說明 src/babylon/games/kitchenFx/models.ts:51
- minor 2: 鈴以強度 0 進 Glow 白名單會遮擋出餐窗光暈 src/babylon/games/kitchenFx/board.ts:241
- minor 2: 盤架格用寫死 cx===6&&cy===0 與魔數 fallback src/babylon/games/kitchenFx/board.ts:144
- minor 3: setGlow 移出白名單至空時 GlowLayer 全 mesh 發光（併入修復） src/babylon/fx/look.ts:228
- minor 3: 「!」章位置寫死 x - cell*0.75 假設鍋在右排 src/babylon/games/kitchenFx/effects.ts:239
- minor 3: squashBoard 與 setSlot 每幀整批重寫 thin instance 矩陣 src/babylon/games/kitchenFx/board.ts:397
- minor 3: bomberFx/textures 以 re-export 轉出 fx/textures 多一層 src/babylon/games/bomberFx/textures.ts:10
- minor 3: 對 kitchenFx/board 兩行 import 可合併 src/babylon/games/overcooked.ts:46
- minor 3: served()/landRing() 自取 performance.now 與 update(now) 時間源不一致 src/babylon/games/kitchenFx/effects.ts:355
- minor 3: 兩批 gone 600ms 內接連時插回槽位可能差一格 src/pages/Battle/kitchenHud.ts:106
- minor 3: guest 開局前幾幀 HUD 可能閃上一局分數與 0:00 src/babylon/games/overcooked.ts:692
- minor 3: 1920×1080 食譜面板蓋 (10,2) 鍋進度環一角（交 qa 判） src/pages/Battle/KitchenHud.tsx:1

上面每一條是先前各波放掉的風格／可讀性意見。逐條判：哪些**必須**在 merge 前修掉、
哪些可以留著。判定寫進報告的 `## Minor` 段開頭，一條一行。

## 報告寫到 /home/bal/project/collect/.dkbo/tasks/2026-09-26-kitchenart/state/reviewer-a.report.md，格式固定
## 規格合規
（逐條驗收標準 ✅/❌，缺漏寫明）
## Important
（會出錯、違反 brief 或契約、越界改檔；每條附 file:line）
## Minor
（風格、可讀性；每條附 file:line）

## 完成
state 檔 `status: done`，然後 `dk-msg leader "[DONE] review 波 task: Important N 條，見 report"`。
