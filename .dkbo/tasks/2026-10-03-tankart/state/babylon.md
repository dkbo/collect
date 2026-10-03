status: done
wave: 4
current: 子彈壽命改模擬時間（advanceBullet）完成；全閘綠 70 檔／687 tests；單人自查無 pageerror
touched:
  - src/babylon/games/tank.ts
  - src/babylon/games/tankFx/bulletLife.ts
  - src/babylon/games/tankFx/bulletLife.test.ts
report: state/babylon.report.md
notes: BulletInfo.createdAt 已移除（砲口焰去重本來就用 rig.fireAt）
notes: 30Hz 下飛 60 tick（2s）、第 61 tick 到期；host 卡頓時真實存活變長但距離與 guest 一致
