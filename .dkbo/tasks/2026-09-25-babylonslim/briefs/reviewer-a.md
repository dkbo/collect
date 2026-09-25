# Babylon 深層匯入瘦身 — 波 task 審查（reviewer 切片）
你是本波的 reviewer：只讀、不改碼、不跑會寫入的指令。意見只給領導（`dk-msg leader`），不直接對 dev 說。

## 要讀的
1. 差異包 /home/bal/project/collect/.dkbo/tasks/2026-09-25-babylonslim/waves/task.diff（commit 清單、stat、-U10 diff；含未 commit 的工作樹）
2. 完整 brief /home/bal/project/collect/.dkbo/tasks/2026-09-25-babylonslim/brief.md（驗收標準、共用契約、所有權）
3. 本波成員：

## 全域約束（全文，逐條當硬要求檢查）
- 路徑一律用 `@/*` 別名，不得用相對路徑引入。
- 不用 `@babylonjs/*/**/*.pure` 版本（會拿掉副作用註冊）；需要的副作用模組以 `import '@babylonjs/core/…'` 明確補上。
- 不升降任何套件版本、不新增依賴（`package.json`、`pnpm-lock.yaml` 不改）。
- 不動多人同步協定與 `src/core/`、`src/babylon/net/**`、`firestore.rules`（net 只讀；本任務只改匯入，不改邏輯）。
- 遊戲邏輯、數值、畫面不改；純邏輯 vitest（`src/babylon/**/*.test.ts`）全部保持綠，不得為了過測試改測試。

## 本任務累積的 Minor
- minor 1: chunkSizeWarningLimit 為全域設定，註解應補「全域生效」 vite.config.ts:16
- minor 1: babylonCore 註解舉例 Mesh.CreateX 與實際用法無關 src/babylon/babylonCore.ts:4
- minor 1: manualChunks 註解「僅 /battle（lazy）使用」與產物不符 vite.config.ts:21
- minor 2: preload-helper group 的 test 正則未錨定 vite.config.ts:63
- minor 2: 註解可補「其他手動分組須低於 priority 1」 vite.config.ts:60

上面每一條是先前各波放掉的風格／可讀性意見。逐條判：哪些**必須**在 merge 前修掉、
哪些可以留著。判定寫進報告的 `## Minor` 段開頭，一條一行。

## 報告寫到 /home/bal/project/collect/.dkbo/tasks/2026-09-25-babylonslim/state/reviewer-a.report.md，格式固定
## 規格合規
（逐條驗收標準 ✅/❌，缺漏寫明）
## Important
（會出錯、違反 brief 或契約、越界改檔；每條附 file:line）
## Minor
（風格、可讀性；每條附 file:line）

## 完成
state 檔 `status: done`，然後 `dk-msg leader "[DONE] review 波 task: Important N 條，見 report"`。
