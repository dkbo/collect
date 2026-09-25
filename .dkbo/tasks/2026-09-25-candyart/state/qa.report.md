# candyart-qa 報告（波 3）

根目錄 `P=/tmp/claude-1000/-home-bal-project-collect--worktrees-candyart/5cfad731-1c91-46a8-bf47-c3f3d70fa0e0/scratchpad`（下文 `$P/…`）。
工具：`$P/tools/probe.mjs`（沿用波 2，新增 `fx` 模式＝`$P/tools/fx_mode.mjs`、play 模式加 `--budget`／`--bursts`／`--frames`）、`$P/tools/montage.py`（PIL 拼圖）、`$P/tools/sheet.py`。全部從 worktree 根目錄執行；dev server 為 worktree 的 `vite --port 5174`。
fx 模式用 master 既有的 e2e 指令 `DEBUG_SET_BOARD`／`DEBUG_SET_STATE`（`board_view.gd` 的 `_on_command`，不是本波新增）先鋪好含特殊糖的盤面，再用真實滑鼠拖曳觸發，所以每種特效都能重現。協定與程式碼都沒改。

## 做了什麼

### 逐條判定（本波負責 AC6、AC11、AC12）
| AC | 判定 | 證據 |
|---|---|---|
| AC6 特效 | ✅ | 下表逐項。粒子：每次消除都有 `[fx] particles=N`，觀測值 28–300，最大值 300 出現在雙炸彈清全盤與 Sweet Crush 時，封頂正確。`particle_budget()`（`candy_fx.gd:34`）＝ min(300, Σ)，超過時每格保底 2 顆、其餘依超出量等比例分配；godot 的 `fx_test.gd` 由我獨立重跑，ALL PASS。shader 只掛特殊糖也由 fx_test 覆蓋；待機畫面裡一般糖沒有流光（`$P/vid/crop-idle-zoom.webp`）。 |
| AC11 匯出 | ✅ | `public/candy/index.pck` 時間 01:47:10，晚於所有源碼的最後修改（`board_view.gd`／`candy_piece.gd`／`candy_bomb.gdshader` 01:45:51），`git status` 顯示 index.html／index.pck 已更新。`/collect/candy-crush` 在五種尺寸、fx、play、result 各 context 都能載入（READY 約 1.6s），pageErrors 皆為 []，沒有 Godot 錯誤。play 模式 3 次真實拖曳：moves 15→14→13→12、score 0→60→120→270。唯一的 console error 是 Geist 字型 403（worktree 環境問題，見疑慮 1）。 |
| AC12 qa 驗收 | ✅ | 五種尺寸、素材對照、結算三種、互動連拍、fps 見下面各節。1920×1080 最低 fps＝**24**，交人判斷（見 fps 節）。 |

### AC6 特效逐項（1920×1080，錄影抽格；影片 `$P/vid/video/page@2bb07a05dad6be51ca1e9194cc5bba82.webm`，960×540、25fps）
| 特效（spec §7） | 判定 | 抽格圖（檔內每格標時間） |
|---|---|---|
| 消除 squash＋`fx_flash`（ADD）＋`fx_sugar` 糖粒 | ✅ | `$P/vid/crop-stripe.webp` 0.2–0.4s、`crop-bomb.webp` 0.7–0.9s：格心有本色閃光、四角星糖粒飛散 |
| 連鎖第 k 層放大 | ✅（看得出來，未量尺寸） | 連鎖時 particles 逐層變多（例如 wrapped 情境 88→115→40）。閃光變大 ×(1+0.1k) 由 fx_test「連鎖放大」覆蓋 |
| Combo 字彈入、停留、上升淡出 | ✅ | `crop-wrapped.webp` 1.3–1.5s 的「Tasty!」有彈入、爆光、停留，接著淡出；`crop-crush-gold.webp` 有「Divine!」；`$P/fx/sheet-stripe.webp` 有「Tasty!」 |
| 條紋糖待機流光 | ✅ | `$P/vid/crop-idle-zoom.webp`：0.00s 黃色橫紋、1.60s 直紋那一列都有斜向白光掃過，各顆相位錯開 |
| 條紋觸發 `fx_stripe_beam` | ✅ | `crop-stripe.webp` 0.2–0.4s：橫條紋＋直條紋交換後出現十字光束，並逐格消除 |
| 包裝糖扭結擺動 | ⚠️ 肉眼難辨 | 幅度照 spec（±6°，尖端約 1px），截圖看不出來；godot 疑慮 1 已提出 |
| `fx_ring`＋4px 震動 | ✅ 衝擊波／震動只由測試覆蓋 | `crop-wrapped.webp` 0.1–0.3s 第一段、0.7–0.9s 第二段都有白色衝擊波環。4px 震動在 10fps 抽格裡看不出來，由 fx_test「震動回原位」覆蓋 |
| 已引爆脈動外發光 | ✅ | `crop-wrapped.webp` 0.3–0.7s 已引爆的粉紅糖明暗脈動；待機盤面第 6 列也有（`$P/fx/sheet-idle.webp`，逐格亮度不同） |
| 彩色炸彈糖粒緩轉＋Line2D 電光 | ✅ | `crop-bomb.webp` 0.3–0.7s：炸彈依序朝每顆紫糖射出紫色電光，全部到位後一起消除。糖粒緩轉（6s 一圈）在待機連拍中角度有變化 |
| 炸彈＋炸彈波紋 | ✅ | `$P/vid/crop-bomb2.webp` 0.5–0.9s：中心大閃光後由內向外整盤消除 |
| 落地 squash | ✅ 只由測試覆蓋 | 0.1s 太短，抽格抓不到；由 fx_test「落地 scale」覆蓋 |
| Sweet Crush 金色閃光連響 | ✅ | `$P/vid/crop-crush-gold.webp` 0.28–0.64s：「Sweet Crush!」出現後剩餘步數逐顆轉條紋，每顆有一下小閃光；`crop-crush2.webp` 1.0–1.4s 條紋全部觸發；結算為勝 3 星，分數 0.8s 滾動 |

