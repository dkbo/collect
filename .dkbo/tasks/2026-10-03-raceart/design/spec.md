# 極速賽車美術＋可玩度：A · Toy Racer 玩具賽車 spec

> raceart-designer 寫於 2026-10-03（任務 2026-10-03-raceart 波 1）。只出 A 一套；語彙承接炸彈超人 A「Toy Box」、廚房快手 A「Toy Kitchen」、坦克 A「Toy Army」（`2026-09-25-bomberart`／`2026-09-26-kitchenart`／`2026-10-03-tankart` 的 `design/spec.md`）。
> 和 brief 衝突時以 brief 為準。數字一律是世界單位（1 單位 ≈ 現行 race.ts 的 1 單位；車長約 2.1）或 960×540 設計尺寸的 CSS px。
> 座標：x 向東、z 向北，`ry = atan2(dx, dz)`（與 race.ts 現行相同：ry 0 朝 +z、π/2 朝 +x）。**lateral 正號＝行進方向右側**，右法向 = `(cos ry, −sin ry)`。

## 0. 產出一覽（本目錄）

| 檔案 | 內容 |
|---|---|
| `variant-A.pen` | 原稿，3 個頂層 frame：`賽道俯視 Track`（1320×1000）、`對局畫面 Gameplay`（960×540）、`特寫表 Sheet`（1600×2990） |
| `variant-A-track.webp` | 賽道俯視 1980×1500（@1.5x）：中心線＋路寬、紅白路緣、起跑線與發車格、CP0–7、道具箱 3 列、加速帶 3 塊、跳台、長彎兩段（紫）、s 刻度每 50、看台／拱門柱／積木群／樹／錐的位置、圖例與數據 |
| `variant-A-gameplay.webp` | 對局畫面 1920×1080（@2x），**照 §7 相機參數把 §1 的真實賽道幾何投影出來**（不是示意透視）：自己 P1 紅在 s 104（T1 出口）甩尾 2 段橘火花；P3 綠 bot（s 107.5）吃到香蕉打滑轉圈＋頭上暈眩星；P2 藍（s 118）開著護盾泡泡；P4 黃 bot（s 127.5）剛撞碎道具箱列 0 的第 3 顆（碎片＋白環）並噴焰加速；路上一根香蕉；前方加速帶①、跳台、遠處積木與樹。HUD：道具欄（加速菇——最後一名的落後補償）、`LAP 2/3`、時間卡、小地圖、名次 `4th/4` |
| `variant-A-sheet.webp` | 特寫表 2400×4485（@1.5x）：① 車 P1 正／側／俯／追尾角＋4 色 3/4 視角＋駕駛特寫（真人／bot）② 香蕉、龜殼、加速菇、道具箱、護盾泡泡 ③ 路緣、起跑拱門、看台觀眾旗子、積木、樹＋錐、跳台、加速帶、色票 ④ 19 格特效關鍵幀（§8 每一列）⑤ HUD 元件全狀態＋手機 844×390 版面＋三檔說明 |

所有圖都由同一份幾何資料產生：賽道、物件位置、相機都跟本 spec 的數字一致，可以直接拿來對照實作截圖（qa AC18）。

## 1. 賽道（AC2／AC3 的資料來源；babylon-rules 落在 `raceRules/trackData.ts`）

### 1.1 中心線與路寬

| 常數 | 值 | 說明 |
|---|---|---|
| `TRACK_WIDTH` | **12** | 全程等寬。4 台並排（車寬 1.5）仍有餘裕；路面外 = `abs(lateral) > 6`，套 `OFFTRACK_FACTOR` |
| 取樣 | 閉合 **uniform Catmull-Rom**（tension 0.5，即標準形 `0.5·(2P1 + (−P0+P2)t + (2P0−5P1+4P2−P3)t² + (−P0+3P1−3P2+P3)t³)`），每段 **16** 點，共 768 點折線 | 以下所有 s、曲率、總長都是用這個取樣量出來的；改取樣數 s 會差 <0.5，位置仍以本章 s 為準 |
| 總長 `len` | **554.8** | s=0 在控制點 0（起跑線），沿控制點順序遞增 |
| 方向 | 逆時針（俯視），開局車頭朝 +x（ry = π/2） | 左彎為主：總轉角 −360° |
| 外接框 | x −80～80、z −72～73（含路寬 x −86～86、z −78～79） | 地面桌墊取 200×180 足夠（§4） |
| 不自交 | 非相鄰段（沿線距離 > 40）中心線最近距離 **25.3**（T2 髮夾兩腿），扣掉路寬後路緣淨距 13.3 | 不做立體交叉，`trackProgress` 不需要 y 判定 |

**控制點表 `TRACK_CTRL`**（48 點，閉合，最後一點接回第 0 點；直接照抄成 `[number, number][]`）：

| # | x | z | 標記 |
|---|---|---|---|
| 0 | -8 | -72 | **起跑線 s=0**（往 +x） |
| 1 | 5 | -72 | |
| 2 | 17.5 | -72 | |
| 3 | 30.5 | -72 | |
| 4 | 43 | -72 | |
| 5 | 56 | -72 | T1 長彎入口 |
| 6 | 65 | -70.5 | |
| 7 | 72.5 | -65.5 | |
| 8 | 78 | -58 | |
| 9 | 80 | -49 | |
| 10 | 78.5 | -40 | T1 出口／跳台直線 |
| 11 | 74 | -26.5 | |
| 12 | 69 | -13.5 | |
| 13 | 64 | -0.5 | |
| 14 | 59.5 | 13 | |
| 15 | 54.5 | 26 | |
| 16 | 50 | 39 | |
| 17 | 45 | 52.5 | T2 髮夾入口 |
| 18 | 40 | 65.5 | |
| 19 | 35 | 71.5 | |
| 20 | 27 | 73 | |
| 21 | 20 | 69 | |
| 22 | 17 | 61.5 | T2 出口／回程直線 |
| 23 | 17 | 46 | |
| 24 | 17 | 30.5 | |
| 25 | 17 | 15 | |
| 26 | 17 | -0.5 | T3 右彎 |
| 27 | 13 | -10 | |
| 28 | 4 | -13.5 | 中段直線 |
| 29 | -14 | -13.5 | S1（右） |
| 30 | -20.5 | -12 | |
| 31 | -25.5 | -7.5 | |
| 32 | -30.5 | -3.5 | S2（左） |
| 33 | -37 | -1.5 | S 出口 |
| 34 | -51 | -1.5 | |
| 35 | -65 | -1.5 | T4 左彎 |
| 36 | -72.5 | -3.5 | |
| 37 | -78 | -9 | |
| 38 | -80 | -16.5 | 左側直線 |
| 39 | -80 | -30 | |
| 40 | -80 | -43.5 | |
| 41 | -80 | -57 | T5 左彎 |
| 42 | -78 | -64.5 | |
| 43 | -72.5 | -70 | |
| 44 | -65 | -72 | 終點直線（發車格在這段） |
| 45 | -50.5 | -72 | |
| 46 | -36.5 | -72 | |
| 47 | -22 | -72 | |

```ts
export const TRACK_CTRL: [number, number][] = [[-8,-72],[5,-72],[17.5,-72],[30.5,-72],[43,-72],[56,-72],[65,-70.5],[72.5,-65.5],[78,-58],[80,-49],[78.5,-40],[74,-26.5],[69,-13.5],[64,-0.5],[59.5,13],[54.5,26],[50,39],[45,52.5],[40,65.5],[35,71.5],[27,73],[20,69],[17,61.5],[17,46],[17,30.5],[17,15],[17,-0.5],[13,-10],[4,-13.5],[-14,-13.5],[-20.5,-12],[-25.5,-7.5],[-30.5,-3.5],[-37,-1.5],[-51,-1.5],[-65,-1.5],[-72.5,-3.5],[-78,-9],[-80,-16.5],[-80,-30],[-80,-43.5],[-80,-57],[-78,-64.5],[-72.5,-70],[-65,-72],[-50.5,-72],[-36.5,-72],[-22,-72]]
```

### 1.2 路段與彎道

曲率 κ 以 768 點折線重取樣成每 1 單位一點，取「s+3 處航向 − s−3 處航向」/ 6 算（左彎 κ<0、右彎 κ>0；窗口改成 ±5 結果差 <3 單位）。設計值是組圖時用的圓弧，實測值是取樣後量到的。

| 路段 | s 範圍（設計） | 設計 | 實測（\|κ\| ≥ 1/30 的連續段） | 用途 |
|---|---|---|---|---|
| 起跑直線 | 0–64 | 直線 64 | — | 起跑、尾流 |
| **T1 長彎** | 64–110 | 左 110°，R 24 | 69–106（長 37），轉 92°，最小 R 18.2 | **長彎①**：可甩尾到橘／紫 |
| 跳台直線 | 110–222 | 直線 112，朝 NNW（ry −20°） | — | 道具箱①、加速帶①、**跳台** |
| **T2 髮夾** | 222–256 | 左 160°，R 12 | 223–256（長 33），轉 **146°**（\|κ\|≥1/40 量 153°），最小 R 10.3 | **≥120° 大彎**＋**長彎②** |
| 回程直線 | 256–318 | 直線 62，朝南 | — | 加速帶②、道具箱② |
| T3 | 318–338 | 右 90°，R 13 | 317–337（長 20），轉 74°，R 10.2 | |
| 中段直線 | 338–356 | 直線 18，朝西 | — | |
| **S 彎** | 356–383 | 右 55° R 14 ＋ 左 55° R 14，中間不留直線 | 右 357–366（37°）→ 左 373–384（35°） | **左右連續 S 彎**（車道往北平移 12） |
| S 出口直線 | 383–411 | 直線 28，朝西 | — | 加速帶③ |
| T4 | 411–434 | 左 90°，R 15 | 412–433（長 21），轉 76°，R 13.5 | |
| 左側直線 | 434–475 | 直線 40.3，朝南 | — | 道具箱③ |
| T5 | 475–498 | 左 90°，R 15 | 476–498（長 22），轉 78°，R 13.5 | |
| 終點直線 | 498–554.8 | 直線 57，朝東 | — | 發車格、衝線 |

