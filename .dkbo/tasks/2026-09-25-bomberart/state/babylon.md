status: done
wave: 4
current: 波 4 三條修復完成，全閘綠，等 qa 驗
touched:
  - src/babylon/games/bomber.ts
  - src/babylon/games/bomberFx/hudModel.ts
  - src/babylon/games/bomberFx/hudModel.phase.test.ts
  - src/babylon/games/bomberFx/perfLog.ts
  - src/babylon/games/bomberFx/perfLog.test.ts
todo: []
report: state/babylon.report.md
notes: 結算計時凍結＝bomber.ts 的 lastPlayingTimer（playing 每幀記、回合重置清空）＋hudModel.phaseTimer。
  陣亡 invincibleMs 在 buildBomberHud 內依 alive 歸 0。perf log 經 bomberFx/perfLog.perfLogLine，drawCalls<=0 或 fps 非有限值不印。
  src/index.css 的改動是 babylon-hud 的，不是我。
