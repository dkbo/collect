---
name: rpg-map-generator
description: 為 RpgRoom 生成 2D RPG 地圖場景 JSON（房屋外觀、室內房間、布置場景）。當使用者要求新增/修改 RPG 地圖、場景、房間布置、NPC 配置時使用。
---

# rpg-map-generator

為 `src/pages/RpgRoom/` 生成符合統一 Schema 的地圖 JSON。一張地圖 = 一個
`src/pages/RpgRoom/data/000N_map.json`，存檔後由 `data/index.ts` 的
`import.meta.glob` 自動註冊，遊戲直接可玩，**不需要改任何 code**。

## 工作流程

1. **釐清需求**：場景類型（室內/室外）、尺寸（必須是 32 的倍數）、出入口
   （從哪張地圖進來、回到哪）、NPC 數量與對話主題。需求明確時不必逐項追問。
2. **讀參考資料**（皆在本 Skill 的 `references/` 下）：
   - `map-schema.md` — 完整 JSON schema 與欄位語意（z 層、e/cm/cmm 規則、rx/ry 壓縮）
   - `tile-catalog.md` — 貼圖目錄總覽（驗證等級、工具用法），分冊在 `tile-catalog/`：
     `indoor-structure.md`（室內結構）、`indoor-furniture.md`（室內家具+道具）、
     `outdoor.md`（室外+建築）、`usage-stats.md`（既有地圖使用統計）。
     **只讀需要的分冊**，標 ▢ 的條目使用前必先裁切驗證
   - `design-rules.md` — 場景設計規範（網格、牆、碰撞、前景遮罩、傳送配對）
   - `examples/` — 可直接參考的室內/室外範例
3. **依 design-rules.md 順序生成 JSON**：
   a. 鋪地板/底圖（善用 `rx`/`ry` 重複欄位壓縮）
   b. 牆與邊界 → c. 家具布置 → d. 前景遮罩（z=2）
   e. 碰撞區（對齊視覺）→ f. 出生點 `in[]` → g. 傳送點（cm/cmm）
   h. NPC + 對話（messages，支援 `[[kbd:]]`/`[[link:url|text]]`/`[[mark:]]` markup）
4. **驗證**：`python3 .claude/skills/rpg-map-generator/scripts/validate_map.py <地圖檔路徑>`
   ，修正所有 ERROR，檢視 WARN 是否符合預期。
5. **存檔**：`src/pages/RpgRoom/data/000N_map.json`（N 取現有最大編號 +1，
   `map.index` 必須等於 N）。
6. **補雙向傳送**：在來源地圖加一筆 `cm/cmm` 碰撞區通往新地圖，新地圖也要有
   回程傳送區；兩邊 `cmm` 都要指向對方 `map.in[]` 的有效索引。再跑一次
   validator 驗證兩張地圖。

## 修改既有地圖

讀取現有 JSON 後在空區域追加 styles/isMove/npc/messages，不要移動既有
元素；messages 是陣列索引制（`e` 對應 `messages[e]`），只能往後追加，
不可在中間插入。

## 素材座標驗證（▢ 條目與目錄外素材）

**絕對不要憑空猜測圖庫座標**——猜錯的後果是渲染出完全不相干的圖
（例如切到隔壁素材的一半）。目錄中標 ▢ 的條目座標可能偏 ±32px，
與目錄沒有的素材一樣要先驗證：

1. 裁切確認：
   `node .claude/skills/rpg-map-generator/scripts/crop_tile.cjs <b> <x> <y> <w> <h> /tmp/check.png`
   （批次對照用 `scripts/contact_sheet.cjs`，spec 一張 ≤12 筆）
2. Read 輸出圖：物件完整、無鄰格雜物、邊緣未截斷；不對就 ±32 調整重裁
3. 放進地圖後實機截圖驗證，確認無誤把該條目升級為 ◇/✓ 並更新分冊
