# SiteHeader

全站導覽列：左邊 Logo（黃色方塊＋字標），右邊 NavLink 列與主題切換 IconButton。不黏頂、不透明、不毛玻璃。

| 項目 | 規格 |
| --- | --- |
| 高度 | 最小 `header-h` 76px（44 控制項＋上下 `space-4`） |
| 內容寬 | `container` 1200px 置中，左右 `page-pad` |
| 底線 | `border-m` `line`，底色 `surface` |
| Logo 方塊 | `control-s` 44² 、`pop` 底、`border-m`、`radius-md`、`shadow-hard-s`，字母 `pixel-l` 30px |
| 字標 | `heading-m` 22px 900、字距 0.02em，與方塊間距 `space-3` |
| 導覽間距 | `space-2`；IconButton 前多 `space-2` |

**響應**：≥ 1024px 全展開；< 1024px 收成 Logo＋主題鍵＋`menu` IconButton，選單從下方展開成整寬面板（`surface-raised`、`border-m`、`radius-lg`、`shadow-hard-m`），NavLink 改成整寬列。
