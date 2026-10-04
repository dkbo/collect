# 全站改版（DKBO Toybox 玩具機風） 結案
結果：merged 8b83e87   分支：dk/toybox   波數：4
## 完成
- AC1 designer：`design/pages-spec.md` 17 節＋15 張 `page-*.webp`。
- AC2–AC4 react-theme：toybox token（17 色淺／深、13 字級、`rounded-toy-*`、`shadow-hard-*`、三字族）、Google Fonts、`src/styles/toybox.css` 15 個 `tb-` 元件 class、`@/components/toybox` 15 個 React 元件、`ui/button` 改 variant、`tbCn`；波 3 刪除 `index.css` 舊頁面區段（−631 行，86 個 class 逐一 rg 零引用）、`lib/utils` 的 `cn` 統一走 `tbCn`、`vitest.config.ts` 納入 `src/components/**`。
- AC5–AC6 react-shell：SiteHeader／手機選單／頁尾／載入畫面、首頁照 mockup 重做（Hero＋Handheld＋Marquee＋卡帶篩選＋About／Journey／CodeSnippet＋CtaPanel）、NotFound。
- AC7 react-pages：Resume、Todos、Search、Directions。
- AC8 react-games：MapDeveloper、MiniGame、GodotGame、RpgRoom、CandyCrush 外框（ScreenFrame）。
- AC9 babylon：Battle 大廳、GameMenu、GameList、Room、SoloGame 外框。
- 波 4 修復：Candy 載入圖示補 `strokeWidth={2.5}`、刪 HeroSection 過時的空 `onB`。

## 未完成 / 遺留
- 所有波皆經審查，但每輪都**只有 claude 一種 kind**（codex 熔斷至 10/11、agy 熔斷至 10/10），未達 `DK_REVIEW_MIN=2`。
- 波 4 未派 qa（兩處一行修改，只經測試閘與 L 檔審查）：Candy 載入圖示線寬變化沒有截圖。
- Battle 房間雙 context 流程（Firestore）：波 2 qa 判 AC9 通過；波 3 qa 因 Battle 檔無變更、未分配 `firebase:battle` 沒重跑。
- `public/works/battle.webp` 仍是舊紫色 Battle 截圖，首頁 FeatureCard／Handheld 會用到，風格不搭（本任務禁新增圖檔）→ 建議雜務重截。
- 整枝評議判「可留」不修的 Minor（前提為 reviewer grep 實測）：
  - `ui/button` size 低於 44px、`link` variant 對比 2.7:1——現只剩未掛路由的 `Dashboard.tsx` 使用（`src/components/ui/button.tsx:30-43`）。
  - `ui/button` 每個 variant 重寫 lift、lift 位移用任意 px 值（`src/styles/toybox.css:22`）。
  - `lib/utils` 反向 import `components/toybox/cn`、`cn` 與 `tbCn` 並存且 `cn` 已無非測試消費者（`src/lib/utils.ts:2`）。
  - `WorksSection` 自組 `tb-seg`，可改用 `SegmentedControl` 的 `testId`（`src/pages/Home/WorksSection.tsx:11`）。
  - RpgRoom `[[kbd:…]]` 一律 `font-pixel`，中文走退路字（`src/pages/RpgRoom/lib/messageRenderer.tsx:29`）。
  - 數處任意 px 間距，多沿用舊值（`src/pages/Directions/Directions.css:71` 等）。
  - 首頁拿掉舊 `work-list-*` testid（無測試使用）。
  - `Handheld.test.ts` 未涵蓋受控模式 B 鍵路徑（`src/components/toybox/Handheld.tsx:57`）。
  - toybox 元件內以 `clsx` 串接 className，不去重（目前無衝突）。
  - Directions 假資料文案內的 emoji（內容非圖示）。

## 驗證
- 測試閘（每波 wave-close）：eslint 0 錯、tsc 乾淨、vitest 99 檔 1044 測試全綠（波 3 qa 實測）。
- AC10：禁用樣式 grep 0 筆；`index.css` 全檔 13 = HUD 區段 13 = base 13。
- AC13：`git diff a4994aa -- src/babylon src/core godot-src godot-candy-src public src/pages/RpgRoom/data package.json pnpm-lock.yaml` 為空；HUD 區段 md5 與 base 相同；糖果、炸彈超人、RPG、Godot 畫面 bridge 訊息與 HUD 數值與 base 相同。
- AC14：主 CSS gzip 40,981 B → 38,410 B（−2,571 B）。
- AC12／AC11：72 張（6 組寬度／主題 × 12 路由）無水平捲動、無文字裁切；對比最低 6.49。
- AC15：互動連拍（篩選、Handheld A／B、手機選單開合）通過；截圖在 qa 的 scratchpad，報告見 `state/qa.report.md`。

