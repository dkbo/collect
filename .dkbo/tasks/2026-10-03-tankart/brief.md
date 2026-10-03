# 坦克美術＋可玩度（A Toy Army）
來源：.claude/plans/2026-10-03-tankart.md   需求原文：request.md
分支：dk/tankart   worktree：（/dkbo-run 交棒時建立）

## 目標（≤3 行）
把 `/battle` 的坦克（`src/babylon/games/tank.ts`）做成與炸彈超人 A Toy Box、廚房快手 A Toy Kitchen 同系列的「A Toy Army 玩具坦克」：固定 4 色 Q 版玩具坦克、積木場景、卡通材質＋描邊＋陰影＋Glow＋後製、開砲／命中／爆炸特效與糖果式 juice、React HUD；並加五項玩法（子彈反彈、受擊無敵＋擊退、護盾／三連發、縮圈突然死亡、AI bot）與手機砲塔鍵。
設計依據：波 1 designer 產出的 `$DK_ROOT/tasks/2026-10-03-tankart/design/spec.md` 與 `variant-A-*.webp`（只出 A 一套，同系列語彙已定）；brief 與 spec 衝突時以 brief 為準。best-of-3 不做、彈跳彈道具不做；炸彈超人、廚房、賽車零回歸。

## 全域約束
- 路徑一律用 `@/*` 別名，不得用相對路徑引入（既有 `./tankNet` 這類同目錄引入改成 `@/` 亦可，不強制）。
- 自訂 CSS class 一律用 `@apply` 套 Tailwind；`src/index.css` 只准新增 `.tank-*` 前綴的 class，不得修改既有 class（含 `.bomber-*`、`.kitchen-*`）。
- 圖片只收 WebP，不得把 JPG／PNG 寫進 `src/`、`public/`；本任務不新增任何圖檔到 `src/`、`public/`，貼圖一律程式產生（DynamicTexture／頂點色），粒子重用 `public/battle/bomber/fx_*.webp` 原路徑（不搬、不改檔）；designer 的 webp 稿只放任務目錄 `design/`。
- 非同步請求與資料處理寫在 Zustand store action，元件只訂閱與調用。
- 不新增任何依賴：`package.json`、`pnpm-lock.yaml` 不改。
- Babylon 一律經 `src/babylon/babylonCore.ts` 深層匯入（eslint 已禁整包匯入），不用 `.pure` 版本；需要新副作用 import 才補在那裡。
- 不動共用網路層：`src/core/**`、`src/babylon/net/**`、`src/babylon/hud.ts` 只讀；坦克自己的訊息型別（`seed`／`bullet`／`hit`／`destroyed`／`item`／`pickup`／`shootReq`／`restartReq`）只准**新增**型別或在既有 payload **新增可選欄位**，不得刪改既有欄位；所有新收訊息照既有慣例先驗型別與範圍再用（`isObj`／`isNumIn`／`isOneOf`…，驗不過即丟棄、不 throw），且只信任房主廣播。
- 既有 `*.test.ts` 的斷言不得修改（`tankNet.test.ts` 全保持綠）；新純函式寫在 `src/babylon/games/tankFx/`，各附同目錄 `*.test.ts`，先寫紅測再實作。
- 既有數值不變：`SIM_HZ`、`CELL`、`GRID_W`／`GRID_H`、`MOVE_SPEED`、`TURRET_SPEED`、`BULLET_SPEED`、`BULLET_LIFETIME_MS`、`FIRE_COOLDOWN_MS`、`INIT_HP`、`CRATE_DROP_CHANCE`、既有三種道具效果；新數值一律用本 brief AC2 的具名常數。相機 α、β、fov 不調；半徑改 `38`、target 改 `(0, 0, -2)`（波 1 babylon 改，designer 實測現值 r28 時近側 2.5 排含 P1／P4 出生角在畫面外），其餘不調。
- 字型：數字用站內 Fredoka（`public/fonts/Fredoka-Bold.woff2`），中文用站內字型，不新增字型檔。
- `fx/` 共用模組只准**新增可選參數／新匯出**，bomber 與 kitchen 的呼叫端行為不變；坦克呼叫 `fx/quality`／`look`／`perfLog` 一律明傳 `key`／`tag: 'tank'`。

