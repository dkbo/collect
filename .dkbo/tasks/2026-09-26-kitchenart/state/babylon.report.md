# babylon 報告（波 3）
## 做了什麼
- **純函式（kitchenFx，全附單測）**
  - `orders.ts` 的 `trackOrders`：比對前後兩張快照，穩定產生訂單 id（新單只接在尾端，剩餘時間只減不增）。消失的單依 delivered 增量照 host `findIndex` 規則分成 served／expired。剩餘時間撐得到這張快照卻不見了的單，一定是被送出去的。`scoreDelta` 按實際分數差依序分攤，分數下限為 0 時記 0。同一張快照重送時不重報；新局（剩餘時間回升）重新編號，nextId 跨局延續。
  - `hudModel.ts`：`buildKitchenHud` 依共用契約量化（remainSec 整秒、remainMs 100ms，都無條件進位），每次回新物件。`idleKitchenHud` 給開局倒數用。`handFlights` 判斷手上的拾取／放下。
  - `effectsModel.ts`：`potPhase`（快焦＝soup 且 progress > 0）、`boardPhase`、`alarmHz`（2→6Hz）、`alarmSmokeRate`（4→20）、guest 進度外插 `extrapolateProgress`（上限 400ms；soup 且 progress 為 0 時不推）、`arcPoint`、`slotEvents`。
- **3D 特效 `kitchenFx/effects.ts`（spec §7 的 3D 各列）**
  - 切菜：砧板上方 billboard 進度條（0.8 CELL）。每 250ms 砧板壓到 0.95 再回彈，噴 2–3 片食材碎片。切好後換綠勾，以 backOut 彈出（200ms）。
  - 煮：爐圈旁 7 點小火苗、白蒸氣（每秒 12 顆）、綠色進度環。煮好時冒一陣大蒸氣，進度環換成綠勾（300ms）。
  - 快焦：進度環變紅、填充量等於 progress；鍋緣以 emissive 加 Glow 紅色脈動（2→6Hz）；「!」章跟著脈動縮放；灰黑煙每秒 4→20 顆。
  - 焦了：一陣黑煙加 6 顆 ember，之後常駐細黑煙。焦掉的東西端在手上或放在檯面上時也會冒細煙。舊 `updateSteam` 煮好後仍冒白蒸氣的問題已隨舊碼移除。
  - 拾取／放下：物品沿弧線飛 180ms，落點冒小白環。
  - 出餐：12 顆金星、鈴先壓扁再回彈並閃光。「+20」共用一張 DynamicTexture，3 個 plane 輪用；文字取 `SCORE_SERVE`。
  - 事件一律由前後 view 的差異觸發（host 與 guest 一致）；原本只在 host 的 `hostUse` 裡觸發的出餐特效已移除。
  - 粒子用 `fx_*.webp` 原路徑，共 5 組，每組上限取檔位 `particleCap`（150／手機 60）。
- **共用化（bomber 只改 import）**
  - bomber 的 `FxEmitter`／`fxRandom`／`style`／`c4` 原封搬到 `fx/emitter.ts`。
  - `createRingTexture`（加可選的 name，預設仍是 `bomber-ring-tex`）與 `whenFontReady` 搬到 `fx/textures.ts`，`bomberFx/textures` 轉出這兩個名字。
- **`fx/look.ts`**
  - 新增 `setGlow(mesh, hex, strength)`：脈動與閃光時改強度；strength ≤ 0 時移出白名單，免得以黑色遮住後面的光暈（修 Minor「鈴以強度 0 進白名單」）。不會重複加入白名單，也不會每幀 new。
  - `LookOptions` 加可選的 `exposure`／`contrast`，不給就是 bomber 原值 1.05／1.08。
