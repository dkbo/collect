# 廚房快手美術優化（A Toy Kitchen） 結案
結果：merged 1329443   分支：dk/kitchenart   波數：3

## 完成
- AC1 共用模組：bomberFx 通用部分抽到 `src/babylon/fx/`（toon／geometry／thin／thinSlots／burstQueue／perfLog／rig／upright 以 git mv，quality／look 參數化 key／tag／outline，countdown theme 共用）；bomber 網址參數與 `[bomber]` 前綴不變，vendor-babylon −1.2 KB、無重複打包。
- AC2 取湯修正：鍋上 soup 空手可直接取走；`overcookedKitchen.ts` 只改一處條件，新增 `overcookedKitchen.test.ts`（11 條）；實機出餐得分 20（base 同操作 0 分）。
- AC3 角色：`PLAYER_PALETTE` 依 `ctx.players` 序號固定 4 色（純函式＋單測）、白廚師帽＋圍裙、胸前手持、砍菜姿勢、「你」標記、upright 補償。
- AC4 場景：地面棋盤、背牆磁磚（KITCHEN 牌、時鐘、出餐暖光窗）、側牆、檯面 thin instance、食材箱／砧板／爐台鍋／出餐口／盤架、8 種物品合併 mesh；場外補深青底色。渲染 z 軸翻轉讓食材箱與出餐口在遠側靠背牆（見自主裁定）。
- AC5 材質光影：兩階 ramp、描邊、雙光、陰影（只玩家與手持物）、Glow 白名單（名單空時關層）、Pipeline（FXAA／ACES／bloom），kitchen 曝光 1.3。
- AC6 特效：切／煮／煮好／快焦（累加相位 2→6Hz 脈動）／焦煙／拾放弧線／出餐金星＋共用 +20 浮字；guest 外插、訂單 id 穩定化、消失原因判定皆純函式＋單測。
- AC7 HUD：`KitchenHud` 型別與 `setHud` 聯集，`[data-kitchen-hud]` 訂單卡／計時分數／玩家卡／食譜／手機精簡版；舊 4 塊 3D 面板移除，倒數改共用 theme 並掛 UI 相機；bomber HUD 不變。
- AC8 檔位與降級：`?kitchenTier`／`?kitchenNoDegrade`、`[kitchen] tier`／`[kitchen] degrade outline→glow→shadow` 皆驗過。
- AC9 效能：N1=78（含最壞快焦狀態）；d 讀碼推算 3 → 87 ≤ 90（見遺留）。
- AC10 bundle：vendor-babylon −1221 B、Battle-*.js +16331 B（gzip），均在門檻內。
- AC11 零回歸：DK_TEST_CMD 綠（54 檔、514 測試）；`src/core`、`src/babylon/net`、`src/babylon/hud.ts` diff 為空；bomber 並排截圖一致，tank、race 無錯、無兩個 HUD 節點。
- AC12 截圖：1920×1080、960×540、844×390 與 §7 連拍、自動降級，見 `state/qa.report.md`（截圖在 qa scratchpad `/tmp/claude-1000/-home-bal-project-collect--worktrees-kitchenart/902f80d4-f1fa-4c2a-9a35-92957d042cd8/scratchpad`）。

## 未完成 / 遺留
- **待驗：dkbo-collect NOT_FOUND**：多人兩端顏色與手持物同步、裁決⑦兩分頁驗證、AC9 的 d 實測都未驗（qa 未改連其他 DB）。
- **待驗：實機目視**：砍菜動作與朝向、拾取弧線、砧板回彈與碎片、火苗蒸氣細節（swiftshader 1920 約 2fps，拍不清）。
- **AC9 上限**：d=3 照定義過；但 4 人各持不同 `kind×ing` 手持物時每多一種約 +3 draw call，最壞約 96（`kitchenFx/board.ts:420`，讀碼推算）。
- **食譜蓋鍋（qa 實測）**：1920×1080 預設展開的食譜蓋住 (10,2) 鍋進度環與「!」一角，可按 R 收合；brief 明文預設展開，交你決定。
- **手機浮動導覽列**：非全螢幕時 `.floating-header` 蓋 HUD 頂列（bomber 既有，`src/components` 不在範圍），建議記 BACKLOG。
- `?kitchenPerfFill=1`：AC9 量測用偵錯參數，保留在 production（只改本機畫面）。
- 審查全程只有 claude 一種 kind（codex、agy 專案層熔斷），DK_REVIEW_MIN=2 未滿足；每波與整枝評議均已審。
- 整枝評議判「可留」的 Minor（20 條，前提皆為讀碼）：
  - perfLog.ts 判成刪除＋新增 `src/babylon/fx/perfLog.ts:1`
  - burnt 的 isReady 冗餘、tick 前 ≤1 幀可取到 soup `src/babylon/games/overcookedKitchen.ts:192`
  - 連續兩個空行 `src/babylon/games/overcooked.ts:174`
  - kitchenRoster 以 i % len 重算 `src/babylon/games/kitchenFx/players.ts:23`
  - R 鍵未排除輸入框焦點 `src/pages/Battle/KitchenHud.tsx:329`
  - `export default KitchenHud` 無人用 `src/pages/Battle/KitchenHud.tsx:350`
  - fx 預設 key/tag 為 bomber `src/babylon/fx/quality.ts:35`
  - setSlot 每幀重寫 matrix `src/babylon/games/kitchenFx/board.ts:323`
  - 手上有物也轉向砧板 `src/babylon/games/overcooked.ts:201`
  - kitchenPerfFill 進 production `src/babylon/games/overcooked.ts:368`
  - 砧板尺寸為 spec 兩倍（qa 對稿目視可）`src/babylon/games/kitchenFx/models.ts:51`
  - 盤架格寫死座標 `src/babylon/games/kitchenFx/board.ts:144`
  - 「!」位置寫死 −x `src/babylon/games/kitchenFx/effects.ts:239`
  - squashBoard 每幀整批重寫 `src/babylon/games/kitchenFx/board.ts:397`
  - bomberFx/textures 再轉出 `src/babylon/games/bomberFx/textures.ts:10`
  - kitchenFx/board 兩行 import `src/babylon/games/overcooked.ts:46`
  - served()／landRing() 自取 performance.now `src/babylon/games/kitchenFx/effects.ts:355`
  - 兩批 gone 600ms 內接連槽位差一格 `src/pages/Battle/kitchenHud.ts:106`
  - guest 開局前幾幀閃上一局 HUD `src/babylon/games/overcooked.ts:695`
  - orderTrack 跨局未歸零（刻意，缺註解）`src/babylon/games/overcooked.ts:698`

