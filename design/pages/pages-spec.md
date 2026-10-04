# 頁面設計稿規格（pages-spec）

設計依據：`toybox-ds/`（tokens、15 元件）與 `home-mockup/Main.dc.html`。衝突時 brief ＞ 本檔 ＞ toybox-ds。
每頁一節，對應稿 `design/pages/page-<route>.webp`（1440 寬；首頁另有 390／深色／選單展開）。稿的原始檔 `design/pages/page-<route>.pen`，由 `node design/pages/.src/build.mjs <name>` 經 `pen interactive` 的 execute 重畫（`.src/prelude.js` 是元件畫法，`.src/pages/*.js` 是各頁）。稿中藍底白字的小籤是標註，不是介面。

**寫法約定**（全檔通用，下文不再重述）

- 一律寫 Tailwind utility 名，全部來自共用契約「Toybox token 與 utility」：色 `bg-surface`／`text-ink-muted`／`border-line`…、字 `text-heading-m`、圓角 `rounded-toy-md`、陰影 `shadow-hard-m`、字族 `font-display`／`font-body`／`font-pixel`。間距寫 Tailwind 刻度（`p-6` = `space-6` 24px）。外框 `border-2`（s）／`border-3`（m）／`border-4`（l）。控制項高 `h-11`（44）／`h-13`（52）。
- 「元件」指 `@/components/toybox` 的 React 元件，名字與 toybox-ds 相同；「頁面專屬」是該頁同名 CSS 裡用 `@apply` 寫的 class，前綴依共用契約（`battle-`、`todos-`…）。下文寫頁面專屬 class 時用建議名，擁有者可改名但前綴不可改。
- 互動狀態一律掛 `tb-lift`（大物件）或 `tb-lift-s`（44px 小物件），不另寫 hover／active。不可點的物件（面板、提示條、清單列）沒有陰影位移。
- 點陣字（`font-pixel`）只放英數；需要中文的眉標、徽章改 `text-caption`。
- 深色：除非該節另寫「深色差異」，深色只靠 token 自動切換（墨線與硬陰影變米白、色塊上的字維持 `on-fill`），不需另寫 `dark:` class。

## 0. 共用頁面骨架（所有非首頁路由）

```
SiteHeader（Layout，全寬）
tb-container ─ 頁首 PageHead ─ 內容 ─
Footer（Layout，全寬）
```

| 部位 | 規格 |
| --- | --- |
| 外層 | `tb-container`，上 `pt-12`（48）手機 `pt-8`（32）；下 `pb-18`（72）手機 `pb-12`（48）；直排 `flex flex-col gap-8`（標題到內容 32） |
| PageHead | 用 SectionHeader 的版式（`tb-sechead`），**標題改 `<h1>`**：若 SectionHeader 元件只輸出 `h2`，頁面以同一組 class 自組 `<h1 class="tb-sechead__title">`。眉標 `font-pixel text-pixel-m text-ink-muted`「— 英文 —」；標題 `text-display-l`（手機 34/40）；右側可放一顆 Button s 或 SegmentedControl |
| 導言 | 標題下 `text-body text-ink-muted max-w-2xl`，在 PageHead 內與標題 `gap-2`（沿用現有文案） |
| 工具頁內容物件 | `bg-surface-raised border-3 border-line rounded-toy-lg shadow-hard-m p-6`（手機 `p-5`）；不可點，故無 `tb-lift` |

## 1. 遊戲畫面外框 ScreenFrame（`tb-screen`）

套用頁：Battle（Room 開局、SoloGame）、MiniGame、GodotGame、RpgRoom、CandyCrush、MapDeveloper（編輯畫布）。元件 `ScreenFrame { title, meta?, className?, children }`。

```
┌─ tb-screen ─────────────────────────────────── border-4 rounded-toy-md bg-inverse shadow-hard-l
│  NOW PLAYING                     TANK · SOLO   ← 標題列 font-pixel text-pixel-m；左 text-pop、右 text-on-inverse-muted
│ ┌─ tb-screen__view ───────────────────────────┐ rounded-toy-sm overflow-hidden bg-inverse
│ │          （canvas／iframe，原尺寸規則不變）     │
│ └──────────────────────────────────────────────┘
└──────────────────────────────────────────────────
```

| 部位 | class | 規格 |
| --- | --- | --- |
| 外框 | `tb-screen` | `flex flex-col gap-2 p-3`（手機 `p-2`）`bg-inverse border-4 border-line rounded-toy-md shadow-hard-l` |
| 標題列 | `tb-screen__bar` | `flex items-center justify-between gap-3 px-1 min-h-6 font-pixel text-pixel-m`；標題 `text-pop truncate`、meta `text-on-inverse-muted shrink-0` |
| 畫面區 | `tb-screen__view` | `relative overflow-hidden rounded-toy-sm bg-inverse`；高度由頁面決定（沿用各頁現有的 `h-[75dvh] sm:h-[80dvh]`、`aspect-*` 等規則） |

**規則**

- 標題與 meta 只寫英數大寫（點陣字無中文字形）。各頁的值：Battle `NOW PLAYING`／`<遊戲 id 大寫> · SOLO` 或 `ROOM <房號> · <人數>P`；MiniGame `MINI GAME`／`CANVAS 2D`；GodotGame `GODOT GAME`／`GODOT 4`；RpgRoom `RPG ROOM`／`<場景 id 大寫>`（無則省略 meta）；CandyCrush `CANDY CRUSH`／`LEVEL <n>`（有關卡號才放）；MapDeveloper `MAP EDITOR`／`<寬>×<高>`。
- 外框**不可**加 `transform`、`filter`、`contain`：全螢幕 fallback 用 `position: fixed` 的子元素，祖先有 transform 會被困住。外框也不傾斜、不掛 `tb-lift`（不是按鍵）。
- 全螢幕時（`isFullscreen`）：畫面區自己變 `fixed inset-0`，外框不必變；標題列留在原處被蓋住即可。
- 全螢幕切換鈕放在畫面區右上角：IconButton 外觀（`Maximize2`／`Minimize2` 16px，`label="切換全螢幕"`），定位沿用現有 `absolute z-10 top-[max(0.5rem,env(safe-area-inset-top))] right-[max(0.5rem,env(safe-area-inset-right))]`，不加 `backdrop-blur`。**尺寸例外：維持 `size-9`（36px）**，不放大到 44 —— 凍結的炸彈超人 HUD（`index.css` CANDY CRUSH 以下區段）右欄頂部是照 `size-9` 讓位的，放大會壓到 P2 卡。外觀為 `size-9 bg-surface-raised text-ink border-3 border-line rounded-toy-md shadow-hard-s tb-lift-s`。
- 載入中（畫面區內，遊戲尚未就緒）：`absolute inset-0 grid place-items-center bg-inverse`，中央 `font-pixel text-pixel-l text-pop`「LOADING」＋三個點逐一亮起（`animate-pulse`，`motion-reduce:animate-none`）。iframe 頁面已有自己的載入畫面者沿用其文案，只換這組樣式。
- 深色差異：`inverse` 變 `#0b0907`、墨線與陰影變米白，外框在深底上會有米白描邊＋米白硬陰影，屬預期。

## 2. 表單控制項（`tb-input`／`tb-select`／`tb-textarea`）

用於 Battle（暱稱、房號）、Todos、Search、Directions、MapDeveloper、Resume（若有）。