**長彎定義（給 AC5 bot 判甩尾）**：`LONG_CORNER_K = 1/30`、`LONG_CORNER_MIN_LEN = 30`——沿線連續同號 `|κ| ≥ 1/30` 且長度 ≥ 30 的區段。本賽道恰好 T1（37）、T2（33）兩段符合；T3／T4／T5 只有 20–22，離門檻還有 8 以上的餘裕，取樣或窗口小改不會翻盤。實作可以開局時用這兩個常數掃一次 `track.pts` 算出來，也可以直接用下表（兩者應一致，單測可互相對照）：

```ts
export const LONG_CORNERS: { s0: number; s1: number; dir: -1 | 1 }[] = [
  { s0: 69, s1: 106, dir: -1 }, // T1 左 ~92°
  { s0: 223, s1: 256, dir: -1 }, // T2 髮夾 ~146°
]
```
bot 在 `s ∈ [s0 − 4, s1 − 6]` 按住甩尾、在 `s1 − 6` 附近放開（失誤參數見 §2.3）。

**單圈目標**：用「κ 限速 `v ≤ min(17, 2.4/|κ|)`、ACCEL 13、BRAKE 22」沿中心線積分，理想單圈 **32.6 s**；一般玩家有效率約 0.8 → **約 41 s**，3 圈約 2 分鐘，落在 35–50 秒目標內。蓄力加速、尾流、道具會讓高手跑進 35 s 左右，失誤多的落到 45–50 s。

### 1.3 檢查點、發車格

- `CHECKPOINTS = 8`，**`checkpoints[k] = len · k / 8`**（k = 0..7，等距）；k=0 就是起跑／終點線。存成 s 值即可，不用額外座標。
- 重生點 = 該檢查點 s 的中心線點，lateral 0，ry 取該處切線。

| k | s | x | z | ry° | 位置 |
|---|---|---|---|---|---|
| 0 | 0 | -8 | -72 | 90 | 起跑線 |
| 1 | 69.3 | 61.3 | -71.5 | 81 | T1 入口 |
| 2 | 138.7 | 68.8 | -13.0 | -21 | 跳台直線（加速帶①之前，跳台之前 11） |
| 3 | 208.0 | 45.1 | 52.1 | -21 | T2 入口前 |
| 4 | 277.4 | 17.0 | 39.1 | 180 | 回程直線 |
| 5 | 346.7 | -5.3 | -13.8 | -89 | 中段直線（S 彎前） |
| 6 | 416.1 | -70.8 | -2.6 | -112 | T4 彎中 |
| 7 | 485.4 | -76.0 | -67.2 | 138 | T5 彎中 |

> 檢查點刻意不落在跳台（s 150–156）上，重生不會被放在斜坡上。抄捷徑：T2 兩腿淨距 13、路面外降到 0.3 倍速，切內野不划算；就算切了，跳過檢查點也不算圈（AC2）。

**發車格**（終點直線，起跑線後方，交錯排；`colorIndex` 0..3 依序）：

| 格 | s | lateral | x | z | ry |
|---|---|---|---|---|---|
| 0 | len − 5 | −3（左＝北） | -13 | -69 | π/2 |
| 1 | len − 9 | +3 | -17 | -75 | π/2 |
| 2 | len − 13 | −3 | -21 | -69 | π/2 |
| 3 | len − 17 | +3 | -25 | -75 | π/2 |

開局 `lap = 0`、`cp = 0`（已在起跑線後方；第一次通過 k=0 時進入第 1 圈，或照 babylon-rules 的 `advanceLap` 約定——發車格在 s>len−20 屬「上一圈尾端」，實作要讓第一次過線算 lap 1 而不是 lap 2）。

### 1.4 跳台

| 常數 | 值 | 說明 |
|---|---|---|
| `JUMP_S0` / `JUMP_S1` | **150 / 156** | 斜坡起訖（跳台直線上，(64.7, −2.5) → (62.7, 3.2)） |
| `JUMP_H` | 1.1 | 斜坡最高點（唇口）高度 |
| 騰空 | 車在 `s` 越過 `JUMP_S1` 且速度 ≥ 6 時起跳：`vy = 4 + 0.25·speed`（全速 17 → 8.25），重力 `JUMP_G = 30`；`y(t) = JUMP_H + vy·t − ½·g·t²`，落到 y ≤ 0 時落地 | 全速騰空約 0.59 s、飛行約 10 單位，落點約 s 166；速度 < 6 時沿斜坡下滑不騰空 |
| 斜坡上 | `s ∈ [S0, S1]` 且 `abs(lateral) ≤ 4`：`y = JUMP_H · (s − S0)/(S1 − S0)`，車身俯仰 = −atan(JUMP_H/6) ≈ −10° | 只影響 y 與視覺，x/z 照常（AC3） |
| 空中 | 不能轉向以外的操作照常；騰空期間不吃路面外降速、不觸發揚塵／胎痕；車頭依 `vy` 微俯仰（±12°） | 落地播 §8 #12 |

斜坡寬 8（lateral −4～4），兩側留 2 單位平地，想避開跳台的可以走旁邊。

### 1.5 加速帶（固定位置，取代隨機）

| # | s | lateral | x | z | ry° | 說明 |
|---|---|---|---|---|---|---|
| ① | 143 | 0 | 67.3 | -9.0 | -21 | 跳台前 7 單位，吃了飛更遠 |
| ② | 262 | +3（出彎外側＝西側） | 13.8 | 54.5 | 179 | 髮夾出彎自然甩到外線就壓得到；甩尾出彎接加速帶＝雙重加速 |
| ③ | 394 | −3 | -48.8 | -4.5 | -91 | S 彎出口，走對線才吃得到 |

觸發框：沿線 `abs(s − pad.s) ≤ 2`、`abs(lateral − pad.lateral) ≤ 1.6`（即 3.2 寬 × 4 長的矩形）；效果照現行 `BOOST_SPEED`／`BOOST_DURATION_MS` 不改數值。

### 1.6 道具箱（`ITEM_ROWS = 3`，每列 4 個）

lateral 一律 `[−4.5, −1.5, +1.5, +4.5]`，箱 id = `列 × 4 + 欄`（0..11）。觸發半徑 1.4（車中心到箱中心的 xz 距離）。

| 列 | s | id | 箱中心 x, z（依 lateral −4.5 → +4.5） |
|---|---|---|---|
| 0 | 122 | 0–3 | (70.5, −30.1) (73.4, −29.1) (76.2, −28.1) (79.0, −27.1) |
| 1 | 295 | 4–7 | (21.5, 21.5) (18.5, 21.5) (15.5, 21.5) (12.5, 21.5) |
| 2 | 452 | 8–11 | (−75.5, −34.8) (−78.5, −34.8) (−81.5, −34.8) (−84.5, −34.8) |

## 2. 落後補償與 AI

### 2.1 道具機率表 `ITEM_ODDS`（`rollItem(rank, total, r)`）

先把名次換成檔：`tier = rank === 1 ? 0 : rank === total ? 3 : (rank − 1) / (total − 1) <= 0.5 ? 1 : 2`（`total === 1` 時 tier 0）。4 台時 1st→0、2nd→1、3rd→2、4th→3；3 台時 2nd→1；2 台時 2nd→3。

| tier | 名次（4 台） | banana | shell | mushroom | shield | P(mushroom∪shell) |
|---|---|---|---|---|---|---|
| 0 | 1st | **0.60** | **0** | **0** | **0.40** | 0 |
| 1 | 2nd | 0.35 | 0.30 | 0.20 | 0.15 | 0.50 |
| 2 | 3rd | 0.20 | 0.35 | 0.30 | 0.15 | 0.65 |
| 3 | 最後 | 0.10 | 0.35 | 0.45 | 0.10 | **0.80** |

- 取法：`r ∈ [0, 1)`，依 **`banana → shell → mushroom → shield`** 的順序累加，回傳第一個 `r < 累計` 的種類；浮點誤差落到尾端時回傳該列最後一個機率 > 0 的種類。這個順序讓單測可以用固定 r 斷言（例：tier 0、r = 0.59 → banana，r = 0.6 → shield）。
- 滿足 AC4 單測：第 1 名 P = 0、最後一名 0.80 ≥ 0.6、tier 0→3 非遞減（0 / 0.5 / 0.65 / 0.8）。
- 只調道具機率，不碰任何車速數值。

### 2.2 道具數值補充（brief AC4 已定的不重複）

| 項目 | 值 | 說明 |
|---|---|---|
| 香蕉丟出位置 | 車後 2.2（沿 −ry），lateral 不變；靜止 | 碰撞半徑 0.9 |
| 香蕉上限 | 場上最多 8 根，超過時最舊的 `itemGone { reason: 'expire' }` | 防止堆滿 |
| 龜殼起點 | 車前 1.8，速度 26（> BOOST_SPEED 22，追得上） | 碰撞半徑 0.8 |
| 龜殼追蹤 | 沿中心線前進（每幀取 `trackProgress` 的 s 往前推 `26·dt`，lateral 以 4/s 收斂到 0），目標車距離 < 10 時改直接朝目標車轉向（最大轉速 6 rad/s） | 只撞目標；路上的香蕉會互相抵銷（兩者都 `itemGone`） |
| 龜殼直射 | 第 1 名使用：沿車頭方向直線，碰路緣外（`abs(lateral) > 6.5`）就消失 | |
| 護盾泡泡 | 半徑 1.6 | 視覺見 §6 |

