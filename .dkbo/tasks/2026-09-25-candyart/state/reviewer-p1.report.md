# candyart-reviewer-p1 報告（計畫審查，波 0）

讀了 request.md、brief.md、design/spec.md；為了核對「素材能不能從 pen 匯出」和「檔案有沒有人擁有」，另外唯讀看了 `variant-A.pen` 的節點結構、`godot-candy-src/` 的目錄與 `project.godot`／`export_presets.cfg`、`src/pages/CandyCrush/index.tsx` 的版面，以及 `src/index.css` 裡用到 `.rpg-screen` 的地方。

## 需求覆蓋
- ✅ 「1 真糖果造型」→ 目標與 AC1、AC3（spec §4 的 A 方案）。
- ✅ 「2 用你建議」（designer 用 pen 畫、assets 轉 WebP）→ 全域約束第 10 條、波 1 assets 列。**但 pen 稿實際上缺好幾張素材，見下面「必改 2」。**
- ⚠️ 「3 全改」（棋子＋特效＋背景＋UI＋關卡畫面）→ 棋子、特效、背景、棋盤框、banner、HUD、結算、暫停、說明都有 AC。**漏了**：`src/pages/CandyCrush/index.tsx:197` 的載入畫面（黑底加 Candy 圖示加「載入中」）、`:100` 的頁首 h1／副標、`:109` 的工具列（說明鈕）。這三塊都在「全改」的範圍內，但沒有任何 AC 提到。要嘛寫進 AC7／AC8，要嘛在目標裡明寫「頁首與載入畫面不改」，讓人在關卡①看得到這個取捨。（非必改，但建議在關卡①問一聲。）
- ❌ **必改 1｜三題裁決的狀態寫錯了**：request 最後一段寫「使用者**尚未逐條回覆**，關卡①一併確認」，但 brief `## 全域約束` 最後一條寫成「spec 標『需裁決』的三條**已定**」。這跟需求原文互相矛盾。HUD 放兩側還是上方這一題，會直接決定 react 那一列的工作量。改寫建議：「三條為領導建議，**待關卡①使用者明確確認**：…」，並且把這三題列進關卡①的提問。