| 狀態 | 規格 |
| --- | --- |
| default | `h-11 w-full px-4 bg-surface-raised text-ink border-3 border-line rounded-toy-md font-body text-body`（16px，iOS 不會自動放大）；`placeholder:text-ink-muted`；**無陰影**（輸入框是凹槽不是按鍵） |
| hover | 不變 |
| focus-visible | `outline-3 outline-offset-3 outline-focus`（全系統焦點；文字輸入框滑鼠點擊也會觸發 focus-visible，屬預期） |
| disabled | `bg-surface-sunken text-ink-muted border-ink-muted cursor-not-allowed` |
| invalid（`aria-invalid="true"`） | 外框不變色，改在下方顯示錯誤提示條（見下「提示條」）；不用紅框 |

- `tb-select`：同 `tb-input`＋`appearance-none pr-10 cursor-pointer`；右側 16px `ChevronDown`（lucide，`strokeWidth={2.5}`）以外層 `relative` 包、圖示 `absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-ink`。
- `tb-textarea`：同 `tb-input` 但 `h-auto min-h-28 py-3 resize-y`。
- 欄位標籤：`text-label text-ink`，與輸入框 `gap-2`（外層 `flex flex-col gap-2`）；說明文字 `text-body-s text-ink-muted`。
- 輸入框＋按鈕同列：`flex gap-3`，輸入框 `flex-1 min-w-0`，按鈕用 Button `size="s"`（同為 44 高）。
- 特殊輸入（房號、代碼）：`tb-input`＋`font-pixel text-pixel-l uppercase tracking-widest text-center`。

**提示條（各頁共用的長相，class 由各頁加前綴，如 `battle-alert`）**：`flex items-start gap-3 px-4 py-3 border-3 border-line rounded-toy-md text-body-s text-on-fill`；圖示 20px `strokeWidth={2.5}`、`shrink-0 mt-0.5`。底色：資訊 `bg-sky`（`Info`）、警告 `bg-pop`（`AlertTriangle`）、錯誤 `bg-pink`（`AlertTriangle`）。顏色只是輔助，意思由圖示與文字承擔。無陰影、不可點。

**分隔線（「或…」）**：`flex items-center gap-3 text-caption text-ink-muted`，兩側 `h-0 flex-1 border-t-3 border-line`。

## 3. Battle 大廳（`/battle`：GameList、GameMenu、Room、SoloGame）

稿：`page-battle.webp`（GameList＋GameMenu＋Room 未開局＋Room 開局＋SoloGame 五格，1440 寬）。頁面 CSS：`src/pages/Battle/Battle.css`，前綴 `battle-`。

### 3.1 頁首（index.tsx，四種畫面共用）

PageHead：眉標 `— VERSUS MODE —`、`<h1>` 多人對戰（拿掉 Swords 漸層圖示與漸層字）、導言沿用現有一句。左對齊，不置中。

### 3.2 GameList（遊戲列表）

| 部位 | 規格 |
| --- | --- |
| 版面 | `grid gap-6 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]`：1440 → 4 欄（每張 3 欄寬）、768 → 2 欄、390 → 1 欄 |
| 卡片 | CartridgeCard 外觀（`tb-card tb-lift`，game 型），但元素是 `<button type="button" class="text-left">`（點選是頁內狀態，不是路由）；`data-testid` 不變 |
| 標籤條 | `No.0<序號>`（依 `GAME_CATALOG` 順序 01–04）／`2-4P ▸` |
| 截圖 | `coverUrl(id)` 16:9 `object-cover`，底線 `border-b-3`；拿掉 hover 放大與漸層遮罩 |
| 封面破圖 | 截圖區改 `grid place-items-center bg-inverse`，中央 `font-pixel text-pixel-m text-pop`「NO SIGNAL」 |
| 內文 | 標題 `text-heading-m`（遊戲名，拿掉 Gamepad2 圖示）；說明 `text-body-s text-ink-muted`（catalog 的 desc） |

### 3.3 GameMenu（選遊戲後）

```
[← 返回遊戲列表]  Button s secondary
┌── 欄 1–7 battle-cover ──────────┐  ┌── 欄 8–12 battle-panel ─────┐
│ 封面 16:9                        │  │ 你的暱稱  [tb-input       ]  │
│─────────────────────────────────│  │ [▶ 單人遊玩      ] primary l  │
│ pop 面板：No.01 · 1-4P（pixel-m） │  │ ──── 或揪人連線對戰 ────     │
│ 坦克對戰（heading-l）              │  │ (警告條：未設定 Firebase)    │
│ 說明（body）                       │  │ [+ 建立房間      ] ink l      │
└─────────────────────────────────┘  │ [房號 tb-input ][加入] s     │
                                      │ (錯誤條)                    │
                                      └────────────────────────────┘
                                      說明 body-s ink-muted
```

| 部位 | 規格 |
| --- | --- |
| 版面 | `lg:grid lg:grid-cols-12 gap-6`；封面 `lg:col-span-7`、面板 `lg:col-span-5`；< 1024 堆疊（封面在上），間距 `gap-6` |
| 返回 | Button `variant="secondary" size="s"`，`ArrowLeft` 圖示，在 grid 上方，`self-start` |
| `battle-cover` | 不可點的大卡：`flex flex-col overflow-hidden bg-surface-raised border-4 border-line rounded-toy-xl shadow-hard-l`；封面 `aspect-video object-cover border-b-4 border-line`（破圖同 3.2 NO SIGNAL）；下方面板 `bg-pop text-on-fill p-8 flex flex-col gap-3`（手機 `p-6`）：meta `font-pixel text-pixel-m`「No.0n · 1-4P」、標題 `text-heading-l`、說明 `text-body` |
| `battle-panel` | `flex flex-col gap-5 p-6 bg-surface-raised border-3 border-line rounded-toy-lg shadow-hard-m`（手機 `p-5`） |
| 暱稱 | 標籤＋`tb-input`（見 §2） |
| 單人遊玩 | Button `variant="primary"`（l，`w-full`），`User` 圖示 —— 本畫面唯一的 primary |
| 分隔 | §2 分隔線，文字「或揪人連線對戰」 |
| 未設定 Firebase | §2 警告提示條（`bg-pop`），`data-testid` 不變 |
| 建立房間 | Button `variant="ink"`（l，`w-full`），`Plus` 圖示；disabled 走全系統 disabled |
| 房號＋加入 | §2「輸入框＋按鈕同列」：房號用特殊輸入樣式；加入 Button `variant="secondary" size="s"`＋`LogIn` |
| notice | §2 資訊提示條（`bg-sky`），放在 grid 上方、返回鈕下方 |
| error | §2 錯誤提示條（`bg-pink`），面板最後一列 |
| 頁尾說明 | `text-body-s text-ink-muted`，面板下方 `mt-4`，靠左（< 1024 置中可） |

### 3.4 Room（房間）

**未開局**：`lg:grid lg:grid-cols-12 gap-6`，左欄 `lg:col-span-5` 直排 `gap-6`（房號、玩家、遊戲），右欄 `lg:col-span-7` 直排 `gap-6`（開局／等待、離開）。