### 2.3 AI 參數（`raceRules/raceAI.ts`）

| 常數 | 值 | 說明 |
|---|---|---|
| `AI_LOOKAHEAD` | 8（brief 定） | 目標點 = 中心線上 `s + 8` 再加 `lineOffset` |
| `AI_CORNER_K` | **1.5** | 彎前限速：取 `s+4..s+20` 範圍內最大 `|κ|`，目標速度 `min(MAX_SPEED, 1.5 / |κ|)`；速度 > 目標就 throttle 0，> 目標 + 3 才煞車。本賽道上 T2 髮夾與 T3（R≈10 → 目標約 15）、S1（R≈10）會收油，T1／T4／T5 全速。單測：直線 κ≈0 → throttle 1；前方 R 10 的彎且速度 17 → throttle 0 |
| `AI_LINE_OFFSET` | 彎道內側 1.5 | 在長彎與 T3–T5 把目標點往彎心偏 1.5，看起來會切內線 |
| 轉向 | `steer = clamp(angleDiff(ry, 目標方位) · 2.2, −1, 1)` | 跟玩家同一套 `TURN_RATE` |

**`AI_ERR`（失誤參數，全部以 seed 化亂數抽，不碰 `Math.random`）**：

```ts
export const AI_ERR = {
  steerNoise: 0.12,          // 轉向疊加雜訊振幅（−1..1 的比例）
  noiseHoldMs: 400,          // 雜訊目標值每 400ms 換一次，期間線性內插
  mistakeRatePerSec: 0.05,   // 每秒觸發「走大線」失誤的機率（每台約 20 秒一次）
  mistakeMs: 700,            // 失誤持續時間：目標點往彎外偏 mistakeLateral
  mistakeLateral: 4,         // 偏 4 → 車中心到 lateral ±4，偶爾半個輪子出路面
  lateBrakeChance: 0.15,     // 進髮夾時 15% 機率晚 6 單位才收油
  driftReleaseJitterMs: 250, // 長彎放開甩尾的時機 ±250ms → 有時只拿到藍／橘火
  driftSkipChance: 0.2,      // 20% 的長彎不甩尾
  itemDelayMs: [300, 1200],  // 撿到道具後最快多久才會用（均勻分布）
} as const
```

**道具使用條件**（AC5，給單測）：

| 道具 | 條件 |
|---|---|
| `banana` | 後方 0 < Δs ≤ 12（沿線距離，跨圈要換算）、`abs(Δlateral) ≤ 3` 有車 → 丟；或持有超過 8 s 也丟 |
| `shell` | 有前一名且沿線距離 ≤ 40 → 射；自己第 1 名時 → 前方 20 單位內有任何車才直射，否則留著 |
| `mushroom` | 前方 `s .. s+25` 的最大 `|κ|` < 1/40（直線）→ 用 |
| `shield` | 撿到後 `itemDelayMs` 到了就開；或後方 15 內有龜殼正在追自己時立刻開 |

**卡住與出界**（AC5 單測「3 秒內回到路面或觸發重生」）：bot 只要 `abs(lateral) > 6` 就把目標點改成 `s + 4`、lateral 0（直接朝路面中心開）；仍照玩家規則 `OFFTRACK_RESPAWN_MS = 3000`／`STUCK_MS = 2000` 重生。

## 3. 色票

### 3.1 玩家（不另外定）
直接 import `@/babylon/fx/palette` 的 `PLAYER_PALETTE`（`light`／`base`／`dark`）與 `OUTLINE`（`#2B2440`）。`colorIndex` 照 brief AC7（`ctx.players` 依序＋bots 依序）。

| 序 | 名稱 | light | base | dark | 用在哪 |
|---|---|---|---|---|---|
| P1 | 紅 | `#FF8A94` | `#FF3B4E` | `#B3122A` | 車身 radial、尾翼（base）、側裙（dark）、安全帽（light→base）、小地圖點、HUD 色帶 |
| P2 | 藍 | `#8CC4FF` | `#2F86FF` | `#1446B8` | 同上 |
| P3 | 綠 | `#93F0A8` | `#2FCF5E` | `#138A3A` | 同上 |
| P4 | 黃 | `#FFF0A0` | `#FFC21A` | `#C27D00` | 同上 |

### 3.2 場景與物件（新建 `src/babylon/games/raceFx/palette.ts`，型式比照 `tankFx/palette.ts` 的常數物件）

| key | hex | 用途 |
|---|---|---|
| `sky` | `#9ED8F5` | `scene.clearColor` 與霧色（linear fog 110→230）。追尾視角看得到地平線，天色就是背景 |
| `matA` / `matB` | `#EBD9AF` / `#E2CE9F` | 「桌墊」奶茶色，10×10 大格棋盤（貼圖），跟車色都拉得開 |
| `matLine` / `matMajor` | `#D3BD8A` / `#C4AA72` | 桌墊細格線（每 2 單位）與粗格線（每 10 單位） |
| `table` / `tableGrain` | `#C08A55` / `#A97646` | 桌墊外的木桌（場外延伸），木紋條 |
| `road` / `roadSeam` | `#5A5380` / `#47406A` | 玩具軌道路面（深紫灰），每 8 單位一條拼接縫 `roadSeam` 2px＋凸榫 |
| `roadEdge` | `#FFF6E3` | 直線段路緣白線（寬 0.35，貼路邊內側） |
| `curbRed` / `curbWhite` | `#F0503C` / `#FFF6E3` | 彎道紅白路緣，交錯每 1.6 單位；比 P1 紅偏橘，不會跟紅車混 |
| `curbSide` | `#B8392B` / `#D9CBB0` | 路緣側面（紅／白的暗階） |
| `startA` / `startB` | `#FFFFFF` / `#2B2440` | 起跑格子線 |
| `arch` / `archDark` | `#FF8A3D` / `#C2561B` | 起跑拱門立柱（橘色積木）；橫幅底色 `#FFF6E3`、字 `OUTLINE` |
| `stand` / `standSide` | `#B3A4C9` / `#6F6490` | 看台階梯（跟 bomber／tank 外框積木同色，系列感） |
| `crowd` | 4 個玩家 base ＋ `#FFF6E3` | 看台上的「棋子觀眾」，thin instance color 輪替 |
| `flagPole` | `#E3E6EF` | 旗桿；旗面用 4 個玩家 base 輪替 |
| `block1..4` | `#FF8A94` `#8CC4FF` `#93F0A8` `#FFF0A0`（側面用 dark） | 場邊積木裝飾（玩家 light 色，跟車的 base 拉開一階） |
| `treeTop` / `treeTrunk` | `#7CCB6A` / `#A97646` | 棒棒糖樹 |
| `cone` / `coneStripe` | `#FF8A3D` / `#FFF6E3` | 三角錐（髮夾外側） |
| `boostPad` / `boostArrow` | `#FFB21F` / `#FFF6C8` | 加速帶底板與箭頭（箭頭捲動、進 Glow） |
| `ramp` / `rampSide` / `rampStripe` | `#FFD23F` / `#C79A00` / `#2B2440` | 跳台（黃黑斜紋警示） |
| `tire` / `hub` | `#2F2A40` / `#C3CBD8` | 輪胎、輪轂（與 tank `wheel`／`hub` 同族） |
| `seat` / `steer` | `#3A3556` / `#2B2440` | 座艙、方向盤 |
| `visor` / `visorShine` | `#2E3A4F` / `#9FE4FF` | 安全帽護目鏡與反光條 |
| `face` / `eye` | `#FFF1E0` / `#2B2440` | 駕駛臉（同 bomber／tank 臉色） |
| `headlight` | `#FFF6C8` | 車頭燈 |
| `exhaust` | `#8E9AB0` | 排氣管 |
| `aiBall` | `#39E6FF` | bot 安全帽天線球（同 bomber／tank） |
| `drift1` / `drift2` / `drift3` | `#39C2FF` / `#FF9A1F` / `#C05CFF` | 甩尾火花藍／橘／紫（`DRIFT_TIERS` 三段）；放開噴焰同色 |
| `flame` | `#FFF6C8` → `#FFC53A` → `#FF7A1A` | 加速噴焰（加速帶、加速菇），跟 bomber 火焰同色 |
| `slip` | `#E8F7FF` | 尾流風線 |
| `dust` / `skid` | `#E4D3A8` / `#2B2440`（25%） | 揚塵（桌墊色）、胎痕 |
| `spark` | `#FFFFFF` → `#FFE38A` | 碰撞火花 |
| `shield` / `shieldFill` | `#39D5FF` / `#7FE8FF` | 護盾泡泡（同 tank） |
| `confetti` | 4 個玩家 base ＋ `#FFFFFF` | 衝線彩帶 |

### 3.3 道具（`ITEM_COLORS`，`raceFx/palette.ts`；HUD 道具欄與 3D 共用）

| kind | 名稱 | 主色 | 暗階 | 點綴 | HUD 圖示 |
|---|---|---|---|---|---|
| `banana` | 香蕉皮 | `#FFD23F` | `#C79A00` | 蒂 `#7A4A1D` | §9.6 `BananaIcon` |
| `shell` | 紅龜殼 | `#E8413A` | `#A82A24` | 殼緣 `#FFF6E3`、殼紋 `#FF8A80` | §9.6 `ShellIcon` |
| `mushroom` | 加速菇 | `#FF7A3D` | `#C2561B` | 白點 `#FFF6E3`、柄 `#FFF1E0`、眼 `OUTLINE` | §9.6 `MushroomIcon` |
| `shield` | 防護罩 | `#1FB5E0` | `#0B7FA6` | 亮面 `#7FE8FF` | lucide `Shield`（白 stroke 2.5，底 `#1FB5E0`） |
| 道具箱 | — | 面色輪替 `#FF5C8A` `#FFD23F` `#39D5FF` `#7CF06A` | 各自 ×0.75 | 「?」白字＋`OUTLINE` 描邊 | — |

