# bomberart-reviewer-p1 報告（計畫審查）

## 需求覆蓋
人要的東西只有一句「炸蛋超人也要跟糖果一樣美術要優化」，加上使用者看過的 §11 八條建議表（沒回 ok，直接叫 `/dkbo-plan`，等於默認照表）。目標與 AC1–AC11 已接住：選 A、固定 4 色、卡通材質、HUD 走 React、箱形統一、相機不調、250 KB 預算。

- **（必改 1）§11-2 跟使用者看過的建議相反，brief 卻只放在全域約束的括號裡。** request 裡使用者默認的是「**角色用 glTF**、磚牆用程式拼」；brief `## 全域約束` 最後一條與 `process.md` 14:20 的 ruling 改成「全部程式建模、不引入 glTF」。這正好就是「做出來會不會是人要的東西」的核心：spec §3 推薦 A 的第 2 個理由就是「CC0 glTF 素材最現成」，§5 的角色與可破磚也都寫「glTF 優先」。ruling 的理由站得住（稿子的頭盔加天線造型跟 KayKit 不同，也省下 loaders 依賴），但使用者從沒看過這個版本。改法：關卡①把 §11-2 **單獨列一行**「原建議 → 現裁定 → 代價（角色精緻度上限較低、沒有骨架動畫）」，請使用者明確回覆；沒回覆就不算確認。同一行補一句「另外三條依賴（loaders／gui／materials）一律不加」的後果：「你」標記、`+1`、`AI` 小章都得用 DynamicTexture 的 billboard 做，不能照 spec §4／§8 用 Babylon GUI。
- 「跟糖果一樣」的精緻度基準：brief `## 目標` 把設計依據限定在 variant-A 稿與 spec，AC11 要 qa 逐張對照稿子，這樣就夠了。

## 驗收標準可驗證性
- **（必改 2）AC7／AC8 缺少能強制、也看得到的檔位開關，而且自動降級會污染桌機驗收。** qa 用 headless Chromium 跑 production preview，fps 很可能長期低於 45，一跑就依序關掉描邊、Glow、陰影。這樣 AC4（描邊、Glow、陰影）的截圖、AC8「桌機滿盤 draw calls ≤ 120」都驗不到桌機檔；AC7 的「觸控或 `hardwareConcurrency <= 4` 走手機檔」也沒有輸出可判定。改寫：AC7 加「開局 `console.info('[bomber] tier desktop|mobile')`；網址 `?bomberTier=desktop|mobile` 可強制檔位，`?bomberNoDegrade=1` 關掉自動降級」；AC8、AC4、AC11 的桌機截圖一律在 `bomberTier=desktop&bomberNoDegrade=1` 下量。自動降級本身另外用 `?bomberTier=desktop` 不帶 NoDegrade 驗，看 `[bomber] degrade outline` 這行有沒有出現（headless 反而容易觸發）。
- **（必改 3）AC7 的橫向手機 HUD 斷點沒定義。** spec §9 寫的是「寬度 < 640px」，但 AC7 要求 844×390 縮成頭像膠囊，844 > 640，照 spec 做就不會觸發；`BabylonCanvas` 又會鎖橫向，直向 390 寬的情形實際上不存在。改寫：AC6／AC7 寫死條件，例如 `@media (max-height: 500px)`（或 `(pointer: coarse) and (max-height: 500px)`），並寫明 960×540 要顯示完整玩家卡。
- **（必改 4）AC6 末句「tank、race、overcooked 畫面與現在完全相同」與 AC10「畫面與 master 基準相同」無法判定。** 3D 畫面每幀都在動，截圖不會逐像素相同。改寫：「三款遊戲中 HUD 根節點（例如 `[data-bomber-hud]`）不存在於 DOM；開局倒數與 3D 狀態列的截圖跟 master 基準並排，qa 目視版面、配色都沒有差異；console 無錯」。
- AC5（建議，不列必改）：AC11 的連拍只涵蓋爆炸、拾取、陣亡、突然死亡，§8 表裡的放炸彈 ring、引信火花／將爆脈動、木箱木片與煙、硬磚受損火花、道具出現彈跳沒有任何證據要求。建議 AC11 改成「§8 每一列至少一組連拍」，時長由 reviewer 對照程式碼判定。
- AC10「規則、數值、網路訊息不變」（建議）：改成可機械判定的「`git diff master -- src/core src/babylon/net src/babylon/games/bomberNet.ts bomberAI.ts bomberMap.ts` 為空，`bomber.ts` 的規則常數（計時、突然死亡、爆炸時序、道具數值）未改」。
- AC2「對照 `variant-A-sheet.webp`」屬主觀比對，由 AC11 的 qa 標註承接，可以接受。