## 驗收標準可驗證性
- ❌ **必改 2｜AC1 的張數算錯**：spec §5 的表逐列加起來是 6×5＝30，加上 bomb、bomb_sprinkles 2 張，fx_* 5 張，bg_night 與 board_frame 2 張，**合計 39 張，不是 49**。spec 寫「合計 49 張」是筆誤，brief 照抄到 AC1、`## 共用契約` 第 1 列（「spec §5 的 49 個檔名」）、以及波次表波 1 assets 列。照現在的寫法，AC1 永遠判不過；assets 也可能為了湊數自己多做 10 張。三處都改成 39，並在 brief 註明「spec §5 的 49 為筆誤」（spec 只讀，所以覆蓋要寫在 brief 裡）。
- ❌ **必改 3｜AC1 要的素材，pen 稿裡沒有一部分，但全域約束又只准 assets「擴邊／切圖／轉檔」**。`variant-A.pen` 的「糖果特寫表」實際內容是：一般、條紋橫、條紋直、包裝各 6 色，特殊狀態只有 4 格（已引爆**只畫了紅、藍兩色**、選取、彩色炸彈），另外有 Flash、Select Halo。**稿裡沒有的**：`candy_{yellow,green,purple,orange}_wrapped_armed`（4 張）、`fx_sugar`、`fx_stripe_beam`、`fx_ring`。**要改圖層才拿得到的**：`candy_bomb_sprinkles`（要把糖粒單獨拆出來）、`bg_night`（Gameplay frame 要把 Board Frame 與 HUD 藏掉再以 2× 匯出）、`board_frame`（476 的框要重切成 256 的九宮格）。照現在的約束，assets 碰到這 7 張只能 ESCALATE，波 1 會卡住。改法二選一，寫進 brief：(a) 放寬 assets，准它依 spec §4.4／§5／§7 在 pen 的**工作複本**（寫在 scratchpad）補畫這 7 張；或 (b) 在波 1 前面加一波 designer 補稿。另外，pen CLI 只有 `--export` 匯出整個結果（png／webp，`--export-scale`），逐顆切圖要先整張匯出再裁切。建議在 assets 列寫明「中間檔 PNG 只准放 scratchpad」，並把難度升到 L（assets 的 M 檔只有 opus/low）。
- ⚠️ AC1「外觀與 `variant-A-candy-sheet.webp` 一致」和 AC4「整體對照 `variant-A-gameplay.webp`」是主觀判斷。可驗證的改寫：「qa 把 39 張拼成一張對照表（contact sheet），與 candy-sheet 並排截圖，逐格標『一致／差異：…』」；mipmaps 那條改成「`grep -L 'mipmaps/generate=true' assets/candy/*.import` 輸出為空」。
- ⚠️ **AC1／AC3 的 mipmaps 開了也不會生效**：`project.godot:30` 的 `default_texture_filter=1` 是 Linear，**不含** mipmap（Godot 4 要 3＝Linear Mipmap 才會用到）。spec §4.1 說「不需再設」是錯的。`project.godot` 沒有人擁有，所以建議在 AC3 加一句「Sprite2D 的 `texture_filter = TEXTURE_FILTER_LINEAR_WITH_MIPMAPS`（在 `candy_piece.gd` 裡設）」，這樣不用動到 project.godot。不這樣做的話，128 的貼圖在 1× 時縮半繪製會出現鋸齒或閃爍。
- ⚠️ AC6「單次消除粒子總量 ≤300」跟 §7 的數量互相矛盾：bomb＋bomb 整盤消除是 64 格，每格 8–12 顆再加 2k，至少 512 顆。建議 AC6 寫明預算規則（例如「單次消除總粒子數 = min(300, Σ)，超過時每格等比例降低，最少 2 顆」），並要求 godot 把實際數字 `print` 出來，讓 qa 能從 console 驗證。
- ⚠️ AC11「目測無明顯卡頓」判不了過或不過。改寫建議：「連鎖期間在 Godot 內每秒 `print(Engine.get_frames_per_second())`，qa 從 console 收集 1920×1080 下的最低值並記錄」。headless 是軟體 GL，門檻不要設死，只記錄數字交給人判斷。
- ⚠️ AC7「寬高比 ≥4:3」沒說是量誰的寬高比（viewport？`.rpg-screen` 容器？全螢幕？）。AC11 的三種尺寸也沒有一種落在 4:3 邊界附近。建議明寫「以 `.rpg-screen` 容器為準」，並在 AC11 加 1024×768（剛好 4:3，應該在兩側）與 1000×800（<4:3，應該在上方）兩張。
- ⚠️ AC7 寫「樣式照 spec §6.1、§6.2」，但 §6.2 指定的中文字型是 Noto Sans TC 700／900，跟全域約束「React 側中文沿用站內字型，不新增中文字型檔」衝突。建議 AC7 加一句「§6 的 Noto Sans TC 一律以站內字型代替」。
- ⚠️ AC8 的勝、敗、最後一關三種結算畫面，AC10 的「可正常過關」，qa 用截圖腳本很難靠真的玩到那裡。建議 brief 指定觸發方式，例如 qa 腳本在 iframe 的 context 內 `window.parent.postMessage` 一則既有格式的 `LEVEL_END`（不改協定），或用 URL 參數選關，讓 AC8 可以重現。
- ✅ AC2、AC5、AC9、AC10 其餘部分判得清楚。

