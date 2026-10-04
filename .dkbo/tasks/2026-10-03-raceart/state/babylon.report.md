# babylon 報告（波 5）
## 做了什麼
整枝評議 Minor「甩尾後壓加速帶噴焰色誤判為段位色」（`raceFx/effects.ts:463`）已修。

- 根因：`effects.ts` 甩尾中只要段位 > 0 就**每幀**刷新 `lastTier/lastTierAt`，加速起始判定只看「距 lastTierAt ≤ 250ms」。甩尾中（還沒放開）壓到加速帶時這個差是 0 → 判成 mini-turbo、拿段位色。但 mini-turbo 只在**放開**那一幀給（`stepDrift` 放開回傳 `NO_DRIFT`，本幀段位已是 0），所以「本幀段位 > 0 時開始加速」一定是加速帶／菇。
- 修法：判定抽成純函式 `turboTier({ drift, lastTier, lastTierAt, now })`（`src/babylon/games/raceFx/fxModel.ts`）：本幀段位 > 0 → 0（flame）；否則照舊看窗口。`TURBO_WINDOW_MS` 由 effects.ts 移到 fxModel 匯出（值不變 250）。effects.ts 改呼叫它，其餘不動。
- 他車同樣適用：own 快照 `drift` 在放開那一筆已是 0、`boost` 同筆變 true → 仍判 turbo；甩尾中壓加速帶那筆 `drift > 0` → flame。

| 檔 | 內容 |
|---|---|
| src/babylon/games/raceFx/fxModel.ts | 新增 `TURBO_WINDOW_MS`、`turboTier` |
| src/babylon/games/raceFx/effects.ts | 移除本地 `TURBO_WINDOW_MS`，加速起始改用 `turboTier` |
| src/babylon/games/race.ts | 應 babylon-rules QUESTION（尾流朝向修復）：`positionsExcept` 回傳加 `ry`（自己 racer.car.ry、他車 snap.ry、bot b.ry），餵 stepRacer 的 others；回傳型別是 {x,z} 的超集，兩邊誰先落地都能編譯 |
| src/babylon/games/raceFx/fxModel.test.ts | 新增 3 條（只加不改既有斷言） |

## 測試
### 紅
`node_modules/.bin/vitest run src/babylon/games/raceFx/fxModel.test.ts`
`Tests  3 failed | 26 passed (29)` — `TypeError: turboTier is not a function`（舊的內嵌判定 `now - lastTierAt <= 250 ? lastTier : 0` 對「甩尾中壓加速帶」案例 `{drift:2,lastTier:2,lastTierAt:1000,now:1000}` 會回 2，即斷言要的 0 不成立）
### 綠
`node_modules/.bin/vitest run src/babylon/games/raceFx/fxModel.test.ts`
`Tests  29 passed (29)`
全閘：`node_modules/.bin/eslint src` exit 0；`node_modules/.bin/tsc -b --noEmit` exit 0；`node_modules/.bin/vitest run` → `Test Files 94 passed (94)、Tests 992 passed (992)`

race.ts 補 ry 後：`node_modules/.bin/eslint src/babylon/games/race.ts` 與 `node_modules/.bin/tsc -b --noEmit` exit 0（尾流行為測試在 babylon-rules 的 drive.test.ts）

## 自我審查
- 只改所有權內 `raceFx/**` 三檔；raceRules／net／core／hud.ts 未動，既有斷言未改。
- `boostColor` 簽名與行為不變；TURBO_WINDOW_MS 值不變，放開甩尾 → mini-turbo 色的原行為由第 1 條測試鎖住。
- 視覺沒另行截圖驗：判定已是純函式且有單測覆蓋三種情境；qa 若要眼驗：甩尾蓄到橘／紫段**不放開**直接開上加速帶，噴焰應為黃橘 flame 三層而非段位色。

## 疑慮
- 殘留極端情境（判定依舊是啟發式）：甩尾因速度掉到 `DRIFT_MIN_SPEED` 以下被取消（不給 turbo），且 250ms 內又壓到加速帶 → 仍會判成段位色。他車只有 own 快照的 `drift`／`boost`，無法區分加速來源；要根治得在 own 加欄位（AC6b 訊息表固定，需領導裁定），本波不做。
