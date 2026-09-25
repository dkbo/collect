# reviewer-p1 報告（計畫審查 brief-review）
## 做了什麼
讀 request.md 與 brief.md，逐段對照；另以唯讀 grep 確認所有權覆蓋與 vite.config 現況（未改任何檔）。

## 需求覆蓋
- ✅ 深層路徑取代整包匯入（request 領導分析列）→ 目標、AC1、AC2。
- ✅ 不用 `.pure`（request 實驗結論第 2 點）→ 全域約束第 2 條。
- ✅ `chunkSizeWarningLimit` 並註明原因（request 實驗結論第 3 點）→ AC3。
- ✅ 範圍 8 個檔、112 處呼叫（request 範圍段）→ 波 1 babylon 列；grep 確認 8 個檔（games/bomber、overcooked、placeholderScene、race、tank、hud.ts、types.ts、BabylonCanvas.tsx）全在 babylon 可改 glob 內，無一在 `net/`。
- ✅ 四款遊戲進 `/battle` 實跑＋多人同步、qa 兩個 context（request 風險段、建議段）→ AC5、波 1 qa 列。
- ❌ **request 風險段講的是「build 會過、要進遊戲才報錯」——風險在打包後的產物（tree-shake 後少了副作用模組），但 AC5／qa 列驗的是 `pnpm dev`（主樹 5173、worktree 5174）。** dev server 不做 tree-shake、還會用 optimizeDeps 預打包，缺副作用模組在 dev 可能不重現、在 build 才炸；等於本任務唯一的執行期風險沒有被驗到。→ 必改 1（見下段改寫）。

## 驗收標準可驗證性
- AC1 ✅ 可判定。（小缺口見 Minor）
- AC2 ✅ 可判定（紅／綠兩次輸出）。
- AC3 ❌ 「build 不再出現 500 kB 警告」在 worktree 內可能**無法達成或判定分歧**：request 註明 vendor-syntax 的 `CodeSnippet.tsx` 修正（885 KB → 42.8 KB）**尚未 commit**，worktree 從 master HEAD 切出，裡面的 vendor-syntax 仍是 885 KB。若 babylon 選「只對 babylon chunk 的等效設定」，vendor-syntax 仍會觸發 500 kB 警告 → AC3 不過；若設全域 `chunkSizeWarningLimit ≥ 1800`，警告消失但也把之後任何非 babylon chunk 的膨脹一起遮掉（request 只要求為 Babylon 開例外）。→ 必改 2。改寫二擇一由領導定：(a) 開 worktree 前先讓使用者把 CodeSnippet commit 進 master；或 (b) AC3 改為「build 輸出中不再有 `vendor-babylon` 的 500 kB 警告；其他 chunk 的警告照列在 report、不算失敗」，並明定 limit 的做法（例如全域 limit 設在 babylon 實測值之上約 10%、註解寫明只為 Babylon）。
- AC4 ✅。
- AC5 ❌ 兩處：
  1) 驗的對象是 dev server（見上）。可驗證改寫：「基準與改後都驗 **production 產物**：基準用 master 的 build（例如主樹現有 `docs/` 以 `vite preview --outDir docs --port 5173 --strictPort` 服務），改後用 worktree 的 `vite build --outDir <scratchpad>/dist` ＋ `vite preview --outDir <scratchpad>/dist --port 5174 --strictPort`；dev server 只可作為輔助。」（`base` 為 `/collect/`，網址照舊。）
  2) 「停留 10 秒並操作移動」不足以觸發延遲才用到的 Babylon 功能——缺副作用模組的錯誤只在第一次用到該功能時拋出（粒子、爆炸、命中判定／`scene.pick`、DynamicTexture 更新、回合結束／結算畫面、重開局等）。可驗證改寫：「每款至少打到**一次回合結束或結算畫面**並再開一局（或 brief 逐款列出必須觸發的事件：tank 射擊命中、bomber 炸彈爆炸、race 過終點、overcooked 完成一次上菜），兩個 context 的 consoleErrors／pageErrors 皆空」。→ 必改 3。
