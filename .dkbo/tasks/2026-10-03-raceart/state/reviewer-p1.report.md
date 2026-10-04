# reviewer-p1 報告（計畫審查 brief-review）
## 做了什麼
讀 request.md 與 brief.md 做計畫審查；為確認兩處可行性只讀查了 `vitest.config.ts`（pages 專案已收 `src/pages/**/*.test.ts`）、`src/pages/Battle/TouchControls.tsx`（搖桿派發方向鍵）、`src/core/room/types.ts`（`MAX_PLAYERS = 4`）。未改任何檔。

## 需求覆蓋
- request 9 項建議中 #2–#7、#9 及美術／HUD／不動清單都有對應 AC（#2→AC3、#3→AC4、#4→AC3、#5→AC4、#6→AC5、#7→AC3、#9→AC8；美術→AC9–AC11、HUD→AC12、不動→全域約束＋AC16）；#8 在「目標」明列不做 ✅。
- ❌【必改 1】request #1「8 字或多彎（大彎、S 彎、跳台一段）」的**賽道形狀**沒有任何 AC 接住：AC1 只要求控制點表「閉合、不自交」、AC2 只定義資料結構，AC3 只說跳台「spec 指定位置」。designer 交一個圓角矩形也能過 AC1/AC2。改寫：AC1 spec 的賽道章節加「至少 1 個 ≥120° 大彎、1 組左右連續 S 彎、1 段跳台、1 段可甩尾的長彎（供 AC5 bot 甩尾）；總長與單圈目標秒數（如 35–50 秒）」，qa 在 AC18 以 `variant-A-track.webp` 對照判定。（另：「不自交」等於排除 8 字，若刻意如此可在目標寫一句，否則 8 字立體交叉需要額外的 y 判定。）

## 驗收標準可驗證性
- ❌【必改 2】AC4 落後補償單測「最後一名抽到 mushroom＋shell 的機率 ≥ 第 1 名的 2 倍」是**空斷言**：同一條又規定第 1 名只會抽到 banana／shield，第 1 名機率 = 0，任何表（含最後一名也是 0）都滿足 ≥ 0×2。改寫：「第 1 名 P(mushroom∪shell) = 0；最後一名 P(mushroom∪shell) ≥ 0.6；P(mushroom∪shell) 隨名次非遞減（rank 1..total 逐一斷言）」。
- ❌【必改 3】AC2「名次排序同分時以先到者為先」：未過線的車在 (lap, s) 同分時沒有「先到」資訊（`rankCars` 輸入只有 `finishedAt`），各 client 依 Map 迭代序可能不同，直接違反同條的「所有 client 名次一致」。改寫：「已過線依 `finishedAt` 升冪；未過線依 lap 降冪、s 降冪；仍同分依 `id` 字典序」，單測斷言輸入順序打亂結果不變。
- ❌【必改 4】網路訊息不完整，AC3／AC4／AC17 的部分條件無法判定：
  - 龜殼「沿賽道追蹤名次前一名」是動態軌跡，AC4 只有 `itemSpawn`，沒說龜殼／香蕉之後的位置怎麼讓 guest 一致（host 週期廣播？還是 guest 用確定性規則自算？），但 AC17 要 qa 驗「龜殼位置一致」。
  - AC3「重生 1500ms 內不被道具命中」與 AC4「shield 擋下」都由 host 判定，但 host 要知道 guest 的重生／護盾狀態；AC2 名次要「同一份 own 快照」算，表示 own 快照得帶 lap／檢查點序號／finishedAt；AC11 別人的車要看得到甩尾火花段位、加速噴焰、打滑。現況廣播只有 `{x,z,ry,q}`，brief 沒列 race 的 own state 新形狀。
  改寫：AC4（或新增一條）列出 race 訊息表：`own` 新欄位（如 `lap, cp, s, fin, ghost, drift: 0–3, boost, spin`）＋ `itemReq／itemGrant／useItem／itemSpawn／itemState(或 shell 位置 10Hz)／itemGone／spin／botState`，每列寫發送端、頻率、驗證範圍；qa 的 AC17 依此表判定。這不是跨成員共用契約（race.ts 兩端都是 babylon），寫在 AC 即可。

