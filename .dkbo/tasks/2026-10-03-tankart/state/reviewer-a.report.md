# reviewer-a 報告（波 4）
審查範圍：waves/4.diff（since 28bc63e，含未 commit 工作樹；11 檔：src 3 檔、scripts/qa/tankart 8 檔）。

## 做了什麼
讀 waves/4.diff、brief.md 全文、tank.ts 子彈生命週期全路徑（spawnBullet／stepBullets／hostBulletHits／applyMessage 的 bullet、bounce、hit、crate 分支、tick 呼叫點）、tankFx/bounce.ts；跑相關測試、tsc、eslint（無快取寫入）；核對受保護路徑 diff。

## 規格合規
波 4 只修一件事（整枝評議 Important 1＝qa 波 3 疑慮 1），逐條判：
- ✅ 子彈壽命改模擬時間：`BulletInfo.createdAt` → `age`（src/babylon/games/tank.ts:98），`spawnBullet` 以 `age: 0` 起算（tank.ts:516），`stepBullets` 每 tick 經 `advanceBullet` 累加 `dt*1000`、`age > BULLET_LIFETIME_MS` 才移除（tank.ts:556-561、tankFx/bulletLife.ts:25-26）。host 與 guest 走同一支函式、同 dt（fixedTick stepMs），同 tick 數同壽命；guest 收 `bullet` 晚到只會讓牆鐘到期時刻晚、不影響到期位置，幽靈反彈根因（host 補步被截斷時以真實 `now` 判到期）已移除。
- ✅ 只動 tank.ts／tankFx/，不碰 net 層：`git diff 28bc63e -- src/core src/babylon/net src/babylon/hud.ts bomber* overcooked* race* tankNet.test.ts package.json pnpm-lock.yaml` 為空。協定未變（無新訊息、無新欄位）。
- ✅ `createdAt` 已清（tank.ts、tankFx/ 無殘留）；砲口焰去重改用 spawnBullet 內的區域 `now`（tank.ts:515-521），行為不變。
- ✅ 紅測先行：babylon report「### 紅」為模組不存在的失敗（見 Minor 3）；涵蓋同起點同 tick 兩端一致（bulletLife.test.ts:37-58）、補步截斷不提早到期（:60-74）、反彈不重置壽命（:76-82）、木箱結果帶出（:84-89）。
- ✅ 既有數值不變：`BULLET_LIFETIME_MS = 2000`（tank.ts:132）未動，`BULLET_MAX_BOUNCE`、`stepBullet` 未動。
- ✅ 全域約束：`@/` 別名（bulletLife.ts:6-7、test:2-3）、純函式在 tankFx/ 附同目錄 test、未新增依賴、無圖檔。
- ✅ `?tankBench=1` 的靜止子彈直接寫 board（tank.ts:464），不進 `this.bullets`，不受壽命改動影響。
- ❌ 全域／所有權：`scripts/qa/tankart/**` 又被寫入 8 檔（brief「檔案所有權」段：「只是占位、不得寫入」），見 Important 1。
- ⏳ qa 驗收（多人兩解析度幽靈反彈 0 例、單人回歸）：審查當下 qa state 仍 `working`，不在本報告判定範圍。

## Important
1. **qa 探測腳本再次寫進 worktree**：`scripts/qa/tankart/{play,mpcmp,mp2,ghost,ghost2,ghostbounce,analyze,agg}.mjs`（546 行，未追蹤，mtime 13:39，晚於 wave 3 commit 13:31）。brief 明文「`scripts/qa/tankart/**` 只是占位、不得寫入」「腳本與截圖一律放 scratchpad」，且 process.md 2026-10-03T09:26 已有 ruling「採納 a-I3 qa 腳本移到 scratchpad 並自 worktree 移除」——這是同一違規重犯。因為所有權表把該 glob 劃給 qa，`dk-wave-close` 第四閘擋不住，會被當成 `wave 4` commit 進 `dk/tankart`、合併時帶進 master。另 babylon report 的單人自查也直接執行 `node scripts/qa/tankart/play.mjs`（借用、未改），說明腳本在 worktree 裡會被當成共用工具。建議：wave-close 前請 qa 把這 8 檔移回 scratchpad 並 `rm -r scripts/qa/tankart`（不加 -f）。

## Minor
（本任務累積 Minor：逐波審查不 triage，切片也未列任何條目，無需判定。）
1. bulletLife.test.ts:60-74「補步被截斷」測例：`advanceBullet` 不收任何時間參數，這條在機制上與第一條（:30-35）等價，無法真的對舊碼（`now - createdAt`）取紅；防回歸靠的是函式簽名本身沒有時鐘。可接受，僅記錄。
2. tank.ts:558 `r.kind === 'timeout' || r.kind === 'expire'` 兩種消失合併處理，正確；但 `AgedStep` 的 `timeout` 與 `expire` 名稱相近，日後在 host 端若要對「撞牆消失」播特效容易混淆，可考慮在 bulletLife.ts:14 加一行註解區分。
3. babylon report「### 紅」是 `Cannot find package …/bulletLife`（模組不存在）而非斷言失敗；符合閘的形式要求，但不是「舊行為→錯」的紅。
4. bulletLife.test.ts:6 `const DT = 1000 / 30 / 1000` 手抄 fixedTick 的算法；若日後 `SIM_HZ` 變動，測試不會跟著。可改由常數推導（`SIM_HZ` 現為 tank.ts 內部常數，未匯出，故不強求）。

## 測試
### 紅
不適用: reviewer 只讀審查，不寫測試；以下為重跑 dev 的測試佐證。
### 綠
`node_modules/.bin/vitest run src/babylon/games/tankFx/ src/babylon/games/tankNet.test.ts`
`Test Files  15 passed (15)`／`Tests  156 passed (156)`
`node_modules/.bin/tsc -b --noEmit` → exit 0；`node_modules/.bin/eslint src/babylon/games/tank.ts src/babylon/games/tankFx/bulletLife.ts src/babylon/games/tankFx/bulletLife.test.ts` → exit 0（未加 --cache）

## 自我審查
- 核對了 guest 端 `bounce` 校正分支（tank.ts:939-951）不動 age，校正後壽命仍與 host 對齊。
- 核對了 host 自射在 tick 內 spawn、guest 在 tick 間收訊 spawn 兩種情形的 tick 數：兩端都在第 61 次推進到期，差異只在牆鐘相位。
- 未跑全套 vitest（依 PROTOCOL，全套由 wave-close 跑；babylon 已報 70 檔／687 綠）。

## 疑慮
- 若 guest 也掉幀（guest 端 MAX_ACCUM 截斷），guest 位置落後但仍與 host 走同一條 tick 軌跡，不會產生幽靈反彈；殘留的只有「host 因命中／木箱移除、訊息晚到前 guest 已預測反彈」這種既有的、由 `hit`／`crate` 帶 bulletId 收斂的情形，非本波範圍。
