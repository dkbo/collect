# reviewer-a 報告（波 task：整枝評議）
## 做了什麼
讀 `waves/task.diff`（d8ca4df..45239fe，68 檔）、brief、request.md、process.md 的裁定、qa 波 3 report；直接讀 worktree 的 `overcooked.ts`、`overcookedKitchen.ts`、`kitchenFx/{orders,hudModel,players,effectsModel,pose,effects,board}.ts`、`fx/{look,quality,perfLog,palette,countdown,emitter}.ts`、`BabylonCanvas.tsx`、`KitchenHud.tsx`、`kitchenHud.ts`、`index.css` 的 kitchen 段。機械檢查以唯讀 git 指令做（見 ## 測試）。

## 規格合規
- ✅ **全域約束**：`git diff d8ca4df -- src/core src/babylon/net src/babylon/hud.ts package.json pnpm-lock.yaml public docs` 空；變更檔全在所有權內；新增行沒有相對路徑 import；`@babylonjs` 只在 `babylonCore.ts`（`src/babylon/babylonCore.ts:21`，補 `CreateTorusVertexData`）；沒有新增圖檔；`index.css` 只加不減，新 class 與 keyframes 都是 `kitchen-` 前綴；既有 `*.test.ts` 的刪除行全是 import 行（`fxCurves.test.ts` 把 import 拆成兩行，斷言沒動）。
- ✅ **AC1 共用模組**：`fx/` 下 toon／geometry／thin／thinSlots／burstQueue／rig／upright 與各自測試都判成 rename；`quality` 的 `pickTier(env, key)`／`noDegradeFlag(search, key)`（`src/babylon/fx/quality.ts:35,52`）、`look` 的 `LookOptions.tag/outline`；bomber 明傳 `tag: 'bomber', outline: TOY.outline`（`src/babylon/games/bomber.ts:1209`），網址參數與 `[bomber]` 前綴不變；`COUNTDOWN_THEME` 在 `fx/countdown.ts`。bundle 顯示 vendor-babylon −1.2 KB，沒有重複打包。perfLog.ts 本身判成刪除＋新增（minor 1，留著可以）。
- ✅ **AC2 取湯**：`overcookedKitchen.ts:191` 只改這一個條件；`tickKitchen`／`buildView` 沒動。`overcookedKitchen.test.ts` 涵蓋 0–5 秒可取 soup、超過 5 秒 burnt 可取、soup 前 2 秒 progress 0、之後 0→1、SCORE_SERVE、逾時扣分與下限 0。
- ✅ **AC3 角色**（程式面）：`colorIndexIn`／`kitchenRoster` 純函式，有「任何 selfId 顏色一致」的單測（`kitchenFx/players.test.ts`）；`colorFor` 已刪；胸前 `HOLD_LOCAL`、`chefArms` 砍菜、`uprightAxis`、「你」billboard 位置跟著補償（`overcooked.ts:215`）。⚠ 跨 client 顏色一致與砍菜目視仍待驗（qa：dkbo-collect NOT_FOUND、錄影解析度不夠）。
- ✅ **AC4 場景物件**：qa 以 1920 截圖逐項判定，BUG-1（箭頭方向）已修並重驗。
- ✅ **AC5 材質光影**：`ToyLook` 雙光、陰影；caster 只有玩家 body 與手持 thin 群組（`kitchenFx/board.ts:420`、`overcooked.ts:183`）；Glow 走白名單，名單空時關整層（`fx/look.ts:212`）；曝光 1.3／對比 1.2 為 kitchen 專屬參數，bomber 預設值不變。
- ✅ **AC6 特效**：spec §7 的 3D 列都有對應（`kitchenFx/effects.ts`）；快焦相位改累加（`effectsModel.ts:38`）；煮好（done）不再冒蒸氣；+20 浮字共用一張 `scoreTex`＋3 格池（`effects.ts:161`）；粒子上限取 `look.settings.particleCap`；外插、訂單 id、消失判定都是 `kitchenFx/` 純函式並有測試（`orders.test.ts` 涵蓋同 ing 兩單、出餐與逾時同一幀、分數 0 逾時）。
- ✅ **AC7 HUD**：`types.ts` 契約形狀與 brief 一致；`isKitchenHud` 用 `kind` 分流，沒有 kind 的當 bomber（`kitchenHud.ts:19`）；`GameHud` 沒動；`sameHud` 改成泛型，行為不變；R 鍵監聽綁在元件的 effect，卸載就移除；`max-height: 500px` 精簡版與 reduced-motion 有做；overcooked 已經不用 `createTextPanel`，倒數掛 `look.uiCamera`＋`UI_LAYER`（`overcooked.ts:373`）；結算用 `setOverlay`，沒有星數。
- ✅ **AC8 檔位與降級**：`tag: 'kitchen'` 讓 `kitchenTier`／`kitchenNoDegrade`（含 hash query）與 `[kitchen] tier/degrade` 都成立（`fx/look.ts:57`）。
- ⚠ **AC9 效能**：`[kitchen] drawCalls` 每 2 秒一行、跳過 0／Infinity（`overcooked.ts:545`）。N1=78 ✅；d 由 qa 標待驗。**讀碼推算 d = 3**：peer 角色是一個合併 mesh（`fx/avatar.ts:181`），算本體、描邊、陰影 pass 各一；「你」標記只有自己有，AI 天線只有 bomber 有，所以 78+9=87 ≤ 90。附帶條件：手持物是依 `kind×ing` 分的 thin 群組，如果 3 個 peer 手上拿的是 N1 裡沒出現的 kind，每多一種會再多約 3 次（本體＋描邊＋陰影），最壞 96。AC 定義的是「單一角色增量」，照定義算是過的；結案 report 建議照實寫這個上限。
- ✅ **AC10 bundle**：vendor-babylon −1221 B、Battle +16331 B（qa report）。
- ⚠ **AC11**：DK_TEST_CMD 綠（`waves/3.test.log`：54 檔、514 測試）；受保護目錄 diff 空；`overcookedKitchen.ts` 只動一處；bomber／tank／race 零回歸已截圖。多人項標「待驗：dkbo-collect NOT_FOUND」，符合 brief 允許的寫法，結案 report 必須明列。
- ✅ **AC12**：qa 截圖清單、連拍、draw call／fps／bundle 數字都在 qa report。

