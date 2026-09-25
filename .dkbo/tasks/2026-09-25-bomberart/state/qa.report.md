# qa 報告（波 4）
## 做了什麼
兩位 dev 都 done 後，把 worktree 的 production build 建到 5174 preview 的 dist（`vite build --outDir <波3 scratchpad>/dist`，preview 進程沒重啟，確認 index 已換成 `index-CXxmSnao.js`），再用 `wave4.mjs` 單人跑一局。視窗 960×540，網址帶 `?bomberTier=desktop&bomberNoDegrade=1`，暫停時鐘逐幀推進，亂數固定。流程：炸 (1,0) 木箱掉出無敵道具，34.16s 撿起（無敵到 41.16s），回 (0,0)。(0,0) 是突然死亡螺旋的第一格，40.06s 在無敵中被落牆壓死，接著一路跑到結算。沒有連 Firebase，也沒動 `(default)` DB。

| 驗收項 | 結果 | 證據（960×540，對照波 3 的 variant-A 版面） |
|---|---|---|
| 陣亡卡無盾牌徽章 | ✅ 39.5s 時 P1 卡有「🛡 2s」徽章（`inv:true`）；40.06s 陣亡後 P1 卡變灰加 💀，`[data-bomber-badge=invincible]` 不見了（陣亡 +0.3s 與 +1.8s 各驗一次）。P4 陣亡卡同樣沒有徽章 | `/tmp/claude-1000/-home-bal-project-collect--worktrees-bomberart/3af080d9-faa2-4604-babc-d61ae0a96434/scratchpad/w4/02-t39_5-invincible.png`、`03-dead-card.png`、`04-dead-card-later.png` |
| 結算時計時器不跳 0:40 | ✅ 最後一個 playing 幀是「縮圈中 存活 2/4」；進入 result 後每 500ms 取樣 8 次（共 4 秒），都是「縮圈中 存活 0/4」（`mode: sudden`），沒有出現 0:40（波 3 的 `w3/sheet-hud.png` 會跳回 0:40） | `05-result.png`、`06-result-3s.png`；`summary.json` 的 `timers` |
| 960×540 全螢幕鈕不壓 P2 | ✅ 按鈕 rect 為 [916,8,952,44]，P2 卡為 [854,50,942,205]，P2 編號為 [920,58,935,70]，兩者都不重疊（`btnOverP2Card=false`、`btnOverP2No=false`），目視也沒有遮擋 | `01-start.png`（右上） |
| 開局 console 無錯 | ✅ 開局 600ms 時 `consoleErrors`／`pageErrors` 都是空的；整局跑到結算也是 0／0 | `summary.json` 的 `startErrors`、`consoleErrors` |
| （附）首行 perf log | ✅ 第一行是 `drawCalls=14 fps=1`（暫停時鐘剛啟動才會是 fps=1），不再是 `drawCalls=0 fps=Infinity`；之後是 `drawCalls=47–81 fps=62` | `summary.json` 的 `info` |

## 測試
### 紅
不適用: qa 不寫單測。修前的現象已記在波 3：`w3/sheet-hud.png` 結算時跳 0:40、`r2/02-start.png` P2 編號被全螢幕鈕壓住、`rt-deg2` 首行 `drawCalls=0 fps=Infinity`（見波 3 report 的 Minor）
本波用修後的 build 重驗，結果記在綠段
### 綠
`node wave4.mjs http://localhost:5174/collect/ /tmp/claude-1000/-home-bal-project-collect--worktrees-bomberart/3af080d9-faa2-4604-babc-d61ae0a96434/scratchpad/w4`（腳本在 `/tmp/claude-1000/-home-bal-project-collect--worktrees-bomberart/3af080d9-faa2-4604-babc-d61ae0a96434/scratchpad`，搭配 `lib.mjs`）
`{"startErrors":{"console":[],"page":[]},"btnOverP2Card":false,"btnOverP2No":false,"pickedAt":34160,"deadAt":40060,"lastPlayingTimer":{"mode":"sudden","text":"縮圈中 存活 2/4"},"resultReached":true,"timers":8×{"mode":"sudden","text":"縮圈中 存活 0/4"},"cErr":0,"pErr":0,"info0":["[bomber] tier desktop","[bomber] drawCalls=14 fps=1","[bomber] drawCalls=47 fps=62"]}`
全閘：`node_modules/.bin/eslint . && node_modules/.bin/tsc -b --noEmit && node_modules/.bin/vitest run`
`eslint-ok / tsc-ok / Test Files 42 passed (42), Tests 409 passed (409)`
`vite build` 成功：`vendor-babylon 2,000.88 kB │ gzip: 450.79 kB`（≤ 650 KB）

## 自我審查
- 沒有改任何 repo 檔（touched 為空），腳本與截圖都在 scratchpad。`docs/` 沒有變更。
- 無敵中陣亡只有突然死亡落牆能做到（爆炸與殘火都會跳過無敵），所以用這條路徑重現，徽章「修前有、修後無」確實被打到。

## 疑慮
- 結算凍結這次只實測到「在突然死亡中結束的回合」（凍結成「縮圈中」）。40 秒前就分出勝負、應凍結成秒數的那條路徑，單人對 3 個 AI 很難穩定重現，目前只靠 babylon 的 `hudModel.phase.test.ts`（`phaseTimer`）覆蓋。
- 多人（AC10 `--contexts 2`）不在本波範圍，仍待 dkbo-collect 恢復。
