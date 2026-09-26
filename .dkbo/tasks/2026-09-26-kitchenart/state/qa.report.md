# qa 報告（波 3）
截圖根目錄 SP=`/tmp/claude-1000/-home-bal-project-collect--worktrees-kitchenart/902f80d4-f1fa-4c2a-9a35-92957d042cd8/scratchpad`，以下路徑都相對 SP。
- **最終產物**：包含 babylon 波 3、review Important 修正與 BUG-1 修正。建置指令 `node_modules/.bin/vite build --outDir SP/dist --emptyOutDir` rc=0，`vite preview --port 5177`（index-D-D5R3OK.js），`git status docs` 無變更。
- **base 產物**：`git archive d8ca4df` 的建置，放在 `SP/base-dist`。沿用波 1 qa 的產物，已用 `diff -r` 比對 `git archive d8ca4df src public`，內容一致。
- **主樹基準**：先確認 `git diff 64bbc74 d8ca4df -- src public` 為空，也就是主樹 `docs/` 可以直接當 base 基準。在主樹 `vite preview --outDir docs --port 5176` 截 bomber／tank／race／overcooked 四款，截完即關。
- **探測腳本**：`SP/qa/kitchen.mjs`，模式有 solo／tier／round／vid／vid2／rkey／clock／pick；另有 `SP/qa/mp.mjs`、`bundle.mjs`、`sbs.mjs`。repo 內零改動。
- **環境限制**：swiftshader headless 下，1920×1080 約 2fps、640×360 約 10fps。短時效果改用錄影（webm）加 ffmpeg 抽幀。

## 做了什麼（逐條判定）

### AC1 共用模組 ✅
- `git diff -M d8ca4df --name-status`：toon／geometry／thin／thinSlots／burstQueue／perfLog／rig／upright 連同各自的 `*.test.ts` 都是 R（rename），落在 `src/babylon/fx/`。quality、look 也搬了並參數化。
- 搬過去的 9 個 test 檔，去掉 import 行之後的 diff 行數都是 0。`bomberFx/fxCurves.test.ts` 只改了 import（拆成 `@/babylon/fx/curves` 與 `bomberFx/fxCurves`）。
- bomber 端維持原樣：
  - 仍用 `tag: 'bomber'`，console 是 `[bomber] tier desktop`，沒有任何 `[kitchen]` 行。
  - 網址參數 `bomberTier`／`bomberNoDegrade` 由 `fx/quality.test.ts` 覆蓋。
- 打包：只有一個 `Battle-*.js`，沒有新增 chunk，所以兩款共用同一份模組、沒有重複打包。

### AC2 取湯修正 ✅
- `overcookedKitchen.ts` 相對 base 只改了取湯條件那一處（+2 −1，見 AC11）。
- 實機（`round3/r.json`）：煮好後在快焦窗內取湯成功，拿去出餐，score 0→20、出餐 1。

### AC3 角色 ✅（兩項待驗）
- 單人 P1 紅色、白色廚師帽、白圍裙，頭上有「你」標記，玩家卡也有「你」與 P1（`f/d1920-2-later.png`）。
- 手持物在胸前：perfFill 下手上拿湯，見 `f/fill-2-later.png`。
- **待驗：砍菜動作與朝向。** 640 錄影逐幀放大（`vid/z-chop2.png`，6.0–7.6s）只看得出角色站在砧板旁、姿勢有細微變化，解析度不夠判定「砍」的動作和是否面向砧板；960 以上 fps 太低又走不到位。請在關卡③實機目視。
- **待驗：固定 4 色與跨 client 一致。** `dkbo-collect` 仍 NOT_FOUND，見 AC11。

