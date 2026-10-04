# raceart-qa 報告（波 4）

`<S>` = `/tmp/claude-1000/-home-bal-project-collect--worktrees-raceart/75fcbee4-0629-4684-836c-3c6d1f28da4d/scratchpad`。波 3 報告已封存在 `state/qa.report.w3.md`。

## 做了什麼
- **受測版本**：
  - `dist4b`：babylon 修完 I1（重開局誤播彩帶）後的 worktree。
  - `dist4c`：babylon 修完火花 BUG 後的最終 worktree。
  - 兩者都用 `vite build --outDir <S>/...` 建置，再用 `vite preview --port 5177` 開。
  - dist4b 與 dist4c 的差別只在火花樣式（babylon report 修復段）。火花、bundle、全套測試都以 dist4c 為準，其他項沿用 dist4b 的結果。
  - 前一個 session 用 00:48 的 dist4（修 I1 前）跑的 `<S>/w4/full*` 已作廢，不採用。
- **基準**：主樹 `docs/`（e9cd4f5）用 `vite preview --outDir docs --port 5176` 開；任務 base 是 `a1fb3c9`（`<S>/distbase` 由 `git archive` 建置）。
- **環境**：headless chromium＋swiftshader。fps 在 1920 時 1–3、在 960 時 2–8，只記錄不判定。
- **工具**：腳本都在 `<S>/qa/`。
  - 本波新增 `fxdrive.mjs`、`fxdrive2.mjs`：強制情境，在自己的車觸發事件時連拍。
  - `drift3.mjs`：甩尾三段專拍。
  - `sync.mjs`：多人同步取樣。
  - `slip.mjs`、`mpslip.mjs`：尾流。
  - `play.mjs` 加了 `--fsbtn`，按站內全螢幕鈕，這樣 HUD 會一起進全螢幕。
- **BUG 1 則**：甩尾火花紫段太暗 → babylon FIXED（亮芯 `sparkHot`＋`SPARK_SIZE 0.5`）→ 用 dist4c 複驗 ✅。
- **HUD**：沒有 BUG，已用 ANSWER 通知 babylon-hud 可以交付。
- 5176、5177 兩個 preview 都已關，確認沒有殘留的 listen。

