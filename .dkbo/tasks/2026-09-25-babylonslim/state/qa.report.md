# qa 報告（波 3）
截圖根目錄 `S=/tmp/claude-1000/-home-bal-project-collect--worktrees-babylonslim/f9f3ea5b-6ece-4b9a-b4e3-ba7404c55f84/scratchpad`：基準 `$S/base/`、改後 `$S/after/`、並排比對（左基準、右改後，各縮半寬）`$S/cmp/`。
基準 = 主樹 `docs/`（master build）`vite preview --port 5173 --strictPort`；改後 = worktree `vite build --outDir $S/dist` + `vite preview --port 5174 --strictPort`。兩個 preview 都已關。
驗證腳本：`scripts/qa/babylonslim/mp.mjs`（`--solo`／`--mobile`／`--net`／無旗標 = 兩個 context 多人），兩邊同一支腳本、同一流程。

## 做了什麼
- **AC5 多人（兩個 context）：沒驗成，外部環境擋住（已 ESCALATE）**。建房一直等不到房號；console：`Firestore: Database 'dkbo-collect' not found`。node 直連探針（`$S/probe.mjs`）：`signInAnonymously` 成功，`initializeFirestore(app,{},'dkbo-collect')` 的 getDoc 回 gRPC `5 NOT_FOUND`。master 的 docs 基準也一樣掛 → test-73ce3 的具名 DB 不存在（或被刪），跟本任務無關。多人腳本已寫好（兩人建房／加入／開局，坦克同欄對射、賽車繞圈、轟炸炸箱、廚房出餐、結算、房主按鈕重開），DB 恢復後跑 `node scripts/qa/babylonslim/mp.mjs http://localhost:5174/collect/ $S/after/mp` 即可。
- **替代做法**：四款改走單人（SoloGame：noop transport、本機就是 host；用的遊戲模組、HUD、Babylon 載入路徑跟多人相同），每款觸發必經事件、打到結算、再開一局，兩個 build 逐款比對。

### AC5（單人版，1280×800）逐款結果（基準 → 改後）
| 遊戲 | 必經事件 | 結算 | 再開一局 | console error／pageerror | 並排圖 |
|---|---|---|---|---|---|
| tank | 移到 cx=2 往 +z 連射 14 發，木箱被打掉、掉道具（圖可見） | 單人沒有結算：程式本來就只在 ≥2 人時裁決（tank.ts:811），R 只在陣亡／結算時生效 → 兩邊都「restart=false」，行為一致 | 同左 | 0／0 → 0／0 | cmp/s-tank-*.png |
| race | 自動駕駛繞環道 q=12（3 圈） | ✅「🏆 你獲得勝利！1. 玩家 — 3 圈」→ ✅ 相同 | ✅ 重開，回到出生點 q=0 → ✅ | 0／0 → 0／0 | cmp/s-race-*.png |
| bomber | 放彈炸 (2,0) 一帶、原地放彈自爆（alive=false） | ✅「💥 本局結束／勝場…／下一回合」→ ✅ 相同 | ✅ 下一回合進 countdown→playing → ✅ | 0／0 → 0／0 | cmp/s-bomber-*.png |
| overcooked | 取料→切→煮全程走通（HUD「手持 蔬菜（生）／已切」），**出餐做不到**，兩邊都一樣（見疑慮 1） | ✅ 120s 到時結算（這款沒有 overlay，10s 後自動重開）→ ✅ | ✅ 自動重開 → ✅ | 0／0 → 0／0 | cmp/s-overcooked-*.png |
- 畫面並排比對（countdown／playing／mid／result／restart 五個時間點）：模型、材質、DynamicTexture 文字（HUD、訂單／食譜面板、倒數 banner）、粒子（坦克道具、賽車加速帶）、光照、相機完全一致；只有亂數地圖、AI 位置、訂單內容這類本來就隨機的東西不同。
- 沒有 Babylon「needs to be imported」這類錯誤，也沒有 AudioEngine／audio 錯誤（兩邊都 0）。唯一的 warning 是 swiftshader 的 `GPU stall due to ReadPixels`（兩邊都有，只出現在坦克）。
- placeholderScene：`games/index.ts` 四種 gameType 都有註冊，`/battle` 沒有任何路徑會進 placeholderScene → 不適用。

### AC6 觸控與 HUD（依領導 DECISION：直向出遮罩就截圖為證，改用 844×390 橫向＋hasTouch 驗）
- HUD 文字面板＋倒數面板四款都有顯示（見 cmp/s-*-1-countdown、2-playing）。
- 390×844（直向 isMobile+hasTouch）：進得了坦克單人，但畫面顯示「請將手機轉為橫向」（BabylonCanvas 的直向提示，這時搖桿不會 render），基準也一樣 → cmp/m-tank-touch-end-m390x844.png。
- 844×390（同一支手機轉橫向）：用 CDP `Input.dispatchTouchEvent` 拖搖桿，位置 -13,-13 → **-6.53,-9.29**（基準 -9.50,-6.53，拖曳時間抓得不一樣，兩邊都有移動）；console 0 error、0 pageerror → cmp/m-tank-touch-mid-m844x390.png。