### AC4 場景物件 ✅（含 BUG-1 修正後重驗）
- 地面棋盤、背牆磁磚（掛架、KITCHEN 牌、時鐘、出餐窗暖光）、側牆、食材箱 ×2、砧板 ×2、爐台加鍋 ×2、出餐口（黃台、瀝架、鈴）、盤架，8 種物品外觀可辨（`f/fill-2-later.png`）。場外補成深青底色，對照 `variant-A-gameplay` 色調一致。
- **BUG-1（已 FIXED 並重驗 ✅）**：出餐台箭頭原本畫成「<<」、指向瀝架，稿上是「>>」。
  - 修前 `z-serve-arrow.png`，修後 `z-serve-arrow-fixed.png`（「>>」指向鈴）。
  - 這個問題波 2 就有，我波 2 驗收時漏看。

### AC5 材質光影 ✅
- 桌機：描邊只出現在玩家、手持物、站點物品與站點本體；只有玩家投影；開火爐圈、出餐窗、快焦鍋緣有 glow。
- mobile（`f/m844-2-later.png`）：沒有描邊，console 記一次 `degrade shadow`。
- 畫面偏灰（波 2 疑慮）：以 exposure 1.3 修正後，地面、檯面明顯提亮，沒有過曝（`f/d1920-2-later.png` 對照 `variant-A-gameplay`）。

### AC6 特效 ✅（部分短時效果只能低解析確認）
逐列連拍與錄影如下。640×360 fullscreen、desktop NoDegrade；連拍圖為 `sh-*.png`，由 `round2`／`round3` 組成。

| §7 列 | 證據 | 判定 |
|---|---|---|
| 切菜中（進度條） | `sh-chop.png`、`vid/z-chop.png`：砧板上方綠色進度條逐步填滿 | ✅；回彈、碎片解析度不足，看不清 |
| 切好 | 綠勾章出現，生菜換成切好的菜（`vid/z-chop2.png` 末 3 格） | ✅ |
| 煮中、煮好 | `sh-cook.png`：綠進度環加爐圈發光 → 綠勾 | ✅；火苗、蒸氣細節看不清 |
| **快焦** | `sh-qburn.png`、`sh-qburn3.png`、`f/fill-2-later.png`：紅環（填充量＝progress）、「!」章、鍋緣紅光 | ✅ |
| 焦了 | `sh-burnt.png`：鍋變黑；拿起後 HUD 手持 `burnt-v`；放到 (10,3) 檯面丟棄 | ✅；黑煙與 ember 在 640 解析度下很淡 |
| 拾取、放下 | `vid/t-pick.png` | 180ms 弧線 headless 看不清，只確認手持切換 |
| 出餐 | `vid/z-serve.png`（17.2–18.2s，12fps）：「+20」浮字上升、金星、鈴閃光 | ✅ |
| guest 外插、訂單 id、消失原因 | 純函式單測 `kitchenFx/*.test.ts`，vitest 綠 | ✅（單測，由 babylon 負責） |

### AC7 HUD ✅
- 桌機 1920×1080（`f/d1920-2-later.png`）、960×540 fullscreen（`f/d960-2-later.png`）：
  - 左上訂單卡：蔬菜湯／肉湯、`+20` 徽章、inline SVG 成品圖、步驟列、計時條與秒數。
  - 右上計時膠囊：時間、分數、出餐數。
  - 左側玩家卡：只顯示 1 張，有「你」與 P1。
  - 右側食譜：兩道菜各 `+20`，預設展開。