### fps（AC12，1920×1080，headless Chromium＋SwiftShader 軟體渲染）
| 跑法 | fps 取值 | 最低 |
|---|---|---|
| fx 六情境，不截圖（`$P/fps/fx.json`） | 28,29,27,27,27,27,25,28,28,26,26,27,27 | 25 |
| play 自然交換 3 次（`$P/r/play.json`） | 25,27,24 | **24** |
| fx 同時錄影（`$P/vid/fx.json`） | 18–23 | 18（有錄影負擔，不算數） |
| fx 同時截圖（`$P/fx/fx.json`） | 20–29 | 20（有截圖負擔，不算數） |
回報值：沒有擷取負擔時最低 **24**。這是本機軟體渲染（無 GPU）的數字，不代表實機，門檻由人判斷。

### 五種尺寸（AC12，並回歸 AC4／AC7；`$P/r/sizes.json`）
| 檔案 | 視窗 | 模式／容器 | hudMode | 對應 AC | 比對稿 | 結果 |
|---|---|---|---|---|---|---|
| `$P/r/size-960x540.png` | 960×540 | 非全螢幕 840×550 | side | AC4、AC7 | variant-A-gameplay | 一致 |
| `$P/r/size-1920x1080.png` | 1920×1080 | 非全螢幕 946×550 | side | AC3、AC4、AC7 | variant-A-gameplay | 一致 |
| `$P/r/size-1024x768-fs.png` | 1024×768 | 全螢幕 1.333 | side | AC7（剛好 4:3） | variant-A-gameplay | 一致 |
| `$P/r/size-1000x800-fs.png` | 1000×800 | 全螢幕 1.25 | top | AC7（<4:3 橫條） | variant-A 配色 | 一致 |
| `$P/r/size-390x844.png` | 390×844 | mobile＋touch 318×450 | top | AC4、AC7 | variant-A 配色 | 一致 |
五張都是 Fredoka loaded、pageErrors []。另有 `-page.png` 整頁版。

### 回歸 AC3–AC5、AC7
- AC3：`$P/r/select-sheet.webp`（1920×1080，選取紅糖後放大，暖白光暈脈動）；31 種造型見 `$P/fx/sheet-idle.webp`（6 色 × 橫紋／直紋／包裝／已引爆＋炸彈）。✅
- AC4：五種尺寸背景都鋪滿，盤框與格子沒有變化。✅
- AC5：`$P/r/banner-sheet.webp` 第 1 格「Level 1」；Tasty!／Divine!／Sweet Crush! 見上面的特效抽格。✅（「No more moves!」本波沒有觸發）
- AC7：同上表。✅

### 結算三種（AC12，`$P/r/result.json`，1280×800，頁面 context 發既有格式 `LEVEL_END`）
| 情境 | 截圖 | 文案／按鈕 |
|---|---|---|
| 勝 3 星 | `$P/r/result-1280-win-3star-{150,450,1400}ms.png` | 第 1 關 通關！／完美通關！／result-replay、result-next |
| 勝 1 星 | `$P/r/result-1280-win-1star-*.png` | 再 1,016 分拿第二顆星 |
| 敗 | `$P/r/result-1280-lose-*.png` | 步數用完 挑戰失敗／result-replay |
| 最後一關 | `$P/r/result-1280-last-level-*.png` | 恭喜全部通關！／從第 1 關再玩（result-restart）；卡片 306–784，在畫面 251–801 內 |
另外，實際玩到過關的畫面（Sweet Crush 後自然送出 LEVEL_END）見 `crop-crush.webp`。

