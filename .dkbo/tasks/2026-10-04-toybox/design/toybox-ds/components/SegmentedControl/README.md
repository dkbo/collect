# SegmentedControl

2–4 個互斥選項的篩選器，看起來像一排連在一起的實體按鍵。超過 4 個改用 Tag 列或下拉。

| 項目 | 規格 |
| --- | --- |
| 外框 | `border-m` `line`、`radius-md`、`shadow-hard-s`，`overflow: hidden` |
| 選項 | 高 `control-s` 44px、最小寬 76px、Padding 0 `space-5` |
| 分隔線 | 選項之間 `border-m` `line`（左框） |
| 文字 | `button-text` 15px 900 |

**States**：default `surface-raised`／`ink`；hover `surface-sunken`；selected（`aria-pressed="true"`）`inverse` 底＋`pop` 字；focus-visible 內縮外框（offset -6px，避免被裁）。選中態不用陰影位移，避免整排跳動。