- 計時條分級：DOM 取樣的 `data-level` 為 >20s `ok`、20–10s `warn`、<10s `danger`，對應 40s 的 50%／25%，符合規格。`danger` 會出現紅框與三角警示（`vid/t-expire.png`）。
- 新單滑入、逾時：`vid/t-expire.png`（53.9–55.1s）依序為紅框 → 卡片掉落淡出並浮出紅色「-10」→ score 20→10 → 新單滑入。DOM 記到 `expired:-10`。
- 出餐：`vid/t-serve.png` 中 HUD 卡片打勾後飛出，DOM 記到 `served`。
- 分數為 0 時逾時不顯示浮字：`round/r.json` 的 `08-expire` 在 score 0 時，leaving 為 `{r:'expired', f:null}` ✅。
- 最後 15 秒（`k/clock.json`）：`data-urgent=true`，顏色 rgb(255,59,78)，animation `kitchen-pulse`。
- 食譜收合（`rk/a.json`）：按 R 為 open true→false→true，點標題為 false→true。R 監聽掛在 `KitchenHud.tsx:334` 的 useEffect，有 cleanup；離開遊戲後 keydown 監聽數 3→1，HUD 節點也消失。
- `prefers-reduced-motion`：`index.css` 裡只對 `.kitchen-order-danger` 與計時設 `animate-none`，紅框保留。
- 手機 844×390 fullscreen（`f/m844-2-later.png`）：訂單縮成膠囊、計時窄版、玩家卡隱藏、食譜收成圓鈕 ✅。
- 開局倒數（`vid2/t-count.png`）：奶油底卡加紅色 3/2/1，是 bomber 同一套主題，已經不是舊的文字面板 ✅。
- 結算（`k/clock.json`）：`setOverlay` 顯示「🍲 時間到！團隊分數 N、出餐 N 份」，沒有星數；約 10 秒後自動回到 countdown。
- HUD 節點：tank、race 都沒有 `[data-kitchen-hud]` 也沒有 `[data-bomber-hud]`；bomber 只有 `[data-bomber-hud]`。

### AC8 檔位與降級 ✅
| 條件 | console |
|---|---|
| `kitchenTier=desktop&kitchenNoDegrade=1` | `[kitchen] tier desktop`，整局沒有 degrade |
| `kitchenTier=mobile` 844×390 | `[kitchen] tier mobile`、`degrade shadow`，drawCalls=16 |
| `kitchenTier=desktop`（不帶 NoDegrade）1280×720 | `degrade outline` → `degrade glow` → `degrade shadow`，依序出現；drawCalls 39→20 |
hash 內 query 與觸控判定波 2 已驗，本波未變動。

### AC9 效能量測（N1 ✅，d 待驗）
- 每 2 秒輸出 `[kitchen] drawCalls=N fps=N`，沒有 0／Infinity。
- **N1 = 78**：條件 `?kitchenTier=desktop&kitchenNoDegrade=1&kitchenPerfFill=1`，單人、所有存放格都有物品、手上拿湯、兩鍋都在快焦（最壞情況），`f/fill.json` 連續三次都是 78。空場 desktop 39、mobile 16。
- **d 待驗：** 單人量不到角色增量，多人又 NOT_FOUND。若 d=3（身體＋描邊＋陰影 pass 的估值），78+9=87 ≤ 90；d ≥ 5 就會超標。
- fps（swiftshader，只記錄）：1920 約 2、960 約 5、844 mobile 17–24。

### AC10 bundle ✅
| chunk | base gzip（B） | 改後 gzip（B） | 增量 | 門檻 |
|---|---|---|---|---|
| vendor-babylon | 447856 | 446635 | −1221 | ≤ 10240 ✅ |
| Battle | 67267 | 83598 | +16331 | ≤ 25600 ✅ |
| 新 chunk | — | 無 | 0 | |
- 數字用 `node SP/qa/bundle.mjs SP/base-dist SP/dist` 量（gzip level 9）。babylon 報告用的是 vite 的 KB，兩邊一致。

### AC11 行為不變與零回歸 ✅（多人待驗）
- `DK_TEST_CMD`：eslint rc 0、tsc rc 0、vitest 54 files／514 tests 全綠（最終碼）。
- `git diff d8ca4df -- src/core src/babylon/net src/babylon/hud.ts` 為 0 行。
- `overcookedKitchen.ts` 只改了取湯條件那一處。`package.json`、`pnpm-lock.yaml`、`public/` 都沒變。
- `src/index.css` 沒有刪任何既有行，新增的 class 都是 `.kitchen-*`。
- overcooked 完整一局（`round3/r.json`，最終碼）：
  - 流程：取菜 → 切 → 煮 → 快焦 → 焦 → 拿起丟到檯面 → 再煮一碗出餐 +20 → 訂單逾時 → 結算「團隊分數 0、出餐 1 份」→ 自動再開一局，phase 回到 playing。
  - pageErrors 0，console error／warning 0（ReadPixels 警告除外）。
