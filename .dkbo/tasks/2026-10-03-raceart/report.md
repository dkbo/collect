# 賽車美術＋可玩度（A Toy Racer） 結案
結果：merged   分支：dk/raceart   波數：5

## 完成
- AC1 方向稿：`design/spec.md`（§0–§12）、`variant-A.pen`、gameplay／track／sheet 三張 webp。
- AC2–AC7（含 AC6b）：`raceRules/**` 純函式（track／drive／items／raceAI／trackData／配色），48 點閉合賽道、8 檢查點計圈、甩尾三段蓄力、尾流、推擠、重生、跳台、固定加速帶、4 種道具＋落後補償、3 台 bot、15 秒衝線寬限結算、固定 4 色。
- AC8／AC12：React `RaceHud`（`[data-race-hud]`、`.race-*` 三檔版面），手機 2×2 四鈕、搖桿只轉向；移除 3D 文字 HUD。
- AC9–AC11、AC13、AC14：Q 版玩具車與場景、兩階 ramp／描邊／陰影／Glow／Pipeline、桌機／手機檔與自動降級、特效表 18 列、perf log、`?raceBench=1`。
- 測試：vitest 997 條全綠（本任務新增約 150 條純函式單測），eslint／tsc 乾淨。

## 驗證
- qa 波 4 全項判定 AC1–AC18（`state/qa.report.md`，截圖在 qa scratchpad）：N0=54、N1=63（≤100）；`Battle-*.js` gzip +31.4 KB（≤35）、`vendor-babylon` −0.9 KB；AC16 零回歸 diff 全空、三款開局並排無差異；AC17 多人兩局結算逐字一致、重開局／道具／bot 同步一致。
- 審查：每波一位 claude reviewer（codex 熔斷至 10/11、agy 至 10/10，**全程未達 DK_REVIEW_MIN=2**）；整枝評議兩輪（task L 檔 Important 0；修復波 5 L 檔 Important 1 → 修後 0）。

## 未完成 / 遺留
- **尾流風線（特效表 #3）未在畫面實拍**：swiftshader fps 2–5 跟不進尾流錐；`slipLook` 有單測、接線已審。請在實機貼著前車跑 1–2 秒看一眼。
- **波 5（整枝 Minor 修復）只有單測與 L 檔審查，沒有 qa 重跑遊戲**：改動是尾流朝向判定、ry 環繞、名次倒車判定、長彎跨起點、噴焰色，全為純函式＋單測。
- 全程只有單一模型（claude）審查，少第二模型視角。
- spec §6「衝線後你標記換金旗」未做（不在 AC11 清單、bundle 餘裕 3.6 KB）。
- 車在 1920 畫面寬約 380px，略大於稿；天色比稿淡（ACES 壓藍，已預補償）。
- 不修的 Minor（依據）：
  - 加速菇彈出／護盾到期閃爍 guest 看不到他車的、他車 0 段甩尾火花、guest 端 bot 重生無閃爍：AC6b 訊息表固定（契約限制）。
  - 加速帶全條一起閃：拆 mesh 加 draw calls（已裁定）。
  - `sameHud` 每幀 stringify、他車每幀 `trackProgress`、HUD `lapMs` 10ms 量化致每幀 setHud：實測 qa fps 與 N1 未見問題；手機實機掉幀時優先改。
  - 衝線後 HUD 名次表與結算 overlay 在極近衝線時可能前後不同：brief AC2／AC6 各自定義。
  - host 遊戲中按 `r` 直接重開全房：base 既有行為。
  - bot 甩尾區與檢查點區界不齊、跨遊戲 import `tankFx/fxModel`、`decodeResult` 名字 >64 丟整份（rules 限 16）、`slipCharge` 的 ry 可選、import 次序、`inSpan` 邊界單點。
- BACKLOG 既有的 Firestore／其他遊戲條目與本任務無關，未動。

