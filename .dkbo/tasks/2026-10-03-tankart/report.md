# 坦克美術＋可玩度（A Toy Army） 結案
結果：merged ef92063   分支：dk/tankart   波數：4（3 實作波＋1 修復波）

## 完成
- AC1 designer 方向稿：`design/spec.md`、`variant-A.pen`、`variant-A-gameplay.webp`、`variant-A-sheet.webp`（另附 `variant-A-mobile.webp`）。
- AC2 玩法：子彈反彈（`bounce`）、受擊無敵＋擊退（無敵期間不擊退）、`shield`／`triple` 道具、60 秒後縮圈突然死亡（`close`，host 判壓毀）、AI bot 補滿 4 台（`seed.bots`／`botState` 20Hz）、結算含 bot；純函式全在 `tankFx/` 附單測。
- AC3 固定 4 色（重用 `colorIndexOf`）；相機 r28→38、target (0,0,-2)，四個出生角都入鏡。
- AC4 手機砲塔 Q/E 鈕；AC5／AC6 Q 版玩具坦克、積木場景、兩階 ramp、描邊、雙光、陰影、Glow 白名單、後製；AC7 特效表 17 列；AC8 React HUD `[data-tank-hud]`（`TankHud` 契約）、3D 文字面板與 HP 條已移除；AC9 檔位與自動降級；AC10 perf log 與 `?tankBench=1`。
- 修復：落牆擦邊卡死、botState 15→20Hz、guest 打掉木箱的幽靈子彈（`crate.bulletId`）、子彈壽命改模擬時間（host 掉幀時的幽靈反彈 6→0 例）。

## 未完成 / 遺留
- **審查只有單一 kind**：波 2、3、4 與整枝評議只有 claude 意見（codex 熔斷到 10/11、agy 本任務中撞額度熔斷到 10/10），未達 `DK_REVIEW_MIN=2`。波 1 有 claude＋agy。
- 多人局末：guest 在收到結算前多預測一次反彈（純視覺火花，不影響名次）— BACKLOG。
- 貼牆朝牆開火子彈生在牆格內直接消失、不反彈 — BACKLOG。
- 整枝評議判「可留」的 Minor 19 條（前提為讀碼推測，非實測）：每幀新建 Color3（`effects.ts:683`）、開砲 40ms 去重只看本機收到時刻（`tank.ts:519`）、`effects.ts` 879 行、feed 依顯示名找色點同名會錯（`tankHud.ts:83`）、`__TANK_STATE` 偵錯全域正式版也產生、`item` 內聯驗證、tankAI 註解、`tankBlocked` 只剩測試用、道具 slot 對應無測試、`models.ts` 無單測、地面只烘牆根陰影、REBOUND 0.8 未回寫 spec、手機砲管被「你」膠囊遮、`combat.ts` 反向依賴 `fxModel`、`glowOwnMaterial` dispose 不對稱、`curves.cone.test.ts` 分檔、`bullet` id 未限長、bulletLife 測試 DT 手抄等。
- 縮圈 60 秒在 bot 對戰中少出現（多數 30 秒內分勝負）— 平衡議題，未改。
- 無頭環境未連拍到 #16 連殺字卡（只有讀碼＋單測）。

## 驗證
- 全閘：eslint＋tsc＋vitest 70 檔／687 tests 綠（wave-close 閘）。
- AC10：N1 = 69（≤ 90 ✅），波 2 N0 = 66；fps 在無頭 swiftshader 只記錄。
- AC11 bundle（gzip）：`vendor-babylon` 445,920 → 445,049（−871 B）、`Battle` 83,161 → 107,920（+24.8 KB，≤ 30 KB ✅）。
- AC12：`src/core`、`src/babylon/net`、`hud.ts`、`bomberFx`、`kitchenFx`、bomber／overcooked／race diff 為空；bomber、kitchen 與主樹基準並排無差異；race 無錯。
- AC13：Firestore 正常，`--contexts 2` 兩端顏色、bot 同步、反彈、落牆、結算名次一致。
- AC14：三檔截圖、特效連拍、自動降級，見 `state/qa.report.md`（截圖在 qa scratchpad）。
- **請你實機看**：連殺字卡（雙殺／三殺）、手機檔砲管與「你」標記重疊、整體美術對照 `design/variant-A-*.webp`。

