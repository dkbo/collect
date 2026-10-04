# babylon 報告（波 2）
## 做了什麼
AC9：Battle 大廳與外框依 pages-spec §3 改 toybox 風；HUD 元件、HUD 分流、setHud／setOverlay、觸控鍵派發、建房／加入／開局流程皆未動。
- `Battle.css`（新，`@reference "../../index.css"`，`@layer components`，全部 `battle-` 前綴、只用 token utility），由 `index.tsx` `import '@/pages/Battle/Battle.css'`。
- `index.tsx`：`tb-container battle-page`；PageHead 用 `tb-sechead` 自組 `<h1>`（眉標 `— VERSUS MODE —`），拿掉 Swords 漸層圖示／漸層字；相對 import 改 `@/pages/Battle/*`。
- `GameList.tsx`：`<button class="tb-card tb-lift">`，標籤條 `No.0n／2-4P ▸`、`tb-card__media`、破圖 `NO SIGNAL`；auto-fill 260 grid。
- `GameMenu.tsx`：返回 Button s、info 提示條、`lg:grid-cols-12` 封面 7（`battle-cover` pop 面板）／面板 5（`battle-panel`）；`tb-input`、primary 單人、分隔線、warn 提示條、ink 建房、房號 pixel 輸入＋加入 s、error 提示條、頁尾說明。
- `Room.tsx`：未開局 5／7 兩欄（`battle-code` pop 房號卡＋`tb-iconbtn` 外觀 span、`battle-card` 玩家列 IconBox 首字 sky→mint→pink→pop、房主 Tag pop＋Crown、你 Tag plain、遊戲卡 IconBox；primary 開始對戰／`battle-wait` 虛線＋StatusPill；secondary 離開）。開局後單欄：ScreenFrame（`NOW PLAYING`／`ROOM <碼> · <n>P`）→ 連線列 StatusPill＋`n / m 對端`＋Ping s → 逾時 error 條＋重試 s → 說明 → `<details>` 網路訊息 → 三卡 `md:grid-cols-3`（房號卡 compact、玩家縮成一行名字）→ 離開。
- `SoloGame.tsx`：頂列返回 Button s＋Tag l pop；ScreenFrame（`NOW PLAYING`／`<ID> · SOLO`）。
- 全螢幕：ScreenFrame view 內加一層 `battle-stage`（ref 掛這層，全螢幕時自己 `fixed inset-0 z-50 h-dvh w-screen bg-inverse`），外框無 transform；全螢幕鈕改 toybox `IconButton`、`size-9`（§1 例外）、定位沿用。
- `BabylonCanvas.tsx`：canvas `bg-inverse`、轉橫向提示、`battle-overlay` 卡（toybox Button primary／secondary，拿掉 backdrop-blur）；HUD 與分流邏輯原封不動。
- `TouchControls.tsx`：只換 4 個 className（搖桿底座／頭、動作鈕列、動作鈕）；派發邏輯不動。
- 注意：`battle-page` 設 `text-left`，而 `tb-screen` 本身也是 `text-left`；凍結 HUD 過去繼承 `#root` 的 `text-align:center`，故 `battle-stage` 補 `text-center` 還原繼承，避免 HUD 文字對齊漂移。

