---
name: rpg-scene-image-to-json
description: 將 2D 俯視場景圖（截圖/AI 繪製稿/手繪 mockup）轉換成 RpgRoom 地圖 JSON。當使用者提供場景圖片並要求轉成遊戲室地圖時使用，例如「根據 [圖片] 製作 [場景名]，出入口設置在 [場景2名]」。不符合格式的圖片防呆拒絕執行。
---

# rpg-scene-image-to-json

輸入一張場景圖，轉換成 `src/pages/RpgRoom/data/000N_map.json`。
與 `rpg-map-generator`（文字需求 → JSON）互補，本技能是 **場景圖 → JSON**。
核心策略：**轉錄優先**——能腳本算出來的（逐格素材對應）不靠人工判讀，
AI 只處理腳本做不了的（前景拆層、未匹配格、遮罩、出入口語意）。

schema / 素材目錄 / 設計規範 / 工具全部**共用** `rpg-map-generator` 的資源：

- Schema：`.claude/skills/rpg-map-generator/references/map-schema.md`
- 設計規範：`.claude/skills/rpg-map-generator/references/design-rules.md`
- 素材目錄：`.claude/skills/rpg-map-generator/references/tile-catalog.md`（+分冊）
- 場景名解析：`python3 .claude/skills/rpg-map-generator/scripts/map_registry.py --name <場景名>`
- 渲染器：`node .claude/skills/rpg-map-generator/scripts/render_map.cjs <json> <png> [--debug]`
- 驗證器：`python3 .claude/skills/rpg-map-generator/scripts/validate_map.py [--stage N]`
- 裁切工具：`.claude/skills/rpg-map-generator/scripts/crop_tile.cjs`、`contact_sheet.cjs`

## 參數解析

從需求解析：**圖片路徑**（必須）、**場景名**（缺省時依圖片內容取名並在回報標註）、
**出入口目標場景**。

- 出入口目標用 `map_registry.py --name` 解析成 index；找不到 →
  `❌ 防呆拒絕：參數層 — 找不到場景「X」 — 可用場景：<registry 名單>`。
- 沒給出入口目標 → 必須詢問（傳送斷鏈是 ERROR，不能猜）。

## 防呆 Gate（四層，任一不過 → 拒絕，不產出任何 JSON）

拒絕訊息統一格式：`❌ 防呆拒絕：<層級> — <具體原因> — <可行的修正建議>`

**第 1~2 層（自動化）**：
```bash
node .claude/skills/rpg-scene-image-to-json/scripts/precheck_image.cjs <場景圖路徑>
```
exit 1 即拒絕，直接把腳本輸出轉述給使用者。檢查：路徑存在、PNG/JPG/WebP
點陣圖（magic bytes，SVG/PDF/GIF/BMP 拒絕）、尺寸 ≥320×320 且 ≤8192、
長寬比 ≤3:1；通過時輸出 32px 網格換算比例。

**第 3 層（Read 圖判讀內容）**——必須**全部成立**才能繼續：
- 是 2D **正俯視（top-down）** RPG 風格場景；
- 有可辨識的地面/地板、邊界（牆或場景外緣）、物件擺設。

以下任一成立 → 拒絕：
- 照片、人像、文件截圖、圖表、純文字圖
- 橫向卷軸 / 平台遊戲視角（有天空地平線、重力式布局）
- 第一人稱 / 3D 透視場景
- **等角視角（isometric）**——菱形網格與本引擎正俯視矩形網格不相容
- 模糊或解析度不足以辨識結構

**第 4 層（素材對應比對，自動化；順便輸出轉錄明細）**：
```bash
node .claude/skills/rpg-scene-image-to-json/scripts/precheck_tiles.cjs <場景圖> 0.65 \
  --emit-grid /tmp/grid.json
```
把場景圖對齊 32px 網格後**逐格與圖庫做像素比對**。exit 1 即拒絕：
- 紋理格佔比 < 35% → 純色塊/漸層 mockup，缺少像素拼圖紋理
- 紋理格匹配率 < 門檻（預設 65%）→ 場景不是由本專案圖庫素材構成