- **overcooked.ts**
  - 改用 `setHud`：playing 時每幀傳一張新的 `KitchenHud`；result 凍結在最後一張（`gone` 清空）；countdown 傳新局樣子。
  - 移除 4 塊 `createTextPanel` 與其繪製、舊蒸氣／火花粒子、每次新建的浮字。
  - 開局倒數改用 `COUNTDOWN_THEME`，掛在 `look.uiCamera`＋`UI_LAYER`（同 bomber），並預先載入 Fredoka。
  - 結算改走 `setOverlay`（團隊分數、出餐數，不加星數），host 10 秒後自動重開的行為不變。
  - guest 在兩張快照之間外插進度。dispose 時 `setHud(null)`／`setOverlay(null)`。
- **場景**
  - KITCHEN 牌所在的背牆貼圖改用 `whenFontReady`，Fredoka 載好後整張重畫（Minor 2）。
  - 場外：`clearColor` 加一片 160×160 的延伸地面（深青、中心較亮），對齊 variant-A-gameplay 的場外底色。相機沒動。
  - `setSlot` 的鍋換色改成快取的 Color3（Minor 2「每幀 new Color3」）。
- **畫面偏灰**：kitchen 傳 `exposure 1.3`、`contrast 1.2`。地面中心從 #C8BC9E 提到約 #D8CEB5，白色檯面約 #E2DDCF、沒有過曝。試過 1.4，淺色會洗白、棋盤對比變弱，所以退回 1.3。

## 測試
### 紅
```
node_modules/.bin/vitest run src/babylon/games/kitchenFx/orders.test.ts src/babylon/games/kitchenFx/effectsModel.test.ts src/babylon/games/kitchenFx/hudModel.test.ts
Error: Cannot find package '@/babylon/games/kitchenFx/orders'（effectsModel、hudModel 同）— Test Files 3 failed (3) / Tests no tests
```
### 綠
```
node_modules/.bin/vitest run src/babylon/games/kitchenFx/
Test Files 5 passed (5) / Tests 48 passed (48)
完整閘（送 DONE 前一次）：node_modules/.bin/eslint . → rc=0；node_modules/.bin/tsc -b --noEmit → rc=0；node_modules/.bin/vitest run → Test Files 53 passed (53) / Tests 509 passed (509)
```
訂單判定的測試涵蓋：同 ing 兩張單其中一張出餐、出餐與逾時同一幀（先逾時再出餐，以及快到期那張被送走兩種）、分數為 0 時逾時（scoreDelta 0）、兩張同時逾時但分數只剩 5（-5／0）、同菜舊單逾時與新單同幀、新局、同一張快照重送。

### 單人自查（dev `--port 5175` swiftshader，已關；截圖在我的 scratchpad `/tmp/claude-1000/-home-bal-project-collect--worktrees-kitchenart/d2852403-4b95-4327-a3bc-2288e2609a7d/scratchpad/`）
- `?kitchenTier=desktop&kitchenNoDegrade=1&kitchenPerfFill=1`（1920×1080）：pageErrors 空。**N1 = 78**（面板已拆），`78 + 3×3 = 87 ≤ 90`。截圖 `exp2-c.png`：砧板進度條、兩鍋快焦（紅環、「!」、紅鍋緣），React HUD 正常。
  - 比波 2 的 68 多 10：4 個進度提示、2 個「!」、場外地面、粒子系統，加上快焦鍋緣首次顯示（本體＋Glow pass），扣掉 5 塊面板。
- 實際操作連拍 `play-grid.png`（取蔬菜 → 放上砧板 → 切 → 綠勾）：拾取成功、手上有物、切好後綠勾出現，HUD 訂單卡依時間變黃、變紅。swiftshader 每張截圖要好幾秒，拍不到 180ms 的弧線與 250ms 的回彈。
- `?kitchenTier=mobile` 844×390：`[kitchen] tier mobile`，drawCalls=16，自動降 `shadow`，無錯。
- bomber 單人 `bomberTier=desktop&bomberNoDegrade=1`：`[bomber] tier desktop`，無 pageError；`[data-bomber-hud]` 存在、`[data-kitchen-hud]` 不存在。
- 背景取樣：場外 #0C313C–#103842（稿 #0C2027）。之後又把清除色調暗到 #0F2A31，最新值沒有再截圖，請 qa 並排確認。