## 檔案所有權
- 成員可改欄無重疊；designer 在主樹 `.dkbo/tasks/.../design/**`、qa 可改 `—` 合規；獨佔資源 port 5175／5176／5177 各不重複 ✅。
- ❌【必改 5】全域約束「純邏輯一律寫成純函式（`raceRules/**` 或 `raceFx/**`）」與所有權表下方說明「babylon-hud 純函式如名次字尾、圈時格式、道具欄狀態要附 `*.test.ts`」衝突：babylon-hud 不擁有這兩個目錄。前例 `src/pages/Battle/tankHud.ts`＋`tankHud.test.ts` 是對的做法（vitest `pages` 專案已收 `src/pages/**/*.test.ts`），但全域約束會流進 babylon-hud 的切片讓它二選一（違反約束或 ESCALATE）。改寫全域約束：「…或 `src/pages/Battle/raceHud.ts`（HUD 格式化）」。
- 其餘：AC2–AC5 要動的 raceRules、AC8 的 `BabylonCanvas.tsx`／`TouchControls.tsx`、AC12 的 `types.ts`／`index.css`、`sfx.ts` 都有擁有者 ✅。

## 波次切法
- 波 1 designer 先落前兩章再通知 babylon-rules、babylon-rules 先用暫定控制點，切法合理 ✅；波 3 美術、波 4 特效＋HUD 串接順序合理 ✅；三份共用契約都有擁有者 ✅。
- ❌【必改 6】波 2 qa 列「等 babylon `[DONE]` 後…逐條驗 AC2–AC8」，但 AC8（四顆觸控鈕）是同波 babylon-hud 的產出，qa 只等 babylon 可能在 babylon-hud 未完成時就判 AC8 → 假 FAIL 或漏驗。改成「等 babylon 與 babylon-hud 都 `[DONE]`」，或把 AC8 移到波 3 qa 驗。

## Minor
- 共用契約「A Toy Racer spec」消費者只列 babylon@波3，但波 2 babylon 已要用 spec 的檢查點／道具箱／加速帶／跳台位置與 AI 參數，補 `babylon@波2`；並寫明這些位置資料的程式落點（建議 `raceRules/` 的 `trackData.ts`，由 babylon-rules 波 1 換表，babylon 只讀），免得 babylon 在 race.ts 再抄一份。
- AC8「搖桿只負責轉向」：`TouchControls` 搖桿派發方向鍵（含上／下），race.ts 又讀 `arrowup` 當油門；要嘛 TouchControls 加可選「只橫軸」prop（babylon-hud，其他遊戲預設不變），要嘛 race.ts 忽略觸控的上下鍵（babylon）。brief 應指定哪一個。
- AC6 結算：「名次依過線時間」與「總時間」以誰的時鐘為準沒寫；全域約束雖說結算只信房主廣播，建議 AC6 明寫「host 以收到過線（own 的 `fin`）的順序定名次，總時間取 guest 上報、host 驗範圍」，並註明斷線玩家不計入「全員過線」。
- AC17「名次與圈數一致」在兩個 context 間因 20Hz 延遲會短暫不同；寫明判定時機（如過線後／結算畫面，或靜止 1 秒後）。
- AC11 的「道具欄轉盤」「換圈與最後一圈提示」與 AC12 的 React HUD 重疊，標明哪部分是 3D（babylon 波 4）、哪部分是 React（babylon-hud 波 2），避免兩邊都做或都不做。
- AC5「不會卡在牆上」：賽道沒有牆（路緣外可開出去），改成「bot 開出路面後 N 秒內回到路面或觸發重生」。AC5「只在長彎甩尾」的長彎判定交給 spec 定義曲率門檻。
- AC5 brief 寫「依真人數補滿 4 台」（多人也補），request 寫「單人補滿 4 台」；與坦克前例一致可接受，但結案報告宜註明多人也會有 bot。
- AC14 N0 只量不設門檻，若無意設門檻可寫「N0 只記錄」。
- 獨佔資源欄用了 `port:5175/5176/5177`，不在 PROJECT.md 的資源詞彙（`dev:5173`…）；機械閘已過即可，但建議同步登記到 PROJECT.md。

## 結論
要改 6 處

## 測試
### 紅
不適用: 計畫審查，無程式碼與差異包
### 綠
不適用: 計畫審查，無程式碼與差異包

## 自我審查
六條必改各自指名 brief 段落並附可驗證改寫；只讀查了三個檔以確認可行性（vitest include、觸控搖桿、MAX_PLAYERS），未改任何檔。

## 疑慮
無。
