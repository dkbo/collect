# qa 報告（波 3）

驗收對象：worktree `dk/toybox`（HEAD 8365629＋react-theme 波 3 未 commit 變更）。任務 base a4994aa。
- base：主樹 `docs/`（a4994aa 產物）→ `vite preview --port 5176`；AC14 另以 `git archive a4994aa` 解到 scratchpad 建置。
- worktree：`node_modules/.bin/vite build --outDir <SP>/dist --emptyOutDir` → `vite preview --port 5177`（照波 2 做法把主樹 `docs/godot/maps/*.json` 複製進 scratchpad dist；worktree 未寫任何檔）。
- `<SP>` = `/tmp/claude-1000/-home-bal-project-collect--worktrees-toybox/dba16f40-e20f-497a-8476-f15835dc7cd9/scratchpad`；波 2 截圖基準 `<SP2>` = `/tmp/claude-1000/-home-bal-project-collect--worktrees-toybox/cd8a27f6-104b-4b27-b6df-b47baf58a68b/scratchpad`。腳本沿用波 2（sweep／interact／func／games／bomber／homefull）。

## 做了什麼

### 逐條判定（AC2–AC15）
| AC | 判定 | 證據 |
|---|---|---|
| AC2 Token 與字型 | ✅ | tokens.json 17 個色彩逐一比對 `:root`／`.dark`：值全相同（line／focus 為 `var(--ink)` 別名、pop／on-fill／sky／mint／pink 深淺同值只寫在 `:root` 由 `.dark` 繼承）。`@theme inline`：`--color-focus`、三字族值照 AC、`--font-sans` 仍 Geist、`--radius-toy-*` 六個值正確、`--radius-sm/lg` 仍為 shadcn 算式、`--radius` 0.625rem 未改、`--container-site` 1200px、硬陰影 s/m/l（另有 xl、hard-action）、字級 13 個＋`button-s`（只增）。`index.html` Google Fonts link（Rubik／Noto Sans TC 500;700;900、VT323、display=swap）。body `bg-surface text-ink font-body`、`::selection` `bg-pop text-on-fill`。 |
| AC3 共用樣式與元件 | ✅ | 波 1 已驗收的 15 元件與 `tb-*` class 未減；本波只增（SectionHeader `as`、SegmentedControl `testId`、Handheld 無 onB 換張由 `Handheld.test.ts` 證明）；全路由畫面與波 2 一致（見 AC15）。 |
| AC4 CSS 組織（波 3 清除） | ✅ | `src/index.css` 已無 FLOATING NAVBAR／HOME PAGE／HERO SECTION／RESUME PAGE／RPG GAME ROOM／TODOS PAGE／UTILITY CLASSES 標題；`@import "./styles/toybox.css"` 在 L332（token／@theme 之後、CANDY CRUSH L408 之前）。我獨立重算：8365629 的 index.css 有、現在 index.css＋styles 都沒有的 class 共 86 個，逐一以完整 token 比對 `rg src index.html`，唯三命中 `active`／`completed`／`tag` 都是 JS 欄位、測試字串或 Tailwind `active:` 變體，沒有 className 引用 → 零引用，無須裁定。 |
| AC5–AC9 | ✅（回歸） | 全路由截圖與波 2 逐像素比對（見 AC15），版面無變；互動：選單 aria-expanded false→true→false、Handheld B 1/3→2/3→3/3、A→`#/candy-crush`、篩選 9/5/4/9 且 aria-pressed 正確，desktop／mobile console 無錯；AC7 功能腳本 base 5176 與 worktree 5177 輸出除 port 外完全相同（Todos 增改勾刪篩、Search 輸入／參數、NotFound 回首頁）。Battle 檔本波未動，大廳 6 種視窗截圖與波 2 只差標題字距；房間雙 context 流程未重跑（本波未分配 `firebase:battle`、Battle 檔無變更）。 |
| AC10 禁用樣式清零 | ✅ | 第一條：排除後 0 筆。第二條：`src/index.css` 全檔 `grep -cE` 13 = `tail -n +408` 13 = base（a4994aa，CANDY CRUSH L1029 起）13。 |
| AC11 深色 | ✅ | 12 路由深色截圖 `<html>.dark` 皆正確；sweep 自動抽樣（每頁 heading／body／action 3 組 × 6 視窗）最低 6.49:1，0 組低於門檻。 |
| AC12 響應式 | ✅ | 12 路由 × {1440 淺、1440 深、1024、768、390 淺、390 深} = 72 組：水平捲動 0、文字裁切 0（`<SP>/wt-sweep/sweep.json`）。首頁 768／390 Header 收合、Hero 堆疊、StatTile 2 欄、390 卡帶 1 欄（左緣 16）。 |
| AC13 零回歸 | ✅ | `DK_TEST_CMD` 全綠；凍結路徑 `git diff a4994aa` 0 行、無未追蹤；CandyCrush 只 `index.tsx`＋`CandyCrush.css`；Battle 只 AC9 七檔＋`Battle.css`；index.css CANDY CRUSH 到檔尾 md5 base＝wt＝`275ef212…`。遊戲畫面（1440 深色，base 5176 vs wt 5177）：糖果首屏（LEVEL 1、目標 1,500、步數 15、分數 0；盤面隨機）、Godot 載入完成（座標 X:472 Y:544）、RPG 首屏、炸彈超人單人開局倒數（0:40、存活 4/4、各卡 1/1/0）本體與 HUD 一致，bridge：糖果 READY/STATE、Godot READY/MAP_CHANGED/PLAYER_POS，errs 皆空（`<SP>/c-{candy,godot,rpg,bomber}.png`）。畫面區尺寸 944×548→973×550、Battle 1258→1111 寬照 11:33 ruling 接受。 |
| AC14 建置 | ✅ | worktree build 成功（9.08s）。主 CSS gzip（`gzip -c` 預設級）：base `index-CbXwqQu9.css` 40,981 B → wt `index-Bqrrh7rC.css` 38,410 B，**增量 −2,571 B**（≤ 15 KB）；vite 報告值 38.62 kB；`gzip -9`：40,293 → 37,896。raw 327,814 → 291,139。 |
| AC15 截圖 | ✅ | 見下節。 |

