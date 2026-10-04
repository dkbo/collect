# 賽車美術＋可玩度（A Toy Racer） — 給 babylon-rules 的切片（波 5）
由 dk-wave-open 產生，只讀。完整 brief 在 /home/bal/project/collect/.dkbo/tasks/2026-10-03-raceart/brief.md。

## 目標
把 `/battle` 的極速賽車（`src/babylon/games/race.ts`）做成市售多人賽車的玩法與手感：新的多彎閉合賽道、甩尾蓄力加速、4 種道具、尾流、落後補償、AI 對手、出界重生、全員衝線結算；美術與炸彈超人／廚房／坦克同系列「A Toy Racer 玩具賽車」，HUD 走 React，手機有四顆動作鈕。
設計依據：波 1 designer 產出的 `$DK_ROOT/tasks/2026-10-03-raceart/design/spec.md` 與 `variant-A-*.webp`（只出 A 一套）；brief 與 spec 衝突時以 brief 為準。計時賽、幽靈車、多賽道選擇不做；坦克、炸彈超人、廚房零回歸。

## 全域約束（全文）
- 路徑一律用 `@/*` 別名，不得用相對路徑引入。
- 自訂 CSS class 一律用 `@apply` 套 Tailwind；`src/index.css` 只准新增 `.race-*` 前綴的 class，不得修改既有 class。
- 圖片只收 WebP，不得把 JPG／PNG 寫進 `src/`、`public/`；本任務不新增圖檔到 `src/`、`public/`，貼圖一律程式產生，粒子重用 `public/battle/bomber/fx_*.webp` 原路徑；designer 的 webp 稿只放任務目錄 `design/`。
- 非同步請求與資料處理寫在 Zustand store action，元件只訂閱與調用。
- 不新增任何依賴：`package.json`、`pnpm-lock.yaml` 不改。
- Babylon 一律經 `src/babylon/babylonCore.ts` 深層匯入，不用 `.pure` 版本；需要新副作用 import 才補在那裡。
- 不動共用網路層：`src/core/**`、`src/babylon/net/**`、`src/babylon/hud.ts` 只讀；賽車維持分散式所有權（每人本機模擬自己的車、`createOwnershipSync` 廣播），新訊息一律先驗型別與範圍（`isObj`／`isNumIn`／`isOneOf`…，驗不過即丟棄、不 throw），道具、命中、bot、結算只信任房主廣播。
- 純邏輯一律寫成純函式（`src/babylon/games/raceRules/**`、`raceFx/**`，HUD 格式化寫在 `src/pages/Battle/raceHud.ts`），各附同目錄 `*.test.ts`，先寫紅測再實作；既有 `*.test.ts` 的斷言不得修改。
- `fx/` 共用模組只准新增可選參數／新匯出，炸彈超人、廚房、坦克呼叫端行為不變；賽車呼叫 `fx/quality`／`look`／`perfLog` 一律明傳 `key`／`tag: 'race'`。
- 字型：數字用站內 Fredoka（`public/fonts/Fredoka-Bold.woff2`），中文用站內字型，不新增字型檔。
- 相機：可改成追尾相機並依 spec 調整距離與俯角（賽車需要），但不得改其他遊戲的相機。

## 你的波次
| 波 | 型態 | 成員 | 做什麼 | 難度 | 完成條件 | 審查 |
|---|---|---|---|---|---|---|
| 5 | 實作 | babylon-rules | 整枝評議 Minor 修復（純函式，各補紅綠單測）：尾流只在前車與自己朝向夾角 ≤90° 時累積（`drive.ts:169`）；`stepCar` 的 `ry` 環繞到 (−π, π]（`drive.ts:135`）；`normalizeProgress` 長距離倒車過起點不再夾成 CP1、名次不偏高（`track.ts:182`）；`findLongCurves` 跨起點 span 改用 `inSpan` 比較（`raceAI.ts:216`）；簽名不變 | M | 四條各有紅綠單測、全閘綠 | 預設 |

## 倉庫
/home/bal/project/collect/.worktrees/raceart
編輯一律用上面的 worktree 路徑；$DK_ROOT 指向主樹的 .dkbo/，只拿來跑 dk-msg 等 bin，不得當編輯路徑

