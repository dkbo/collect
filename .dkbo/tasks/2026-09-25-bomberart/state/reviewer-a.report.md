# reviewer-a 報告（波 4）
## 做了什麼
審 waves/4.diff（6 檔：bomber.ts、bomberFx/hudModel.ts＋phase 測試、bomberFx/perfLog.ts＋測試、index.css），對照 brief 波 4 三列與全域約束；另讀 worktree 的 applySeed／simulate／syncHud 呼叫時機、Room.tsx／SoloGame.tsx 全螢幕鈕位置、BomberHud 縮放，並 build 到 scratchpad 看編譯後 CSS。

## 規格合規
- ✅ 波 4 babylon①陣亡 invincibleMs 回 0：`src/babylon/games/bomberFx/hudModel.ts:73` 以 `alive ? quantizeInvincible(...) : 0`，新測試覆蓋存活／陣亡兩者。
- ✅ 波 4 babylon②結算凍結計時：`hudModel.ts:51` `phaseTimer` 在 result 回 last 的複本；`bomber.ts:1665-1666` 只在 playing 記錄；`bomber.ts:445` 於 applySeed 清空。applySeed 只在 seed 到達時跑（host 在 `hostStartRound` 廣播 seed 同時 startCountdown，`bomber.ts:620-621`），此時已是 countdown，不會在結算中途把值清成 0:40。中途加入（last=null）退回完整時長，有測試。
- ✅ 波 4 babylon③perf log 跳過首次 0/Infinity：`bomberFx/perfLog.ts:5-8`，`bomber.ts:1620-1621` 只在非 null 時印；AC8 格式不變。
- ✅ 波 4 babylon-hud①reduced-motion：`src/index.css:1384` 改 `@apply animate-none`；編譯輸出 `.bomber-timer-urgent{animation:none}` 在 media 內。
- ✅ 波 4 babylon-hud②全螢幕鈕不壓 P2：`src/index.css:1252` 右欄 top 取 max(原值, 鈕底 max(0.5rem,safe-top)+2.25rem+6px)；鈕位置與 Room.tsx:160／SoloGame.tsx:69 的 `top-[max(0.5rem,…)] size-9` 一致；編譯結果 `top:max(calc(18px * var(--bomber-scale) + env(safe-area-inset-top)), calc(max(.5rem, env(safe-area-inset-top)) + 2.25rem + 6px))` 正確。960×540（scale 1）右欄底 ≈ 50+2×154.5+10.5 ≈ 370px < 540，不溢出；max-height:500px 下 `.bomber-col` 隱藏，不受影響。
- ✅ 全域約束：`@/*` 別名（新 import 皆 `@/babylon/...`）；index.css 只改 `.bomber-*`；未動 package.json／lock、src/core、src/babylon/net、bomberNet／AI／Map（對 merge-base diff 為空）；既有 `*.test.ts` 未改（只新增兩個測試檔）；規則常數未動。
- ✅ 所有權：bomber.ts、bomberFx/** 屬 babylon；index.css 屬 babylon-hud；無越界檔。
- qa 列（三項目視）不在本審查範圍，待 qa report。

## Important
無。

## Minor
（本切片為逐波審查，無累積 Minor 需 triage。）
- `src/index.css:1252`：右欄改用 max() 後，左右欄頂部不再對稱——960×540 右欄比左欄低約 32px、1920×1080 低約 14px（左 18×scale、右固定 ≥50px）。不壓鈕的目標達成；若要對稱可讓左欄套同一 top，或把全螢幕鈕移開。留給領導／designer 判斷，不擋 merge。
- `src/babylon/games/bomber.ts:1619`：首次取樣被略過時 `lastPerfLog` 仍前進，第一行 log 約在開局 4 秒才出現（原本 2 秒）。與 AC8「每 2 秒」精神相符，只是 qa 抓 log 時要多等一個週期。
- `src/babylon/games/bomberFx/hudModel.ts:40`：`suddenDeathSeconds` 現只被 `phaseTimer` 與舊測試使用，可考慮日後標為內部；不必改。

## 測試
### 紅
不適用: reviewer 只讀，不寫測試；以下為獨立驗證。
dev 的紅證據請見 babylon report。
### 綠
`node_modules/.bin/vitest run src/babylon/games/bomberFx` → Test Files 15 passed (15)、Tests 93 passed (93)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json`、`node_modules/.bin/eslint src/babylon/games/bomber.ts src/babylon/games/bomberFx/` → 無輸出（乾淨）
`node_modules/.bin/vite build --outDir <scratchpad>/dist --emptyOutDir` → built in 13.61s，vendor-babylon gzip 450.79 kB（≤650）；docs/ 無變更

## 自我審查
逐條對 brief 波 4 列與全域約束；計時凍結特別追了 applySeed／wasPlaying 轉換時機，確認不會在結算中被清空。未跑多人與截圖（qa 負責）。

## 疑慮
無。