## 驗證
- 每波 `dk-wave-close` 四道閘全過（commit 9492a12、bf4c291、45239fe）；DK_TEST_CMD：eslint 0、tsc 0、vitest 514 綠。
- 審查：波 1 Important 1（qa 越界寫檔，已修）、波 2 Important 1（盤架穿模，已修並複看）、波 3 Important 1（快焦脈動亂閃，已修並複看）＋qa BUG-1（出餐台箭頭反向，已修並二次複看）；整枝評議 Important 0。
- qa：production preview 單人跑 overcooked 完整一局、bomber 並排零回歸、tank／race 無錯；bundle 以 git archive base 對照。
- 可看畫面：qa 的 worktree preview 仍開在 `http://localhost:5177/collect/`（波 3 最終碼），建議 `#/battle` 加 `?kitchenTier=desktop&kitchenNoDegrade=1`。

## 自主裁定（待你複核）
1. 08:46 qa 驗收 port 改 5177，不 kill 5174 上 bomberart 遺留的 preview（pid 283362）；5176 沿用主樹 docs preview — 若錯：遺留進程持續佔 5174，需你自行清。
2. 09:02 波 1（及後續各波）只以 claude 一位 reviewer 裁定，DK_REVIEW_MIN=2 不滿足 — 若錯：少了第二模型視角。
3. 09:16 brief 波 2 列補「明傳 key/tag kitchen、自查 5175」與 qa「腳本只放 scratchpad、驗 [kitchen] 前綴」（所有權表下方說明不進切片）— 若錯：無。
4. 09:19 版面採 A：渲染 z 軸翻轉，cy=0（食材箱／出餐口）在遠側靠背牆，符合稿；只動 overcooked.ts 渲染／輸入換算 — 若錯：操作或朝向顛倒（qa 已驗 WASD 一致），改回一個換算函式即可。
5. 10:46 構圖只佔畫面 55% 照裁決⑩不調相機，改補場外深青底色 — 若錯：你仍覺空，另議相機。
6. 10:46 `?kitchenPerfFill=1` 保留到波 3 重量 N1 — 若錯：多一個偵錯參數。
7. 10:46 畫面偏灰與砍菜目視併入波 3 — 若錯：仍灰則開修復波（qa 波 3 判已提亮、未過曝）。
8. 11:33 手機 `.floating-header` 蓋 HUD 頂列不在本任務修 — 若錯：手機非全螢幕時頂列被遮。
9. 12:08 食譜面板預設展開蓋 (10,2) 鍋一角，照 brief 不改、park — 若錯：快焦提示被遮一角。
10. 12:14 累積 Minor 20 條照 triage 不修 — 若錯：你指定哪條就開修復波。
11. 12:14 AC9 照定義判過（87 ≤ 90），照實記最壞約 96 — 若錯：4 人異持時超 90，屆時合併手持群組。
12. 12:14 `?kitchenPerfFill=1` 保留進 production — 若錯：多一個偵錯參數。

## 重要決策
- 08:32 訂單消失原因由 babylon 以純函式比對快照產出 `KitchenHud.gone`，不改 KitchenView。
- 08:32 計畫審查只派 claude 一位（codex、agy 熔斷）。
- 09:02 採納波 1 Important：qa 腳本移出 `scripts/qa/kitchenart/`。
- 09:57 採納波 2 Important：盤架格物品墊高 `PLATE_STACK_H`。
- 11:38 採納波 3 Important：快焦脈動改累加相位＋單測，順修 GlowLayer 空白名單。
- 其餘見「自主裁定」。

## 給下次的話（≤3 行）
- brief 所有權表下方的說明段不會進切片，員工必須遵守的約束要寫進波次表該列或全域約束。
- swiftshader 截不到短時特效與動作，下次視覺任務的 qa 應預設錄影抽幀或縮小視窗，並在 AC 標明「實機目視」項。
- dkbo-collect NOT_FOUND 已連兩個任務擋住多人驗證，應優先修。

## 時間
任務 2026-09-26-kitchenart
| 階段 | 開始 | 結束 | 時長 | dev | 審查 |
|---|---|---|---|---|---|
| 任務 | 2026-09-26T08:26 | 2026-09-26T12:16 | 230m | — | — |
| 計畫 | 2026-09-26T08:26 | 2026-09-26T08:35 | 9m | — | — |
| 波 1 | 2026-09-26T08:42 | 2026-09-26T09:16 | 34m | 15m | 18m |
| 波 2 | 2026-09-26T09:16 | 2026-09-26T10:51 | 95m | 44m | 12m |
| 波 3 | 2026-09-26T10:51 | 2026-09-26T12:08 | 77m | 63m | 22m |
| 結案 | 2026-09-26T12:08 | 2026-09-26T12:16 | 8m | — | — |
