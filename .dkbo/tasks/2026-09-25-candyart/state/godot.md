status: done
wave: 3
current: reviewer-a Minor 1–4 已修並重新匯出（[FIXED]）
touched:
  - godot-candy-src/scripts/board_view.gd
  - godot-candy-src/scripts/candy_piece.gd
  - godot-candy-src/scripts/fx/candy_fx.gd
  - godot-candy-src/scripts/fx/candy_fx.gd.uid
  - godot-candy-src/shaders/candy_bomb.gdshader
  - godot-candy-src/shaders/candy_bomb.gdshader.uid
  - godot-candy-src/shaders/candy_sheen.gdshader
  - godot-candy-src/shaders/candy_sheen.gdshader.uid
  - godot-candy-src/shaders/candy_wrapped.gdshader
  - godot-candy-src/shaders/candy_wrapped.gdshader.uid
  - public/candy/index.html
  - public/candy/index.pck
todo: []
report: state/godot.report.md
notes: qa 可用 console 的 [fx] particles=／[fx] fps= 驗 AC6／AC12；fps 只在 _resolve 期間每秒印＋結束補一筆。
  特殊糖觸發動畫排程在 board_view 的 _fx_delays／_fx_events。測試 fx_test.gd 與連拍 fx_shot.gd 在 ba8ba21d…/scratchpad。
