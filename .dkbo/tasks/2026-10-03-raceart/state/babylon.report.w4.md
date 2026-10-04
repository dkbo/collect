# babylon 報告（波 4）
## 做了什麼
spec 特效表 18 列全接（AC11）、race 改 React `setHud`（AC12 遊戲側，依契約量化）、移除 3D 文字 HUD 面板、`__BATTLE_POS` 補 bot 座標與特效計數、順修波 3 Minor M3／M5／M10。raceRules、net、core、hud.ts、types.ts、Battle/** 都沒動。

| 檔 | 內容 |
|---|---|
| `raceFx/fxModel.ts`（新，純函式＋單測） | 重生閃爍 `ghostVisibility`（1↔0.3、10Hz）與落下 `respawnDropY`、甩尾火花段位樣式、噴焰色 `boostColor`（mini-turbo 段位色／flame）、尾流 `slipLook`、速度線 `speedLineAlpha`／`speedLineCap`、胎痕 `skidScale`、碰撞 `relSpeed`／`clashReady`（同一對 300ms）、碎塊 `chunkPose`、箱重生 `boxPopScale`、打滑 `spinPose`（2 圈 easeOut＋龜殼彈起）、被踩香蕉、護盾 `shieldPose`（最後 2s 6Hz 閃、擋下膨脹、到期淡出）、落地 `landSquash`（只讀 import `tankFx/juice.squashPose`）、換圈字卡、彩帶數、鏡頭微震、加速菇 |
| `raceFx/hudModel.ts`（新，純函式＋單測） | `buildRaceHud`：名次、`lap = min(own.lap+1, laps)`、時間量化 10ms、車點 0.1、`map.pts` 原參照、轉盤 `ROLL_MS = 900`、`finalLap`、衝線後 `results`；`mapOutline` 開局抽樣一次（≤160 點） |
| `raceFx/effects.ts`（新） | `RaceFx`：4 組 `FxEmitter`（spark／smoke／circle／star，上限＝檔位 particleCap 150/60）、噴焰 plane 池 8、地面白環池 4、浮字卡池 2（圖集 UV）、加速菇池 4（描邊）、胎痕／尾流風線／頭頂暈眩星各 1 組 thin instance、UI 相機上的速度線 plane；`car()` 每幀算連續特效並回傳姿態修正（落下、打滑、擠壓、閃爍、護盾） |
| `raceFx/world.ts` | 拿掉暫用火花（M3：顏色 slot 錯位整段消失）；新增道具箱碎塊（縮小的道具箱 thin instance，共用箱材質＝4 種面色）、箱重生 backOut 彈出、被踩香蕉消失動畫、觀眾歡呼、加速帶閃光 |
| `raceFx/models.ts` | `mushroomData`（spec §4.2）＋單測 |
| `raceFx/textures.ts` | 浮字圖集（§8.1，4×2 格）、速度線貼圖（36 條放射線、中心 55% 鏤空） |
| `raceFx/carPose.ts` | `yawToward`：甩尾放開 120ms 回正（M5）＋單測 |
| `raceFx/carVisual.ts` | 欄位整理（拿掉 sparkSide/sparkAcc/spinAngle，加 driftYaw/wasGhost/wasAirFx） |
| `race.ts` | 接特效（事件：itemGrant、spin、itemGone、lap、finish、pad、mushroom；每幀：碰撞、衝線、龜殼拖尾、尾流、速度線、鏡頭微震）；重生閃爍改 `body.visibility` 1↔0.3（M10，暗的半週期收輪胎／火花芯／blob）；`syncHud` 送 `RaceHud`（結算凍結、dispose 送 null）；圈時改各端都算（`stepClocks`，HUD 最佳圈；host 結算沿用同一份，順序放在 hostTick 前）；移除 `createTextPanel` 文字 HUD |

### 特效表對照（spec §8）
| # | 觸發處 | 畫在哪 |
|---|---|---|
| 1 甩尾火花三段色＋3 段火花芯 | 每幀 `drifting`（他車 `own.drift>0`） | spark 粒子（兩後輪外下緣、cone 35°、rate 20/40/55/70、size ×1/1/1.15/1.3）；芯沿用波 3 |
| 2 放開加速噴焰 | `boost` 上升沿；前 250ms 有甩尾段位＝段位色，否則 flame 三層 | 噴焰 plane×2＋circle 50/s，前 120ms scale 1.4 |
| 3 尾流風線 | 自己 `slipChargeMs>0`／`slipMs>0` | thin instance 2／6 條、alpha 0.35／0.7 |
| 4 速度線 | 自己 >0.9·MAX 或加速中 | UI 相機 plane，每 60ms 轉 0–10°；reduced-motion 上限 0.25、手機 0.35 |
| 5 路面外揚塵 | `|lateral|>路寬/2` 且速度>3 | smoke，每 0.4 單位 2 顆 |
| 6 胎痕 | 甩尾中或急煞（>8） | thin instance 池 160/80、2.5s、最後 0.6s 縮小 |
| 7 碰撞火花 | 兩車距 < 推擠距離+0.3、相對速度>4，自己參與的對（host 另播 bot 對 bot），同對 300ms | spark 10＋star 1 |
| 8 撿箱碎裂／重生彈出 | `itemGrant`（所有人）／`taken` 移除 | world 碎塊 8 片＋star 6＋白環 d1.8；backOut 300ms |
| 9 香蕉打滑 | `spin`＋`itemGone hit` | 打滑 2 圈＋頭頂 3 星；香蕉彈起轉 2 圈縮小 300ms |
| 10 龜殼拖尾＋命中爆炸 | 龜殼存活／`spin` ms>SPIN_MS | circle 45/s；star 2.0＋spark 18＋smoke 6、受擊車彈起 0.8 |
| 11 護盾泡泡／擋下／到期 | `shield` 旗標、`spin.blocked` | 泡泡 visibility／scale；circle 12 shieldFill＋小煙 |
| 12 跳台落地 | 騰空→著地 | visual 擠壓 220ms＋smoke 環 8＋白環 d2.6 |
| 13 重生 | ghost false→true（guest 的 bot 以比賽中瞬移判） | 落下 280ms＋visibility 方波 1500ms＋白環 d3＋star 4 |
| 14 換圈浮字 | 自己 `lap` 事件（LAP 2／LAP 3），完賽另出「完賽」 | 字卡 3.2×1.4 billboard 跟車 |
| 15 衝線彩帶 | 任何車 `fin` null→數值 | 拱門橫樑兩端 star 5 色（自己 60、他人 20）＋觀眾跳 2 下 |
| 16 鏡頭微震 | 自己被命中且非 blocked | 相機 target ±0.18、220ms；reduced-motion／手機關 |
| 17 加速帶閃光 | 自己 `pad` 事件 | 加速帶 emissive 1→1.8→1（共用材質，全部一起閃）＋spark 8 往前 |
| 18 加速菇彈出 | 使用 mushroom（自己本機；bot 與 guest 由 host 播） | 車頂 backOut 160ms、停 80ms、縮進 100ms |

## 測試
### 紅
新純函式模組先寫測試、模組不存在時跑：
`node_modules/.bin/vitest run src/babylon/games/raceFx/fxModel.test.ts src/babylon/games/raceFx/hudModel.test.ts src/babylon/games/raceFx/carPose.test.ts`
`Test Files  3 failed (3)`：`Error: Cannot find package '@/babylon/games/raceFx/fxModel'`、`Error: Cannot find package '@/babylon/games/raceFx/hudModel'`、`AssertionError: expected undefined to be 120`（`YAW_RELAX_MS` 未定義）
`node_modules/.bin/vitest run src/babylon/games/raceFx/models.test.ts`
`Tests  1 failed | 9 passed (10)`：`TypeError: mushroomData is not a function`
重現「假重生」：scratchpad `rw4.mjs`（5175 單人、960×540、頁內 `decideRaceBot` 開車）在 race.ts 暫掛 log（已移除），150s 跑出 fx.respawn 36 次；逐筆 log 全是 `{ id: 'bot-0', ghost: false, tp: true, d: 5 }`（host 的 bot、非 ghost 上升沿、瞬移門檻）
`node scratchpad/rw4.mjs scratchpad/w4c` → `{'id': 'bot-0', 'ghost': False, 'tp': True, 'd': 5, ...}` ×17（60s）
重現「胎痕看不到」：`rw4s.mjs`（強制 w＋d＋空白甩尾）讀 `__BATTLE_POS.fxLive.skids` = 160 但截圖車後路面沒有痕
`node scratchpad/rw4s.mjs scratchpad/sc3` → `drift3 {'skids': 160, ...}`，`skid-crop.png` 無痕
### 綠
`node_modules/.bin/vitest run src/babylon/games/raceFx/fxModel.test.ts src/babylon/games/raceFx/hudModel.test.ts src/babylon/games/raceFx/carPose.test.ts`
`Test Files  3 passed (3)`、`Tests  36 passed (36)`
`node_modules/.bin/vitest run src/babylon/games/raceFx/models.test.ts` → `Tests  10 passed (10)`
假重生修後同腳本暫掛 sim 端 `respawn` 事件計數（已移除）比對：150s `{'fx': 0, 'sim': 0}`；強制開出路面 `{'fx': 1, 'sim': 1}`、`{'fx': 2, 'sim': 2}`
胎痕修後 `node scratchpad/rw4s.mjs scratchpad/sc4` → `skid-crop2.png` 兩後輪各一串胎痕
送 DONE 前全套：`node_modules/.bin/eslint .` exit 0；`node_modules/.bin/tsc -b --noEmit` exit 0；`node_modules/.bin/vitest run` → `Test Files  94 passed (94)`、`Tests  984 passed (984)`

### 單人自查（`PORT=5175` dev、headless chromium＋swiftshader；已關）
- console：每輪只有大廳那條 `403`（波 2 起已知）；無 pageerror。
- 完整一局（960×540 頁內版面、3 bot）：倒數 → 3 圈 → 結算 overlay，HUD 文字 `LAP2/3 0:46.68 BEST 1:11.14 4th/4`、最後一圈大字有出；特效計數（`__BATTLE_POS.fx`）一局內 land 11、lapCard 2、confetti 3、boxBreak 17、pad 1、mushroom 3、shellBoom 2、bananaDie 4、clash 8（shieldBreak／shake 該局沒發生）。
- 強制情境（1280×720 全螢幕，`rw4s.mjs`）：甩尾 0→2→3 段（`sc4-drift*.png` 紫色火花芯＋胎痕）、放開 `boost 1100ms`（`sc-turbo.png` 雙噴焰＋circle）、開出路面 → 重生（`sc-off08.png` 車身半透明閃爍）；速度線在高速時畫面邊緣可見。
- draw calls：`?raceTier=desktop&raceNoDegrade=1&raceBench=1` 1920×1080 → 17、42、50、59、**63** 峰值後 56–63（≤100）；一般對局 960×540 37–68。正式 N0／N1 由 qa 量。
- 手機：`?raceTier=mobile` 844×390 → `tier mobile`、drawCalls 18–31、`degrade shadow`；`mob-countdown.png` 倒數用共用 theme 掛 UI 相機；`mob-b03.png` 藍色 mini-turbo 噴焰。
- bundle（`vite build --outDir scratchpad/dist`，gzip -9）：`Battle-*.js` **140590 B**（base 108534 → 任務累計 **+32056 B ≈ +31.3 KB**，上限 35；本波 +7.1 KB）；`vendor-babylon-*.js` 445326 B（與波 3 相同）。worktree `docs/` 未動。

## 自我審查
- 只動所有權內：`race.ts`、`raceFx/**`。`fx/**`、`babylonCore.ts`、`sfx.ts` 本波沒改；`git diff 7b47f48 -- src/core src/babylon/net src/babylon/hud.ts src/babylon/types.ts src/pages src/babylon/games/raceRules src/babylon/games/{tank,bomber,kitchen}Fx` 為空。只讀 import `tankFx/juice.squashPose`、`tankFx/fxModel.distanceSteps`（spec §6 允許）。
- 不新增圖檔、依賴；粒子重用 `fx_*.webp` 原路徑；新材質照波 3 公式（disableLighting：emissive＝顏色、diffuse 貼圖給形狀與 alpha）。
- 既有測試斷言沒改；carPose.test／models.test 只新增 describe。
- 倒數本來（波 3）就已改共用 `COUNTDOWN_THEME` 掛 `look.uiCamera`＋`UI_LAYER`，本波只拿掉文字 HUD 面板；任務沒有 3D 小地圖可拆（波 2 起就沒做）。
- 排除紀錄（除錯）：
  - 假重生：先懷疑 visual 每幀重建（wasGhost 重置）→ log 顯示同一 id、同一 visual 連續觸發，排除；log 每筆 `ghost:false, tp:true, d:5` → 根因是給 guest 端 bot 用的「比賽中瞬移＝重生」規則也套到 host 的 bot，且 5 單位門檻在 swiftshader 3–5fps 下一幀正常位移就超過。修法：只對沒有 ghost 旗標的車（`noGhost`）用瞬移判定，門檻改 `max(5, BOOST_SPEED·dt·1.5)`（輪胎轉動同受益）。
  - 火花看不到：暫時把火花放大到 0.8、壽命 2s（已還原）→ 確實從兩後輪噴出，排除發射位置／系統沒渲染；看不到是 swiftshader 一幀 200–300ms 而火花壽命 0.18–0.3s。
  - 胎痕看不到：`fxLive.skids=160` 證明有在出 → 自己寫的 `flatStrip` 索引 `0,2,1` 跟 world `flatQuad` 的 `0,1,2` 反向，法線朝下被背面剔除；另外 `distanceSteps` 預設單幀 >1.5 視為瞬移，低 fps 下也會讓胎痕／揚塵不出，改成隨幀長放寬，一幀多筆沿路徑內插。

## 疑慮
1. **swiftshader 下短壽命粒子很難拍到**（火花 0.18–0.3s、碰撞 0.16s、噴焰 circle 0.14s，一幀 200–300ms）。qa 連拍 AC18 特效表建議用 960×540 或更小視窗提高 fps，並以 `__BATTLE_POS.fx`（累計觸發數）與 `fxLive`（skids／flames／rings／particles 當下數量）佐證。
2. **加速帶閃光**（#17）：所有加速帶共用一個材質，壓到其中一條時全部一起閃（spark 只在壓到的那條噴）。要只閃單條得拆成每條一個 mesh（+N draw calls），先不做。
3. **他車加速菇彈出**只有 host 看得到（guest 的使用請求只送 host、沒有廣播訊息）；他車的噴焰經 `own.boost` 所有人都看得到。要全員看到需新增訊息，屬協定變更，未做。
4. 護盾到期前 2 秒閃爍只有自己與 host 的 bot（只有它們知道剩餘時間）；他車只看得到開／關。
5. 火花尺寸照 spec 0.18 起跳，ADD 混色在深紫路面上偏暗（尤其 3 段紫）；若 qa 覺得太不明顯，調 `sparkStyle` 一個係數即可。
6. bundle 只剩約 3.7 KB 餘裕（AC15 35 KB）。

## 修復（review 波 4 I1＋Minor 6／8／12）
**根因（I1）**：衝線彩帶偵測 `was === null && fin !== null` 沒擋 phase；`resetRace` 清空 `fxFin` 後，他車 ownership 快照仍是上一局的 `fin`（`latestRemote` 只在 `stop()` 清），重開局第一幀就把「沒紀錄＝null」當成剛過線。
- 修法：抽成純函式 `fxModel.finishEdges(prev, cars, live)`：每幀都記下各車 fin，只有 `live`（phase＝playing）且上一筆**明確**是 null 才觸發。倒數期間記下舊值，進比賽後舊值還在也不觸發；`race.ts` 改呼叫它。
- Minor 6：`RaceFx.respawn()` 清掉打滑（`spinAt = -Infinity`），落下後不再轉、頭頂星下一幀收掉。
- Minor 8：flame 三色預建 `FLAME_C`，噴焰每幀改 `emissiveColor.copyFrom`；段位色在加速開始時算一次存在 CarState。
- Minor 12：**誤判，不改行為**。`seen.clash` 會經 `this.seen[d.reason]++`／`this.seen[ev.reason]++` 在 itemGone reason＝`'clash'`（香蕉被龜殼撞掉，`raceField.ts:94`）時遞增；車對車碰撞火花計數在 `fxSeen.clash`。在 `seen` 欄位註解寫清兩者差別。
### 紅
`node_modules/.bin/vitest run src/babylon/games/raceFx/fxModel.test.ts`（先加 3 條 `finishEdges` 測試：倒數讀到舊 fin、進比賽舊值仍在、正常 null→數值）
`Failed Tests 3`：`TypeError: finishEdges is not a function`
### 綠
`node_modules/.bin/vitest run src/babylon/games/raceFx/fxModel.test.ts` → `Tests  24 passed (24)`
全套：`eslint .` exit 0；`tsc -b --noEmit` exit 0；`vitest run` → `Test Files  94 passed (94)`、`Tests  987 passed (987)`
冒煙：5175 單人 `rw4s.mjs`（甩尾／加速／出界重生）console 只有大廳 403、無 pageerror；5175 已關。多人重開局（I1 原情境）未用 `--contexts 2` 重現，由單測覆蓋時序，請 qa 多人「再開一局」時看 `__BATTLE_POS.fx.confetti` 不在倒數／開局跳。

## 修復（qa BUG：甩尾火花紫段／橘段太暗）
**根因**：火花用 ADD 混色、出生色＝結束色＝飽和段位色（紫 #C05CFF、橘 #FF9A1F），尺寸照 spec 0.18–0.24；而 `fx_spark.webp` 只有約 11% 面積不透明（128² 中 alpha>0.5 的像素 0.112），實際可見芯只有約 0.02–0.03 單位，加在深紫路面上幾乎沒有亮度差。swiftshader 一幀 200–300ms、`emitCount` 單幀最多算 100ms，又讓同時在場的顆數更少。
- 修法（`fxModel`／`effects.sparkStyle`）：出生色改 `sparkHot`（段位色往白拉 55%，色相＝最大通道不變）→ 段位色 → 透明；基準尺寸 `SPARK_SIZE = 0.5`（段位倍率 ×1／×1.15／×1.3 照舊）；壽命 0.2–0.32s、初速 2–3.5（留在輪邊）。偏離 spec §8 #1 的 0.18，依 ruling「qa 判太暗再調 sparkStyle 係數」。
### 紅
`node_modules/.bin/vitest run src/babylon/games/raceFx/fxModel.test.ts`（先加 2 條：亮芯比段位色亮且色相不變、基準尺寸 ≥ 0.45）
`Failed Tests 2`：`TypeError: sparkHot is not a function`、`SPARK_SIZE` undefined
畫面重現：`node /tmp/claude-1000/-home-bal-project-collect--worktrees-raceart/7ffc002c-6b44-48b7-b856-e5aba69b0044/scratchpad/rw4s.mjs /tmp/claude-1000/-home-bal-project-collect--worktrees-raceart/7ffc002c-6b44-48b7-b856-e5aba69b0044/scratchpad/sc4`（960×540→1280×720 全螢幕強制甩尾到 3 段）→ `skid-crop2.png` 輪邊只有火花芯、看不到粒子
### 綠
`node_modules/.bin/vitest run src/babylon/games/raceFx/fxModel.test.ts` → `Tests  26 passed (26)`
畫面：`node /tmp/claude-1000/-home-bal-project-collect--worktrees-raceart/7ffc002c-6b44-48b7-b856-e5aba69b0044/scratchpad/rw4s.mjs /tmp/claude-1000/-home-bal-project-collect--worktrees-raceart/7ffc002c-6b44-48b7-b856-e5aba69b0044/scratchpad/sp2 'raceTier=desktop&raceNoDegrade=1' 960 540` → `/tmp/claude-1000/-home-bal-project-collect--worktrees-raceart/7ffc002c-6b44-48b7-b856-e5aba69b0044/scratchpad/spark-after2.png`（甩尾 2→3 段連拍放大）兩後輪外側有白芯紫尾的火花束；中間嘗試 0.32 仍偏小（`spark-after.png`），才查到貼圖覆蓋率
全套：`eslint .` exit 0；`tsc -b --noEmit` exit 0；`vitest run` → `Test Files  94 passed (94)`、`Tests  989 passed (989)`；console 只有大廳 403；5175 已關。
### 排除
- 不是發射位置或系統沒渲染：前面放大到 0.8／壽命 2s 的除錯畫面火花確實從兩後輪噴出。
- 不是材質公式：粒子不走 StandardMaterial（波 3 的 disableLighting 問題不適用）。
### 疑慮
- 左後輪的火花常被車身擋住一半（追尾角度），右彎甩尾時同理在右側；真機 60fps 每幀 1–2 顆、同時在場約 15–20 顆，會比 swiftshader 截圖密。
- 橘段（2 段）這次連拍只拍到過渡瞬間，請 qa 以新 build 再判。