| 部位 | 規格 |
| --- | --- |
| `battle-code`（房號） | `flex flex-col gap-2 p-6 bg-pop text-on-fill border-4 border-line rounded-toy-xl shadow-hard-l`；眉標 `font-pixel text-pixel-m`「ROOM CODE」；房號列沿用現有的單一 `<button>`（`data-testid="battle-room-code"`、`aria-label="複製房號"` 不變）：`inline-flex items-center gap-4 self-start rounded-toy-md` 加全系統 focus-visible 外框；內含房號 `font-pixel text-pixel-xl tracking-widest`（拿掉漸層字）＋一個**看起來像** IconButton 的 `<span>`（`tb-iconbtn` 外觀，圖示 `Copy`／複製後 `Check`；不得巢狀 button）；下方提示 `text-caption`（「點擊複製，分享給朋友加入」／「已複製！」沿用） |
| `battle-card`（玩家、遊戲兩張共用） | `flex flex-col gap-4 p-5 bg-surface-raised border-3 border-line rounded-toy-lg shadow-hard-m`；卡頭 `flex items-center gap-2 text-label`＋圖示 20px；玩家數 `font-pixel text-pixel-m text-ink-muted`「2 / 4」 |
| 玩家列 `battle-player` | `flex items-center gap-3 h-13 px-3 bg-surface border-3 border-line rounded-toy-md`；頭像 IconBox（內容改為名字首字，`font-pixel text-pixel-l`；tone 依序 sky→mint→pink→pop）；名字 `text-label truncate`；房主 Tag s `pop`＋`Crown` 14px；「你」Tag s `plain` |
| 遊戲（唯讀） | 卡內一列：IconBox `Gamepad2`（pop）＋名稱 `text-heading-m`＋說明 `text-body-s text-ink-muted`；`data-testid` 不變 |
| 開始對戰（房主） | Button `variant="primary"`（l，`w-full`），`Swords` 圖示 |
| 等待房主 | `battle-wait`：`grid place-items-center gap-3 min-h-40 p-6 border-3 border-dashed border-line rounded-toy-lg`（虛線＝空插槽），內放 StatusPill `tone="pop"`「等待房主開始對戰…」 |
| 離開房間 | Button `variant="secondary"`（l，`w-full`），`LogOut` |

**開局後**（`isPlaying`）：改單欄直排 `gap-6`，順序 ① ScreenFrame ② 連線列 ③ 房號／玩家／遊戲三卡（`md:grid md:grid-cols-3 gap-6`，房號卡在此縮成 `p-5` 且房號用 `text-pixel-l`）④ 離開。以 CSS `order-*` 或兩段 JSX 實作皆可，`data-testid` 不變。

| 部位 | 規格 |
| --- | --- |
| ScreenFrame | §1，`title="NOW PLAYING"`、`meta="ROOM <房號> · <人數>P"`；畫面區 `h-[75dvh] sm:h-[80dvh]`；全螢幕鈕見 §1 |
| 連線列 | `flex flex-wrap items-center justify-between gap-3`；左 StatusPill：connected `success`「P2P 已連線」、connecting `pop`「連線中…」、其他 `action`「單人房」，後接 `font-pixel text-pixel-m text-ink-muted`「1 / 2 PEERS」（`data-testid="net-peer-count"` 留在這段；中文「對端」可保留，用 `text-caption` 而不用點陣字）；右 Button `variant="secondary" size="s"`＋`Send`「Ping」 |
| 連線逾時 | §2 錯誤提示條，右側 Button `variant="secondary" size="s"`＋`RefreshCw`「重試」；`data-testid` 不變 |
| 操作說明 | `text-body-s text-ink-muted` |
| 網路訊息 | `<details>`：summary `inline-flex items-center gap-2 h-11 text-label cursor-pointer`＋`ChevronDown`（open 時 `rotate-180`）；清單 `max-h-32 overflow-y-auto mt-2 p-3 bg-inverse text-on-inverse-muted border-3 border-line rounded-toy-md text-caption flex flex-col gap-1`，每列左 `border-l-2 border-pop pl-2` |

### 3.5 SoloGame（單人）

| 部位 | 規格 |
| --- | --- |
| 頂列 | `flex items-center justify-between gap-3`；左 Button `variant="secondary" size="s"`＋`ArrowLeft`「返回」；右 Tag l `pop`「坦克對戰・單人」（不傾斜） |
| ScreenFrame | §1，`title="NOW PLAYING"`、`meta="<ID> · SOLO"`；畫面區 `h-[75dvh] sm:h-[80dvh]` |
| 說明 | `text-body-s text-ink-muted text-center` |

### 3.6 BabylonCanvas／TouchControls 的非 HUD 外觀

| 部位 | 規格 |
| --- | --- |
| canvas 底 | `bg-inverse`（取代 `bg-slate-950`） |
| 轉橫向提示 | `absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 p-6 text-center bg-inverse`；`RotateCw` `size-14 text-pop animate-pulse motion-reduce:animate-none`；主句 `text-heading-m text-on-inverse`、副句 `text-body-s text-on-inverse-muted` |
| 遊戲浮層卡（`battle-overlay`，`setOverlay` 行為不變） | 卡 `w-full max-w-xs flex flex-col gap-3 p-6 text-center bg-surface-raised border-4 border-line rounded-toy-lg shadow-hard-l`（拿掉 `backdrop-blur`）；標題 `text-heading-m text-ink whitespace-pre-line`；副標 `text-body-s text-ink-muted whitespace-pre-line`；動作鈕 `flex flex-col gap-3 pt-1`：預設 variant → Button `primary`（l，`w-full`），`secondary` → Button `secondary`（l，`w-full`） |
| 搖桿底座 | `size-28 rounded-full border-3 border-on-inverse bg-inverse/40`（拿掉 `backdrop-blur`） |
| 搖桿頭 | `size-12 rounded-full bg-pop border-3 border-on-fill`（無陰影；位置由 inline transform 控制，不加 transition） |
| 動作鈕 | 仿 Handheld A/B：`size-16 rounded-full bg-action text-on-fill border-3 border-on-fill shadow-hard-s text-pixel-l`（30px，沿用原 emoji 大小；不加 `font-pixel`，emoji 才有字形）；`active:translate-x-[3px] active:translate-y-[3px] active:shadow-none`；按鈕文字是遊戲資料（`TOUCH_ACTIONS`，部分在凍結的 `*Hud.ts`），照原樣顯示 |

**深色差異**：無額外規則。注意 Room 的 `battle-code` 是 `pop` 底，深色時字仍 `on-fill` 深色。

## 4. 遊戲頁共用零件（MiniGame、GodotGame、RpgRoom、CandyCrush 外框、MapDeveloper 對話框）

這幾頁現在各寫一份同樣的 slate 對話框、kbd 標籤、D-pad 面板；改版後長相統一如下，class 仍寫在各頁 CSS（前綴各自的），名稱建議 `<前綴>-dialog` 等。

