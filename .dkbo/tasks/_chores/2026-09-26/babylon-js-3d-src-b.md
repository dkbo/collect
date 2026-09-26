交代：廚房快手（Babylon.js 3D，src/babylon/games/overcooked.ts／overcookedKitchen.ts，/battle 的 overcooked）美術優化的『方向稿』，不改任何程式、不起 dev server。現況：玩家（overcooked.ts ~L175–220，Box 身體＋Sphere 頭＋Box 臉／四肢，StandardMaterial 單色）、工作站（~L349–370 Box 台面＋頂部方塊）、場地裝飾（~L620–745：地磚逐格 CreateBox、牆、底座、鍋、砧板＋刀、出餐鈴、掛架、時鐘）、食材與成品（~L160–170 item 材質；種類與流程讀 overcookedKitchen.ts：食材、切、煮、焦、盤子、出餐、訂單）、蒸氣／火花粒子（~L750–800）、浮字（~L836）、HUD 是 3D 文字面板（L376–379：hud、banner 倒數、orders 訂單、recipes 食譜）。現況外觀看 public/game-covers/overcooked.webp。目標：跟糖果、炸彈超人同等級精緻度 —— 必讀兩份前例：.dkbo/tasks/2026-09-25-bomberart/design/spec.md（A Toy Box，已實作並合併，請看 src/babylon/games/bomberFx/ 的 look.ts／quality.ts／upright.ts／palette.ts 與 src/pages/Battle/bomberHud.ts 的 React HUD 通道 GameContext.setHud）和 .dkbo/tasks/2026-09-25-candyart/design/。產出 3 套差異明顯的變體，其中一套必須與炸彈超人 A Toy Box 同一語彙（同系列感），另兩套自由（例如溫暖木質餐館、亮面糖果廚房）。每套：一張 16:9 對戰畫面 mockup（俯視 3/4、同一個廚房、4 位玩家、有人切菜／有鍋在煮／有一鍋快焦、訂單列滿）、一張物件特寫表（角色 4 色、每種工作站、每種食材的生／切好／煮好／焦掉、盤子與成品、訂單卡、HUD 元件），附色票與材質要點。spec.md 要寫：推薦哪套與理由；現況盤點表（附行號）；每類物件程式建模做法（沿用 bomber 的決定：全程式建模、不引入 glTF）；材質光影（能否直接重用 bomberFx 的卡通 ramp MaterialPlugin／描邊／陰影／檔位降級，還是要抽成共用模組，列出要動哪些檔）；特效（切菜、蒸氣、焦煙、出餐、訂單逾時）；HUD 改走 React（訂單卡、計時、分數、食譜）；效能預算（draw call、vendor-babylon gzip 增量）；以及待裁決清單。一律照角色檔用 pen interactive＋--preview-output，禁 --prompt/--tasks，匯出 webp。全部產出寫到主樹 .claude/.superpower/specs/overcooked-redesign/（不要寫 docs/ 或 repo 根目錄）。完成 dk-msg leader "[DONE] <推薦變體＋產出路徑>"。
成員：chore-designer-1 (claude / M)
status: working
touched:
結果：

## 筆記（chore-designer-1）
- 2026-09-26 開工：讀完 designer.md／PROTOCOL／PROJECT、bomber spec 與 bomberFx、overcooked.ts／Kitchen.ts。
- 事實：11×7 格、外圈全是檯面；站點 crate-v(2,0) crate-m(4,0) serve(8,0) board(0,2)(0,4) pot(10,2)(10,4)；食材只有 v/m，狀態 raw/chop/soup/burnt；**邏輯裡沒有盤子**（湯直接端著出餐）、combine 步驟未實作（出餐只比 ing）。
- 現況 vendor-babylon gzip ≈ 448 KB（docs/ 產物，bomber 已帶陰影／Glow／描邊／Pipeline）。
- 產出目錄：.claude/.superpower/specs/overcooked-redesign/；產生器腳本在 scratchpad（不進 repo）。
- 2026-09-26 完成。產出：.claude/.superpower/specs/overcooked-redesign/（variant-{A,B,C}.pen、-gameplay.webp 1920×1080、-sheet.webp 1800×1875、spec.md）。
- 推薦 A · Toy Kitchen（與 bomber A 同語彙；重用 bomberFx，vendor-babylon 增量≈0）。待裁決 11 條見 spec §10，重點：抽 src/babylon/fx/、KitchenHud 通道（types.ts 共用契約）、盤子／combine 名實不符、快焦判定依賴 buildView 分母。
- 過程：pen interactive --out … --preview-output …（stdin 餵 execute），Export() 出 webp；未用 --prompt/--tasks；未改程式、未起 dev server。產生器在 scratchpad/gen。
- 自查：三套 gameplay／sheet webp 逐張目視（4 玩家、切菜、煮中、快焦、訂單滿 3 張、角色 4 色、全部站點與鍋 5 態、食材 2×4、成品、訂單卡 3 態、HUD 元件、色票、材質要點皆在）。

---
關閉：2026-09-26T08:22 done — 廚房快手方向稿：推薦 A·Toy Kitchen（同 bomber 語彙、重用 bomberFx、vendor 增量≈0）；3 套 pen/webp＋spec（待裁決 11 條）在 .claude/.superpower/specs/overcooked-redesign/
