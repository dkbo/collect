# bomberart-babylon-hud 報告（波 4）
## 做了什麼
- `src/index.css:1385` reduced-motion 段 `.bomber-timer-urgent` 從原生 `animation: none` 改成 `@apply animate-none;`（編譯產物仍是 `@media (prefers-reduced-motion:reduce){.bomber-timer-urgent{animation:none}}`，在基礎規則之後，覆寫有效）。
- `src/index.css:1250-1253` `.bomber-col-right` 另設 `top: max(原本的 18px×scale+safe-top, max(0.5rem, safe-top) + 2.25rem + 6px)`：右欄至少讓出 Battle 浮動全螢幕鈕（SoloGame／Room 同一顆，top `max(0.5rem,safe-top)`、`size-9`）再加 6px。用 rem 對齊按鈕本身的單位，站內根字級變大（1920 下按鈕 40px）也跟著退；左欄不動。只改 CSS，未碰 BomberHud.tsx／Room／SoloGame。
## 測試
### 紅
`node .claude/skills/verify-web/scripts/shot.mjs --url file://<scratchpad>/hud/dist/inline.html --width 960 --height 540 --eval "$(cat <scratchpad>/hud/overlap.js)"`（harness＝真 BomberHud＋與 Battle 同 className 的全螢幕 Button，改碼前 build；overlap.js 量按鈕與右欄第一張卡的交集面積，及右欄底是否超出視窗）
960×540 → `btn [916,8,952,44] card0 [854,18,942,173] overlapPx 676 PASS false`；1920×1080 → `overlapPx 182 PASS false`；1280×720 → `overlapPx 650 PASS false`
### 綠
同一條指令（改 CSS 後重 build harness）
960×540 → `card0 [854,50,942,205] overlapPx 0 colBottom 370 PASS true`；1920×1080 → `card0 top 56 overlapPx 0 colBottom 695 PASS true`；1280×720 → `overlapPx 0 PASS true`；844×390（膠囊模式，右欄 hidden）→ `PASS true`
完整閘：`node_modules/.bin/eslint .` 無輸出（0 錯）；`node_modules/.bin/tsc -b --noEmit` exit 0；`node_modules/.bin/vitest run` → `Test Files 42 passed (42) / Tests 409 passed (409)`
截圖：`/tmp/claude-1000/-home-bal-project-collect--worktrees-bomberart/2856617c-1112-4d67-bdad-ff53ed8eb08d/scratchpad/green-960.png`（P2 編號完整露出、按鈕在卡上方）
## 自我審查
- 範圍只兩條，改動 3 行＋1 行註解，都在 `.bomber-*` 既有 class 內，沒動其他 class。
- 左右欄頂部在寬畫面會差約 20–32px（右欄較低），960×540 整欄底 370px，離下緣與底部計時器都遠，不遮棋盤關鍵區（截圖目視）。
- `max-height: 500px` 下 `.bomber-col` 是 hidden，新 top 不影響膠囊模式。
## 疑慮
- 無。若日後全螢幕鈕尺寸或位置改動（Room.tsx／SoloGame.tsx 的 className），這裡的 2.25rem／0.5rem 要一起改，已寫在 CSS 註解。