## 4. 物件建模表（`raceFx/models.ts`；頂點色、車頭朝 +z、原點在地面中心）

全部用 `fx/geometry` 的 `roundedBox` 與 `fx/models` 的 `cylinder`／`sphere`／`frustum`／`torus`／`radial`／`solid`／`at`／`mergeData` 組合。

### 4.1 玩具車（每台 **1 個合併 mesh `body`** ＋ 共用輪胎 thin instance）

外接框 1.6 寬 × 2.3 長 × 1.55 高（含安全帽）。碰撞沿用 `CAR_PUSH_DIST = 1.4`，不改。

| 部件 | 組成（w×h×d、位置） | 色 |
|---|---|---|
| 底盤車身 | roundedBox 1.36×0.40×2.0，r 0.2，y 0.22–0.62 | `radial(light, base, dark)` |
| 車鼻 | roundedBox 1.0×0.24×0.46，r 0.12，z 0.98、y 0.26–0.50；前保桿 roundedBox 1.3×0.14×0.18，r 0.07，z 1.12、y 0.22 | 車鼻 base；保桿 `OUTLINE` 系 `#3A3556` |
| 側裙 ×2 | roundedBox 0.14×0.18×1.3，r 0.06，x ±0.70、y 0.28 | dark |
| 車頭燈 ×2 | sphere d 0.18，z 縮 0.6，(±0.36, 0.48, 1.02) | `headlight` |
| 座艙 | roundedBox 0.86×0.20×0.86，r 0.12，z −0.18、y 0.62–0.82 | `seat` |
| 方向盤 | torus d 0.34 粗 0.06，中心 (0, 0.92, 0.22)，繞 x 傾 −60° | `steer` |
| 尾翼 | 支柱 ×2 cylinder d 0.08 h 0.36 於 (±0.34, 0.80, −0.86)；翼板 roundedBox 1.5×0.09×0.42，r 0.04，y 1.0、z −0.92；端板 ×2 roundedBox 0.06×0.26×0.46 於 x ±0.76 | 翼板 base；端板 dark；支柱 `exhaust` |
| 排氣管 ×2 | cylinder d 0.14 h 0.22 沿 z，(±0.26, 0.34, −1.08)，管口 d 0.08 `OUTLINE` | `exhaust` |
| 駕駛身體 | roundedBox 0.52×0.34×0.36，r 0.12，y 0.74–1.08、z −0.20 | base（賽車服同車色） |
| 駕駛安全帽 | sphere d 0.64，y 1.30、z −0.18；帽頂條紋 roundedBox 0.12×0.04×0.6（真人白 `#FFFFFF`；bot 不畫） | `radial(light, base, dark)` |
| 護目鏡 | roundedBox 0.50×0.18×0.10，r 0.06，(0, 1.30, 0.12)；反光條 0.30×0.03 於鏡上緣偏左 | `visor`／`visorShine` |
| 臉（護目鏡下緣） | roundedBox 0.36×0.10×0.06，(0, 1.17, 0.12)；眼 ×2 sphere d 0.07 (±0.08, 1.30, 0.17) 只在正視看得到 | `face`／`eye` |
| bot 天線 | cylinder d 0.04 h 0.32 於 (0.18, 1.60, −0.25)，頂端 sphere d 0.14 | `exhaust`／`aiBall` |

**輪胎**：全場 1 組 thin instance（4 台 × 4 輪 = 16 筆，`ThinGroup`）。模型 = 胎身 cylinder d 0.62 寬 0.34（沿 x 軸）＋外側輪轂 cylinder d 0.32 寬 0.36（凸出 0.01）＋胎紋（頂點色每 30° 一條 `#3A3556`，讓轉動看得出來）。
- 位置：前輪 (±0.80, 0.31, 0.70)，後輪 (±0.82, 0.33, −0.70) 縮放 1.08（後輪大一點，玩具感）。
- 動畫：`rotation.x += 移動距離 / 0.31`；前輪 `rotation.y = steer × 0.42`（甩尾時 ×1.3 反打）。
- 輪胎不描邊、投影（§5）。

**車身姿態**（純視覺，全部作用在 `body` 的子節點 `visual` 上，x/z 不動）：
- 轉向側傾：`rotation.z = −steer × 0.07 × speedRatio`。
- 甩尾偏航：甩尾中 `visual.rotation.y` 往外側偏 `0.38 × steer` rad（看起來車尾甩出），放開 120ms 回正。
- 甩尾起跳：按下甩尾瞬間 `visual.y` 做一次 0.25 高、160ms 的小跳（`sin(π·t)`），落地同時開始蓄力火花。
- 跳台俯仰：§1.4。
- 加速：`visual.rotation.x = −0.06`（車頭微抬）持續整段加速。

**「你」標記**：billboard plane 0.9×0.45，`fx/textures.createLabelTexture(scene, 'race-you', '你', PLAYER_PALETTE[ci].base)`，中心 y **2.0**、z −0.18（安全帽正上方 0.38；稿子實測 1920 下落在 y ≈ 570，車頂 y ≈ 624，不遮車）。原本試過 y 2.35，追尾視角下會疊到前方 20 單位的車，所以壓低。下方加一個 0.22 的倒三角（同貼圖畫在下緣）。每局建一次，不重畫。只有自己有。

### 4.2 道具與道具箱

| 物件 | 做法 | 尺寸／規格 | 數量 |
|---|---|---|---|
| **道具箱** | 1 組 thin instance。roundedBox 1.3 立方，r 0.2；6 面頂點色依 §3.3 輪替（對面同色）；每面貼「?」：一張 256×256 DynamicTexture（白 ? 加 `OUTLINE` 10px 描邊，透明底）當 `emissiveTexture`＋`opacityTexture` 疊在第二個 mesh 上太貴 → 改用**同一張貼圖當 diffuse、底色烘進貼圖的 4 種底色版本**：做 1024×256 圖集，4 格各是一種底色＋?，用 faceUV 對到 6 面 | y 1.1 浮動 ±0.15（週期 1.6s，相位依 id 錯開 0.4s）；`rotation.y += dt·1.4`、`rotation.x = 0.35`（斜放，玩具陳列感）；alpha 1（不透明，省排序） | 12 筆 |
| 道具箱影子 | blob 影（`fx_circle` 平面 1.4，`#2B2440` 25%），thin instance，y 0.02 | 箱被拿走時一起縮 | 12 筆 |
| **香蕉皮** | 合併 mesh 的 thin instance：中心 sphere d 0.42 壓扁 y 0.6；3 片皮 = frustum h 0.5 底 d 0.26 頂 d 0.08，從中心往外 120° 間隔趴倒（繞 x 轉 70°），尖端 sphere d 0.1 暗階；蒂 cylinder d 0.08 h 0.16 朝上 | 外接約 1.0×0.4×1.0；y 0 貼地；靜止不轉 | 池 8 |
| **紅龜殼** | 合併 mesh 的 thin instance：殼頂 sphere d 0.9 y 縮 0.62，`radial(#FF8A80, #E8413A, #A82A24)`；殼緣 torus d 0.92 粗 0.16 `#FFF6E3`，y 0.12；殼頂 3 顆凸點 sphere d 0.18 `#FF8A80` 於殼頂 120° 間隔 | y 0.3 貼地滑行；`rotation.y += dt·10`（高速旋轉） | 池 4 |
| **加速菇**（只在使用瞬間出現） | 傘 sphere d 0.7 y 縮 0.7、只取上半（`slice`，或用 sphere 縮在地面下）`#FF7A3D`；白點 ×5 sphere d 0.14 貼在傘面；柄 cylinder d 0.36 h 0.32 `#FFF1E0`；眼 ×2 sphere d 0.06 `OUTLINE` 在柄前 | 在車頂 y 2.0 彈出：scale 0→1.2→1（`backOut`，160ms），停 80ms，往下縮進車身 100ms | 每台 1，平常 `setEnabled(false)` |
| **護盾泡泡** | sphere d **3.2**（segments 24），中心 y 0.75；`shieldFill` alpha 0.22，`emissiveFresnelParameters` 邊緣 `shield`；自轉 0.6 rad/s | 最後 2 s 以 6Hz 閃 | 每台 1 |

### 4.3 場景

