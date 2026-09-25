# 炸彈超人美術優化（A Toy Box）
來源：人的口頭需求＋designer 方向稿（`design/`）   需求原文：request.md
分支：dk/bomberart   worktree：（/dkbo-run 交棒時建立）

## 目標（≤3 行）
把 `/battle` 的炸彈超人（`src/babylon/games/bomber.ts`）照方向稿 A「Toy Box 卡通玩具」全面美化：固定 4 色 Q 版角色、卡通材質加描邊、陰影、Glow、後製、爆炸與道具特效，HUD 改成 React 玩家卡加計時器。
設計唯一依據：`$DK_ROOT/tasks/2026-09-25-bomberart/design/spec.md` 與同目錄 `variant-A-*.webp`、`variant-A.pen`（B／C 不做），本 brief 與 spec 衝突時以 brief 為準。遊戲規則、數值、網路協定不變；另外三款遊戲零回歸。

## 全域約束
- 路徑一律用 `@/*` 別名，不得用相對路徑引入。
- 自訂 CSS class 一律用 `@apply` 套 Tailwind；`src/index.css` 只准新增 `.bomber-*` 前綴的 class，不得修改既有 class。
- 圖片只收 WebP，不得把 JPG／PNG 寫進 `src/`、`public/`；PNG 等中間檔只准放自己的 scratchpad。
- 非同步請求與資料處理寫在 Zustand store action，元件只訂閱與調用。
- 不新增任何依賴：`package.json`、`pnpm-lock.yaml` 不改（不加 `@babylonjs/loaders`／`gui`／`materials`）。
- Babylon 一律經 `src/babylon/babylonCore.ts` 深層匯入（eslint 已禁整包匯入），不用 `.pure` 版本；新功能要在那裡補副作用 import。
- 不動多人同步協定：`src/core/**`、`src/babylon/net/**`、`src/babylon/games/bomberNet.ts`、`bomberAI.ts`、`bomberMap.ts` 只讀；`*.test.ts` 不得修改，全部保持綠。
- 遊戲規則與數值不變（格數、計時、突然死亡 40 秒、道具效果、爆炸 550ms 時序等）；相機 β、fov 不調（spec §7 的相機段不做）。
- 字型：HUD 數字用站內既有的 Fredoka（`public/fonts/Fredoka-Bold.woff2`）代替 spec 的 Lilita One；中文用站內字型代替 Noto Sans TC，不新增字型檔。
- spec §11 八條採以下裁定（關卡①使用者已確認，含②）：①選 A；②**角色與所有物件都用程式建模**（不引入 glTF，理由見 ruling）；③HUD 走 React，透過 `types.ts` 新增的可選 `setHud` 通道；④卡通材質以 StandardMaterial 的 MaterialPlugin 注入 ramp（波 2 裁定；原為 NodeMaterial／ShaderMaterial）；⑤可破磚統一箱形；⑥固定 4 色依出生角；⑦相機不調；⑧`vendor-babylon` gzip 增量 ≤ 250 KB。

- 所有圖像除 AC1 的素材外一律程式產生（DynamicTexture／幾何）：地面棋盤、焦痕 decal、落地 ring、硬磚裂痕、木箱 X 撐條、石柱磚縫、青苔、「你」標記、`AI` 小章、`+1`（billboard plane＋DynamicTexture，不用 Babylon GUI）；玩家卡頭像由 babylon-hud 依 `colorIndex` 以 CSS 或 inline SVG 畫。
- `src/babylon/hud.ts` 四款遊戲共用：只准新增可選參數或 bomber 專用函式，預設外觀與行為不變。

