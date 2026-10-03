# tankart-reviewer-p1 報告（計畫審查，波 0）
## 做了什麼
讀 request.md、brief.md、process.md 的三條 ruling；為了確認 brief 的事實前提，唯讀抽查了 `tank.ts`、`bomber.ts`、`BabylonCanvas.tsx`、`fx/`、kitchenart brief（只 grep/sed，不改檔）。

## 需求覆蓋
- 美術各項（固定 4 色、Q 版坦克＋「你」、積木牆／木箱／地毯、ramp／描邊／雙光／陰影／Glow／Pipeline、檔位降級＋`[tank]` log、糖果 juice、特效清單、React HUD）→ AC3/AC5/AC6/AC7/AC8/AC9/AC10 都有對應。✅
- 可玩度 1–7：1/2/3/4/5 → AC2；6 不做 → 目標段已寫；7 → AC4（已查 `BabylonCanvas.tsx:29` 的 `TOUCH_ACTIONS`、`tank.ts:729-730` 吃 `q`/`e`，現況觸控確實只有開火，補鈕合理）。✅
- 「不動」段（core/net/hud.ts、相機、三款零回歸、不加依賴、不新增圖檔）→ 全域約束＋AC12。✅（AC7 的鏡頭微震與 bomber 現有的 `shakeUntil` 同類，`bomber.ts:1592`，是暫態位移不是改相機參數，不算違反）
- **❗必改 1｜request「波次草案 0」與對話原文「你選定後再寫 brief」沒有被接住**：使用者同意的是「designer 出 A/B/C → 使用者選 → 才寫 brief」。brief 目標段（第 7 行）與波次表第 1 列 designer 改成只出 A、與玩法並行，依據是領導 ruling（process 08:44），但人沒有被告知、也沒有任何一個點讓人看稿。風險 ruling 自己寫了：「人想看別的風格，波 2 以後重做」——波 2、3 是整個美術工作量。改法（擇一，兩者都不拖時程，因為 designer 本來就在波 1 並行）：(a) 關卡①給人看時把「只出 A、不等你選」明列為待確認項，人點頭才算數；(b) 波次表在波 1 與波 2 之間加一句「波 1 收波後把 `variant-A-*.webp` 給人過目，人說 ok 才開波 2」。建議兩個都做。
- 小缺口（不必改）：request 的糖果 juice「命中彈出」在 AC7 只寫成「命中火花＋受擊閃白」，沒有「彈出」（受擊者擠壓彈跳或傷害數字彈出）；見 Minor。

## 驗收標準可驗證性
- AC1、AC3、AC4、AC6、AC8、AC9、AC11、AC13、AC14：可判定。✅
- **❗必改 2｜AC10 的量測條件 qa 造不出來**：「場上 5 種道具各一、10 顆子彈飛行中」——道具來自木箱 50% 掉寶、五種等機率隨機，子彈靠 bot 與自己開火，qa 沒有手段把畫面擺成這個狀態，結果是 qa 只能估或判不了。改寫建議（照 kitchenart AC9 的前例）：「固定條件『單人 3 bot、開局倒數結束後 5 秒、不開火』量 N0；另記單一道具 d_item、單一子彈 d_bullet 的 draw call 增量（thin instance 應為 0 或 1），判定 `N0 + 5·d_item + 10·d_bullet ≤ 90`」；或由 babylon 加一個只在 `?tankNoDegrade=1` 下生效的 `?tankBench=1` 擺場參數（要寫進 AC 與 babylon 那列）。
- **❗必改 3｜AC2 縮圈「被落牆壓到」沒有判定基準，多端會不一致**：坦克是連續座標、且真人坦克位置由各自本機擁有（`tank.ts` 現況），「壓到」可以是中心在格內、也可以是任何重疊；誰判也沒寫。AC13 又要求「落牆同步」。改寫建議：「host 以它最近收到的坦克中心所在格判定，命中即廣播既有 `destroyed`（`killerId: null`）；guest 不自行判毀損，只播落牆動畫」；單測加「中心在格內＝壓毀、中心在相鄰格＝不壓毀」。
- AC2「畫面上子彈不得穿牆超過 1 幀」qa 用截圖判不了。建議改成可判的兩件事：單測「guest 預測與 host 用同一函式、同輸入輸出同一 bounce 點」＋ qa `--contexts 2` 兩端反彈點目視一致。（Minor，不計入必改）
- AC5、AC7「照 spec／對照稿」屬主觀，但有稿可比、前兩款同寫法已跑過，可接受。
- AC12 bomber／kitchen「同參數截圖並排無差異」：bot 隨機走位會造成像素差；前兩款同寫法，建議 qa 對「開局倒數第一幀」比，或明寫「HUD 與場景靜態物件無差異」。（Minor）

