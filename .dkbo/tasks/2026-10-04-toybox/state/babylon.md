status: done
wave: 2
current: AC9 完成，已送 DONE
touched:
  - src/pages/Battle/Battle.css
  - src/pages/Battle/index.tsx
  - src/pages/Battle/GameList.tsx
  - src/pages/Battle/GameMenu.tsx
  - src/pages/Battle/Room.tsx
  - src/pages/Battle/SoloGame.tsx
  - src/pages/Battle/BabylonCanvas.tsx
  - src/pages/Battle/TouchControls.tsx
todo: []
report: state/babylon.report.md
notes: battle-stage 補 text-center 還原凍結 HUD 繼承的置中；全螢幕 ref 掛在 ScreenFrame view 內的 battle-stage。
  Room 需 Firebase，本機未自查，交 qa 兩 context 驗。vitest 唯一紅為 react-games 的 gameFrames.test.ts。
