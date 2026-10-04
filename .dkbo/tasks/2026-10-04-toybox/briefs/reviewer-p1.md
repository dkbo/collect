# 全站改版（DKBO Toybox 玩具機風） — 計畫審查（reviewer 切片）
你審的是**還沒開工的計畫**，不是程式碼，也不是差異包。只讀、不改任何檔（包含 brief）、
不派工、不寫程式。意見只給領導（dk-msg leader），不要直接對任何人說。

## 要讀的（就這兩份，依序）
1. 需求原文 /home/bal/project/collect/.dkbo/tasks/2026-10-04-toybox/request.md —— 人講的原話，領導逐字抄下來的
2. brief /home/bal/project/collect/.dkbo/tasks/2026-10-04-toybox/brief.md —— 領導的轉換產物

## 全域約束（全文）
- 路徑一律用 `@/*` 別名，不得用相對路徑引入（CSS 檔之間的 `@import "./styles/x.css"` 除外）。
- 自訂 CSS class 一律用 `@apply` 套 Tailwind；顏色、字級、圓角、陰影、間距只准用 toybox token 對應的 utility（`bg-pop`、`text-heading-m`、`shadow-hard-m`、`rounded-md`、`p-6`…），不得寫 `bg-[#…]`、`text-[#…]` 等任意色值；hex 只准出現在 `src/index.css` 的 token 定義（`:root`／`.dark`）與既有遊戲 HUD 區段。
- 圖片只收 WebP，不得把 JPG／PNG 寫進 `src/`、`public/`；本任務不新增圖檔，截圖沿用 `public/works/*.webp`。
- 非同步請求與資料處理寫在 Zustand store action，元件只訂閱與調用；本任務不新增 store 行為。
- 不新增任何依賴：`package.json`、`pnpm-lock.yaml` 不改。字型用 Google Fonts `<link>`（Rubik 500/700/900、Noto Sans TC 500/700/900、VT323 400，`display=swap`），寫在 `index.html`；現有 CSP 已允許 `fonts.googleapis.com`／`fonts.gstatic.com`，CSP 不改；移除 `@fontsource-variable/geist` 的 import（套件留在 package.json）。
- 禁用樣式：`purple-*`、`indigo-*`、`violet-*`、`fuchsia-*`、`bg-gradient-*`／`bg-linear-*`、漸層文字（`bg-clip-text`）、`backdrop-blur*`、`blur-[*]` 光暈、1px 灰框＋柔和陰影卡片；圖示不用 emoji，lucide 圖示 `strokeWidth={2.5}`。
- 互動狀態全站共用一套（toybox-ds `01-foundations.md` §6）：hover 浮起、active 陷入、focus-visible 3px `focus` 外框 offset 3px、disabled 灰化；`prefers-reduced-motion: reduce` 時關轉場。觸控目標 ≥ 44px。
- 文案沿用現有內容，不新增虛構數字或經歷；新增的按鈕與標題照 toybox-ds README「文案語氣」（動詞開頭、不加驚嘆號、點陣眉標只用英數）。
- 遊戲本體只讀：`src/babylon/**`、`src/core/**`、`godot-src/**`、`godot-candy-src/**`、`public/**`、`src/pages/RpgRoom/data/**`、`src/pages/CandyCrush/**`、`src/pages/Battle/` 的 `*Hud.tsx`／`*Hud.ts`／`touchDirs.ts`；`src/index.css` 中「CANDY CRUSH」區段起到檔尾的遊戲 HUD 樣式（candy／bomber／kitchen／tank／race）一字不改。
- 既有 `*.test.ts` 的斷言不得修改；`src/pages/Home/works.ts` 仍是作品清單單一來源。
- dev server 一律直呼 `node_modules/.bin/vite --port <埠> --strictPort`，不跑 `pnpm dev`／`pnpm build`；截圖用 `node .claude/skills/verify-web/scripts/shot.mjs`，截圖與暫存檔只寫 scratchpad。

你不需要讀專案程式碼。你要回答的是「這份計畫做出來會不會是人要的東西」，
不是「這段碼寫得好不好」。每條意見都要指名 brief 的哪一段或波次表的哪一列。

## 報告寫到 /home/bal/project/collect/.dkbo/tasks/2026-10-04-toybox/state/reviewer-p1.report.md，格式固定
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