| 零件 | 規格 |
| --- | --- |
| 工具列 | PageHead 下方一列 `flex flex-wrap items-center justify-between gap-3`；按鈕一律 Button `variant="secondary" size="s"`（`HelpCircle` 遊戲說明、暫停／繼續、`RotateCcw` 重新開始…），拿掉 `h-8 text-xs` 小按鈕 |
| 說明對話框 `*-dialog` | 遮罩 `absolute`（或 `fixed`，照現有）`inset-0 z-40 grid place-items-center p-4 bg-inverse/80`（拿掉 `backdrop-blur`）；卡 `relative w-full max-w-md flex flex-col gap-4 p-6 bg-surface-raised text-ink border-4 border-line rounded-toy-lg shadow-hard-l`；標題列 `flex items-center gap-3`：IconBox `Gamepad2`（pop）＋`<h3 class="text-heading-m">`；右上關閉 IconButton `X`（`label="關閉說明"`，`absolute top-3 right-3`）；主按鈕 Button `variant="primary"`（l，`w-full`）沿用原文案 |
| 按鍵對照列 | `flex items-center justify-between gap-3 py-2 border-b-3 border-line last:border-b-0`；左 `text-label`；右 kbd 貼紙 Tag s `plain`（`font-pixel text-pixel-m`，內容含中文時改 `text-caption`），不再用 `font-mono` 紫字 |
| 小訣竅／規則 | §2 資訊提示條（`bg-sky`）；拿掉 💡／⚠️ emoji，改 `Lightbulb`／`AlertTriangle` 圖示，文字照舊 |
| 暫停浮層 | `absolute inset-0 z-30 grid place-items-center gap-3 bg-inverse/80 cursor-pointer`；主句 `font-pixel text-pixel-xl text-pop`「PAUSE」＋副句 `text-body-s text-on-inverse-muted`（原中文「遊戲暫停中」改放副句前半，文案不刪） |
| 載入浮層（非糖果） | §1「載入中」樣式；原文案（如「LOADING...」「Godot 載入中」）保留，英數部分用 `font-pixel text-pixel-l text-pop`，中文用 `text-label text-on-inverse` |
| 畫面內浮鈕 | 全螢幕、說明等疊在畫面上的鈕：§1 全螢幕鈕外觀（`size-9`，定位沿用現有） |
| 畫面內資訊籤（RpgRoom 左上座標） | `absolute top-4 left-4 z-30 flex flex-col gap-1 px-3 py-2 bg-inverse text-on-inverse border-3 border-on-inverse rounded-toy-md font-pixel text-pixel-m`（無陰影、不可點） |
| NPC 對話框（GodotGame、RpgRoom 的 `*-chat-box`） | 經典 RPG 反白對話框，位置與尺寸照舊（`absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] md:w-[80%] min-h-[96px] md:min-h-[128px] z-20`）；外觀 `p-4 bg-inverse text-on-inverse border-4 border-on-inverse rounded-toy-md shadow-hard-m text-body`（拿掉 `font-mono`、`backdrop-blur`、內陰影）；內嵌元素：`mark` → `bg-pop text-on-fill px-1 rounded-toy-sm`、`kbd` → `bg-surface-raised text-ink border-2 border-line rounded-toy-sm px-1.5 font-pixel text-pixel-m`、`a` → `text-pop underline underline-offset-4`；講者列 `flex items-center gap-2 pb-2 mb-2 border-b-2 border-on-inverse-muted text-label text-pop`（`MessageSquare` 16px）；內文 `text-body`；右下繼續提示：原文（「按 SPACE / 點 A 繼續」等）`text-caption text-on-inverse-muted`＋「▼」`font-pixel text-pixel-m text-pop`，整列 `animate-pulse motion-reduce:animate-none` |
| 觸控搖桿與動作鈕（RpgRoom 畫面內） | 同 §3.6 搖桿底座／搖桿頭／動作鈕 |
| 控制器面板（MiniGame、RpgRoom 畫面下方 D-pad 區） | 外層 `flex flex-col sm:flex-row items-center justify-between gap-6 p-5 bg-pop text-on-fill border-4 border-line rounded-toy-xl shadow-hard-m`（＝把 Handheld 機身的語言延伸成手把；**不傾斜**）；方向鍵 IconButton 外觀但底 `bg-surface-raised`、`size-11`，`active` 走 `tb-lift-s`；中央「D-PAD」`font-pixel text-pixel-m`；鍵盤說明 `text-body-s`（`h5` 改 `text-label`）；發射鍵仿 Handheld A 鍵：`size-16 rounded-full bg-action text-on-fill border-3 border-on-fill shadow-hard-s font-pixel text-pixel-l`（文字照舊）＋下方 `text-caption` 說明 |

## 5. SiteHeader 補充（Layout，react-shell）

toybox-ds `components/SiteHeader` 為準，這裡只補 mockup 沒畫的三件事。稿：`page-home-menu.webp`（390 寬選單展開）。

| 部位 | 規格 |
| --- | --- |
| Logo | 黃方塊內字母 `D`（`font-pixel text-pixel-l`）＋字標「DKBO's Collect」`font-display text-heading-m`；寬度 < 400px 時字標改為「DKBO」（兩個 span 以 `hidden min-[400px]:inline`／`min-[400px]:hidden` 切換），不得截斷 |
| 下拉面板（遊戲／工具） | `absolute top-full mt-2 min-w-56 flex flex-col gap-1 p-2 bg-surface-raised border-3 border-line rounded-toy-lg shadow-hard-m`；項目為整寬 NavLink（`justify-start rounded-toy-md`，current 照 NavLink 的 `pop` 底） |
| 手機選單（< 1024） | 列：Logo …… 主題 IconButton＋選單 IconButton（`Menu`／展開時 `X`，`label` 隨狀態「開啟選單」「關閉選單」）。面板在 header 下方、`tb-container` 內：`mt-3 mb-4 flex flex-col gap-1 p-3 bg-surface-raised border-3 border-line rounded-toy-lg shadow-hard-m`；首頁、E-履歷為整寬 NavLink；「遊戲」「工具」為群組標題 `px-4 pt-3 pb-1 font-pixel text-pixel-m text-ink-muted`（英文 `GAMES`／`TOOLS`，中文原標籤留給 `aria-label`），其下整寬 NavLink；面板展開時頁面不加遮罩、不鎖捲動（與現況一致者沿用現況） |
| 載入中（Suspense fallback） | `min-h-[50vh] grid place-items-center`；中央 Handheld 螢幕縮影：`flex flex-col items-center gap-3 p-6 bg-inverse border-4 border-line rounded-toy-md shadow-hard-m`，`font-pixel text-pixel-l text-pop`「LOADING」＋`text-caption text-on-inverse-muted`「載入中...」；`animate-pulse motion-reduce:animate-none` 只套在 LOADING 字 |
| 頁尾 | `border-t-3 border-line py-6 text-center font-pixel text-pixel-m text-ink-muted`：「© 2026 DKBO · GAME OVER? PRESS START」（`©` 年份與站名沿用現況，後半為 mockup 文案） |

## 6. 首頁（Home）手機版、深色版、mockup 沒畫的三區

稿：`page-home-390.webp`（手機淺色）、`page-home-dark.webp`（1440 深色）、`page-home-menu.webp`（手機選單展開）、`page-home-sections.webp`（About／Journey／CodeSnippet 三區 1440）。Hero、Marquee、作品區、CtaPanel 依 `home-mockup` 與 brief AC6，不另寫。

**手機（390）**：SiteHeader 收合；Hero 單欄（StatusPill → H1 clamp 44 → 副標 26/34 → 導言 16/28 → 兩顆按鈕各自 `w-full` 直排 `gap-4` → StatTile 2×2）；Handheld 置中、`w-full`、貼紙隱藏，與文案距 `gap-14`；傾斜後的機身角會超出欄寬，外層包 `px-4 overflow-x-clip`（不得造成水平捲動，AC12）；Marquee `text-pixel-l` 手機值 24；SectionHeader 標題 34/40，SegmentedControl 折到下一行；FeatureCard 上下堆疊（截圖在上、面板 `border-l-0 border-t-4`）；卡帶 1 欄；CtaPanel `px-6 py-8`、按鈕 `w-full`。

**深色（1440）**：純 token 切換。檢查點：Handheld 機身仍 `pop`、螢幕 `inverse`（`#0b0907`）；StatTile 底 `surface-raised`（`#241f18`）、數字米白；CartridgeCard 標籤條 game 仍 `pop`＋深字、tool 為 `surface-sunken`（`#332c23`）＋米白字；CtaPanel 陰影仍 `action`。