## 驗收標準
- [ ] AC1 方向稿：designer 產出 `design/spec.md`、`design/variant-A.pen`、`design/variant-A-gameplay.webp`（1920×1080 對局畫面）、`design/variant-A-sheet.webp`（4 色坦克三視、積木牆、木箱、5 種道具、子彈、特效關鍵幀、HUD 元件）；spec 須含：色票（沿用 `@/babylon/fx/palette` 的 `PLAYER_PALETTE`，不另定玩家色）、每個 3D 物件的程式建模尺寸與組成、材質與描邊名單、Glow 白名單、§特效表（每列：觸發、持續、粒子／mesh、上限）、HUD 版面（桌機 1920×1080、960×540、手機 844×390 三檔，含 `max-height: 500px` 精簡規則）、對應 Tailwind v4 class 與 `.tank-*` 命名；HUD token 與 `BomberHud`／`KitchenHud` 同套。
- [ ] AC2 玩法規則（純函式在 `src/babylon/games/tankFx/`，host 權威，各附單測）：
  - 反彈：子彈撞不可破牆（含外圈與突然死亡落下的牆）以撞擊面法線反射，`BULLET_MAX_BOUNCE = 1`，第二次撞牆消失；撞木箱照舊打掉木箱且子彈消失、不反彈；反彈後的子彈**可命中發射者**；`BULLET_LIFETIME_MS` 不因反彈重置。單測涵蓋：撞水平面、垂直面、角落（兩軸同時）、第二次撞牆消失、撞木箱不反彈。host 判定後廣播新訊息 `bounce`（`{ bulletId, x, z, vx, vz }`），guest 以同一支純函式先行預測、收到 `bounce` 時校正；單測固定「guest 預測與 host 用同一函式、同輸入得同一反彈點」，qa 以 `--contexts 2` 目視兩端反彈點一致。
  - 受擊無敵＋擊退：被命中後 `INVULN_MS = 1000` 內 host 不再扣血（子彈照樣消失）；受擊者沿子彈方向被推 `KNOCKBACK = 0.6`（世界單位，以碰撞判定截斷、不得推進牆或木箱；無敵期間被命中不擊退），真人坦克由受擊者本機在收到 `hit` 時套用、bot 由 host 套用並經 `botState` 同步；`hit` 新增可選欄位 `dirX`／`dirZ`（擊退方向單位向量）與 `shieldBroken: boolean`；無敵期間坦克閃爍。各端 buff／護盾到期時刻由 `pickup`（host 已知 `kind`）的收到時刻自算。
  - 新道具：`ITEM_KINDS` 擴成 `hp`／`speed`／`rapid`／`shield`／`triple`，五種等機率；`shield` 抵擋下一發命中（不扣血、仍觸發無敵與擊退），被打破或 `SHIELD_MS = 12000` 到期即消失；`triple` 為 `TRIPLE_MS = 8000` 內每次開火射三發（中央＋左右 `TRIPLE_SPREAD_DEG = 12`），冷卻不變，guest 仍只送一則 `shootReq`、側翼兩發由 host 依其 buff 生成並各自 `bullet` 廣播；`validateShootReq` 判定規則不變。
  - 縮圈突然死亡：進 `playing` 滿 `SUDDEN_DEATH_MS = 60000` 後每 `CLOSE_INTERVAL_MS = 700` 由外圈螺旋往內落一格牆（host 廣播新訊息 `close`，`{ cx, cy }`），落牆前 `CLOSE_WARN_MS = 400` 地上紅色預告；壓毀由 host 判定：以 host 最近收到的坦克中心（bot 用 host 模擬位置）所在格等於落牆格即毀損，廣播既有 `destroyed`（`killerId: null`）；guest 不自行判毀損，只播落牆動畫；單測涵蓋「中心在格內＝壓毀、中心在相鄰格＝不壓毀」；該格的木箱、道具、子彈一併移除；可重用 `bomberFx/suddenDeath.ts` 的純函式（只讀 import，不改它）。
  - AI bot：host 依真人數補滿 4 台（`bot-0..`，名字「電腦N」，與 bomber 同規則，單人與多人皆補），bot 名冊比照 bomber 隨 `seed` 的可選欄位 `bots` 廣播（不另開名冊訊息，避免名冊晚於 seed 到），位置／砲塔由 host 模擬並以新訊息 `botState`（20Hz）廣播，guest 插值；決策寫成 `tankFx/tankAI.ts` 純函式（輸入：牆／木箱格、坦克位置、子彈、道具、預告與已落牆格；輸出：移動方向、砲塔目標角、是否開火）：有直線視線就轉砲塔瞄準並開火（瞄準誤差 `AI_AIM_ERR_DEG = 8`、反應延遲 `AI_REACT_MS = 300`）、子彈將在 `AI_DODGE_MS = 600` 內擊中自己就橫移閃避、無目標時沿格路徑走向最近的道具或敵人、絕不走進預告格或已落牆格；bot 開火走 host 內部路徑、同受 `FIRE_COOLDOWN_MS` 與 buff 規則。單測至少涵蓋：有視線開火、無視線不開火、閃避、避開預告格、撿道具。
  - 結算：bot 也列入名次（存活優先、再比擊殺），所有 client 名次一致。
