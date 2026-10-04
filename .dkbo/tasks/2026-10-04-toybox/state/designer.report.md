# designer 報告（波 1）
## 做了什麼

AC1 產出齊全，全部在 `.dkbo/tasks/2026-10-04-toybox/design/`（主樹任務目錄）：

- `pages-spec.md`（17 節）：§0 共用頁面骨架（PageHead 用 SectionHeader 版式但輸出 `<h1>`）、§1 ScreenFrame `tb-screen`、§2 表單控制項 `tb-input`／`tb-select`／`tb-textarea`＋提示條＋分隔線、§3 Battle 大廳（GameList／GameMenu／Room 未開局與開局／SoloGame／BabylonCanvas、TouchControls 非 HUD 外觀）、§4 遊戲頁共用零件（工具列、說明對話框、按鍵對照、暫停／載入浮層、NPC 對話框、控制器面板）、§5 SiteHeader 補充（下拉、手機選單、載入中、頁尾）、§6 首頁手機／深色＋About／Journey／CodeSnippet 三區、§7 Resume、§8 Todos、§9 Search、§10 Directions、§11 MapDeveloper、§12 MiniGame、§13 GodotGame、§14 RpgRoom、§15 CandyCrush 外框、§16 NotFound、§17 稿與規格對照表。全部寫成 toybox token utility（`bg-surface-raised`、`text-heading-m`、`rounded-toy-md`、`shadow-hard-m`、`border-3`、`h-11`…）。
- 15 張 webp（`page-<route>.webp`，1440 寬；首頁手機與選單 390 寬）＋同名 `.pen`：battle、resume、todos、search、directions、map-developer、minigame、godot-game、rpgroom、candy-crush、not-found、home-390、home-dark、home-menu、home-sections。
- 稿可重畫：`node design/.src/build.mjs <name>`（`.src/prelude.js` 元件畫法、`.src/pages/*.js` 各頁），走 `pen interactive` 的 `execute` 並在同一次 execute 內 `Export` webp。

優先三節（Battle、ScreenFrame、表單控制項）先寫完，已 `dk-msg react-theme` 告知（exit 0 送達）。

規格裡的幾個決定（都寫在對應節內）：
- 畫面內全螢幕鈕維持 `size-9`（36px），不放大到 44：凍結的炸彈超人 HUD 右欄是依 `size-9` 讓位的（`index.css` 炸彈 HUD 區段註解），放大會壓到 P2 卡。
- 遊戲頁（MiniGame、Godot、RPG、Candy）的欄寬維持 `max-w-4xl mx-auto`，跟現在 `rpg-cabinet` 一樣寬，遊戲解析度不變；畫面區高度沿用 `h-[450px] md:h-[550px]`。
- CandyCrush：HUD、浮層、`candy-loading` 都不動（屬凍結區段）；只換 PageHead、工具列、外框改 ScreenFrame，新 class 用 `candy-page-` 前綴，不重用 `candy-num` 等舊名。
- MiniGame 是 2D canvas（`getContext('2d')`），ScreenFrame meta 寫 `CANVAS 2D`。
- 觸控動作鍵的字（💣🧤✋）是遊戲資料（部分在凍結的 `*Hud.ts`），照原樣顯示，只換按鈕外觀。
- Directions 原本沒有頁首，依 §0 新增 PageHead「地圖導覽」（沿用導覽列名稱）。
- MapDeveloper 屬性分頁三個標籤太長，270 欄寬改用直排 SegmentedControl，不截斷。
- emoji 當段落標記（⚙️🧍📸💡⚠️）改 lucide 圖示，文字保留；地圖標記訊息內的 emoji 屬資料內容，沿用。
- Room 的「等待房主」用虛線框表示空插槽（`border-dashed`），內放 StatusPill。