## Important
無。

## Minor
**累積 Minor 判定（merge 前必修：0 條；可以留：24 條）**
- 留｜minor 1 perfLog.ts 判成刪除＋新增 `src/babylon/fx/perfLog.ts:1`：檔案只有 8 行，加 tag 後相似度自然掉到門檻以下，要修只能拆成兩次 commit；測試檔是 rename，AC1 的 git mv 要求已滿足。
- 留｜minor 1 burnt 的 isReady 冗餘、tick 前 ≤1 幀可取到 soup `src/babylon/games/overcookedKitchen.ts:192`：brief 限定這個檔只改一處；窗口不到一個 30Hz tick，玩家察覺不到。
- 留｜minor 1 連續兩個空行 `src/babylon/games/overcooked.ts:174`：eslint 沒擋，純格式。
- 留｜minor 1 kitchenRoster 以 i % len 重算 `src/babylon/games/kitchenFx/players.ts:23`：ctx.players 的 id 不會重複，兩者結果恆等，而且有單測。
- 留｜minor 1 R 鍵沒排除輸入框焦點 `src/pages/Battle/KitchenHud.tsx:329`：遊戲本身的 WASD／E 監聽也掛在 window、同樣沒排除（既有），對局畫面沒有文字輸入框。
- 留｜minor 1 `export default KitchenHud` 沒人用 `src/pages/Battle/KitchenHud.tsx:350`：無害；有修復波的話順手刪掉。
- 留｜minor 1 fx 預設 key/tag 為 bomber `src/babylon/fx/quality.ts:35`：kitchen 全部明傳，`LookOptions.tag` 是必填（`fx/look.ts`），預設只留在純函式層。
- 已解｜minor 2 KITCHEN 牌沒等字型：已用 `whenFontReady` 重畫 `src/babylon/games/kitchenFx/textures.ts:247`。
- 留｜minor 2 setSlot 每幀重寫 matrix、new Color3 `src/babylon/games/kitchenFx/board.ts:323`：fps 只記錄、N1 有達標，屬效能優化。
- 留｜minor 2 手上有物也轉向砧板 `src/babylon/games/overcooked.ts:201`：只影響朝向，手臂仍是捧物姿勢。
- 已解｜minor 2 倒數在主相機：已掛 `look.uiCamera`＋`UI_LAYER` `src/babylon/games/overcooked.ts:373`。
- 留｜minor 2 `?kitchenPerfFill=1` 進 production `src/babylon/games/overcooked.ts:368`：只改本機畫面、不碰廚房狀態與網路；AC9 重量 N1 要用它（ruling 10:46），建議保留並寫進結案 report。
- 留｜minor 2 砧板尺寸是 spec 的兩倍 `src/babylon/games/kitchenFx/models.ts:51`：qa 對稿目視 ✅。
- 已解｜minor 2 鈴以強度 0 進白名單：改成 `setGlow` 在 strength ≤ 0 時移出名單 `src/babylon/fx/look.ts:222`、`kitchenFx/board.ts:279`。
- 留｜minor 2 盤架格寫死 cx===6&&cy===0 `src/babylon/games/kitchenFx/board.ts:144`：STATIONS 是常數、brief 規定不改，寫死不會漂移。
- 已解｜minor 3 白名單空時全 mesh 發光：`syncGlowEnabled` `src/babylon/fx/look.ts:214`。
- 留｜minor 3 「!」位置寫死 −x `src/babylon/games/kitchenFx/effects.ts:239`：鍋的位置是固定常數。
- 留｜minor 3 squashBoard 每幀整批重寫 `src/babylon/games/kitchenFx/board.ts:397`：同 minor 2 的效能項。
- 留｜minor 3 bomberFx/textures 再轉出 `src/babylon/games/bomberFx/textures.ts:10`：純結構問題。
- 留｜minor 3 kitchenFx/board 的兩行 import `src/babylon/games/overcooked.ts:46`：純格式。
- 留｜minor 3 served()／landRing() 自取 performance.now `src/babylon/games/kitchenFx/effects.ts:355`：呼叫端的 now 也是同一幀的 `performance.now()`，只差幾微秒。
- 留｜minor 3 兩批 gone 在 600ms 內接連時槽位可能差一格 `src/pages/Battle/kitchenHud.ts:106`：只影響離場動畫的位置。
- 留｜minor 3 guest 開局前幾幀閃上一局 HUD `src/babylon/games/overcooked.ts:695`：`trackOrders` 看到 remainMs 回升會重置，最多一個 8Hz 快照週期。
- 留（交人）｜minor 3 食譜蓋住 (10,2) 鍋環一角 `src/pages/Battle/KitchenHud.tsx:1`：「預設展開」是 brief 明文，照 12:08 ruling 放進結案遺留段、在關卡③由人決定。