- [ ] AC3 固定 4 色：移除 `colorFor` hash；`colorIndex` = 該實體在「`ctx.players` 依序＋bots 依序」的序號，推導優先只讀 import `bomberFx/palette` 既有的 `colorIndexOf(id, ids)`（或 `tankFx/` 薄包一層並附單測：同一份名冊在任何 selfId 下輸出一致）；中途有人離房時比照 bomber 重建名冊與配色；同一台坦克在每個 client 顏色一致。
- [ ] AC4 手機操作：`src/pages/Battle/BabylonCanvas.tsx` 的 `TOUCH_ACTIONS.tank` 加砲塔左轉（`q`）、右轉（`e`）兩顆按住即轉的鈕，與開火鈕並排（`tank.ts` 已監聽 `q`／`e` 轉砲塔，`TouchControls` 派發合成 KeyboardEvent 即可接上，babylon 不需改輸入；qa 以觸控模擬實測砲塔真的轉動）；bomber、kitchen、race 的觸控鈕不變。
- [ ] AC5 角色與場景（照 spec）：程式建模 Q 版玩具坦克（圓角車身、左右履帶、砲塔、砲管、旗子或天線、玩家色）並合併 mesh（車身＋履帶＋旗合併，砲塔＋砲管為可轉的獨立子 mesh）；自己頭上「你」標記；可轉動砲塔；開砲後座與車身擠壓回彈；履帶依移動做 UV 捲動或輪轉；套 `upright.ts` 俯角補償（若 spec 需要）；不可破牆為積木 thin instance、木箱 thin instance（沿用 bomber 木箱語彙）、地面 1 個 mesh＋程式貼圖、場外延伸底色；5 種道具各一個合併 mesh（帶圖示），浮動旋轉；子彈 thin instance。對照 `variant-A-sheet.webp`、`variant-A-gameplay.webp`。
- [ ] AC6 材質光影：`fx/look` 以 `tag: 'tank'` 套兩階 ramp；描邊只描坦克、道具、木箱；Hemispheric＋Directional 雙光；ShadowGenerator（桌機 1024 PCF、手機 512 或 blob，只讓坦克與道具投影）；GlowLayer `includeOnly` 限定子彈、砲口焰、道具、預告格；DefaultRenderingPipeline（FXAA、ACES、桌機 bloom）；桌機 `hardwareScalingLevel = 1 / min(devicePixelRatio, 2)`。
- [ ] AC7 特效（spec 特效表每一列）：至少含砲口焰、子彈拖尾、反彈火花、命中火花＋受擊閃白＋受擊車身擠壓彈跳（糖果式「命中彈出」，與開砲擠壓回彈共用曲線）、無敵閃爍、護盾泡泡（被破時碎裂）、三連發 buff 光環、爆炸（煙＋碎片＋殘骸焦痕）、履帶痕與揚塵、木箱碎裂、道具出現彈出與拾取光柱、落牆預告與落下回彈、連殺字卡（同一條命內、前一殺後 `STREAK_WINDOW_MS = 4000` 內再殺即累加，2 連以上顯示「雙殺」「三殺」，糖果式彈出）、自己受擊時鏡頭微震（`prefers-reduced-motion` 或手機檔關閉）；粒子用 `fx_*.webp`，每組上限 150（手機 60）；浮字共用 DynamicTexture，不每次新建。
- [ ] AC8 HUD（React）：`src/babylon/types.ts` 新增 `TankHud`（`kind: 'tank'`，形狀見共用契約），`setHud` 聯集加入 `TankHud`，`GameHud`／`KitchenHud` 既有欄位一個不改、沒有 `kind` 仍當 bomber；`BabylonCanvas` 依 `kind` 分流，tank 渲染根節點 `[data-tank-hud]`：玩家卡（1–4 張含 bot、色塊坦克頭像、名字、HP 格、護盾標記、buff 圖示＋剩餘秒數、擊殺數、陣亡灰化、自己掛「你」）、上方計時膠囊（顯示到突然死亡的倒數，進入後變紅「縮圈中」）、存活數、擊殺通知（右上，最多 3 條、3 秒淡出）；手機 `max-height: 500px` 精簡；樣式 token 與 bomber 玩家卡同套。tank 改用 `setHud`，移除 3D `createTextPanel` HUD 與 HP 方塊條；開局倒數改用 `fx/` 的共用 theme 並掛 `look.uiCamera`＋`UI_LAYER`；結算沿用 `setOverlay`。bomber 的 `[data-bomber-hud]`、kitchen 的 `[data-kitchen-hud]` 行為不變；race 的 DOM 沒有三個 HUD 節點。
- [ ] AC9 檔位與降級：開局 `console.info('[tank] tier desktop|mobile')`；判定與 bomber 同；`?tankTier=desktop|mobile` 強制、`?tankNoDegrade=1` 關自動降級（含 hash 內 query）；mobile 關描邊、Glow、bloom，陰影 512 或 blob，粒子上限 60，`hardwareScalingLevel` 固定 1.5；連續 60 幀平均 < 45fps 依序降描邊 → Glow → 陰影並 `console.info('[tank] degrade <outline|glow|shadow>')`。
- [ ] AC10 效能：每 2 秒 `console.info('[tank] drawCalls=<N> fps=<N>')`（跳過第一次的 0／Infinity）；`?tankTier=desktop&tankNoDegrade=1` 固定條件「單人 3 bot、開局倒數結束後 5 秒、自己不開火」量 N0（bot 可能開火，取 3 次讀數最大值）；另以 babylon 提供、只在 `tankNoDegrade=1` 下生效的偵錯參數 `?tankBench=1`（場上擺 5 種道具各一、10 顆靜止子彈）量 N1；判定 `N1 ≤ 90`，並記 N0、N1；fps 只記錄。
- [ ] AC11 bundle：`node_modules/.bin/vite build --outDir <scratchpad>/dist --emptyOutDir` 成功（不跑 `pnpm build`，worktree 的 `docs/` 保持無變更）；base 產物由 qa 以 `git archive <任務 base>` 解到 scratchpad、symlink 主樹 `node_modules` 後同指令建置；`vendor-babylon-*.js` gzip 增量 ≤ 10 KB、`Battle-*.js`（含新拆出的遊戲相關 chunk 合計）gzip 增量 ≤ 30 KB，report 附改前改後數字。
- [ ] AC12 行為不變與零回歸：`DK_TEST_CMD` 全綠；`git diff <任務 base> -- src/core src/babylon/net src/babylon/hud.ts` 為空；`bomberFx/`、`kitchenFx/`、`bomber*.ts`、`overcooked*.ts`、`race*.ts` 的 diff 為空；qa 以 production preview 跑坦克完整一局（開火、反彈、命中無敵擊退、5 種道具、縮圈、bot 對戰、結算、再開一局）console 無錯；bomber 與 kitchen 單人一局與主樹 `docs/` 基準（qa 先確認 `git diff <docs 對應的 build commit> <任務 base> -- src public` 為空，不空就改用 AC11 的 base 產物當基準）同參數 1920×1080 截「開局倒數第一幀」並排，HUD 與場景靜態物件無差異（bot 走位造成的差異不計）；race 一局 console 無錯、無三個 HUD 節點。
- [ ] AC13 多人：qa 以 `--contexts 2` 驗兩端顏色一致、bot 位置同步、子彈反彈軌跡一致、護盾／三連發效果一致、落牆同步、結算名次一致；Firestore 不可用時標「待驗：<錯誤>」並明列於 report，不得改連其他 DB。
- [ ] AC14 qa 驗收截圖：`?tankTier=desktop&tankNoDegrade=1` 截 1920×1080、960×540，`?tankTier=mobile` 截 844×390（含觸控鈕），每張標註對應 AC 與比對的 `variant-A-*`；spec 特效表每列至少一組連拍；以 `?tankTier=desktop`（不帶 NoDegrade）驗自動降級；draw calls、fps、bundle 數字寫進 report。

