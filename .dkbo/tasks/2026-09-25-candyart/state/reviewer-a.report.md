# reviewer-a 報告（波 task：整枝評議 22413de..52417a9）

## 做了什麼
讀 `waves/task.diff`（104 檔）、brief、spec §4–§7；逐檔讀 `src/pages/CandyCrush/**`、`src/index.css` 新增段、`candy_piece.gd`、`board_view.gd`、`scripts/fx/candy_fx.gd`、4 支 shader；比對 master 版 `index.tsx` 的 data-testid 與說明內容；核對 39 張素材尺寸與 `.import`；以 build 驗字型網址吃到 base；跑 board_test 與 CandyCrush vitest。

## 規格合規
- AC1 ✅ 39 張 WebP，尺寸逐一符合 §5（32×128²、160²、192²、384²、1024×64、32²、1920×1080、256²）；目錄無 PNG／JPG；`grep -L 'mipmaps/generate=true'` 輸出空。對照表屬 assets／qa report，不在 diff 內，未複核。
- AC2 ✅ `godot-candy-src/assets/fonts/Fredoka-Bold.ttf`＋.import＋OFL.txt；`public/fonts/Fredoka-Bold.woff2`＋OFL.txt。
- AC3 ✅ Sprite2D＋`TEXTURE_FILTER_LINEAR_WITH_MIPMAPS`（`candy_piece.gd:76`），31 種依 `texture_path()` 對應（`:82`），缺檔退回 `_draw()`（`:196`），`COLORS` 為 §4.3 本色（`:20`），呼吸 1.14↔0.98＋halo alpha 0.6↔1.0 同步（`:175`）。
- AC4 ✅ `bg_night` cover（`board_view.gd:99` `bg_cover_scale`）、`board_frame` NinePatch 56px @2x ×0.5（`:131`）、格子 53×53 圓角 9 雙色交替（`:156`），Z_BOARD=-2 在光暈之下。
- AC5 ✅ `BANNER_STYLES` 字級／外框／落影對齊 §6.5（`board_view.gd:47`），Fredoka、Sweet Crush! 走漸層 shader。
- AC6 ✅ squash 1.15→TRANS_BACK、fx_flash ADD、fx_sugar 糖粒、連鎖 1+0.1k／+2k、combo 0.25s 彈入＋0.35 停＋0.25 上升淡出、條紋 sheen shader＋beam、包裝扭結 shader＋ring＋4px 震動、已引爆 0.6s 脈動、炸彈糖粒緩轉＋Line2D 電光 0.03s、落地 (1.1,0.9) 0.1s、Sweet Crush 金閃 0.05s 連響；shader 只掛特殊糖；`particle_budget` 最大餘數法、每格保底 2、`print("[fx] particles=")`（`board_view.gd:627`）與 `[fx] fps=`。
- AC7 ✅ 4:3 判斷＋k<0.6 退橫條（`candyHud.ts:18`），左右欄內容與 §6.1 一致，步數 ≤5 紅＋1s 脈動，刻度 50/75/100；`@font-face url('/fonts/…')` 經實測 build 產出 `url(/collect/fonts/Fredoka-Bold.woff2)`。全螢幕隱藏說明鈕屬既有 ruling。
- AC8 ✅ 勝：緞帶、星星 0.2s 間隔彈出、0.8s 滾分、三星「完美通關！」、最後一關金字＋「從第 1 關再玩」；敗／暫停／說明照 §6.4；說明 6 列快捷鍵文字與 master 逐字相同。
- AC9 ✅ h1／副標／工具列／載入畫面改 A 配色與字型（載入底色紫夜空為既有 ruling）。
- AC10 ✅ 資料仍只來自 store／bridge；master 所有 data-testid（page-candy-crush、candy-hud、hud-level／score／moves／progress、candy-iframe、candy-pause-overlay、candy-result、result-stars／replay／next／restart、candy-mute／pause／fullscreen-btn）全保留；bridge／store／board.gd／data／project.godot／export_presets 皆未動（diff 名單比對所有權為空）；board_test ALL PASS；wave-close 3 的 DK_TEST_CMD 綠。
- AC11 ✅ `public/candy/index.pck` 與腳本同一 commit，pck 內含波 3 修正後字串（`COMBO_TEXTS`、`textureLod`），瀏覽器行為以 qa report 為準。
- AC12 ✅（依 qa report；本評議不重截圖）fps 最低 24 交人判斷。
- 全域約束 ✅ `@/*` 全用、自訂 class 皆 `@apply`、無 JPG/PNG、index.css 只新增 `.candy-*`／`@font-face`／`@keyframes candy-*`（已裁定），無越界檔。

