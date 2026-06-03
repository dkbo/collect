# Tile Catalog（貼圖目錄）— 總覽

兩張拼圖圖庫的全物件索引，依用途分冊存於 `tile-catalog/`：

| 分冊 | 內容 |
|---|---|
| [tile-catalog/indoor-structure.md](tile-catalog/indoor-structure.md) | 室內結構：地板、牆、天花板、樓梯、門窗、地毯、簾幕 |
| [tile-catalog/indoor-furniture.md](tile-catalog/indoor-furniture.md) | 室內家具：桌椅床櫃、廚房、書房、商店、壁爐、裝飾、物品道具 |
| [tile-catalog/outdoor.md](tile-catalog/outdoor.md) | 室外：地形、樹木花草、柵欄、建築外觀、小鎮、碼頭、墓園、遺跡 |
| [tile-catalog/usage-stats.md](tile-catalog/usage-stats.md) | 既有地圖使用統計（`extract_tile_catalog.py` 自動產出） |

## 圖庫檔案

| b | 檔案 | 尺寸 | 內容概要 |
|---|---|---|---|
| 0 | `man.png` | 128×1344 | 角色 spritesheet（7 隻角色 × 4 方向 × 4 幀） |
| 1 | `rpg_maker_xp.png` | 256×12000 | 室外為主：地形/樹木/村鎮/建築/教堂/遺跡 |
| 2 | `rpg_maker_xp2.png` | 256×7000 | 室內為主：家具/廚房/商店/道具（內容止於 y≈6592） |

## 驗證等級（分冊表格「驗」欄）

- **✓ 實機**：已在現有地圖使用、遊戲內確認過，可直接照抄。
- **◇ 裁切**：已用裁切工具確認圖像完整正確，未實機；可用，建議入圖後截圖看一眼。
- **▢ 區域**：切片瀏覽判讀，**座標可能偏 ±32px**——使用前必須先裁切驗證。

## 座標驗證工具

```bash
# 單一素材裁切（4x 放大、藍底凸顯透明）
node .claude/skills/rpg-map-generator/scripts/crop_tile.cjs <b> <x> <y> <w> <h> /tmp/check.png

# 批次接觸圖（多素材一張圖對照，spec 為 JSON 陣列 [{n,b,x,y,w,h}]）
node .claude/skills/rpg-map-generator/scripts/contact_sheet.cjs /tmp/spec.json /tmp/sheet.png
```

讀取輸出圖確認：物件完整、無鄰格雜物、邊緣未截斷，才能寫進地圖 JSON。
若不完整就 ±32 調整重裁。**絕不憑空猜座標**。

## 角色 spritesheet（b=0, man.png）

- 每格 32×48；橫向 4 幀（npc.x 控制）、縱向 4 方向列。
- 7 隻角色，每隻佔 192px 高：`npc.y` ∈ {0, 192, 384, 576, 768, 960, 1152}。
- 方向列偏移：0=下、48=左、96=右、144=上（引擎以 `npc.y + dirOffset` 取列）。