- bomber、tank、race 單人（最終碼，1920×1080，同網址參數），並排圖在 `sbs2/*`：
  - console 全部無錯。
  - 像素差 bomber 18–23%、tank 18%，原因是每局隨機的箱子配置與 AI 進度（swiftshader 時間漂移）；目視兩邊造型、配色、HUD 一致。race 差 0.1–0.6%。
  - bomber 的 `[data-bomber-hud]` 正常。
- **多人：待驗（dkbo-collect NOT_FOUND）。** `mp/` 以 `--dns` 建房時，console 出現 `Database 'dkbo-collect' not found`，建房逾時。沒有改連 `(default)` 或其他 DB。裁決⑦的兩分頁驗證也因此待驗。

### AC12 驗收截圖（對應 AC 與比對稿）
| 圖 | 條件 | 對應 AC | 比對稿 |
|---|---|---|---|
| `f/d1920-2-later.png` | desktop NoDegrade 1920×1080 | AC3／4／5／7 | variant-A-gameplay |
| `f/d960-2-later.png` | desktop NoDegrade 960×540 fullscreen | AC7（960 基準版面） | variant-A-gameplay |
| `f/m844-2-later.png` | mobile 844×390 fullscreen | AC5／7／8 | spec §8 手機 |
| `f/fill-2-later.png` | perfFill 1920×1080 | AC4（8 種物品）／AC6 快焦／AC9 | variant-A-sheet |
| `sh-chop.png`、`sh-cook.png`、`sh-qburn3.png`、`sh-burnt.png` | 640×360 fullscreen 連拍 | AC6 | spec §7 |
| `vid/run.webm` 與 `vid/t-*.png`、`vid/z-*.png` | 錄影抽幀 | AC6 出餐／AC7 新單、逾時、出餐飛出 | spec §7、§8 |
| `vid2/t-count.png` | 倒數 | AC7 倒數 theme | bomber 倒數 |
| `sbs2/*.png` | bomber／tank／race 基準對照 | AC11 | base（docs） |
| `z-serve-arrow.png`、`z-serve-arrow-fixed.png` | BUG-1 修前、修後 | AC4 | variant-A-gameplay |