### 6.1 About（`home-about`，內容保留）

```
SectionHeader  — ABOUT — ／關於我
┌── 欄 1–7 home-about-card ────────────┐ ┌── 欄 8–12 home-now ───────┐
│ 段落 body-l                            │ │ NOW PLAYING（pixel-m）    │
│ [完整經歷看 E-履歷 →] Button s secondary│ │ ● 多人對戰 …              │
└────────────────────────────────────┘ │ ● AI 協作 …               │
                                        │ ● Side project …          │
                                        └──────────────────────────┘
```

| 部位 | 規格 |
| --- | --- |
| 區塊 | `tb-container`，上下 `py-24`（手機 `py-18`）；SectionHeader 眉標 `— ABOUT —`、標題「關於我」；下方 `grid grid-cols-1 lg:grid-cols-12 gap-6`（標題到內容 `gap-8`） |
| `home-about-card` | `lg:col-span-7 flex flex-col gap-6 p-8 bg-surface-raised border-3 border-line rounded-toy-lg shadow-hard-m`（手機 `p-6`）；段落 `text-body-l text-ink`；連結改 Button `variant="secondary" size="s"`＋`ArrowRight`（`data-testid` 不變），`self-start` |
| `home-now` | `lg:col-span-5 flex flex-col overflow-hidden bg-surface-raised border-3 border-line rounded-toy-lg shadow-hard-m`；頂端標籤條（仿 CartridgeCard strip）`px-4 py-1 bg-pop text-on-fill border-b-3 border-line font-pixel text-pixel-m`「NOW PLAYING」（取代 `Sparkles`＋Now）；清單 `flex flex-col gap-4 p-5`；每列 `flex items-start gap-3`：點 `mt-2 size-3 rounded-full border-2 border-line`，底色依序 `bg-sky`／`bg-mint`／`bg-pink`；文字 `text-body-s text-ink-muted`，標題 `<strong class="text-ink">` |

### 6.2 Journey（`home-journey`，內容保留）

| 部位 | 規格 |
| --- | --- |
| 區塊 | `tb-container pb-24`（手機 `pb-18`）；SectionHeader 眉標 `— HIGH SCORE —`、標題「開發歷程」 |
| 軸線 | 桌機 `grid-cols-[112px_40px_minmax(0,1fr)]`、手機 `grid-cols-[28px_minmax(0,1fr)]`（沿用現有欄寬）；直線 `absolute w-0 border-l-3 border-line`（位置沿用 `left-[13px] md:left-[129px]`） |
| 年份 | `font-pixel text-pixel-m text-ink-muted text-right`，current 為 `text-ink`；手機在標題上方 |
| 節點 | `size-5 rounded-full bg-surface-raised border-3 border-line`；current：`size-6 bg-pop shadow-hard-s` |
| 內容 | 標題 `text-heading-m`；內文 `text-body text-ink-muted`；直排 `gap-3`，節點間 `pb-10` |
| lessons 三格 | `grid grid-cols-1 sm:grid-cols-3 gap-3`；每格 `flex flex-col gap-1 p-4 bg-surface-raised border-3 border-line rounded-toy-md`（無陰影）；label（問題／解法／教訓）`text-caption text-ink-muted`；內文 `text-body-s text-ink` |
| 展開片段（summary） | Button 外觀的 summary：`inline-flex items-center gap-2 h-11 px-4 bg-surface-raised text-ink border-3 border-line rounded-toy-md shadow-hard-s tb-lift-s font-display text-button cursor-pointer list-none`，`ChevronRight` 16px `group-open:rotate-90 motion-reduce:transition-none` |
| 外連 | Button `variant="secondary" size="s"`＋`ArrowUpRight`（`data-testid` 不變） |
| Suspense 佔位 | `h-40 bg-inverse border-3 border-line rounded-toy-md`，中央 `font-pixel text-pixel-m text-pop`「LOADING」 |

### 6.3 CodeSnippet（`home-` 前綴，內容與 highlighter 不變）

| 部位 | 規格 |
| --- | --- |
| 外框 | 小一號 ScreenFrame：`flex flex-col gap-2 p-3 bg-inverse border-3 border-line rounded-toy-md shadow-hard-m`（不用 `tb-screen` 的 `border-4`／`shadow-hard-l`，它不是主角） |
| 標題列 | `flex justify-between px-1 font-pixel text-pixel-m`：左 `text-pop`「SOURCE」、右 `text-on-inverse-muted` 語言名（HTML／JAVASCRIPT，大寫）；取代右上浮動語言籤 |
| 程式碼區 | `customStyle.background` 改 `transparent`（hex 不得出現在 TSX）、`padding` 改 `0.75rem`；monokai 配色照舊；`fontSize` 照舊 |

## 7. Resume（`/resume`，前綴 `resume-`）

稿：`page-resume.webp`。

| 部位 | 規格 |
| --- | --- |
| PageHead | 眉標 `— PLAYER PROFILE —`、`<h1>`「E-履歷 (E-Resume)」、導言照舊 |
| 版面 | 沿用瀑布流：`columns-1 md:columns-2 gap-6`，每張卡 `break-inside-avoid mb-6`；順序照舊（About、人物介紹、狀態、經歷、技能）。捲動進場動畫保留，`motion-reduce` 時直接顯示 |
| `resume-panel`（五張卡共用） | `flex flex-col overflow-hidden bg-surface-raised border-3 border-line rounded-toy-lg shadow-hard-m`；卡頭（取代 `resume-card-header`）`flex items-center justify-between gap-3 px-5 py-2 border-b-3 border-line bg-surface-sunken`：左 `<h2 class="text-heading-m">` 原標題、右 `font-pixel text-pixel-m text-ink-muted` 代號（About `P1`、人物介紹 `BIO`、狀態 `STATS`、經歷 `LOG`、技能 `SKILLS`）；About 卡頭改 `bg-pop text-on-fill`（全頁唯一黃條＝主角）；卡身 `p-6`（手機 `p-5`）直排 `gap-6` |

**About**：頭像 `size-28 md:size-32 rounded-toy-lg border-4 border-line shadow-hard-m overflow-hidden -rotate-3`（tilt-1，全頁唯一傾斜物）——拿掉漸層光環、虛線轉圈與 hover 放大；姓名 `text-heading-l`，`Award` 20px 靜止（拿掉 bounce）；Open to Work 改 StatusPill `tone="success"`；「Senior Frontend Architect」`font-pixel text-pixel-m text-ink-muted`；簡介 `text-body text-ink`。能力環四格：外框 `grid grid-cols-4 gap-3 p-4 bg-surface border-3 border-line rounded-toy-md`；環的底軌 `stroke-surface-sunken`、進度 `stroke-ink`（拿掉 drop-shadow 光暈與各色），`strokeLinecap="butt"`；百分比 `font-pixel text-pixel-m`；標籤 `text-caption text-ink-muted`。資訊四格 `grid grid-cols-1 @lg:grid-cols-2 gap-3`：每格 `flex items-center gap-3 p-3 bg-surface border-3 border-line rounded-toy-md`；IconBox（`User` sky、`Calendar` mint、`Mail` pink、`MapPin` pop）；欄名 `font-pixel text-pixel-m text-ink-muted`（CLASS／LEVEL／EMAIL／LOCATION）；值 `text-label text-ink`。三格不可點：拿掉 `cursor-pointer` 與 hover；Email 是 `<a>`：加 `shadow-hard-s tb-lift-s`，`ArrowUpRight` 16px 常駐。

