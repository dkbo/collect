# assets 報告（波 1）
## 做了什麼
- 把 `variant-A.pen` 複製到 scratchpad，用 `pencil interactive` headless 模式跑一支 execute 腳本（`/tmp/claude-1000/-home-bal-project-collect--worktrees-candyart/d90c74ac-265c-4d8c-b2a2-f15fea524701/scratchpad/build.js`，沒有啟動 AI agent）：每顆糖的 84×84 特寫 frame 放進 96×96、clip 的透明容器（相當於 64 邏輯單位畫布、每邊擴 6 格），`Export` png、scale 4/3 → 128×128；再用 `cwebp` 轉 WebP 寫進 `godot-candy-src/assets/candy/`。
- 稿內直接拆出（32 張）：6 色 × 一般／條紋橫／條紋直／包裝、紅／藍已引爆、`candy_bomb`；拆圖層產出：`candy_bomb_sprinkles`（刪掉巧克力球、高光、鏡面點，只留 14 條糖粒）、`bg_night`（Gameplay frame 刪掉 Board Frame、HUD Left、Top Buttons、HUD Right，scale 2 → 1920×1080）、`board_frame`（取 Board Frame 的填色／白邊／圓角 26 重建成 128 邏輯單位面板，scale 2 → 256×256）。`fx_select_halo`、`fx_flash` 取自稿內選取光暈與消除閃光，改成純白（給 modulate 著色）。
- 補畫 7 張：黃／綠／紫／橙 `wrapped_armed` 的做法是拿該色 `wrapped`，把 Wrapper 換成稿內紅色已引爆那一層的粉色填色、粉框、外發光（糖心與扭結保持原色）。同樣的做法另外產了一張藍色做驗證，和稿內原本的藍色已引爆目視一致。`fx_sugar`：四角星、白。`fx_stripe_beam`：水平柔光（垂直漸層 0→44%→0）加 8px 白色核心。`fx_ring`：白色徑向衝擊波圈（60% 以內透明、88% 最亮、100% 歸零）。
- `godot --headless --path godot-candy-src --import` 產生 39 個 `.import`，全部改成 `mipmaps/generate=true` 後重新 import（ctex 從 19956B 長到 30882B，mipmap 確實產生）。
- 字型：Google Fonts 的 Fredoka wght 700 **static** TTF 放在 `godot-candy-src/assets/fonts/Fredoka-Bold.ttf`（fc-scan：Fredoka Bold、非 variable，48588B），`.import` 由 Godot 產生；網頁用的 `public/fonts/Fredoka-Bold.woff2` 是 Google Fonts CSS2 的 latin 子集（U+0000-00FF 等，15900B）；兩處都放了 google/fonts 的 `OFL.txt`。
- 39 張對照表（8×5，每格標序號與檔名，底色 #30237A）：`/tmp/claude-1000/-home-bal-project-collect--worktrees-candyart/d90c74ac-265c-4d8c-b2a2-f15fea524701/scratchpad/candy-assets-sheet.webp`