## Important
無。

## Minor
### 累積 Minor 判定（merge 前皆不必修）
- minor 1 k 無下限 → 已修（`MIN_SIDE_SCALE=0.6`，`candyHud.ts:8`），結案。
- minor 1 3★ 刻度 96% → 已修（100%，`CandyHud.tsx:11`），結案。
- minor 1 首幀閃兩側 → 已修（`useLayoutEffect`，`index.tsx:86`），結案。
- minor 1 TopBar safe-area／320px 重疊 → 已修（`CandyHud.tsx:106`＋compact 排法），結案。
- minor 1 2★ ceil → 已修（`Math.floor`，`candyHud.ts:50`），結案。
- minor 1 board_frame 大落影 → 已由 FrameShadow 補（`board_view.gd:115`），結案。
- minor 1 @keyframes candy-* → 已裁定允許，留。
- minor 1 woff2 內部 family 名 Fredoka Light → `@font-face` 以 family 宣告為準，不影響，留。
- minor 1 AC12 全螢幕截圖 → brief 已改、非程式，結案。
- minor 2 FrameShadow 壓暗框內 → qa 實測未偏暗（同 minor 2 第 5 條），留。
- minor 2 320px 星級條擠 → 已修（compact 時星級條獨立第三列，`CandyHud.tsx:135`），結案。
- minor 2 banner 漸層 shader 近白辨識 → 目前只 Sweet Crush! 用、無彩色 modulate（combo 爆光是子 Sprite 自帶材質），不會觸發，留；日後給 banner 上色前要改（`banner_gradient.gdshader:18`）。
- minor 2 banner 落影 y=4 推定 → 設計參數，留。
- minor 2 缺檔退回綠仍三角 → 只在缺貼圖時出現，留。
- minor 2 Minor 1 框內影子 → 同上，留。
- minor 2 FitDialog 無下限 → 只在極矮全螢幕，留（可選：scale<0.7 改捲動）。
- minor 3 combo 0.33s → 已修（0.17＋0.08=0.25，`board_view.gd:822`），結案。
- minor 3 炸彈 shader 隱式導數 → 已修（分支內全 `textureLod`），結案。
- minor 3 sprinkles 缺檔炸彈變白 → 已修（`candy_piece.gd:126`），結案。
- minor 3 combo 文字重複 → 已修（`COMBO_TEXTS` 單一來源，`board_view.gd:30`），結案。
- minor 3 scratchpad fx_test 假紅 → 不進版控，留。

### 本次新發現
- 素材 `.import` 全為 `compress/mode=0`（無損）＋mipmaps，`index.pck` 由 66KB 漲到 1.49MB（spec 估 0.4–0.6MB）；Web 首載多約 1MB，可考慮改 lossy（mode=1），非 AC 要求。`godot-candy-src/assets/candy/candy_red.webp.import:18`
- 炸彈 shader 在糖粒像素上每像素約 24×(9+1)=240 次取樣，盤上炸彈多時手機 WebGL 可能掉幀；同時最多數顆，現況可接受。`godot-candy-src/shaders/candy_bomb.gdshader:38`
- `prefers-reduced-motion` 覆寫用原生 `animation: none` 而非 `@apply animate-none`，與檔內既有寫法一致（`src/index.css:387`），字面上偏離 @apply 約束但不在 class 定義內，留。`src/index.css:1194`

## 測試
### 紅
不適用: 審查角色不寫測試，只複跑既有測試確認現況。
不適用: 無新測試需取紅。
### 綠
`node_modules/.bin/vitest run src/pages/CandyCrush` → Test Files 1 passed, Tests 20 passed
`godot --headless --path godot-candy-src -s tests/board_test.gd` → board_test: ALL PASS
`vite build --outDir <scratchpad>/dist` → CSS 內 `url(/collect/fonts/Fredoka-Bold.woff2)`（build 產物只在 scratchpad）
`waves/3.test.log`（wave-close 3 DK_TEST_CMD）→ 25 files / 297 tests passed

## 自我審查
逐條 AC 以程式碼與 spec 數值對照；未重跑瀏覽器截圖，AC11／AC12 的執行面依 qa report。

## 疑慮
無。
