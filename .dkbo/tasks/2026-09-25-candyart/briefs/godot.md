# 糖果消消樂全面美化（A 亮面經典） — 給 godot 的切片（波 3）
由 dk-wave-open 產生，只讀。完整 brief 在 /home/bal/project/collect/.dkbo/tasks/2026-09-25-candyart/brief.md。

## 目標
把糖果消消樂（Godot `godot-candy-src/` ＋ React `src/pages/CandyCrush/`）照方向稿 A「Glossy Classic 亮面經典」全面改成真糖果造型：棋子、特殊糖、背景、棋盤框、Godot banner、特效、React 頁首／工具列／載入畫面／HUD／結算／暫停／說明全部換新。
設計唯一依據：`$DK_ROOT/tasks/2026-09-25-candyart/design/spec.md` 與同目錄 `variant-A-*.webp`、`variant-A.pen`（B／C 不做），本 brief 與 spec 衝突時以 brief 為準。遊戲規則、關卡、bridge 協定不變。

## 全域約束（全文）
- 路徑一律用 `@/*` 別名，不得用相對路徑引入。
- 自訂 CSS class 一律用 `@apply` 套 Tailwind。
- 圖片只收 WebP，不得把 JPG／PNG 寫進 `src/`、`public/`、`godot-candy-src/`；PNG 等中間檔只准放自己的 scratchpad。
- 非同步請求與資料處理寫在 Zustand store action，元件只訂閱與調用。
- bridge 協定不動：`src/lib/candyBridge.ts`、`src/store/useCandyStore.ts`、`godot-candy-src/scripts/candy_bridge.gd` 只讀。
- 遊戲邏輯不動：`godot-candy-src/scripts/board.gd`、`godot-candy-src/data/**` 只讀，`tests/board_test.gd` 必須全綠。
- `godot-candy-src/project.godot`、`export_presets.cfg` 不改：維持 `gl_compatibility`、`variant/thread_support=false`；mipmap 取樣在節點上設。
- `src/index.css` 只准新增 `.candy-*` 前綴的 class 與 `@font-face`，不得修改既有 class（尤其 `.rpg-screen`、`.rpg-cabinet`，RpgRoom 與 GodotGame 共用）。
- 中文字型：spec 所有 Noto Sans TC 一律以站內既有字型代替，不新增中文字型檔；Godot 內文字只用英文與 Fredoka，不把中文字型打進 .pck。
- spec §5 的「合計 49 張」是筆誤，正確為 39 張；spec §4.1 說 linear filter「不需再設」是錯的，要設 `TEXTURE_FILTER_LINEAR_WITH_MIPMAPS`。
- 設計稿與 spec 在主樹 `$DK_ROOT/tasks/2026-09-25-candyart/design/`，只讀；要改 pen 稿先複製到自己的 scratchpad；worktree 內不得寫 `.dkbo/`。
- spec §9 三題採領導建議（關卡①使用者已確認）：HUD 移進畫面兩側（`.rpg-screen` 寬高比 <4:3 退回上方橫條）、素材從 `variant-A.pen` 匯出（稿裡沒有的由 assets 依 spec 補畫）、混搭只採 C 的「已引爆」脈動外發光（B 的巧克力豆不做）。

## 你的波次
| 波 | 型態 | 成員 | 做什麼 | 難度 | 完成條件 | 審查 |
|---|---|---|---|---|---|---|
| 3 | 實作 | godot | spec §7 全部特效（可拆到 `scripts/fx/**`、`shaders/**`），含粒子預算與 `[fx]` print；banner 若加彩色 modulate／閃光，先把 `banner_gradient.gdshader` 改成不靠「近白像素」辨識填色（波 2 審查 Minor 3）；最後 `pnpm candy:export` | L | AC6、AC11 | 預設 |

## 倉庫
/home/bal/project/collect/.worktrees/candyart
編輯一律用上面的 worktree 路徑；$DK_ROOT 指向主樹的 .dkbo/，只拿來跑 dk-msg 等 bin，不得當編輯路徑