## 你的檔案所有權
| 成員 | 可改 | 只讀 |
|---|---|---|
| babylon-rules | src/babylon/games/raceRules/** | src/babylon/games/race.ts, src/babylon/games/bomberFx/**, src/babylon/games/tankFx/**, src/babylon/net/** |

## 共用契約（全文）
| 契約 | 擁有者 | 消費者 | 形狀／簽名 | 變更流程 |
|---|---|---|---|---|
| raceRules 純函式 API | babylon-rules@波1 | babylon@波2 | `@/babylon/games/raceRules/track`：`makeTrack(ctrl: [number, number][], width: number): Track`、`trackProgress(t: Track, x: number, z: number): { s: number; lateral: number; seg: number }`、`Track = { pts: [number, number][]; len: number; width: number; checkpoints: number[] }`、`advanceLap(prev: LapState, cp: number): LapState`、`rankCars(list: { id: string; lap: number; s: number; finishedAt: number \| null }[]): string[]`；`drive`：`stepDrift(d: DriftState, input: { drifting: boolean; steer: number; speed: number }, dt: number): { state: DriftState; turboMs: number }`、`slipCharge(...)`、`shouldRespawn(...)`；`items`：`rollItem(rank: number, total: number, r: number): ItemKind`、`shellTarget(...)`、`hitTest(...)`；`raceAI`：`decideRaceBot(input): { throttle: number; steer: number; drift: boolean; useItem: boolean }`；`ItemKind = 'banana' \| 'shell' \| 'mushroom' \| 'shield'`。簽名以 babylon-rules 波 1 落地為準，babylon 只 import 不改 | 改簽名先 ESCALATE 給領導 |
| RaceHud 通道 | babylon-hud@波2 | babylon@波4 | `RaceHud = { kind: 'race'; rank: number; total: number; lap: number; laps: number; lapMs: number; bestLapMs: number \| null; item: ItemKind \| null; rolling: boolean; wrongWay: boolean; finalLap: boolean; finished: boolean; map: { pts: [number, number][]; cars: { id: string; colorIndex: 0\|1\|2\|3; x: number; z: number; isSelf: boolean }[] }; results: { id: string; name: string; colorIndex: 0\|1\|2\|3; rank: number; totalMs: number \| null; bestLapMs: number \| null }[] }`；`setHud` 聯集加入 `RaceHud`；`map.pts` 開局傳一次後不變（React 以參照比對不重繪）、車點座標量化到 0.1；時間量化到 10ms；`lap` 為目前第幾圈、範圍 1..laps，由 babylon 以 `min(own.lap+1, LAPS)` 算好送出，HUD 直接顯示不再換算（spec「0 顯示 1」作廢）；欄位只增不改 | 改形狀先 ESCALATE 給領導 |
| A Toy Racer spec | designer@波1 | babylon@波2, babylon@波3, babylon-hud@波2, babylon-rules@波1 | `design/spec.md` 章節：賽道控制點表與路寬、檢查點／道具箱／加速帶／跳台位置、落後補償機率表、AI 失誤參數、色票、物件建模表、材質／描邊／Glow 名單、追尾相機、特效表、HUD 版面三檔；`variant-A-*.webp` | 波 2 起有疑義用 QUESTION 問領導，領導裁定後記 ruling |

## 驗收標準（全文）
- [ ] AC1 方向稿：designer 產出 `design/spec.md`、`design/variant-A.pen`、`design/variant-A-gameplay.webp`（1920×1080 追尾視角對局畫面，含 4 台車、甩尾火花、道具）、`design/variant-A-track.webp`（賽道俯視全圖：中心線、寬度、起跑線、檢查點、道具箱列、加速帶、跳台位置）、`design/variant-A-sheet.webp`（4 色車三視、駕駛小人、4 種道具與道具箱、路緣／拱門／看台／裝飾、特效關鍵幀、HUD 元件）；spec 須含：賽道中心線控制點座標表（閉合、不自交——不做 8 字立體交叉，省掉橋上下的 y 判定）與路寬，形狀至少含 1 個 ≥120° 大彎、1 組左右連續 S 彎、1 段跳台、1 段可甩尾的長彎（以曲率門檻定義「長彎」，供 AC5 bot 判斷），並寫總長與單圈目標 35–50 秒；色票（沿用 `@/babylon/fx/palette` 的 `PLAYER_PALETTE`）、每個 3D 物件的程式建模尺寸與組成、材質／描邊／Glow 名單、追尾相機參數、特效表（觸發、持續、粒子／mesh、上限）、HUD 版面三檔（1920×1080、960×540、手機 844×390，含 `max-height: 500px` 精簡）與 `.race-*` 命名；HUD token 與 `BomberHud`／`TankHud` 同套。
- [ ] AC2 賽道與名次（純函式 `raceRules/track.ts`）：賽道以閉合中心線（Catmull-Rom 取樣成折線）＋路寬定義；`trackProgress(track, x, z)` 回傳 `{ s, lateral, seg }`（沿線距離、離中心線的有號距離、所在段）；圈數以依序通過 `CHECKPOINTS = 8` 個檢查點計，跳過檢查點（抄捷徑）不算圈；逆向行駛 `WRONG_WAY_MS = 1500` 以上判定逆向；名次以「圈數＋沿線距離」排序，所有 client 名次一致（同一份 `own` 快照算同結果）；單測涵蓋：直線段與彎段的 progress、跨起點換圈、跳檢查點不算圈、倒車回到上一圈不加圈、逆向判定、名次排序：已過線依 `finishedAt` 升冪，未過線依 lap 降冪、s 降冪，仍同分依 `id` 字典序（單測斷言輸入順序打亂結果不變）。舊的 `quadrantOf`／`stepQuarters` 計圈移除（`@/babylon/math` 檔本身不改）。
- [ ] AC3 手感（純函式 `raceRules/drive.ts`，race.ts 套用）：既有加速／煞車／阻力常數保留為基準；路面外（`|lateral| > 路寬/2`）降速沿用 `OFFTRACK_FACTOR`；甩尾蓄力：按住甩尾鍵且轉向中、速度 > `DRIFT_MIN_SPEED = 6` 時累積，`DRIFT_TIERS = [0.6, 1.2, 2.0]` 秒對應藍／橘／紫，放開給 `MINI_TURBO_MS = [500, 900, 1300]` 的加速（上限 `BOOST_SPEED`）；尾流：在另一台車後方 `SLIP_DIST = 6`、夾角 ≤ `SLIP_CONE_DEG = 25`（原 15，波 2 qa 實測鍵盤轉向難觸發後放寬） 內持續 `SLIP_CHARGE_MS = 1200` 即獲 `SLIP_BOOST_MS = 1000`、速度上限 ×1.15；車對車推擠改成每台車各自在本機把自己推開（修掉現況只有 host 被推），bot 由 host 推；出界或卡住（速度 < 1 且持續 `STUCK_MS = 2000`，或離開賽道超過 `OFFTRACK_RESPAWN_MS = 3000`）自動放回最後通過的檢查點中心、朝向沿線、`RESPAWN_GHOST_MS = 1500` 內閃爍且不被道具命中；跳台一段（spec 指定位置）讓車有騰空弧線（只影響 y 與視覺，x/z 照常）；加速帶保留但改為賽道上固定位置（spec 指定），不再隨機。單測涵蓋：蓄力三段門檻與放開給的加速、未轉向不蓄力、尾流條件內外、重生觸發與放回位置。
- [ ] AC4 道具（純函式 `raceRules/items.ts`，host 裁決）：賽道上 `ITEM_ROWS` 列道具箱（位置由 spec 指定，每列 4 個），被撿走後 `ITEM_RESPAWN_MS = 3000` 重生；手上最多 1 個；4 種：`banana`（丟在車後，碰到者打滑 `SPIN_MS = 800`，香蕉消失）、`shell`（紅龜殼：沿賽道追蹤名次在自己前一名的車，`SHELL_LIFE_MS = 6000`，命中打滑 `SPIN_MS × 1.5`；自己第一名時直線前射）、`mushroom`（立即加速 `MINI_TURBO_MS[1]`）、`shield`（`SHIELD_MS = 8000` 內擋下一次命中）；落後補償：依名次查表抽道具，第 1 名只會抽到 `banana`／`shield`（表寫在 spec，單測斷言：第 1 名 P(mushroom∪shell) = 0、最後一名 P(mushroom∪shell) ≥ 0.6、P(mushroom∪shell) 隨名次 1..total 非遞減）；不改任何車速數值。同步：guest 撞到道具箱送 `itemReq`（箱 id），host 先到先得後廣播 `itemGrant`；使用送 `useItem`，host 生成香蕉／龜殼並廣播 `itemSpawn`；命中由 host 以最近收到的位置判定並廣播 `spin`（`{ target, ms }`），受擊者本機套用；`shield` 擋下也廣播（`spin` 帶 `blocked: true`）。單測涵蓋：先到先得、手上已有不再給、龜殼目標選擇（前一名、第一名直射）、命中判定與護盾擋下、香蕉碰撞、落後補償機率。
- [ ] AC5 AI 對手（純函式 `raceRules/raceAI.ts`）：host 依真人數補滿 4 台（`bot-0..`、名字「電腦N」，比照坦克），名冊隨開局訊息的可選欄位廣播，位置以新訊息 `botState`（20Hz）廣播、guest 插值；AI 沿中心線前瞻 `AI_LOOKAHEAD = 8` 單位取目標點轉向、彎道前減速、會甩尾蓄力（只在 spec 定義的長彎）、撿道具並使用（香蕉在後方有車時丟、龜殼在前方有目標時射、加速菇在直線用）、偶爾失誤（`AI_ERR` 由 spec 定）；bot 同受道具、推擠、重生規則。單測涵蓋：直線全速、彎前減速、道具使用條件、bot 開出路面後 3 秒內回到路面或觸發重生。
- [ ] AC6 結算：第一台過終點後不立即結束，`FINISH_GRACE_MS = 15000` 內其他車可繼續衝線（含 bot），全員過線（斷線玩家不計）或時間到才 `endGame`；host 以收到各車 `own.fin` 由 null 變成數值的先後定過線順序，總時間取該車上報的 `fin`（host 驗範圍 0–600000），未過線者依當下名次；結算列出每人名次、總時間、最佳圈；所有 client 名次一致。
- [ ] AC6b 訊息表（race.ts 兩端都是 babylon，寫在 AC 不另立契約；qa 的 AC17 依此判定）：
  - `own` 狀態（各車本機擁有，20Hz）由 `{x,z,ry,q}` 改為 `{ x, z, ry, lap, cp, s, fin, ghost, drift, boost, spin, shield }`：`lap` 0..LAPS、`cp` 0..CHECKPOINTS−1、`s` 0..track.len、`fin` 過線時本機計的總時間 ms 或 null、`ghost`／`boost`／`spin`／`shield` 為 boolean、`drift` 0–3（段位，給他車看火花）；各端讀他車快照前先驗範圍，驗不過即忽略那一筆。
  - 道具（全部 host → 全體，除註明者）：`itemReq { box }`（guest → host）、`itemGrant { box, who, kind }`、`useItem { kind }`（guest → host）、`itemSpawn { id, kind, owner, x, z, vx, vz, target }`、`itemState { list: { id, x, z }[] }`（10Hz，只在場上有龜殼時送；香蕉靜止不送）、`itemGone { id, reason }`、`spin { target, ms, blocked }`、`boxState { taken: number[] }`（有變動時送）。
  - bot：開局訊息可選欄位 `bots`（名冊）、`botState { states: { id, x, z, ry, lap, cp, s, fin, drift, spin }[] }`（20Hz）。
  - host 判命中時以最近收到的 `own` 快照為準（`ghost`／`shield` 由快照得知），guest 不自判命中。
- [ ] AC7 固定 4 色：移除 `colorFor` hash；`colorIndex` 依「`ctx.players` 依序＋bots 依序」的序號（優先只讀 import `bomberFx/palette` 的 `colorIndexOf` 或 `raceRules/` 薄包一層附單測）；同一台車在每個 client 顏色一致。
- [ ] AC8 手機操作：`BabylonCanvas.tsx` 的 `TOUCH_ACTIONS.race` 加油門（`w`）、煞車（`s`）、甩尾（` `）、道具（`e`）四鈕，搖桿只負責轉向：`TouchControls` 新增可選 prop（如 `axes: 'x'`）只派發左右鍵，race 傳入、其他遊戲預設不變（babylon-hud 做）；race.ts 讀鍵規則照舊，`e` 為新的道具鍵，桌機同鍵；其他遊戲的觸控鈕不變。
- [ ] AC9 車輛與場景（照 spec）：程式建模 Q 版玩具車（圓胖車身、4 輪會轉、前輪隨轉向擺動、駕駛小人戴安全帽、尾翼、玩家色）並合併 mesh；自己頭上「你」標記（不得遮住車身）；賽道路面＋紅白路緣、起跑線＋拱門、檢查點不可見、看台與旗子、場邊積木裝飾（thin instance）、桌墊地面程式貼圖、跳台、固定加速帶、道具箱（浮動旋轉、問號圖示）；香蕉、龜殼、護盾泡泡 mesh；追尾相機平滑跟隨（速度越快 fov 微增）。
- [ ] AC10 材質光影：`fx/look` 以 `tag: 'race'` 套兩階 ramp；描邊只描車、道具與道具箱；雙光、ShadowGenerator（桌機 1024 PCF、手機 512 或 blob，只讓車與道具投影）、GlowLayer `includeOnly` 限定加速帶、道具箱、甩尾火花、龜殼；Pipeline（FXAA、ACES、桌機 bloom）；桌機 `hardwareScalingLevel = 1 / min(devicePixelRatio, 2)`。
- [ ] AC11 特效（spec 特效表每一列）：至少含甩尾火花三段色、放開加速噴焰、尾流風線、速度線（高速時畫面邊緣）、路面外揚塵、輪胎痕、碰撞火花、撿道具箱碎裂（3D；道具欄轉盤屬 AC12 React）、香蕉打滑轉圈、龜殼拖尾與命中爆炸、護盾泡泡與擋下碎裂、跳台落地彈跳、重生閃爍、換圈 3D 浮字（最後一圈大字提示屬 AC12 React）、衝線彩帶、自己被命中時鏡頭微震（`prefers-reduced-motion` 或手機檔關閉）；粒子用 `fx_*.webp`，每組上限 150（手機 60）；浮字共用 DynamicTexture。
- [ ] AC12 HUD（React）：`src/babylon/types.ts` 新增 `RaceHud`（`kind: 'race'`，形狀見共用契約），`setHud` 聯集加入，既有 `GameHud`／`KitchenHud`／`TankHud` 欄位一個不改；`BabylonCanvas` 依 `kind` 分流，race 渲染根節點 `[data-race-hud]`：名次大字（1st／2nd…）、圈數 `LAP 2/3`、本圈時間與最佳圈、道具欄（撿到時轉盤動畫）、小地圖（賽道輪廓＋4 色點，自己較大）、逆向警告、最後一圈提示、衝線後名次表；手機 `max-height: 500px` 精簡。race 改用 `setHud`，移除 3D `createTextPanel` HUD 與小地圖；開局倒數改用 `fx/` 共用 theme 並掛 `look.uiCamera`＋`UI_LAYER`；結算沿用 `setOverlay`。其他三款 HUD 行為不變。
- [ ] AC13 檔位與降級：開局 `console.info('[race] tier desktop|mobile')`；判定與其他三款同；`?raceTier=desktop|mobile`、`?raceNoDegrade=1`（含 hash 內 query）；mobile 關描邊、Glow、bloom，陰影 512 或 blob，粒子上限 60，`hardwareScalingLevel` 固定 1.5；連續 60 幀平均 < 45fps 依序降描邊 → Glow → 陰影並 `console.info('[race] degrade <outline|glow|shadow>')`。
- [ ] AC14 效能：每 2 秒 `console.info('[race] drawCalls=<N> fps=<N>')`（跳過第一次的 0／Infinity）；`?raceTier=desktop&raceNoDegrade=1` 單人（3 bot）開局倒數結束後 5 秒量 N0（取 3 次最大值），（N0 只記錄），另以只在 `raceNoDegrade=1` 下生效的 `?raceBench=1`（每台車各持一種道具並同時有香蕉 4 根、龜殼 2 顆在場）量 N1，判定 `N1 ≤ 100`；fps 只記錄。
- [ ] AC15 bundle：`node_modules/.bin/vite build --outDir <scratchpad>/dist --emptyOutDir` 成功（不跑 `pnpm build`，worktree 的 `docs/` 不變）；base 產物由 qa 以 `git archive <任務 base>` 建置；`vendor-babylon-*.js` gzip 增量 ≤ 10 KB、`Battle-*.js`（含新拆出的遊戲相關 chunk 合計）gzip 增量 ≤ 35 KB，report 附改前改後數字。
- [ ] AC16 零回歸：`DK_TEST_CMD` 全綠；`git diff <任務 base> -- src/core src/babylon/net src/babylon/hud.ts` 為空；`bomberFx/`、`kitchenFx/`、`tankFx/`、`bomber*.ts`、`overcooked*.ts`、`tank*.ts` 的 diff 為空；qa 以 production preview 跑賽車完整一局（甩尾三段、4 種道具、尾流、跳台、出界重生、逆向警告、bot、全員衝線結算、再開一局）console 無錯；bomber、kitchen、tank 單人一局與主樹 `docs/` 基準同參數 1920×1080 截「開局倒數第一幀」並排，HUD 與場景靜態物件無差異。
- [ ] AC17 多人：qa 以 `--contexts 2` 驗兩端顏色一致、名次與圈數一致（20Hz 有延遲，以靜止 1 秒後或結算畫面判定）、道具箱先到先得、香蕉／龜殼位置與命中一致、bot 位置同步、結算名次一致；Firestore 不可用時標「待驗：<錯誤>」並明列於 report，不得改連其他 DB。
- [ ] AC18 qa 驗收截圖：`?raceTier=desktop&raceNoDegrade=1` 截 1920×1080、960×540，`?raceTier=mobile` 截 844×390（含四顆觸控鈕），每張標註對應 AC 與比對的 `variant-A-*`；spec 特效表每列至少一組連拍；`?raceTier=desktop`（不帶 NoDegrade）驗自動降級；draw calls、fps、bundle 數字寫進 report。

## 同波成員
babylon-rules(M) babylon(M)