**人物介紹**：四段改成編號列 `flex gap-4`：左 `font-pixel text-pixel-m text-ink-muted` `01`–`04`、右 `text-body text-ink`；拿掉彩色左框。

**狀態**：`grid grid-cols-3 gap-4`；環同 About（`size-24 sm:size-28 md:size-32`），中央百分比 `font-pixel text-pixel-l`，下方技術名改 Tag s（green→`mint`、blue→`sky`、red→`pink`）；拿掉 hover 放大。

**經歷**：`resume-timeline` 取代 `timeline-*`：直線 `absolute left-2 top-2 bottom-2 w-0 border-l-3 border-line`；每筆 `relative pl-10 pb-4`；節點 `absolute left-0 top-5 size-5 rounded-full bg-surface-raised border-3 border-line`（第一筆 `bg-pop`）；卡 `flex flex-col gap-1 p-4 bg-surface border-3 border-line rounded-toy-md`；公司 `text-label text-ink`、職稱 `text-body-s text-ink-muted`、年份 Tag s `plain`（`font-pixel text-pixel-m`）。進場動畫保留（`motion-reduce` 時無）。

**技能**：`flex flex-wrap justify-center gap-3`；weight 6 → Tag l `pop`（不傾斜）；weight 4 → Tag s 依序 `sky`／`mint`／`pink` 輪替；weight 3 → Tag s `plain`。拿掉 hover 放大與位移（不可點）。

**深色差異**：環底軌 `surface-sunken`（`#332c23`）、進度 `ink`（米白）仍有 ≥ 3:1 圖形對比。

## 8. Todos（`/todos`、`/todos/:keyword`，前綴 `todos-`）

稿：`page-todos.webp`。

```
PageHead  — TO DO LIST — ／ Todos (3)        [清除已完成] [清除全部]  ← Button s secondary
┌── todos-box（工具頁內容物件，max-w-2xl） ──────────────────┐
│ [tb-input What needs to be done?          ] [+ 新增] s primary │
│ [ All | Active | Completed ]  SegmentedControl 外觀（NavLink）  │
│ ┌ todos-item ─────────────────────────────────────────┐ │
│ │ [☐] 買牛奶                               [✎] [🗑] │ │
│ └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

| 部位 | 規格 |
| --- | --- |
| PageHead | 眉標 `— TO DO LIST —`；`<h1>`「Todos (<數量>)」；右側操作：Button `variant="secondary" size="s"`「Clear Completed」（`CheckSquare`）、「Clear All」（`Trash`）；顯示條件與 `data-testid` 不變。拿掉漸層圖示塊 |
| `todos-box` | 工具頁內容物件（§0），`max-w-2xl w-full`、靠左；直排 `gap-5` |
| 輸入列 | §2「輸入框＋按鈕同列」：`tb-input`（placeholder 照舊）＋Button `variant="primary" size="s"`＋`Plus`「新增」；disabled 走全系統 |
| 篩選 | 三個路由 NavLink 套 SegmentedControl 的外觀（`tb-seg` 外框、`tb-seg__opt` 選項；`aria-current="page"` 時用 selected 樣式 `bg-inverse text-pop`）；`w-full sm:w-auto`，手機三格等寬 |
| 空清單 | `grid place-items-center gap-2 py-10 border-3 border-dashed border-line rounded-toy-md text-body-s text-ink-muted`，上方 `font-pixel text-pixel-l text-ink-muted`「EMPTY」；原句保留 |
| `todos-item` | `flex items-center justify-between gap-3 min-h-13 px-4 py-2 bg-surface border-3 border-line rounded-toy-md`；進場／離場動畫保留（keyframes 搬到 `Todos.css`，`motion-reduce` 時無） |
| 勾選 | 現有 `role="button"` 區塊不變；視覺：`size-6 grid place-items-center rounded-toy-sm border-3 border-line bg-surface-raised`，完成時 `bg-mint`＋`Check` 16px `text-on-fill`（取代 `Circle`／`CheckCircle2`）；焦點全系統外框 |
| 文字 | `text-body text-ink`；完成 `line-through text-ink-muted`（拿掉 opacity） |
| 編輯中輸入 | `tb-input` 縮版：`h-9 px-2 text-body`（在列內，仍 `border-3`） |
| 編輯／刪除 | IconButton 外觀縮成 `size-9`（列高限制；觸控區由整列 `min-h-13` 補足），`Pencil`（取代 `Edit`）、`Trash2`；hover 不變色（`tb-lift-s` 處理） |
| 完成態列 | `bg-surface-sunken`（取代綠色淡底） |

## 9. Search（`/search`、`/search/:keyword`，前綴 `search-`）

稿：`page-search.webp`（有結果狀態；載入與歡迎狀態另見下表）。

| 部位 | 規格 |
| --- | --- |
| PageHead | 眉標 `— SEARCH —`；`<h1>`「外部查詢 (External Search)」；導言照舊；左對齊 |
| 搜尋框 | `max-w-2xl`：外層 `relative`；`Search` 20px 絕對定位 `left-4`；`tb-input h-13 pl-12 pr-14 text-body-l`；清除鈕 IconButton `X`（`size-9`、`absolute right-2 top-1/2 -translate-y-1/2`）。拿掉毛玻璃外殼與 focus-within 紫環（焦點走輸入框自己的外框） |
| 推薦 | `flex flex-wrap items-center gap-2 mt-3`；前導 `text-caption text-ink-muted`「推薦探索:」（拿掉 Sparkles）；每個關鍵字 `<button>` 做成可點的 Tag：Tag s `plain` 外觀＋`shadow-hard-s tb-lift-s h-11 px-4`（觸控 44） |
| 歡迎狀態 | `max-w-md mx-auto flex flex-col items-center gap-3 p-8 text-center` 工具頁內容物件；IconBox `Globe`（sky，靜止）；`text-heading-m`「等待搜尋中」；說明 `text-body-s text-ink-muted` |
| 結果欄 | `grid grid-cols-1 lg:grid-cols-2 gap-8`（原 `md:`，改 `lg:` 讓 768 單欄較寬鬆） |
| 欄頭 | `flex items-center gap-3 pb-3 border-b-3 border-line`；IconBox（GitHub：`inverse` 底不在 tone 內 → 用 `pop`；維基：`sky`），`<h2 class="text-heading-m">`＋`text-caption text-ink-muted` 說明 |
| 結果卡 | `<li>` 為 `flex flex-col gap-2 p-5 bg-surface-raised border-3 border-line rounded-toy-lg shadow-hard-m`；**卡本身不可點**（連結在標題上），所以不掛 `tb-lift`；標題連結 `text-heading-m text-ink underline decoration-3 underline-offset-4 decoration-transparent hover:decoration-line focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus`；語言徽章 Tag s `sky`；說明 `text-body-s text-ink-muted line-clamp-2`；星數／fork `flex gap-4 font-pixel text-pixel-m text-ink-muted`（圖示 16px，拿掉 hover 變色）；維基卡把 `CornerDownRight` 換成 `font-pixel text-pixel-m` 序號 `01`… |
| 載入骨架 | 卡同結果卡但內容為 `bg-surface-sunken rounded-toy-sm` 條（`h-4`／`h-3`，寬照舊），`animate-pulse motion-reduce:animate-none` |
| 錯誤 | §2 錯誤提示條，「檢索失敗：」加粗照舊 |
| 無結果 | `py-10 text-center text-body-s text-ink-muted` |

## 10. Directions（`/directions`，前綴 `dir-`）

稿：`page-directions.webp`（地圖以 `inverse` 底＋格線示意，路線面板展開）。

| 部位 | 規格 |
| --- | --- |
| PageHead | 新增：眉標 `— ROUTE PLANNER —`、`<h1>`「地圖導覽」（沿用導覽列名稱）；無導言 |
| `dir-map` 外框 | `relative w-full h-[calc(100dvh-var(--layout-header-h)-14rem)] min-h-[480px] overflow-hidden bg-inverse border-4 border-line rounded-toy-xl shadow-hard-l`；取代 `h-[calc(100vh-140px)] rounded-3xl …` |
| 控制盒 `#mapControl` | 位置照舊（上方置中，`w-[90%] sm:w-[50%] md:w-[40%] max-w-[420px]`）；外觀 `flex flex-col gap-3 p-4 bg-surface-raised border-3 border-line rounded-toy-lg shadow-hard-m`（拿掉毛玻璃）；兩個輸入：外層 `relative`，圖示（`Compass`、`MapPin`）`absolute left-3`，輸入 `tb-input pl-11`；錯誤 §2 錯誤提示條縮版（`py-2`），拿掉 `animate-pulse` |
| 導航面板 `#panel` | 滑入行為照舊；外觀 `bg-surface-raised border-l-4 border-line`（拿掉毛玻璃與大陰影）；頂列 `sticky top-0 flex items-center justify-between pb-3 mb-4 border-b-3 border-line bg-surface-raised`：`<h2 class="text-heading-m">`＋`Navigation` 20px（靜止）、關閉 IconButton `X`（`label` 照舊）；Google 塞進來的指引文字容器 `text-body-s text-ink` |
| 文字模式（地圖逾時） | `absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center bg-inverse text-on-inverse-muted`；`Info` 40px `text-pop`（拿掉 bounce）；標題 `text-heading-m text-on-inverse`；說明 `text-body-s`；路線卡 `max-w-md w-full flex flex-col gap-2 p-4 text-left bg-surface-raised text-ink border-3 border-line rounded-toy-md`：預估路程 `text-label`、指引清單 `text-body-s list-decimal list-inside` |
| 地圖上的自訂標記與資訊窗（`innerHTML` 字串） | 頭像圈 `size-11 rounded-full border-3 border-line bg-surface-raised shadow-hard-s`（拿掉 hover 放大）；對話泡 `bg-surface-raised text-ink border-3 border-line rounded-toy-md shadow-hard-s p-3 text-body-s max-w-[180px]`；講者名 `text-label`（三人依序 `text-ink`，拿掉 indigo／amber／purple 字色）；時間 `text-caption text-ink-muted`。訊息內文含 emoji 屬資料內容，沿用 |
| InfoWindow 內容 | `p-2 text-label text-on-fill`（InfoWindow 白底由 Google 控制，深色時仍為白底，故用 `on-fill` 深字） |

