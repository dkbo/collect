# 元件總表

每個元件的完整規格與預覽在 Components 分頁；這裡是一頁看完的對照表。所有值都是 token，表中不出現裸數字的地方就代表沿用 token。

## 尺寸與容器

| 元件 | 高度／尺寸 | Padding | 外框 | 圓角 | 底 | 陰影 |
| --- | --- | --- | --- | --- | --- | --- |
| Button l | `control-l` 52 | 0 `space-6` | `border-m` | `radius-md` | 依 variant | `shadow-hard-m` |
| Button s | `control-s` 44 | 0 `space-4` | `border-m` | `radius-md` | 依 variant | `shadow-hard-s` |
| IconButton | 44 × 44 | — | `border-m` | `radius-md` | `surface-raised` | `shadow-hard-s` |
| NavLink | 44 | 0 `space-4` | `border-m`（透明→`line`） | `radius-pill` | 透明／`pop` | — |
| SiteHeader | ≥ `header-h` 76 | `space-4` `page-pad` | 底 `border-m` | — | `surface` | — |
| StatusPill | ≈ 42 | `space-2` `space-4` | `border-m` | `radius-pill` | `surface-raised` | — |
| Tag s | ≈ 30 | `space-1` `space-3` | `border-s` | `radius-sm` | 貼紙色 | — |
| Tag l | ≈ 42 | `space-2` `space-4` | `border-m` | `radius-sm` | 貼紙色 | `shadow-hard-s` |
| StatTile | ≈ 82 | `space-3` `space-4` | `border-m` | `radius-md` | `surface-raised` | — |
| IconBox | 44 × 44 | — | `border-m` | `radius-md` | 貼紙色 | — |
| SegmentedControl | 選項 44 × ≥ 76 | 選項 0 `space-5` | `border-m`＋分隔 | `radius-md` | `surface-raised` | `shadow-hard-s` |
| CartridgeCard | 依內容 | 內文 `space-5` | `border-m` | `radius-lg` | `surface-raised` | `shadow-hard-m` |
| FeatureCard | ≥ 300 | 面板 `space-8` | `border-l` | `radius-xl` | `pop` 面板 | `shadow-hard-l` |
| SectionHeader | 依內容 | — | — | — | — | — |
| Marquee | ≈ 62 | 上下 `space-3` | 上下 `border-m` | — | `inverse` | — |
| CtaPanel | 依內容 | `space-12` `space-10` | `border-l` | `radius-xl` | `inverse` | `shadow-hard-action` |
| Handheld | 寬 ≤ 380 | `space-6` / 下 `space-8` | `border-l` | `radius-xl`＋`radius-console` | `pop` | `shadow-hard-l` |

## 文字層級

| 元件 | 主要文字 | 次要文字 | 點陣字 |
| --- | --- | --- | --- |
| Button | `button-text` | — | — |
| NavLink | `label` | — | — |
| SiteHeader | `heading-m`（字標） | — | `pixel-l`（Logo 字母） |
| StatusPill | `label` | — | — |
| Tag | `caption`（s）／`label`（l） | — | — |
| StatTile | — | `caption` `ink-muted` | `pixel-xl` |
| SegmentedControl | `button-text` 15 | — | — |
| CartridgeCard | `heading-m` | `body-s` `ink-muted` | `pixel-m`（標籤條） |
| FeatureCard | `heading-l` | `body` | `pixel-m`（Meta、徽章） |
| SectionHeader | `display-l` | — | `pixel-m` 眉標 |
| Marquee | — | — | `pixel-l` `pop` |
| CtaPanel | `heading-l` `on-inverse` | `body` `on-inverse-muted` | `pixel-m` `pop` |
| Handheld | — | — | `pixel-m`（字幕、型號）、`pixel-l`（A/B） |

## 狀態矩陣

| 元件 | hover | active | focus-visible | disabled | selected／current |
| --- | --- | --- | --- | --- | --- |
| Button | 浮起 3＋`shadow-hard-l` | 陷 5、無陰影 | 外框 | 有 | — |
| IconButton | 浮起 2＋`shadow-hard-m` | 陷 3 | 外框 | 有 | — |
| NavLink | `surface-sunken` 底 | — | 外框 | — | `pop` 底＋`line` 框 |
| SegmentedControl | `surface-sunken` 底 | — | 內縮外框 | — | `inverse` 底＋`pop` 字 |
| CartridgeCard | 浮起 3＋`shadow-hard-l` | 陷 5 | 外框 | — | — |
| FeatureCard | 浮起 3 | 陷 5 | 外框 | — | — |
| Handheld A/B | — | 陷 3 | 外框 | — | — |
| StatusPill、Tag、StatTile、IconBox、SectionHeader、Marquee、CtaPanel | 不可點，無互動狀態 | | | | |

## 組合規則

- 一頁：Handheld ≤ 1、FeatureCard ≤ 1、Marquee ≤ 1、CtaPanel ≤ 1、`primary` Button 每個畫面 ≤ 1。
- 卡片內不再放可點元件（整張卡是一個連結）。
- 黃底（`pop`）物件上不放彩色貼紙：FeatureCard 面板內的 Tag 一律白底。
- 反白（`inverse`）區內的按鈕用 `pop`／`secondary`，陰影改 `on-inverse` 色。
