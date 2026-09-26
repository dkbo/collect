# 廚房快手美術優化（A Toy Kitchen） — 給 babylon-hud 的切片（波 3）
由 dk-wave-open 產生，只讀。完整 brief 在 /home/bal/project/collect/.dkbo/tasks/2026-09-26-kitchenart/brief.md。

## 目標
把 `/battle` 的廚房快手（`src/babylon/games/overcooked.ts`）照方向稿 A「Toy Kitchen 玩具廚房」全面美化，與炸彈超人 A Toy Box 同系列：固定 4 色廚師角色、卡通材質加描邊、陰影、Glow、後製、切／煮／快焦／出餐特效，HUD 改成 React 訂單卡、計時分數、玩家卡與食譜；先把 bomberFx 通用部分抽成 `src/babylon/fx/` 共用，並修掉「湯只拿得到焦的」既有 bug。
設計唯一依據：`$DK_ROOT/tasks/2026-09-26-kitchenart/design/spec.md` 與同目錄 `variant-A-*.webp`、`variant-A.pen`（B／C 不做）；本 brief 與 spec 衝突時以 brief 為準。遊戲規則、數值、快照協定不變（唯一例外是 AC2 的取湯修正）；炸彈超人、坦克、賽車零回歸。「參照糖果」已在方向稿階段評估（C Candy Glaze），因色域衝突未採，只沿用其 spec 寫法與精緻度標準。

## 全域約束（全文）
- 路徑一律用 `@/*` 別名，不得用相對路徑引入。
- 自訂 CSS class 一律用 `@apply` 套 Tailwind；`src/index.css` 只准新增 `.kitchen-*` 前綴的 class，不得修改既有 class（含 `.bomber-*`）。
- 圖片只收 WebP，不得把 JPG／PNG 寫進 `src/`、`public/`；本任務不新增任何圖檔，貼圖一律程式產生（DynamicTexture／頂點色），粒子重用 `public/battle/bomber/fx_*.webp` 原路徑（不搬、不改檔）。
- 非同步請求與資料處理寫在 Zustand store action，元件只訂閱與調用。
- 不新增任何依賴：`package.json`、`pnpm-lock.yaml` 不改。
- Babylon 一律經 `src/babylon/babylonCore.ts` 深層匯入（eslint 已禁整包匯入），不用 `.pure` 版本；需要新副作用 import 才補在那裡。
- 不動多人同步：`src/core/**`、`src/babylon/net/**` 只讀；overcooked 的快照訊息與 `KitchenView` 形狀不變；`overcookedKitchen.ts` 只准改 AC2 那一處取湯條件；外插等新純函式寫在 `kitchenFx/`。
- 遊戲規則與數值不變：`ROUND_MS`、`CHOP_MS`、`COOK_MS`、`OVERCOOK_MS`、`ORDER_LIFE_MS`、`ORDER_EVERY_MS`、`MAX_ORDERS`、`SCORE_*`、`RECIPES`、`STATIONS`、格數；相機 β、fov、半徑、跟隨不調。
- 字型：數字用站內 Fredoka（`public/fonts/Fredoka-Bold.woff2`），中文用站內字型，不新增字型檔。
- `src/babylon/hud.ts` 不改（`createCountdownPanel` 已收 `opts.theme`）。
- 既有 `*.test.ts` 的斷言不得修改；AC1 搬移時只准改 import 路徑（`git diff -M` 看得出是 rename＋import 行）。
- 待裁決 12 條採使用者 2026-09-26 回「ok」的建議（見 request.md）：①A；②抽 `src/babylon/fx/`；③共用 `setHud` 加 `kind` 標記的聯集、不另開通道；④盤子只做外觀；⑤HUD 照實顯示（見 AC7）；⑥快焦用現有 progress 判定、不改協定、補單測；⑦依 `ctx.players` 序號固定 4 色；⑧不做結算星數；⑨粒子貼圖沿用 `public/battle/bomber/`；⑩相機不調；⑪`vendor-babylon` gzip 增量 ≤ 10 KB、遊戲程式（`Battle-*.js`）gzip 增量 ≤ 25 KB；⑫取湯 bug 併第一波修。