### AC10 bundle（`node_modules/.bin/vite build --outDir <scratchpad>/dist --emptyOutDir` rc=0；base＝`git archive d8ca4df` 解到 scratchpad、symlink 主樹 node_modules、用同一指令建置；worktree 的 `docs/` 無變更）
| chunk | base gzip | 改後 gzip | 增量 |
|---|---|---|---|
| vendor-babylon | 452.04 KB | 450.80 KB | −1.24 KB（≤10 ✅） |
| Battle | 67.89 KB | 84.26 KB | +16.37 KB（≤25 ✅；含波 1–3 全部與 babylon-hud 的 HUD 元件） |
（vite 回報的數字；另用 `gzip -9` 量，vendor 445917→444706、Battle 66846→83066 bytes）

## 自我審查
- 所有權：只改 `src/babylon/fx/**`、`bomberFx/**`、`kitchenFx/**`、`overcooked.ts`。`git diff bf4c291 -- src/core src/babylon/net src/babylon/hud.ts src/babylon/games/overcookedKitchen.ts src/babylon/types.ts` 為空。`src/index.css`／`src/pages/Battle/*` 的改動是 babylon-hud 的。
- bomber 零行為變更：`FxEmitter` 逐行搬移，只改 import；`createRingTexture` 預設名不變；`LookOptions` 不給新欄位就是原值。
- 規則、數值、相機、快照協定都沒動；網路、`applyUse`、`tickKitchen` 未動。
- 契約：`setHud` 每次傳新物件；`orders[].id` 由純函式產生，不改快照；`gone` 只在消失那張快照非空（guest 同一張快照重送回空陣列；babylon-hud 另有 `freshGone` 防重播）。

## 疑慮
- **開局倒數沒有在 swiftshader 截到**：從載入到 playing 超過 3 秒倒數。程式與 bomber 同一寫法，請 qa 在 production preview 目視倒數配色，並確認倒數不過 ACES。
- **d 仍是估的 3**：N1=78 下，87 ≤ 90 餘裕只有 3。若多人實測 d > 4 就會超標，可以考慮把 2 個「!」併入進度環貼圖，或拿掉場外地面、只留清除色。
- 右側食譜面板在 1920×1080 會蓋住 (10,2) 鍋的進度環與「!」一角（`exp2-c.png`）。這屬 HUD 版面，請 qa 看是否需要 babylon-hud 調整。
- 切菜的回彈、碎片、拾取弧線與出餐星星、「+20」、鈴回彈都是短時效果，headless 拍不到，請 qa 以 preview 小視窗連拍。
- `?kitchenPerfFill=1` 依裁決保留。它會讓兩鍋都處於快焦狀態，量 N1 時包含了快焦的鍋緣＋Glow，屬於最壞情況。

## 修復：review 波 3 Important 1（快焦脈動亂閃）＋ Minor 1（Glow 白名單變空）
- **根因**：`effects.ts` 用 `sin(now·2π·alarmHz(progress))`，`now` 是從頁面載入起算的絕對時間。頻率隨 progress 變化時，瞬時頻率變成 `hz + now·dhz/dt`，所以開局越久相位跳得越兇。第一個出錯的地方就在這個算式：它的輸入 now、progress 都是對的，輸出的相位是錯的。
- **重現**（改碼前，node 直接代入舊算式，60fps、progress 0.5，期望每幀 0.067 圈）：
  - t=5s：每幀 0.178 圈
  - t=100s：每幀 2.289 圈
  - t=300s：每幀 6.734 圈
- **修法**（一次一件事）：
  - `effectsModel.ts` 新增 `advanceAlarmPhase(phase, progress, dtMs)`，每幀做 `phase += 2π·hz·dt`；dt 最多算 100ms，相位保持在 [0, 2π)。`alarmPulse(phase)` 回 `0.5 + 0.5·sin`。
  - `effects.ts` 每個鍋存自己的 `alarmPhase`，剛進 alarm 時歸零、之後累加。鍋緣 emissive、Glow 強度、「!」縮放都吃同一個 pulse。
  - guest 收到新快照校正 progress 時，改變的只是頻率，相位不會跳。