## 檔案所有權
- ❌ **必改 4｜`src/index.css` 整檔劃給 react，但裡面有其他頁面共用的 class**：`.rpg-screen`（`src/index.css:849`）同時被 `RpgRoom/index.tsx:1128`、`GodotGame/index.tsx:152` 使用，`.rpg-cabinet` 看起來也是共用的。spec §6.1 又要求 HUD 疊在 `.rpg-screen` 內，react 很可能順手去改它，這樣會悄悄弄壞 RPG 遊戲室，而且沒有任何 AC 或 qa 會去看那兩頁。建議在 `## 全域約束` 加一條：「`src/index.css` 只准**新增** `.candy-*` 前綴的 class 與 `@font-face`，不得修改既有 class（尤其 `.rpg-screen`／`.rpg-cabinet`）」。
- ⚠️ `godot-candy-src/project.godot` 沒有人可改（assets 列只讀）。如果照上面的建議把 mipmap 設在節點上，就不需要動它；如果 godot 想改 default_texture_filter 或 theme 的預設字型，就會越界。請 brief 明寫「project.godot 不改」或劃給 godot。
- ⚠️ react 波 1 的獨佔資源欄是「—」，等於不能起 dev server 自己看 HUD。要嘛給 `dev:5174`（qa 在波 3 才用，不衝突），要嘛寫明「react 波 1 不起 dev，只靠 tsc 與 lint」。
- ⚠️ Fredoka 契約寫死檔名 `Fredoka-Bold.ttf`／`.woff2`，但 Google Fonts 上的 Fredoka 是 variable font，本機也沒有 `woff2_compress`／`pyftsubset`（我查過，而 assets 不准裝依賴）。建議契約允許「從 Google Fonts CSS API 直接取 wght=700 的 latin woff2，ttf 取 variable 檔，或 static Bold 擇一」，否則 assets 可能在契約上卡住。
- ✅ Godot 側：`_show_banner`、CPUParticles2D、下落 bounce 都在 `board_view.gd`（`:495`、`:433`、`:480`），godot 有擁有，AC3–AC6 沒有要動 `candy_sfx.gd` 或 `level_manager.gd`。`export_filter="all_resources"`，所以匯出會帶上 webp 與字型，不用改 `export_presets.cfg`。
- Minor：qa 的 `scripts/qa/candyart/**` 會被 wave-close 以 commit 帶進分支，變成 repo 根目錄下的新樹。建議改放 scratchpad，或在結案前明確決定去留。

## 波次切法
- ❌ **必改 5｜驗收全部擠在波 3，而且波 3 沒有 react**。有三個問題：(1) 波 1 react 的完成條件是 AC7／AC8，但那一波沒有 qa，reviewer 只讀 diff，視覺判不了；(2) 波 2 godot 的完成條件是 AC3–AC5（都是「對照稿」類的視覺標準），但那一波沒有匯出也沒有 qa，同樣判不了；(3) 到了波 3，qa 才第一次看到 HUD 和結算畫面，如果發現 AC7／AC8 的 BUG，**波 3 裡沒有 react 可以修**（react 不在成員裡），修復迴圈只能另開波。建議三選一或組合：(a) 波 2 godot 做完先 `pnpm candy:export`（宣告 `export:candy`），再加一列 qa（`dev:5174`）驗 AC3–AC5 與 react 的 AC7／AC8；(b) 波 3 加 react 列當修復待命；(c) 至少把波 1、波 2 的「完成條件」改成「程式層面＋board_test／tsc 綠」，視覺驗收統一在波 3，並在波 3 放 react。
- ✅ 波 1 assets 與 react 並行合理：react 只依賴字型的**路徑**契約，不依賴檔案內容。波 2 和波 3 依序依賴素材，順序正確。兩份共用契約都指定了擁有者與消費者，擁有者與消費者也都出現在所有權表。
- ⚠️ 波 2 和波 3 都是 godot 一人，而且都動 `board_view.gd`／`candy_piece.gd`。拆兩波的好處是每波各審一次，這沒問題；但波 3 的特效最容易拖時間，建議波 3 godot 的難度標 L。

## Minor
- `src/pages/CandyCrush/index.tsx` 現有的 `data-testid`（`hud-level`、`hud-score`、`result-stars`、`page-candy-crush`）建議在 AC9 寫明要保留，qa 腳本可以沿用。
- 窄螢幕（<4:3）退回上方橫條時，4 顆圓鈕要放在哪裡，AC7 沒寫（放在橫條內，還是維持浮在 iframe 右上）。
- AC8 的說明覆蓋層是「與結算卡同一元件」，建議寫明說明層的快捷鍵內容維持現狀、不增不減。
- 波 1 assets 的「frame 擴到 64 置中」：特寫表的 frame 是 84×84（1.5×），不是 56。匯出比例應該是 128 / 96 ≈ 1.333，這點可以提醒 assets。

## 結論
要改 5 處

## 測試
### 紅
不適用: 計畫審查，沒有程式碼與測試
不適用: 只讀 request／brief／spec 與專案檔
### 綠
不適用: 計畫審查，沒有程式碼與測試
不適用: 核對用的指令都是唯讀（jq 讀 pen 結構、grep、which）

## 自我審查
五條必改都附上了 brief 的段落或列，以及能核對的證據（spec 的張數、pen 的節點、檔案的行號）。沒有改任何檔。

## 疑慮
mipmap 那條是依 Godot 4 的 filter 列舉值（1＝Linear、3＝Linear Mipmap）推論的，沒有實際跑過。