## 檔案所有權
| 成員 | 可改 | 只讀 | 獨佔資源 |
|---|---|---|---|
| babylon | src/babylon/games/tank.ts, src/babylon/games/tankNet.ts, src/babylon/games/tankFx/**, src/babylon/fx/**, src/babylon/babylonCore.ts, src/babylon/audio/sfx.ts | src/babylon/games/bomberFx/**, src/babylon/games/kitchenFx/**, src/babylon/games/bomber*.ts, src/babylon/games/overcooked*.ts, src/babylon/net/**, src/core/**, src/babylon/hud.ts, src/babylon/types.ts, src/pages/Battle/**, public/battle/bomber/** | dev:5175 |
| babylon-hud | src/babylon/types.ts, src/pages/Battle/**, src/index.css | src/babylon/games/**, src/babylon/fx/**, public/fonts/** | — |
| designer | .dkbo/tasks/2026-10-03-tankart/design/** | src/**, public/**, .dkbo/tasks/2026-09-25-bomberart/design/**, .dkbo/tasks/2026-09-26-kitchenart/design/** | — |
| qa | scripts/qa/tankart/** | ** | dev:5179, dev:5176, firebase:battle |

babylon 自查一律用 `PORT=5175` 的單人模式（`SoloGame`，不連 Firebase）；babylon-hud 不起 `/battle`，以 tsc、eslint、vitest 與假資料自查（純函式如 buff 秒數、擊殺通知佇列、`sameHud` 擴充要附 `*.test.ts`）。babylon 與 babylon-hud 同波時，babylon 照共用契約的 `TankHud` 形狀寫呼叫端，型別由 babylon-hud 落在 `types.ts`。babylon 改 `src/babylon/audio/sfx.ts` 只准新增音效名（如反彈、護盾破、落牆），不改既有音效。designer 在主樹任務目錄工作、不切 worktree，參考前兩款稿件只讀。qa 的探測腳本與截圖一律放 scratchpad，`scripts/qa/tankart/**` 只是占位、不得寫入；qa 在主樹只跑 `node_modules/.bin/vite preview --outDir docs --port 5176 --strictPort` 截基準（不用 5173），截完即關，不改主樹任何檔。

## 共用契約
| 契約 | 擁有者 | 消費者 | 形狀／簽名 | 變更流程 |
|---|---|---|---|---|
| TankHud 通道 | babylon-hud@波2 | babylon@波3 | `TankHud = { kind: 'tank'; remainSec: number; suddenDeath: boolean; aliveCount: number; players: { id: string; name: string; colorIndex: 0\|1\|2\|3; isSelf: boolean; isBot: boolean; alive: boolean; hp: number; maxHp: number; kills: number; shield: boolean; buffs: { kind: 'speed' \| 'rapid' \| 'triple'; remainSec: number }[] }[]; feed: { id: number; killer: string \| null; victim: string }[] }`；`GameContext.setHud?: (hud: GameHud \| KitchenHud \| TankHud \| null) => void`；`remainSec` 為到突然死亡的剩餘秒數（進入後為 0 且 `suddenDeath: true`），量化到整秒；buff `remainSec` 量化到整秒；`feed` 為最近 3 則擊殺（`id` 單調遞增供 React key，`killer` 為 null 表示落牆），名字為顯示名；欄位只增不改 | 改形狀先 ESCALATE 給領導 |
| A Toy Army spec | designer@波1 | babylon@波2, babylon-hud@波2 | `design/spec.md` 章節：色票、物件建模表、材質／描邊／Glow 名單、特效表、HUD 版面三檔；`variant-A-gameplay.webp`、`variant-A-sheet.webp` | 波 2 起有疑義用 QUESTION 問領導，領導裁定後記 ruling |

## 波次表
| 波 | 型態 | 成員 | 做什麼 | 難度 | 完成條件 | 審查 |
|---|---|---|---|---|---|---|
| 1 | 實作 | babylon | 玩法規則（AC2 全部：反彈＋`bounce`、無敵擊退、`shield`／`triple`、縮圈＋`close`、AI bot＋`seed.bots`／`botState`、結算含 bot）與固定 4 色（AC3）；相機半徑 28→38、target (0,0,-2)（見全域約束）；純函式先寫紅測再實作；新訊息全部驗型別範圍且只信房主；畫面暫用現有方塊美術，HUD 不排版，只在既有文字面板補一行護盾／buff／縮圈倒數供 qa 判讀（波 3 整段刪除）；自查 `PORT=5175` 單人模式 | L | AC2、AC3 完成；全閘綠；單人對 3 bot 打完一局 console 無錯 | 預設 |
| 1 | 設計 | designer | A Toy Army 方向稿（AC1）：先讀 bomberart、kitchenart 的 `design/spec.md` 與稿件對齊語彙，再出 `spec.md`、`variant-A.pen`、`variant-A-gameplay.webp`、`variant-A-sheet.webp`；HUD 依共用契約 `TankHud` 欄位設計，含 5 種道具圖示與 buff 圖示 | L | AC1 產出齊全且 spec 各章節完整 | |
| 1 | 驗收 | qa | 等 babylon `[DONE]` 後：worktree `vite build --outDir <scratchpad>/dist`＋`vite preview --port 5179` 單人逐條驗 AC2、AC3（反彈軌跡、撞木箱不反彈、無敵 1 秒、擊退不穿牆、護盾、三連發、60 秒後縮圈與壓毀、bot 會瞄準／閃避／撿道具、結算含 bot）；多人可用時 `--contexts 2` 驗兩端顏色、反彈、落牆、bot 同步；以 `git archive <任務 base>` 建 base 產物並記 bundle 數字；腳本與截圖只放 scratchpad | M | AC2、AC3 逐條判定 | |
| 2 | 實作 | babylon | 照 spec 做角色與場景（AC5）、材質光影（AC6）、檔位與降級（AC9）、perf log（AC10 程式面）；`fx/` 只新增可選參數；自查 `PORT=5175` 單人 | L | AC5、AC6、AC9 程式面完成，單人自查 console 無錯並附截圖 | 預設 |
| 2 | 實作 | babylon-hud | `types.ts` 落 `TankHud` 與 `setHud` 聯集；`BabylonCanvas` 依 `kind` 分流；照 spec 做 `[data-tank-hud]` 全部元件（玩家卡、計時膠囊、存活數、擊殺通知、手機精簡）與 `.tank-*` class；手機砲塔 Q/E 鈕（AC4）；假資料涵蓋 bot、陣亡、護盾、三種 buff、縮圈、落牆擊殺 | M | AC4、AC8 的 React 側，tsc／eslint／vitest 綠，bomber／kitchen HUD 路徑不變 | |
| 2 | 驗收 | qa | 等兩位 `[DONE]` 後：worktree build＋`vite preview --port 5179` 單人截 1920×1080 對照 `variant-A-gameplay.webp`、`variant-A-sheet.webp`，逐條判定 AC5、AC6、AC9，量 draw calls；844×390 觸控模擬驗 Q/E 鈕；主樹 `vite preview --outDir docs --port 5176` 截 bomber、kitchen 基準與 worktree 並排（HUD 分流零回歸）；確認 console 是 `[tank]` 前綴 | M | AC4、AC5、AC6、AC9 逐條判定，bomber／kitchen 並排無差異 | |
| 3 | 實作 | babylon | spec 特效表全部 3D 特效（AC7）；tank 接 `setHud`（每次傳新物件、依契約量化；feed `id` 跨局單調遞增、不歸零）、移除 3D 文字面板與 HP 方塊條、倒數改共用 theme 掛 UI 相機；道具 Glow 依種類帶色（實例色、不增 draw call，做不到則保留暖白並在 report 說明）；自查 draw calls 與 bundle（AC10、AC11 的正式數字由 qa 量） | L | AC7、AC8（遊戲側）、AC10 程式面 | 預設 |
| 3 | 實作 | babylon-hud | 只修 qa 回報的 HUD BUG（真資料確認歸 qa，不起 `/battle`）；qa 回報無 HUD BUG 即交付 | M | qa 回報的 HUD BUG 全部 FIXED | |
| 3 | 驗收 | qa | 等 babylon `[DONE]` 後開驗；HUD BUG 送 babylon-hud，收到其 FIXED 後複驗該項，全項判定要等 babylon-hud 也 `[DONE]`：主樹基準截四款，worktree build＋`vite preview --port 5179` 驗 AC1–AC14 全項；特效表每列連拍；自動降級；多人 `--contexts 2` 全項（AC13）；腳本與截圖只放 scratchpad | M | AC12、AC13、AC14 全項，AC1–AC11 逐條判定 | |
| 4 | 實作 | babylon | 修復波（整枝評議 Important 1＝qa 波 3 疑慮 1）：子彈壽命改以模擬時間計算，host 與 guest 兩端一致（`BulletInfo` 加 `age`，`stepBullets` 每 tick `age += dt*1000`，`age > BULLET_LIFETIME_MS` 才移除），只動 `tank.ts`／`tankFx/`、不碰 net 層；`createdAt` 若只剩砲口焰去重可一併清；先寫紅測（同起點同 tick 數兩端同壽命、補步被截斷時壽命不提早到期） | L | 子彈壽命改模擬時間且附單測；全閘綠；單人自查 console 無錯 | dk-review 4 --tier L |
| 4 | 驗收 | qa | 等 babylon `[DONE]` 後：worktree build＋`vite preview --port 5179`，多人 `--contexts 2` 用波 3 疑慮 1 的同一套腳本與兩種解析度重跑，guest 多出反彈 0 例；單人一局坦克 console 無錯（回歸） | M | 幽靈反彈 0 例、單人無回歸 | |
