# react-pages 報告（波 2）
## 做了什麼
AC7 的 Resume、Todos、Search、Directions 四頁依 pages-spec §0／§2／§7–§10 改成 toybox 樣式；NotFound 歸 react-shell，不在本切片。
- 四頁根節點都改成 `tb-container <頁>-page`（`pt-12 pb-18`，手機 `pt-8 pb-12`），PageHead 用 `tb-sechead` 的 class 自組 `<h1>`＋點陣眉標（PLAYER PROFILE／TO DO LIST／SEARCH／ROUTE PLANNER）。
- 每頁的 class 只寫在自己的 CSS（`Resume.css`／`Todos.css`／`Search.css`／`Directions.css`），檔首 `@reference "../../index.css";`、TSX 用 `@/pages/<頁>/<頁>.css` 載入；前綴是 `resume-`／`todos-`／`search-`／`dir-`。index.css 舊的 `resume-card`／`timeline-*`／`todo-*` 這四頁已經不再引用，波 3 可以刪。
- Resume：五張 `resume-panel`（About 卡頭是黃條 P1，其他依序 BIO／STATS／LOG／SKILLS）；頭像改硬框加 tilt-1；StatusPill；能力環改 ink／surface-sunken、butt 端點；資訊格加 IconBox，只有 Email 可點（`tb-lift-s`）；人物介紹改 01–04 編號列；狀態圖下方用 Tag；經歷改 `resume-timeline`；技能 Tag 依權重配色。新增 `skills.ts`（技能資料、`skillTagStyle`、`CHART_TONE`）與 `PanelHead.tsx`。相對 import 全部改成 `@/`。
- Todos：Clear 鈕改 Button s secondary；輸入框是 `tb-input`＋Button primary s；篩選是 NavLink 套 `tb-seg`／`tb-seg__opt`，用 `aria-current` 顯示選中；EMPTY 空狀態；列改 `todos-item`，進場／離場 keyframes 改名為 `todos-li-in`／`out` 搬進 Todos.css，motion-reduce 時關閉；勾選方塊完成時是 mint＋Check；編輯／刪除是 size-9 IconButton。
- Search：搜尋框 `tb-input h-13`＋IconButton 清除鈕；推薦關鍵字改成可點的 plain Tag（44 高）；歡迎狀態加 IconBox；結果欄改 `lg:` 兩欄；結果卡不可點，標題底線 hover；維基卡加 01… 序號；骨架、錯誤提示條（pink）、無結果都已改。
- Directions：新增 PageHead；`dir-map` 外框的高度是 `calc(100dvh - var(--layout-header-h,80px) - 14rem)`、最小 480px；控制盒、輸入框、錯誤條、導航面板、文字模式、innerHTML 標記與對話泡、InfoWindow 都改成 `dir-` class，三位講者的彩色字拿掉。
- 行為：store、handler、data-testid、路由、Google Maps 邏輯都沒動。

## 測試
### 紅
node_modules/.bin/vitest run src/pages/Resume/skills.test.ts
FAIL  |pages| src/pages/Resume/skills.test.ts [ src/pages/Resume/skills.test.ts ]
Error: Cannot find package '@/pages/Resume/skills' imported from .../src/pages/Resume/skills.test.ts
### 綠
node_modules/.bin/vitest run src/pages/Resume/skills.test.ts
Test Files  1 passed (1)
Tests  5 passed (5)

