# designer 報告（波 1）
## 做了什麼
- 依 bomberart、kitchenart 的 spec 與稿件對齊語彙，出 A · Toy Army 一套（brief 已定只出 A）。
- `design/spec.md`：§0 產出與畫面內容、§1 現況與相機實測、§2 色票（玩家沿用 `PLAYER_PALETTE`；場景與 5 種道具色）、§3 坦克建模表（每台 4 個 mesh：hull／tracks／turret／barrel，尺寸與組成）、§4 場景建模表（積木柱牆／外框／落牆／木箱／地面／預告／道具／子彈，含 draw call 預估約 55）、§5 材質／描邊名單／陰影投影者／Glow 白名單（照 AC6 只放子彈、砲口焰、道具、預告格）、§6 狀態表、§7 juice 曲線 `squashPose`（開砲與受擊共用）、§8 特效表 17 列（觸發／持續／粒子或 mesh／上限）＋浮字共用貼圖、§9 HUD 三檔（1920×1080／960×540／844×390 max-height 500px）、`.tank-*` class 對 Tailwind v4、TankAvatar 與三連發圖示 SVG、手機 `TOUCH_ACTIONS.tank` 三鈕、§10 檔位數字、§11 AC 對照、§12 待確認 3 條。
- `design/variant-A.pen`（3 個 frame）、`variant-A-gameplay.webp` 1920×1080、`variant-A-sheet.webp` 1800×2550（4 色三視、6 種狀態、場景 8 格、5 種道具、子彈 2 態、特效關鍵幀 18 格、HUD 元件、色票）、另加 `variant-A-mobile.webp` 1688×780（手機版面）。
- 用 pen interactive 的 headless 模式加 `execute` 畫稿，再用 `Export` 匯出 webp；畫稿 JS 由 scratchpad 的產生器生成。沒有用 `--prompt`／`--tasks`。
- 相機實測後送了 ESCALATE（現值 r28 時近側 2.5 排與 P1、P4 出生角在畫面外）。領導 09:13 裁定改成 r38、target (0,0,-2)，交給 babylon；spec §1、§9.4 和稿子的構圖都照這個裁定。
## 測試
### 紅
不適用: 設計波，只產出稿件與 spec，沒有程式碼可測
不適用: 同上
### 綠
不適用: 設計波，只產出稿件與 spec，沒有程式碼可測
不適用: 同上
以匯出的 webp 與 spec 自查：
- gameplay 1920×1080、sheet 1800×2550、mobile 1688×780：用 webp header 讀尺寸，都正確；逐張目視檢查過。
- AC1 清單：4 色三視 ✅、積木牆 ✅、木箱 ✅、5 種道具 ✅、子彈 ✅、特效關鍵幀 ✅、HUD 元件 ✅、色票沿用 PLAYER_PALETTE ✅、建模尺寸與組成 ✅、材質與描邊名單 ✅、Glow 白名單 ✅、§特效表每列四欄 ✅、HUD 三檔含 max-height 500px ✅、Tailwind class 與 `.tank-*` 命名 ✅、token 與 BomberHud／KitchenHud 同套 ✅。
- 相機取景：NullEngine `Vector3.Project` 實算（1920×1080、960×540、844×390 三種尺寸都算過），數字寫在 spec §1、§9.4。
## 自我審查
- spec 的 HUD 欄位全部對應共用契約 `TankHud`，沒有新增欄位；buff 只有 speed、rapid、triple，護盾另走 `shield` 布林。
- 只寫了 `design/**`；暫存的產生器腳本與 pen log 放在 scratchpad。
- 稿子是平行斜投影，實際畫面有透視，spec §0 已註明不必逐像素比對。
## 疑慮
1. `variant-A.pen` 有 3.6 MB（bomber 的是 0.8 MB）：每個積木都是獨立的路徑節點。結案時會跟任務記憶一起 commit，如果嫌大可以只留 webp。
2. 手機 844×390 的坦克在畫面上只有約 17px 寬，而且手機檔會關描邊，辨識主要靠玩家色和「你」標記；如果 qa 覺得太小，只能再談相機（brief 規定 β、fov 不調）。
3. `↺`／`↻` 的字型覆蓋要 qa 實機截圖確認（spec §9.3 有備案）。
4. 木箱實例縮放 0.8 是建議值（spec §12-2），babylon 可以自己決定。
