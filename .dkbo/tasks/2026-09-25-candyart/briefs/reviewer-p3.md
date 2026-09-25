# 糖果消消樂全面美化（A 亮面經典） — 計畫審查（reviewer 切片）
你審的是**還沒開工的計畫**，不是程式碼，也不是差異包。只讀、不改任何檔（包含 brief）、
不派工、不寫程式。意見只給領導（dk-msg leader），不要直接對任何人說。

## 要讀的（就這兩份，依序）
1. 需求原文 /home/bal/project/collect/.dkbo/tasks/2026-09-25-candyart/request.md —— 人講的原話，領導逐字抄下來的
2. brief /home/bal/project/collect/.dkbo/tasks/2026-09-25-candyart/brief.md —— 領導的轉換產物

## 全域約束（全文）
- 路徑一律用 `@/*` 別名，不得用相對路徑引入。
- 自訂 CSS class 一律用 `@apply` 套 Tailwind（spec §6.2 的 class 寫在 `src/index.css`）。
- 圖片只收 WebP，不得把 JPG／PNG 寫進 `src/`、`public/`、`godot-candy-src/`。
- 非同步請求與資料處理寫在 Zustand store action，元件只訂閱與調用。
- bridge 協定不動：`src/lib/candyBridge.ts`、`src/store/useCandyStore.ts`、`godot-candy-src/scripts/candy_bridge.gd` 只讀。
- 遊戲邏輯不動：`godot-candy-src/scripts/board.gd`、`godot-candy-src/data/**` 只讀，`tests/board_test.gd` 必須全綠。
- Godot 維持 `gl_compatibility` 渲染器、`export_presets.cfg` 的 `variant/thread_support=false`。
- Godot 內文字只用英文與 Fredoka Bold，不把中文字型打進 .pck；React 側中文沿用站內字型，不新增中文字型檔。
- 設計稿與 spec 在主樹 `$DK_ROOT/tasks/2026-09-25-candyart/design/`，只讀；worktree 內不得寫 `.dkbo/`。
- spec 標「需裁決」的三條已定：HUD 移進畫面兩側（寬高比 <4:3 退回上方橫條）、素材從 `variant-A.pen` 匯出（assets 只擴邊／切圖／轉檔）、混搭只採 C 的「已引爆」脈動外發光（B 的巧克力豆不做）。

你不需要讀專案程式碼。你要回答的是「這份計畫做出來會不會是人要的東西」，
不是「這段碼寫得好不好」。每條意見都要指名 brief 的哪一段或波次表的哪一列。

## 報告寫到 /home/bal/project/collect/.dkbo/tasks/2026-09-25-candyart/state/reviewer-p3.report.md，格式固定
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