| 物件 | 做法 | 尺寸／規格 |
|---|---|---|
| **桌墊地面** | ground 200×180，中心 (0, 0)；DynamicTexture 1024×1024（`uScale = vScale = 1`；每 10 單位一大格 = 51px）：`matA`／`matB` 棋盤、每 2 單位細線 `matLine` 1px、每 10 單位粗線 `matMajor` 2px、四邊 1.5 單位圓角包邊 `#C4AA72`；左下角印一排尺規刻度（純裝飾） | 接收陰影 |
| **木桌** | 第 2 個 ground 600×600，y −0.05，DynamicTexture 256×256 木紋（`table` 底，`tableGrain` 縱向細條 6 條，`uScale = vScale = 12`），`disableLighting` + emissive 0.85，被霧吃掉遠端 | 不收陰影 |
| **賽道路面** | 1 個 mesh：沿 768 點中心線兩側各 `TRACK_WIDTH/2` 擠出條帶（每點 2 頂點），y 0.02；UV：u = lateral（0..1），v = s / 8（每 8 單位重複一次）。貼圖 128×256：`road` 底、v=0 處一條 `roadSeam` 3px 拼接縫＋兩個凸榫半圓（玩具軌道拼接感）、兩側內緣 `roadEdge` 白線 6px（只在直線段要白線，彎道段被路緣蓋住即可，所以貼圖直接畫） | 接收陰影；**不描邊** |
| **起跑線** | plane 12×1.4，y 0.03，於 s=0 垂直路面；貼圖 2 列 × 8 欄 `startA`／`startB` 格子 | |
| **紅白路緣** | 1 組 thin instance 小方塊：roundedBox 1.5（沿線）×0.12×0.9，r 0.04；放在 `|κ| ≥ 1/40` 的路段兩側（lateral ±(6 + 0.45)），每 1.6 單位一塊，紅白交替（instance color）；直線段不放 | 約 2×150 = 300 筆，1 draw call；不描邊 |
| **起跑拱門** | 合併 mesh：立柱 ×2 = 積木疊 3 塊 roundedBox 1.4×1.6×1.4（凸點 2×2），於 s=0 的 lateral ±7.6；橫樑 roundedBox 16.6×1.5×0.8 於 y 5.3；橫幅貼圖 1024×96（`#FFF6E3` 底、兩端黑白格、中間「A TOY RACER」Fredoka＋`OUTLINE`）；橫樑下垂 4 面三角旗（4 玩家色） | 柱 `arch`／`archDark`；描邊（大地標） |
| **看台** | 1 個合併 mesh：沿起跑直線北側（lateral −15 ～ −21，s 4 ～ 44），3 階 roundedBox（每階高 1.2、深 2），側面 `standSide`、頂 `stand`；屋頂一片傾斜 roundedBox 40×0.3×7 `#FFF6E3` 加紅白波浪邊（頂點色） | |
| **觀眾** | thin instance：「棋子人」= frustum h 0.7 底 d 0.5 頂 d 0.3 ＋頂 sphere d 0.36；4 階 × 每 1.1 單位 1 個 ≈ 100 筆；instance color 輪替 4 玩家 base＋白；每 0.6 s 隨機 20% 的人 y +0.2 彈一下（歡呼），衝線時全部跳 | 1 draw call |
| **旗子** | 看台屋頂上 8 支：旗桿 cylinder d 0.1 h 2.4 + 旗面 plane 1.2×0.7（雙面，頂點色玩家 base 輪替）；旗面 `rotation.y = 0.25·sin(t·3 + i)` 擺動 | 旗面 thin instance |
| **場邊積木** | 2 組 thin instance：① 2×2 凸點積木 roundedBox 2×1.2×2（凸點 4 顆），② 2×4 長積木 roundedBox 4×1.2×2（凸點 8 顆）；顏色 `block1..4` instance color；擺法：一律在路緣外 ≥ 9 單位（玩家正常開不會穿模），疊 1–3 層，共約 40 筆。指定群組（`variant-A-track.webp` 的方塊，數字＝層數）：內野 (−30, −40) 3 層小塔、內野 (40, 20) 2 層、T2 外側 (52, 80) 2 層、T5 外側 (−86, −84) 2 層；其餘散在桌墊外緣 x ±90 一帶 | 不描邊、投影關（只有車和道具投影） |
| **棒棒糖樹** | thin instance：樹幹 cylinder d 0.4 h 1.8 ＋ 樹冠 sphere d 2.4（`treeTop`，頂點色上亮下暗），約 24 棵，沿場外與內野散佈（同樣距路緣 ≥ 9）。稿上 12 棵的座標：(−50,−40) (−20,−30) (2,−42) (36,−26) (32,34) (−58,18) (−40,22) (62,60) (−88,30) (88,−10) (10,80) (−60,−84)，其餘自由補 | |
| **三角錐** | thin instance：frustum h 0.9 底 d 0.6 頂 d 0.1 ＋白環；放在 T2 髮夾外側 lateral +8.5、s 228–252 每 3.4 一個（8 個），T3 外側 lateral −8.5、s 322–334 每 4 一個（4 個） | **無碰撞**（純裝飾；在路面外，碰到也只是穿過，3 秒內會被重生規則撿回） |
| **跳台** | 合併 mesh：斜坡楔形（寬 8、長 6、高 0.02→1.1，頂面 `ramp`＋45° `rampStripe` 黃黑斜紋貼圖 128×128，側面 `rampSide`）；唇口一條 roundedBox 8×0.14×0.3 白邊；兩側各一支 0.5 的積木護欄 | 收、投陰影（大物件，唯一投影的場景物） |
| **加速帶** | thin instance（3 筆）：plane 3.2×4 平貼 y 0.035，底 `boostPad`、白邊 0.12；箭頭貼圖 64×128（3 個 `boostArrow` V 形），`vOffset -= dt·2.2` 往前捲動；`disableLighting` + emissive | 進 Glow；不收陰影（保持亮） |
| **檢查點** | **不可見**（純邏輯）；開發用 `?raceDebug=1` 時可畫半透明線，正式不畫 | — |

## 5. 材質、描邊、陰影、Glow

| 項目 | 規格 |
|---|---|
| 材質 | 全部 `StandardMaterial` 經 `fx/look`：`new ToyLook(scene, camera, { tag: 'race', shadowRadius: 22, outline: OUTLINE, exposure: 1.08, contrast: 1.08 })` 套兩階 ramp（`TOON_RAMP`）；頂點色物件 `useVertexColors`。桌墊淺色在 ACES 下會發灰，exposure 拉到 1.08 |
| **描邊名單**（`renderOutline` 0.025、`OUTLINE`） | ① 4 台車 `body` ② 輪胎 thin instance（**例外：不描**，輪胎本身就是深色）③ 道具箱 thin instance ④ 香蕉、龜殼 thin instance ⑤ 加速菇 ⑥ 起跑拱門。**不描**：路面、路緣、地面、看台、觀眾、積木、樹、錐、跳台、加速帶、護盾泡泡、特效 |
| 雙光 | `ToyLook` 內建 Hemispheric 0.55 ＋ Directional 0.9 `#FFF4E0`（方向 (−0.4, −1, 0.3)） |
| **陰影** | 桌機 1024 PCF、手機 512（檔位關陰影時改 blob）。**投影者只有**：4 台車 `body`、輪胎、道具箱、香蕉、龜殼、跳台。**接收者**：路面、桌墊、跳台。賽道 160×150 太大，正交投影罩不住 → **陰影框跟著自己的車走**：`shadowRadius 22`，每幀把陰影中心設在自己車的位置，以 4 單位量化（避免陰影抖動 shimmering）。`ToyLook` 目前把中心固定在原點；照全域約束以**新增可選方法**做（建議 `look.setShadowCenter(x, z)`，移動 `sun.position` 與 ortho 中心，不帶參數＝原行為），bomber／kitchen／tank 不呼叫就不受影響 |
| **blob 影** | 1 組 thin instance plane（`fx_circle` 貼圖、`#2B2440` 30%），車（1.9×2.4）、道具箱、香蕉、龜殼都有；陰影開著時也保留道具箱的 blob（浮空物件需要落地感），車的 blob 只在陰影關掉時打開 |
| **Glow 白名單**（`includeOnly`，intensity 0.7、kernel 32） | ① 加速帶 thin instance ② 道具箱 thin instance（`glowMesh(mesh, '#FFFFFF', 0.35)`，淡淡的） ③ 甩尾火花粒子所在的「火花芯」plane（§8 #1） ④ 龜殼 thin instance。**其餘一律不進**（護盾、噴焰、bot 天線球靠 emissive 自己亮） |
| 後製 | `DefaultRenderingPipeline`：FXAA、ACES，桌機 bloom（threshold 0.85、weight 0.3、kernel 48），手機關 |
| 霧 | `scene.fogMode = FOGMODE_LINEAR`，`fogStart 110`、`fogEnd 230`、`fogColor = sky`；UI 相機不吃霧 |
| 解析度 | 桌機 `hardwareScalingLevel = 1 / min(dpr, 2)`、手機固定 1.5（`fx/quality` 的 `tierSettings`） |

## 6. 互動狀態（車）

