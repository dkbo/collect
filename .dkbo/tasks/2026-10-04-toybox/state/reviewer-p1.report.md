# toybox-reviewer-p1 報告（計畫審查 brief-review）

讀了 request.md、brief.md；另外為了查證幾條 AC 做不做得到，唯讀抽查了 `src/index.css`、`src/App.tsx`、`src/components/Layout.tsx:364`、`src/pages/CandyCrush/index.tsx`、`design/toybox-ds/04-implementation.md`、`03-components.md`。沒有改任何檔。

## 需求覆蓋
人要的東西逐條對照：
- 第 1 則「設計太有 AI 感、要大改」→ 目標＋全域約束「禁用樣式」＋AC10 ✅
- 第 2 則選「1 玩具／遊戲機風」、第 3 則 Design System → 目標指定 toybox-ds＋home-mockup 當依據，AC2–AC4 ✅
- 回答「全站一次改完：主題 token＋Layout＋首頁照 mockup 重做」→ AC2、AC5、AC6 ✅
- 「履歷、工具頁 … 全部換成 Toybox 元件語言」→ AC7（Resume／Todos／Search／Directions）、AC8（MapDeveloper）✅
- 「Battle 大廳、babylon 要進來改 Battle 頁 UI」→ AC9＋babylon 那一列 ✅
- 深色模式「保留，照 spec 的 Dark 值，主題切換鍵保留」→ AC11 ✅
- **❌（必改 1）「遊戲頁外框 全部換成 Toybox」漏了 `/candy-crush`。** 這個路由掛在 Layout 底下（`src/App.tsx` 的 `candy-crush` 那列），頁面外框（`candy-title` 漸層標題、`candy-subtitle`、`candy-tool-btn`、`rpg-cabinet` 外框，見 `src/pages/CandyCrush/index.tsx:111-126`）不是 HUD。可是全域約束把 `src/pages/CandyCrush/**` 整個劃成只讀，AC1 的頁面清單沒有它，AC8 沒有它，AC10 還把它排除在 grep 外。照這樣做完，全站只剩這一頁還是舊的 AI 感（粉紅漸層字），而且上面套的是新的 Header。更糟的是「頁面容器與樣式隔離」契約讓 Layout `<main>` 不再帶 `px-4`／`max-w-6xl`（現在是 `Layout.tsx:364`），每頁要自己包 `tb-container`；CandyCrush 只讀，包不了，390 寬會貼齊螢幕兩邊，AC12 在這個路由一定不過。
  改法二選一，請人決定：(a) AC1 加 CandyCrush 外框一節；AC8 加「CandyCrush 頁面外框（`index.tsx` 中 HUD／Overlays 以外的 JSX）」；所有權把 `src/pages/CandyCrush/index.tsx` 給 react-games，`CandyHud*`／`CandyOverlays`／`CandyStar` 仍只讀；AC10、AC13 的排除條件一起改。(b) 明確寫「candy-crush 外框本次不改」，再要求 react-shell 在 Layout 留一個 fallback：未遷移的路由（目前只有 candy-crush）`<main>` 仍套舊的 `px-4 max-w-6xl`，並加進 AC12 的驗收。