## 自主裁定（待你複核）
- 2026-10-03T21:18 接受 shouldRespawn 卡住條件加「踩油門／倒車」 — 停在路上不動的玩家 2 秒就被傳送不合理，符合 AC3 本意（卡住） — 若錯：拿掉 input.throttle 一行＋改一條測試
- 2026-10-03T21:18 接受追蹤龜殼只撞目標、直射龜殼與香蕉撞任何車 — spec §2.2 明定，brief 未禁 — 若錯：hitTest 改一處
- 2026-10-03T21:18 ToyLook 陰影跟隨由 babylon 波 3 決定（fx/look 新增可選 setShadowCenter 或 race.ts 移光源皆可） — 全域約束允許 fx/ 新匯出 — 若錯：波 3 陰影罩不住賽道，qa 截圖會抓到
- 2026-10-03T21:18 觸控鈕 2×2 可由 babylon-hud 在 TouchControls 加可選 grid prop，其他遊戲預設不變；做不到退回一排 — 屬 AC8 範圍內的可選參數 — 若錯：版面差異，不影響操作
- 2026-10-03T21:22 路面外加速上限也乘 OFFTRACK_FACTOR，不讓加速切內野 — brief AC3 明定路面外降速、spec §1.3 也以 0.3 倍速為前提 — 若錯：要學瑪利歐加速菇切草地時改回一行
- 2026-10-03T21:47 接受 bot 名冊另立 start { bots } 訊息取代「開局訊息可選欄位」 — net 層只讀加不了欄位，比照坦克 seed 前例 — 若錯：改名或併訊息，只動 race.ts 兩端
- 2026-10-03T21:47 接受人類玩家最佳圈由 host 以觀察 lap 增加計時（誤差 ≤50ms） — AC6b own 欄位固定不加 — 若錯：結算最佳圈差數十 ms
- 2026-10-03T21:47 AI 單圈約 31s 略低於 spec 35–50s 目標不調 — 人類單圈較慢、屬手感數值，qa 實玩回報過快再調 — 若錯：一局偏短，調 MAX_SPEED 或 AI 係數一行
- 2026-10-03T21:47 保留 babylon-hud 平板橫向（pointer:coarse 且高>500）把名次與小地圖移開觸控鈕的 media 規則 — 避免遮擋、不影響三檔驗收尺寸 — 若錯：刪一段 CSS
- 2026-10-03T21:55 波 2 Important 1（移除單車時連共用材質一起 dispose）由 babylon 修；順手修 Minor 1（倒數期間也送 botState）與 Minor 3（過線後不撿不用道具） — 前者打 AC17 guest 起跑格、後者避免已完賽車干擾仍在比賽的人，同一檔一次修 — 若錯：多一點修復面，複看抓得到
- 2026-10-03T21:55 AC16「tank*.ts／bomber*.ts／overcooked*.ts diff 為空」的範圍是 src/babylon/games/；src/pages/Battle/kitchenHud.ts、tankHud.ts 只放寬型別守衛參數，屬 babylon-hud 所有權內、行為不變，允許 — 所有權表本就劃給 babylon-hud — 若錯：零回歸 glob 誤擋
- 2026-10-03T22:02 測試檔直接深層 import NullEngine 視為「經 babylonCore」約束的例外 — 只在 *.test.ts、不進 bundle、深層非 .pure；補進 babylonCore 反而可能把 NullEngine 帶進 vendor chunk 違 AC15 — 若錯：搬一行 import
- 2026-10-03T22:25 SLIP_CONE_DEG 15→25，brief AC3 同步 — qa 實測鍵盤 bang-bang 轉向 30 秒貼尾只觸發 1 次，15° 對鍵盤玩家過窄、違「市售賽車手感」目標 — 若錯：尾流過易觸發，改回一個常數
- 2026-10-03T22:25 出界重生牆鐘 4.6s 不修 — 模擬 dt 計時、swiftshader 三瀏覽器並跑低 fps 所致，單測驗過 3000ms — 若錯：真機低 fps 時重生偏慢，屬手感微差
- 2026-10-03T22:25 波 4 babylon 在 __BATTLE_POS 補 bot 座標判讀欄位，brief 波 4 列已補 — qa 波 2 只能定性驗 AC17 bot 同步 — 若錯：多一點判讀碼，波 4 文字 HUD 整理時一併處理
- 2026-10-03T22:28 drive.test.ts:105 的 16° 輸入改成 SLIP_CONE_DEG+1 不算違反「既有 *.test.ts 斷言不得修改」 — 該測試是本任務波 1 新增、非 base 既有，且斷言語意（錐外不蓄）不變 — 若錯：無，語意等價
- 2026-10-03T22:34 波 3 babylon 順修 3 條 Minor（他車跳台 y、roadStrip uv、投影名單照 AC10），brief 波 3 列已補 — 都落在波 3 本來要改的場景／路面／陰影 — 若錯：波 3 稍長
- 2026-10-03T23:34 接受天色預補償 RACE.skyClear=#4FB4EE（霧色同值），RACE.sky 保留 spec 值 — ACES 壓藍，補償後最接近 spec 觀感 — 若錯：只改一個常數
- 2026-10-03T23:34 車畫面寬 330–370px 大於 spec 估的 260px 先照 spec 參數不改，交 qa 對照 variant-A-gameplay 判；偏差明顯再於波 4 調 radius — babylon 已查明是 spec 自身估算誤差 — 若錯：波 4 改相機一個數
- 2026-10-03T23:34 AC13/AC18 自動降級驗證改在 960×540 視窗做 — swiftshader 1920 下 fps 1–2 被 FpsWatch 當暫停清窗，屬共用 fx/quality 既有行為三款一致 — 若錯：1920 實機降級未直接驗
- 2026-10-03T23:41 波 3 I1（桌面 emissive 加法洗白）、I2（火花 emissive 黑致全黑）本波即修，不併波 4 — 甩尾段位顏色是玩家回饋、qa 本波要對色 — 若錯：無
- 2026-10-03T23:41 拱門拿掉 outline，照 brief AC10「描邊只描車、道具與道具箱」 — brief 與 spec 衝突以 brief 為準 — 若錯：拱門少一圈描邊，加回一個旗標
- 2026-10-03T23:41 道具箱 Glow 用 glowOwnMaterial(0.35) 取代 spec 的白色 glowMesh — 白色會把箱子洗白 — 若錯：箱子發光色偏差
- 2026-10-03T23:41 本任務波 2 新增的 raceGeom.test.ts、carVisual.test.ts 調整不算違反「既有測試斷言不得修改」 — 非 base 既有且語意不變 — 若錯：無
- 2026-10-03T23:41 波 3 修復同時順修 Minor M4（你標記貼圖平方）、M6（他車跳台 y 用插值後 s）、M7（重複 import）、M8（bench 擋自己用道具）；M3、M5、M10 併入波 4 特效 — 前者各一兩行同檔、後者波 4 換粒子與特效表會重寫 — 若錯：波 4 漏做，整枝評議會抓
- 2026-10-04T00:03 車寬 ~380px/1920 不調相機 — qa 判不遮前方路況、僅略大於稿，spec 估值本身有誤 — 若錯：人在關卡③看了要小一點，改 radius 一個數
- 2026-10-04T00:03 護盾泡泡實機截圖延到波 4 qa 特效連拍補拍，brief 波 4 qa 列已補 — 程式面已確認、波 2 看過舊版 — 若錯：AC9 該項證據晚一波
- 2026-10-04T00:48 加速帶閃光共用材質全條一起閃不拆 mesh — 拆會加 draw calls 且 bundle 只剩 3.7KB — 若錯：視覺小瑕疵
- 2026-10-04T00:48 他車加速菇彈出只 host 可見、護盾到期閃爍只本機與 host bot 可見，不新增訊息 — AC6b 訊息表固定、他車噴焰已經 own.boost 全員可見 — 若錯：guest 少一個小特效
- 2026-10-04T00:48 火花亮度先照 spec，qa 判太暗再調 sparkStyle 係數 — 單一常數可回退 — 若錯：甩尾段位回饋偏弱
- 2026-10-04T00:54 波 4 I1 衝線彩帶只在 phase==='playing' 偵測，babylon 本波修；順修 Minor 6（重生清打滑）、8（噴焰每幀 new Color3）、12（seen.clash 死欄位） — 皆一兩行同檔 — 若錯：無
- 2026-10-04T00:54 spec §6「衝線後你標記換金旗」不做 — 不在 AC11 清單、bundle 只剩 3.7KB — 若錯：少一個小特效，記遺留
- 2026-10-04T00:58 波 4 Minor 12（seen.clash 不遞增）依 babylon 查證為誤判，不改 — babylon 指出 reason clash 路徑會遞增，複看時 reviewer 可再核 — 若錯：qa 判讀少一個計數
- 2026-10-04T01:04 重派 raceart-qa（--resume）：herdr 狀態卡在 working 但畫面閒置，01:00 後 3 則訊息送不進，qa 誤等 babylon-hud DONE — 待命成員不需等 — 若錯：qa 重讀 state 多花幾分鐘
- 2026-10-04T02:07 甩尾火花改亮芯 sparkHot＋SPARK_SIZE 0.5（偏離 spec 0.18） — qa 實測紫段在深紫路面看不見，甩尾段位是玩家回饋 — 若錯：火花偏大，調一個常數
- 2026-10-04T02:33 尾流風線（特效表 #3）實拍未達，park 進 report 遺留、關卡③請人實機看 — swiftshader fps 2–5 無法穩定跟車進 25° 錐 1.2s；slipLook 有單測、接線已審、尾流機制波 2 實機驗過 — 若錯：風線特效可能沒顯示，實機一看即知
- 2026-10-04T02:40 開一個修復波 5 一次修 5 條 Minor（尾流朝向、ry 環繞、normalizeProgress 倒車、findLongCurves 跨起點、噴焰色），波 5 審查 --tier L 即第 2 輪整枝評議 — 這些「留」的理由是推測（幾乎不發生／只影響配色），規範不准以推測不修；全是純函式或單點、有單測 — 若錯：多一波約 40 分鐘
- 2026-10-04T02:40 其餘 Minor 不修記遺留：已裁定／契約限制者照原裁定；sameHud stringify 與 N2 他車 trackProgress 每幀（實測：qa fps 與 N1=63 未見問題）；N1 HUD 名次表與結算 overlay 依 brief AC2／AC6 各自定義（依 brief，非推測）；N4 host 按 r 重開為 base 既有行為（實測：讀 base race.ts） — 若錯：手機實機掉幀時再改
- 2026-10-04T02:48 接受 normalizeProgress 對「倒車 ≥6/8 圈」與「跳兩個以上檢查點捷徑」不可區分時偏低處理 — 跳檢查點本不算圈，偏低比偏高安全；有單測 — 若錯：極端捷徑車名次暫時偏低
- 2026-10-04T02:48 噴焰色殘留極端情境（甩尾被降速取消後 250ms 內壓加速帶）不加 own 欄位 — AC6b 訊息表固定、純配色 <1s — 若錯：極少數幀顏色不對
- 2026-10-04T02:52 波 5 I1 採 (a)：normalizeProgress 夾回範圍擴到 sector cp+2（fwd <= ahead(cp+3)），倒車判定自 5/8 圈起；補 {cp:1, s:cp3+2} 斷言並修正 docstring／測試名 — 實賽道 sector 2→4 內場最近 30.9 會真的發生跳一個檢查點，倒 5/8 圈極罕見；(a) 也回到波 1 行為 — 若錯：極端倒車名次暫時偏高

