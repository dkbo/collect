# raceart-qa 報告（波 3）

`<S>` = `/tmp/claude-1000/-home-bal-project-collect--worktrees-raceart/895ef63a-71c6-404c-bd27-63bf146da9bd/scratchpad`

## 做了什麼
- 受測版本是 babylon 送 [DONE] 時 worktree 的狀態（未 commit，base 44925ca）。用 `vite build --outDir <S>/dist` 建置、`vite preview --port 5177` 開來測，測完已關。
- 零回歸基準：主樹 `docs/` 用 `vite preview --outDir docs --port 5176` 拍，拍完已關。截圖在 `<S>/base/`。
- 探測腳本沿用波 2，放在 `<S>/qa/`，本波加了幾個參數：`--fs`（canvas 全螢幕）、`--hashq`（query 放在 hash 內）、`--shoot-s`（車開到指定 s 時截圖）、`--shoot-fx`（甩尾／加速／騰空時截圖），另新增 `probe.mjs`（量 canvas 像素比）。worktree 沒有任何改動。
- 環境：headless chromium＋swiftshader。fps 在 1920 時 1–3、在 960 時 4–8，只記錄不判定。

### 判定
| AC | 判定 | 證據（頁面／視窗／對照稿） |
|---|---|---|
| AC9 車輛與場景 | ✅（護盾泡泡見疑慮 1） | 1920×1080 全螢幕 canvas，`?raceTier=desktop&raceNoDegrade=1`，對照 `variant-A-gameplay`／`sheet`／`track`：<br>• 車：Q 版圓胖車身、4 輪、駕駛戴安全帽（真人有白條、bot 有天線）、尾翼、排氣管、玩家色，見 `<S>/w3/fs-1-s104.png`、`fs-1-s141.png`。<br>• 「你」標記在安全帽上方、不蓋車身，見 `fs-1-s153.png`。<br>• 場景：起跑線、拱門（積木柱＋4 色三角旗）、看台＋棋子觀眾＋旗子，見 `d1920-1-countdown.png`、`bench-1-033292.png`。<br>• 紅白路緣只在彎道、場邊積木、棒棒糖樹、三角錐、桌墊棋盤地面，見 `fs-1-s104.png`。<br>• 道具箱：浮動、斜放旋轉、6 面多色加「?」，見 `fs-1-s104.png`。<br>• 跳台：黃黑斜紋、白唇口、護欄；固定加速帶（發光箭頭），見 `fs-1-s141.png`。<br>• 香蕉、龜殼 mesh：見 `bench-1-033292.png`。<br>• 跳台騰空：y 1.67，車底有影子，見 `fx1-1-fx-air.png`（800×450）。<br>• 甩尾車身偏航：見 `fx2-1-fx-drift.png`。<br>• 追尾相機平滑跟隨，地平線 y≈290，與 spec §7 一致。fov 隨速度微增有 `chaseCam.test` 涵蓋，畫面上無法量 fov。<br>檢查點不可見 ✅。 |
| AC10 材質光影 | ✅（波 3 修復三項已用 commit 7b47f48 複驗，見下方「波 3 修復複驗」） | 程式：`ToyLook({ tag: 'race', exposure/contrast 1.08 })`（`race.ts:453`）。<br>• 描邊：只登記車身（`race.ts:556`）、道具箱、香蕉、龜殼（`world.ts:296/310/313`）。路面、路緣、場景都沒描。畫面上車與道具箱有深色描邊，見 `fs-1-s104.png`。<br>• 投影：只有車身、輪胎、道具箱、香蕉、龜殼。路面、桌墊、跳台、路緣接收陰影。畫面上車影、道具箱影都有。<br>• Glow：只套在加速帶、道具箱（自身色 0.35）、火花芯、龜殼。加速帶發光加 bloom 清楚可見，見 `fs-1-s141.png`。<br>• 陰影 1024 PCF（`look.ts:127`，`quality.ts:64`）；FXAA、ACES、桌機 bloom（`look.ts:139–149`）。<br>• hardwareScaling：桌機 canvas 926/926（scale 1，dpr 1），mobile 540/810（scale 1.5），見 `<S>/w3/deskprobe.json`、`mobprobe.json`。 |
| AC13 檔位與降級 | ✅ | 開局都會印 `[race] tier …`：<br>• 無參數 1280×800 → `tier desktop`（`w3/default.json`）。<br>• 無參數 844×390 touch → `tier mobile`（`w3/deftouch.json`）。<br>• `#/battle?raceTier=mobile`（query 在 hash 內）→ `tier mobile`（`w3/mobhash.json`）。<br>自動降級：`?raceTier=desktop` 960×540 單獨跑，`23.8s degrade outline → 41.0s degrade glow → 53.4s degrade shadow`，順序正確（`w3/degrade3.json`）。<br>NoDegrade：`#/battle?raceTier=desktop&raceNoDegrade=1` 同條件單獨跑 150s，沒有任何 degrade（`w3/nodeg2.json`）。<br>mobile 檔：關描邊、Glow、bloom，陰影 512，scaling 1.5，drawCalls 30–34。mobile 還會自己降 shadow（`mobhash` 38.7s `degrade shadow`），符合「依序降」，因為 mobile 本來就沒有 outline 和 glow。 |
| draw calls（AC14 量測） | 記錄：N0 ≤ 62、N1 = 64 ≤ 100 ✅ | 1920×1080，`?raceTier=desktop&raceNoDegrade=1`：<br>• 單人 3 bot 一整局：37–57（`d1920`）、37–62（`fs`，全螢幕）。<br>• `&raceBench=1`：最高 64，起跑區擺滿道具時穩定在 64（`bench`）。<br>fps 在 swiftshader 下 0–3，只記錄。 |
| 零回歸（AC16 截圖部分） | ✅ | 主樹 docs（5176）與 worktree build（5177）同參數 1920×1080 拍「開局倒數第一幀」，並排圖 `<S>/new/cmp-{bomber,overcooked,tank}.png`（左 base、右新），SSIM 0.924／0.939／0.955。差異只有隨機箱子配置、計時起點差 1 秒、bot 位置與特效時間點；HUD 卡片、計時器、場景靜態物件都一致。<br>三款 console 的 tier 與 drawCalls 都印自己的前綴（`[bomber]`／`[kitchen]`／`[tank]`），沒有 error，也沒有 pageerror。<br>`git diff 44925ca -- src/core src/babylon/net src/babylon/hud.ts bomberFx kitchenFx tankFx bomber*/overcooked*/tank*.ts package.json pnpm-lock.yaml` 為空；`fx/look.ts` 對 base 沒有刪除行（只有新增）。 |
| console 前綴 | ✅ | 本波 race 所有局共擷取 863 則 info，全部是 `[race]` 前綴；error／pageerror 都是 0；warning 全是 swiftshader 的 `GPU stall`。race 原始碼只有 `race.ts:1157` 一處 `console.info`，內容是 `perfLogLine(…, 'race')`。 |


