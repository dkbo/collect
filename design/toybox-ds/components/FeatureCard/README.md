# FeatureCard

主打卡帶：一頁最多一張，放在作品 grid 上方、跨滿 12 欄。左邊大截圖、右邊黃色資訊面板。

| 部位 | 規格 |
| --- | --- |
| 卡身 | `border-l` `line`、`radius-xl`、`shadow-hard-l`、橫向 flex-wrap |
| 截圖欄 | `flex: 7 1 480px`（約 7/12），最小高 300px，`object-fit: cover` |
| 徽章 | 左上 `space-4`；Padding `space-1` `space-3`、`action` 底、`border-m`、`radius-sm`、`pixel-m` |
| 面板 | `flex: 5 1 340px`（約 5/12）、Padding `space-8`、gap `space-4`、`pop` 底、左框 `border-l` |
| Meta | `pixel-m` 22/24（編號・人數・模式） |
| 標題 | `heading-l` 36/44 900 |
| 說明 | `body` 16/28 500 |
| Tag | Tag s，面板內一律白底（`surface-raised`），避免黃底上的彩色貼紙打架 |
| CTA | 假按鈕（整張卡已是連結）：高 `control-s`、Padding 0 `space-5`、`inverse` 底＋`pop` 字、`radius-md`，貼齊面板底部 |

**States**：同 CartridgeCard（hover 浮起、active 按下、focus 外框）。寬度 < 860px 時兩欄自然折成上下：截圖在上、面板在下，面板左框改看起來像上框也可接受。
