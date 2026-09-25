# 炸彈超人美術優化（A Toy Box） — 計畫審查（reviewer 切片）
你審的是**還沒開工的計畫**，不是程式碼，也不是差異包。只讀、不改任何檔（包含 brief）、
不派工、不寫程式。意見只給領導（dk-msg leader），不要直接對任何人說。

## 要讀的（就這兩份，依序）
1. 需求原文 /home/bal/project/collect/.dkbo/tasks/2026-09-25-bomberart/request.md —— 人講的原話，領導逐字抄下來的
2. brief /home/bal/project/collect/.dkbo/tasks/2026-09-25-bomberart/brief.md —— 領導的轉換產物

## 全域約束（全文）
- 路徑一律用 `@/*` 別名，不得用相對路徑引入。
- 自訂 CSS class 一律用 `@apply` 套 Tailwind；`src/index.css` 只准新增 `.bomber-*` 前綴的 class，不得修改既有 class。
- 圖片只收 WebP，不得把 JPG／PNG 寫進 `src/`、`public/`；PNG 等中間檔只准放自己的 scratchpad。
- 非同步請求與資料處理寫在 Zustand store action，元件只訂閱與調用。
- 不新增任何依賴：`package.json`、`pnpm-lock.yaml` 不改（不加 `@babylonjs/loaders`／`gui`／`materials`）。
- Babylon 一律經 `src/babylon/babylonCore.ts` 深層匯入（eslint 已禁整包匯入），不用 `.pure` 版本；新功能要在那裡補副作用 import。
- 不動多人同步協定：`src/core/**`、`src/babylon/net/**`、`src/babylon/games/bomberNet.ts`、`bomberAI.ts`、`bomberMap.ts` 只讀；`*.test.ts` 不得修改，全部保持綠。
- 遊戲規則與數值不變（格數、計時、突然死亡 40 秒、道具效果、爆炸 550ms 時序等）；相機 β、fov 不調（spec §7 的相機段不做）。
- 字型：HUD 數字用站內既有的 Fredoka（`public/fonts/Fredoka-Bold.woff2`）代替 spec 的 Lilita One；中文用站內字型代替 Noto Sans TC，不新增字型檔。
- spec §11 八條採以下裁定（關卡①由使用者確認）：①選 A；②**角色與所有物件都用程式建模**（不引入 glTF，理由見 ruling）；③HUD 走 React，透過 `types.ts` 新增的可選 `setHud` 通道；④卡通材質自寫 NodeMaterial（或 ShaderMaterial）ramp；⑤可破磚統一箱形；⑥固定 4 色依出生角；⑦相機不調；⑧`vendor-babylon` gzip 增量 ≤ 250 KB。

你不需要讀專案程式碼。你要回答的是「這份計畫做出來會不會是人要的東西」，
不是「這段碼寫得好不好」。每條意見都要指名 brief 的哪一段或波次表的哪一列。

## 報告寫到 /home/bal/project/collect/.dkbo/tasks/2026-09-25-bomberart/state/reviewer-p1.report.md，格式固定
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
