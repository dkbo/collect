# 糖果消消樂全面美化（A 亮面經典） 結案
結果：merged 9c10795   分支：dk/candyart   波數：3（d96c9d5、438dcf2、52417a9）
## 完成
- AC1 素材：39 張 WebP（檔名與 @2x 尺寸逐一相符、全有 `.import`＋mipmaps、無 PNG／JPG），pen 缺的 7 張已補畫。對照表 `…/d90c74ac-…/scratchpad/candy-assets-sheet.webp`（完整路徑見 `state/assets.report.md`）。
- AC2 字型：Fredoka Bold 放 `godot-candy-src/assets/fonts/` 與 `public/fonts/`，兩處附 OFL。
- AC3–AC5：棋子改 Sprite2D 貼圖（31 種、mipmap 取樣、缺檔退回 `_draw()`）、選取光暈；`bg_night` cover、`board_frame` 九宮格＋另畫落影、程式畫格子；六種 banner 改 Fredoka＋§6.5 樣式。
- AC6 特效：spec §7 全表，粒子預算 min(300, Σ)＋`[fx] particles=N`、`[fx] fps=N`。
- AC7–AC9 React：HUD 兩側／<4:3 上方橫條（兩側縮到 0.6 倍以下也退回橫條）、結算勝／敗／最後一關、暫停、說明、頁首、工具列、載入畫面換 A 風格；Fredoka `@font-face` 吃得到 `/collect/` base。
- AC10–AC11：bridge、store、`board.gd`、`data/**` 未動；testid 保留；`DK_TEST_CMD` 與 `board_test.gd` 全綠；`public/candy/` 已重匯出。
- AC12：五種尺寸、素材對照、三種結算、特效連拍、fps 全部有截圖與判定（見「驗證」）。
## 未完成 / 遺留
- 三波與整枝評議都只有 claude 一個 kind 審查（codex 額度到 2026-10-11、agy 到 2026-09-30，照關卡①的選項 A 記 skipped）；沒有未經審查的波。
- fps：1920×1080 連鎖期間最低 24，是 headless Chromium＋SwiftShader 軟體渲染量的，實機 GPU 未測，門檻請你判斷。
- 包裝糖扭結照 spec ±6°，56px 下肉眼幾乎看不出來；要明顯就調大 `amp_deg`（一個常數）。
- 以下是整枝評議 triage 後決定不修的 Minor：
- 貼圖 `.import` 為無損（`compress/mode=0`），`index.pck` 由 66KB 漲到 1.49MB（實測）；改 lossy 可省約 1MB，但背景漸層可能出色帶。
- 炸彈 shader 在糖粒像素上每像素約 240 次取樣，手機上盤面炸彈多時可能掉幀（推測，未在手機實測）。
- `FitDialog` 等比縮放沒有下限，手機橫放全螢幕時結算卡會縮到約 0.6 倍、按鈕觸控區變小（遮罩仍可捲動）。
- Divine! combo 字與 Sweet Crush! 疊約 0.05s。
- banner 漸層 shader 以「近白像素」辨識填色，日後給 banner 加彩色 modulate 前要先改（`banner_gradient.gdshader:18`）。
- 貼圖缺檔時退回的 `_draw()` 綠色仍是三角形（AC3 字面合規，貼圖版是圓頂軟糖）。
- `@keyframes candy-*` 與 reduced-motion 的原生 `animation: none` 不在「只新增 `.candy-*` class／@apply」字面內，與檔內既有寫法一致，裁定允許。
- `public/fonts/Fredoka-Bold.woff2` 內部 family 名是 Fredoka Light（Google Fonts 殘留），`@font-face` 以宣告為準，不影響。
- `art_test.gd`／`fx_test.gd` 只在 godot 的 scratchpad，未進版控（`tests/**` 本任務無擁有者，已記 BACKLOG）。
- 第 1 關 `Level 1` banner 播在載入遮罩底下看不到（master 既有，已記 BACKLOG）。
## 驗證
- 關波閘：三波 `dk-wave-close` 四道閘全過（裁定、dev report、eslint＋tsc＋vitest 292 條、所有權比對）；`board_test.gd` ALL PASS。
- 截圖（qa scratchpad，`/tmp/claude-1000/-home-bal-project-collect--worktrees-candyart/` 底下）：
  - 波 2 驗收（AC1–5、7–10、12、BUG-1／BUG-2 重驗）：`cadfa2dd-b9eb-46bb-804a-5ca3e99fd871/scratchpad/r/`、`r2/`
  - 波 3 驗收（AC6、AC11、AC12、回歸 AC3–5／7）：`5cfad731-1c91-46a8-bf47-c3f3d70fa0e0/scratchpad/`，五種尺寸 `r/size-*.png`、特效抽格 `vid/crop-*.webp`、31 種造型 `fx/sheet-idle.webp`、結算 `r/result-*.png`
  - 逐條判定表：`state/qa.report.md`（波 3）