## 你的波次
| 波 | 型態 | 成員 | 做什麼 | 難度 | 完成條件 | 審查 |
|---|---|---|---|---|---|---|
| 3 | 實作 | babylon-hud | 修 qa 回報的 HUD BUG；無 BUG 時確認手機版與訂單逾時／新單動畫在真資料下正確 | M | qa 回報的 HUD BUG 全部 FIXED |  |

## 倉庫
/home/bal/project/collect/.worktrees/kitchenart
編輯一律用上面的 worktree 路徑；$DK_ROOT 指向主樹的 .dkbo/，只拿來跑 dk-msg 等 bin，不得當編輯路徑

## 你的檔案所有權
| 成員 | 可改 | 只讀 |
|---|---|---|
| babylon-hud | src/babylon/types.ts, src/pages/Battle/**, src/index.css | src/babylon/games/**, src/babylon/fx/**, public/fonts/** |

## 共用契約（全文）
| 契約 | 擁有者 | 消費者 | 形狀／簽名 | 變更流程 |
|---|---|---|---|---|
| KitchenHud 通道 | babylon-hud@波1 | babylon@波3 | `KitchenHud = { kind: 'kitchen'; remainSec: number; score: number; delivered: number; orders: { id: number; ing: 'v' \| 'm'; remainMs: number }[]; gone: { id: number; ing: 'v' \| 'm'; reason: 'served' \| 'expired'; scoreDelta: number }[]; players: { id: string; name: string; colorIndex: 0\|1\|2\|3; isSelf: boolean; held: { ing: 'v' \| 'm'; kind: 'raw' \| 'chop' \| 'soup' \| 'burnt' } \| null }[] }`；`GameContext.setHud?: (hud: GameHud \| KitchenHud \| null) => void`，無 `kind` 視為 `GameHud`（bomber）；`remainSec` 量化到整秒、`remainMs` 量化到 100ms（計時條比例用 `ORDER_LIFE_MS`）；`orders[].id` 用於 React key 與新單動畫，由 babylon 以純函式比對前後兩張快照穩定產生（不改快照）；`gone` 只在該次 setHud 對應的快照相比上一張有單消失時非空：`delivered` 增量 d 個配給符合 host `findIndex` 規則（同 `ing` 取最早那張）的消失單為 `served`，其餘為 `expired`，`scoreDelta` 為該次實際分數差分攤（expired 的實際扣分，分數下限 0 時可為 0）；欄位只增不改 | 改形狀先 ESCALATE 給領導 |
| src/babylon/fx 共用模組 | babylon@波1 | babylon-hud@波1 | `@/babylon/fx/palette` 匯出 `PLAYER_PALETTE`（4 色 × 亮／本／暗 hex）與 `hexToRgb`；`@/babylon/fx/look` 的 `LookOptions` 含 `tag`、`outline`；`@/babylon/fx/quality` 的 `pickTier(key)`／`noDegradeFlag(key)` | 改匯出名先 ESCALATE 給領導 |

## 驗收標準（全文）
- [ ] AC1 共用模組：照 spec §6 表把 bomberFx 通用部分搬到 `src/babylon/fx/`（`toon`、`geometry`、`thin`、`thinSlots`、`burstQueue`、`perfLog`、`rig`、`upright` 連同各自 `*.test.ts` 用 `git mv`；`quality`、`look` 參數化 `key`／`tag`／`outline`；`fxCurves`、`models`、`avatar`、`palette` 拆通用部分；`COUNTDOWN_THEME` 搬進 `fx/`）；bomber 只改 import 與傳參，網址參數仍是 `bomberTier`／`bomberNoDegrade`、log 前綴仍是 `[bomber]`；bomber 與 kitchen 共用同一份模組、不重複打包。
- [ ] AC2 取湯修正：鍋上是 `soup` 時空手可直接取走（不需等 `busyUntil`），`burnt` 照舊可取；`tickKitchen` 的 `soup → burnt` 時序與 `buildView` 的 progress 算式不變。新增 `src/babylon/games/overcookedKitchen.test.ts` 至少涵蓋：煮好後 0–5 秒內可取 soup、超過 5 秒變 burnt、`soup` 時前 2 秒 progress 為 0、之後 0→1（快焦語意，⑥）、送對 `ing` 得 `SCORE_SERVE`、訂單逾時扣分。
- [ ] AC3 角色：`PLAYER_PALETTE` 固定 4 色，`colorIndex` = 該玩家在 `ctx.players` 的序號（移除 `colorFor` hash），推導寫成 `kitchenFx/` 純函式並附單測（同一份 players 陣列在任何 selfId 下輸出一致），同一位玩家在每個 client 顏色一致；bomber 同款合併 mesh 角色換白色廚師帽＋白圍裙本色口袋（spec §4）；自己頭上「你」標記；手持物移到胸前雙手之間；站在加工中砧板旁時砍菜動作；套 `upright.ts` 俯角補償；對照 `variant-A-sheet.webp`。
- [ ] AC4 場景物件（spec §5）：地面 1 個 mesh＋程式棋盤貼圖；背牆磁磚與側牆；一般檯面一組 thin instance；食材箱 ×2（木箱＋內襯＋食材堆＋圓標）、砧板 ×2（板＋刀合併）、爐台＋鍋 ×2（爐圈、鍋身、湯面換色）、出餐口（黃台＋`>>`＋服務鈴＋背牆暖光窗與「出餐」牌）、盤架裝飾；食材與成品 8 種 `kind × ing` 各一個合併 mesh 以 thin instance 擺放（站點與手上共用），取代舊的 slot／hand 方塊與 `itemMats`；碗與焦炭外觀照 §5。
- [ ] AC5 材質光影（spec §6 光影規格）：卡通兩階 ramp、描邊（`renderOutline` 0.02、`#2B2440`，只描玩家、手持物、站點物品與站點本體）；Hemispheric＋Directional 雙光；ShadowGenerator（桌機 1024 PCF、手機 512 或 blob，只讓玩家與手持物投影）；GlowLayer `includeOnly` 限定開火爐圈、快焦鍋緣、出餐鈴閃光、出餐窗；DefaultRenderingPipeline（FXAA、ACES、桌機 bloom）；桌機 `hardwareScalingLevel = 1 / min(devicePixelRatio, 2)`。
- [ ] AC6 特效（spec §7 表中 3D 側每一列）：切菜碎片＋砧板回彈＋billboard 進度條、切好綠勾、煮中爐火＋白蒸氣＋綠進度環、煮好大蒸氣＋綠勾、**快焦**（`soup` 且 progress > 0：紅環、鍋緣紅脈動 2→6Hz、「!」章、灰黑煙漸強）、焦了黑煙＋ember＋常駐細煙（修掉舊 `updateSteam` 煮好後仍冒白蒸氣）、拾取／放下弧線＋小白環、出餐金星＋鈴回彈＋「+20」浮字（共用一張 DynamicTexture，不每次新建）；粒子用 `fx_*.webp`、每組上限 150（手機 60）；guest 端進度外插、訂單 id 穩定化與消失原因判定（見共用契約）都寫成 `kitchenFx/` 純函式並附 `*.test.ts`，訂單判定至少涵蓋：同 `ing` 兩張單其中一張出餐、出餐與逾時同一幀、分數為 0 時逾時。
- [ ] AC7 HUD（React）：`types.ts` 新增 `KitchenHud`（`kind: 'kitchen'`，形狀見共用契約），`setHud` 改收 `GameHud | KitchenHud | null`，沒有 `kind` 的一律當 bomber，`GameHud` 既有欄位一個不改；`BabylonCanvas` 依 `kind` 分流，kitchen 渲染根節點 `[data-kitchen-hud]`：左上訂單卡（最多 3 張；**照實顯示**：菜名與成品圖依 `ing` 顯示「蔬菜湯」／「肉湯」、分數徽章取 `SCORE_SERVE`（`+20`，不寫死）；成品圖、頭像、手持物圖示一律用 inline SVG／CSS 畫（不新增圖檔）；計時條綠 >50%／黃 25–50%／紅 <25%，<25% 紅框＋抖動＋警示圖示，`prefers-reduced-motion` 只換紅框；新單滑入；`gone` 裡 `reason: 'expired'` 的單掉落淡出並浮出實際扣分 `scoreDelta`（為 0 時不顯示浮字），`'served'` 的單打勾飛出）、右上計時＋分數＋出餐數膠囊（最後 15 秒變紅跳動）、左側玩家卡（只顯示實際人數，1–4 張；色塊廚師頭像、名字、P#、手持物槽、自己掛「你」）、右側食譜（只列蔬菜湯、肉湯兩道各 +20，預設展開，按 `R` 或點標題收合；`R` 的鍵盤監聽只在 kitchen HUD 掛載時存在、卸載即移除）；`max-height: 500px` 時訂單卡縮膠囊、計時縮窄、玩家卡隱藏、食譜收合（spec §8）；樣式 token 與 bomber 玩家卡同套。overcooked 改用 `setHud`，移除 4 塊 `createTextPanel` 與其繪製；開局倒數改用 `fx/` 的共用 theme；結算沿用 `setOverlay`，不加星數。bomber 的 `[data-bomber-hud]` 行為不變；tank、race 的 DOM 沒有 `[data-kitchen-hud]` 也沒有 `[data-bomber-hud]`。
- [ ] AC8 檔位與降級：開局 `console.info('[kitchen] tier desktop|mobile')`；判定與 bomber 同（觸控或 `hardwareConcurrency <= 4` 走 mobile：關描邊、Glow、bloom，陰影 512 或 blob，粒子上限 60，`hardwareScalingLevel` 固定 1.5）；`?kitchenTier=desktop|mobile` 強制、`?kitchenNoDegrade=1` 關自動降級（含 hash 內 query）；連續 60 幀平均 < 45fps 依序降描邊 → Glow → 陰影並 `console.info('[kitchen] degrade <outline|glow|shadow>')`。
- [ ] AC9 效能量測：每 2 秒 `console.info('[kitchen] drawCalls=<N> fps=<N>')`（跳過第一次的 0／Infinity）；`?kitchenTier=desktop&kitchenNoDegrade=1` 下固定條件「單人、所有有存放格的站點都放物品、手上持物」量 N1，另記單一角色（含描邊與陰影）的 draw call 增量 d，判定 `N1 + 3d ≤ 90`；多人可用時以 4 人實測覆蓋；fps 只記錄。
- [ ] AC10 bundle：`node_modules/.bin/vite build --outDir <scratchpad>/dist --emptyOutDir` 成功（不跑 `pnpm build`，worktree 的 `docs/` 保持無變更）；base 產物由 qa 以 `git archive <任務 base>` 解到 scratchpad、symlink 主樹 `node_modules` 後用同一指令建置；`vendor-babylon-*.js` gzip 增量 ≤ 10 KB、`Battle-*.js` gzip 增量 ≤ 25 KB（若拆出新的遊戲相關 chunk，合計計算），report 附改前改後數字。
- [ ] AC11 行為不變與零回歸：`DK_TEST_CMD` 全綠；`git diff <任務 base> -- src/core src/babylon/net src/babylon/hud.ts` 為空；`overcookedKitchen.ts` 的 diff 只有 AC2 那一處；bomber 規則常數未改；qa 以 production preview 跑 overcooked 完整一局（取菜、切、煮、快焦、焦掉丟棄、出餐得分、訂單逾時、結算、再開一局）console 無錯；bomber 單人一局與主樹 `docs/` 基準（qa 先確認 `git diff <docs 對應的 build commit> <任務 base> -- src public` 為空，不空就改用 AC10 的 base 產物當基準）在同網址參數下 1920×1080 截圖並排目視無差異、`[data-bomber-hud]` 正常；tank、race 各開一局 console 無錯、無上述兩個 HUD 節點。多人：先探 `dkbo-collect`，可用時 `--contexts 2 --dns` 驗兩端顏色與手持物同步；仍 NOT_FOUND 就標「待驗：dkbo-collect NOT_FOUND」（裁決⑦的兩分頁驗證因此待驗，結案 report 須明列），不得改連 `(default)` 或其他 DB。
- [ ] AC12 qa 驗收截圖：`?kitchenTier=desktop&kitchenNoDegrade=1` 截 1920×1080、960×540，`?kitchenTier=mobile` 截 844×390，每張標註對應 AC 與比對的 `variant-A-*`；spec §7 每一列（含 HUD 的新單、逾時）至少一組連拍；以 `?kitchenTier=desktop`（不帶 NoDegrade）驗自動降級；draw calls、fps、bundle 數字寫進 report。

## 同波成員
babylon(L) babylon-hud(M) qa(M)