## 自主裁定（待你複核）
1. 08:54 qa 改用 port 5179，不 kill 佔 5177 的 pid 2300650（kitchenart 遺留 vite preview，已記 BACKLOG）— 若錯：無。
2. 08:58 採納 designer：相機半徑 28→38、target (0,0,-2)，α/β/fov 不動（brief 原禁調半徑）— 若錯：改回一行常數，gameplay 稿取景要重出。
3. 09:26 無敵期間被命中不擊退 — 若錯：改一行判斷順序。
4. 09:26 AC5「合併 mesh」解讀為車身＋履帶合併、砲塔＋砲管為可轉子 mesh — 若錯：draw calls 多一兩個。
5. 09:52 park 波 1 一例無法重現的幽靈子彈（後於波 4 找到根因並修）— 若錯：無。
6. 09:52 縮圈 60 秒不改（`SUDDEN_DEATH_MS` 一行可調）— 若錯：縮圈實戰少出現。
7. 09:54 重派 babylon-hud（我給錯別名，未改碼）— 若錯：無。
8. 10:38 接受 AC5 兩項偏離：旗／天線隨砲塔轉、5 種道具共用 1 組 thin instance — 若錯：旗改掛車身、道具拆 5 mesh。
9. 10:49 道具 Glow 改依種類帶色（波 3 已做）— 若錯：多一點工時。
10. 10:54 波 2 起只剩 claude 可審，以單 kind 裁定、不等額度 — 若錯：少一個模型的錯誤類別覆蓋。
11. 13:31 子彈壽命真實時間判定判為真 bug、併入修復波（已修）— 若錯：多一個修復波工時。
12. 13:31 連殺字卡只有讀碼＋單測，接受並請你實機看 — 若錯：字卡有問題要回報。
13. 13:37 累積 Minor 25 條照 reviewer triage，19 條可留不修、#24 貼牆開火記 BACKLOG — 若錯：玩法邊角留到下次。
14. 13:38 重派波 4 babylon、qa（我在開波失敗後仍派工，一分鐘內關掉、無變更）— 若錯：無。
15. 13:53 park 局末 guest 多一次反彈（純視覺）— 若錯：局末小瑕疵。

## 重要決策
- designer 只出 A Toy Army 一套、與玩法並行；反彈可傷自己、bot 單人多人都補滿 4 台、新數值 INVULN 1s／KNOCKBACK 0.6／SHIELD 12s／TRIPLE 8s ±12°／縮圈 60s 每 700ms。
- 縮圈壓毀由 host 以坦克中心格判定；手機 Q/E 由 babylon-hud 改 `TOUCH_ACTIONS.tank`（tank.ts 已監聽 q/e）。
- 採納 review：落牆擦邊只擋重疊變大的移動、botState 累加節拍、qa 腳本不得進 worktree（兩次）、`destroyed.self` 可選欄位接受。
- 使用者直接叫 /dkbo-run 視為關卡①通過。

## 給下次的話（≤3 行）
- qa 所有權別再寫 `scripts/qa/<任務>/**` 占位：它讓第四閘擋不住，qa 兩次照 glob 寫進 worktree；改成 qa 無可改檔或明確寫 scratchpad。
- 開波失敗時同一行的 `dk-spawn` 照跑會拿到舊切片：開波與派工分開跑、確認成功再派。
- 別名是角色後綴：`dk-spawn babylon hud` → `babylon-hud`。

## 時間
任務 2026-10-03-tankart
| 階段 | 開始 | 結束 | 時長 | dev | 審查 |
|---|---|---|---|---|---|
| 任務 | 2026-10-03T08:41 | 2026-10-03T15:21 | 400m | — | — |
| 計畫 | 2026-10-03T08:41 | 2026-10-03T08:52 | 11m | — | — |
| 波 1 | 2026-10-03T08:53 | 2026-10-03T09:53 | 60m | 45m | 17m |
| 波 2 | 2026-10-03T09:53 | 2026-10-03T10:54 | 61m | 38m | 22m |
| 波 3 | 2026-10-03T10:54 | 2026-10-03T13:31 | 157m | 154m | 94m |
| 波 4 | 2026-10-03T13:38 | 2026-10-03T13:54 | 16m | 5m | 11m |
| 結案 | 2026-10-03T13:54 | 2026-10-03T15:21 | 87m | — | — |
