# NavLink

導覽列的膠囊連結。目前頁面用 `current`，會輸出 `aria-current="page"` 並填黃色。

| 項目 | 規格 |
| --- | --- |
| 高度 | `control-s` 44px |
| Padding | 0 `space-4` |
| 文字 | `label` 15/20 700 |
| 圓角 | `radius-pill` |
| 外框 | `border-m`：預設透明（保留位置，切換時不跳），current 時為 `line` |

**States**：default 透明底；hover `surface-sunken`；current `pop` 底＋`line` 框＋`on-fill` 字；focus-visible 外框。下拉（`menu`）在文字後加 16px `chevron-down`，間距 `space-1`。
