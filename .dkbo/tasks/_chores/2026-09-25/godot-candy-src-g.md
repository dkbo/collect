交代：糖果消消樂（godot-candy-src/，Godot 4 2D、gl_compatibility、Web 匯出）全面美化的『方向稿』，不改任何程式。現況：棋子是 scripts/candy_piece.gd 的 _draw() 幾何圖形（紅圓、黃方、綠三角、藍菱、紫六角等，另有條紋／包裝／炸彈特殊糖，見 _draw_special_overlay/_draw_bomb），深藍灰背景、8x8 棋盤。先讀 candy_piece.gd、board_view.gd、scenes/CandyMain.tscn 與 project.godot 取得格子尺寸、視窗大小、所有糖果種類與 UI 元素（分數、步數、關卡目標、結算畫面等）。方向已由使用者拍板：真糖果造型（Candy Crush 式光滑立體、高光、糖紙質感），範圍全改（棋子、特殊糖、背景、棋盤框、HUD、關卡／結算畫面）。產出 2–3 套不同風格變體的整體畫面 mockup（同一盤面、同尺寸），每套附一張全部糖果種類（含特殊糖與炸彈）的單顆特寫表，以及各變體的色票與材質要點；再寫 spec.md：推薦哪一套與理由、每顆糖果的尺寸／外框／高光／陰影做法、要切成哪些 WebP 素材清單（檔名、尺寸、是否需 @2x）、特效建議（消除閃光、combo 字、特殊糖流光）但只描述不實作。一律照角色檔用 pen interactive＋--preview-output，禁 --prompt/--tasks，匯出 webp。全部產出寫到主樹 .claude/.superpower/specs/candy-redesign/（不要寫 docs/ 或 repo 根目錄）。完成 dk-msg leader "[DONE] <推薦變體＋產出路徑>"。
成員：chore-designer-1 (claude / M)
status: working
touched:
結果：
status: done
touched:
  - .claude/.superpower/specs/candy-redesign/spec.md
  - .claude/.superpower/specs/candy-redesign/variant-{A,B,C}.pen
  - .claude/.superpower/specs/candy-redesign/variant-{A,B,C}-{gameplay,result,candy-sheet}.webp
結果：推薦 A Glossy Classic 亮面經典（最像 Candy Crush 硬糖、6 色＋形狀辨識最佳、配站內深色、全靜態貼圖效能最省）。
- 做法：pen interactive --out … --preview-output …，stdin 餵 execute，Export() 出 webp（未用 --prompt/--tasks）。產生器腳本在 scratchpad（未進 repo）。
- --preview-output 有帶但沒加 --enable-preview，所以沒產出 preview png（空的 .exports/ 已 rmdir）。
- 自查：9 張 webp 都逐張看過；已知弱點都寫進 spec §2（B 的選取光暈看不清、C 發光太吵）。
- 待裁決：spec §9（HUD 要不要移進兩側、素材匯出或重繪、要不要混搭）。

---
關閉：2026-09-25T00:17 done — 推薦 A Glossy Classic 亮面經典；3 套 mockup（遊戲/結算/特寫表 webp＋.pen）與 spec.md 在 .claude/.superpower/specs/candy-redesign/，待裁決見 spec §9
