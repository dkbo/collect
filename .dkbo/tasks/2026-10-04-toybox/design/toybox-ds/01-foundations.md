# 基礎

所有數值都來自 `tokens.json`，元件不准自帶數字。下表的名稱就是 CSS 變數名（`--surface`、`--space-6`…）。

## 1. 色彩

### 中性與文字

| Token | Light | Dark | 用途 |
| --- | --- | --- | --- |
| `surface` | `#fffbf2` | `#17140f` | 頁面底，全頁唯一底色 |
| `surface-raised` | `#ffffff` | `#241f18` | 物件底：卡帶、按鈕、數字磚 |
| `surface-sunken` | `#e9e2d6` | `#332c23` | hover 底、工具卡帶標籤條、disabled |
| `ink` | `#17140f` | `#fff8ec` | 主要文字＋描邊＋硬陰影 |
| `ink-muted` | `#4a4339` | `#cfc5b5` | 次要文字（≥ 7:1） |
| `line` | = `ink` | = `ink` | 所有描邊 |
| `focus` | = `ink` | = `ink` | 焦點外框 |

### 品牌與貼紙

| Token | Light | Dark | 用途 | 上面的字 |
| --- | --- | --- | --- | --- |
| `pop` | `#ffce2e` | `#ffce2e` | 品牌黃：「這裡」 | `on-fill` |
| `action` | `#ff6b3d` | `#ff7a4f` | 主要行動、A/B 鍵 | `on-fill`（6:1） |
| `sky` | `#8fd6ff` | 同 | 貼紙、IconBox | `on-fill` |
| `mint` | `#9be3b0` | 同 | 貼紙 | `on-fill` |
| `pink` | `#ffb3d1` | 同 | 貼紙 | `on-fill` |
| `success` | `#2bb673` | `#3fd18a` | 狀態點，只當小面積訊號 | — |
| `on-fill` | `#17140f` | `#17140f` | 色塊上的字；深色主題也不反白 | — |

### 反白區

| Token | Light | Dark | 用途 |
| --- | --- | --- | --- |
| `inverse` | `#17140f` | `#0b0907` | 跑馬燈、CTA 面板、掌機螢幕 |
| `on-inverse` | `#ffffff` | `#fff8ec` | 反白區標題 |
| `on-inverse-muted` | `#e9e2d6` | `#cfc5b5` | 反白區內文 |

反白區的點綴字用 `pop`。

**用色比例（每個畫面）**：`surface`／`surface-raised` 約 70%、`ink` 墨線與文字約 15%、`pop` ≤ 10%、`action` ≤ 3%、貼紙色合計 ≤ 5%。

**深色主題**：底與物件變深、`ink` 變米白，所以墨線與硬陰影也跟著變米白；`pop`、`action`、貼紙色幾乎不變，上面的字維持深色 `on-fill`。

## 2. 字體

| 角色 | 字族 | 載入 | 用在 |
| --- | --- | --- | --- |
| `display` | Rubik → Noto Sans TC | Rubik 500/700/900 | 標題、按鈕、Logo。拉丁字走 Rubik 圓潤字形，中文自動落到 Noto Sans TC |
| `sans` | Noto Sans TC → Rubik | Noto Sans TC 500/700/900 | 內文、標籤 |
| `pixel` | VT323 | 400 | 數字、眉標、編號。**只放英數**，中文沒有點陣字形 |

### 字級表（桌機）

| Style | 字族 | 字級／行高 | 字重 | 用在 | 手機 |
| --- | --- | --- | --- | --- | --- |
| `display-xl` | display | 76 / 82 | 900（-0.01em） | Hero H1 | `clamp(44px, 6vw, 76px)` |
| `display-l` | display | 48 / 53 | 900 | 區塊 H2 | 34 / 40 |
| `heading-l` | display | 36 / 44 | 900 | 主打卡帶標題、CTA 標題、Hero 副標 | 26 / 34 |
| `heading-m` | display | 22 / 30 | 900 | 卡帶標題、Logo 字標 | 不變 |
| `button-text` | display | 16 / 20 | 900 | 按鈕、分段控制（s 號 15） | 不變 |
| `body-l` | sans | 17 / 30 | 500 | Hero 導言（最寬 520px） | 16 / 28 |
| `body` | sans | 16 / 28 | 500 | 主打說明、CTA 內文 | 不變 |
| `body-s` | sans | 14 / 24 | 500 | 卡帶說明 | 不變 |
| `label` | sans | 15 / 20 | 700 | 導覽、StatusPill、大貼紙 | 不變 |
| `caption` | sans | 13 / 18 | 700 | Tag、數字磚標籤 | 不變 |
| `pixel-xl` | pixel | 46 / 42 | 400 | 數字磚 | 40 / 38 |
| `pixel-l` | pixel | 30 / 32 | 400 | 跑馬燈、Logo 字母 | 24 / 28 |
| `pixel-m` | pixel | 22 / 24 | 400 | 眉標、標籤條、Meta | 不變 |

