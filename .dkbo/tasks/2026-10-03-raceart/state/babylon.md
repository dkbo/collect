status: done
wave: 5
current: 噴焰色 Minor 已修；應 babylon-rules 要求 positionsExcept 補 ry（尾流朝向）
touched:
  - src/babylon/games/race.ts
  - src/babylon/games/raceFx/effects.ts
  - src/babylon/games/raceFx/fxModel.ts
  - src/babylon/games/raceFx/fxModel.test.ts
todo: []
blocked_by: 無（全套 vitest 4 紅皆為 babylon-rules 進行中的 raceRules/*.test.ts 紅測，非我所有權；我的三檔＋race.ts 綠）
report: state/babylon.report.md
notes: 波 4 報告備份在 state/babylon.report.w4.md
notes2: 殘留：速度掉落取消甩尾後 250ms 內壓加速帶仍判段位色（他車無來源欄位，見 report 疑慮）
