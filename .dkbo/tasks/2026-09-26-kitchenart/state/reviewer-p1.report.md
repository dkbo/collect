# kitchenart-reviewer-p1 報告（計畫審查）

## 需求覆蓋
request 的「參照炸彈超人」＋12 條裁決逐條對照：
- ①A → 目標、brief 第 7 行 ✅；②抽 fx → AC1＋波1 qa 截圖並排 ✅（request 要求「搭一張截圖比對」已接住）；③setHud 加 kind → AC7＋共用契約 ✅，「另外三款一起驗」→ AC11（bomber／tank／race）✅；④盤子只外觀 → AC4「盤架裝飾」✅；⑤照實顯示 → AC7 ✅；⑥快焦不改協定＋單測 → AC2/AC6 ✅（已核對現行 buildView：soup 時 busyUntil=+OVERCOOK_MS 5000、分母 COOK_MS 3000，前 2 秒 progress 夾為 0，AC2 寫的語意正確）；⑧⑨⑩ ✅；⑪ → AC10，但量錯 chunk（見下「驗收標準可驗證性」第 1 條）；⑫ → 波1 AC2 ✅，BACKLOG「補 vitest」→ 新增 overcookedKitchen.test.ts ✅。
- ⑦「qa 用兩個瀏覽器分頁確認兩端看到的顏色一樣」→ AC11 多人項，但 dkbo-collect NOT_FOUND 時只標「待驗」、沒有替代證據。人明講的驗證方式可能整條落空。建議（非必改）：AC3 把 colorIndex 推導寫成純函式並附單測（輸入同一份 players 陣列、輸出一致），且 report／關卡③明列「⑦ 待驗」讓人知道。附帶事實：ctx.players 來自 `src/core/room/index.ts:145` 依 joinedAt 排序、`BabylonCanvas.tsx:50` 只在掛載時讀一次，兩端順序一致的前提成立。
- 「參照糖果」：brief 完全沒提糖果。C 稿（Candy Glaze）已被否決、使用者對①回 ok，所以不算漏；建議目標段補半句「糖果參照於方向稿階段評估、未採」以便日後追溯（Minor）。

## 驗收標準可驗證性
1. **（必改）AC10 量錯 chunk，且 base 產物無法取得**：⑪人講的是「遊戲程式最多增加 25 KB」，AC10 寫成「index chunk」。現況 `docs/assets/` 裡 overcooked／bomber 程式碼在 `Battle-*.js`（gzip ≈ 66,985 B，含 overcook 字樣），`index-*.js` 只有 ≈ 7,529 B、不含任何遊戲碼 —— 照 AC10 量，遊戲碼長多少都會過。另外「與任務 base 同指令的產物比較」沒寫 base 怎麼建：波1 qa 是「等 babylon DONE 後」才動，worktree 已不是 base。改寫：「`vendor-babylon-*.js` gzip 增量 ≤ 10 KB、`Battle-*.js` gzip 增量 ≤ 25 KB（若拆出新 chunk，遊戲相關 chunk 合計）；base 產物由 qa 以 `git archive <base>` 解到 scratchpad、symlink 主樹 node_modules 後同指令建置」。對應改波1 qa 列與 AC12。
2. **（必改）AC7「逾時掉落＋-10」在 KitchenHud 契約下無法確定判定**：契約的 orders 只有 `id/ing/remainMs`，React 看到某張單消失時分不出是出餐還是逾時；orders[].id「recipeId＋出現序」的產生規則也只寫一句，沒要求測試（同 ing 兩張單、刪中間那張時序號會錯位 → 出餐的單被演成掉落）。改寫：契約寫明判定規則（例：同一次 setHud 中 id 消失且 `delivered` 未增加 → 逾時；或只增欄位 `expiredIds: number[]`），並把 id 穩定化＋消失原因判定列為 `kitchenFx/` 純函式、附 `*.test.ts`（至少涵蓋同 ing 兩單、出餐與逾時同幀）。babylon-hud 波1 的假資料自查也要照這規則出案例。
3. **（必改）AC9「4 人滿場（或單人加滿站點物品）」可任選較寬的條件**：4 人場每位角色都多出 mesh＋描邊＋陰影的 draw call，單人量出 ≤ 90 不代表 4 人 ≤ 90；而多人很可能 NOT_FOUND，實際只會量單人。改寫：固定條件「單人、6 站點全放物品、手上持物」量 N1，report 另記單一角色（含描邊與陰影）增量 d，判定 `N1 + 3d ≤ 90`；多人可用時再以實測覆蓋。
- 其餘 AC 可判定。AC3「對照 variant-A-sheet」、AC11「目視無差異」屬目視，但有指定截圖與並排對象，可接受。