## 驗收標準可驗證性
- **❌（必改 2）AC2 會讓凍結的遊戲 HUD 走樣，跟目標第 8 行「遊戲內 HUD 零回歸」和 AC13 互相衝突。**
  - 圓角：AC2／契約把 `rounded-sm/md/lg/xl` 改成 8/14/18/26px。現在是 shadcn 算出來的值 `--radius: 0.625rem`（`src/index.css:81`、`171-174`），算出 6/8/10/14px。凍結區段（`src/index.css` 1029 行到檔尾）有 11 處 `rounded-lg`／`rounded-xl`（例如 `:782` 坦克名牌高 22px 卻用 `rounded-lg`，`:931` 賽車 `rounded-xl`），`src/pages/CandyCrush/CandyOverlays.tsx:195` 也有一處 `rounded-xl`。HUD 的 CSS「一字不改」，畫面照樣會變（`rounded-lg` 從 10px 變 18px，22px 高的名牌幾乎變成膠囊）。
  - 字型：凍結區段的 HUD 全部寫 `font-['Fredoka',_var(--font-sans)]`（例如 `:1052`、`:1204`）。Fredoka 沒有中文字，中文會退到 `--font-sans`。AC2 把它從 Geist 換成 Noto Sans TC，HUD 的中文字形就跟著變。另外 `src/babylon/fx/textures.ts:35` 的 canvas 字串寫的是 `Fredoka, "Noto Sans TC", sans-serif`，改成用 Google Fonts 載入 Noto Sans TC 以後，遊戲內貼圖上的中文也會換字形，AC13「遊戲畫面本體無差異」可能被誤判成不過。
  - 要請領導裁定（選 A／B，要記 ruling）：(A) 接受這兩種變化，AC13 明寫「HUD 圓角與中文字形隨全站 token 改變不算回歸」，qa 只比版面與數值。(B) 保留舊值，例如 toybox 圓角改用 `rounded-tb-*` 這類新名，或 react-theme 只在 `@theme` 新增、不覆寫 `--radius-*`／`--font-sans`；但這樣會動到契約名稱，契約要一起改。不管選哪個，AC2 都要寫清楚。
- **❌（必改 3）AC10 照字面判一定不過。**
  - `src/pages/Dashboard.tsx` 有禁用樣式，所有權那段又寫了「本任務不動」，但 AC10 的 grep 範圍 `src/pages` 沒排除它。請在 AC10 的排除條件加上 `src/pages/Dashboard.tsx`（或者改成順手刪掉這個檔，交給某一位成員）。
  - 「base 為 10」這個數字不對。用 AC10 同一條 regex 從 `src/index.css:1029`（CANDY CRUSH 標題）算到檔尾，`grep -cE` 是 **13 行**、`grep -oE | wc -l` 是 **14 個命中**。建議改寫成：「`tail -n +<CANDY CRUSH 行號> src/index.css | grep -cE '<regex>'` 等於全檔 `grep -cE` 的結果，且等於 base 的同一個數字」，括號裡的數字拿掉，或改成 13（行數）。
- **❌（必改 4）AC13「`git diff <base> -- src/pages/Battle` 只含 AC9 列出的檔」，可是 AC9 的檔名清單沒有 `Battle.css`。** babylon 那列和所有權都有這個檔。請在 AC9 的檔名清單補上 `src/pages/Battle/Battle.css`，不然 qa 照字面會判 AC13 不過。
- 其餘 AC 都判得出過或不過。小問題放在 Minor：AC3「15 個元件」沒列清單、AC6 數字磚的來源寫了「等」。

## 檔案所有權
- 成員之間的可改 glob 沒有重疊；獨佔資源 `dev:5174` 同時宣告在 react-theme（波 1、3）和 react-shell（波 2），但不在同一波，沒有衝突。`port:5175`、`firebase:battle`、`port:5176/5177` 都沒漏。
- `src/components/` 現在只有 `Layout.tsx` 和 `ui/button.tsx`，AC 要動的檔都有人擁有。AC3「其他 `ui/**` 元件改用 token」目前根本沒有對象（見 Minor）。
- **❌（必改 5）「頁面容器與樣式隔離」契約規定頁面 class 前綴用 `rpg-`／`godot-`，跟 index.css 現存的舊 class 撞名。** `rpg-cabinet`（`src/index.css:845`，在 RPG GAME ROOM 區段）現在同時被 RpgRoom、GodotGame 和只讀的 CandyCrush 使用。react-games 如果照契約在 `RpgRoom.css` 寫 `.rpg-cabinet`（或任何跟舊區段同名的 `rpg-*`），這份 CSS 由 lazy chunk 載入後會一直留在頁面上，覆蓋到 CandyCrush；波 3 也會因為 CandyCrush 還在引用，刪不掉舊區段。請在契約加一條：「新的頁面 class 不得跟 `src/index.css` 現存的 class 同名；遷移後的頁面改用新名稱（例如 `rpg-screen`），舊名稱留給未遷移的頁面」。如果必改 1 選 (a)，CandyCrush 也一起換掉 `rpg-cabinet`。

