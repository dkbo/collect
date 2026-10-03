## 做了什麼
完成了坦克美術與可玩度（A Toy Army）的計畫審查（brief-review），仔細對照了需求原文與 brief。

## 測試
無（計畫審查階段不涉及程式碼執行與測試）。

## 需求覆蓋
- ✅ 美術操照炸彈超人/糖果/廚房快手：AC1, AC5-AC7 已涵蓋。
- ✅ 子彈反彈、受擊無敵擊退、新道具、縮圈、AI bot：AC2 已涵蓋。
- ✅ best-of-3 與彈跳彈不做：目標段落有明確排除。
- ❌ 手機觸控瞄準砲塔：AC4 雖然指示 `babylon-hud` 在 UI 加入 Q/E 虛擬按鍵，但 brief 中**未指示 `babylon` 在 `tank.ts` 中實作監聽 Q/E 鍵來轉動砲塔的邏輯**。這樣 UI 虛擬按鍵發出按鍵事件後將無效，沒有真正接住「能夠瞄準砲塔」的需求。

## 驗收標準可驗證性
- ❌ AC4 手機操作：目前只定義了 UI 端（`babylon-hud`）加按鈕，缺乏遊戲端（`babylon`）的對應實作。
  **建議改寫**：在 AC4 加入「`babylon` 需在 `tank.ts` 實作監聽 Q/E 鍵以控制砲塔左/右旋轉」。

## 檔案所有權
- ✅ 檔案所有權劃分清晰，`babylon` 負責遊戲核心與特效，`babylon-hud` 負責 React UI，`designer` 負責設計稿，未見跨界與遺漏。
- ✅ 獨佔資源未見同一波次內成員之間有重疊宣告。

## 波次切法
- ❌ 波次表第 3 波的 qa 審查條件：`qa` 欄位的完成條件寫「等 babylon [DONE] 後」，但第 3 波中 `babylon-hud` 也需要進行「修 qa 回報的 HUD BUG」。若 `qa` 只等 `babylon`，可能會在 `babylon-hud` 修復完成前就開始全項驗收，導致驗到有 Bug 的 HUD。
  **建議改寫**：第 3 波 `qa` 的前提應改為「等 babylon 與 babylon-hud [DONE] 後」。

## Minor
- 波次表第 3 波 `babylon` 包含「量 draw calls 與 bundle（AC10、AC11）」，但 AC11 中已明確規定 bundle 由 `qa` 解開 base 產物來量測。若只是要求 `babylon` 自查無妨，但易與 qa 的職責混淆，建議可將 AC11 的 bundle 量測專責留給 qa 即可。

## 結論
要改 2 處