**深色差異**：Google 地圖本身不跟主題；外框、控制盒、面板跟 token。

## 11. MapDeveloper（`/map-developer`，前綴 `mapdev-`）

稿：`page-map-developer.webp`。編輯、匯出 JSON 行為不變；只換外觀。

| 部位 | 規格 |
| --- | --- |
| 頁面 | 取消 `text-slate-100` 全頁淺字（改跟 token）；`tb-container` 但內容寬放滿 `max-w-site`；直排 `gap-6` |
| 頂部工具列 | 取代現有深色卡：PageHead 版式——眉標 `— MAP EDITOR —`、`<h1>`「2D 地圖與場景開發器」、導言「React 19 等寬網格圖層場景編輯工具」；右側 `flex flex-wrap gap-3`：載入現有地圖 `tb-select`（`w-auto min-w-56`）、Button s secondary × 4（快速鍵說明、導入／導出 JSON、讀取暫存、全螢幕開發）、Button s **primary**「儲存地圖 (Alt+S)」（本頁唯一 primary）。拿掉 Layers 漸層圖示塊 |
| JSON 面板 | 工具頁內容物件；標題 `text-heading-m`；文字區 `tb-textarea text-body-s`（JSON 含中文與符號，不用點陣字） |
| 三欄 | `grid grid-cols-1 lg:grid-cols-12 gap-6`：圖庫 `lg:col-span-3`、畫布 `lg:col-span-6`、屬性 `lg:col-span-3`（照舊） |
| `mapdev-panel`（圖庫、屬性兩欄） | `flex flex-col overflow-hidden bg-surface-raised border-3 border-line rounded-toy-lg shadow-hard-m`；欄頭 `flex items-center justify-between gap-2 px-4 py-3 border-b-3 border-line text-label`（圖示 16px `text-ink`）；欄頭內小下拉用 `tb-select` |
| 屬性分頁（地圖貼圖 (n)／碰撞區域 (n)／NPC (n)） | SegmentedControl 外觀的**直排版**（欄寬 270 放不下三等分橫排，文字不得截斷）：外框同 `tb-seg`，選項 `h-11 w-full px-4 justify-start`，分隔改 `border-t-3`；`lg` 以下欄位變寬時可回橫排三等分。放在欄頭下方 `p-3` |
| 表單 | 每欄位 §2 標籤＋`tb-input`／`tb-select`；兩欄並排 `grid grid-cols-2 gap-3`；區段標題 `<h4 class="flex items-center gap-2 text-label">`，emoji 換 lucide：⚙️→`Settings`、🧍→`User`、📸→`Camera`、💡→`Lightbulb`（文字保留） |
| 圖庫 | 捲動區 `bg-surface-sunken p-3`；圖庫圖外框 `border-3 border-line rounded-toy-md overflow-hidden bg-surface-raised`；選取提示 §2 資訊提示條（`py-2 text-caption`） |
| 畫布欄 | 外框改 ScreenFrame（§1）：`title="MAP EDITOR"`、`meta="<寬>×<高>"`；最小高照舊 `min-h-[550px] lg:min-h-[720px]`；畫布區底 `bg-inverse p-5`。畫布上方工具列（縮放、圖層透明度）放在 ScreenFrame 外、上方一列 `flex flex-wrap items-center gap-3 text-caption`：縮放 IconButton `size-9`（`Minus`／`Plus`）＋倍率 `font-pixel text-pixel-m`；三條透明度滑桿 `mapdev-range`：`h-3 w-20 appearance-none rounded-toy-pill bg-surface-sunken border-2 border-line accent-ink`；狀態徽章 Tag s（依原條件換 tone：sky／mint／pink） |
| 狀態列（畫布下） | `flex items-center justify-between px-1 font-pixel text-pixel-m text-on-inverse-muted`（在 ScreenFrame 內畫面區下方）；中文欄名（放置名稱、選定元素種類）用 `text-caption`，值 `text-pop` |
| 快速鍵說明對話框 | §4 說明對話框＋按鍵對照列 |
| 全螢幕 | 行為照舊；全螢幕時外框不變 |

## 12. MiniGame（`/miniGame`，前綴 `mini-`）

稿：`page-minigame.webp`。