## 測試
### 紅
不適用: 設計波，不寫程式碼，只產出 spec.md、.pen 與 webp 稿，沒有可跑的測試。
不適用: 同上（驗證改以匯出的 webp 對照 spec 自查，見下）。
### 綠
不適用: 設計波，不寫程式碼，只產出 spec.md、.pen 與 webp 稿，沒有可跑的測試。
不適用: 同上（驗證改以匯出的 webp 對照 spec 自查，見下）。

以匯出的 webp 與 spec 自查：
- `node design/.src/build.mjs <15 個 name>` → 15 張全部 `ok`；尺寸 1440 寬（home-390、home-menu 為 390 寬）。
- 逐張看過匯出圖並修正：卡帶 Tag 列溢出（改兩個一列）、Handheld 貼紙壓到螢幕（移位）、首頁手機 FeatureCard Tag 溢出、遊戲欄未置中、Journey 軸線缺失、MapDeveloper 分頁字截斷、文案與現有原文不符（Godot／RPG 導言、Search 推薦詞與歡迎文、MapDeveloper 面板名與匯出鈕、各說明對話框按鍵對照）。
- `grep -noE 'text-(xs|sm|base|lg|xl|[2-9]xl)\b|text-\[|bg-\[#|rounded-(sm|md|lg|xl|2xl|3xl)\b|shadow-(sm|md|lg|xl|2xl)\b|font-(sans|mono)\b|(purple|indigo|violet|fuchsia)-[0-9]' pages-spec.md` → 只剩「拿掉 `h-8 text-xs`／`font-mono`／`rounded-3xl`」這類描述舊樣式的字樣；原本 §3.6 的 `text-3xl` 已改 `text-pixel-l`。
- 每節都有元件清單（名稱同 toybox-ds）、版面（12 欄或單欄）、頁面專屬元件的尺寸／Padding／文字層級／狀態、深色差異（無特別差異者寫明只靠 token）。

## 自我審查
- AC1 清單逐項對照：Resume、Todos、Search、Directions、MapDeveloper、MiniGame、GodotGame、RpgRoom、CandyCrush（外框）、Battle 大廳（GameMenu、GameList、Room、SoloGame）、NotFound 各一節一張；首頁 390、深色、手機選單展開各一張；About／Journey／CodeSnippet 在 §6 並有 `page-home-sections.webp`。ScreenFrame（`inverse` 底、`border-4`、`rounded-toy-md`、`pixel-m` 標題列）與表單控制項（`h-11`、`border-3`、`rounded-toy-md`）照 AC1 寫法。
- 共用契約：只用契約內的 token／utility 名，沒有發明新的 token；頁面專屬 class 都有頁名前綴，舊名（`rpg-cabinet`、`rpg-screen`、`candy-num`、`timeline-*`、`todo-*`）一律換新名。
- 稿與 spec 衝突時以 spec 為準（稿是示意，例如稿裡 Resume 用兩欄固定排，spec 寫瀑布流 `md:columns-2`）。
- 檔案範圍：只寫 `design/**` 與自己的 state／report；`.exports/` 只放建置暫存，結束時是空的。

## 疑慮
- 角色檔寫的匯出方式是 `pen --in … --export … --export-type webp`，但 pen CLI 這個形式必須帶 `--prompt`（會另起 agent，角色檔禁止）；我改在 `pen interactive` 的 execute 裡呼叫 `Export(..., "webp")`，同樣是 pen 匯出。headless 模式沒有內建瀏覽器（`browser` 工具回「requires the pen.dev desktop app」），所以稿全部用 execute 一個節點一個節點畫。
- `public/works/battle.webp` 是舊版紫色 Battle 頁的截圖，首頁 FeatureCard 與 Handheld 螢幕會用到；改版後這張截圖風格會跟新站不搭。本任務規定不新增圖檔，建議改版完成後另開雜務重截。
- Google 地圖、InfoWindow 的白底不跟深色主題走（§10 已註明），qa 量深色對比時要排除地圖本體。
- `page-home-dark.webp` 沒畫 Journey（三區的樣式在 `page-home-sections.webp`），深色只靠 token 切換，不另做規格。
