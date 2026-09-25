# reviewer-a 報告（波 task：整枝評議，b5e2b3c..e3028fa，12 檔）
## 做了什麼
讀 task.diff、brief、process.md 裁定、qa.report；在 worktree 獨立重跑 AC1 grep、eslint 紅綠（stdin，不寫檔）、`vite build --outDir <scratchpad>/dist`，並逐 chunk 對照主樹 docs（master build）。越界檢查：`package.json`、`pnpm-lock.yaml`、`docs/`、`src/core/`、`src/babylon/net/`、`firestore.rules`、`*.test.ts` 對 b5e2b3c 皆無 diff。

## 規格合規
- AC1 ✅ grep 輸出為空（exit 1）；src 內 `@babylonjs` 只剩 `src/babylon/babylonCore.ts` 的深層路徑（hud.ts:2 是註解文字）。
- AC2 ✅ eslint.config.js:23/26。實測：整包 value import、`import type`、`import('@babylonjs/core')` 三者皆 error（exit 1）；深層 `@babylonjs/core/scene` exit 0；附一句原因。
- AC3 ✅ vendor-babylon 6,403,753 B → 1,740,223 B（1,740.22 kB，gzip 398.32 kB），≤1,800 KB；build 無任何 chunk 警告、無 deprecation；`chunkSizeWarningLimit: 1915`（vite.config.ts:63，≈1,741×1.1）註解寫明只為 Babylon、全域生效；worktree `docs/` 無變更；無 `.pure`、副作用匯入（ray／particleSystemComponent／edgesRenderer）保留。
- AC4 ✅ waves/3.test.log：eslint＋tsc＋vitest 25 files／297 tests 全綠；`*.test.ts` 未改。
- AC5 ⚠️ 部分：單人四款 production 基準 vs 改後比對一致、console／pageerror 皆 0、無「needs to be imported」與 audio 錯誤（qa.report）。**未達**：兩 context 多人與位置同步（Firestore 具名 DB NOT_FOUND，基準同掛，10:30 裁定 park）；overcooked 上菜（master 既有 bug，10:54 裁定進 BACKLOG）；坦克結算／重開只能靠多人驗。結案 report 需明列這三項未驗，DB 恢復後以 scripts/qa/babylonslim/mp.mjs 補驗。
- AC6 ✅（依 10:23 裁定）HUD 兩種面板四款皆顯示；390×844 直向出既有轉橫遮罩（基準同），844×390 touch 拖搖桿有移動、0 錯誤。
- AC7 ✅（依 10:22 裁定）index.html modulepreload 只剩 rolldown-runtime／preload-helper／vendor-others／vendor-lucide／vendor-react；entry 與 vendor-react／vendor-others 無 `from"./vendor-babylon"`；`grep -l vendor-babylon` 字面仍命中 index-*.js，但只在 `__vite__mapDeps` 檔名字串（Battle lazy 路由用），qa network 實測首頁不下載。除新增 preload-helper（1,201 B）、index +39 B、Battle +179 B、Home +5 B 外，其他 23 個 chunk 大小與 master 位元組相同。

## Important
無。

## Minor
逐條判先前累積的 Minor（merge 前是否必修）：
- minor 1 chunkSizeWarningLimit 註解補「全域生效」 vite.config.ts:62 — 已修，關閉。
- minor 1 babylonCore 註解舉例 Mesh.CreateX 無關 src/babylon/babylonCore.ts:4-5 — 已修（改成 scene.pick／ParticleSystem／edges），關閉。
- minor 1 manualChunks 註解「僅 /battle（lazy）使用」 vite.config.ts:8 — 已修（改成「只有 Battle chunk 會 import」，與產物相符），關閉。
- minor 2 preload-helper test 正則未錨定 vite.config.ts:71 — 可留：實際 id 是 `\0vite/preload-helper.js`，不會誤中別的模組，錨定反而要處理 `\0` 前綴。
- minor 2 註解補「其他手動分組須低於 priority 1」 vite.config.ts:67-71 — 可留：目前只有兩組，現有註解已說明 helper 必須先認領。
結論：無必修項。

本輪新增：
- eslint 禁令可被 `@babylonjs/core/index`、`@babylonjs/core/Legacy/legacy` 繞過（兩檔都存在於 node_modules），同樣會拉進整包 eslint.config.js:24 — 可留；若要補就在 `paths` 加這兩個 name。
- scripts/qa/babylonslim/mp.mjs:1 進了版控，與 brief「`scripts/qa/babylonslim/**` 只是占位，不得寫入」字面不符；在 qa 所有權 glob 內、領導 11:11 已裁定保留（不進產物、eslint 過，腳本依賴的 `__BATTLE_POS`／`__BATTLE_PHASE`／data-testid 在 src 皆存在）。建議結案 report 註明這是 brief 例外；腳本從 `~/.npm/_npx` 找 playwright、機器相依，只能當本機補驗工具。

## 測試
### 紅
不適用: 審查波不寫測試；以下為獨立重驗的負向檢查
`echo "import { Scene } from '@babylonjs/core'; ..." | node_modules/.bin/eslint --stdin --stdin-filename src/babylon/zz.ts` → `error '@babylonjs/core' import is restricted ... no-restricted-imports`，exit 1（type-only 與動態 import 同樣 exit 1）
### 綠
`grep -rnE "from ['\"]@babylonjs/core['\"]|import\(['\"]@babylonjs/core['\"]\)" src` → 無輸出，exit 1；深層匯入 stdin eslint exit 0
`node_modules/.bin/vite build --outDir <scratchpad>/dist --emptyOutDir` → exit 0，vendor-babylon-DeqhOscI.js 1,740.22 kB │ gzip 398.32 kB，無警告；waves/3.test.log → Test Files 25 passed／Tests 297 passed

## 自我審查
- 驗證只寫 scratchpad；worktree `git status` 前後皆乾淨。
- AC5 多人未驗是外部環境，本輪 diff 未碰 net/core，但遠端玩家 mesh 走同一組 babylonCore 匯出，風險低、非零。

## 疑慮
- AC5 三項未驗需在結案 report 與 BACKLOG 可見，避免被當成已驗收。
