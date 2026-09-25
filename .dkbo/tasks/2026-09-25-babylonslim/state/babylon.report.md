# babylon 報告（波 2）
## 做了什麼
- **根因**：rolldown 的分組預設 `includeDependenciesRecursively: true`，會把被認領模組的依賴一併收進同一 chunk。Babylon 內部有動態 import（shader 等），vite 為此注入 `\0vite/preload-helper.js`（`__vitePreload`），它就成了 Babylon 模組的依賴；`manualChunks` 在 rolldown 下被轉成「單一 name 函式 group」，所有名字同優先度，helper 被 vendor-babylon 先遞迴吃掉。entry／Home／vendor-react 都需要 `__vitePreload` → 全部 `import{b}from"./vendor-babylon-…"` → index.html 每頁都 modulepreload 1.74 MB Babylon。reviewer「另指 manualChunks 分組仍併回」同理：同一個 name 函式內無法給優先度。
- **修法**（`vite.config.ts`，只改這檔的打包設定）：`manualChunks` 改為 `codeSplitting.groups`（rolldown 1.0 正式選項，manualChunks 已 deprecated）：
  1. `{ name: 'preload-helper', test: /vite\/preload-helper/, priority: 1 }` 先認領 helper（獨立 1.20 kB chunk，gzip 0.68 kB）；
  2. `{ name: vendorChunk }`：原 manualChunks 本體原封不動抽成頂層函式 `vendorChunk(id)`（判斷順序與字串全不變，只多結尾 `return null`）。
- Minor 三條：`chunkSizeWarningLimit` 註解補「此值全域生效，其他 chunk 也一併放寬」；Babylon 分組註解改成「只有 /battle 路由（lazy）的 Battle chunk 會 import」（與產物相符）；`babylonCore.ts:4` 註解改舉 scene 元件／engine extension，並點明下方明確補的 Ray（scene.pick）、ParticleSystem scene 元件、edges renderer。

## AC7：index.html preload 清單
| 改前（`$S/before`） | 改後（`$S/after`） |
|---|---|
| rolldown-runtime | rolldown-runtime |
| **vendor-babylon-CPSiUWY8.js** | preload-helper-BZAAiznX.js |
| vendor-others | vendor-others |
| vendor-lucide | vendor-lucide |
| vendor-react | vendor-react |

- 改前 `import … from "./vendor-babylon"` 的 chunk：index、Home、vendor-react、Battle → 改後**只剩 Battle**（`grep -lE 'from"\./vendor-babylon' assets/*.js`）。
- `grep -l vendor-babylon assets/*.js` 改後為 `Battle-*.js`、`index-*.js`：index 那筆只是 lazy 路由的 `__vite__mapDeps` 檔名字串（使用者進 /battle 時才用來預載 Battle 的依賴），不是 import、不會在首頁下載；改前改後都有、屬 lazy route 機制本身。瀏覽器實測見下。

## chunk 表（`vite build --outDir <scratchpad>`）
| chunk | 改前 | 改後 |
|---|---|---|
| vendor-babylon | 1,741.39 kB（gzip 398.79） | **1,740.22 kB（gzip 398.32）**（少了 helper） |
| preload-helper | — | 1.20 kB（gzip 0.68）新增 |
| index（entry） | 20.78 kB | 20.82 kB |
| vendor-react | 277.25 kB（cu-htXiW） | 277.25 kB（hash 變 DoRFf5v_：import 來源改指 preload-helper） |
| Battle | 149.00 kB | 149.00 kB（gzip 47.99→48.01） |
| vendor-syntax／vendor-others／vendor-lucide／vendor-firebase／rolldown-runtime | 42.77／71.24／24.93／349.43／0.69 kB | 同大小、**同 hash** |
- build exit 0，輸出無任何 chunk size 警告；`git status --short docs` 空。

