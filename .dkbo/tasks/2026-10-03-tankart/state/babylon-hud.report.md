# tankart-babylon-hud 報告（波 3）
## 做了什麼
- 本波只負責修 qa 回報的 HUD BUG。qa 回 [ANSWER]：AC8 HUD 在三檔版面實測都沒有 BUG，以下各項皆正常：計時膠囊與「縮圈中」、存活數、玩家卡的 HP／護盾／buff 秒數／擊殺數／陣亡灰化、擊殺通知、手機頭像膠囊。
- 沒有改任何程式碼。`git status --short -- src/babylon/types.ts src/pages/Battle src/index.css` 無輸出。
- 波 2 的實作內容不變，詳見波 2 report（commit 756e72b）。

## 測試
### 紅
不適用: 本波沒有 HUD BUG、沒有改碼，所以沒有新測試。
不適用: HUD 的真資料驗證由 qa 負責（brief 波 3 列明訂），qa 判定三檔都沒有 BUG。
### 綠
不適用: 本波沒有改碼，無新測試可跑。
不適用: 完整的 eslint／tsc／vitest 由 dk-wave-close 的 DK_TEST_CMD 閘再跑一次。我擁有的檔案自 base 756e72b 起沒有變更，所以沒有在共用 worktree 另外跑全套，以免拖慢同波的人。

## 自我審查
- 本波 touched 為空，沒有越過所有權。
- 波 2 遺留的兩條 Minor 本波沒處理，原因是範圍限定只修 qa 的 BUG：
  - feed 為空時清空 tankSeen：babylon 波 3 已依切片讓 feed id 跨局單調遞增，這條實際上無害。
  - 同名真人取錯色點：要修得改契約，需由領導決定。

## 疑慮
- 擊殺通知遇到同名玩家時，色點取 `players` 裡排在前面的那位。要精確對應，得在 feed 加可選的 `killerId`／`victimId`，屬於契約變更，留給領導決定要不要做。