## 測試
### 紅
不適用: 本波只改 JSX／CSS 外觀，無純邏輯（math／net／store）可單測；依 CLAUDE.md，UI 不套 TDD，改用截圖驗。
不適用: 同上，另以 shot 對照 base `docs/` 產物驗 HUD 零回歸。
### 綠
不適用: UI 外觀波，驗證改為下列指令與截圖。
`node_modules/.bin/eslint src/pages/Battle` → 0 錯；`node_modules/.bin/tsc -b --noEmit` → 乾淨。
`node_modules/.bin/vitest run` → 96/97 檔、1022/1025 綠；唯一紅的是 `src/pages/RpgRoom/lib/gameFrames.test.ts` 中 MapDeveloper 三條（react-games 本波進行中的檔，非我的所有權）。Battle 既有 `*Hud.test.ts`／`touchDirs.test.ts` 全綠，斷言未改。
AC10 regex 對 `src/pages/Battle`（排除 *Hud*）→ 0 筆。`git diff -- src/babylon src/core src/pages/Battle/*Hud* touchDirs.ts` → 空。
自查（PORT 5175，dev 與 base `docs/` 用 vite preview 同參數各跑一次，腳本 `/tmp/claude-1000/-home-bal-project-collect--worktrees-toybox/8fe49653-21c8-45aa-a187-045fcdc7ba12/scratchpad/flow.mjs`）：選炸彈超人 → 選單 → 單人開局，1440／390／觸控橫向 844×390／觸控直向 390：`scrollWidth<=innerWidth` 全過、console／page error 0、HUD 存在、觸控時 `touch-controls` 出現且 2 顆動作鈕、直向出轉橫向提示、全螢幕鈕寬 36（1440 為 40.5，因 root font-size 放大，base 同值）。
截圖（scratchpad）：
- 大廳 `/tmp/claude-1000/-home-bal-project-collect--worktrees-toybox/8fe49653-21c8-45aa-a187-045fcdc7ba12/scratchpad/list.png`、選單 `/tmp/claude-1000/-home-bal-project-collect--worktrees-toybox/8fe49653-21c8-45aa-a187-045fcdc7ba12/scratchpad/menu-1440.png`、`/tmp/claude-1000/-home-bal-project-collect--worktrees-toybox/8fe49653-21c8-45aa-a187-045fcdc7ba12/scratchpad/menu-390.png`
- 單人開局 `/tmp/claude-1000/-home-bal-project-collect--worktrees-toybox/8fe49653-21c8-45aa-a187-045fcdc7ba12/scratchpad/solo-1440.png`、`/tmp/claude-1000/-home-bal-project-collect--worktrees-toybox/8fe49653-21c8-45aa-a187-045fcdc7ba12/scratchpad/solo-390.png`、觸控 `/tmp/claude-1000/-home-bal-project-collect--worktrees-toybox/8fe49653-21c8-45aa-a187-045fcdc7ba12/scratchpad/solo-touch.png`、直向 `/tmp/claude-1000/-home-bal-project-collect--worktrees-toybox/8fe49653-21c8-45aa-a187-045fcdc7ba12/scratchpad/solo-portrait.png`
- base 對照 `/tmp/claude-1000/-home-bal-project-collect--worktrees-toybox/8fe49653-21c8-45aa-a187-045fcdc7ba12/scratchpad/base-solo-1440.png`、`/tmp/claude-1000/-home-bal-project-collect--worktrees-toybox/8fe49653-21c8-45aa-a187-045fcdc7ba12/scratchpad/base-solo-touch.png`：HUD 卡位置／配色／計時條一致，觸控搖桿與動作鈕位置一致（只外觀改）。

## 自我審查
- data-testid 全保留（含 battle-playing、net-peer-count、net-log、battle-overlay-action、rotate-prompt、touch-*、battle-fullscreen-btn）；`net-peer-count` innerText 仍是「n / m 對端」（`scripts/qa/babylonslim/mp.mjs` 讀它）。
- 合併 className 只用 clsx 串接（IconButton／Button／Tag 內部），沒用 `@/lib/utils` 的 `cn`；需要壓過元件 class 的（全螢幕鈕 size-9、w-full、gap-1）寫成 utility，靠 utilities layer 勝出，不靠 CSS 載入順序。
- lucide 圖示 strokeWidth 2.5；未新增依賴、圖檔、store 行為。

## 疑慮
- Room（建房／加入／開局多人）需要 Firebase，本機只自查到 GameList／GameMenu／SoloGame；Room 未開局與開局後版面請 qa 以兩個 context 驗。
- 遊戲結束浮層（battle-overlay）沒在自查中觸發到（需等一局結束），請 qa 抽驗。
- 房號輸入 placeholder「房號」在 VT323 下走 fallback 字形（mockup 亦如此）。