### AC7 網路（`--net`；依領導 DECISION 以首頁 network 有無 vendor-babylon 請求判定 → ✅ 無）
| 路由 | 基準下載 vendor-babylon | 改後下載 vendor-babylon |
|---|---|---|
| #/ | **vendor-babylon-DX_pSv5-.js（6.4 MB）** | 無 |
| #/todos、#/resume、#/search、#/directions、#/miniGame | 無 | 無 |
| #/battle | （首頁已載） | vendor-babylon-DeqhOscI.js ＋ Battle-DiW6NRxI.js |
| #/battle 單人坦克 | 進 playing ✅ | 進 playing ✅ |
- `$S/dist/index.html` 的 modulepreload：rolldown-runtime、preload-helper、vendor-others、vendor-lucide、vendor-react（**沒有 vendor-babylon**；基準 docs 有）。
- `grep -lE 'from"\./vendor-babylon' dist/assets/*.js` → 只剩 `Battle-DiW6NRxI.js`；`grep -l vendor-babylon` 另外會命中 `index-*.js`，那只是 lazy 路由的 mapDeps 檔名字串，實測首頁不會下載（上表）。
- 非 /battle 頁面沒有 Babylon 相關的 console 錯誤。#/directions 有既有的 Google Maps 錯誤 `Geocoding Service: You must enable Billing` 和一些 deprecation warning，基準也一樣，屬外部 API、跟本任務無關。

## 測試
### 紅
`node scripts/qa/babylonslim/mp.mjs http://localhost:5173/collect/ $S/base/b tank`（兩個 context 多人，基準）
→ `TimeoutError: waiting for [data-testid="battle-room-code"]`；console：`Firestore: Database 'dkbo-collect' not found`（探針 gRPC 5 NOT_FOUND）——環境擋住，不是 build 回歸
`node scripts/qa/babylonslim/mp.mjs http://localhost:5173/collect/ $S/base/n --net`（基準首頁）→ `{"route":"#/","babylon":["vendor-babylon-DX_pSv5-.js"]}`（AC7 修之前的現象）
### 綠
`node scripts/qa/babylonslim/mp.mjs http://localhost:5174/collect/ $S/after/s --solo` → 4 款 playing=true、race／bomber／overcooked result=true、restart=true、consoleErr=[]、pageErrors=[]（tank 見上表）；基準 `$S/base/solo.json` 結果相同
`node scripts/qa/babylonslim/mp.mjs http://localhost:5174/collect/ $S/after/m --mobile` → 844×390 pos -13,-13 → -6.53,-9.29、pageErrors=[]；390×844 rotatePrompt=true
`node scripts/qa/babylonslim/mp.mjs http://localhost:5174/collect/ $S/after/n --net` → #/ 到 #/miniGame 的 babylon=[]；#/battle 才出現 vendor-babylon-DeqhOscI.js
`node_modules/.bin/vite build --outDir $S/dist --emptyOutDir` → exit 0，vendor-babylon 1,740.22 kB（gzip 398.32 kB；檔案 1,740,223 B），沒有 500 kB 警告；`chunkSizeWarningLimit: 1915`（vite.config.ts:63）；基準 docs 是 6,403,753 B
AC1 grep → 0 行；`git status --short docs` → 空；`node_modules/.bin/eslint scripts/qa/babylonslim/mp.mjs` → exit 0

## 自我審查
- 排除：廚房／轟炸第一次跑失敗，一開始以為是遊戲回歸 → 其實是腳本：移速 5.5 時按住方向鍵、容差 0.12，輪詢延遲下會來回震盪到逾時。改成距離 < 1 就放鍵、用短按微調之後，兩邊都能順利走位（log 在 ev.scoreLogA 的 [goTo 結果, 秒]）。
- 排除：手機搖桿第一次沒動，是因為沒先把 canvas 捲進矮視窗，觸控點落在 viewport 外（dev 的腳本有 scrollIntoView），補上後兩邊都能動。
- 排除：「單人坦克 R 鍵不能重開」是遊戲本身的規則（canAdvanceMidRound 只在陣亡／結算時放行），基準也一樣。
- 基準和改後用同一支腳本、同一組步驟；隨機地圖和 AI 造成的差異不算畫面差異。

## 疑慮
1. **廚房出餐是 master 就有的既有 bug，不是本任務造成的**：`overcookedKitchen.ts:225` 湯煮好時把 `busyUntil` 設成「會焦掉的時刻」，`:191` 取湯又要求 `isReady`（busyUntil <= now）→ 湯要等到焦掉才拿得起來，實際上只能拿到焦湯，永遠出不了餐。AC5 的「完成一次上菜」在基準和改後都做不到。已 ESCALATE，建議另開 fix 任務。
2. **AC5 多人的兩個 context、位置同步、結算後重開：沒驗**（Firestore DB NOT_FOUND）。單人版只證明「Babylon 瘦身沒有弄壞渲染、事件、HUD、結算」；WebRTC／同步層本任務沒動（net 只讀），但仍缺實測。DB 恢復後可以直接跑上面那條多人指令補驗。
3. 單人坦克沒有結算畫面可以驗（遊戲規則如此）；坦克的結算／重開只能靠多人驗。