## 你的檔案所有權
| 成員 | 可改 | 只讀 |
|---|---|---|
| godot | godot-candy-src/scripts/candy_piece.gd, godot-candy-src/scripts/board_view.gd, godot-candy-src/scripts/fx/**, godot-candy-src/shaders/**, godot-candy-src/resources/**, godot-candy-src/scenes/**, public/candy/** | godot-candy-src/scripts/board.gd, godot-candy-src/scripts/candy_bridge.gd, godot-candy-src/assets/**, godot-candy-src/data/**, godot-candy-src/tests/** |

## 共用契約（全文）
| 契約 | 擁有者 | 消費者 | 形狀／簽名 | 變更流程 |
|---|---|---|---|---|
| 糖果素材檔名與尺寸 | assets@波1 | godot@波2, godot@波3 | spec §5 的 39 個檔名，路徑 `res://assets/candy/<檔名>.webp`，@2x 像素如表；色名依 id：`red yellow green blue purple orange` | 改檔名或尺寸先 ESCALATE 給領導 |
| Fredoka 字型路徑 | assets@波1 | react@波1, godot@波2 | Godot：`res://assets/fonts/Fredoka-Bold.ttf`（檔名固定，內容可為 static Bold 或 variable）；網頁：`public/fonts/Fredoka-Bold.woff2`（`@font-face` family `Fredoka`、weight 700） | 改路徑先 ESCALATE 給領導 |

## 驗收標準（全文）
- [ ] AC1 素材：`godot-candy-src/assets/candy/` 有 spec §5 表列的 39 張 WebP（檔名與 @2x 像素尺寸逐一相符）；pen 稿缺的 7 張（黃綠紫橙 `wrapped_armed`、`fx_sugar`、`fx_stripe_beam`、`fx_ring`）依 spec §4.4／§7 補畫，`candy_bomb_sprinkles`、`bg_night`（去掉盤框與 HUD）、`board_frame`（九宮格）由稿拆圖層產出；目錄內沒有 PNG／JPG；每張都有 `.import`，`grep -L 'mipmaps/generate=true' godot-candy-src/assets/candy/*.import` 輸出為空。assets 另附一張 39 張拼成的對照表 WebP（放 scratchpad，路徑寫進 report）。
- [ ] AC2 字型：Fredoka 700（SIL OFL）放在 `godot-candy-src/assets/fonts/`（.ttf＋.import，static Bold 或 variable 皆可）與 `public/fonts/`（.woff2，可直接取 Google Fonts 的 wght 700 latin woff2），兩處都附 OFL 授權文字檔。
- [ ] AC3 棋子：`candy_piece.gd` 改用 Sprite2D 貼圖，`texture_filter = TEXTURE_FILTER_LINEAR_WITH_MIPMAPS`，依 `color_id`／`special` 顯示 6 色 × {一般、條紋橫、條紋直、包裝、已引爆} 與彩色炸彈共 31 種；貼圖缺檔時退回原本的 `_draw()` 幾何圖形。綠色是圓頂軟糖。`COLORS` 改用 spec §4.3 的本色。選取保留呼吸縮放（1.14↔0.98），並加 `fx_select_halo` 光暈同步脈動。
- [ ] AC4 盤面：背景 `bg_night` 以 cover 縮放鋪滿，寬螢幕兩側延伸不露底；棋盤框用 `board_frame` 九宮格；格子由程式畫 53×53、圓角 9，`#3A2C8C`／`#30237A` 交替。
- [ ] AC5 banner：`Level N`、`Sweet!`、`Tasty!`、`Divine!`、`Sweet Crush!`、`No more moves!` 依 spec §6.5 的字級、填色、外框、落影，字型 Fredoka。
- [ ] AC6 特效（spec §7 全表）：消除 squash＋`fx_flash`（ADD）＋`fx_sugar` 糖粒；連鎖第 k 層放大閃光與粒子；combo 字彈入、停留、上升淡出；條紋糖待機流光（shader 或 AnimationPlayer＋遮罩）與觸發 `fx_stripe_beam`；包裝糖扭結擺動、`fx_ring`＋4px 畫面震動；已引爆脈動外發光；彩色炸彈糖粒緩轉與 Line2D 電光；落地 squash；Sweet Crush 金色閃光連響。shader 只掛特殊糖。粒子預算：單次消除總粒子數＝min(300, Σ各格)，超過時各格等比例降低、每格最少 2 顆，每次消除 `print("[fx] particles=<N>")`。
- [ ] AC7 React HUD：以 `.rpg-screen` 容器寬高比為準，≥4:3 時 HUD 在遊戲畫面兩側（左：關卡牌、目標分數卡、步數糖球；右：4 顆圓鈕、分數卡＋星級進度條＋「下一顆星 N」），<4:3 退回上方橫條（4 顆圓鈕收進橫條）並用 A 的配色；步數 ≤5 轉紅並 1s 脈動；星級刻度維持 50/75/100%。樣式照 spec §6.1、§6.2；Fredoka 以 `@font-face` 從 `public/fonts/` 載入，網址要吃得到 vite `base: '/collect/'`。
- [ ] AC8 覆蓋層：結算（勝）照 §6.3（緞帶、星星依序彈出、分數 0.8s 滾動、三星「完美通關！」、最後一關「恭喜全部通關！」＋「從第 1 關再玩」）；結算（敗）、暫停、說明照 §6.4，說明的快捷鍵內容維持現狀不增不減。
- [ ] AC9 頁面其餘部分：`index.tsx` 的頁首 h1／副標、工具列、載入畫面（黑底＋Candy 圖示＋「載入中」）改成 A 的配色與字型。
- [ ] AC10 行為不變：分數、步數、星級、結算、暫停、靜音、全螢幕、說明全部仍由既有 bridge `STATE`／`LEVEL_END` 與既有 store 驅動；既有 `data-testid`（`page-candy-crush`、`hud-level`、`hud-score`、`result-stars` 等）全部保留；`DK_TEST_CMD`（eslint＋tsc＋vitest）全綠；`board_test.gd` 全綠。
- [ ] AC11 匯出：`pnpm candy:export` 產物更新到 `public/candy/`，`/collect/candy-crush` 載入遊戲無 console error，可正常交換、消除。
- [ ] AC12 qa 驗收：shot.mjs 截 960×540、1920×1080、1024×768（剛好 4:3，HUD 應在兩側）、1000×800（<4:3，應在上方；這兩張須在全螢幕模式下截，非全螢幕時 `.rpg-screen` 固定高 550、寬高比與視窗無關）、390×844 五種，每張標註對應的 AC 與比對的 variant-A 稿；39 張素材對照表與 `variant-A-candy-sheet.webp` 並排，逐格標「一致／差異：…」；結算勝／敗／最後一關三種畫面由腳本在頁面 context 發一則既有格式的 `LEVEL_END` postMessage 觸發（不改協定）；互動類特效附連拍；連鎖期間 Godot 每秒 `print("[fx] fps=<N>")`，qa 記錄 1920×1080 下的最低值交人判斷（不設門檻）。

## 同波成員
godot(L) qa(M)
