# raceart-reviewer-a 報告（波 5，複看 02:53 差異包）
審查範圍：waves/5.diff（87fbc92 之後的工作樹，10 檔，+120／−44）、brief.md 波 5 兩列、全域約束。

## 規格合規
- ✅ 波 5 babylon-rules ① 尾流朝向：`slipCharge` 前車給 ry 時要求 `cos(o.ry − self.ry) ≥ 0`（drive.ts:181）；race.ts `positionsExcept` 三來源都補 ry（race.ts:370-375），stepRacer 推擠端吃 `{x,z}` 超集不受影響；紅綠單測 drive.test.ts:123。
- ✅ ② `stepCar` ry 環繞 (−π, π]（drive.ts:136，`wrapAngle` 已確認 −π→π）；消費端逐一核：他車 `lerpAngle`（race.ts:1373）、偏航差 `wrapAngle`（race.ts:646）、追尾相機 `lerpAngle`（chaseCam.ts:84）、`decodeOwn` 只驗 `isNum`（raceNet.ts:87），皆吃得下環繞值。單測 drive.test.ts:189。
- ✅ ③ `normalizeProgress` 長距離倒車：倒車超過約 5/8 圈正確算回上一圈（track.test.ts:159）；複看：依裁定 (a) 夾回範圍擴到 sector cp+2（`fwd <= ahead((c.cp + 3) % CHECKPOINTS)`，track.ts:174），真跳過一個檢查點（含 cp 7 跨起點）夾在下一個未通過檢查點，docstring 與測試名已改正、補 `{cp:1, s:cp3+2}` 斷言（track.test.ts:170-177）。
- ✅ ④ bot 甩尾區跨起點改 `inSpan`（raceAI.ts:216）；`inSpan` 補 `w − len` 一檢（track.ts:220），既有呼叫端（carPose.ts:25 `[s1, s1+40]`、drive.ts:372 jumps）span[0] ≥ 0，結果不變。單測 raceAI.test.ts:85。
- ✅ 波 5 babylon：噴焰判定抽 `turboTier`（fxModel.ts:67），甩尾中（本幀 drift > 0）起加速 → flame；effects.ts:468 接線。他車路徑 `lerpPose(a, b, α, b)` 的 drift 與 boost 同取自 b 快照（race.ts:1285、1375/1381），不會因快照錯位誤判。單測 fxModel.test.ts:280。
- ✅ AC16 邊界：`git diff 87fbc92 -- src/core src/babylon/net src/babylon/hud.ts package.json pnpm-lock.yaml` 為空；變更檔全在 babylon（race.ts、raceFx/**）與 babylon-rules（raceRules/**）所有權內；既有 `*.test.ts` 只增不改（diff 無 `-` 斷言行）。
- ✅ 全域約束：新 import 全走 `@/*`、無新依賴／圖檔／CSS；raceRules 與 raceFx 新邏輯皆純函式附同目錄單測。

## Important
（無）
- I1（初審）`normalizeProgress` 真跳過一個檢查點被當倒車 — **已修，複看通過** `src/babylon/games/raceRules/track.ts:174`
  - 修法 (a) 落地；cp+3 的取模在 cp=5..7 時跨起點仍正確（`ahead` 以 `wrapS` 算前向距離），cp=7 跳過起點線時回 `{lap+1, s:0}` 與舊行為、與 cp 7 推進前一 tick 的處理一致。
  - scratch 重跑同一組重現：`{lap:1, cp:1, s:65}`／`s:82` → `{lap:1, s:42}`（夾在 cp2），與修前舊版相同；倒車測例改為 `cp 3 → s = cp6+1`（sector cp+3，倒車 ≥ 5/8 圈）仍算回上一圈。
  - 改到的是本波新增測試（`cp6−1 → cp6+1`），非既有斷言；`git diff 87fbc92 -- **/*.test.ts | grep -c '^-[^-]'` → 0。
  - 剩餘取捨（已寫進 docstring）：倒車 3/8–5/8 圈會被當成跳過檢查點而夾在下一個檢查點，名次暫時偏高，回正即恢復；屬裁定 (a) 的已知代價，不另列。

## Minor
累積 Minor：本切片未附清單（逐波審查不 triage），無判定。
- M1 `inSpan` 為半開區間 `[s0, s1)`，bot 甩尾區上界由舊的 `<=` 變 `<`，邊界單點差異，無實害 — `src/babylon/games/raceRules/raceAI.ts:216`
- M2 `turboTier` 殘留情境（babylon 自報）：甩尾因速度掉到 `DRIFT_MIN_SPEED` 以下被取消（不給 turbo），250ms 內又壓加速帶仍判段位色；根治需 own 加欄位（AC6b 固定），可留 — `src/babylon/games/raceFx/fxModel.ts:73`
- M3 `slipCharge`／`RacerWorld.others` 的 `ry` 為可選，日後新呼叫端漏給 ry 會靜默退回「不判朝向」；現呼叫端 race.ts 三來源都有給，可留 — `src/babylon/games/raceRules/drive.ts:168`、`drive.ts:275`
- M4 import 次序：`turboTier` 夾在 `boostColor` 與 `driftSparkLook` 之間，與既有大致字母序不一致（eslint 不擋） — `src/babylon/games/raceFx/effects.ts:28`

## 測試
複看（02:53 差異包）：
- `node_modules/.bin/vitest run src/babylon/games/raceRules src/babylon/games/raceFx/fxModel.test.ts` → `Test Files 7 passed (7)、Tests 177 passed (177)`
- `node_modules/.bin/eslint src/babylon/games/race.ts src/babylon/games/raceFx src/babylon/games/raceRules` → exit 0
- scratch `node --experimental-strip-types chk.ts`（新 track.ts）→ skip-one 兩例皆 `{lap:1, s:42.02}`
初審：
- `node_modules/.bin/vitest run src/babylon/games/raceRules src/babylon/games/raceFx/fxModel.test.ts` → `Test Files 7 passed (7)、Tests 177 passed (177)`
- `node_modules/.bin/eslint src/babylon/games/race.ts src/babylon/games/raceFx src/babylon/games/raceRules` → exit 0
- `git diff --stat 87fbc92 -- src/core src/babylon/net src/babylon/hud.ts package.json pnpm-lock.yaml` → 空
- I1 重現：把 worktree 的 `track.ts` 與 `git show 87fbc92:…/track.ts` 複製到 scratchpad，`node --experimental-strip-types chk.ts` 比對新舊 `normalizeProgress({lap:1,cp:1,s})`（s = 65、82）；`chk2.ts` 量 RACE_COURSE 非相鄰 sector 間最近中心線距離（2↔4 = 30.9，其餘 ≥ 53）。未改任何專案檔。
