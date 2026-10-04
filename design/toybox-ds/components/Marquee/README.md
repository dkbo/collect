# Marquee

斜放的反白跑馬燈，用來切開 Hero 與作品區。整頁最多一條。

| 項目 | 規格 |
| --- | --- |
| 底 | `inverse`，上下框 `border-m` `line` |
| 傾斜 | `tilt-band`（-1deg）；外層需 `overflow-x: hidden`，左右各外推 20px 讓斜邊不露底 |
| 文字 | `pixel-l` 30/32、字距 0.06em、`pop`、全大寫英數 |
| Padding | 上下 `space-3` |
| 分隔符 | `★`，前後各一個空白 |

**動態**：可選。若捲動，等速 40s 一圈、hover 暫停、`prefers-reduced-motion` 時靜止。螢幕閱讀器只讀一次項目清單（軌道本身 `aria-hidden`）。
