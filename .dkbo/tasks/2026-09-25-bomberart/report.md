# 炸彈超人美術優化（A Toy Box） 結案
結果：merged 25bb228   分支：dk/bomberart   波數：4（幾何／光影／特效＋HUD／整枝評議修復）

## 完成
- AC1 素材：`public/battle/bomber/` 5 張 WebP（共 18 KB）＋LICENSE.txt（原創自繪／CC0）。
- AC2 角色：固定 4 色依出生角、程式建模 Q 版（頭盔漸層、眼睛光點、AI 天線＋小章、「你」標記、無敵 8Hz／16Hz 閃爍），俯角透視補償讓角色直立（`bomberFx/upright.ts`）。
- AC3 場景：地面單 mesh＋程式棋盤、牆／箱／落牆全 thin instance、硬磚受損態、突然死亡紅頂與 400ms 預告格。
- AC4 材質光影：StandardMaterial MaterialPlugin 兩階 ramp＋描邊、雙光、PCF 陰影、GlowLayer 白名單、DefaultRenderingPipeline。
- AC5 特效：spec §8 全表每一列都有連拍截圖。
- AC6 HUD：`GameContext.setHud` 通道＋React 玩家卡與計時器（`[data-bomber-hud]`），3D 狀態列移除，倒數改 A 配色（走 UI 相機）。
- AC7 檔位：desktop／mobile 判定、網址強制參數（含 hash 內 query）、自動降級、`max-height: 500px` 膠囊版。
- AC8 draw calls 最高 77（≤120）；AC9 `vendor-babylon` gzip 402.6 → 450.8 KB（≤650）。
- AC10（單人部分）／AC11：規則常數與 net／core／AI／map 檔 git diff 為空；tank／race／overcooked 無 `[data-bomber-hud]`，倒數與 3D 狀態列和 master 基準目視相同。
- 附帶修正：Battle 頁全螢幕鈕點擊後 `blur()`，空白鍵不再退出全螢幕。

## 未完成 / 遺留
- **AC10 多人項未驗**：Firestore 具名 DB `dkbo-collect` 回 NOT_FOUND（`(default)` 可讀），`/battle` 多人開不了房。兩端顏色／位置同步、關一個 context 後角色材質（波 1 Important 1 的迴歸）都標「待驗」。線上 `/battle` 多人很可能同樣壞掉，需人檢查 Firebase。
- **`(default)` DB 殘留**：qa 波 2 在收到禁令前以 `(default)` 跑過兩局（run1、run2，約 15:25–15:56），建過房間文件，未記錄 id；是否清理請人決定。
- AC7 自動降級第三級 `shadow` 未在 swiftshader 觀察到（outline → glow 已觀察到），需真機確認。
- 不修的 Minor（整枝評議 triage）：
  - 標籤字型列表寫 Noto Sans TC、未等 Fredoka 載入 `bomberFx/textures.ts:465`
  - 名冊外 id 回傳色 0 `bomberFx/palette.ts:66`
  - 外框牆厚半格 `bomberFx/board.ts:141`
  - dpr<1 固定 1，缺註解 `bomberFx/quality.ts:65`
  - StrictMode 下 tier 行印兩次（僅 dev） `bomberFx/look.ts`
  - look.dispose 先於 banner.dispose（Babylon dispose 可重入） `bomber.ts:1710`
  - 倒數首字 Fredoka 未載好時用 fallback `bomber.ts:1238`
  - uiCamera.fov 只複製一次，缺註解 `bomberFx/look.ts:134`
  - 每幀 new Vector3 `bomber.ts:1053`
  - sameHud 以 JSON 比對，無敵期間每 100ms 重繪 `pages/Battle/bomberHud.ts:63`
  - 左右欄卡片頂部不對稱（960 差約 32px） `index.css:1252`
  - 首行 perf log 延到約 4 秒 `bomber.ts:1619`
  - `suddenDeathSeconds` 僅剩內部使用 `bomberFx/hudModel.ts:40`
- 交人決定的視覺／產品取捨：木箱炸毀的奶白煙幾乎看不見（`bomberFx/effects.ts:77`）；有觸控螢幕的 Windows 筆電會走 mobile 檔（`look.ts:49`，可改 `(pointer: coarse)`）。
- 審查全程只有 claude 一個 kind（codex、agy 專案層熔斷），沒有第二模型意見。每波都經審查，沒有未審的波。