## 檔案所有權
- 成員之間沒有重疊。`BabylonCanvas.tsx`、`SoloGame.tsx` 都在 `src/pages/Battle/`，歸 babylon-hud；babylon 只讀。`vite.config.ts` 讀 `process.env.PORT`，`dev:5175` 可以用；獨佔資源也沒有重複宣告。
- **（必改 5）`src/babylon/hud.ts` 四款遊戲共用，AC6「開局倒數改 A 配色」會破壞 AC10 的零回歸。** tank、race、overcooked 都呼叫 `createCountdownPanel`。babylon 擁有 hud.ts，但 brief 沒限制改法，最直接的做法就是改預設樣式。改法：波 2 babylon 列或 AC6 寫明「倒數以 `createCountdownPanel` 的可選參數，或 bomber 專用函式實作，預設外觀不變」。
- **（必改 6）AC 要用到、卻沒有人產出的圖像，也沒有指定做法。** AC6 的玩家卡「頭像」在 `GameHud` 裡沒有欄位，spec §9 寫「3D 快照或 2D 圖」；AC3／AC5 要的焦痕 decal、落地 ring、硬磚裂痕、木箱 X 撐條、石柱磚縫、青苔，AC1 的素材清單都沒列。babylon 對 `public/battle/bomber/**` 只讀，babylon-hud 沒有素材目錄，做到一半就會變成跨人 QUESTION。改法二選一：(a) brief 寫明「這些一律程式產生：DynamicTexture／幾何，頭像由 babylon-hud 依 `colorIndex` 用 CSS 或 inline SVG 畫」；(b) 列進 AC1 與「bomber 素材路徑」契約，交給 assets。建議選 (a)，這跟 ruling ② 全程式建模一致。
- 建議：AC1 寫「白色圖示」，但 spec §5 的速度、無敵兩種要深色圖示 `#3A2A00`。brief 應註明由 babylon 以材質色相乘著色，或由 assets 在圖集裡直接出深色。
- 建議：qa 在主樹跑 `vite preview --port 5173`，會跟使用者平常在主樹開的 `pnpm dev`（5173、strictPort）互撞，preview 直接報錯。可改用 5176，或在 brief 註明「主樹 5173 被占用就 ESCALATE」。

## 波次切法
- 順序合理：波 1 素材、HUD 型別與場景底子並行，波 2 接特效、`setHud` 與降級，qa 最後驗。兩條共用契約都有擁有者，也都出現在所有權表。
- 波 2 裡 qa 要等 babylon `[DONE]`，babylon-hud 又要等 qa 的 BUG，是波內串行。這在 dkbo 算正常的 dev→qa 交接，但 babylon-hud 大半波會閒置。可以接受，不列必改。
- 建議：波 1 babylon 一列的量很大（角色、地面、thin instance、材質、雙光、陰影、Glow、Pipeline、量測、bundle），遠超過 plan 顆粒的 20–60 分鐘，吃滿 context、送出 `[ESCALATE] context` 的風險高。其中 thin instance 取代可破磚與硬磚還牽動炸毀、同步時的 matrix 更新，是波 1 唯一碰到遊戲流程的改動，但波 1 沒有 qa，多人回歸要到波 2 才驗得到。建議擇一：(a) 波 1 加一列 qa，跑 `--contexts 2` 煙霧測試（炸箱、硬磚兩段、突然死亡落牆）；(b) 把「材質、光影、後製」移到波 2、特效移到波 3，每波 babylon 只扛一塊。
- babylon 波 1 的 AC9 量測只是中間值，最後的判定在波 2，現在這樣寫沒有問題。

## Minor
- `GameHud.players[]` 沒有 P 編號，建議註明「P 編號 = `colorIndex + 1`」與「左 P1／P3、右 P2／P4」的排列由 babylon-hud 依 `colorIndex` 決定。
- `timer.secondsLeft` 在突然死亡後代表什麼沒寫（0？縮圈剩餘？）。AC6 只要求顯示「縮圈中」，建議註明突然死亡後忽略 `secondsLeft`。
- AC7 只寫手機的 `hardwareScalingLevel` 固定 1.5，spec §10 的桌機值 `1 / min(dpr, 2)` 沒寫進 AC，會變成可做可不做。
- AC2 的「你」標記、AC5 的 `+1`：在不加 `@babylonjs/gui` 的前提下，建議直接寫「billboard plane + DynamicTexture」，免得有人照 spec 去 import GUI，被 eslint 或依賴約束擋下。

## 結論
要改 6 處

## 做了什麼
讀 request.md、brief.md、design/spec.md、process.md 的 ruling。為了確認所有權，唯讀 grep 了 `BabylonCanvas`／`SoloGame` 的位置、`hud.ts` 的呼叫端、`vite.config.ts` 的 port、bomber 的測試檔與出生角配色來源。沒有改任何檔。

## 測試
### 紅
不適用: 計畫審查，沒有程式改動、不跑測試
不適用: 同上
### 綠
不適用: 計畫審查，沒有程式改動、不跑測試
不適用: 同上

## 自我審查
每條必改都指名了 brief 的段落或 AC 編號，並附改寫方向；前四段裡標「建議」的不計入 N。

## 疑慮
「headless 下 fps < 45」是推測，沒有實測。就算 qa 的機器跑得到 45fps，必改 2 的強制檔位開關仍然需要：AC7 的手機檔要能在桌機上驗。