| 狀態 | 視覺 | 時長／規則 |
|---|---|---|
| 正常 | 輪胎轉動；速度 > 6 時後輪噴少量 `dust`（只在路面外，§8 #5） | — |
| 甩尾蓄力 0 段（未滿 0.6s） | 後輪外側小白火花（`#FFFFFF`，emitRate 20） | 按住甩尾＋轉向＋速度 > 6 |
| 甩尾 1／2／3 段 | 火花色換 `drift1`／`drift2`／`drift3`、emitRate 40／55／70、size ×1／×1.15／×1.3；3 段時兩後輪之間多一顆 0.5 的火花芯 plane（進 Glow） | `DRIFT_TIERS` 0.6／1.2／2.0 s |
| 放開加速（mini-turbo） | 排氣管噴焰（§8 #2，色同段位）、車頭微抬、fov +0.06 | `MINI_TURBO_MS` 500／900／1300 |
| 加速帶／加速菇 | 噴焰改 `flame` 三層、速度線（§8 #4） | `BOOST_DURATION_MS` 或 `MINI_TURBO_MS[1]` |
| 尾流蓄積中 | 車身周圍 2 條 `slip` 風線（細長 plane 0.06×2.4，alpha 0.35），沿車身往後流 | 進入 `SLIP_DIST`／`SLIP_CONE_DEG` 範圍 |
| 尾流加速 | 風線增為 6 條、alpha 0.7，加速度線 | `SLIP_BOOST_MS` 1000 |
| 打滑（spin） | `visual.rotation.y` 在 `ms` 內轉 2 圈（easeOut），頭上 3 顆 `fx_star` 繞圈（y 2.0、半徑 0.5、2 圈/秒）；被龜殼打中另加 0.8 高的彈起（`sin(π·t)`，前 400ms） | `SPIN_MS` 800（龜殼 1200） |
| 護盾 | 泡泡（§4.2） | `SHIELD_MS` 8000 或擋下一次 |
| 護盾擋下（`blocked: true`） | 泡泡 scale 1→1.25、alpha→0；`fx_circle` 12 顆 `shieldFill` 往外射；擋下的道具在接觸點炸小煙 | 220ms |
| 重生 | 從 y 3 落下到 0（easeIn，280ms）＋落地白環；之後 `visibility` 方波 10Hz 1↔0.3（純函式 `ghostBlinkOn(now, until)`，比照 tank `invulnBlinkOn`） | `RESPAWN_GHOST_MS` 1500 |
| 騰空 | 輪胎停止揚塵／胎痕；`visual.rotation.x` 隨 vy 俯仰 ±12° | 跳台 |
| 落地 | 擠壓彈跳 `squashPose(t, 0.2)`（可直接只讀 import `tankFx/juice` 的同名純函式，或 raceFx 薄包一層附單測）＋揚塵環 | 220ms |
| 衝線後 | 自己車：繼續由 AI 接手開（`decideRaceBot`，throttle ×0.6 慢慢巡航），頭上「你」標記換成金色小旗 | 直到結算 |
| 自己 | 「你」標記 | 常駐 |
| bot | 安全帽天線球；HUD 名次表掛 AI 標 | 常駐 |

## 7. 追尾相機

沿用 `ArcRotateCamera`（不換 FollowCamera，現有 alpha 追角邏輯可留），每幀：

| 參數 | 值 | 說明 |
|---|---|---|
| `radius` | **9.5**（煞停 → 全速 線性到 **10.5**） | 速度越快拉越遠一點 |
| `beta` | **1.36**（≈ 從水平往下俯 12°） | 現值 1.05 太俯，看不到前方彎道 |
| `target` | 車位置 + (0, **1.6** + 0.5·車 y, 0) + 移動方向 × **2.5** | 往前偏 2.5，車在畫面下 1/4 |
| `alpha` | 目標 `−ry − π/2`，`lerpAngle(…, dt·6)`；**甩尾時用移動方向的 ry**（`state.ry`），不是車身視覺偏航 | 甩尾時畫面不跟著甩 |
| `fov` | `0.80 + 0.10·clamp01((speed − 8)/9) + (加速中 ? 0.08 : 0)`，以 `dt·4` 平滑 | AC9「速度越快 fov 微增」 |
| `minZ` / `maxZ` | 0.3 / 260 | |
| 鏡頭微震 | 自己被命中（`spin` 的 target 是自己且非 blocked）：`target` 在 220ms 內加 ±0.18 隨機抖動、線性衰減；`prefers-reduced-motion: reduce` 或 mobile 檔不做 | §8 #16 |
| 開局 | 倒數期間 alpha 從車正前方（−ry + π/2）繞到車後（0.9s 繞完、easeOut），GO 時正好在車後 | 開場運鏡 |
| 衝線後 | radius 拉到 14、beta 1.15，alpha 每秒繞 0.25 rad 慢慢環繞自己的車 | 名次表在 React 上層 |

用 fov 0.86 實際投影（gameplay 稿就是這樣算出來的）：1920×1080 下車身中心（y 0.6）落在 **y ≈ 783**、車寬約 **260px**、車頂 y ≈ 624、地平線 **y ≈ 290**；相機離地約 3.6。霧從畫面 y ≈ 328（距 110）開始、y ≈ 307（距 230）全白。

## 8. 特效表（每一列：觸發／持續／粒子或 mesh／上限）

粒子一律 `fx/emitter` 的 `FxEmitter`，貼圖引用原路徑 `public/battle/bomber/fx_{spark,smoke,circle,star}.webp`，共 4 組 ParticleSystem。**每組上限：桌機 150、手機 60**。亂數一律 `fxRandom`，不碰 `Math.random`。他車的特效依 `own` 快照的 `drift`／`boost`／`spin`／`shield`／`ghost` 播（20Hz 已夠）。

| # | 特效 | 觸發 | 持續 | 粒子／mesh | 上限 |
|---|---|---|---|---|---|
| 1 | **甩尾火花三段色** | 甩尾蓄力中（自己：本機狀態；他車：`own.drift` 0–3） | 持續 | `fx_spark` 從兩後輪外下緣往後外側噴（cone 35°），life 0.18–0.3s，size 0.18→0；色 白（0 段）→`drift1`→`drift2`→`drift3`；3 段時加火花芯 plane 0.5（`fx_star`，進 Glow，`rotation.z += dt·8`） | spark 組 150/60；芯池 4 |
| 2 | **放開加速噴焰** | 放開甩尾得到 mini-turbo；加速帶；加速菇；他車 `own.boost` | 加速期間 | 每根排氣管 1 片 billboard plane 0.5×0.9（`fx_star` 拉長）＋ `fx_circle` emitRate 50，life 0.12s，色 = 段位色（mini-turbo）或 `flame` 三層（加速帶／菇）；起始 120ms scale 1.4 爆一下 | 噴焰 plane 池 8；circle 組 |
| 3 | **尾流風線** | 尾流蓄積／生效（自己才畫，他車不畫） | 期間 | thin instance 細長 plane 0.06×2.4（`slip`，alpha 0.35／0.7），2 或 6 條，繞車身半徑 1.2 隨機角度往後流（每條 life 0.3s 循環） | 池 6 |
| 4 | **速度線** | 自己 `speed > 0.9·MAX_SPEED` 或加速中 | 期間 | **UI 相機**上一片全螢幕 plane，DynamicTexture 512×512（放射狀細白線 36 條、中心 55% 鏤空、alpha 0.0→0.45 由外往內漸隱），每 60ms 隨機旋轉 0–10° 製造閃動；alpha = 0.6·clamp01((speed/MAX − 0.9)/0.1) 或加速中 0.6；`prefers-reduced-motion` 時 alpha 上限 0.25 | 1 片 |
| 5 | **路面外揚塵** | 車在路面外且 speed > 3 | 期間 | `fx_smoke` 每 0.4 單位距離 2 顆，`dust` 60%，size 0.4→0.9，life 0.5s，往後上飄 | smoke 組 |
| 6 | **輪胎痕** | 甩尾中或急煞（speed > 8 且 brake） | 痕 2.5s 淡出 | thin instance 小平面 0.22×0.5（`skid`），兩後輪各 1 筆，每 0.35 單位一筆，環狀佇列，y 0.025 | 池 160（手機 80） |
| 7 | **碰撞火花** | 車對車推擠且相對速度 > 4（各端本機播自己參與的那一對；bot 對 bot 由 host 播） | 160ms | `fx_spark` 10 顆於兩車中點，白→`#FFE38A`；`fx_star` 1 顆 0.6；同一對 300ms 內不重播 | spark 組 |
| 8 | **撿道具箱碎裂** | `itemGrant`（所有人播，在箱位置） | 450ms | 箱 thin instance 立刻縮 0；8 片碎塊 thin instance（小 roundedBox 0.35，用箱的 4 種面色）重力拋射；`fx_star` 6 顆往上；白環（`ringPose`，d 1.8）。重生時（`boxState` 由 taken 移除）scale 0→1.1→1（`backOut`，300ms） | 碎塊池 24；環池 4 |
| 9 | **香蕉打滑轉圈** | `spin`（來源是香蕉；香蕉 `itemGone { reason: 'hit' }`） | `SPIN_MS` | §6 打滑＋香蕉 mesh 在原地彈起 0.6 高、轉 2 圈後縮小消失（300ms）；`fx_star` 頭上繞圈 | 星 3×4 |
| 10 | **龜殼拖尾＋命中爆炸** | 龜殼存活期間；`spin`（來源龜殼） | 拖尾同生同滅；爆炸 400ms | 拖尾 `fx_circle` emitRate 45，life 0.25s，`#FF8A80`→白，size 0.35→0；命中：`fx_star` size 2.0 ＋ `fx_spark` 18 顆（白→`#FFC53A`）＋ `fx_smoke` 6 顆奶白、受擊車彈起（§6） | circle／spark／smoke 共用 |
| 11 | **護盾泡泡與擋下碎裂** | 使用 `shield`；`spin.blocked`；到期 | 常駐；碎裂 220ms；到期淡出 300ms | §4.2 泡泡；§6 擋下 | 泡泡 4 |
| 12 | **跳台落地彈跳** | 騰空後 y 回到 0 | 220ms | §6 擠壓；`fx_smoke` 8 顆 `dust` 環狀往外＋白環 d 2.6 | smoke 組；環池共用 |
| 13 | **重生閃爍** | 重生（自己：本機；他車：`own.ghost` 由 false→true） | 落下 280ms ＋ 閃爍 1500ms | §6；落點白環 d 3.0、`fx_star` 4 顆 | — |
| 14 | **換圈 3D 浮字** | 自己 `lap` 增加且未完賽（lap ≥ 2） | 彈出 220ms、停 700ms、上飄淡出 300ms | billboard plane 3.2×1.4 於車頂 y 3.2：`LAP 2`、`LAP 3`（最後一圈另由 React 大字提示，3D 浮字照出）；`backOut` 0→1.15→1 | 字卡池 2 |
| 15 | **衝線彩帶** | 任何車 `fin` 由 null 變成數值（自己的那次更多） | 1.6s | ① 拱門橫樑兩端各一個 `fx_circle`／`fx_star` 噴射（染 `confetti` 5 色，重力 −9，自轉），自己衝線 60 顆、他人 20 顆；② 看台觀眾全體跳 2 下 | circle 組（衝線那一刻允許吃滿上限） |
| 16 | **鏡頭微震** | 自己被命中（非 blocked） | 220ms | §7；`prefers-reduced-motion` 或 mobile 檔不做 | — |
| 17 | **加速帶觸發閃光** | 自己壓到加速帶 | 200ms | 該加速帶 emissive 1→1.8→1、`fx_spark` 8 顆 `boostArrow` 往前噴 | spark 組 |
| 18 | **加速菇彈出** | 使用 `mushroom` | 340ms | §4.2 加速菇 mesh；之後接 #2 | 每台 1 |