- AC6 大致可判定；「觸控」只寫在標題，條文沒有要求實際觸控操作（見 Minor）。

## 檔案所有權
- 8 個 Babylon 檔全在 babylon 可改範圍、`*.test.ts`（`src/babylon/math.test.ts`）未 import Babylon，AC1 與 AC4 不互相矛盾 ✅。成員之間無重疊 ✅。
- ❌ **獨佔資源漏宣告**：波 1 babylon 列要求「在 `/battle` 各款開一局自查 console」，這需要一個 dev／preview port，多人房也會碰 Firestore（firebase:battle），但 babylon 的獨佔資源欄是「—」；同波 qa 已宣告 `dev:5174, firebase:battle`。babylon 若照宣告就撞 qa（dk-brief-check 會 FAIL），不宣告就是無鎖佔用、跟 qa 改後驗收撞 port／撞房。→ 必改 4。建議改寫：把 5174 與 firebase:battle 劃給 babylon（自查用 preview 5174），qa 的「改後驗收」移到波 2 再宣告同一組資源；或明定 babylon 自查只用單人／不連 Firestore 的方式並寫出用哪個不衝突的 port。

## 波次切法
- babylon → qa 的先後在同一波內靠 `[DONE]` 串接，協定允許；qa 基準可與 babylon 並行，合理。
- 但資源鎖是「每波」計（見上條），同波內 babylon 自查與 qa 改後驗收會搶同一組 port／Firestore；拆成波 1（babylon＋qa 基準）／波 2（qa 改後驗收）最乾淨，也讓波 1 審查先看過 diff 再上實跑。已併入必改 4，不另計。
- 共用契約表空白：本任務不改 net／bridge，無契約需指定擁有者 ✅。
- 難度 M：不碰 net／core／rules／bridge，符合 CLAUDE.md，不需標 L ✅。

## Minor
- AC1 的 grep 只抓單引號；建議改 `grep -rnE "from ['\"]@babylonjs/core['\"]|import\(['\"]@babylonjs/core['\"]\)" src`，一併涵蓋雙引號與動態 import。
- `src/babylon/types.ts` 是 `import type { Scene } from '@babylonjs/core'`（型別匯入、不進 bundle）。AC1／AC2 照現寫會要求它也改深層路徑，可以接受，但 brief 最好明說「type-only 也要改」或 AC2 的規則開 `allowTypeImports`，免得 babylon 自己選。
- `placeholderScene.ts`（由 `games/index.ts` 引用，非四款遊戲之一）也在改動範圍，AC5 沒涵蓋；若 `/battle` 有路徑能進到它，請 qa 一併截一張。
- AC3 的 1,800 KB 門檻只比實驗值 1,588 KB 多約 13%，實際 build 還會多出補上的副作用模組；建議寫明「超過門檻時 ESCALATE，不得以 `.pure` 或拿掉副作用匯入湊數」。
- 目標寫「音效不變」，但 headless 截圖驗不到聲音；建議明寫音效只以「無 AudioEngine 類 console 錯誤」判定。
- AC6 標題有「觸控」但條文只要求進遊戲無錯；若 `/battle` 有觸控搖桿／按鈕，加一句「以 touch 事件操作一次移動」。
- AC3 的 `vite build --outDir` 在 root 外，vite 會印「outDir is not inside project root」警告，屬正常，建議 brief 註一句免得被當失敗。

## 測試
### 紅
不適用: 計畫審查，無程式碼、無測試可跑。
唯讀檢查：`grep -rln "@babylonjs" src` → 8 個檔，全在 babylon 可改 glob。
### 綠
不適用: 計畫審查，無程式碼、無測試可跑。
唯讀檢查：`grep -n "chunkSize\|manualChunks" vite.config.ts` → 無 chunkSizeWarningLimit、manualChunks 以 `id.includes('@babylonjs')` 歸 vendor-babylon。

## 自我審查
四條必改都指名 brief 段落並附可驗證改寫；未改任何檔（只寫自己的 state／report）。

## 疑慮
必改 2 的 (a)/(b) 是「選 A 或 B」，需領導或使用者決定。

## 結論
要改 4 處
