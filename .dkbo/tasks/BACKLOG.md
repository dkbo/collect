| 日期 | 來源 | 一句描述 | 建議處理 |
|---|---|---|---|
| 2026-09-25 | candyart 波 2 qa | 糖果第 1 關開場 `Level 1` banner 播在載入遮罩底下，使用者看不到（master 既有） | godot 等載入完成（bridge READY 後）再播首關 banner |
| 2026-09-25 | candyart 波 2 godot | 貼圖缺檔退回邏輯的 `art_test.gd` 只在 scratchpad，未進版控 | 開任務時把 `godot-candy-src/tests/` 劃給 godot，搬進來 |
| 2026-09-25 | babylonslim 波 3 qa | 廚房湯只能拿到焦湯、無法出餐（master 既有）：`overcookedKitchen.ts:225` 煮好時 busyUntil 設成焦掉時刻，`:191` 取湯要 isReady | babylon 修 busyUntil 語意並補 vitest |
| 2026-09-25 | babylonslim 整枝評議 | eslint 禁整包匯入可被 `@babylonjs/core/index`、`@babylonjs/core/Legacy/legacy` 繞過 | eslint.config.js no-restricted-imports paths 補這兩個 name |
| 2026-09-25 | bomberart 波 2 qa | Firestore 具名 DB `dkbo-collect` 回 NOT_FOUND，`/battle` 多人開不了房；bomber 多人同步與離線材質迴歸未驗 | 人檢查 Firebase console／`.env.local`，修好後 qa 跑 `--contexts 2` 補驗 |
| 2026-09-25 | bomberart 波 2 qa | qa 曾在 `(default)` DB 建過測試房間文件（15:25–15:56，id 未記） | 人決定是否清理 |
| 2026-09-25 | bomberart 整枝評議 | bomber 美術 Minor 13 條不修（字型 fallback、dispose 順序、每幀 Vector3、卡片不對稱等） | 見 tasks/2026-09-25-bomberart/report.md 遺留段 |
| 2026-09-25 | bomberart 整枝評議 | 木箱煙幾乎看不見；觸控筆電走 mobile 檔 | 人在實機看後決定；後者可改 `(pointer: coarse)` |