- 自己看：worktree 內 `node_modules/.bin/vite --port 5174` 後開 `http://localhost:5174/collect/candy-crush`。
## 自主裁定（待你複核）
1. 00:33 不重派 candyart-assets（卡在 scratchpad 內 `rm out/*` 的審批，33 秒後自動拒絕、會自行續作）— 若錯：員工停住，TIMEOUT 再 --resume
2. 00:42 AC12 的 1024×768／1000×800 改在全螢幕截（非全螢幕 `.rpg-screen` 固定高 550，1000×800 容器≈1.53 仍在兩側）— 若錯：非全螢幕窄視窗的 HUD 位置沒被驗到
3. 00:42 react 新增 `@keyframes candy-*` 視為允許 — 若錯：index.css 多幾段動畫定義，可回退
4. 00:42 `board_frame` 大落影不重做素材，改由 godot 另畫 — 若錯：盤框落影與稿略有差異
5. 00:42 結算時 4 顆圓鈕留在遮罩上方可點、不照稿模糊（保留既有行為）— 若錯：與稿不一致
6. 00:47 波 1 Minor 1–5 併進波 2 修，HUD 縮放下限 0.6、2★ 門檻對齊 Godot 捨去 — 若錯：部分桌機寬度改顯示橫條
7. 00:57 載入畫面用紫夜空漸層不用純黑 — 若錯：改回純黑一行 CSS
8. 00:57 貼圖維持 lossless — 若錯：首載多約 1MB
9. 00:57 `art_test.gd` 不進版控 — 若錯：貼圖回退邏輯沒有常駐測試
10. 01:24 全螢幕時 help 圓鈕維持隱藏（master 既有，AC10 優先於 AC7 的 4 顆）— 若錯：全螢幕少一顆說明鈕，加回一行條件
11. 01:24 第 1 關 `Level 1` banner 被載入遮罩蓋住不處理（master 既有）— 若錯：首關少一個開場字卡
12. 01:40 包裝糖扭結維持 spec ±6° — 若錯：扭結太細看不出，調 `amp_deg`
13. 01:44 波 3 Minor 1–4 本波修掉並重匯出 — 若錯：本波多 15–20 分鐘
14. 01:59 park Divine!／Sweet Crush! 疊字約 0.05s — 若錯：結算開場有一瞬間疊字
15. 02:05 整枝評議新 Minor 3 條不修（pck 大小實測、炸彈 shader 手機掉幀推測、reduced-motion 寫法與既有一致）— 若錯：手機炸彈多時掉幀，需改 shader 取樣次數
## 重要決策
- 00:22 計畫審查 codex 撞額度不補派（剩 claude＋agy 仍達 MIN=2）
- 00:26 採納計畫審查 p1 五條必改（素材 49→39、assets 可補畫 pen 缺的 7 張並升 L、index.css 只准新增 `.candy-*`、波 2 加匯出＋qa＋react）
- 00:26 採納 p1 警告項（mipmap 在節點設、粒子預算公式＋`[fx]` print、fps 只記錄、4:3 以 `.rpg-screen` 為準、AC9 納入、波 3 godot 升 L 等）
- 00:27 關卡① 使用者 ok：§9 三題照建議、AC9 納入、額度期間只靠 claude 審查
- 00:46／01:24／01:49 波 1–3 審查通過（Important 皆 0 或已解）
- 01:01 波 2 Important：qa 把腳本寫進 `scripts/qa/candyart/` 占位目錄，轉 BUG 移出
## 給下次的話（≤3 行）
- brief 裡「所有權表下方的附註」不會進切片，qa 就是因此越界；這類硬限制一律寫進「全域約束」。
- 單一 kind 審查期間，dev 疑慮裡的設計參數（扭結幅度、落影）最好在 brief 寫明可調範圍，省得每條都要自主裁定。
## 時間
任務 2026-09-25-candyart
| 階段 | 開始 | 結束 | 時長 | dev | 審查 |
|---|---|---|---|---|---|
| 任務 | 2026-09-25T00:19 | 2026-09-25T08:16 | 477m | — | — |
| 計畫 | 2026-09-25T00:19 | 2026-09-25T00:27 | 8m | — | — |
| 波 1 | 2026-09-25T00:28 | 2026-09-25T00:47 | 19m | 13m | 4m |
| 波 2 | 2026-09-25T00:47 | 2026-09-25T01:24 | 37m | 35m | 27m |
| 波 3 | 2026-09-25T01:24 | 2026-09-25T01:59 | 35m | 24m | 9m |
| 結案 | 2026-09-25T01:59 | 2026-09-25T08:16 | 377m | — | — |