### 39 張對照表
| # | 檔名 | 像素 | 來源 | cwebp 參數 | PNG → WebP（位元組） |
|---|---|---|---|---|---|
| 1 | `candy_red.webp` | 128x128 | 稿 | `-q 90 -m 6 -sharp_yuv -alpha_q 100` | 17109 → 6212 |
| 2 | `candy_red_stripe_h.webp` | 128x128 | 稿 | `-q 90 -m 6 -sharp_yuv -alpha_q 100` | 17166 → 6404 |
| 3 | `candy_red_stripe_v.webp` | 128x128 | 稿 | `-q 90 -m 6 -sharp_yuv -alpha_q 100` | 17675 → 6434 |
| 4 | `candy_red_wrapped.webp` | 128x128 | 稿 | `-q 90 -m 6 -sharp_yuv -alpha_q 100` | 18553 → 7032 |
| 5 | `candy_red_wrapped_armed.webp` | 128x128 | 稿（特殊狀態列） | `-q 90 -m 6 -sharp_yuv -alpha_q 100` | 22671 → 7704 |
| 6 | `candy_yellow.webp` | 128x128 | 稿 | `-q 90 -m 6 -sharp_yuv -alpha_q 100` | 15732 → 5062 |
| 7 | `candy_yellow_stripe_h.webp` | 128x128 | 稿 | `-q 90 -m 6 -sharp_yuv -alpha_q 100` | 15317 → 5472 |
| 8 | `candy_yellow_stripe_v.webp` | 128x128 | 稿 | `-q 90 -m 6 -sharp_yuv -alpha_q 100` | 15581 → 5522 |
| 9 | `candy_yellow_wrapped.webp` | 128x128 | 稿 | `-q 90 -m 6 -sharp_yuv -alpha_q 100` | 18696 → 6970 |
| 10 | `candy_yellow_wrapped_armed.webp` | 128x128 | 補畫（該色 wrapped＋粉色玻璃紙） | `-q 90 -m 6 -sharp_yuv -alpha_q 100` | 22595 → 7694 |
| 11 | `candy_green.webp` | 128x128 | 稿 | `-q 90 -m 6 -sharp_yuv -alpha_q 100` | 17397 → 6460 |
| 12 | `candy_green_stripe_h.webp` | 128x128 | 稿 | `-q 90 -m 6 -sharp_yuv -alpha_q 100` | 16570 → 6728 |
| 13 | `candy_green_stripe_v.webp` | 128x128 | 稿 | `-q 90 -m 6 -sharp_yuv -alpha_q 100` | 16822 → 6732 |
| 14 | `candy_green_wrapped.webp` | 128x128 | 稿 | `-q 90 -m 6 -sharp_yuv -alpha_q 100` | 20229 → 7072 |
| 15 | `candy_green_wrapped_armed.webp` | 128x128 | 補畫（該色 wrapped＋粉色玻璃紙） | `-q 90 -m 6 -sharp_yuv -alpha_q 100` | 23056 → 7842 |
| 16 | `candy_blue.webp` | 128x128 | 稿 | `-q 90 -m 6 -sharp_yuv -alpha_q 100` | 15303 → 5192 |
| 17 | `candy_blue_stripe_h.webp` | 128x128 | 稿 | `-q 90 -m 6 -sharp_yuv -alpha_q 100` | 14804 → 5412 |
| 18 | `candy_blue_stripe_v.webp` | 128x128 | 稿 | `-q 90 -m 6 -sharp_yuv -alpha_q 100` | 15038 → 5552 |
| 19 | `candy_blue_wrapped.webp` | 128x128 | 稿 | `-q 90 -m 6 -sharp_yuv -alpha_q 100` | 19360 → 6922 |
| 20 | `candy_blue_wrapped_armed.webp` | 128x128 | 稿（特殊狀態列） | `-q 90 -m 6 -sharp_yuv -alpha_q 100` | 22892 → 8014 |
| 21 | `candy_purple.webp` | 128x128 | 稿 | `-q 90 -m 6 -sharp_yuv -alpha_q 100` | 17038 → 5386 |
| 22 | `candy_purple_stripe_h.webp` | 128x128 | 稿 | `-q 90 -m 6 -sharp_yuv -alpha_q 100` | 16334 → 5582 |
| 23 | `candy_purple_stripe_v.webp` | 128x128 | 稿 | `-q 90 -m 6 -sharp_yuv -alpha_q 100` | 16897 → 5594 |
| 24 | `candy_purple_wrapped.webp` | 128x128 | 稿 | `-q 90 -m 6 -sharp_yuv -alpha_q 100` | 19329 → 6738 |
| 25 | `candy_purple_wrapped_armed.webp` | 128x128 | 補畫（該色 wrapped＋粉色玻璃紙） | `-q 90 -m 6 -sharp_yuv -alpha_q 100` | 22680 → 7722 |
| 26 | `candy_orange.webp` | 128x128 | 稿 | `-q 90 -m 6 -sharp_yuv -alpha_q 100` | 20177 → 6750 |
| 27 | `candy_orange_stripe_h.webp` | 128x128 | 稿 | `-q 90 -m 6 -sharp_yuv -alpha_q 100` | 19838 → 6912 |
| 28 | `candy_orange_stripe_v.webp` | 128x128 | 稿 | `-q 90 -m 6 -sharp_yuv -alpha_q 100` | 20166 → 6926 |
| 29 | `candy_orange_wrapped.webp` | 128x128 | 稿 | `-q 90 -m 6 -sharp_yuv -alpha_q 100` | 19182 → 6916 |
| 30 | `candy_orange_wrapped_armed.webp` | 128x128 | 補畫（該色 wrapped＋粉色玻璃紙） | `-q 90 -m 6 -sharp_yuv -alpha_q 100` | 22959 → 7886 |
| 31 | `candy_bomb.webp` | 128x128 | 稿 | `-q 90 -m 6 -sharp_yuv -alpha_q 100` | 22928 → 6868 |
| 32 | `candy_bomb_sprinkles.webp` | 128x128 | 拆圖層 | `-q 90 -m 6 -sharp_yuv -alpha_q 100` | 5453 → 3810 |
| 33 | `fx_select_halo.webp` | 160x160 | 稿（改白） | `-lossless -z 9` | 9841 → 5932 |
| 34 | `fx_flash.webp` | 192x192 | 稿（改白） | `-lossless -z 9` | 15750 → 9842 |
| 35 | `fx_sugar.webp` | 32x32 | 補畫 | `-lossless -z 9` | 471 → 256 |
| 36 | `fx_stripe_beam.webp` | 1024x64 | 補畫 | `-lossless -z 9` | 2035 → 702 |
| 37 | `fx_ring.webp` | 384x384 | 補畫 | `-near_lossless 40 -z 9` | 48051 → 18640 |
| 38 | `bg_night.webp` | 1920x1080 | 拆圖層 | `-q 85 -m 6 -sharp_yuv` | 1050899 → 14280 |
| 39 | `board_frame.webp` | 256x256 | 拆圖層 | `-lossless -z 9` | 12770 → 7284 |