### 判定
| AC | 判定 | 證據（頁面／視窗／對照稿） |
|---|---|---|
| AC1 方向稿 | ✅ | `design/` 有 `spec.md`、`variant-A.pen`、`variant-A-{gameplay,track,sheet}.webp`。AC18 截圖逐張對照 `variant-A-gameplay`。 |
| AC2–AC8 | ✅（波 2 判定，本波沒退化） | 本波兩端兩局都跑完。<br>• 圈數、名次、結算都一致（見 AC17）。<br>• 道具 4 種都有被使用：自己用過 mushroom、shell、shield。<br>• 跳台騰空 land 計數 9–18。<br>• 出界重生：fx2 強制開出路面後 ghost 有觸發。<br>• 逆向警告：full 有 `ww` 12 筆。<br>• 手機四顆鈕見 AC18。<br>• 尾流機制本身是波 2 驗的；本波畫面沒拍到，見疑慮 1。 |
| AC9／AC10／AC13 | ✅ | 波 3 已判定。本波 1920／960 截圖的車、場景、描邊、陰影、Glow 與波 3 一致。 |
| AC11 特效表 | ✅（第 3 列尾流風線未實拍，見疑慮 1） | 逐列見下方「特效表連拍」。 |
| AC12 HUD | ✅ | `[data-race-hud]` 三檔：<br>• 名次大字 `4th/4`、`3rd/4`。<br>• `LAP 1/3`、`LAP 2/3`。<br>• 本圈時間與 `BEST`（第二圈後有值，例如 `BEST 1:17.84`）。<br>• 道具欄、小地圖（自己的點較大、4 色）。<br>• 衝線後名次表沿用 overlay。<br>• 3D 文字 HUD 已移除。<br>• 倒數用共用 theme：手機截圖可見大字倒數掛在 UI 層。<br>• 對照 `variant-A-gameplay` 版面一致，見 `<S>/ac18/cmp-gameplay.png`。 |
| AC13 降級 | ✅ | `?raceTier=desktop`，960×540，單獨跑：`768 tier desktop → 21213 degrade outline → 39349 degrade glow → 52910 degrade shadow`（`<S>/ac18/degrade.json`）。<br>mobile 檔：`tier mobile`，跑一段後 `degrade shadow`。 |
| AC14 效能 | 記錄：N0 = 54、N1 = 63 ≤ 100 ✅ | 1920×1080，`?raceTier=desktop&raceNoDegrade=1`，單人 3 bot。<br>• N0：倒數結束後 5 秒起連取 3 次 drawCalls＝54／54／54，最大 54；整局 36–56（`ac18/d1920.json`）。<br>• N1：`&raceBench=1`，峰值 63，之後 45–63（`ac18/bench.json`）。<br>• fps 1–3（swiftshader），只記錄。 |
| AC15 bundle | ✅ | gzip -9，以 dist4c 為準：<br>• `Battle-*.js`：108533 → 140690，**+32157 B ≈ +31.4 KB**（上限 35）。<br>• `vendor-babylon-*.js`：446239 → 445326，−913 B（上限 +10 KB）。<br>chunk 名單與 base 相同，沒有新拆的遊戲 chunk。worktree `docs/` 沒動。 |
| AC16 零回歸 | ✅ | `DK_TEST_CMD` 全綠：eslint、tsc 通過，vitest `94 files / 989 tests`。<br>`git diff a1fb3c9` 以下這些都是空的：<br>• `src/core`、`src/babylon/net`、`src/babylon/hud.ts`<br>• `bomberFx`、`kitchenFx`、`tankFx`<br>• `src/babylon/games/{bomber,overcooked,tank}*.ts`<br>• `package.json`、`pnpm-lock.yaml`<br>`index.css` 只新增 `.race-*`。<br>production preview 單人整局連拍 840s（`w4b/full.json`）共跑了 4 局，前 3 局結束後由 `RESULT_RESTART_MS` 自動重開，第 4 局是按 r 重開：pageerror 0，console 只有 swiftshader 的 `GPU stall due to ReadPixels` 警告；info 全是 `[race]` 前綴。<br>三款與主樹 docs 同參數 1920×1080 開局截圖並排：`<S>/cmp4/cmp-{bomber,overcooked,tank}.png`，SSIM 0.861／0.999／0.952。<br>bomber 偏低是因為隨機箱子配置、計時 0:37 對 0:35、bot 位置不同（fps 1 下截到的時間點不同）。HUD 卡片與場景靜態物件一致，三款 pageerror 0。 |
| AC17 多人 | ✅ | `--mp`（兩個 context），Firestore 可用，房間 SY34UU。<br>• **結算一致**：兩局兩端 overlay 文字逐字相同。例：`1. 電腦2 — 2:14.86 2. 電腦1 — 2:17.74 3. QAk2y — 未完賽 4. QAhg4 — 未完賽`（`mp4b/mp.json`）。<br>• **再開一局**：兩端都跑完第二局，結算一致；重開後倒數與開局期間 `fx.confetti` 兩端都維持 0，要等 bot 過線才 +1，波 4 I1 已修。<br>• **道具一致**：兩端 `seen` 計數全同（grant 19、spawn 13、spin 6、blocked 2、hit 8、expire 1、clash 2），代表道具箱先到先得、生成、命中、護盾擋下都一致。<br>• **bot 位置同步**：`mp4c` 每 1.5s 同時取樣，174 筆配對（時間差 < 400ms）的距離中位數 0.00、p90 0.57、最大 3.98。<br>• **名次與道具箱**：名次順序 85/87 筆相同，2 筆是過彎瞬時差；`taken` 86/87、場上道具數 87/87 相同。<br>• **顏色一致**：host 紅、guest 藍，兩端小地圖顏色互相對應（`mp4c/pair.png`）。<br>• 兩端 pageerror 0。 |
| AC18 驗收截圖 | ✅（尾流列除外） | 見下表與「特效表連拍」。 |