通過時 `/tmp/grid.json` 即逐格匹配明細（直接供下一步轉錄），「未匹配格」
是 NPC/疊層所在的線索。補充判斷：列出場景關鍵元素對照 tile-catalog
分冊確認都有對應素材；有缺仍應拒絕並列出清單。

## 轉換流程（Gate 全過後執行）

1. **轉錄草稿（腳本）**：
   ```bash
   node .claude/skills/rpg-scene-image-to-json/scripts/grid_to_styles.cjs /tmp/grid.json /tmp/draft.json
   ```
   地板/牆/家具自動轉成 styles[]（已做 rx/ry 合併）。輸出另含
   `npcCells`（匹配到 man.png 的格 = NPC 候選位置）與 `unmatchedCells`（人工判讀）。
2. **組地圖 JSON**：`map.index` 用 `map_registry.py --next-index` 取得，
   檔名 `/tmp/000N_map.json`；把草稿 styles 填入。
3. **AI 修稿**（腳本做不了的部分）：
   - **z:2 拆層**：樹冠/屋簷/天花板外框/家具上半（原圖中會遮住角色的部分）改 z:2；
   - **未匹配格**：對照原圖判讀——是 NPC、疊層合成還是雜訊；▢/目錄外素材一律
     `crop_tile.cjs` 裁切 + Read 確認（**絕不憑空猜座標**）；
   - 把 `n` 欄位改為語意名稱（地板/牆壁/書櫃…），同素材相鄰塊可再手動合併。
4. **生成 isMove**：邊界牆碰撞 → 家具碰撞（比視覺窄、只擋下半）→
   對話薄條（`e`，h:1~8 貼物件下緣）→ 出入口傳送（`cm`/`cmm`，目標 =
   參數解析出的 index）。
5. **生成 npc + messages**：npcCells 與圖中角色轉 NPC（站立 type:0 / 行走
   type:4，行走型活動範圍不可含碰撞區）；對話依「哆拉◯」命名慣例 2~4 句，
   支援 `[[kbd:]]`/`[[link:url|text]]`/`[[mark:]]` markup。
6. **出生點 `in[]`**：門內側可行走區（32×48 全身不相交任何碰撞/NPC），背對入口，對齊 32。

## 驗證與存檔

1. 結構驗證：`validate_map.py --stage 4 /tmp/000N_map.json`——修正所有 ERROR。
2. **渲染比對終驗（量化驗收，必跑）**：
   ```bash
   node .claude/skills/rpg-map-generator/scripts/render_map.cjs /tmp/000N_map.json /tmp/render.png
   node .claude/skills/rpg-scene-image-to-json/scripts/precheck_tiles.cjs <原場景圖> --compare /tmp/render.png 0.85
   ```
   逐格一致率 ≥85% 才驗收；未達標依輸出的差異格座標逐格修正後重渲染再比
   （差異格集中處通常是：z 層蓋錯、合成格轉錄錯、漏家具）。修正 3 輪仍未達標
   → 停下來，把比對輸出與兩張圖並列回報給使用者裁決。
3. 存檔：`src/pages/RpgRoom/data/000N_map.json`；**來源地圖補回程傳送**
   （`cm`/`cmm` 雙向成對），兩張地圖不帶參數全量驗證 0 ERROR。
4. 回報附上：原圖 vs 渲染圖、比對一致率、`render_map.cjs --debug` 截圖。

## 驗收標準

- validate_map.py 0 ERROR（含雙向傳送、編號連續）。
- 渲染比對一致率 ≥85%，地圖結構（地板分區/牆/家具/NPC 位置）與原場景圖一致。
- 四周邊界封閉（牆碰撞或傳送點），玩家不可走出畫面。
- 前景遮罩正確：角色走到樹冠/屋簷/家具上半後方會被遮住。
- 所有 NPC 的 `e` 都有對應 `messages[e]`。
