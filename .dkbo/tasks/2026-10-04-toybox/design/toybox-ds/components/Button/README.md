# Button

按下去會「陷進去」的實體按鍵：3px 墨線、14px 圓角、5px 硬陰影，hover 浮起、active 位移 5px 吃掉陰影。

| 項目 | 規格 |
| --- | --- |
| 高度 | l = `control-l` 52px（預設）；s = `control-s` 44px |
| Padding | l：0 `space-6`；s：0 `space-4` |
| 文字 | `button-text` 16/20 900（s 為 15px） |
| 圖示 | `icon-m` 20px，與文字間距 `space-2` |
| 外框／圓角 | `border-m` `line`／`radius-md` |
| 陰影 | l：`shadow-hard-m`；s：`shadow-hard-s` |

**Variants**：`primary`（`action` 底＋`on-fill` 字，每畫面最多一顆）、`secondary`（`surface-raised`）、`pop`（`pop` 黃，用在 inverse 底上）、`ink`（`inverse` 底＋`pop` 字）。

**States**：hover → `translate(-3px,-3px)` + `shadow-hard-l`；active → `translate(5px,5px)` + 無陰影；focus-visible → `border-m` `focus` 外框、offset 3px；disabled → `surface-sunken` 底、`ink-muted` 字與框、無陰影、不位移。轉場 120ms ease，`prefers-reduced-motion` 時關閉。

文字用動詞開頭、不加驚嘆號：「開始玩」「開房間」。外部連結在文字後加 `arrow-up-right`。