### 8.1 浮字共用貼圖
DynamicTexture 512×256 切 8 格（每格 128×64）：`LAP 2`、`LAP 3`、`GO!`（保留，倒數用共用 countdown 不用它）、`+1`（保留）、`完賽`、`1st`、`2nd`、`3rd`。字型：英數 Fredoka 700、中文站內字型 900；白字＋`OUTLINE` 6px 描邊。開局 `whenFontReady` 畫一次，plane 只改 `uOffset`／`vOffset`。

## 9. HUD（React，`src/pages/Battle/RaceHud.tsx`，根節點 `[data-race-hud]`）

資料形狀照 brief 共用契約 `RaceHud`。token 跟 bomber／tank 同套：奶油紙 `#fff6e3`、墨 `#2b2440`、底盤 `#f3e6cc`、灰標 `#8a7a66`、邊線 2.5px、硬陰影 `0_5px_0_rgba(0,0,0,.4)`。數字 `font-['Fredoka',_var(--font-sans)] font-bold tabular-nums`、中文站內字型 900。所有 class `.race-` 前綴寫在 `src/index.css`、一律 `@apply`。格式化純函式寫在 `src/pages/Battle/raceHud.ts`（附 `raceHud.test.ts`）：`ordinal(rank)` → `1st/2nd/3rd/4th`、`formatLapMs(ms)` → `m:ss.cc`（`null` → `-:--.--`）、`rankTone(rank)` → `gold|silver|bronze|plain`、`mapTransform(pts, w, h, pad)`（賽道 bbox 等比塞進小地圖，回傳 `(x,z) => [px, py]`，**z 往上**＝SVG y 反向）。

### 9.1 三檔版面

| 檔位 | 條件 | `--race-scale` | 版面 |
|---|---|---|---|
| **桌機 1920×1080** | 預設 | `hudScale(w, h)`（從 `bomberHud` 只讀 import）→ 2 | 與 960 設計稿完全相同，等比 ×2（`variant-A-gameplay.webp` 就是這一檔） |
| **960×540** | 預設 | 1 | 左上：道具欄 (18, 18)，右邊接圈數＋時間欄；右上：空（讓出全螢幕鈕）；左下：小地圖 (18, bottom 18)；右下：名次大字 (right 24, bottom 12)；中上：逆向警告 top 112；中央：最後一圈大字 y 150；衝線後名次表置中 |
| **手機 844×390** | `@media (max-height: 500px)` | 1 | 道具欄縮 56、圈數與時間併成一條膠囊接在右邊；小地圖移到道具欄下方 (12, 76) 縮 112×96；名次移到右上（全螢幕鈕左邊：`right = max(12px, safe-right) + 2.25rem + 8px`、top `max(8px, safe-top)`，大字 56px）；底部讓給搖桿與四顆觸控鈕；逆向警告 top 64、scale 0.8；最後一圈大字 34px；名次表行高 32 |

### 9.2 元件規格（960 設計尺寸）

| 元件 | class | 規格 |
|---|---|---|
| 根 | `.race-hud` | `pointer-events-none absolute inset-0 z-10 select-none overflow-hidden text-(--race-ink) [--race-ink:#2b2440] [--race-paper:#fff6e3] [--race-plate:#f3e6cc]` |
| 左上群 | `.race-tl` | `absolute left-[calc(18px_*_var(--race-scale)_+_env(safe-area-inset-left))] top-[calc(18px_*_var(--race-scale)_+_env(safe-area-inset-top))] flex items-start gap-2.5 origin-top-left [scale:var(--race-scale)]` |
| 道具欄 | `.race-item` | `relative size-[76px] rounded-2xl border-[2.5px] border-(--race-ink) bg-(--race-paper) p-[6px] shadow-[0_5px_0_rgba(0,0,0,.4)]`；內井 `.race-item-well`：`size-full rounded-xl bg-(--race-plate) shadow-[inset_0_3px_0_rgba(0,0,0,.12)] flex items-center justify-center overflow-hidden`；圖示 46px；空的時候井內放 lucide `Box` 26px `text-[#cdbfa6]`（虛線框感） |
| 道具轉盤 | `.race-item-rolling` | `rolling` 為 true：井內一條垂直膠卷依序排 4 種圖示，`animate-[race-roll_0.28s_linear_infinite]`（translateY 0 → −4×56px）；`rolling` 轉 false 且 `item` 有值時：圖示落定 `animate-[race-item-pop_0.24s_ease-out]`（scale 1.25→1）＋外框閃白一次（`ring-4 ring-white` 120ms）。轉盤時長由遊戲端決定（建議 900ms） |
| 圈數 | `.race-lap` | `h-[40px] rounded-full border-[2.5px] border-(--race-ink) bg-(--race-paper) px-3.5 flex items-baseline gap-1 shadow-[0_5px_0_rgba(0,0,0,.4)]`；`LAP`（13px 900 `text-[#8a7a66]` tracking-wide）、目前圈（Fredoka 28px）、`/3`（Fredoka 17px `text-[#8a7a66]`）。`lap` 為 0（起跑線前）顯示 `1` |
| 最後一圈色 | `.race-lap-final` | `finalLap` 時圈數膠囊 `bg-[#ffc21a]`，目前圈數字白＋ink text-shadow |
| 時間卡 | `.race-time` | 接在圈數下方 6px：`w-[132px] rounded-xl border-[2.5px] border-(--race-ink) bg-(--race-paper) px-2.5 py-1 shadow-[0_4px_0_rgba(0,0,0,.4)]`；第一行 lucide `Timer` 14px `text-[#ff7a1a]`＋`formatLapMs(lapMs)`（Fredoka 20px）；第二行 `BEST`（10px 900 `#8a7a66`）＋`formatLapMs(bestLapMs)`（Fredoka 13px）；有新最佳圈時第二行閃 `text-[#2fcf5e]` 1.2s |
| 小地圖 | `.race-map` | `absolute left-[calc(18px_*_var(--race-scale)_+_env(safe-area-inset-left))] bottom-[calc(18px_*_var(--race-scale)_+_env(safe-area-inset-bottom))] w-[168px] h-[148px] origin-bottom-left [scale:var(--race-scale)] rounded-2xl border-[2.5px] border-(--race-ink) bg-(--race-paper)/90 p-2 shadow-[0_5px_0_rgba(0,0,0,.4)]`；內含 `<svg>`：賽道 `polyline` 兩層（底 `stroke=#2b2440 width=9`、上 `stroke=#5a5380 width=5.5`，`stroke-linejoin=round`）；起跑線短橫 4px 白；車點 `circle r=4.5`（玩家 base 填、`#2b2440` 1.5 描邊），自己 `r=6.5` 外加白 2px 外環、畫在最上層；`map.pts` 參照不變就 `useMemo` 不重算 path |
| 名次 | `.race-rank` | `absolute right-[calc(24px_*_var(--race-scale)_+_env(safe-area-inset-right))] bottom-[calc(12px_*_var(--race-scale)_+_env(safe-area-inset-bottom))] origin-bottom-right [scale:var(--race-scale)] flex items-end`；數字 `.race-rank-num` Fredoka **96px** leading-none，`paint-order:stroke fill`、`[-webkit-text-stroke:8px_var(--race-ink)]`，填色依 `rankTone`：gold `#FFC21A`（上緣 `#FFF0A0` 漸層用 `bg-clip-text` 做不到描邊 → 直接單色＋`text-shadow:0_5px_0_rgba(0,0,0,.4)`）、silver `#E3E6EF`、bronze `#FF9A5A`、plain `#C9BEDB`；字尾 `.race-rank-suffix` Fredoka 40px 同色同描邊（`st`/`nd`/`rd`/`th`）；`/4` `.race-rank-total` Fredoka 22px 白＋ink 描邊 4px，ml-1 mb-3。名次變動時 `animate-[race-rank-bump_0.3s_ease-out]`（scale 1.3→1） |
| 逆向警告 | `.race-wrongway` | `wrongWay` 為 true：`absolute left-1/2 top-[calc(112px_*_var(--race-scale))] -translate-x-1/2 origin-top [scale:var(--race-scale)] h-[56px] rounded-full border-[3px] border-(--race-ink) bg-[#ff3b4e] px-6 flex items-center gap-2.5 text-white text-[26px] font-black shadow-[0_5px_0_rgba(0,0,0,.4)] animate-[race-pulse_0.6s_ease-in-out_infinite]`；內容 lucide `RotateCcw` 28px stroke 3 ＋「逆向行駛！」 |
| 最後一圈 | `.race-finallap` | `finalLap` 由 false→true 的瞬間掛上 2.2s 後移除：`absolute left-1/2 top-[calc(150px_*_var(--race-scale))] -translate-x-1/2 [scale:var(--race-scale)]`；`最後一圈！` 52px 900 白字＋`[-webkit-text-stroke:8px_var(--race-ink)] paint-order:stroke`，後方一條 `#ffc21a` 斜飄帶（`h-[46px] w-[420px] -skew-x-12 rounded-lg border-[2.5px]`）；動畫 `race-banner`：0–300ms scale 0.6→1.1→1 + opacity 0→1，停到 1.9s，最後 300ms 往上 20px 淡出 |
| 衝線名次表 | `.race-results` | `finished` 為 true 時顯示：置中 `w-[440px] rounded-3xl border-[3px] border-(--race-ink) bg-(--race-paper) shadow-[0_6px_0_rgba(0,0,0,.4)] overflow-hidden [scale:var(--race-scale)]`；頂部 `.race-results-head` 高 52：黑白格條 8px（`bg-[repeating-linear-gradient(90deg,#2b2440_0_12px,#fff_12px_24px)]`）＋標題「完賽！」28px 900 ＋ lucide `Flag` 24px；列 `.race-results-row` h-[44px] grid `[40px_14px_1fr_92px_78px]` gap-2 px-4、偶數列 `bg-(--race-plate)`：名次圓章 32px（`rankTone` 底色、Fredoka 17 白＋ink 描邊）、色點 12px、名字（自己寫「你」、bot 前掛 `.race-ai-tag` 同 `.tank-ai-tag`）、總時間 `formatLapMs(totalMs)` Fredoka 17、最佳圈 Fredoka 13 `#8a7a66`；`totalMs === null` 的列整列 `opacity-60`，時間欄改「衝線中…」13px 900 |
| 開局倒數 | 3D | `createCountdownPanel(..., { theme: COUNTDOWN_THEME })`（`fx/countdown`），掛 `look.uiCamera`＋`UI_LAYER`（AC12） |
| 結算 | `setOverlay` | 沿用；名次字串照 AC6 |