## 測試
### 紅
`node_modules/.bin/vite build --outDir $S/before --emptyOutDir && grep -o 'modulepreload[^>]*' $S/before/index.html | grep vendor-babylon; grep -lE 'from"\./vendor-babylon' $S/before/assets/*.js`
→ `modulepreload crossorigin href="/collect/assets/vendor-babylon-CPSiUWY8.js"`；import 者：`index-2eZOzINe.js`、`Home-gEEARGQO.js`、`vendor-react-cu-htXiW.js`、`Battle-DSbdTd2o.js`（AC7 不過）
### 綠
同一條指令（`$S/after`）→ modulepreload 無 vendor-babylon（grep 空）；import 者只剩 `Battle-DiW6NRxI.js`
全套：`node_modules/.bin/eslint .` → exit 0；`node_modules/.bin/tsc -b --noEmit` → exit 0；`node_modules/.bin/vitest run` → `Test Files 25 passed (25) / Tests 297 passed (297)`；AC1 grep 0 行；`src/**/*.test.ts` 無 diff
### 執行期自查（`vite preview --outDir $S/after --port 5174 --strictPort`，用完已關）
- 網路（`$S/net.mjs`，桌面 1280×800）：`#/` 初次載入請求 index、rolldown-runtime、preload-helper、vendor-others／lucide／react、Home 等，**無 vendor-babylon**；接著 `#/todos`、`#/resume`、`#/search` 也無；進 `#/battle` 大廳才請求 vendor-babylon，選 tank 單人進 `playing`；全程 console error／pageerror 空。
- 四款單人（`$S/solo.mjs`，沿用波 1 腳本）：tank／race／bomber／overcooked 皆進 `playing`，射擊、爆炸、互動、指標 pick 皆跑，console error 與 pageErrors 空（shader 動態 import 經新 helper chunk 正常）。
- 觸控 844×390 tank：搖桿拖曳後 `__BATTLE_POS` -13,-13 → -6.7,-9.7，pageErrors 空；console 只有 swiftshader `GPU stall due to ReadPixels` 效能 warning（波 1 基準同樣有）。

## 自我審查
- 排除：`includeDependenciesRecursively: false`（實驗 `$S/exp-recursive-off`）雖也拿掉 babylon preload，但 vendor-syntax 被拉進首頁 preload、多 chunk hash 改變，且官方建議需搭配 strictExecutionOrder 等 → 不採。
- 採用 priority 方案（實驗 `$S/exp-prio` 與最終 build 產物 hash 相同）：只移動 helper 一個模組，其餘 vendor chunk 同 hash。
- 範圍：只動 `vite.config.ts`、`src/babylon/babylonCore.ts`（註解）；未碰套件、net、core。`vendorChunk` 本體逐行未改，只去掉一層縮排並補 `return null`。
- `rollupOptions.output.codeSplitting` 在 vite 8 下 tsc 型別通過、build 實際生效（產物證明）。

## 疑慮
- AC7 字面「`grep -l vendor-babylon` 只剩 Battle 相關 chunk 與它自己」：index 仍因 lazy 路由的 mapDeps 字串命中（非 import、不下載），請 reviewer／領導按「不 import、不 preload」判定；要連字串都消掉只能關掉 lazy route 的依賴預載（`build.modulePreload`），會讓進 /battle 變慢，未做。
- 多了一個 1.2 kB 的 preload-helper chunk（首頁多一個 preload 請求，換掉原本 1.74 MB）。
- 未做多人／結算（AC5）：屬後續 qa 波。

---

# babylon 報告（波 1）
## 做了什麼
- 新增 `src/babylon/babylonCore.ts`：Babylon 集中匯入點，全部走深層路徑（Engine、Scene、ArcRotateCamera、Camera(type)、HemisphericLight、Color3/4、Vector3、Mesh、StandardMaterial、Texture、DynamicTexture、ParticleSystem），並提供本地 `MeshBuilder = { CreateBox, CreateCylinder, CreateDisc, CreateGround, CreatePlane, CreateSphere, CreateTorus }`，112 處呼叫不必改。非 `.pure` 模組。
- 明確補副作用：`Culling/ray`（指標／觸控移動時 InputManager 的 scene.pick）、`Particles/particleSystemComponent`、`Rendering/edgesRenderer`（enableEdgesRendering）。DynamicTexture 的 engine extension 由非 pure 模組自帶。
- 8 個檔（types.ts、hud.ts、placeholderScene/tank/race/bomber/overcooked.ts、BabylonCanvas.tsx）只改 `from '@babylonjs/core'` → `from '@/babylon/babylonCore'`，其他零變更。
- `eslint.config.js`：`no-restricted-imports` 禁 `@babylonjs/core` 整包（含 `import type`；深層路徑放行），另加 `no-restricted-syntax` 擋 `import('@babylonjs/core')`，註明原因。
- `vite.config.ts`：
  - `chunkSizeWarningLimit: 1915`（實測 1,741 kB +10%，註明只為 Babylon 核心）。
  - **manualChunks 的 `@babylonjs` 判斷移到最前面**：深層匯入後 `Shaders/default.vertex.js`／`default.fragment.js` 會命中下方 vendor-syntax 規則的 `'fault'` 子字串，被誤歸 vendor-syntax（42.77→93.27 kB，Home 的語法高亮 chunk 會夾帶 Babylon shader）。移動後 vendor-syntax 回到與基準同 hash（`eXkUiqnn`、42.77 kB）。