### AC15 截圖與「與波 2 一致」比對
- 每路由 `<SP>/wt-sweep/<route>-{1440-light,1440-dark,1024-light,768-light,390-light,390-dark}.png`；首頁整頁 `<SP>/wt-home/home-full-{1440,1024,768,390}-{light,dark}.png`；互動連拍 `<SP>/wt-interact/`（btn-primary／btn-secondary／cartridge 的 normal→hover→active→focus：陰影 5px→8px→0、focus `solid 3px`；seg-*；menu-0/1/2；hand-0/1-B/2-B/3-A）。與設計稿的對照差異同波 2 報告（本波版面無變）。
- 與波 2 截圖（`<SP2>/wt-sweep`）逐像素比（閾值 24）：
  - not-found 全部、home 390／768 首屏：0%。
  - 其餘一般頁與遊戲頁外框：0.2–1.9%，差異框全落在頁首 H1（`.tb-sechead__title` 補 `tracking-normal` 後字距變寬，`<SP>/d-resume.png`），屬本波指定變更。
  - home 1440／1024：Marquee 跑馬燈（動畫時間點）；整頁另有 3 個 SectionHeader 標題（同字距變更）。
  - candy-crush、miniGame：遊戲內容隨機／動畫。
  - directions 768 與 1440 深色第一輪 42–55%：Google 地圖第一輪沒載完（黑底），等 9 s 重拍兩輪都正常，1440 深色與波 2 目視一致（`<SP>/d-dir-dark.png`、`re-dir1/2`）。屬外部地圖載入時序，非回歸。

### BUG
無。

## 測試
### 紅
不適用: qa 不寫程式、不新增測試；本波沒有發現失敗項。
（對照組）node func.mjs 5176 base-func → 與 worktree 輸出除 port 外相同，用來證明功能腳本在 base 也會走出同一結果
### 綠
node_modules/.bin/eslint . && node_modules/.bin/tsc -b --noEmit && node_modules/.bin/vitest run → ESLINT-OK、TSC-OK、Test Files 99 passed (99)、Tests 1044 passed (1044)
vite build --outDir <SP>/dist → built in 9.08s；main css gzip 38,410 vs base 40,981（−2,571 B）
AC10 grep（排除規則照 brief）→ 0 筆；index.css 全檔 13 = tail 13 = base 13
git diff a4994aa -- src/babylon src/core godot-src godot-candy-src public src/pages/RpgRoom/data package.json pnpm-lock.yaml → 0 行；HUD 區段 md5 base＝wt
86 個被刪 class 逐一 rg → className 引用 0
node sweep.mjs 5177 wt-sweep "" 1440-light,1440-dark,1024-light,768-light,390-light,390-dark → {"n":72,"hscroll":[],"clipped":[]}，errs 只有 directions 的 Google Geocoding billing（base 同）；對比 min 6.49、低於門檻 0
node interact.mjs 5177 → 篩選 9/5/4/9、Handheld 1/3→2/3→3/3、A→#/candy-crush、選單 false→true→false，desktopErrs []、mobileErrs []
node func.mjs 5177 與 5176 → 除 port 外相同
node games.mjs／bomber.mjs 5176 與 5177 → errs []、bridge 訊息相同、HUD 數值相同
node homefull.mjs 5177 → 768/390 heroStacked、statCols 2、390 cardLefts 16

## 自我審查
- 「全路由截圖與波 2 一致」用像素比對＋差異框定位＋目視抽查（resume H1、home、directions、遊戲四張），沒有逐張目視 72 張。
- Battle 房間雙 context 流程（Firestore）本波沒重跑：`firebase:battle` 本波未分配給我，且 Battle 檔本波無變更；只靠大廳截圖＋單人炸彈超人回歸。
- 對比度用自動抽樣（每頁 3 組），非全元素。
- AC2 的 `shadow-action` 實際變數名是 `--shadow-hard-action`（波 1 已驗收沿用），未另判。

## 疑慮
- react-theme 疑慮中留給 react-shell 的收尾（`HeroSection.tsx:72` 空 `onB`、WorksSection 改用 SegmentedControl testId）目前不影響行為：Handheld B 鍵實測照常換張。
- 5176／5177 preview 已關。
