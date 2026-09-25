# Babylon 深層匯入瘦身 — 給 qa 的切片（波 3）
由 dk-wave-open 產生，只讀。完整 brief 在 /home/bal/project/collect/.dkbo/tasks/2026-09-25-babylonslim/brief.md。

## 目標
把 Babylon 從 `@babylonjs/core` 整包匯入改成深層路徑匯入，讓 `vendor-babylon` chunk 從約 6.4 MB 降到 1.8 MB 以下（實驗值 1.59 MB）。
四款遊戲（tank、race、bomber、overcooked）的畫面、音效、操作與多人同步行為完全不變；剩下的 500 kB 警告以 `chunkSizeWarningLimit` 蓋過並註明原因。

## 全域約束（全文）
- 路徑一律用 `@/*` 別名，不得用相對路徑引入。
- 不用 `@babylonjs/*/**/*.pure` 版本（會拿掉副作用註冊）；需要的副作用模組以 `import '@babylonjs/core/…'` 明確補上。
- 不升降任何套件版本、不新增依賴（`package.json`、`pnpm-lock.yaml` 不改）。
- 不動多人同步協定與 `src/core/`、`src/babylon/net/**`、`firestore.rules`（net 只讀；本任務只改匯入，不改邏輯）。
- 遊戲邏輯、數值、畫面不改；純邏輯 vitest（`src/babylon/**/*.test.ts`）全部保持綠，不得為了過測試改測試。

## 你的波次
| 波 | 型態 | 成員 | 做什麼 | 難度 | 完成條件 | 審查 |
|---|---|---|---|---|---|---|
| 3 | 驗收 | qa | 主樹 `vite preview --outDir docs --port 5173` 截四款基準（兩個 context），截完關掉；worktree `vite build --outDir <scratchpad>/dist` ＋ `vite preview --port 5174` 截改後並逐款比對 | M | AC5、AC6、AC7（首頁 network 無 vendor-babylon、非 /battle 頁面無 console 錯誤）逐條有截圖與 console 判定 | skip: 純驗收波、無程式變更 |

## 倉庫
/home/bal/project/collect/.worktrees/babylonslim
編輯一律用上面的 worktree 路徑；$DK_ROOT 指向主樹的 .dkbo/，只拿來跑 dk-msg 等 bin，不得當編輯路徑

## 你的檔案所有權
| 成員 | 可改 | 只讀 |
|---|---|---|
| qa | scripts/qa/babylonslim/** | ** |

## 共用契約（全文）
| 契約 | 擁有者 | 消費者 | 形狀／簽名 | 變更流程 |
|---|---|---|---|---|

## 驗收標準（全文）
- [ ] AC1 `src/` 內沒有任何 `@babylonjs/core` 整包匯入（含 `import type` 與動態 import），只剩深層路徑：`grep -rnE "from ['\"]@babylonjs/core['\"]|import\(['\"]@babylonjs/core['\"]\)" src` 輸出為空。
- [ ] AC2 防回歸：`eslint.config.js` 以 `no-restricted-imports` 禁止 `@babylonjs/core` 整包匯入（深層路徑允許、type-only 也禁），並附一句原因；故意寫一行整包匯入時 eslint 報錯（report 附紅／綠兩次輸出）。
- [ ] AC3 `node_modules/.bin/vite build --outDir <自己的 scratchpad>/dist --emptyOutDir` 成功（不要跑 `pnpm build`：它寫 `docs/`，worktree 的 diff 會越界；vite 印「outDir is not inside project root」屬正常）；產物 `assets/vendor-babylon-*.js` ≤ 1,800 KB（minified），report 附改前改後大小與 gzip；超過門檻就 ESCALATE，不得以 `.pure` 或拿掉副作用匯入湊數。`vite.config.ts` 設 `chunkSizeWarningLimit` 為 babylon 實測值再加約 10%，註解寫明只為 Babylon 核心無法再切小；build 輸出不再有 `vendor-babylon` 的 500 kB 警告，其他 chunk 若仍有警告照列在 report、不算失敗。`docs/` 在 worktree 內必須保持無變更。
- [ ] AC4 `DK_TEST_CMD`（eslint＋tsc＋vitest）全綠，`src/babylon/**/*.test.ts` 未被修改。
- [ ] AC5 執行期零回歸（驗 production 產物，dev server 只作輔助）：基準用主樹現有 `docs/`（master 的 build）以 `node_modules/.bin/vite preview --outDir docs --port 5173 --strictPort` 服務；改後用 worktree 的 `vite build --outDir <scratchpad>/dist` 再 `vite preview --outDir <scratchpad>/dist --port 5174 --strictPort`；網址照舊帶 `/collect/`。四款遊戲各以 `--contexts 2 --dns` 兩位玩家進 `/battle` 開局，並觸發各自的必經事件：tank 射擊命中、bomber 炸彈爆炸炸箱、race 過終點（或至少跑完一圈）、overcooked 完成一次上菜；每款打到一次回合結束或結算畫面並再開一局。兩個 context 的 `consoleErrors`／`pageErrors` 皆為空（特別是 Babylon「needs to be imported」類錯誤）；畫面與基準並排比對無差異（模型、材質、DynamicTexture 文字、粒子、光照、相機）；另一位玩家的位置有同步。音效只以「無 AudioEngine／audio 類 console 錯誤」判定。若 `/battle` 有路徑能進 `placeholderScene`，一併截一張。
- [ ] AC6 觸控與 HUD：`hud.ts` 的文字面板、倒數面板在四款遊戲都正常顯示；390×844 手機尺寸下 `/battle` 能進一款遊戲，以 touch 事件操作一次移動，且無 console 錯誤。
- [ ] AC7（波 1 審查後追加，見 ruling）首頁與非 `/battle` 路由不再預載／執行 Babylon：`vite build --outDir <scratchpad>/dist` 產物的 `index.html` 不含任何 `vendor-babylon` 的 `modulepreload`，entry chunk 與 `vendor-react-*` 等非 Battle chunk 不 `import` vendor-babylon（`grep -l vendor-babylon <dist>/assets/*.js` 只剩 Battle 相關 chunk 與它自己）；`/battle` 進遊戲仍正常載入 Babylon；`vendor-babylon` 仍 ≤ 1,800 KB、build 無 vendor-babylon 的 500 kB 警告；其他 chunk 的歸屬與大小變化列在 report。只改 `vite.config.ts`（不改套件、不動 net/core）；在 vite.config 範圍內做不到就 ESCALATE（不硬湊）。

## 同波成員
qa(M)
