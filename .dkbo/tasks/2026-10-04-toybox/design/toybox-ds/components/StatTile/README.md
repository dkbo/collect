# StatTile

像計分板的數字磚。4 個一組放在 Hero 文案下方，grid `repeat(auto-fit, minmax(118px, 1fr))`、gap `space-3`。

| 項目 | 規格 |
| --- | --- |
| Padding | `space-3` `space-4` |
| 數字 | `pixel-xl` 46/42，`ink`；後綴（如 `+`）同字級 |
| 標籤 | `caption` 13/18 700，`ink-muted`，與數字間距 `space-1` |
| 外框／圓角／底 | `border-m` `line`／`radius-md`／`surface-raised` |

靜態元件、無陰影、不可點。數字可以在進入畫面時從 0 跳到目標值（只跑一次，`prefers-reduced-motion` 時直接顯示）。只放真實數字，不湊數。