合計 264458 位元組（約 0.28MB）。

## 測試
驗收檢查腳本 `/tmp/claude-1000/-home-bal-project-collect--worktrees-candyart/d90c74ac-265c-4d8c-b2a2-f15fea524701/scratchpad/check_assets.sh`（逐一比對 39 個檔名與 @2x 尺寸（webpinfo）、檔數 =39、三個目錄沒有 png/jpg、每張都有 `.import`、`grep -L 'mipmaps/generate=true'` 為空、字型與 OFL 兩處都在）。
### 紅
`/tmp/claude-1000/-home-bal-project-collect--worktrees-candyart/d90c74ac-265c-4d8c-b2a2-f15fea524701/scratchpad/check_assets.sh`（素材產出前）
```
COUNT != 39
NOMIPMAP grep: /home/bal/project/collect/.worktrees/candyart/godot-candy-src/assets/candy/*.import: No such file or directory
MISSING godot-candy-src/assets/fonts/Fredoka-Bold.ttf
MISSING godot-candy-src/assets/fonts/Fredoka-Bold.ttf.import
MISSING godot-candy-src/assets/fonts/OFL.txt
MISSING public/fonts/Fredoka-Bold.woff2
MISSING public/fonts/OFL.txt
FAIL
```
### 綠
`/tmp/claude-1000/-home-bal-project-collect--worktrees-candyart/d90c74ac-265c-4d8c-b2a2-f15fea524701/scratchpad/check_assets.sh`（產出並 import 之後）
```
expected=39 actual_webp=39
ALL PASS
```
另外：
- `grep -L 'mipmaps/generate=true' godot-candy-src/assets/candy/*.import` → 無輸出
- `godot --headless --path godot-candy-src -s tests/board_test.gd` → `board_test: ALL PASS`
- DK_TEST_CMD（eslint＋tsc＋vitest，在共用 worktree 跑，含 react 夥伴進行中的改動）→ `Test Files 25 passed (25) / Tests 292 passed (292)`

## 自我審查
- 檔名、尺寸對上契約（spec §5 的 39 個名字、色名依 id）；目錄內只有 .webp 與 .webp.import；PNG 中間檔只在 scratchpad。
- 糖果本體的落影、內緣、高光、鏡面點直接用 pen 稿的效果算繪，沒有重畫，所以和 `variant-A-candy-sheet.webp` 同源；已引爆外發光在 128 畫布邊緣之前就已淡到接近 0，放大檢查沒有硬邊。
- 沒改任何程式碼與 `project.godot`；`godot --import` 只在 `.godot/`（gitignore）寫快取，另外產生了所有權內的 `.import` 檔。

## 疑慮
1. **board_frame 落影**：spec 同時要求 256×256、九宮格邊距 56px@2x（=28 邏輯）、圓角 26、底部落影。圓角 26＋1 的內縮已經用掉 27／28，稿上的大落影（y+12 blur 28）放不進邊距（放進去會被拉伸變形）。目前的做法：面板 (1,1) 126×125 邏輯、圓角 26、白 3px 邊 #ffffff55，只烘一層淺落影（y+1.5 blur 2）；面板底色用稿的漸層 #2e2178→#1a1150 加 90% 不透明（spec 寫「半透明面板」，稿上是不透明）。**godot 要的大落影建議另外畫**（StyleBoxFlat shadow，或在 NinePatchRect 底下再放一層）。九宮格四邊都是 56px（貼圖像素）；因為貼圖是 @2x，NinePatchRect 要以 0.5 倍縮放，或用 2 倍大小再 scale 0.5，才會是 28 邏輯單位的角。
2. 補畫的 `fx_*` 三張是依 spec §7 的文字描述畫的，形狀與強度可能要等 godot 做完特效再微調；需要調整就 QUESTION 我，檔名與尺寸不動。
3. `fx_flash` 光芒幾乎填滿 96 邏輯畫布（92/96），godot 放大到 1.3 時請以中心為 pivot。
