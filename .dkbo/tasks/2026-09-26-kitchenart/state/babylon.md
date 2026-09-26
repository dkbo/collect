status: done
wave: 3
current: qa BUG-1（出餐台箭頭反向）已 FIXED；review Important 1 已 FIXED；全閘綠 514
touched:
  - src/babylon/fx/emitter.ts
  - src/babylon/fx/look.ts
  - src/babylon/fx/textures.ts
  - src/babylon/games/bomberFx/effects.ts
  - src/babylon/games/bomberFx/textures.ts
  - src/babylon/games/kitchenFx/board.ts
  - src/babylon/games/kitchenFx/effects.ts
  - src/babylon/games/kitchenFx/effectsModel.ts
  - src/babylon/games/kitchenFx/effectsModel.test.ts
  - src/babylon/games/kitchenFx/hudModel.ts
  - src/babylon/games/kitchenFx/hudModel.test.ts
  - src/babylon/games/kitchenFx/models.ts
  - src/babylon/games/kitchenFx/models.test.ts
  - src/babylon/games/kitchenFx/orders.ts
  - src/babylon/games/kitchenFx/orders.test.ts
  - src/babylon/games/kitchenFx/palette.ts
  - src/babylon/games/kitchenFx/textures.ts
  - src/babylon/games/overcooked.ts
todo: []
report: state/babylon.report.md
notes: N1=78（perfFill，含 4 進度提示＋2「!」＋場外地面＋粒子；面板已拆）；78+3×3=87≤90（d 仍估 3）
notes2: bundle gzip：Battle +16.4KB、vendor-babylon −1.2KB（vite 數字）
notes3: 倒數在 swiftshader 載入太慢拍不到，程式同 bomber（uiCamera＋UI_LAYER＋COUNTDOWN_THEME），請 qa 在 preview 目視
notes4: 曝光 1.3／對比 1.2 僅 kitchen（LookOptions 新可選欄位，bomber 預設不變）；5175 已關