`@keyframes race-roll`、`race-item-pop`、`race-pulse`（同 tank-pulse）、`race-rank-bump`、`race-banner` 都寫在 `.race-*` 區塊。`prefers-reduced-motion: reduce` 時 `.race-wrongway`、`.race-rank-num`、`.race-item-rolling` 的動畫一律 `animate-none`（轉盤改成直接顯示結果）。

### 9.3 手機觸控鈕（AC8，`BabylonCanvas.tsx` 的 `TOUCH_ACTIONS.race`）

```ts
race: [
  { label: '🎁', key: 'e' },   // 道具
  { label: '▼', key: 's' },    // 煞車／倒車
  { label: '💨', key: ' ' },   // 甩尾
  { label: '▲', key: 'w' },    // 油門
],
```
- 搖桿只派發左右（`TouchControls` 新增可選 prop `axes?: 'xy' | 'x'`，race 傳 `'x'`；其他遊戲預設 `'xy'` 不變）。
- **排成 2×2**：右下角，上排 `🎁 ▼`、下排 `💨 ▲`——右手拇指主要按住最右下的油門，往左滑一格就是甩尾，兩顆並排可以用拇指側腹同時壓住。需要 `TouchControls` 再加一個可選 prop（如 `grid?: boolean` → 容器 `grid grid-cols-2 gap-3`），預設 false 維持原本的橫排；這是 brief AC8「新增可選 prop」的同一類改動，若 babylon-hud 認為超出範圍，退回一排四顆（順序 🎁 ▼ 💨 ▲）也可以接受。
- `▲`／`▼` 是 U+25B2／U+25BC，系統字型都有；qa 截圖時順便確認 emoji 沒變豆腐。稿子用 lucide `gift`／`chevron-down`／`wind`／`chevron-up` 示意。

### 9.4 HUD 跟畫面的關係
追尾視角下車身在畫面中下（y ≈ 760–800 / 1080），名次大字在右下、小地圖在左下，兩者都不壓到自己的車（車寬約 300px 置中）。道具欄＋時間在左上壓到的是天空，最不擋路況。

### 9.5 名次色與道具色對照（`raceHud.ts` 匯出 `RANK_TONES`）

| tone | 填色 | 用在 |
|---|---|---|
| gold | `#FFC21A` | 1st 名次大字、名次表 1 號章 |
| silver | `#E3E6EF` | 2nd |
| bronze | `#FF9A5A` | 3rd |
| plain | `#C9BEDB` | 4th 以後 |

### 9.6 道具圖示 SVG（`RaceItemIcon({ kind, className })`，viewBox 0 0 48 48，所有形狀 `stroke="#2B2440" strokeWidth="2.5" strokeLinejoin="round"`）

- **BananaIcon**：皮左片 `M24 14 C16 18 10 28 9 38 C14 36 19 30 22 24 Z`、右片 `M24 14 C32 18 38 28 39 38 C34 36 29 30 26 24 Z`、中片 `M21 16 C20 26 21 34 24 40 C27 34 28 26 27 16 Z` 填 `#FFD23F`；三片尖端各一個 circle r2 填 `#C79A00`；蒂 rect (22,8) 4×7 rx1.5 填 `#7A4A1D`。
- **ShellIcon**：殼 `M8 30 A16 15 0 0 1 40 30 Z` 填 radial(`#FF8A80` 35%/25% → `#E8413A` → `#A82A24`)；殼緣 rect (6,29) 36×7 rx3.5 填 `#FFF6E3`；殼紋 3 個 circle r3 (17,22) (24,17) (31,22) 填 `#FF8A80`、`strokeWidth 1.5`。
- **MushroomIcon**：傘 `M6 26 C6 14 14 8 24 8 C34 8 42 14 42 26 Z` 填 `#FF7A3D`；白點 circle (16,17) r4、(30,14) r3.5、(37,22) r2.5 填 `#FFF6E3`（stroke 1.5）；柄 rect (15,25) 18×15 rx6 填 `#FFF1E0`；眼 ellipse (21,31) (27,31) rx1.6 ry2.4 填 `#2B2440`（無 stroke）。
- **Shield**：底 circle (24,24) r19 填 `#1FB5E0`，裡面 lucide `Shield` 26px 白 stroke 2.5、填 `#7FE8FF`。

## 10. 效能與檔位（AC13／AC14；這裡只補美術端數字）

| 項目 | 桌機 | 手機 |
|---|---|---|
| 描邊／Glow／bloom | 開 | 關 |
| 陰影 | 1024 PCF、radius 22 跟車 | 512；檔位關掉陰影時車改 blob |
| 粒子每組上限 | 150 | 60 |
| 胎痕池 | 160 | 80 |
| 速度線 | 開 | 開（alpha 上限 0.35） |
| 鏡頭微震 | 開（`prefers-reduced-motion` 時關） | 關 |
| 觀眾彈跳 | 開 | 關（靜止） |
| 貼圖 | 全程式產生：桌墊 1024²、木桌 256²、路面 128×256、起跑格 128×32、道具箱圖集 1024×256、跳台斜紋 128²、加速箭頭 64×128、拱門橫幅 1024×96、速度線 512²、浮字圖集 512×256、「你」128×64；粒子重用 `fx_*.webp`。**不新增圖檔** | 同左（桌墊可降 512²） |
| 自動降級 | 描邊 → Glow → 陰影（`fx/quality` 的 `DEGRADE_ORDER`） | — |

**draw call 預估**（AC14 `N1 ≤ 100`）：桌墊＋木桌 2、路面 1、起跑線 1、路緣 1、拱門 1、看台 1、觀眾 1、旗面 1、旗桿 1、積木 2、樹 2、錐 1、跳台 1、加速帶 1、道具箱 1＋blob 1、車 body 4（描邊另 +4）、輪胎 1、你標記 1、香蕉 1、龜殼 1、護盾泡泡最多 4、加速菇 ≤4（bench 時 0）、粒子 4、胎痕 1、碎塊 1、環 1、浮字 1、速度線 1、倒數 1；陰影 pass 約 +12（車 4、輪胎 1、箱 1、香蕉 1、龜殼 1、跳台 1…）、Glow pass 約 +5（加速帶、道具箱、火花芯、龜殼）；合計約 **75–85**。bench（4 車持道具、香蕉 4、龜殼 2）只多 0–2（都是 thin instance），落在 100 內。

## 11. 給實作者的對照（波 2／3／4）

| AC | 看哪裡 |
|---|---|
| AC2 賽道／名次 | §1.1–§1.3；`variant-A-track.webp` |
| AC3 手感 | §1.4 跳台、§1.5 加速帶；§6 |
| AC4 道具 | §1.6、§2.1、§2.2 |
| AC5 AI | §1.2 長彎、§2.3 |
| AC8 觸控 | §9.3 |
| AC9 車輛與場景 | §4；特寫表第 1–4 區 |
| AC10 材質光影 | §5 |
| AC11 特效 | §6、§8；特寫表第 5 區 |
| AC12 HUD | §9；特寫表第 6 區；`variant-A-gameplay.webp` |
| AC13／AC14 | §10 |
| 追尾相機 | §7 |

## 12. 待確認（不擋實作，有疑義照 brief 的 QUESTION 流程問領導）

1. `ToyLook.setShadowCenter`（§5）是 `fx/look` 的新增方法；如果 babylon 偏好在 race.ts 內自己移動 `look` 的光（需要 `sun` 可讀），兩種都不影響其他三款。
2. 觸控鈕 2×2（§9.3）要多一個 `TouchControls` 可選 prop；不做就退回一排。
3. 三角錐、積木、樹都沒有碰撞（§4.3），靠「距路緣 ≥ 9」與出界重生規則避免穿模觀感；若 qa 截圖覺得穿模明顯，再討論加簡單圓形碰撞。
4. 第一次過起跑線算 lap 1 的約定（§1.3）由 babylon-rules 的 `advanceLap` 決定；HUD 端 `lap = 0` 顯示成 1。