全套（送 DONE 前跑過一次）：
node_modules/.bin/eslint . → 0 錯；node_modules/.bin/tsc -b --noEmit → 乾淨；node_modules/.bin/vitest run → Test Files 97 passed、Tests 1025 passed。
AC10 第一條限定在四頁目錄：`grep -rnE '(purple|indigo|violet|fuchsia)-[0-9]|bg-(gradient|linear)-|bg-clip-text|backdrop-blur|blur-\[' src/pages/{Resume,Todos,Search,Directions}` → 0 筆。
自查截圖（用 react-shell 的 5174，檔案在 scratchpad：/tmp/claude-1000/-home-bal-project-collect--worktrees-toybox/dd3e5b98-df6a-41b8-af08-5f2bb52ba2a5/scratchpad）：
- `<頁>-1440.png`（淺色整頁）、`<頁>-1440-dark.png`、`<頁>-390.png`，頁名是 resume／todos／search／directions。
- 用 shot.mjs evaluate 量：四頁在 1440 和 390 寬都是 `scrollWidth == innerWidth`，沒有水平捲動。裁字掃描第一輪抓到 `resume-ring__label`（390 寬）和 `search-card__desc` 兩處，已經改成換行／break-words。
- 截圖發現三個問題已修：#root 的 text-align:center 被繼承（頁根加 text-left）；深色模式 About 黃條的標題是淺字（改成指定 on-fill，量到 rgb(23,20,15)）；第一輪並跑截圖時 Todos 列還在進場動畫，改成依序跑後重截正常。

## 自我審查
- 規格對照：§0 骨架、§2 控制項、§7–§10 都逐條做了。PageHead 的 h1 用 `tb-sechead__title`（波 3 會補字距修正）。
- 互動狀態：可點物件只掛 `tb-lift-s`／元件自帶的。有兩處陰影原本寫成 utility，會蓋掉 hover／active，已移進 components 層的單一 class（`resume-info__link`、`search-chip`）。清除鈕原本用 translate 置中，跟 lift 衝突，改成 `inset-y-0 my-auto`。
- 合併 className 沒用到 `cn`／`tbCn`，只有 clsx 串固定 class，沒有 utility 互蓋的問題。
- Resume 的 `animate-on-scroll` 沿用 index.css 的通用動畫（hook 已處理 reduced-motion）。整頁截圖時視窗外的卡還沒觸發，所以是空白，這是原本就有的行為。

## 疑慮
- Directions 的 `darkMapStyles` 是 Google Maps 的 JS 樣式資料，裡面有 slate 系 hex。這不是 CSS class，而且屬於「行為不變」的範圍，所以沒改。全域約束「hex 只准在 index.css」如果要連 JS 地圖樣式一起算，請領導裁定要不要換成 toybox 色值。
- 技能 Tag 的 data-testid 加在 `display: contents` 的外層 span 上，因為 Tag 元件不收 data-*。testid 名稱沒變，但節點換成外層 span 了。
- Todos 的編輯與刪除 IconButton 是 size-9（規格例外：列高 min-h-13 補足觸控區）。
- 全套 vitest 中途出現過 react-games 進行中的 `RpgRoom/lib/gameFrames.test.ts` 紅燈，不是我的檔。送 DONE 前重跑是全綠。

## 修復（review 2 Important 1：觸控目標要 ≥44px）
- 根因：照 pages-spec 的 size-9 做，但 brief 規定觸控 ≥44px，而 brief 優先於 pages-spec。
- Todos.css：編輯框 `h-9` 改 `h-11`；`.todos-iconbtn` 拿掉 `size-9`，改用 tb-iconbtn 本身的 size-11，只把圖示縮到 16px。
- Search.css：清除鈕拿掉 `size-9`（改用 size-11），位置改 `right-1.5`；輸入框右側留白 `pr-14` 改 `pr-15`。
- 順手處理 reviewer 的疑慮：`.todos-item` 原生的 `animation:` 移到 `@apply … motion-reduce:animate-none` 前面，確保 reduced-motion 時關得掉。
- 驗證（390 寬，shot.mjs evaluate）：清除鈕 44×44，跟輸入框上下各留 4px；Todos 兩顆鈕都是 [44,44]；編輯框 44 高；`scrollWidth` 是 390，沒有水平捲動。截圖存在 scratchpad 的 `todos-fix-390.png` 和 `search-fix-390.png`。
- 全套：eslint 0 錯、tsc 乾淨、vitest 全綠。