## 大小對照（`vite build --outDir <scratchpad>/dist`）
| chunk | 改前 | 改後 |
|---|---|---|
| vendor-babylon | 6,403.77 kB（gzip 1,408.85 kB） | **1,741.39 kB（gzip 398.79 kB）** |
| vendor-syntax | 42.77 kB | 42.77 kB（同 hash） |
| Battle | 148.82 kB | 149.00 kB |
- 改後 build 輸出無任何 500 kB／chunk size 警告（其他 chunk 也沒有）。`docs/` 在 worktree 無變更（`git status --short docs` 空）。
- 註：與實驗值 1.59 MB 的差約 150 kB 是 default shader 併回 vendor-babylon（改前實驗很可能是被誤歸 vendor-syntax 了）。仍 ≤ 1,800 KB。

## 測試
### 紅
`printf "import { Vector3 } from '@babylonjs/core'\nimport type { Scene } from '@babylonjs/core'\n…import('@babylonjs/core')" | node_modules/.bin/eslint --stdin --stdin-filename src/babylon/probe.ts`
輸出空、`exit=0`（加規則前，整包匯入／type-only／動態 import 都沒被擋）
### 綠
同一條指令：
`1:1 error '@babylonjs/core' import is restricted … no-restricted-imports`、`2:1 error … no-restricted-imports`（type-only）、`5:27 error … no-restricted-syntax`（動態 import）→ `✖ 3 problems (3 errors)`、`exit=1`
深層路徑對照：`import { Vector3 } from '@babylonjs/core/Maths/math.vector'` → `exit=0`
### 全套與 AC
- `node_modules/.bin/eslint .` → exit 0；`node_modules/.bin/tsc -b --noEmit` → exit 0；`node_modules/.bin/vitest run` → `Test Files 25 passed (25) / Tests 297 passed (297)`
- AC1 grep（brief 原式）→ 輸出空；`src/**/*.test.ts` 無 diff；`src` 內無 `.pure` 匯入（只有註解字樣）
- AC3 build exit 0，數據見上表
### 執行期自查（`vite preview --outDir <scratchpad>/dist --port 5174`，單人模式；腳本 `<scratchpad>/solo.mjs`）
- 桌面 1280×800 四款各開一局：過倒數進 `playing`，滑鼠在 canvas 移動＋拖曳（走 scene.pick）、tank 前進＋連射、race 油門＋轉向、bomber 放炸彈等爆（炸箱、粒子、自己被炸死出「你已陣亡／重新開始」）、overcooked 移動＋E 互動。四款 `pageErrors` 空、`consoleErrors` 空（tank 只有 swiftshader 的 `GPU stall due to ReadPixels` GL 效能 warning，**基準同樣出現**），無「needs to be imported」、無 audio 類錯誤。
- 觸控 844×390（hasTouch＋isMobile，pointer: coarse）四款：CDP touch 拖搖桿後 `__BATTLE_POS` 皆有位移（tank -13,-13→-6.7,-9.7；race、bomber、overcooked 同樣移動），零錯誤。390×844 直向會顯示「請將手機轉為橫向」遮罩（既有行為，基準同）。
- 並排比對：同一腳本跑基準產物（改前 worktree build 的 `dist-before`，也在 5174）→ 四款模型、材質、光照、相機、DynamicTexture 文字（HUD、訂單、食譜、race 小地圖）一致；差異只來自隨機地圖／AI 狀態。圖在 `<scratchpad>/cmp-tank-race.jpg`、`cmp-bomber-oc.jpg`。

## 自我審查
- 範圍：只動所有權內檔案；net/core/package.json 未碰；邏輯與數值零變更（8 檔 diff 各 1 行）。
- 副作用盤點依據：逐一查 API 用法（ParticleSystem、enableEdgesRendering、DynamicTexture、ArcRotateCamera.attachControl、canvas 指標）。未用到 Animation、Sound、GlowLayer、pick 以外的 Ray 功能。
- 腳本與截圖只寫 scratchpad；preview 只用 5174，用完已關。

## 疑慮
- 未做兩位玩家的多人（`--contexts 2`）與「打到結算再開一局」、tank 命中／race 過終點／overcooked 上菜這類特定事件：單人模式下只觸發到射擊、爆炸炸箱、移動互動。AC5 的完整多人判定留給波 2 qa。
- 基準截圖是 worktree 改前自建的 `dist-before`（不是主樹 `docs/`），因 5173 屬 qa 獨佔。
- vite.config.ts 的 manualChunks 順序調整超出「只改匯入」字面，但屬本檔所有權、純打包歸屬修正，不影響執行邏輯；請 reviewer 留意。