## 檔案所有權
- 成員之間無重疊。`sameHud` 在 `src/pages/Battle/bomberHud.ts`（babylon-hud 擁有）、`colorIndexOf` 在 `bomberFx/palette`（babylon 只讀 import 即可）、`upright.ts` 在 `fx/`（babylon 擁有）——AC 要動的檔都有主人。✅
- **❗必改 4｜波 3 babylon-hud 缺獨佔資源、且與第 52 行自相矛盾**：波次表第 70 列要它「無 BUG 時以真資料確認擊殺通知、buff 倒數、縮圈狀態與手機精簡版」，真資料只能起 dev server 跑 tank；但所有權表 babylon-hud 的獨佔資源是「—」，第 52 行又寫「babylon-hud 不起 `/battle`」。照現在寫法它要嘛違規佔 port，要嘛做不了。改法擇一：(a) 給 babylon-hud 一個 port（如 `dev:5178`，只跑 SoloGame、不連 Firebase）並把第 52 行限定為「波 2」；(b) 把第 70 列的「以真資料確認」刪掉，改成只修 qa 回報的 BUG、真資料確認歸 qa。

## 波次切法
- 波 1 babylon（玩法）／designer（稿）並行、qa 等 babylon：合理。波 2 babylon（3D）／babylon-hud（React）以 `TankHud` 契約切開、波 3 接線：合理。碰 tankNet 的 babylon 三列都標 L。✅
- 共用契約兩條都有擁有者，擁有者與消費者都在所有權表。✅
- 波 3 babylon-hud 依賴「同波 qa 回報」，而 qa 又等 babylon `[DONE]`，babylon-hud 會整段空等到 qa 出報告。可接受，但與上面必改 4 一起處理時，(b) 方案順便消掉這段空轉。
- 波 1 babylon「HUD 暫在既有文字面板補顯示護盾／buff／縮圈倒數」是波 3 會整段刪掉的工；只為 qa 波 1 能看見狀態。可以改成「console.debug 或只補一行文字」，不要做排版。（Minor）

## Minor
1. AC2 護盾被打破、buff 到期的跨端同步沒指定載體；HUD 契約要每位玩家的 `shield` 與 buff `remainSec`，AC13 要兩端一致。建議 brief 指明「`hit` 加可選欄位 `shieldBroken: boolean`、`dirX`/`dirZ`（擊退方向）」，`pickup` 帶 `kind` 讓各端自算到期時刻。
2. AC2 擊退寫「由受擊者本機套用」，bot 沒有本機——補一句「bot 由 host 套用並經 `botState` 同步」。
3. AC2 bot 名冊：bomber 是「隨 seed 廣播」（`bomber.ts:241`），brief 開新訊息 `bots`。二者都合規，建議同 bomber 走 `seed` 可選欄位，少一個時序問題（名冊比 seed 晚到）。
4. AC3：`bomberFx/palette` 已有 `colorIndexOf(id, ids)`（`bomber.ts:60,268`），tankFx 可直接只讀 import 或薄包一層，不必重寫；中途有人離房時顏色是否重排也請比照 bomber（`bomber.ts:345` 會重建）。
5. AC7「連殺字卡（2 連以上）」沒定義連殺窗口（同一條命內？N 秒內？），qa 判不了何時該出現。
6. AC7 補「命中彈出」：受擊坦克擠壓回彈（糖果 juice），與「開砲擠壓回彈」共用曲線。
7. 獨佔資源 `dev:5175`／`5176`／`5177` 不在 PROJECT.md 的資源清單（只列 5173），確認 `dk-brief-check` 接受新名稱；PROJECT.md 的 /battle 行仍寫「具名資料庫 `dkbo-collect`、`VITE_FIREBASE_FIRESTORE_DB` 必填」，與 commit bb5b7db 改回 (default) 及 request 不符，qa 可能被誤導——請領導更新 PROJECT.md。
8. AC12 的 `git diff` 範圍可順便加上 `src/babylon/games/race*`，零回歸才是機械可判。

## 結論
要改 4 處

## 測試
### 紅
不適用: 計畫審查，沒有程式碼與測試
（只做唯讀查證：grep/sed `tank.ts`、`bomber.ts`、`BabylonCanvas.tsx`、`fx/palette.ts`）
### 綠
不適用: 計畫審查，沒有程式碼與測試
（未跑任何會寫入的指令）

## 自我審查
四條必改都附了可直接貼進 brief 的改寫；事實前提已用唯讀抽查驗過（觸控鈕現況、bomber bot 規則與配色函式、鏡頭微震前例、kitchenart 的量測前例）。

## 疑慮
必改 1 的依據是領導已落的 ruling，最終仍是人的決定；我只要求它在關卡①被明講。