## 驗證
- 每波 `dk-wave-close` 四道閘全過；最終 eslint＋tsc＋vitest 409 條全綠。
- qa：production preview（worktree build）單人跑完整局，1920×1080／960×540（`?bomberTier=desktop&bomberNoDegrade=1`）、844×390（mobile）截圖，§8 每列連拍；console／pageErrors 0。截圖路徑見 `state/qa.report.md`。
- 審查：波 1–3 各一輪 L 檔審查＋複看；整枝評議（task.diff）Important 0；修復波 4 的 L 檔審查即第 2 輪整枝評議，Important 0。

## 自主裁定（待你複核）
1. babylon-hud 卡 `rm -f $S/*.png` 審批不重派、只送 TASK — 若錯：再卡一次才照 SKILL 重派。
2. babylon-hud 已交付即先關 pane，避免同波 TS1294 讓 Stop hook 反覆叫回 — 若錯：審查有 Important 時以 --resume 重派。
3. 審查只派得出 claude 一位，單一 L 檔意見即裁定（DK_REVIEW_MIN=2 無法滿足） — 若錯：少了第二模型的視角。
4. 波 2 qa 等 babylon `[DONE]` 才 build — 若錯：波 2 慢約 30 分鐘。
5. 裁定④卡通 ramp 改用 StandardMaterial MaterialPlugin（原為 NodeMaterial） — 若錯：外觀不達 spec 時改 NodeMaterial，約多一輪。
6. 不准 qa 改連 Firestore `(default)` DB，多人項改列待驗 — 若錯：多人驗證延後、AC10 多人未達成。
7. 波 3 併入低成本 Minor（setHud 量化、hash query、色票 import）並把 qa 禁令寫死進波次列 — 若錯：波 3 多約 10 分鐘。
8. 開局倒數改走 UI 相機、繞過後製以對準色票 — 若錯：改回主相機只調色，約半小時。
9. 全螢幕鈕 click 後 `blur()`（四款遊戲共用的 Battle 頁） — 若錯：全螢幕按鈕行為微變，可回退。
10. 玩家卡遮格改 HUD 側處理、不動相機：卡縮 0.75、兩張疊上半部，偏離 spec §9 尺寸與排法 — 若錯：卡片略小、與稿不同，可改回或放寬相機。
11. AC7 降級第三級 shadow 未觀察到，判程式面通過（swiftshader 幀間隔 >500ms，實測） — 若錯：真機上 shadow 級不觸發。
12. 開修復波 4 一次修 5 條（@apply 必修＋陣亡無敵徽章、結算計時、全螢幕鈕壓 P2、首行 perf log） — 若錯：多一波約 30 分鐘。
13. 其餘 Minor 不修、記 BACKLOG；木箱煙與觸控筆電檔位交你決定 — 若錯：小瑕疵留到後續任務。

## 重要決策
- §11-2 角色與物件全部程式建模，不引入 glTF（關卡①人確認）。
- 採納計畫審查 p1 六條必改，拆成三波並加 qa 煙霧測試、AC10 以 git diff 機械判定。
- 關卡① 人回 ok，其餘 §11 七條照建議。
- 波 1 Important：遠端離線 `dispose(false,true)` 毀共用材質 → 改 `disposeAvatar`；波 2 qa 列加離線材質驗證。
- 波 2 qa 腳本移出 repo（`scripts/qa/bomberart/` 只是占位）；切片不帶 brief 所有權段的附註句，禁令要寫進波次列。
- 上方自主裁定 1–13。

## 給下次的話（≤3 行）
- brief 所有權表下的附註句不會進切片，對員工的禁令要寫進波次列本身。
- qa 開工前先探 Firestore 具名 DB；swiftshader 下暫停時鐘逐幀跑一局要 15–20 分鐘，閒置逾時不代表卡住。

## 時間
任務 2026-09-25-bomberart
| 階段 | 開始 | 結束 | 時長 | dev | 審查 |
|---|---|---|---|---|---|
| 任務 | 2026-09-25T14:19 | 2026-09-25T20:19 | 360m | — | — |
| 計畫 | 2026-09-25T14:19 | 2026-09-25T14:42 | 23m | — | — |
| 波 1 | 2026-09-25T14:44 | 2026-09-25T15:21 | 37m | 37m | 7m |
| 波 2 | 2026-09-25T15:22 | 2026-09-25T16:02 | 40m | 36m | 17m |
| 波 3 | 2026-09-25T16:03 | 2026-09-25T18:39 | 156m | 121m | 31m |
| 波 4 | 2026-09-25T18:45 | 2026-09-25T19:26 | 41m | 4m | 3m |
| 結案 | 2026-09-25T19:26 | 2026-09-25T20:19 | 53m | — | — |