## 自主裁定（待你複核）
1. 10:11 桌機 `:root` 維持 18px；toybox 字級／圓角／陰影／框寬寫 px，間距與控制項高照 rem（桌機放大 12.5%）— 若錯代價：桌機留白與控制項略大於 mockup，改 `index.css` 一行。
2. 10:35 波 3 react-theme 加擁有 `vitest.config.ts`、`src/lib/utils.ts`；波 2 混用 toybox utility 用 `tbCn` — 若錯代價：波 2 期間 `cn.test.ts` 不在閘內。
3. 10:41 觸控 ≥44px 例外只限疊在遊戲畫面內、與凍結 HUD 共位的浮鈕（size-9）；觸控動作鍵 emoji 照凍結資料顯示；`candy-page-` 前綴入契約 — 若錯代價：浮鈕在手機上略小於 44px。
4. 11:07 Directions `darkMapStyles` 的 hex 不改 — 若錯代價：深色地圖底色與 toybox 不完全一致。
5. 11:07 `gameUi.tsx` 留在 `src/pages/RpgRoom/lib/` 不搬 — 若錯代價：位置不直觀，日後可搬。
6. 11:16 不擴大 44px 例外，Todos／Search／MapDeveloper 的小鈕一律改 ≥44px — 若錯代價：列與工具列略寬。
7. 11:16 react-games 頁面 CSS 補 `@layer components` 併入修復 — 若錯代價：無。
8. 11:33 接受遊戲畫面區尺寸隨外框改變（944×548→973×550、Battle 1258×719→1112×721）— 若錯代價：調頁面 CSS 的 max-w／padding 即可回復。
9. 11:34 `cn.test.ts`（本任務新增）對照斷言改為新行為 — 若錯代價：無。
10. 12:21 修復波 4 不派 qa — 若錯代價：載入圖示線寬未經截圖確認。
11. 12:21 整枝評議「可留」的 Minor 不修、列入遺留 — 若錯代價：日後清理工作量。

## 重要決策
- 波 2 react-pages 與 react-games 不另立彼此契約（09:59）。
- CandyCrush 頁面外框納入改版，HUD／浮層／遊戲只讀（10:04）。
- toybox 圓角與內文字族另取新名（`rounded-toy-*`、`font-body`），不覆寫 `--radius-*`／`--font-sans`（10:04）。
- 計畫與每波審查只有 claude 一種 kind 仍裁定（10:04、10:41、11:23）。
- 重派 designer（無別名）（10:06）。
- 契約前綴補 `notfound-`（11:07）；Handheld B 鍵交波 3 修（11:07）。
- 以上「自主裁定」11 條。

## 給下次的話（≤3 行）
- `dk-spawn <role> <alias>` 的別名只能是後綴；單人角色不要帶別名，否則 state 名對不上切片。
- 員工 report 的測試輸出要頂格寫，wave-close 只數行首非空白的行。
- designer 的 spec 若與 brief 全域約束衝突（如觸控尺寸），波 1 審查就要逐條掃，不然會在波 2 再撞一次。

## 時間
任務 2026-10-04-toybox
| 階段 | 開始 | 結束 | 時長 | dev | 審查 |
|---|---|---|---|---|---|
| 任務 | 2026-10-04T09:54 | 2026-10-04T12:29 | 155m | — | — |
| 計畫 | 2026-10-04T09:54 | 2026-10-04T10:05 | 11m | — | — |
| 波 1 | 2026-10-04T10:06 | 2026-10-04T10:43 | 37m | 37m | 6m |
| 波 2 | 2026-10-04T10:43 | 2026-10-04T11:33 | 50m | 38m | 16m |
| 波 3 | 2026-10-04T11:33 | 2026-10-04T12:16 | 43m | 8m | 2m |
| 波 4 | 2026-10-04T12:21 | 2026-10-04T12:25 | 4m | 2m | 1m |
| 結案 | 2026-10-04T12:25 | 2026-10-04T12:29 | 4m | — | — |