### AC18 截圖（皆用站內全螢幕鈕，HUD 一起入鏡）
| 檔 | 視窗／參數 | 對應 AC／對照稿 |
|---|---|---|
| `<S>/ac18/d1920-1-029786.png`（另有 `052526`、`073275`、`096167`、`121028`、`countdown`） | 1920×1080，`?raceTier=desktop&raceNoDegrade=1` | AC9／10／12／18。對照 `variant-A-gameplay`：並排圖 `ac18/cmp-gameplay.png`，HUD 四角配置一致；速度線在天空邊緣可見（AC11 #4）。 |
| `<S>/ac18/d960-1-041809.png`、`080071.png` 等 10 張 | 960×540，同上 | AC12 中檔版面、AC11 胎痕（右圖車後）。 |
| `<S>/ac18/m844-1-countdown.png`、`022144.png` 等 | 844×390 touch，`?raceTier=mobile` | AC8：四顆觸控鈕（道具、煞車、甩尾、油門）＋只派發轉向的搖桿；AC12 `max-height:500px` 精簡成單列 HUD；AC13 `tier mobile`。合併圖 `ac18/vm.png`。 |
| `<S>/ac18/bench-1-*.png` | 1920×1080，`&raceBench=1` | AC14 N1。 |

### 特效表連拍（spec §8；有入鏡的列看截圖，短壽命的列以 `__BATTLE_POS.fx`／`fxLive` 計數佐證，依領導 DECISION）
| # | 判定 | 連拍與佐證 |
|---|---|---|
| 1 甩尾火花三段 | ✅（修後，dist4c） | `w4b/fx4-1-t2-*`，放大圖 `w4b/zoom-drift-fixed.png`：段 2 右後輪有橘色火花；段 3 兩後輪有白芯紫尾火花束，火花芯有 Glow。<br>修前對照 `w4b/zoom-drift.png`：紫粒子在深紫路面幾乎看不見。<br>段 1 藍色沒拍到：fps 2–5 下 0.6s 的段位窗口比截圖延遲短。 |
| 2 放開加速噴焰 | ✅ | `fx4-1-t2-release-0`：紫色段位噴焰，`boostMs` 633；`fx2-1-mush-*`、`fx2-1-pad-*` 是 flame 三層噴焰。 |
| 3 尾流風線 | ❌ 未實拍 | 4 種情境都沒讓自己的 `slipMs>0`，見疑慮 1。 |
| 4 速度線 | ✅ | `ac18/d1920-1-029786.png`、`fx2-1-fast-1-0`：畫面上緣的白色放射線。 |
| 5 路面外揚塵 | ✅ | `fx2-1-dust-*`、`w4b/full-1-fx-dust-*`（車輪後方的煙）。 |
| 6 胎痕 | ✅ | `zoom-drift*.png`、`d960-1-080071.png`：車後兩條深色痕；`fxLive.skids` 到 160。 |
| 7 碰撞火花 | 計數 ✅ | `fx.clash` 4–8／局；連拍 `full-1-fx-clash-*`，事件在鏡頭外。 |
| 8 撿箱碎裂／重生彈出 | ✅／計數 | `fx2-1-box-1-0`：撿箱當下；`fx.boxBreak` 14–19／局，兩端 `seen.grant` 一致。 |
| 9 香蕉打滑 | 計數 ✅ | `seen.spin` 3–6、`fx.bananaDie` 4–6；`fx2-1-spin-*` 是自己打滑時拍的，畫面看不出轉圈。 |
| 10 龜殼拖尾＋爆炸 | 計數 ✅ | `fx.shellBoom` 1–4；`full-1-fx-shellBoom-*` 事件在鏡頭外。 |
| 11 護盾泡泡／擋下 | ✅（補拍到波 3 疑慮 1） | `w4b/fx1-1-shield-1-{0,1}`、`shield-2-0`，合併 `m-shield-1-0.png`：自己的車外有半透明藍白泡泡，`shieldMs` 7100→2867。擋下：`fx.shieldBreak` 1–3（`full-1-fx-shieldBreak-*`）。 |
| 12 跳台落地 | ✅ | `fx2-1-land-1-0`：著地揚塵環。 |
| 13 重生閃爍 | ✅ | `fx2-1-ghost-1-*`、`full-1-fx-ghost-*`：車身半透明，`ghostMs` 667／500。 |
| 14 換圈浮字 | 計數 ✅ | `fx.lapCard` 1；連拍 `full-1-fx-lapCard-*` 時字卡已經消失。 |
| 15 衝線彩帶 | 計數 ✅ | `fx.confetti` 隨 bot 過線 +1；`full-1-fx-confetti-*`。重開不誤播見 AC17。 |
| 16 鏡頭微震 | 計數 ✅ | guest `fx.shake` 1（`mp4b`）、fx2 被龜殼命中時 `shake` 事件。 |
| 17 加速帶閃光 | ✅ | `fx2-1-pad-1-0`：車後有橘色星形火花＋噴焰。 |
| 18 加速菇彈出 | 計數 ✅ | `fx.mushroom` 1–4；`fx2-1-mush-*` 拍到噴焰，彈出 160ms 沒入鏡。他車彈出只有 host 看得到，已裁定。 |

