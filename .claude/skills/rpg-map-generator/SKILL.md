---
name: rpg-map-generator
description: 為 RpgRoom 生成 2D RPG 地圖場景 JSON（房屋外觀、室內房間、布置場景）。當使用者要求新增/修改 RPG 地圖、場景、房間布置、NPC 配置時使用。支援「設計 [長x寬] 的 [風格] 場景，出入口接 [場景名]」參數化需求。
model: sonnet
effort: medium
---

# rpg-map-generator

為 `src/pages/RpgRoom/` 生成符合統一 Schema 的地圖 JSON。一張地圖 = 一個
`src/pages/RpgRoom/data/000N_map.json`，存檔後由 `data/index.ts` 的
`import.meta.glob` 自動註冊，遊戲直接可玩，**不需要改任何 code**。

工作流對齊人工製作順序：**骨架 → 場景擺設 → NPC → 遮罩 → 出入點**，
每階段有自動驗證點（早期抓錯），機械性內容全部腳本化（降低失敗率）。

## 工具（皆在本 Skill `scripts/` 下，路徑從專案根目錄起）

| 工具 | 用途 |
|---|---|
| `python3 scripts/scaffold_map.py` | 骨架產生：地板/牆/天花板外框/邊界碰撞/門口，一鍵產出 |
| `python3 scripts/map_registry.py [--name X]` | 地圖清單、場景名→index 解析（出入口防呆） |
| `node scripts/render_map.cjs <json> <png> [--debug]` | 離線渲染預覽（含碰撞/傳送/出生點 overlay），免開 dev server |
| `python3 scripts/validate_map.py [--stage N] <json>` | 驗證器；--stage 1~4 配合階段早期抓錯 |
| `node scripts/crop_tile.cjs` / `contact_sheet.cjs` | 素材裁切驗證（▢ 條目用） |
| `node ../rpg-scene-image-to-json/scripts/precheck_tiles.cjs <render.png>` | **跨 skill 借用**：對渲染圖逐格比對圖庫，自動驗證素材座標沒切錯 |

## 入口參數解析

從需求中解析：**尺寸**（如 960x640，自動 snap 32 倍數）、**室內/室外**、
**風格/特色**（家具主題、NPC 數量與對話主題）、**出入口接哪張地圖**。

- 出入口目標用 `map_registry.py --name <場景名>` 解析；找不到時把可用場景
  名單列給使用者選——**不可猜**（單向/斷鏈傳送是 ERROR）。
- 風格/特色缺省時依場景類型給合理預設，不逐項追問；尺寸與出入口必須明確。

## 工作流程（五階段，每階段驗證通過才進下一階段）

先讀參考資料（`references/` 下，只讀需要的）：`map-schema.md`（欄位語意）、
`design-rules.md`（設計規範）、`tile-catalog.md` + 分冊（素材座標，▢ 條目要先驗證）、
`examples/`（範例）。

### 階段 0：骨架
```bash
python3 .claude/skills/rpg-map-generator/scripts/scaffold_map.py \
  --size 960x640 --type indoor --name 書房 --doors "S:448:64:房屋(2F)"
```
產出到 `/tmp/000N_map.json`（編號自動取最大 +1）。門格式 `EDGE:OFFSET[:WIDTH[:TARGET]]`。
驗證：`validate_map.py --stage 1 /tmp/000N_map.json`。

### 階段 1：場景擺設（圖層覆蓋：前景 z:2 > 人 > 背景）
依 design-rules 在骨架上布置家具/裝飾：先大型家具靠牆、再小物件；
「會遮住角色的部分」（樹冠/屋簷/家具上半/天花板）拆 z:2。善用 `rx`/`ry`。
驗證（兩道）：
1. `render_map.cjs /tmp/000N_map.json /tmp/preview.png` → **Read 圖自查**布局合理、無破圖。
2. `precheck_tiles.cjs /tmp/preview.png 0.9` → 純圖庫素材構成的渲染圖匹配率應 ≥90%；
   明顯偏低 = 有素材座標切錯（切到鄰格素材），依未匹配格座標逐筆修正。

### 階段 2：NPC + 對話
NPC 對齊 32 網格；行走型（type:4）活動範圍不可含碰撞區；對話依「哆拉◯」
命名慣例 2~4 句，支援 `[[kbd:]]`/`[[link:url|text]]`/`[[mark:]]` markup。
驗證：`--stage 2`；`render_map.cjs --layers=bg,npc,fg,area` 檢視站位（NPC 缺
`messages[e]` 時渲染統計會直接警告）。

### 階段 3：遮罩（碰撞）
邊界牆（骨架已有）→ 家具碰撞（比視覺窄、只擋下半）→ 對話薄條（h:1~8 貼物件
下緣）。樓梯/大樹碰撞的觸發計算見 design-rules.md。
驗證：`--stage 3`；`render_map.cjs --debug` → Read 圖比對紅框是否貼齊視覺。

### 階段 4：出入點
1. 確認骨架的門口傳送 `cm/cmm`：cmm 必須指向目標地圖 `in[]` 的正確索引。
2. `in[]` 落點在門內側可行走區（32×48 全身不相交碰撞/NPC）、背對入口、對齊 32。
3. **目標地圖補回程傳送**（cm 指回本圖、cmm 指向本圖 in[] 索引）。
驗證：`validate_map.py --stage 4`（= 全量，單向傳送會報 ERROR）。

### 階段 5：存檔
1. 移檔：`/tmp/000N_map.json` → `src/pages/RpgRoom/data/000N_map.json`。
2. 全量驗證**不帶參數**跑一次（含陣列位置/編號連續檢查），新舊兩張地圖都要 0 ERROR。
3. 最終 `render_map.cjs --debug` 截圖附在回報中。

## 修改既有地圖

讀取現有 JSON 後在空區域追加 styles/isMove/npc/messages，不要移動既有
元素；messages 是陣列索引制（`e` 對應 `messages[e]`），只能往後追加，
不可在中間插入。改完跑全量驗證 + render 自查。

## 素材座標驗證（▢ 條目與目錄外素材）

**絕對不要憑空猜測圖庫座標**——猜錯的後果是渲染出完全不相干的圖。
階段 1 的 precheck_tiles 會自動抓出大部分切錯的座標；其餘流程：

1. 裁切確認：
   `node .claude/skills/rpg-map-generator/scripts/crop_tile.cjs <b> <x> <y> <w> <h> /tmp/check.png`
   （批次對照用 `scripts/contact_sheet.cjs`，spec 一張 ≤12 筆）
2. Read 輸出圖：物件完整、無鄰格雜物、邊緣未截斷；不對就 ±32 調整重裁
3. 放進地圖後 render_map 截圖驗證，確認無誤把該條目升級為 ◇/✓ 並更新分冊