## 驗收標準
- [ ] AC1 素材：`public/battle/bomber/` 有 `fx_circle.webp`、`fx_star.webp`、`fx_smoke.webp`、`fx_spark.webp` 與 `items_atlas.webp`（6 格橫排、每格 128×128，順序 bomb, fire, speed, kick, throw, invincible；炸彈、火力、踢彈、丟彈為白色圖示，速度、無敵為深色 `#3A2A00`，透明底），全部 WebP、單張 ≤ 1024²、總量 ≤ 1.5 MB；來源為 CC0（Kenney Particle Pack／Game Icons）或依 spec 以 pen 自繪，`LICENSE.txt` 列出每個檔的來源與授權。
- [ ] AC2 角色：固定 4 色（spec §4 色票），依 `SPAWN_CORNERS` 順序配色，同一位玩家在每個 client 上顏色一致；程式建模的 Q 版造型（圓角、頭盔徑向漸層、臉 `#FFF1E0`、眼睛帶白色光點）對照 `variant-A-sheet.webp`；AI 改成青色天線球加 Glow 與 `AI` 小章、拿掉灰白 Torus；自己頭上有本色「你」標記；無敵外圈金色閃爍（8Hz，最後 1.5 秒 16Hz）。
- [ ] AC3 場景物件：地面 1 個 mesh 加程式棋盤貼圖；柱牆、外框牆、可破磚、硬磚用 thin instance（炸毀時更新 matrix buffer）；可破磚統一箱形；硬磚有受損態；突然死亡落牆有紅頂與落下前 400ms 的紅色預告格；炸彈、火焰、道具代幣照 spec §5 規格。
- [ ] AC4 材質與光影：卡通兩階 ramp（亮 1.0／暗 0.62）、玩家／炸彈／箱子／道具描邊（`renderOutline`，0.02、`#2B2440`）；Hemispheric＋Directional 雙光；ShadowGenerator（桌機 1024 PCF，只讓玩家、炸彈、道具投影）；GlowLayer 以 `includeOnly` 限定火焰外層、將爆炸彈、無敵代幣、AI 天線；DefaultRenderingPipeline（FXAA、ACES、桌機 bloom）；桌機 `hardwareScalingLevel = 1 / min(devicePixelRatio, 2)`。
- [ ] AC5 特效（spec §8 全表每一列）：放炸彈彈跳加地面 ring、引信火花與將爆閃紅脈動、爆心星芒加臂依序生長加焦痕 decal 1.5 秒加震動、木箱木片與煙、硬磚受損火花、道具出現彈跳、拾取飛向頭頂加 `+1`、陣亡跳起旋轉縮小加煙加星、突然死亡預告格加灰塵環；粒子改用 AC1 的貼圖，每組上限 150（手機 60）；道具圖示用 `items_atlas.webp`。
- [ ] AC6 HUD（React）：`types.ts` 的 `GameContext` 新增可選 `setHud`（見共用契約）；`BabylonCanvas` 在收到非 null 的 hud 時渲染根節點 `[data-bomber-hud]`：左 P1／P3、右 P2／P4 四張玩家卡（P 編號＝`colorIndex + 1`；色帶、名字、頭像、3 顆勝場星、炸彈／火力／速度三格、踢彈／丟彈／無敵徽章與無敵倒數、陣亡灰階加 💀）與頂部計時器膠囊（距突然死亡倒數、存活 N/M；`suddenDeath` 為 true 時忽略 `secondsLeft`，改紅底「縮圈中」；剩 10 秒內變紅跳動）；樣式照 spec §9。bomber 改用 `setHud`、移除 3D 的 `createTextPanel` 狀態列；開局 3/2/1/GO! 倒數改 A 配色（經 `hud.ts` 可選參數或 bomber 專用函式）。tank、race、overcooked 的 DOM 裡沒有 `[data-bomber-hud]`，倒數與 3D 狀態列截圖和 master 基準並排目視無差異。
- [ ] AC7 檔位與降級：開局 `console.info('[bomber] tier desktop|mobile')`；觸控裝置或 `hardwareConcurrency <= 4` 走 mobile（關描邊、Glow、bloom，陰影 512 或 blob，粒子上限 60，`hardwareScalingLevel` 固定 1.5）；網址 `?bomberTier=desktop|mobile` 強制檔位、`?bomberNoDegrade=1` 關自動降級；未關時連續 60 幀平均低於 45fps 依序降一級（描邊 → Glow → 陰影）並 `console.info('[bomber] degrade <outline|glow|shadow>')`。HUD 在 `@media (max-height: 500px)` 時玩家卡縮成頂部 4 顆頭像膠囊、計時器移到下方中央；960×540 顯示完整玩家卡。
- [ ] AC8 效能量測：bomber 每 2 秒 `console.info('[bomber] drawCalls=<N> fps=<N>')`（`SceneInstrumentation`）；在 `?bomberTier=desktop&bomberNoDegrade=1` 下開局滿盤 draw calls ≤ 120；fps 只記錄、不設門檻。
- [ ] AC9 bundle：`node_modules/.bin/vite build --outDir <scratchpad>/dist --emptyOutDir` 成功（不要跑 `pnpm build`，`docs/` 在 worktree 內保持無變更）；`vendor-babylon` gzip ≤ 650 KB（現為 399 KB），report 附改前改後；超過 `chunkSizeWarningLimit` 就同步調整並更新註解。
- [ ] AC10 行為不變與零回歸：`DK_TEST_CMD` 全綠；`git diff <任務 base> -- src/core src/babylon/net src/babylon/games/bomberNet.ts src/babylon/games/bomberAI.ts src/babylon/games/bomberMap.ts` 為空，`bomber.ts` 的規則常數（計時、突然死亡、爆炸時序、道具數值）未改；qa 以 production preview 在 `--contexts 2 --dns` 下跑 bomber 完整一局（放炸彈、炸箱、硬磚兩段、拾取道具、陣亡、突然死亡、結算、再開一局），兩個 context 的 `consoleErrors`／`pageErrors` 皆空、位置與顏色同步；tank、race、overcooked 各開一局 console 無錯並符合 AC6 末句。
- [ ] AC11 qa 驗收：在 `?bomberTier=desktop&bomberNoDegrade=1` 截 1920×1080、960×540，在 `?bomberTier=mobile` 截 844×390，每張標註對應 AC 與比對的 variant-A 稿；spec §8 每一列至少一組連拍；另以 `?bomberTier=desktop`（不帶 NoDegrade）驗自動降級那一行；draw calls 與 fps 數字寫進 report。

