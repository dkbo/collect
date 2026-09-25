# godot 報告（波 3）
## 做了什麼
- 新增 `scripts/fx/candy_fx.gd`（`CandyFx`，BoardView 的子節點 `Fx`，z 5：在糖果之上、banner 之下）：`flash`（fx_flash、ADD、本色、scale 0.4→1.3、alpha 1→0、0.18s）、`burst`（CPUParticles2D 用 fx_sugar，隨機角度＋旋轉，一次性）、`beam`（fx_stripe_beam 0.25s 展開到整盤寬，直向轉 90°）、`ring`（fx_ring 以 3×3 為基準 scale 0.3→1.6、0.3s）、`bolt`（Line2D 寬 3、目標色、ADD 鋸齒）；全部播完自毀。`particle_budget()`：總數＝min(300, Σ)，超過時每格先保底 2 顆，其餘依各格超出的量等比例分配（最大餘數法，總數剛好 300）。
- `board_view.gd`：
  - 消除：每格先 0.06s 放大到 1.15，再 TRANS_BACK 0.2s 縮到 0，同時播 flash＋糖粒。連鎖第 k 層閃光 ×(1+0.1k)、粒子 +2k。每次消除都會 `print("[fx] particles=<N>")`。
  - 特殊糖：`_expand_specials`／`_special_swap_effect` 會另外記 `_fx_delays`（每格的消除延遲）與 `_fx_events`，只影響動畫排程，removed 集合、計分、盤面都沒動。條紋：光束，且整排逐格延遲 0.02s。包裝（第一段與第二段）：衝擊波＋4px 畫面震動 0.15s。炸彈：由近到遠對每顆目標射一條電光、間隔 0.03s，全部到位後炸彈和目標一起消除。炸彈＋炸彈：盤心一記大閃光，整盤依離中心的距離向外波紋消除。
  - 落地：bounce 第一次觸地時（約 dur/2.75）做 scale (1.1, 0.9)→(1,1)、0.1s，併在同一個 tween 裡，`await` 也會等它做完。
  - Combo 字（Sweet!/Tasty!/Divine!）：scale 0.3→1.15→1.0、旋轉 −6°→0，共 0.25s；停 0.35s；再上升 20px 並淡出，0.25s。背後是放大 1.6 倍的 fx_flash 子節點（show_behind_parent、ADD、外框色、alpha 0.5）。其他 banner 動畫照舊。
  - Sweet Crush：剩餘步數逐顆轉條紋，每顆播一次金色（#ffc21a）flash＋`special` 音效，間隔 0.05s（原本開頭那一聲拿掉，改成每顆一聲）。
  - fps：`_resolve` 期間每秒 `print("[fx] fps=<N>")`，結束時再補一筆（連鎖不滿 1 秒也有資料）。
- `candy_piece.gd`：只有特殊糖掛 ShaderMaterial，每顆的 phase 隨機錯開；一般糖 material 為 null。
  - 條紋 → `shaders/candy_sheen.gdshader`：每 2.5s 一道 45°、寬 12px、歷時 0.4s 的白光，用貼圖 alpha 當遮罩。
  - 包裝／已引爆 → `candy_wrapped.gdshader`：兩側扭結以糖身邊緣為軸，±6° 鏡像擺動，1.2s 一輪。做法是局部 UV 旋轉並平滑衰減，糖身不動。
  - 炸彈 → `candy_bomb.gdshader`：原圖已烘了糖粒，所以先依 sprinkles 的遮罩，用周圍像素補掉原位糖粒，再疊上每 6s 轉一圈的 `candy_bomb_sprinkles`，最後把高光與鏡面點疊回最上層。
  - 已引爆包裝另用 tween 脈動 sprite：scale 1.0↔1.08、modulate 1.0↔1.3，0.6s 一輪，special 一改掉就停並復原。
  - 新增 `land_scale()`／`set_land()`。
- 匯出：`public/candy/index.pck` 1.47MB → 1.49MB，`index.html` 已更新。
- 目視（WSLg 非 headless、960×540 連拍）：`/tmp/claude-1000/-home-bal-project-collect--worktrees-candyart/ba8ba21d-6f1d-421c-bc5c-da99306e9b5a/scratchpad/shots/{idle,stripe,wrap,bomb,combo,crush}_sheet.png`，放大圖在 `idle_zoom.png`、`bomb_zoom.png`。流光、已引爆脈動、糖粒緩轉、光束＋逐格消除、衝擊波、電光、combo 字、金色閃光都有出現。