## 測試
### 紅
`node <S>/qa/play.mjs --base http://localhost:5177/collect/ --hashq 'raceTier=desktop&raceNoDegrade=1' --width 960 --height 540 --fs 1 --drive <S>/qa/fxdrive.mjs --secs 300 --out <S>/w4b/fx1`（dist4b，修火花前）
`{"error":null,…,"pageErrors":0,"shots":20}`；`zoom-drift.png`：段 3（`dr 3`、`particles 12–14`）紫粒子在深紫路面上幾乎看不見 → 送 babylon [BUG]
### 綠
`node <S>/qa/play.mjs --base http://localhost:5177/collect/ --hashq 'raceTier=desktop&raceNoDegrade=1' --width 960 --height 540 --fs 1 --drive <S>/qa/drift3.mjs --secs 120 --out <S>/w4b/fx4`（dist4c，修火花後）
`{"error":null,…,"pageErrors":0,"shots":11}`；`zoom-drift-fixed.png`：段 2 橘、段 3 白芯紫尾火花束清楚可見
`(eslint . && tsc -b --noEmit && vitest run)`（worktree 最終狀態）→ `ESLINT_OK`、`TSC_OK`、`Test Files 94 passed (94)`、`Tests 989 passed (989)`
`node <S>/qa/play.mjs … --width 960 --height 540 --canvas 1 --drive qa/auto4.mjs --scenario race --fx-burst 2 --restart 1 --secs 840 --out <S>/w4b/full` → `{"error":null,"brief":[{"infos":382,"errors":4,"pageErrors":0,"shots":115}]}`（4 則是 ReadPixels 警告）
`node <S>/qa/play.mjs … --width 640 --height 360 --mp 1 --dns 1 --canvas 1 --drive qa/auto4.mjs --scenario race --restart 1 --secs 620 --out <S>/mp4b/mp` → 兩個 context 都是 `pageErrors 0`，兩局結算文字相同
`node <S>/qa/play.mjs … --mp 1 --dns 1 --drive qa/sync.mjs --secs 150 --out <S>/mp4c/mp` → `bot dist n 174 median 0.00 p90 0.57 max 3.98`、`order same [87,85]`、`taken same [87,86]`、`items same [87,87]`
`node <S>/qa/play.mjs … --query raceTier=desktop --width 960 --height 540 --drive qa/auto4.mjs --secs 160 --out <S>/ac18/degrade` → `tier desktop | 21213 degrade outline | 39349 degrade glow | 52910 degrade shadow`
`node <S>/qa/play.mjs … --query 'raceTier=desktop&raceNoDegrade=1&raceBench=1' --width 1920 --height 1080 --fsbtn 1 --secs 45 --out <S>/ac18/bench` → drawCalls 峰值 63
`node <S>/qa/play.mjs … --query raceTier=mobile --width 844 --height 390 --touch 1 --fsbtn 1 --out <S>/ac18/m844` → `tier mobile`、`touch-action` 4 個、`degrade shadow`
`gzip -9c <S>/{distbase,dist4c}/assets/{Battle,vendor-babylon}-*.js | wc -c` → Battle 108533→140690、vendor 446239→445326
`for g in bomber overcooked tank; do play.mjs --base :5176|:5177 --game $g --width 1920 --height 1080 --first-countdown; done` ＋ `ffmpeg -lavfi ssim` → All 0.861／0.999／0.952，pageErrors 0
`git diff a1fb3c9 -- src/core src/babylon/net src/babylon/hud.ts src/babylon/games/{bomber,kitchen,tank}Fx package.json pnpm-lock.yaml | wc -l` → `0`

