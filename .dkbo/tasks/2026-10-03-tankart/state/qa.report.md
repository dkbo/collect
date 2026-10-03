# tankart-qa 報告（波 4）

`<S>` = `/tmp/claude-1000/-home-bal-project-collect--worktrees-tankart/3592c978-8a43-449c-8e07-51db5576593f/scratchpad`；`<O>` = 波 3 的 scratchpad（`…/baac1138-33fe-4888-a247-1f154be12d3a/scratchpad`）。

## 做了什麼
- 驗收 babylon 波 4 的修復（子彈壽命改用模擬 tick 累計，`tankFx/bulletLife.ts`）。用的是 production build：`vite build --outDir <S>/dist4`，再 `vite preview --port 5179`。驗完 5179 已關。
- 把波 3 的多人腳本放在 `<S>/qa/`（只放 scratchpad，不進 worktree）。另外新增 `ghostbounce.mjs`：按局比對兩端每發子彈的反彈次數；guest 比 host 多、且 host 那局沒送過該彈的 `bounce`，就算幽靈反彈。再依時刻分兩類：
  - **inPlay**：對局進行中出現，也就是波 3 疑慮 1 那一類。
  - **roundEnd**：出現在 host 進結算之後、guest 還沒收到結算的空檔。
- 偵測器先用波 3（修復前）的資料驗證，數字與波 3 報告一致：1280×800 有 4 例、480×300 有 2 例，全部是 inPlay。

### 判定
| 項 | 結果 |
|---|---|
| 幽靈反彈（inPlay，疑慮 1 類型） | ✅ **0 例**。修復前 6 例／2 輪；修復後 0 例／3 輪，共 137 顆共同子彈 |
| guest 多出反彈（含局末 roundEnd） | ⚠️ 1 例（mpA 的 b45），根因不同，見疑慮 1 |
| 單人一局坦克（回歸） | ✅ console 錯誤 0、pageerror 0。有子彈反彈、縮圈 13 格、結算正常 |
| 其他多人同步（順帶確認） | ✅ 三輪兩端結算文字一致，配色不一致 0；`bounce` 訊息 host 送出數＝guest 收到數（23／40／48） |

| 輪 | 解析度 | 共同子彈 | 有反彈 | inPlay | roundEnd |
|---|---|---|---|---|---|
| 修復前 `<O>/mp2` | 1280×800 | 38 | 27 | **4** | 0 |
| 修復前 `<O>/mp3` | 480×300 | 60 | 36 | **2** | 0 |
| mpA | 480×300 | 28 | 16 | 0 | 1 |
| mpB | 1280×800 | 58 | 29 | 0 | 0 |
| mpC | 480×300 | 51 | 39 | 0 | 0 |

壓力條件確實有重現：mpA 的 host fps 約 8，`close` 訊息之間曾停頓約 1.4 秒，跟波 3 出問題時是同一種 host 模擬落後。

## 測試
### 紅
`node <S>/qa/ghostbounce.mjs <O>/mp2.json`（修復前，1280×800）→ `"ghostBounces":4,"inPlay":4`（b5、b14、b15、b19）
`node <S>/qa/ghostbounce.mjs <O>/mp3.json`（修復前，480×300）→ `"ghostBounces":2,"inPlay":2`（b25、b42）
### 綠
`node <S>/qa/play.mjs http://localhost:5179/collect/ <S>/mpA/s --mp --width 480 --height 300 --secs 180 --every 250 --wander --fire --skip-ms 50000 --skip-after 20000` ＋ `ghostbounce.mjs <S>/mpA.json` → `{"error":null,"common":28,"bounceWireHostSent":23,"bounceWireGuestRecv":23,"ghostBounces":1,"inPlay":0,"roundEnd":1}`，兩端 errors／pageErrors 皆空
mpB（同指令，不帶 --width/--height，預設 1280×800）→ `{"error":null,"common":58,"bounceWireHostSent":40,"bounceWireGuestRecv":40,"ghostBounces":0,"inPlay":0,"roundEnd":0}`，errors 皆空
mpC（同 mpA 參數重跑）→ `{"error":null,"common":51,"bounceWireHostSent":48,"bounceWireGuestRecv":48,"ghostBounces":0,"inPlay":0,"roundEnd":0}`；`mpcmp.mjs` → `{"overlaysEqual":true,"colorMismatch":0,"closedDiff":{"maxA":4,"maxB":4}}`
單人：`node <S>/qa/play.mjs http://localhost:5179/collect/ <S>/sp/s --query 'tankTier=desktop' --width 1280 --height 720 --secs 150 --every 500 --wander --fire --skip-ms 50000 --skip-after 20000` → `{"error":null,"phases":["countdown","playing","result"],"bullets":42,"maxBounces":1,"closedMax":13,"errors":[],"pageErrors":[]}`，有 `[tank] tier desktop`、`degrade outline／glow`
全閘：`node_modules/.bin/eslint . && node_modules/.bin/tsc -b --noEmit && node_modules/.bin/vitest run` → exit 0，`Test Files 70 passed (70) / Tests 687 passed (687)`

## 自我審查
- 腳本全在 `<S>/qa/`，worktree 無 qa 改動（依 leader [BUG] 已自 worktree 移除），沒碰 `src/`。截圖與 JSON 都放在 `<S>`。
- b45 的排查過程：
  - 看 wire：b44／b45／b46 是 bot-1 三連發，同一 tick 發出，兩端都收到 `bullet`。
  - host 在 77951 由 b44 反彈後擊殺 bot-0，剩 1 台存活，於是進入結算（A 在 77956 轉成 result）。`tank.ts` 的 `simulate()` 在 `if (!playing) return` 之後才呼叫 `stepBullets`，所以 host 結算後就不再推進子彈，b45 停在 0 次反彈。
  - guest 的模擬落後約 0.6 秒，78585 才收到 b44 的 `bounce`／`hit`／`destroyed`，78961 才轉成 result。這段時間它照常預測 b45，撞牆反彈。
  - 排除的假設：不是壽命到期，b45 在 host 只活了約 1.7 秒（真實時間），模擬時間更短；也不是訊息遺失，`bounce` 送出 23 則、收到 23 則。
- 為了不把 b45 誤算成修復失敗，偵測器才加上 roundEnd／inPlay 分類。判斷標準是「guest 首次取樣到反彈的時刻是否晚於 host 最後一筆 playing 取樣」，用修復前的資料驗過，不會把原本的 6 例誤分成 roundEnd。

## 疑慮
1. **局末多一次反彈（roundEnd，跟壽命修復無關，未發 BUG）**：host 一進結算就停止推進子彈；guest 在收到結算前（本環境約 0.4–1 秒）還會繼續預測，飛到牆的子彈就在 guest 多反彈一次。畫面上只是結算框出現前，guest 端多一個火花加轉向，不影響名次與 HP，因為 host 權威且已結算。這是既有的時序（波 3 也一樣，只是當時被 inPlay 那類蓋過），brief 的完成條件「幽靈反彈 0 例」若要連這類也算進去，要另外決定修法，例如 guest 收到最後一則 `destroyed` 就凍結子彈，或 host 結算時一併清彈並廣播。請領導裁定。
2. 多人只在本機雙頁 swiftshader 驗（fps 7–12）。這是比正常機器更嚴苛的條件，修復後 inPlay 仍為 0。
