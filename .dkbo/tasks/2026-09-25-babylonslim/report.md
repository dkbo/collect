# Babylon 深層匯入瘦身 結案
結果：merged 9d3c976   分支：dk/babylonslim   波數：3（f9a5476、e69b7eb、e3028fa）

## 完成
- `vendor-babylon` 6,403.77 kB（gzip 1,408.85）→ **1,740.22 kB（gzip 398.32）**，build 無任何 chunk 警告；`chunkSizeWarningLimit: 1915`（全域生效，註解寫明）。
- 8 個檔改經集中模組 `@/babylon/babylonCore`（深層路徑 re-export＋本地 `MeshBuilder`），補副作用 `Culling/ray`、`particleSystemComponent`、`edgesRenderer`；無 `.pure`。
- eslint 禁 `@babylonjs/core` 整包匯入（含 type-only、動態 import）。
- **追加 AC7**：首頁／非 `/battle` 頁面不再下載 Babylon（master 過去每頁都 preload 6.4 MB）。根因：rolldown 分組遞迴收依賴，vite 的 `__vitePreload` helper 被 vendor-babylon 吸走；改 `codeSplitting.groups` 讓 helper 以 priority 1 獨立成 1.2 kB chunk。其他 vendor chunk 與 master 位元組相同。
- AC1–AC4、AC6、AC7 ✅；AC5 單人部分 ✅。

## 未完成 / 遺留
- **AC5 多人未驗**（兩 context 同步、對方位置同步、坦克結算／重開）：Firestore 具名 DB `dkbo-collect`（test-73ce3）回 gRPC NOT_FOUND，master 基準同樣掛。**請到 Firebase console 確認 DB**；恢復後起 5174 preview 跑 `node scripts/qa/babylonslim/mp.mjs http://localhost:5174/collect/ <out>` 補驗。
- **AC5 overcooked 上菜不可達**：master 既有 bug（`overcookedKitchen.ts:225`／`:191`，只能拿到焦湯），已進 BACKLOG。
- `scripts/qa/babylonslim/mp.mjs` 進了版控，是 brief「占位不得寫入」的例外（裁定保留）；從 `~/.npm/_npx` 找 playwright，機器相依。
- 三輪審查都只有 claude 一個 kind（codex、agy 熔斷），未達 `DK_REVIEW_MIN=2`；波 3 純驗收，審查 skip。
- 不修的 Minor：preload-helper 正則未錨定（vite.config.ts:71，實際只命中 `\0vite/preload-helper.js`）；priority 註解可補（vite.config.ts:67）；eslint 可被 `@babylonjs/core/index`、`Legacy/legacy` 繞過（eslint.config.js:24，已進 BACKLOG）。

## 驗證
- `DK_TEST_CMD` 三波皆綠：eslint、tsc、vitest 25 files／297 tests；`*.test.ts` 未改。
- qa（基準＝主樹 `docs/` 5173、改後＝worktree build 5174，同一支腳本）：四款單人觸發必經事件、race／bomber／overcooked 打到結算並再開一局，畫面並排一致，console／pageerror 皆 0；844×390 touch 搖桿可移動；首頁 network 基準載 6.4 MB Babylon、改後不載。截圖在 qa 的 scratchpad（`state/qa.report.md` 列路徑）。

## 自主裁定（待你複核）
1. 10:06 波 1 審查只派 claude（L）一個 kind — codex、agy 專案層熔斷 — 若錯：少一種模型視角
2. 10:12 審查 Important（首頁 preload Babylon，既有）併入本任務，新增 AC7、插入波 2、qa 順延波 3 — 你的原意是「看怎優化」 — 若錯：多一波（實際 10 分鐘）
3. 10:21 波 2 審查同樣只派 claude — 若錯：少一種模型視角
4. 10:22 AC7 以「不 import、不 preload」判過，index 內 Battle lazy 路由的 mapDeps 檔名字串不算 — 消掉要關 modulePreload 反讓 /battle 變慢 — 若錯：AC7 字面未達（qa network 實測首頁確實不下載）
5. 10:23 AC6：390×844 直向是既有「請轉橫向」遮罩，改以 844×390 橫向驗 touch — 若錯：直向那半條未驗
6. 10:30 park AC5 多人（Firestore DB NOT_FOUND，基準同掛）— 若錯：遠端玩家渲染缺副作用匯入未被抓到
7. 10:54 overcooked 上菜判「基準改後一致、不可達」，進 BACKLOG 不修 — brief 禁改遊戲邏輯 — 若錯：出餐渲染路徑未驗
8. 11:11 保留 qa 腳本 `scripts/qa/babylonslim/mp.mjs` 進版控 — 補驗多人唯一現成腳本 — 若錯：多一支未審腳本，可刪
9. 11:14 累積 Minor 全不修，eslint 繞過缺口進 BACKLOG（前提實測）— 若錯：日後經 `core/index` 整包匯入 eslint 不擋

## 重要決策
- 09:33 採納計畫審查 p1 四條必改（驗 production preview、必經事件打到結算、limit＝實測＋10%、拆 qa 波）
- 09:38 關卡① 使用者 ok
- 以上 9 條自主裁定

## 給下次的話（≤3 行）
- vite 8／rolldown 的 `manualChunks` 會把共用 helper 遞迴吸進大 vendor chunk，拆 vendor 後要檢查 `index.html` 的 modulepreload。
- /battle 相關任務開工前先探 Firestore DB 是否活著，別等到 qa 才發現。

## 時間
任務 2026-09-25-babylonslim
| 階段 | 開始 | 結束 | 時長 | dev | 審查 |
|---|---|---|---|---|---|
| 任務 | 2026-09-25T09:27 | 2026-09-25T13:46 | 259m | — | — |
| 計畫 | 2026-09-25T09:27 | 2026-09-25T09:38 | 11m | — | — |
| 波 1 | 2026-09-25T09:49 | 2026-09-25T10:13 | 24m | 17m | 5m |
| 波 2 | 2026-09-25T10:13 | 2026-09-25T10:23 | 10m | 7m | 1m |
| 波 3 | 2026-09-25T10:23 | 2026-09-25T11:11 | 48m | — | skip |
| 結案 | 2026-09-25T11:11 | 2026-09-25T13:46 | 155m | — | — |
