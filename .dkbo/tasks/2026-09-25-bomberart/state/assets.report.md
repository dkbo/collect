# assets 報告（波 1）

## 做了什麼
- 未下載第三方包，改走 AC1 允許的「自繪」路線：手寫 SVG（Toy Box 方向）→ Chromium headless-shell 透明底截圖成 PNG（只在 scratchpad）→ `cwebp` 轉 WebP。
- `public/battle/bomber/`：`fx_circle`／`fx_star`／`fx_smoke`／`fx_spark`（128×128，白色、柔邊，讓 babylon 端 tint）、`items_atlas.webp`（768×128，6 格 128×128：bomb、fire、speed、kick、throw、invincible；speed／invincible 用 `#3A2A00`，其餘白色，透明底）、`LICENSE.txt`（逐檔列原創／CC0）。
- 路徑與檔名完全照「bomber 素材路徑」共用契約，未改。

## 測試
### 紅
```
$ scratchpad/check.sh   # 檢查 5 檔存在、atlas 768x128、LICENSE、無 png/jpg、總量 ≤1.5MB
MISSING public/battle/bomber/fx_circle.webp … MISSING LICENSE
FAIL (exit 1)
```
### 綠
```
$ cwebp -quiet -q 90 -alpha_q 100 -exact fx_*.png -o public/battle/bomber/fx_*.webp
$ cwebp -quiet -lossless -z 9 -exact items_atlas.png -o public/battle/bomber/items_atlas.webp
$ scratchpad/check.sh
fx_circle 9764→3458 B | fx_star 4715→3606 B | fx_smoke 4548→3432 B | fx_spark 6264→2946 B | items_atlas 10464→4880 B（皆帶 Alpha）
total=18322  PASS
```
無程式碼改動，DK_TEST_CMD 不受影響。

## 自我審查
- 全 WebP、單張 ≤1024²、總量 18 KB（上限 1.5 MB）、目錄內無 png/jpg。
- 已在洋紅底預覽確認透明與圖形可辨識。

## 疑慮
- 自繪圖示比 Kenney 簡單；若 qa 截圖覺得不夠精緻可再換 Kenney Game Icons（CC0），檔名不變。
- 粒子為純白，顏色需由粒子系統 color1/color2 給。
