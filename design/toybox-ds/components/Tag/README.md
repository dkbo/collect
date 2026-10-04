# Tag

貼紙式標籤。`s` 用在卡帶上列技術棧；`l` 加 `tilt` 是 Hero 旁漂浮的貼紙。不可點；要可點請用 NavLink 或 SegmentedControl。

| 項目 | s（預設） | l（貼紙） |
| --- | --- | --- |
| Padding | `space-1` `space-3` | `space-2` `space-4` |
| 文字 | `caption` 13/18 700 | `label` 15/20 700 |
| 外框 | `border-s` `line` | `border-m` `line` |
| 圓角 | `radius-sm` | `radius-sm` |
| 陰影 | 無 | `shadow-hard-s` |
| 傾斜 | 無 | `tilt-1`／`tilt-2`／`tilt-3` |

**Tone**：`pop`、`sky`、`mint`、`pink`、`plain`（白底）；字一律 `on-fill`（plain 為 `ink`）。同一張卡上不指定 tone 時依序輪替 sky → mint → pink → pop，相鄰兩個不同色。顏色不承載語意，只為了好分辨，所以不要用顏色表示分類。