只有三種字重：500（讀）、700（標）、900（喊）。不用 400／600。中文內文不要小於 14px。

## 3. 間距（4px 基準）

| Token | px | 典型用途 |
| --- | --- | --- |
| `space-1` | 4 | Tag 上下內距、標籤條上下 |
| `space-2` | 8 | Tag 間距、圖示與文字、導覽項目間 |
| `space-3` | 12 | 數字磚間、卡帶內元素、Tag 左右內距 |
| `space-4` | 16 | 按鈕群組、Header 上下 |
| `space-5` | 20 | 卡帶內距、分段控制左右 |
| `space-6` | 24 | 頁面邊距、Grid gutter、按鈕左右 |
| `space-8` | 32 | 主打面板內距、標題到內容 |
| `space-10` | 40 | CTA 左右內距 |
| `space-12` | 48 | CTA 上下內距 |
| `space-14` | 56 | 堆疊後 Hero 文案與掌機的距離 |
| `space-18` | 72 | 短區塊上下留白 |
| `space-24` | 96 | 主要區塊上下留白 |

同層兄弟元素一律用父層 `gap`，不在子元素上加 margin。

## 4. 圓角、外框、陰影

| Token | 值 | 用在 |
| --- | --- | --- |
| `radius-sm` | 8 | Tag、徽章 |
| `radius-md` | 14 | 按鈕、IconButton、IconBox、數字磚、分段控制、螢幕 |
| `radius-lg` | 18 | 卡帶 |
| `radius-xl` | 26 | 主打卡帶、CTA 面板、掌機 |
| `radius-console` | 64 | 掌機右下角（唯一） |
| `radius-pill` | 999 | 導覽、StatusPill、Start/Select |
| `border-s` | 2px | Tag、狀態點 |
| `border-m` | 3px | 預設外框、焦點外框、區塊分隔線 |
| `border-l` | 4px | 主角物件 |
| `shadow-hard-s` | 3 3 0 ink | 44px 小物件、貼紙 |
| `shadow-hard-m` | 5 5 0 ink | 按鈕、卡帶 |
| `shadow-hard-l` | 8 8 0 ink | hover 狀態、主打卡帶、掌機 |
| `shadow-hard-action` | 8 8 0 action | CTA 面板 |

**規則**：圓角跟著物件大小走，越大越圓；外框越粗代表越重要；陰影永遠 0 模糊、往右下、顏色是 `ink`（或 `action`）。

## 5. 傾斜

| Token | 值 | 用在 |
| --- | --- | --- |
| `tilt-1` | -3deg | Hero 名字貼紙 |
| `tilt-2` | 3deg | 掌機 |
| `tilt-3` | -7deg | 漂浮技術貼紙 |
| `tilt-band` | -1deg | 跑馬燈 |

內文、卡帶、按鈕、導覽永遠不傾斜。

## 6. 互動狀態（全系統共用一套）

| 狀態 | 大物件（按鈕 l、卡帶） | 小物件（44px 控制項） |
| --- | --- | --- |
| default | `shadow-hard-m` | `shadow-hard-s` |
| hover | `translate(-3px,-3px)` + `shadow-hard-l` | `translate(-2px,-2px)` + `shadow-hard-m` |
| active | `translate(5px,5px)` + 無陰影 | `translate(3px,3px)` + 無陰影 |
| focus-visible | `border-m` `focus` 外框、offset 3px | 同左 |
| disabled | `surface-sunken` 底、`ink-muted` 字與框、無陰影、不位移、`not-allowed` | 同左 |
| selected／current | 換底色（`pop` 或 `inverse`），不靠陰影 | 同左 |

轉場：`transform`、`box-shadow` 120ms ease-out；`prefers-reduced-motion: reduce` 時取消轉場（狀態本身保留）。觸控裝置沒有 hover，active 仍要有。