### 素材對照（AC12）
素材本波沒有變更（`git diff --stat HEAD -- godot-candy-src/assets` 為空）。重跑 `sheet.py` 結果為 `missing [] pngJpg []`，對照圖 `$P/r/sheet-vs-design.webp`。逐格判定與波 2 報告相同：1–33、38、39 一致；34 `fx_flash` 是白色素材靠 modulate 著色，符合 spec；35–37 稿上沒有，依 spec §5 補畫。

## 測試
### 紅
不適用: qa 驗收波，本身不寫實作或測試；fx 的取紅由 godot 在 HEAD 438dcf2 做過（godot.report.md：`fx_test: 17 FAIL`）。
不適用: 本波驗收過程沒有發現 bug，沒有需要重現的失敗。
### 綠
`godot --headless --path godot-candy-src -s /tmp/claude-1000/-home-bal-project-collect--worktrees-candyart/ba8ba21d-6f1d-421c-bc5c-da99306e9b5a/scratchpad/fx_test.gd` → `fx_test: ALL PASS`（qa 獨立重跑）
`godot --headless --path godot-candy-src -s res://tests/board_test.gd` → `board_test: ALL PASS`
`node_modules/.bin/eslint .` → exit 0；`node_modules/.bin/tsc -b --noEmit` → exit 0；`node_modules/.bin/vitest run` → `Test Files 25 passed (25) / Tests 297 passed (297)`
`node $P/tools/probe.mjs fx --out $P/fps --shots 0` → 6 情境全部觸發，particles 最大 300，fpsMin 25，pageErrors []
`node $P/tools/probe.mjs fx --out $P/vid --shots 0 --video 1` → 影片 45.16s；抽格用 `ffmpeg -ss <t> -t 1.6 -vf "fps=10,crop=270:270:345:180,…,tile=4x4"` → `$P/vid/crop-*.webp`
`node $P/tools/probe.mjs play --out $P/r --swaps 3 --bursts 0 --budget 200000` → moves 15→12、score 0→270、fps [25,27,24]、pageErrors []
`node $P/tools/probe.mjs sizes --out $P/r` → hudMode side/side/side/top/top，fredoka true，pageErrors []
`node $P/tools/probe.mjs result --out $P/r` → 4 種結算文案與按鈕正確，pageErrors []
`node $P/tools/probe.mjs select|banner --out $P/r` → exit 0
`python3 $P/tools/sheet.py …/design/variant-A-candy-sheet.webp $P/r/sheet-vs-design.webp` → missing []、pngJpg []

## 自我審查
- worktree 零改動：`git status` 只看到 godot 的檔。工具、截圖、影片都放在 scratchpad，`scripts/qa/candyart/**` 沒有寫入。
- 排除紀錄：
  - 第一次跑 play（16 格連拍 × 暴力找交換）500s 逾時被砍，原因是無效交換也在截圖、每張約 1s。改成拖曳後先等 60ms 看 STATE 的 moves 有沒有變，是有效交換才連拍，並加時間預算。
  - 截圖每張約 1s，抓不到 0.2s 的光束／衝擊波，所以改用 Playwright recordVideo 錄影，再用 ffmpeg 抽格。
  - 截圖或錄影本身會拉低 fps（最低降到 18–20），所以 fps 另外在不擷取的情況下量。
  - fx 情境 `stripe` 的第 0 格顏色看起來和設定相反，是因為抽格起點落在交換動畫之後，屬擷取時序，不是 bug。
- 未驗：「No more moves!」實機畫面；4px 震動與落地 squash 的像素量測（只靠 fx_test）；各連鎖層閃光的實際尺寸。

## 疑慮
1. dev 模式下 Geist 字型 403（`/@fs/…/@fontsource-variable/geist/…woff2`）：worktree 的 node_modules 是 symlink 到主樹、超出 vite `fs.allow`，與本任務無關，build 產物不受影響（同波 2 疑慮 3）。
2. 包裝糖扭結 ±6° 在 56px 下幾乎看不出來（同 godot 疑慮 1），要加大請領導或 designer 裁定。
3. Sweet Crush 開場時「Divine!」combo 字還沒淡完，「Sweet Crush!」就疊上來，約 0.05s（`crop-crush-gold.webp` 0.20–0.24s）。時間很短，不影響功能，列為觀察。
4. fps 24 是軟體渲染的數字，實機 GPU 應會更高；有沒有門檻由人判斷。
