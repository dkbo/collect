| 日期 | 來源 | 一句描述 | 建議處理 |
|---|---|---|---|
| 2026-09-25 | candyart 波 2 qa | 糖果第 1 關開場 `Level 1` banner 播在載入遮罩底下，使用者看不到（master 既有） | godot 等載入完成（bridge READY 後）再播首關 banner |
| 2026-09-25 | candyart 波 2 godot | 貼圖缺檔退回邏輯的 `art_test.gd` 只在 scratchpad，未進版控 | 開任務時把 `godot-candy-src/tests/` 劃給 godot，搬進來 |
| 2026-09-25 | babylonslim 波 3 qa | 廚房湯只能拿到焦湯、無法出餐（master 既有）：`overcookedKitchen.ts:225` 煮好時 busyUntil 設成焦掉時刻，`:191` 取湯要 isReady | babylon 修 busyUntil 語意並補 vitest |
| 2026-09-25 | babylonslim 整枝評議 | eslint 禁整包匯入可被 `@babylonjs/core/index`、`@babylonjs/core/Legacy/legacy` 繞過 | eslint.config.js no-restricted-imports paths 補這兩個 name |
