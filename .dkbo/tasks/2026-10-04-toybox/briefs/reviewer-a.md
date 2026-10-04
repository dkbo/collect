# 全站改版（DKBO Toybox 玩具機風） — 波 4 審查（reviewer 切片）
你是本波的 reviewer：只讀、不改碼、不跑會寫入的指令。意見只給領導（`dk-msg leader`），不直接對 dev 說。

## 要讀的
1. 差異包 /home/bal/project/collect/.dkbo/tasks/2026-10-04-toybox/waves/4.diff（commit 清單、stat、-U10 diff；含未 commit 的工作樹）
2. 完整 brief /home/bal/project/collect/.dkbo/tasks/2026-10-04-toybox/brief.md（驗收標準、共用契約、所有權）
3. 本波成員：react-games(M) react-shell(M)

## 全域約束（全文，逐條當硬要求檢查）
- 路徑一律用 `@/*` 別名，不得用相對路徑引入（CSS 檔之間的 `@import "./styles/x.css"` 除外）。
- 自訂 CSS class 一律用 `@apply` 套 Tailwind；顏色、字級、圓角、陰影、間距只准用 toybox token 對應的 utility（`bg-pop`、`text-heading-m`、`shadow-hard-m`、`rounded-toy-md`、`p-6`…），不得寫 `bg-[#…]`、`text-[#…]` 等任意色值；hex 只准出現在 `src/index.css` 的 token 定義（`:root`／`.dark`）與既有遊戲 HUD 區段。
- 圖片只收 WebP，不得把 JPG／PNG 寫進 `src/`、`public/`；本任務不新增圖檔，截圖沿用 `public/works/*.webp`。
- 非同步請求與資料處理寫在 Zustand store action，元件只訂閱與調用；本任務不新增 store 行為。
- 不新增任何依賴：`package.json`、`pnpm-lock.yaml` 不改。字型用 Google Fonts `<link>`（Rubik 500/700/900、Noto Sans TC 500/700/900、VT323 400，`display=swap`），寫在 `index.html`；現有 CSP 已允許 `fonts.googleapis.com`／`fonts.gstatic.com`，CSP 不改；`@fontsource-variable/geist` 的 import 與 `--font-sans` 保留不動（凍結的遊戲 HUD 以 `var(--font-sans)` 當中文退路）；toybox 內文字族另名 `--font-body`。
- 禁用樣式：`purple-*`、`indigo-*`、`violet-*`、`fuchsia-*`、`bg-gradient-*`／`bg-linear-*`、漸層文字（`bg-clip-text`）、`backdrop-blur*`、`blur-[*]` 光暈、1px 灰框＋柔和陰影卡片；圖示不用 emoji（例外：Battle 觸控動作鍵的文字來自凍結的 `TOUCH_ACTIONS` 資料，照原樣顯示），lucide 圖示 `strokeWidth={2.5}`。
- 互動狀態全站共用一套（toybox-ds `01-foundations.md` §6）：hover 浮起、active 陷入、focus-visible 3px `focus` 外框 offset 3px、disabled 灰化；`prefers-reduced-motion: reduce` 時關轉場。觸控目標 ≥ 44px（唯一例外：疊在遊戲畫面內、與凍結 HUD 共位的浮鈕如全螢幕鈕，維持 `size-9`，見 pages-spec §1／§4）；新增或改寫的按鈕用 `@/components/toybox` 的 `Button`／`IconButton`，不用 `ui/button` 的小尺寸；toybox 元件的 `href` 不傳 `#錨點`（捲動用 onClick）。
- 文案沿用現有內容，不新增虛構數字或經歷；新增的按鈕與標題照 toybox-ds README「文案語氣」（動詞開頭、不加驚嘆號、點陣眉標只用英數）。
- 遊戲本體只讀：`src/babylon/**`、`src/core/**`、`godot-src/**`、`godot-candy-src/**`、`public/**`、`src/pages/RpgRoom/data/**`、`src/pages/CandyCrush/` 中 `index.tsx` 以外的檔、`src/pages/Battle/` 的 `*Hud.tsx`／`*Hud.ts`／`touchDirs.ts`；`src/index.css` 中「CANDY CRUSH」區段起到檔尾的遊戲 HUD 樣式（candy／bomber／kitchen／tank／race）一字不改。
- 合併含 toybox utility（字級、`shadow-hard-*`、`rounded-toy-*`、`max-w-site`）的 className 一律用 `tbCn`（`@/components/toybox/cn`），不用 `@/lib/utils` 的 `cn`（會靜默吃掉 toybox token）；波 3 起兩者統一。
- 既有 `*.test.ts` 的斷言不得修改；`src/pages/Home/works.ts` 仍是作品清單單一來源。
- dev server 一律直呼 `node_modules/.bin/vite --port <埠> --strictPort`，不跑 `pnpm dev`／`pnpm build`；截圖用 `node .claude/skills/verify-web/scripts/shot.mjs`，截圖與暫存檔只寫 scratchpad。

## 本任務累積的 Minor
（逐波審查不 triage 累積的 Minor；整枝評議才做）

上面每一條是先前各波放掉的風格／可讀性意見。逐條判：哪些**必須**在 merge 前修掉、
哪些可以留著。判定寫進報告的 `## Minor` 段開頭，一條一行。

## 報告寫到 /home/bal/project/collect/.dkbo/tasks/2026-10-04-toybox/state/reviewer-a.report.md，格式固定
## 規格合規
（逐條驗收標準 ✅/❌，缺漏寫明）
## Important
（會出錯、違反 brief 或契約、越界改檔；每條附 file:line）
## Minor
（風格、可讀性；每條附 file:line）

## 完成
state 檔 `status: done`，然後 `dk-msg leader "[DONE] review 波 4: Important N 條，見 report"`。
