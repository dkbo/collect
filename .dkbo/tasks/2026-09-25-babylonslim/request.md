# Babylon 深層匯入瘦身 — 需求原文

把人講的原話**逐字**抄在下面。不要摘要、不要改寫、不要先做技術轉換 ——
brief 才是轉換的產物，這一份是用來比對「brief 有沒有漏掉人要的東西」的基準。
外部文件（spec、issue、對話紀錄）請把相關段落整段貼進來，不要只留連結：
連結會死，而這個檔案要活到任務歸檔之後還有人讀得懂。

---

（原文從這裡開始）

**使用者 2026-09-25（`pnpm build` 之後）**
> 只有「部分 chunk 超過 500 kB」的警告 在看怎優化

**領導（一般 session）當時的分析（節錄 Babylon 列）**
> | `vendor-babylon` | 6.4 MB（1.4 MB） | 8 個檔都寫 `import { … } from '@babylonjs/core'`，這種整包匯入沒辦法 tree-shake，整個 Babylon 都打包進來 | 改成深層路徑匯入，例如 `@babylonjs/core/Engines/engine`、`@babylonjs/core/Meshes/Builders/boxBuilder`；有些功能還要補副作用匯入 | 估計降到 1.5～2.5 MB，未實測 |

**使用者**
> 先處理這塊

（指 vendor-syntax 那列；已在主樹直接改 `src/pages/Home/CodeSnippet.tsx`，885 KB → 42.8 KB，尚未 commit，不屬本任務。）

**使用者**
> Babylon 這個真的無法優化嗎

**領導的實驗結果（rolldown --minify，只打包專案實際用到的 14 個類別＋7 種 MeshBuilder）**
> | 匯入方式 | 大小 | gzip |
> |---|---|---|
> | 現在：`from '@babylonjs/core'` 整包匯入 | 6,251 KB | 1,356 KB |
> | 深層路徑，例如 `@babylonjs/core/Engines/engine` | 1,588 KB | 358 KB |
> | 深層路徑改用 `.pure` 版本 | 1,406 KB | 308 KB |
>
> - 改深層路徑能少約 75%。
> - `.pure` 版本只再省 180 KB，但它會拿掉副作用註冊，缺哪個要到執行時才報錯，不值得冒險。
> - 剩下的 1.5 MB 大多是 Engine 和 Scene 的核心，500 kB 警告關不掉，建議設 `chunkSizeWarningLimit` 並註明原因。
> - 範圍：8 個檔的 import（`src/babylon/` 七個加 `src/pages/Battle/BabylonCanvas.tsx`），`MeshBuilder.CreateBox(...)` 這類呼叫共 112 處。
> - 主要風險是少 import 某個副作用模組，build 會過、要進遊戲才報錯，四款遊戲都得進 `/battle` 實跑，也要驗多人同步。
> 建議叫 `/dkbo-plan` 開任務：babylon 實作、qa 用兩個瀏覽器 context 各跑四款遊戲。

**使用者**
> （叫了 `/dkbo-plan`）

**使用者 2026-09-25（關卡①，回覆「brief 可以嗎？」與「要不要先 commit CodeSnippet？」）**
> ok