## 測試
新測試：`/tmp/claude-1000/-home-bal-project-collect--worktrees-candyart/ba8ba21d-6f1d-421c-bc5c-da99306e9b5a/scratchpad/fx_test.gd`，headless，共 10 組：配額、連鎖放大、fx 節點（貼圖／ADD／自毀）、shader 只掛特殊糖、已引爆脈動、落地 scale、combo 判定、特殊糖延遲與事件（條紋、包裝、炸彈、雙炸彈）、消除粒子總量、震動回原位。腳本一律在執行期 load()，舊碼會逐條記失敗。
### 紅
在未改動的 HEAD 438dcf2 上跑（worktree 尚未動任何檔，全文見 `/tmp/claude-1000/-home-bal-project-collect--worktrees-candyart/ba8ba21d-6f1d-421c-bc5c-da99306e9b5a/scratchpad/red.txt`）：
`godot --headless --path godot-candy-src -s /tmp/claude-1000/-home-bal-project-collect--worktrees-candyart/ba8ba21d-6f1d-421c-bc5c-da99306e9b5a/scratchpad/fx_test.gd`
```
FAIL: 缺 res://scripts/fx/candy_fx.gd
FAIL: special=1 應掛 candy_sheen
SCRIPT ERROR: Invalid call. Nonexistent function 'is_pulsing' in base 'Node2D (CandyPiece)'.
FAIL: board_view 缺 _fx_delays
SCRIPT ERROR: Invalid call. Nonexistent function 'shake' in base 'Node2D (BoardView)'.
fx_test: 17 FAIL
exit=1
```
### 綠
`godot --headless --path godot-candy-src -s /tmp/claude-1000/-home-bal-project-collect--worktrees-candyart/ba8ba21d-6f1d-421c-bc5c-da99306e9b5a/scratchpad/fx_test.gd`（worktree，改完後）
```
[fx] particles=34
[fx] particles=300
fx_test: ALL PASS
```
其他：
- `godot --headless --path godot-candy-src -s res://tests/board_test.gd` → `board_test: ALL PASS`
- 波 2 的 `art_test.gd`（c2e320ee…/scratchpad）→ `art_test: ALL PASS`，沒有回歸
- `godot --check-only`：`candy_fx.gd`、`candy_piece.gd` 無錯；`board_view.gd` 只有 autoload 的 `CandyBridge`（已知工具限制）。三支 shader 在 WSLg gl_compatibility 下實際渲染，沒有 shader 錯誤。
- 匯出：`godot --headless --path godot-candy-src --import && godot --headless --path godot-candy-src --export-release Web && node scripts/godot-webp-shell.mjs public/candy`（跟 `pnpm candy:export` 內容相同；worktree 內不跑 `pnpm <script>`）→ exit 0
- DK_TEST_CMD（eslint＋tsc＋vitest）→ `Tests 297 passed (297)`
- 連拍 log 的 fps（WSLg 桌面，不代表瀏覽器）：連鎖期間 30–116

## 自我審查
- 只改了所有權內的檔：`scripts/candy_piece.gd`、`scripts/board_view.gd`、`scripts/fx/candy_fx.gd(.uid)`、`shaders/candy_{sheen,wrapped,bomb}.gdshader(.uid)`、`public/candy/index.{html,pck}`。board.gd、bridge、data、tests、assets、project.godot、export_presets.cfg 都沒動，也沒有 PNG 進 repo。
- 遊戲邏輯：removed 集合與觸發數的算法沒變。`_expand_specials` 只是把「新加入的格」另外收進 `newly`，用來記延遲；`_fx_bomb` 只讀 targets。唯一的行為差異是動畫變長（延遲、電光、Sweet Crush 每顆 0.05s），這段時間 `_state` 仍是 ANIM、輸入鎖住。
- banner shader（波 2 Minor 3）沒改：本波沒有對 banner 加彩色 modulate 或閃光。combo 爆光是 Label 的子 Sprite（不繼承材質），Sweet Crush 的金色閃光打在糖上，不在 banner 上，所以「若加」的前提不成立。
- 排除紀錄：
  - 新 class_name 要 `--import` 才進全域類別快取；check-only 報 "Could not find type CandyFx"，重 import 後就消失。
  - 炸彈 shader 第一版用擬合的漸層蓋原位糖粒，高光區會留下白色糖粒輪廓；改成用周圍非糖粒像素補，就乾淨了。