## 自我審查
- 沒改 worktree（可改欄是「—」）。腳本、截圖、build 產物都在 `<S>`；5176、5177 的 preview 都已關，`ss -ltn` 確認沒有殘留。
- 前一個 session 留下的整局連拍還在跑，打的是修 I1 前的 dist4。本 session 一開始就停掉它和舊 preview，全部改用新 build 重跑。
- 單人整局連拍裡，特效計數器在沒按重開的情況下歸零了兩次。查明是結算後 10s 自動重開（`race.ts:1354` `RESULT_RESTART_MS`，既有行為）。探測腳本每輪連拍要 10–15s，所以沒抓到 overlay。這不是 BUG，反而多了 3 次重開不誤播彩帶的證據。
- 第一次多人跑被我設的外層 `timeout 800` 在寫 JSON 前砍掉（只剩截圖），已放寬 timeout 重跑（`mp4b`），結論以重跑的為準。
- 探測 AI 在低 fps 下常開出路面，所以自己幾乎都是第 4 名。截圖只用來判美術與特效，手感是波 2 判的。

## 疑慮
1. **尾流風線（特效表 #3）沒在畫面上拍到**：
   - 試了 4 種情境，自己的 `slipMs` 都沒變成正值：單人起跑跟 bot、單人先讓 bot 超車再跟、多人 guest 跟 host（host-pace 7／11／13）。
   - 原因：bot 起步比自己快；guest 跟車控制在 fps 2–5 下會撞上或並排，進不了 6 單位、25° 的錐形區並持續 1.2s。
   - 已有的佐證：程式面 `fxModel.slipLook` 有單測，race.ts 有接線（babylon report #3），尾流加速機制波 2 實機驗過。
   - 建議關卡③由人在實機看一眼。
2. **短壽命特效以計數佐證**：#7、#9、#10、#14、#16、#18 的連拍都有，但事件發生在鏡頭外或已經消失；依領導 DECISION，以 `__BATTLE_POS.fx` 計數判定。甩尾段 1（藍）同理沒拍到。
3. **火花尺寸偏離 spec**：火花基準尺寸改成 0.5，偏離 spec 的 0.18，已由領導裁定。修後在 swiftshader 下仍偏稀疏（每幀顆數少），真機 60fps 應會更密（babylon 疑慮）。
4. **bomber 對照 SSIM 0.861** 比波 3 的 0.924 低：原因是 fps 1 下截到的時間點不同、箱子隨機。人工並排確認 HUD 與靜態物件沒有差異，`bomber*.ts`／`bomberFx` 的 diff 是空的。
