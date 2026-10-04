# IconButton

只有圖示的方形按鈕：主題切換、手機選單。一定要傳 `label`（變成 `aria-label`）。

| 項目 | 規格 |
| --- | --- |
| 尺寸 | `control-s` 44 × 44 |
| 圖示 | `icon-m` 20px，筆畫 2.5px，顏色 `ink` |
| 外框／圓角 | `border-m` `line`／`radius-md` |
| 底色／陰影 | `surface-raised`／`shadow-hard-s` |

**States**：與 Button 同一套（小號）：hover 位移 -2px + `shadow-hard-m`；active 位移 3px、無陰影；focus 外框；disabled 同 Button。
