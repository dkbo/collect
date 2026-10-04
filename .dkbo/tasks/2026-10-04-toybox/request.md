# 全站改版（DKBO Toybox 玩具機風） — 需求原文

把人講的原話**逐字**抄在下面。不要摘要、不要改寫、不要先做技術轉換 ——
brief 才是轉換的產物，這一份是用來比對「brief 有沒有漏掉人要的東西」的基準。
外部文件（spec、issue、對話紀錄）請把相關段落整段貼進來，不要只留連結：
連結會死，而這個檔案要活到任務歸檔之後還有人讀得懂。

---

（原文從這裡開始）

### 第 1 則（2026-10-04）
網站的設計要大改，目前的設計太有 AI 感了請推薦我一些風格及相關參考網站

（領導回覆：診斷 AI 感來源＝紫靛漸層、blur 光暈、毛玻璃、全 rounded-xl、淡紫底 icon 方塊、Geist＋shadcn 預設灰；推薦 5 種風格：1 玩具／遊戲機風、2 新粗獷主義、3 復古作業系統、4 編輯排版、5 3D 互動作品集；建議主軸 1、元件語言借 2。）

### 第 2 則
1

（領導依「1 玩具／遊戲機風」做了首頁 mockup：https://claude.ai/artifact/DJ4MZQCkjHParRU4UMRAHf ，原始檔已複製到 `design/home-mockup/Main.dc.html`。）

### 第 3 則（貼上的內容，原文照錄）
請根據這張 UI 參考圖建立一套簡化 Design System。
不需要分析所有細節，只需要整理：

1. Color Tokens
2. Typography，包括字型、字級、字重與用途
3. Spacing、圓角、Border
4. Desktop Grid 與 Layout 結構
5. 主要可重複使用的 Components
6. 每個 Component 的尺寸、Padding、文字層級與基本狀態

請避免每個元件設定獨立數值，盡量整理成可重複使用的 Token。
最後輸出成一份可以直接交給 artifacts / 前端工程師使用的 Design System Spec。

主要是往這些架構往細節拆
要拆完這些圖需要更多的形容跟配置

（領導以上一則的 mockup 為參考圖產出 Design System「DKBO Toybox」：https://claude.ai/artifact/TYeqfA8eSW7S5N2h2PzWzR ，全部檔案已複製到 `design/toybox-ds/`：README.md、01-foundations.md、02-layout.md、03-components.md、04-implementation.md、tokens.json、components/<15 元件>/README.md＋preview.html、components/bundle.css（各元件的參考 CSS）。）

### 第 4 則
/dkbo-plan

### 計畫階段領導提問與人的回答（AskUserQuestion，原文）
- 問：這次改版要涵蓋哪些頁面？（目前紫色／漸層／毛玻璃散在 13 個頁面與 index.css）
  答：全站一次改完（推薦）——選項說明：「主題 token＋Layout＋首頁照 mockup 重做；其餘頁面（履歷、工具頁、遊戲頁外框、Battle 大廳）全部換成 Toybox 元件語言。約 4 波，babylon 要進來改 Battle 頁 UI。」
- 問：深色模式怎麼處理？
  答：保留，照 spec 的 Dark 值（推薦）——選項說明：「Design System 已定好兩套值，主題切換鍵保留。」