- **Minor 1**（`look.ts`）：新增 `syncGlowEnabled()`。includedOnly 名單空時把 GlowLayer 設成 `isEnabled=false`，有 mesh 進名單再打開；建構時、`glowMesh`、`setGlow`、mesh dispose 時都會同步。`glowMesh` 也會清掉 `glowOff` 標記，計數才不會漂。bomber 在 init 就登記火焰等發光物，名單不空，畫面不變。
### 紅
```
node_modules/.bin/vitest run src/babylon/games/kitchenFx/effectsModel.test.ts
TypeError: advanceAlarmPhase is not a function（alarmPulse 同）— Failed Tests 4
```
（第一版的 6Hz 過零計數測試從相位 0 起算，最後一次過零剛好落在端點，浮點誤差讓它只數到 5 次。這是測試寫法的問題，已改成從 π/2 起算；實作沒動。）
### 綠
```
node_modules/.bin/vitest run src/babylon/games/kitchenFx/effectsModel.test.ts
Test Files 1 passed (1) / Tests 16 passed (16)
完整閘：eslint . rc=0；tsc -b --noEmit rc=0；vitest run → Test Files 53 passed (53) / Tests 513 passed (513)
```
- 單人自查（5175，已關）：
  - kitchen `kitchenPerfFill=1`：pageErrors 空，drawCalls=78。隔 300ms 兩幀的「!」大小不同，鍋緣紅光有畫出來（`fix-pots.png`）。
  - bomber 單人：pageErrors 空，drawCalls=61。

## 修復：qa BUG-1（出餐台箭頭畫成「<<」）
- **根因**：`kitchenFx/models.ts` 的 `serveData` 裡，斜桿的 yaw 符號寫反。`at()` 的 yaw 為正時會把長軸的 +z 端轉向 +x，所以 z>0 那條取 `+0.7`、z<0 那條取 `-0.7` 時，兩條在 −x 端收成尖角，畫成「<」。這是波 2 建模時就寫錯的，跟 z 翻轉無關：翻的是 z，不影響左右。
- **修法**：只改一處，`yaw: s * 0.7` 改成 `yaw: -s * 0.7`。
- **自我審查**：頂點傾印（暫時的測試檔，已刪）顯示修後兩個尖角落在 x≈0.07、0.39、z≈0，開口在 |z|≈0.3、偏 −x 側，確實是「>>」。第一版測試以 x=0.06 切分兩個箭頭，但兩個箭頭的 x 範圍互相重疊，所以修後仍然判紅。這是測試寫法的問題，已改成比較「尖角點」與「開口點」兩群的平均 x。
### 紅
```
（修前的碼，cp 到 scratchpad/red 單獨跑，不動共用 worktree）node_modules/.bin/vitest run src/babylon/games/kitchenFx/models.test.ts
AssertionError: expected -0.2859690010959376 to be greater than 0.2 — Tests 1 failed (1)
```
### 綠
```
node_modules/.bin/vitest run src/babylon/games/kitchenFx/models.test.ts
Test Files 1 passed (1) / Tests 1 passed (1)
完整閘：eslint . rc=0；tsc -b --noEmit rc=0；vitest run → Test Files 54 passed (54) / Tests 514 passed (514)
```
- 目視（5175，已關）：`?kitchenTier=desktop&kitchenNoDegrade=1` 1920×1080 裁出出餐台，放大圖是 scratchpad 的 `arrow-zoom.png`。瀝架在左，箭頭為「>>」、指向右邊的鈴，pageErrors 空。
- 附帶（未改）：第二個「>」的尖端被鈴座稍微蓋住一點。這是既有的擺位，不在這個 BUG 範圍內；要移的話得連瀝架一起調，請 qa／領導判斷是否需要。