## 檔案所有權
| 成員 | 可改 | 只讀 | 獨佔資源 |
|---|---|---|---|
| assets | public/battle/bomber/** | src/babylon/**, src/pages/Battle/** | — |
| babylon | src/babylon/games/bomber.ts, src/babylon/games/bomberFx/**, src/babylon/babylonCore.ts, src/babylon/hud.ts, vite.config.ts | src/babylon/games/bomberNet.ts, src/babylon/games/bomberAI.ts, src/babylon/games/bomberMap.ts, src/babylon/games/*.test.ts, src/babylon/net/**, src/core/**, src/babylon/types.ts, src/pages/Battle/**, public/battle/bomber/** | dev:5175 |
| babylon-hud | src/babylon/types.ts, src/pages/Battle/**, src/index.css | src/babylon/games/**, public/fonts/** | — |
| qa | scripts/qa/bomberart/** | ** | dev:5174, dev:5176, firebase:battle |

babylon 可把特效、材質、thin instance 等拆到 `src/babylon/games/bomberFx/**`；babylon 與 babylon-hud 同波起跑時，babylon 先照共用契約的 `GameHud` 形狀寫呼叫端，型別由 babylon-hud 落在 `types.ts`。babylon 自查一律用 `PORT=5175` 的單人模式（`SoloGame`，對 AI、不連 Firebase）；babylon-hud 不起 `/battle`，以 tsc、eslint 與元件層級的假資料自查。`src/babylon/games/*.test.ts` 只讀：它們測 AI／地圖／網路邏輯，紅了代表改錯了。qa 的探測腳本與截圖一律放 scratchpad，`scripts/qa/bomberart/**` 只是占位，不得寫入；qa 在主樹只跑 `node_modules/.bin/vite preview --outDir docs --port 5176 --strictPort` 截基準（不用 5173，使用者可能開著 dev），截完即關，不改主樹任何檔。

## 共用契約
| 契約 | 擁有者 | 消費者 | 形狀／簽名 | 變更流程 |
|---|---|---|---|---|
| GameHud 通道 | babylon-hud@波1 | babylon@波1, babylon@波3 | `GameContext.setHud?: (hud: GameHud \| null) => void`；`GameHud = { timer: { secondsLeft: number; suddenDeath: boolean }; aliveCount: number; totalCount: number; players: { id: string; name: string; colorIndex: 0\|1\|2\|3; isSelf: boolean; isAI: boolean; alive: boolean; wins: number; bombs: number; fire: number; speed: number; kick: boolean; throw: boolean; invincibleMs: number }[] }`；P 編號＝`colorIndex + 1`，`suddenDeath` 為 true 時 `secondsLeft` 無意義；欄位只增不改，其他遊戲不呼叫即不影響 | 改形狀先 ESCALATE 給領導 |
| bomber 素材路徑 | assets@波1 | babylon@波3 | `public/battle/bomber/fx_circle.webp`、`fx_star.webp`、`fx_smoke.webp`、`fx_spark.webp`、`items_atlas.webp`（見 AC1），網址經 vite `base: '/collect/'` 取用 | 改檔名或順序先 ESCALATE 給領導 |

## 波次表
| 波 | 型態 | 成員 | 做什麼 | 難度 | 完成條件 | 審查 |
|---|---|---|---|---|---|---|
| 1 | 實作 | assets | 取得 CC0 粒子貼圖與道具圖示（或依 spec 以 pen 自繪），用 `cwebp` 轉 WebP、組 `items_atlas.webp`，寫 LICENSE.txt | M | AC1 | 預設 |
| 1 | 實作 | babylon | 幾何與配色：固定 4 色、程式建模角色（含「你」、AI 小章、無敵閃爍）、地面單 mesh＋棋盤貼圖、thin instance 牆與箱（炸毀更新 matrix）、箱形統一、硬磚受損態、突然死亡紅頂與預告格、炸彈／火焰／代幣造型、draw call 量測 print | L | AC2、AC3、AC8（量測 print）的程式面完成，單人模式自查 console 無錯 | |
| 1 | 實作 | babylon-hud | `types.ts` 落 `GameHud`／`setHud`；`BabylonCanvas`（或新元件）渲染 `[data-bomber-hud]` 玩家卡與計時器、`max-height: 500px` 版面、`.bomber-*` class；以假資料自查 | M | AC6 的 React 側，tsc／eslint／vitest 綠 | |
| 2 | 實作 | babylon | 材質與光影：NodeMaterial ramp＋描邊、雙光、ShadowGenerator、GlowLayer 白名單、DefaultRenderingPipeline、桌機解析度、檔位開關與自動降級（AC7 的遊戲側）、`babylonCore.ts` 補副作用 import；`vite build --outDir <scratchpad>` 量 bundle | L | AC4、AC7（遊戲側）、AC8、AC9（中間值） | 預設 |
| 2 | 驗收 | qa | 等 babylon `[DONE]` 後煙霧測試（等待期間可先備好探測腳本）：worktree `vite build --outDir <scratchpad>/dist` ＋ `vite preview --port 5174`，`--contexts 2 --dns` 跑 bomber 一局，驗炸箱、硬磚兩段、突然死亡落牆、顏色同步與 console，最後關掉一個 context 確認另一端角色材質仍正常（波 1 Important 1 的迴歸）；截 1920×1080 一張對照稿 | M | AC2、AC3 在多人下逐條判定，console 無錯 | |
| 3 | 實作 | babylon | spec §8 全部特效、粒子換貼圖、道具代幣用圖集、bomber 接 `setHud` 並移除 3D 狀態列、倒數改色（不改 `hud.ts` 預設外觀，在 ACES 後的畫面上對色）；呼叫 `setHud` 每次傳新物件、`invincibleMs` 量化到 100ms、`secondsLeft` 量化到整秒；檔位網址參數同時解析 hash 內的 query（波 2 minor） | L | AC5、AC6（遊戲側）、AC9 | 預設 |
| 3 | 實作 | babylon-hud | 修 qa 回報的 HUD BUG；`bomberHud.ts` 的 4 色改 import `@/babylon/games/bomberFx/palette`（波 1 minor 1）；無 BUG 時確認 `max-height: 500px` 版面與陣亡／無敵狀態顯示 | M | qa 回報的 HUD BUG 全部 FIXED | |
| 3 | 驗收 | qa | 等 babylon `[DONE]` 後：主樹 `vite preview --outDir docs --port 5176` 截四款基準，worktree build＋`vite preview --port 5174` 驗 AC1–AC11；補驗波 2 未驗的眼睛光點、無敵閃爍，並明確判定角色是否側躺（對 variant-A-sheet）。多人項：開工時先探 `dkbo-collect`，仍 NOT_FOUND 就一律標「待驗：dkbo-collect NOT_FOUND」，不得改連 `(default)` 或其他 DB。探測腳本與截圖只放 scratchpad，不得寫進 repo | M | AC10、AC11 全項，AC1–AC9 逐條判定 | |
| 4 | 實作 | babylon | 整枝評議修復：陣亡玩家 `invincibleMs` 回 0（`bomberFx/hudModel.ts:63`）；結算階段計時器凍結在最後的值、不跳回 0:40（`bomber.ts:1674`）；perf log 跳過第一次的 `drawCalls=0 fps=Infinity`（`bomber.ts:1617`） | M | 三條修掉，全閘綠 | 預設 |
| 4 | 實作 | babylon-hud | 整枝評議修復：`src/index.css:1383` reduced-motion 改 `@apply animate-none`；960×540 全螢幕鈕不再壓 P2 卡編號（`src/index.css:1250` 右欄頂部偏移） | M | 兩條修掉，全閘綠 | |
| 4 | 驗收 | qa | 等兩位 dev `[DONE]` 後 worktree build＋`vite preview --port 5174` 單人重驗：陣亡卡無盾牌徽章、結算時計時器不跳 0:40、960×540 全螢幕鈕不壓 P2、開局 console 無錯；腳本與截圖只放 scratchpad，不得改連 `(default)` DB | M | 三項目視通過並附截圖 | |