## 重要決策
- 2026-10-03T19:26 使用者未逐項回覆 9 項玩法建議即叫 /dkbo-plan，比照 tankart 前例視為全數採建議；designer 只出 A 一套與規則並行 — 叫 plan 即接受規劃 — 若錯：關卡①時人可改，未開工不付成本
- 2026-10-03T19:26 波 2 babylon L×7 AC 與 babylon-hud M×2 不均照舊 — 7 條 AC 全落在 race.ts 單檔整合，切不開；HUD 為獨立元件可並行 — 若錯：波 2 由 babylon 決定長度，HUD 先完成閒置
- 2026-10-03T19:26 純邏輯拆給 babylon-rules（raceRules/**，波 1 與 designer 並行、波 2 待命），babylon 從波 2 起整合 — 賽車規則量大，先把可單測的部分獨立落地，race.ts 整合時只 import — 若錯：契約簽名不合用要 ESCALATE 改，多一輪
- 2026-10-03T19:29 只派 claude 一位計畫審查 — codex 熔斷至 10/11、agy 至 10/10，無第二 kind — 若錯：少第二模型視角
- 2026-10-03T21:22 RaceHud.lap = 目前第幾圈 1..laps，babylon 以 min(own.lap+1, LAPS) 算、HUD 直接顯示，已寫進 brief 共用契約 — 避免兩端各自換算差一圈 — 若錯：HUD 顯示差一圈，qa 會抓到
- 2026-10-03T21:23 波 1 審查通過，關波 — 唯一一位 reviewer 複看 Important 0；codex/agy 熔斷未達 MIN=2 — 若錯：少第二模型視角，整枝評議再補

## 給下次的話（≤3 行）
- 待命成員要在 qa 的切片寫明「不用等它 DONE」，否則 qa 會與待命 dev 互等（本任務波 4 卡 40 分鐘）。
- swiftshader 下短壽命粒子與跟車類機制拍不到，特效驗收先備好計數判讀欄位（`__BATTLE_POS.fx`）。
- disableLighting 材質公式（輸出＝clamp(emissive)×底色）連兩波出錯，可寫進 babylon 角色檔。

## 時間
任務 2026-10-03-raceart
| 階段 | 開始 | 結束 | 時長 | dev | 審查 |
|---|---|---|---|---|---|
| 任務 | 2026-10-03T19:24 | 2026-10-04T09:02 | 818m（進行中） | — | — |
| 計畫 | 2026-10-03T19:24 | 2026-10-03T19:29 | 5m | — | — |
| 波 1 | 2026-10-03T20:38 | 2026-10-03T21:24 | 46m | 45m | 5m |
| 波 2 | 2026-10-03T21:24 | 2026-10-03T22:34 | 70m | 65m | 40m |
| 波 3 | 2026-10-03T22:34 | 2026-10-04T00:03 | 89m | 76m | 17m |
| 波 4 | 2026-10-04T00:03 | 2026-10-04T02:34 | 151m | 92m | 79m |
| 波 5 | 2026-10-04T02:40 | 2026-10-04T02:55 | 15m | 14m | 6m |
| 結案 | 2026-10-04T02:55 | — | — | — | — |