## 測試
### 紅
- BUG-1 修前：`node SP/qa/kitchen.mjs tier http://localhost:5177/collect/ SP/k/d1920 --qs 'kitchenTier=desktop&kitchenNoDegrade=1' --secs 6`，裁切 (8,0) 得到 `SP/z-serve-arrow.png`：箭頭是「<<」。
- 腳本自身的誤報：`round` 模式 800×450 fullscreen、E 只按 60ms 時，held 一直是 none（`SP/round/r.json`）。最小重現 `node SP/qa/kitchen.mjs pick … --w 640 --h 400` 得到 `held1: raw-v`，證明遊戲本身正常，是低 fps 漏了按鍵。腳本改成按 150ms 後正常。
### 綠
- `node_modules/.bin/eslint . && node_modules/.bin/tsc -b --noEmit && node_modules/.bin/vitest run` → ESLINT_OK、TSC_OK、Test Files 54 passed／Tests 514 passed
- `node SP/qa/bundle.mjs SP/base-dist SP/dist` → `{"delta":{"vendorBabylon":-1221,"battle":16331,"newChunks":0},"pass":{"vendorBabylon":true,"battle":true}}`
- `git diff d8ca4df -- src/core src/babylon/net src/babylon/hud.ts | wc -l` → 0；`git diff d8ca4df --stat -- src/babylon/games/overcookedKitchen.ts` → 1 file, 2 insertions(+), 1 deletion(-)
- `node SP/qa/kitchen.mjs round http://localhost:5177/collect/ SP/round3/r --qs 'kitchenTier=desktop&kitchenNoDegrade=1' --w 640 --h 360 --fs 1 --full 1 --tol 0.6 --tapms 110` → pe []、ce []；served score 20；overlay「團隊分數 0／出餐 1 份」；phaseAgain playing
- `node SP/qa/kitchen.mjs tier … --qs 'kitchenTier=desktop&kitchenNoDegrade=1&kitchenPerfFill=1' --secs 8` → drawCalls=78（×3），pe 0
- `node SP/qa/kitchen.mjs tier … --qs 'kitchenTier=desktop' --w 1280 --h 720 --secs 45` → `degrade outline`、`degrade glow`、`degrade shadow`
- `node SP/qa/kitchen.mjs tier … --qs 'kitchenTier=mobile' --w 844 --h 390 --fs 1` → `[kitchen] tier mobile`、`degrade shadow`，drawCalls=16
- `node SP/qa/kitchen.mjs vid … --video SP/vid` → leaves `[17.5,["served:"]]`…`[54.3,["expired:-10"]]`，pe []
- `node SP/qa/kitchen.mjs rkey … --w 960 --h 540` → r0 true、r1 false、r2 true、r3 false、r4 true；kdIn 3、kdOut 1；hudGone true
- `node SP/qa/kitchen.mjs clock … --fs 1` → c1 `{t:"0:14", data-urgent:"true", color:"rgb(255, 59, 78)", anim:"kitchen-pulse"}`；overlay 無星數；phaseRestart countdown
- `node SP/qa/kitchen.mjs solo http://localhost:5177/collect/ SP/new2/<g> --game <g>`（bomber／tank／race）→ pe 0、ce []；bomber b:true k:false，tank／race 兩者皆 false
- BUG-1 修後：同紅那條指令得到 `SP/z-serve-arrow-fixed.png`：箭頭是「>>」，指向鈴。
- `node SP/qa/mp.mjs http://localhost:5176/collect/ SP/mp/base` → `Database 'dkbo-collect' not found`，建房逾時（多人待驗）

## 自我審查
- 下判定前確認過 babylon 與 babylon-hud 都是 `status: done`。判定一律以最終 build（含 review 修正與 BUG-1 修正）重跑；舊 build 的結果只用來定位問題。
- 排除的假設：
  - 「波 3 讓互動壞掉」：`pick` 最小重現可以拾取，排除；實際原因是腳本按鍵太短。
  - 「bomber 畫面有回歸」：像素差來自隨機地圖與 AI 狀態，排除；目視造型、配色、HUD 一致。
  - 「race、tank 出現 kitchen HUD」：DOM 檢查為 false，排除。
- 我擁有的 `scripts/qa/kitchenart/**` 沒有寫入，腳本與截圖都放在 scratchpad，`touched` 為空。
- 5177 的 preview 是我起的（SP/dist），還沒關，方便領導或 reviewer 複看。主樹 5176 已關。

## 疑慮
1. **食譜面板蓋住 (10,2) 鍋**：1920×1080 時右側食譜蓋住上面那口鍋的進度環和「!」一角（`f/fill-2-later.png`），960×540 也會蓋到爐台邊緣。可以按 R 收合，但預設是展開的。原因是相機不調（裁決⑩）、構圖偏右，屬於版面取捨，請領導裁定。
2. **站台浮動導覽列蓋住 HUD 頂列**：非全螢幕時，960×540 與 844×390 下 `.floating-header` 會蓋住訂單卡與計時（`k/d960-2-later.png`、`k/m844-2-later.png`）。bomber 也一樣，屬於 `src/components`，babylon-hud 也提過。
3. **待驗清單**（結案 report 需要列出）：
   - 多人：兩端顏色與手持物同步、裁決⑦、d 實測，原因是 dkbo-collect NOT_FOUND。
   - 砍菜動作與朝向。
   - 拾取弧線、砧板回彈與碎片、火苗與蒸氣細節：headless 解析度或 fps 不足，請在關卡③實機目視。
4. **N1 餘裕**：N1=78，d 估 3 時餘裕只剩 3；d 若 ≥ 5 就超過 90。
