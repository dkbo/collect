# CtaPanel

頁尾前的反白行動區塊，「CONTINUE?」的遊戲結束畫面。一頁一個。

| 部位 | 規格 |
| --- | --- |
| 面板 | `inverse` 底、`border-l` `line`、`radius-xl`、`shadow-hard-action`（橘紅偏移陰影） |
| Padding | `space-12` `space-10`；文字欄與按鈕欄 gap `space-8`，可折行 |
| 眉標 | `pixel-m` 22/24、`pop` |
| 標題 | `heading-l` 36/44 900、`on-inverse` |
| 內文 | `body` 16/28 500、`on-inverse-muted`，最寬 560px |
| 按鈕 | Button l，gap `space-4`；放在面板內時陰影改為 `on-inverse` 色（`tb-on-inverse`），主按鈕用 `pop` variant |

不在面板裡放 `primary`（橘紅）按鈕：面板陰影已經是 action 色。