## 波次切法
- 順序合理。波 1 designer 跟 react-theme 並行，靠「先出 Battle、ScreenFrame、表單三節再 dk-msg 通知」加「暫定版再定稿」化解依賴；波 2 四位 dev 消費波 1 的契約；波 3 收尾刪舊區段。三份共用契約都有指定擁有者，波次也標了。
- 「頁面容器」契約的擁有者 react-shell 跟消費者同在波 2：react-shell 一拿掉 `<main>` 的 padding，其他三位還沒包 `tb-container` 的頁面會同時破版。因為形狀已經寫在契約裡，各自照著寫就行，**不算必改**；但建議請 react-shell 第一步先做 `<main>`＋`--layout-header-h`，做完 dk-msg 同波三位，免得他們截圖自查時看到別人造成的破版、白查一輪。
- 波 2 qa「AC5–AC12 逐條判定」包含 AC10，但 AC10 的 index.css 那半條（舊頁面區段裡的 `backdrop-blur`、hero orb 在 `src/index.css:447-552`）要等波 3 react-theme 刪掉才會歸零。建議波 2 qa 那列註明「AC10 只判第一條 grep，index.css 那條留到波 3」，免得送出必然的假 BUG。

## Minor
- AC3「toybox-ds 15 個元件」：`design/toybox-ds/components/` 有 17 個目錄（多了 SiteHeader、Cover、Icon），契約列的是其中 14 個再加 ScreenFrame。建議 AC3 直接列出 15 個名稱，並寫明 SiteHeader 的 class 由誰寫（react-theme 放進 `toybox.css`，還是 react-shell 放進 `Layout.css`）。
- AC3「其他 `ui/**` 元件改用 token」：`src/components/ui/` 目前只有 `button.tsx`，這半句沒有對象，可以刪掉，或改成「若有」。
- 契約的圓角清單沒有 `radius-pill`，可是 `03-components.md` 的 NavLink、StatusPill 都用到它（應該對應 `rounded-full`）；`header-h 76`、`page-pad` 也沒有對應的 utility。建議在 token 契約補一句對應關係，免得兩位 dev 各寫一套任意值。
- 契約的色彩列了 `focus`，可是 `04-implementation.md` §3 的 `@theme` 沒有 `--color-focus`。AC2 最好明寫要補上，全域約束裡「3px `focus` 外框」才有 utility 可以用（§5 寫的是 `outline-line`，值一樣，但名稱不一致）。
- AC6「4 個 StatTile 數字取自 `WORKS.length`／`GAME_CATALOG.length` 等現有來源」：另外兩個數字的來源請寫死，不然很容易出現全域約束禁止的虛構數字。
- 需求回答寫「約 4 波」，brief 是 3 波加 qa。不影響內容，結案 report 交代一句就好。
- AC12「無文字被裁切」比較主觀，可以加一個可量的定義：`scrollWidth > clientWidth` 的文字節點為 0（qa 用 shot.mjs evaluate）。

## 測試
### 紅
不適用: 計畫審查，沒有程式改動、沒有測試可跑
查證用的唯讀指令：`grep -cE '<AC10 regex>'`，對 `src/index.css` 1029 行起算 → 13 行／14 個命中（brief 寫 10）
### 綠
不適用: 計畫審查，沒有程式改動、沒有測試可跑
`grep -rlE '<AC10 regex>' src` → 命中名單裡有 `src/pages/Dashboard.tsx`（AC10 沒排除）

## 自我審查
每條必改都附了 brief 的段落和程式碼位置；數字是當場用 grep 算的。CandyCrush 該不該改是人的決定，我列出兩個選項，沒有替人選。

## 結論
要改 5 處