## 檔案所有權
- 成員間可改清單無重疊；AC 要動的檔都有人擁有（已核對 `colorFor` 在 `overcooked.ts:147`，不在 `overcookedKitchen.ts`，不衝突全域約束「overcookedKitchen.ts 只准改 AC2」；`sameHud` 在 `src/pages/Battle/BabylonCanvas.tsx`，歸 babylon-hud ✅）。
- 無必改。`dev:5175`／`dev:5176` 不在 CLAUDE.md 列的資源名清單內，若 dk-brief-check 已過就無妨。

## 波次切法
4. **（必改）波1 有兩個未宣告的同波依賴**：(a) babylon-hud 要 import `@/babylon/fx/palette` 的 `PLAYER_PALETTE`，但該檔是 babylon 同波才搬出來的，babylon-hud 起跑時不存在 → tsc 紅或自己先造一份；共用契約表寫了擁有者但「做什麼」欄沒寫順序。(b) 波1 qa「等 babylon [DONE]」就 build worktree，但 babylon-hud 同波在改 `types.ts`／`BabylonCanvas`，可能還沒寫完 → build 失敗或量到半成品 bundle、bomber 截圖也沒涵蓋 ③ 改到的 HUD 分流路徑。改：babylon 列加「先落 `fx/palette.ts`（契約匯出）並 dk-msg babylon-hud」、babylon-hud 列加「依賴 babylon 的 palette 落檔」、qa 列改「等 babylon 與 babylon-hud 都 [DONE]」。
- 其餘順序合理：波2 只有 babylon＋qa；波3 babylon-hud 等 qa BUG 屬同波交接。共用契約都有擁有者。
- 風險提示（非必改）：HUD 真資料整合直到波3 尾才首次驗到；波3 babylon-hud 若出 BUG 只剩修復兩輪空間。

## Minor
- AC7「-10」「+20」建議寫明取 `SCORE_EXPIRE`／`SCORE_SERVE`（`overcookedKitchen.ts:112-113`），不寫死；另 `:235` 分數下限 0，分數 0 時逾時實際不扣分 —— 依⑤「照實顯示」，浮字應顯示實際差值（0 時不顯示或顯示 -0 由領導定）。
- AC7 訂單「成品圖」、玩家卡「手持物槽」、頭像：全域約束禁止新增圖檔，建議寫明 React 側用 inline SVG／CSS 繪製，免得 babylon-hud 去想辦法從 3D 截圖或加 webp。
- AC7「左側 4 張玩家卡」：1–3 人時顯示空位還是只顯示實際人數，寫清楚（qa 截圖才有判準）。
- AC7 食譜 `R` 鍵：已查 overcooked 現有按鍵是 space／enter／e，無衝突；建議補「只在 kitchen HUD 掛載時監聽、卸載時移除」，避免漏到 bomber／tank／race。
- AC11 bomber 基準：`git diff 64bbc74 HEAD -- src public` 目前為空，主樹 `docs/` 可當基準；若開工前 master 再有 src 變更，qa 要先確認這點。
- 目標段補「參照糖果」的處置（見需求覆蓋）。

## 結論
要改 4 處

## 做了什麼
讀 request.md、brief.md；為查證計畫假設唯讀抽查 `overcookedKitchen.ts`、`overcooked.ts`、`BabylonCanvas.tsx`、`src/core/room/index.ts`、`docs/assets/` chunk 內容。未改任何檔。

## 測試
### 紅
不適用: 計畫審查，無程式碼與測試
不適用: 只做唯讀查證（grep／sed／gzip -c | wc -c）
### 綠
不適用: 計畫審查，無程式碼與測試
不適用: 查證指令：`gzip -c docs/assets/Battle-*.js | wc -c` → 66985；index-*.js → 7529

## 自我審查
四條必改都附了可直接套用的改寫；其餘列 Minor。chunk 大小取自主樹現有 docs/ 產物，非本任務 base 建置。

## 疑慮
無。
