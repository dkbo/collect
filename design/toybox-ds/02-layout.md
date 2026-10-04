# 版面

## 斷點（沿用 Tailwind 預設）

| 名稱 | 寬度 | 版面 |
| --- | --- | --- |
| base | < 640 | 單欄；`page-pad` 16px；字級套手機值 |
| `sm` | ≥ 640 | `page-pad` 24px；數字磚 4 欄 |
| `md` | ≥ 768 | 卡帶 2–3 欄 |
| `lg` | ≥ 1024 | 桌機版：Hero 兩欄、導覽全展開 |
| `xl` | ≥ 1280 | 內容寬度封頂 `container` 1200 |

## 桌機 Grid

- 容器：`max-width: container`（1200px）置中，左右 `page-pad` 24px → 內容實寬 **1152px**。
- 12 欄、gutter `grid-gutter` 24px → 每欄 **74px**。
- 常用跨欄寬：3 欄 = 270、5 欄 = 466、6 欄 = 564、7 欄 = 662、12 欄 = 1152。
- 卡帶 grid 不手寫跨欄，用 `repeat(auto-fill, minmax(card-min 260px, 1fr))`；1152 寬時剛好 4 欄（每張 = 3 欄寬）。

```
|<-24->|<------------------------ 1152 ------------------------>|<-24->|
       | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |      74px 欄 × 12，gutter 24
```

## 首頁結構

```
┌────────────────────────────── 全寬 ──────────────────────────────┐
│ SiteHeader  高 76，底線 border-m                                  │
├───────────────────── container 1200 ─────────────────────────────┤
│ Hero  上 space-18(72) 下 space-24(96)                            │
│ ┌──────── 欄 1–7 文案 ────────┐ ┌──── 欄 8–12 主視覺 ────┐        │
│ │ StatusPill                  │ │  Tag l 貼紙 ×3（絕對定位）│        │
│ │ H1 display-xl + 名字貼紙     │ │  Handheld（tilt-2）     │        │
│ │ 副標 heading-l              │ │                         │        │
│ │ 導言 body-l（≤520）          │ │                         │        │
│ │ Button primary + secondary  │ │                         │        │
│ │ StatTile × 4                │ │                         │        │
│ └─────────────────────────────┘ └─────────────────────────┘        │
├────────────────────────────── 全寬 ──────────────────────────────┤
│ Marquee（tilt-band，左右外推 20px）                               │
├───────────────────── container 1200 ─────────────────────────────┤
│ 作品區  上 space-24(96) 下 space-18(72)，直排 gap space-8         │
│ SectionHeader（欄 1–12，右側 SegmentedControl）                    │
│ FeatureCard（欄 1–12；內部 截圖 ≈7 欄 / 面板 ≈5 欄）               │
│ CartridgeCard grid（auto-fill 260 → 4 張 × 3 欄）                  │
├──────────────────────────────────────────────────────────────────┤
│ CtaPanel（欄 1–12），下 space-18(72)                               │
├────────────────────────────── 全寬 ──────────────────────────────┤
│ Footer  上框 border-m，Padding space-6，pixel-m 置中               │
└──────────────────────────────────────────────────────────────────┘
```

## 各區配置

| 區塊 | 桌機（≥ 1024） | 平板（640–1023） | 手機（< 640） |
| --- | --- | --- | --- |
| SiteHeader | Logo 左、NavLink 列＋主題鍵右 | Logo＋主題鍵＋選單鍵；選單展開成整寬面板 | 同平板 |
| Hero | 7／5 兩欄，`align-items: center`；文案欄直排 gap `space-6` | 堆疊：文案在上、掌機置中在下，間距 `space-14` | 同平板；H1 clamp、按鈕各自整寬、數字磚 2×2、貼紙隱藏 |
| Marquee | 全寬 | 同 | `pixel-l` 改 24px |
| 作品區 | SectionHeader 左右分置；FeatureCard 7／5；卡帶 4 欄 | SectionHeader 折行（控制項到下一行）；FeatureCard 上下堆疊；卡帶 2–3 欄 | 卡帶 1 欄 |
| CtaPanel | 文字欄與按鈕欄左右分置 | 折行 | Padding 改 `space-8` `space-6`；按鈕整寬 |

## 垂直節奏

| 位置 | 間距 |
| --- | --- |
| 主要區塊上下 | `space-24` 96（手機 `space-18` 72） |
| 短區塊（Hero 上、CTA 下） | `space-18` 72（手機 `space-12` 48） |
| 區塊標題 → 內容 | `space-8` 32 |
| 卡片之間 | `grid-gutter` 24 |
| 卡片內 | `space-5` 20／元素間 `space-3` 12 |

## 其他頁面套用

遊戲頁（Battle、RpgRoom、Godot、CandyCrush）：遊戲畫布本身不改，外框包一層「螢幕」：`inverse` 底、`border-l`、`radius-md`，上方一條 `pixel-m` 標題列（像 Handheld 的螢幕字幕）。工具頁（Todos、Search、Directions、MapDeveloper）：內容放在 `surface-raised` 物件裡，表單控制項高 `control-s`、`border-m`、`radius-md`、焦點同全系統。