**本次新增（都可以留）**
- `src/babylon/games/overcooked.ts:698`：`orderTrack` 跨局沒有歸零，靠 `trackOrders` 的新局偵測（remainMs 回升）處理，id 延續遞增。行為正確，建議補一行註解說明是刻意的。
- `src/babylon/games/kitchenFx/board.ts:420`：手持物依 `kind×ing` 分 thin 群組，4 人各拿不同種類時 draw call 會比 N1+3d 多（最壞約 96），見 AC9。

## 測試
### 紅
不適用: reviewer 唯讀審查，不寫測試、不改碼。
不適用: 取紅由 dev 波負責（overcookedKitchen.test.ts 的紅記在 babylon 波 1 report）。
### 綠
`git diff --stat d8ca4df -- src/core src/babylon/net src/babylon/hud.ts package.json pnpm-lock.yaml public docs` → 無輸出（受保護路徑零變更）
`git diff -M d8ca4df -- '*.test.ts' | grep '^-'` → 只有 import 行；另讀 `waves/3.test.log`：Test Files 54 passed、Tests 514 passed

## 自我審查
逐條對照驗收標準與全域約束；Important 門檻只算會出錯、違反 brief／契約、越界。審查範圍沒有動到 `src/core`／`firestore.rules`／bridge／`src/babylon/net`，所以沒有加做安全審計；`onNetworkMessage` 仍驗來源是本局玩家、payload 是字串，snap 只收房主的（`overcooked.ts:308`）。

## 疑慮
- AC3 跨 client 顏色、AC9 的 d、AC11 多人這三項在 dkbo-collect 恢復前無法實測，結案 report 必須列成待驗。