## 疑慮
1. 包裝扭結 ±6° 是照 spec 做的，扭結只有約 12px 長，尖端位移約 1px（@1x），1× 下幾乎看不出來。要更明顯得加大 `amp_deg`，這要 designer／領導決定。
2. 炸彈高光區在補色後仍有極淡的紋路（`bomb_zoom.png`），56px 下不明顯。
3. 炸彈目標多時（例如 12 顆），消除會延後約 0.4s；炸彈＋炸彈的波紋約 0.15s。這兩個都是 spec 的間隔。
4. `fx_test.gd` 放在 scratchpad（tests/** 唯讀），同波 2 的 ruling 不進版控。

## 修正（reviewer-a Minor 1–4，領導 [TASK]）
- Minor 1：combo 彈入原本實際是 0.33s。原因是 scale→1.0 排在「scale→1.15（0.17s）∥rotation（0.25s）」那一段之後，要等 0.25s 那段結束才開始。改成 scale→1.0 也用 `parallel()`＋`set_delay(0.17)`，彈入總長變成 0.25s。`_animate_combo` 改成回傳 tween，方便測試。
- Minor 2：`candy_bomb.gdshader` 分支內的取樣（補色迴圈與 `sprinkle_mask`）全改 `textureLod(…, 0.0)`；分支外的 base 與旋轉糖粒仍用 `texture()`。重新連拍後炸彈外觀幾乎一樣（`/tmp/claude-1000/-home-bal-project-collect--worktrees-candyart/ba8ba21d-6f1d-421c-bc5c-da99306e9b5a/scratchpad/shots/bomb_zoom2.png`），高光區紋路略粗一點。WebGL 實機仍請 qa 看一眼。
- Minor 3：`candy_bomb_sprinkles` 載不到時，`_special_material` 回 null，炸彈就不掛 shader、只顯示原圖。
- Minor 4：`_resolve` 改用 `COMBO_TEXTS[mini(cascade - 1, COMBO_TEXTS.size() - 1)]`。
- 順手處理 Minor 5（測試不進版控）：`_test_shake` 改成暫停 tween 後用 `custom_step` 手推，不再依賴真實時間。
### 紅（修正）
fx_test 新增 `_test_combo_timing`（custom_step 0.26s 後 scale 應為 1.0、旋轉應為 0）與 `_test_bomb_no_sprinkles`（把 sprinkles 快取設成 null，炸彈不應有 material）。先只讓 `_animate_combo` 回傳 tween、還沒修時序，跑一次：
`godot --headless --path godot-candy-src -s /tmp/claude-1000/-home-bal-project-collect--worktrees-candyart/ba8ba21d-6f1d-421c-bc5c-da99306e9b5a/scratchpad/fx_test.gd`
```
FAIL: 0.26s 時已回到 1.0：(1.13125, 1.13125)
FAIL: 糖粒缺檔時炸彈不掛 shader
fx_test: 2 FAIL
```
（全文 `/tmp/claude-1000/-home-bal-project-collect--worktrees-candyart/ba8ba21d-6f1d-421c-bc5c-da99306e9b5a/scratchpad/red2.txt`）
### 綠（修正）
`godot --headless --path godot-candy-src -s /tmp/claude-1000/-home-bal-project-collect--worktrees-candyart/ba8ba21d-6f1d-421c-bc5c-da99306e9b5a/scratchpad/fx_test.gd` 連跑 3 次 → `fx_test: ALL PASS` ×3
- `godot --headless --path godot-candy-src -s res://tests/board_test.gd` → `board_test: ALL PASS`
- 匯出（與 `pnpm candy:export` 相同的指令鏈）→ exit 0，`public/candy/index.{html,pck}` 已更新
- `--check-only`：candy_piece 無錯；board_view 只有 autoload `CandyBridge`（已知工具限制）
- DK_TEST_CMD → `Tests 297 passed (297)`