### 波 3 修復複驗（leader TASK：桌面洗白、火花全黑、拱門描邊）
受測版本：`git archive 7b47f48`（波 3 commit，已含 babylon 的 FIXED），解到 `<N>/src7b`，用 `vite build --outDir <N>/dist7b` 建置，再用 `vite preview --port 5177` 開。這樣不會吃到波 4 worktree 裡的半成品。測完已關。`<N>` = `/tmp/claude-1000/-home-bal-project-collect--worktrees-raceart/75fcbee4-0629-4684-836c-3c6d1f28da4d/scratchpad`
| 項目 | 判定 | 證據 |
|---|---|---|
| I1 木桌洗白 | ✅ | 1920×1080，`?raceTier=desktop&raceNoDegrade=1`。桌墊外的木桌是棕色木紋，不是先前的灰白色（約 216,216,215）。見 `<N>/w4/drift-1-countdown.png`、`drift-1-drift-500-57935.png`、`drift-1-drift-400-63254.png`。 |
| I2 火花全黑 | ✅ | 800×450 canvas 全螢幕，按住 d＋空白甩尾連拍（`<N>/w4/sp-1-d00..d13.png`）。HUD 顯示甩尾 1→2→3。甩尾 2 時後輪有橘色火花點，甩尾 3 時有紫色火花點，排氣管之間的紫色火花芯有 Glow。全程沒有黑方塊。放大拼圖見 `zoom-sparks.png`（甩尾 3）、`early.png`（甩尾 1–2）。藍色那一段沒拍到，因為 swiftshader 下 fps 只有 2–5，暫用火花又只有 0.3s 壽命；波 4 會換成粒子再連拍。 |
| 拱門去描邊 | ✅ | 拱門的積木柱與橫幅都沒有深色輪廓線，車身與道具箱仍有描邊。見 `drift-1-countdown.png`（近景柱）、`sp-1-d08.png`、`sp-1-d12.png`。 |
console：只有 swiftshader 的 `GPU stall due to ReadPixels` 警告（截圖造成），沒有 error，也沒有 pageerror（`<N>/w4/drift.json`、`sp.json`）。