| 部位 | 規格 |
| --- | --- |
| PageHead | 眉標 `— MINI GAME —`、`<h1>`「復古射擊小遊戲」、導言照舊 |
| 版面 | 同 §13 遊戲頁欄寬（`max-w-4xl mx-auto`） |
| 工具列 | §4 工具列：遊戲說明、暫停／繼續、重新開始 |
| 計分列 | 三個 StatTile 橫排 `grid grid-cols-3 gap-3`：數字 `font-pixel text-pixel-xl`（手機 `text-pixel-l`）、標籤 `text-caption`「生命值」「得分」「最高紀錄」；拿掉彩色字與脈動圖示 |
| 遊戲畫面 | ScreenFrame `title="MINI GAME"` `meta="CANVAS 2D"`（此頁是 2D canvas 射擊）；畫面區 `aspect-video`；全螢幕鈕 §1 |
| Game Over | 畫面區內 `absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-inverse/85 cursor-pointer`；`font-pixel text-pixel-xl text-pop`「GAME OVER」（拿掉 Gamepad2 bounce、紅字）；`text-body-s text-on-inverse-muted` 原句；Button `variant="pop"`＋`RotateCcw`「重新開始」（inverse 上用 pop，陰影 `on-inverse` 色，同 CtaPanel 規則） |
| 控制器面板 | §4 控制器面板（D-pad＋鍵盤說明＋發射鍵） |
| 說明對話框 | §4 |

## 13. GodotGame（`/godot-game`，前綴 `godot-`）

稿：`page-godot-game.webp`。iframe、bridge 訊息、NPC 對話資料流不變。

| 部位 | 規格 |
| --- | --- |
| PageHead | 眉標 `— GODOT 4 —`、`<h1>` 原標題、導言照舊 |
| 版面 | 遊戲頁欄寬：`tb-container` 內再包 `max-w-4xl mx-auto flex flex-col gap-6`（PageHead、工具列、畫面、控制器面板都在這欄，對齊 896 寬；畫面寬與現有 `rpg-cabinet` 的 `max-w-4xl` 相同，遊戲解析度不變） |
| 工具列 | §4：遊戲說明 |
| 遊戲畫面 | `godot-screen` 取代 `rpg-cabinet`／`rpg-screen`：ScreenFrame `title="GODOT GAME"` `meta="GODOT 4"`；畫面區高度照舊（`rpg-screen` 現有的 `h-[450px] md:h-[550px]` 搬進 `godot-screen__view`，數值不變）；iframe 底 `bg-inverse` |
| 載入 | §4 載入浮層（`Compass` spin 改 `font-pixel` LOADING，拿掉紫色） |
| NPC 對話框 | §4 NPC 對話框（`data-testid="rpg-dialogue-box"` 不變） |
| 暫停 | §4 暫停浮層 |
| 說明對話框 | §4；按鍵對照列、小訣竅提示條 |
| 浮鈕 | 全螢幕＋說明：§1 外觀 `size-9`，`flex gap-2` 定位照舊 |

## 14. RpgRoom（`/rpgroom`，前綴 `rpg-`）

稿：`page-rpgroom.webp`。Canvas 繪製邏輯、地圖資料、觸控派發不變。

| 部位 | 規格 |
| --- | --- |
| PageHead | 眉標 `— RPG ROOM —`、`<h1>` 原標題、導言照舊 |
| 版面 | 同 GodotGame |
| 工具列 | §4：遊戲說明 |
| 遊戲畫面 | 新名 `rpg-screen-frame`／`rpg-screen-view`（不得沿用 `rpg-cabinet`／`rpg-screen` 舊名，見共用契約）：ScreenFrame `title="RPG ROOM"`，有場景名時 `meta` 放場景 id 大寫；三層 `rpg-canvas` 堆疊規則照舊（改名 `rpg-layer`，定位數值不變） |
| 載入、NPC 對話框、說明對話框、浮鈕 | 同 §13 |
| 左上座標籤 | §4 畫面內資訊籤（`Info` 圖示改 `text-pop`） |
| 觸控搖桿與動作鈕 | §3.6 規格（`rpg-joy-base`／`rpg-joy-knob`／`rpg-touch-action` 改新名 `rpg-joy`、`rpg-knob`、`rpg-act`，`bottom-40`／`bottom-5` 位置邏輯不變） |
| 控制器面板 | §4 控制器面板 |

## 15. CandyCrush 頁面外框（`/candy-crush`，只改 `index.tsx` 外框 JSX＋新 `CandyCrush.css`，前綴 `candy-page-`）

稿：`page-candy-crush.webp`。**不畫也不改**：`CandyHud`、`CandyOverlays`（暫停、結算、說明對話框）、`CandyStar`、HUD 圓鈕、iframe 內遊戲、`candy-loading` 載入畫面（屬遊戲品牌畫面，class 在凍結區段，沿用）。

| 部位 | 規格 |
| --- | --- |
| PageHead | 取代 `candy-title`／`candy-subtitle`：眉標 `— MATCH 3 —`、`<h1>`「糖果消消樂」（`text-display-l`，拿掉粉紅漸層字）、導言照舊——其中 `candy-num` 包的英數詞（Godot 4、match-3、iframe、React、postMessage）改用 `font-pixel text-pixel-m` 的 `candy-page-num`（新名，不沿用凍結區段的 `candy-num`） |
| 版面 | 同 §13 遊戲頁欄寬（`max-w-4xl mx-auto`） |
| 工具列 | §4：Button `variant="secondary" size="s"`＋`HelpCircle`「遊戲說明」，取代 `candy-tool-btn` |
| 遊戲畫面 | `candy-page-screen` 取代 `rpg-cabinet`：ScreenFrame `title="CANDY CRUSH"`（目前無關卡號可讀時不放 meta）；`screenRef` 的畫面區沿用原 `rpg-screen` 的尺寸規則（搬進 `candy-page-view`，數值不變）；`data-hud` 屬性、TopBar／SideHud／HudButtons 掛載位置不變；iframe 底 `bg-inverse` |
| 全螢幕 | 原 `fixed inset-0 …` 字串不變（只把 `bg-black` 換 `bg-inverse`） |

## 16. NotFound（`*`）

稿：`page-not-found.webp`。

| 部位 | 規格 |
| --- | --- |
| 版面 | `tb-container min-h-[60vh] grid place-items-center py-18` |
| 主體 | 置中直排 `gap-6`：迷你掌機螢幕 `flex flex-col items-center gap-2 px-10 py-8 bg-inverse border-4 border-line rounded-toy-xl shadow-hard-l rotate-3`（tilt-2，全頁唯一傾斜）：`font-pixel text-pixel-xl text-pop`「404」＋`font-pixel text-pixel-m text-on-inverse-muted`「NO SIGNAL」；拿掉光暈、漂浮與 AlertCircle |
| 文案 | 標題改 `<h1 class="text-heading-l">`「找不到頁面」；說明 `text-body text-ink-muted max-w-sm` 原句 |
| 按鈕 | `flex flex-wrap justify-center gap-4`：Button `variant="secondary"`＋`ArrowLeft`「返回上頁」、Button `variant="primary" href="/"`＋`Home`「返回首頁」（用 Button 的 `href` 渲染 Link，不再 Link 包 Button） |

## 17. 稿與規格對照表

| 稿 | 對應節 |
| --- | --- |
| `page-battle.webp` | §1、§2、§3 |
| `page-resume.webp` | §7 |
| `page-todos.webp` | §2、§8 |
| `page-search.webp` | §2、§9 |
| `page-directions.webp` | §10 |
| `page-map-developer.webp` | §1、§2、§11 |
| `page-minigame.webp` | §1、§4、§12 |
| `page-godot-game.webp` | §1、§4、§13 |
| `page-rpgroom.webp` | §1、§4、§14 |
| `page-candy-crush.webp` | §1、§15 |
| `page-not-found.webp` | §16 |
| `page-home-390.webp`、`page-home-dark.webp`、`page-home-menu.webp`、`page-home-sections.webp` | §5、§6 |
