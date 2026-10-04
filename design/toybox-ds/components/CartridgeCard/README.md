# CartridgeCard

作品卡帶：最上面一條標籤條（編號＋類型），像遊戲卡匣的貼紙。整張卡是一個 `<a>`。

| 部位 | 規格 |
| --- | --- |
| 卡身 | `border-m` `line`、`radius-lg`、`surface-raised`、`shadow-hard-m`、`overflow: hidden` |
| 標籤條 | Padding `space-1` `space-4`、`pixel-m` 22/24、底線 `border-m`；game 為 `pop` 底，tool 為 `surface-sunken` 底 |
| 截圖（game） | 16:9、`object-fit: cover`、底線 `border-m`；只收 WebP 640×360 |
| 內文區 | Padding `space-5`、直排 gap `space-3`、`flex-grow: 1` |
| 標題列 | tool 時左側 IconBox，間距 `space-3`；標題 `heading-m` 22/30 900 |
| 說明 | `body-s` 14/24 500、`ink-muted`，最多 3 行 |
| Tag 列 | gap `space-2`、`margin-top: auto`（同列卡片的 Tag 底部對齊） |

**States**：hover 浮起 3px＋`shadow-hard-l`；active 位移 5px、無陰影；focus-visible 外框 offset 3px。整張卡共用 `tb-lift`，卡內不再放其他可點元素。

**排列**：放在 `repeat(auto-fill, minmax(card-min, 1fr))` 的 grid，gap `grid-gutter`。1200 寬時 4 欄。
