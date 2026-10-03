# babylon 報告（波 4）
## 做了什麼
修整枝評議 Important 1（＝qa 波 3 疑慮 1，幽靈反彈彈）：子彈壽命改以模擬時間計算，host、guest 兩端一致。
- 新增純函式 `src/babylon/games/tankFx/bulletLife.ts`：`advanceBullet(b, dt, lifetimeMs, isWall, isCrate)` 先 `age += dt*1000`，`age > lifetimeMs` 回 `{ kind: 'timeout' }`（不再移動），否則照舊呼叫 `stepBullet`。附 `bulletLife.test.ts`（5 條）。
- `tank.ts`：`BulletInfo.createdAt` 換成 `age`（`spawnBullet` 設 0）；`stepBullets` 改呼叫 `advanceBullet(b, dt, BULLET_LIFETIME_MS, …)` 並回寫 `b.age`，`timeout`／`expire` 一律移除。原本 `now - b.createdAt > BULLET_LIFETIME_MS` 的真實時間判定已拿掉。
- `createdAt` 已整個移除：砲口焰 40ms 去重本來就是用 `v.rig.fireAt`，不靠 `createdAt`，所以沒有別的地方要清。
- 時序：30Hz 下子彈飛 60 tick（剛好 2 秒，24 單位），第 61 tick 到期，跟原本真實時間 2000ms 的壽命一樣（浮點累計到第 60 tick 是 1999.99…，不會提早一 tick）。`BULLET_LIFETIME_MS`、`SIM_HZ` 等數值都沒改。
- 沒碰 net 層與協定：沒有新訊息，也沒有新欄位。`bounce` 校正不動 `age`。

## 測試
### 紅
`node_modules/.bin/vitest run src/babylon/games/tankFx/bulletLife.test.ts`（先寫測試，還沒有 bulletLife.ts）
`Error: Cannot find package '@/babylon/games/tankFx/bulletLife' imported from …/bulletLife.test.ts` → `Test Files  1 failed (1)`／`Tests  no tests`
### 綠
`node_modules/.bin/vitest run src/babylon/games/tankFx/bulletLife.test.ts src/babylon/games/tankFx/bounce.test.ts`
`Test Files  2 passed (2)`／`Tests  15 passed (15)`

測試涵蓋：
1. 30Hz 下活滿 60 tick、第 61 tick 才到期，飛行距離等於 `SPEED*DT*60`。
2. host 與 guest 同起點、同 tick 數（含一次反彈）時，每個 tick 的 `{age, step}` 都 `toEqual`，並且兩端同在第 61 tick 到期。
3. 補步被截斷：host 卡頓，真實 3 秒只跑了 40 tick。這時子彈不到期，age 等於 40 tick 的時間；恢復正常後再飛 20 tick 才到期，總飛行距離仍是完整 2 秒。
4. 反彈不重置壽命（反彈後仍是 60 tick 到期，bounces=1）。
5. 撞木箱的結果原樣帶出，age 照樣累加。

送 DONE 前跑一次完整閘：`node_modules/.bin/eslint . && node_modules/.bin/tsc -b --noEmit && node_modules/.bin/vitest run` → exit 0，`Test Files 70 passed (70)`／`Tests 687 passed (687)`。
`git diff 28bc63e --stat -- src/core src/babylon/net src/babylon/hud.ts src/babylon/games/bomberFx src/babylon/games/kitchenFx 'src/babylon/games/bomber*.ts' 'src/babylon/games/overcooked*.ts' 'src/babylon/games/race*.ts' src/pages src/babylon/types.ts` → 空。

### 單人自查（PORT=5175，只用自己的獨佔 port，跑完已關）
`node scripts/qa/tankart/play.mjs http://localhost:5175/collect/ <S>/solo --secs 40 --query 'tankTier=desktop&tankNoDegrade=1' --fire`（借用 qa 的腳本，只執行、沒改）→ 跑完一局到結算（`solo-result1-A.png`），`pageErrors: []`。console 只有既有的 403（dev 的 geist 字型）和 swiftshader 的 GPU stall 警告。截圖在 `/tmp/claude-1000/-home-bal-project-collect--worktrees-tankart/1d711f93-2bbf-48b3-9779-51ac59039fe2/scratchpad/solo-*.png`。

## 自我審查
- 只動所有權內的檔：`tank.ts`（9+／10−）、新增 `tankFx/bulletLife.ts`、`tankFx/bulletLife.test.ts`。`bounce.ts` 與既有測試的斷言都沒動。
- 全域約束：import 一律用 `@/`；沒有新依賴、沒有新訊息或欄位，net 層也沒動；既有數值都不變。
- worktree 裡未追蹤的 `scripts/qa/tankart/` 是 qa 的檔，不是我的。

## 疑慮
1. 修好以後，host 卡頓時子彈的「真實」存活時間會變長（例如 3fps 的 swiftshader 下會超過 2 秒），但飛行距離固定是 2 秒份，跟 guest 一致。這是本來要的效果；qa 若用真實時間量子彈壽命，數字會比 2 秒長。
2. guest 端收到 `bullet` 的時刻比 host 晚一個網路延遲，這個起點差在改之前就存在（兩端都從同一個起點、age 0 開始算），本波沒有處理。兩端的壽命只按各自跑了幾個 tick 計，所以 guest 不會再因為 host 掉幀而多出反彈。