## 測試
### 紅
不適用: qa 不改碼也不寫單測；本波沒有 BUG 回報、沒有修復前後對照。
`node <S>/qa/play.mjs --base http://localhost:5177/collect/ --game race --query raceTier=desktop --width 960 --height 540 --drive <S>/qa/auto.mjs --scenario race --secs 120 --out <S>/w3/degrade`（4 個瀏覽器並跑）→ 只出現 outline、glow，沒有 shadow。原因是 fps 1–2 時每幀超過 500ms，FpsWatch 把這種幀當成暫停而清空視窗；改成單獨跑才看到完整的降級鏈，這是環境造成的，不是 BUG。
### 綠
`node <N>/qa/play.mjs --base http://localhost:5177/collect/ --query 'raceTier=desktop&raceNoDegrade=1' --width 1920 --height 1080 --drive qa/drive-drift.mjs --first-countdown`（7b47f48 build）
`{"error":null,"brief":[{"ctx":1,"infos":21,"errors":4,"pageErrors":0,"shots":11}]}`（4 則為 ReadPixels 警告）
`node <N>/qa/play.mjs ... --width 800 --height 450 --fs 1 --drive qa/drive-drift2.mjs`
`{"error":null,"brief":[{"ctx":1,"infos":13,"errors":4,"pageErrors":0,"shots":15}]}`，HUD 甩尾1→2→3，火花橘／紫、無黑塊
`node <S>/qa/play.mjs ... --query 'raceTier=desktop&raceNoDegrade=1' --width 1920 --height 1080 --fs --drive <S>/qa/auto.mjs --scenario race --shoot-s 20,60,104,118,141,149,153,160 --first-countdown --out <S>/w3/fs` → `{"error":null,…,"pageErrors":0}`，drawCalls max 62
`node <S>/qa/play.mjs ... --query 'raceTier=desktop&raceNoDegrade=1&raceBench=1' --width 1920 --height 1080 --secs 40 --out <S>/w3/bench` → drawCalls max 64，pageErrors 0
`node <S>/qa/play.mjs ... --query raceTier=desktop --width 960 --height 540 --drive <S>/qa/auto.mjs --scenario race --secs 150 --out <S>/w3/degrade3` → `692 tier desktop | 23769 degrade outline | 40955 degrade glow | 53419 degrade shadow`
`node <S>/qa/play.mjs ... --hashq 'raceTier=desktop&raceNoDegrade=1' --width 960 --height 540 --canvas --drive <S>/qa/auto.mjs --scenario items --shoot-fx --secs 150 --out <S>/w3/nodeg2` → 只有 `tier desktop`，沒有 degrade
`node <S>/qa/play.mjs ... --hashq raceTier=mobile --width 844 --height 390 --touch --out <S>/w3/mobhash` → `tier mobile`，drawCalls 30–34
`node <S>/qa/play.mjs ... --query raceTier=mobile --width 844 --height 390 --touch --drive <S>/qa/probe.mjs --out <S>/w3/mobprobe` → canvas `{"w":540,"cw":810,"scale":1.5}`；desktop probe 的 scale 是 1
`for g in bomber overcooked tank; do node <S>/qa/play.mjs --base http://localhost:5177/collect/ --game $g --width 1920 --height 1080 --first-countdown --out <S>/new/$g; done` ＋ `ffmpeg … -lavfi ssim` → All 0.924／0.939／0.955，errors 0
`node_modules/.bin/vitest run src/babylon/games/raceFx src/babylon/fx/look.shadowCenter.test.ts` → `Test Files 12 passed (12)`、`Tests 72 passed (72)`

## 自我審查
- 沒改 worktree：可改欄是「—」。腳本、截圖、build 產物都在 `<S>`；5176、5177 的 preview 都已關，確認沒有 listen。
- 探測用的 AI 在 fps 1–3 下 dt 被夾到 500ms，所以常開出路面（`fs-1-s104`、`s141` 自己的車在路外）。這是探測方式的限制；同一份 AI 在波 2 的 640×360 下能跑完整局。截圖只用來判美術，不用來判手感。
- AC11（特效）、AC12（React HUD）、AC18 的版面三檔照波次表屬於波 4，本波不判定。畫面上仍是暫用的文字 HUD 面板，mobile 截圖也還有站台 header 疊在 canvas 上，都留給波 4。

## 疑慮
1. **護盾泡泡沒有在遊戲畫面裡拍到**：自己的車在探測時幾乎都是最後一名，抽不到 shield；bench 模式下 bot 只拿著道具、不會使用。程式面已確認：`carVisual.ts:133` 建 d3.2、segments 24 的球體，fresnel 邊緣、alpha 0.22，`race.ts:623` 依 `own.shield` 開關。波 2 實機看過舊版泡泡。建議波 4 qa 做特效連拍時補拍。
2. **babylon report 寫「描邊含拱門」與實作不符**：實際程式裡拱門沒有描邊（`world.ts:185` 沒加 outline）。這與 brief AC10「描邊只描車、道具與道具箱」一致；brief 優先於 spec §5，所以判 ✅，只是 report 的文字不準。
3. **fps=0 的 perf log**：swiftshader 下 fps 低於 1 時會連續印 `fps=0`。AC14「跳過第一次的 0」指的是首次取樣，不算違反。
4. **車寬（leader DECISION：對照 variant-A-gameplay）→ 沒有明顯偏離**：並排圖 `<S>/w3/cmp-carwidth.png`（左稿、右 `fs-1-s153`，都縮成 960×540）。1920 座標下，稿裡自己的車含尾翼與輪胎寬約 414px（x 766–1180），實機約 380px（x 770–1150）；安全帽頂端稿 y≈630、實機 y≈620；兩邊車都在畫面水平置中、佔下方約 1/3。實機反而比稿小約 8%。spec §7 寫的「車寬約 260px」跟它自己的稿不一致，判斷是 spec 估算有誤，不是實作偏離，不發 BUG。
5. **天色**：實測天空是淺灰藍，比稿子的藍淡一點（babylon 疑慮 2），可接受。
