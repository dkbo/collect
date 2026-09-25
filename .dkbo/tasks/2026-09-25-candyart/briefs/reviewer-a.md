# 糖果消消樂全面美化（A 亮面經典） — 波 task 審查（reviewer 切片）
你是本波的 reviewer：只讀、不改碼、不跑會寫入的指令。意見只給領導（`dk-msg leader`），不直接對 dev 說。

## 要讀的
1. 差異包 /home/bal/project/collect/.dkbo/tasks/2026-09-25-candyart/waves/task.diff（commit 清單、stat、-U10 diff；含未 commit 的工作樹）
2. 完整 brief /home/bal/project/collect/.dkbo/tasks/2026-09-25-candyart/brief.md（驗收標準、共用契約、所有權）
3. 本波成員：

## 全域約束（全文，逐條當硬要求檢查）
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

## 本任務累積的 Minor
- minor 1: 兩側 HUD 縮放 k 無下限，剛過 4:3 時字級過小 src/pages/CandyCrush/candyHud.ts:19
- minor 1: 3★ 刻度畫在 96% 而非 100% src/pages/CandyCrush/CandyHud.tsx:32
- minor 1: 初始 layout 寫死 side，useEffect 才量，手機首幀閃兩側 HUD src/pages/CandyCrush/index.tsx:22
- minor 1: TopBar 沒吃 safe-area-inset-top、320px 寬第一列可能重疊 src/pages/CandyCrush/CandyHud.tsx:142
- minor 1: 2★ 門檻用 ceil，Godot 用 int 捨去，奇數目標差 1 src/pages/CandyCrush/candyHud.ts:29
- minor 1: board_frame 未烘大落影，已交波 2 godot 補畫 godot-candy-src/assets/candy/board_frame.webp:1
- minor 1: 新增 @keyframes candy-* 不在全域約束字面內，已裁定允許 src/index.css:1039
- minor 1: Fredoka woff2 內部 family 名為 Fredoka Light，不影響渲染 public/fonts/Fredoka-Bold.woff2:1
- minor 1: AC12 的 4:3 臨界截圖需全螢幕，已改 brief src/pages/CandyCrush/index.tsx:85
- minor 2: FrameShadow 實心 shadow 可能透過半透明框壓暗框內 godot-candy-src/scripts/board_view.gd:102
- minor 2: 320px 精簡橫條第二列星級條可能被擠到十幾 px src/pages/CandyCrush/CandyHud.tsx:120
- minor 2: banner 漸層 shader 以近白像素辨識填色，彩色 modulate 會失效 godot-candy-src/shaders/banner_gradient.gdshader:18
- minor 2: 四列 banner 落影 y=4 為推定值 godot-candy-src/scripts/board_view.gd:34
- minor 2: 缺檔退回 _draw() 綠色仍是三角形 godot-candy-src/scripts/candy_piece.gd:137
- minor 2: Minor 1 框內影子經 qa 實測未偏暗，不修 godot-candy-src/scripts/board_view.gd:102
- minor 2: FitDialog 縮放無下限，極矮全螢幕按鈕觸控區過小 src/pages/CandyCrush/CandyOverlays.tsx:37
- minor 3: combo 彈入總長 0.33s 非 spec 0.25s godot-candy-src/scripts/board_view.gd:819
- minor 3: 炸彈 shader 分支內隱式導數取樣，部分 WebGL 可能閃點 godot-candy-src/shaders/candy_bomb.gdshader:33
- minor 3: sprinkles 缺檔時炸彈被蓋成白色 godot-candy-src/scripts/candy_piece.gd:132
- minor 3: combo 文字清單兩處重複 godot-candy-src/scripts/board_view.gd:413
- minor 3: scratchpad fx_test 的 shake 測試依賴真實時間會假紅（不進版控）godot-candy-src/scripts/board_view.gd:1

上面每一條是先前各波放掉的風格／可讀性意見。逐條判：哪些**必須**在 merge 前修掉、
哪些可以留著。判定寫進報告的 `## Minor` 段開頭，一條一行。

## 報告寫到 /home/bal/project/collect/.dkbo/tasks/2026-09-25-candyart/state/reviewer-a.report.md，格式固定
## 規格合規
（逐條驗收標準 ✅/❌，缺漏寫明）
## Important
（會出錯、違反 brief 或契約、越界改檔；每條附 file:line）
## Minor
（風格、可讀性；每條附 file:line）

## 完成
state 檔 `status: done`，然後 `dk-msg leader "[DONE] review 波 task: Important N 條，見 report"`。
