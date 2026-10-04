# SectionHeader

每個主要區塊的開頭：點陣眉標＋大標題，右側可放一個控制項（SegmentedControl、「看全部」Button s）。

| 部位 | 規格 |
| --- | --- |
| 排列 | flex-wrap、`justify-content: space-between`、`align-items: flex-end`、gap `space-5` |
| 眉標 | `pixel-m` 22/24、`ink-muted`，格式「— 英文大寫 —」 |
| 標題 | `display-l` 48/53 900（手機 34px），`text-wrap: balance` |
| 眉標與標題 | 間距 `space-2` |
| 與下方內容 | `space-8` |

眉標用遊戲語彙（SELECT GAME、HIGH SCORE、CONTINUE?），只用英數；標題用中文說清楚是什麼。
