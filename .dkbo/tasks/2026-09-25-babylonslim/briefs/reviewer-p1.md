# Babylon 深層匯入瘦身 — 計畫審查（reviewer 切片）
你審的是**還沒開工的計畫**，不是程式碼，也不是差異包。只讀、不改任何檔（包含 brief）、
不派工、不寫程式。意見只給領導（dk-msg leader），不要直接對任何人說。

## 要讀的（就這兩份，依序）
1. 需求原文 /home/bal/project/collect/.dkbo/tasks/2026-09-25-babylonslim/request.md —— 人講的原話，領導逐字抄下來的
2. brief /home/bal/project/collect/.dkbo/tasks/2026-09-25-babylonslim/brief.md —— 領導的轉換產物

## 全域約束（全文）
- 路徑一律用 `@/*` 別名，不得用相對路徑引入。
- 不用 `@babylonjs/*/**/*.pure` 版本（會拿掉副作用註冊）；需要的副作用模組以 `import '@babylonjs/core/…'` 明確補上。
- 不升降任何套件版本、不新增依賴（`package.json`、`pnpm-lock.yaml` 不改）。
- 不動多人同步協定與 `src/core/`、`src/babylon/net/**`、`firestore.rules`（net 只讀；本任務只改匯入，不改邏輯）。
- 遊戲邏輯、數值、畫面不改；純邏輯 vitest（`src/babylon/**/*.test.ts`）全部保持綠，不得為了過測試改測試。

你不需要讀專案程式碼。你要回答的是「這份計畫做出來會不會是人要的東西」，
不是「這段碼寫得好不好」。每條意見都要指名 brief 的哪一段或波次表的哪一列。

## 報告寫到 /home/bal/project/collect/.dkbo/tasks/2026-09-25-babylonslim/state/reviewer-p1.report.md，格式固定
## 需求覆蓋
（逐條對照 request：人要的每一件事，brief 有沒有對應的驗收標準？
  漏的列出來，指明 request 的哪一段沒有被接住）
## 驗收標準可驗證性
（逐條 AC：能不能明確判定過或不過？不能的指出來，並給一個可驗證的改寫）
## 檔案所有權
（成員之間有無重疊或遺漏？有沒有哪條 AC 要動的檔沒有任何人擁有？獨佔資源欄有無漏）
## 波次切法
（順序合理嗎？同一波裡有沒有人其實要等另一個人的產出？共用契約有沒有指定擁有者）
## Minor
（其餘建議）
## 結論
一行，只能是 `可以開工` 或 `要改 N 處`（N = 前四段裡你認為**必須**改的條數）

## 完成
state 檔 `status: done`，然後
dk-msg leader "[DONE] brief-review: <可以開工|要改 N 處>，見 report"
