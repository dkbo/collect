# 坦克對戰美術：A · Toy Army 玩具坦克 spec

> tankart-designer 寫於 2026-10-03（任務 2026-10-03-tankart 波 1）。只出 A 一套；語彙承接炸彈超人 A「Toy Box」（`2026-09-25-bomberart/design/spec.md`）與廚房快手 A「Toy Kitchen」（`2026-09-26-kitchenart/design/spec.md`）。
> 和 brief 衝突時以 brief 為準。數字都是世界單位（`CELL = 2`）或 960×540 設計尺寸的 CSS px。

## 0. 產出一覽（本目錄）

| 檔案 | 內容 |
|---|---|
| `variant-A.pen` | 原稿，有三個頂層 frame：`對戰畫面 Gameplay`（960×540）、`物件特寫表 Object Sheet`（1200×1700）、`手機 Mobile 844×390` |
| `variant-A-gameplay.webp` | 對局畫面 1920×1080（@2x）：3 真人＋bot 混戰、突然死亡已開始 |
| `variant-A-sheet.webp` | 特寫表 1800×2550（@1.5x）：4 色坦克三視、6 種狀態、積木牆／外框／落牆／木箱、地面、5 種道具、子彈（一般／反彈後）、18 格特效關鍵幀、HUD 元件、色票、材質要點 |
| `variant-A-mobile.webp` | 手機 844×390（@2x）：頂部頭像膠囊、底部計時、觸控鈕 3 顆（多給的，對應 §9.3） |

**畫面內容**（gameplay 跟 mobile 是同一個瞬間）：16×16 場地，外面圍一圈外框積木。柱牆照 `tank.ts` `generateWalls()` 放在（奇, 奇）格，(1,1) 除外；木箱用 `applySeed` 同一條 LCG 產生（seed 20261003）。突然死亡已經開始：近排 cy=0 全部落牆，(15,2)、(15,4) 也已落牆，(15,4) 剛落地正在回彈，(15,6) 是紅色預告格。
- P1 紅「你」（自己）：往右開，身上有護盾泡泡和加速 buff，後方留下履帶痕和揚塵。剛射出的子彈在柱牆 (5,9) 反彈一次，拖尾變紅，打中 P3。
- P2 藍「小藍」（真人）：有三連發光環，正在開砲（砲口焰加 3 發扇形子彈），剛擊毀 P4。
- P3 綠「電腦1」（bot）：受擊中，畫面上有閃白、擠壓和命中火花。
- P4 黃「電腦2」（bot）：已陣亡，只剩殘骸，畫面上有爆炸火球、碎片、煙和焦痕。
- 場上道具：補血 (2,9)、加速 (13,12)、連射 (8,14)、護盾 (4,6)；木箱 (12,11) 正在碎裂，三連發道具從裡面彈出來。
- 稿子用的是平行斜投影（頂面寬 30px、深 25px，高度係數 0.55），所以沒有透視的梯形收窄。實際畫面是透視的，遠端會比較窄，HUD 的位置照 §9 寫的就好，不必跟稿子逐像素比對。

## 1. 現況盤點（`src/babylon/games/tank.ts`）

| 物件 | 現況 | 行號 |
|---|---|---|
| 相機 | `ArcRotateCamera(-π/2, β 0.55, r 28, target 0)`，fov 預設 0.8；一盞 `HemisphericLight` | L631–632 |
| 坦克 | 每台 7 個 mesh（車身 Box、兩條履帶 Box、砲塔 Cylinder、砲管 Cylinder、3 個 HP 方塊），每台 4 份 `StandardMaterial`；顏色由 `colorFor` 用 id hash 算出來 | L163–243 |
| 牆 | 63 個獨立的 `CreateBox`（0.95 CELL），灰色 | L662–670 |
| 木箱 | 每個一個 `CreateBox`（0.85 CELL），棕色 | L322–327 |
| 地面 | 一張 ground，綠色 | L657–660 |
| 子彈／道具 | 子彈每顆一個 Sphere（d 0.2）；道具每個一個 0.5 的 Box，hp／speed／rapid 三種色 | L405、L421–427 |
| 爆炸 | `flames` 碎片 Box，每次都新建、再 dispose | L600–622 |
| HUD | 3D 的 `createTextPanel`，倒數用 `createCountdownPanel` | L673–674 |

**相機（波 1 已裁定，L631 要改）**：用 NullEngine `Vector3.Project` 實測，現值下畫面底緣只照到 z ≈ −11，cy=0、1 兩排和 cy=2 的半排都在畫面外，P1 出生點 (1,1) 和 P4 出生點 (14,1) 看不到。垂直 fov 是固定的，所以任何長寬比都一樣。領導 09:13 裁定改成 **r 38、target (0, 0, −2)**，α、β、fov 不動。在 1920×1080 下，場地近緣落在 y ≈ 1037、遠緣 y ≈ 127，中央一格約 66px，左右兩側會空出放玩家卡的位置。

## 2. 色票

### 2.1 玩家（不另外定）
直接 import `@/babylon/fx/palette` 的 `PLAYER_PALETTE`（`light`／`base`／`dark`）和 `OUTLINE`（`#2B2440`）。`colorIndex` 照 brief AC3 推導（`ctx.players` 依序，後面接 bots 依序，用 `bomberFx/palette` 的 `colorIndexOf`）。

| 序 | 名稱 | light | base | dark | 用在哪 |
|---|---|---|---|---|---|
| P1 | 紅 | `#FF8A94` | `#FF3B4E` | `#B3122A` | 車身與砲塔徑向漸層、擋泥板（dark）、旗子（base）、艙蓋（light）、HUD 色帶 |
| P2 | 藍 | `#8CC4FF` | `#2F86FF` | `#1446B8` | 同上 |
| P3 | 綠 | `#93F0A8` | `#2FCF5E` | `#138A3A` | 同上 |
| P4 | 黃 | `#FFF0A0` | `#FFC21A` | `#C27D00` | 同上 |

### 2.2 場景與物件（新建 `src/babylon/games/tankFx/palette.ts`，型式比照 `bomberFx/palette` 的 `TOY`）

| key | hex | 用途 |
|---|---|---|
| `groundA` / `groundB` | `#A9B67F` / `#9DAB72` | 「玩具沙盤」橄欖卡其棋盤格。刻意跟 bomber 的草綠 `#79C257` 拉開，飽和度低，P3 綠才不會被吃掉 |
| `groundSeam` | `#8E9C66`（50%） | 格縫，1px |
| `camo` | `#93A169` | 迷彩斑點（貼圖點綴，每 4×4 格 1–2 塊） |
| `void` | `#22302C` | 場外延伸底色、`scene.clearColor` |
| `plinth` | `#1A2421` | 外框牆下的深色基座（稿子裡的外緣） |
| `wallTop` / `wallSide` | `#E3E6EF` / `#9BA1B8`（暗階 `#767C95`） | 積木柱牆，跟 bomber 的柱牆同色，維持系列感 |
| `stud` / `studSide` | `#EDEFF5` / `#B9BFD0` | 積木頂的凸點 |
| `borderTop` / `borderSide` | `#B3A4C9` / `#6F6490` | 外框積木，跟 bomber 外框同色 |
| `borderStud` / `borderStudSide` | `#C9BEDB` / `#8C80AA` | 外框凸點 |
| `closeTop` / `closeSide` | `#FF5A4E` / `#C23A33` | 突然死亡落牆（凸點 `#FF8A80` / `#D9483F`） |
| `warn` | `#FF3B30` | 落牆預告格（填 50%，邊 100%） |
| `crateTop` / `crateSide` / `crateBrace` | `#F7C677` / `#DC9A48` / `#8F561D` | 木箱，直接沿用 bomber 的 `crateData('soft')` 貼圖 |
| `trackTop` / `trackSide` / `cleat` | `#4A4566` / `#3A3556` / `#6E6890` | 履帶，以及履帶紋（貼圖） |
| `wheel` / `hub` | `#8E9AB0` / `#C3CBD8` | 負重輪 |
| `barrel` / `barrelDark` | `#8A93B8` / `#5B6285`（砲口 `#3A3F5C`） | 砲管 |
| `face` / `eye` | `#FFF1E0` / `#2B2440` | 砲塔臉板與眼睛，跟 bomber 角色的臉同色 |
| `headlight` | `#FFF6C8` | 車頭燈 |
| `aiBall` | `#39E6FF` | bot 天線球，跟 bomber AI 同色 |
| `bullet` / `bulletHot` | `#FFF1B8` / `#FFD23F` | 子彈的芯與暈 |
| `bounce` | `#FF5A4E` | 反彈後的子彈拖尾與暈 |
| `flash` | `#FFF6C8` → `#FFC53A` → `#FF7A1A` | 砲口焰、爆炸火球三層，跟 bomber 火焰同色 |
| `smoke` / `smokeDark` | `#C4C8D6` / `#5D627A` | 煙 |
| `shield` / `shieldFill` | `#39D5FF` / `#7FE8FF` | 護盾泡泡的邊緣與內面 |
| `triple` | `#B07CFF` | 三連發光環 |
| `dust` / `tread` | `#E4DCC0` / `#2B2440`（30%） | 揚塵、履帶痕 |
| `wreck` | `#6E6890` / `#4A4566` / `#2B2440` | 殘骸的 light／base／dark，取代玩家色 |

### 2.3 道具（`ITEM_COLORS`，`tankFx/palette.ts`）

| kind | 名稱 | 底色 | 唇（暗階） | 圖示 | 圖示色 |
|---|---|---|---|---|---|
| `hp` | 補血 | `#FF5C8A` | `#C2335E` | lucide `heart` | 白 |
| `speed` | 加速 | `#FFD23F` | `#C79A00` | lucide `zap` | `#3A2A00` |
| `rapid` | 連射 | `#FF6B3D` | `#C2441B` | lucide `flame` | 白 |
| `shield` | 護盾 | `#1FB5E0` | `#0B7FA6` | lucide `shield` | 白 |
| `triple` | 三連發 | `#B07CFF` | `#7A45D6` | 自訂「三道扇形彈軌」：三條線從底部中心往外散開，角度 −24°／0／+24°，末端各一顆子彈圓點；SVG 見 §9.6 | 白 |

## 3. 坦克建模表（`tankFx/models.ts`；頂點色，車頭朝 +z，原點在地面中心）

全部用 `fx/geometry` 的 `roundedBox` 和 `fx/models` 的 `cylinder`／`sphere`／`frustum`／`radial`／`solid`／`at`／`mergeData` 組合，**每台 4 個 mesh**：

| mesh | 組成（尺寸 w×h×d、位置） | 色 | 動畫用途 |
|---|---|---|---|
| **hull**（車身，root 子物件） | 車身 roundedBox 0.72×0.34×1.24，r 0.12，y 0.23–0.57；擋泥板 ×2 roundedBox 0.36×0.06×0.96，r 0.05，x ±0.53、y 0.36–0.42；車頭燈 ×2 cylinder d 0.12 h 0.08，(±0.24, 0.49, 0.56)；負重輪 ×3×2 cylinder d 0.24 h 0.04 沿 x 軸，貼在履帶外側 x ±0.70、y 0.18、z −0.45／0／0.45，輪轂 d 0.09 | 車身 `radial(light, base, dark)`；擋泥板 dark；燈 `headlight`；輪 `wheel`／`hub` | 開砲與受擊的擠壓回彈（§7 曲線）作用在 hull 的 scaling |
| **tracks**（履帶，hull 子物件） | roundedBox ×2 0.34×0.36×1.44，r 0.15，x ±0.53、y 0–0.36；faceUV 讓側面與頂面的 u 沿車長方向 | 材質：`trackTop` 底，加上 64×16 的 DynamicTexture 履帶紋（每 8px 一條 `cleat` 亮紋，WRAP），每台 clone 一份貼圖 | 履帶 UV 捲動：`vOffset += 移動距離 / 1.44`，倒車就反向 |
| **turret**（砲塔，樞紐 (0, 0, −0.05)，hull 子物件） | 座圈 frustum h 0.23、d 底 0.76／頂 0.72，y 0.57–0.80；圓頂 sphere d 0.66，y 縮放 0.42，底在 0.80；臉板 roundedBox 0.36×0.12×0.08，r 0.03，z 0.27、y 0.78–0.90；眼睛 ×2 sphere d 0.085，z 縮 0.5，(±0.085, 0.84, 0.32)，各帶一顆白色光點 d 0.03；艙蓋 cylinder d 0.2 h 0.04，z −0.1、y 0.94；**真人**：旗竿 cylinder d 0.05 h 0.52，在 (−0.22, 0.9–1.42, −0.22)，三角旗 0.32×0.18 往 −z 飄（雙面 plane，頂點色 base）；**bot**：天線 cylinder d 0.04 h 0.45 加天線球 sphere d 0.14 `aiBall`，球另外拆成一個小 mesh 進 Glow 名單時才拆（見 §4，預設不拆） | 座圈 base→dark；圓頂 radial；臉板 `face`；眼 `eye` | `rotation.y = turretAngle − hull.ry` |
| **barrel**（砲管，turret 子物件） | cylinder d 0.16 長 0.62 沿 +z，中心 (0, 0.68, 0.6)；砲口環 cylinder d 0.22 長 0.10，在 z 0.92 | `barrel`，砲口環 `barrelDark` | 後座：local z −0.14，曲線見 §7 |

- 整台外接框約 1.44 寬 × 1.72 長（含砲管）× 1.42 高（含旗）。碰撞（`hitBlocked` R 0.5、命中 0.7）**不改**，視覺上在格子裡留有餘裕。
- **「你」標記**：billboard plane 0.9×0.45，貼 `fx/textures.createLabelTexture(scene, 'tank-you', '你', PLAYER_PALETTE[ci].base)`（128×64），位置 y 3.0（實作回寫：原寫 2.0，砲管朝畫面上方時會被標記蓋住），跟著 root 移動但不跟砲塔轉。每局建一次，不要每幀重畫。
- **不套 `upright.ts`**：坦克是低矮物件，頂面就是主要辨識面，在相機 β 0.55 下不會出現 bomber 角色那種邊角側躺的問題。要立著看的只有「你」標記和連殺字卡，兩者都是 billboard。
- **殘骸**：陣亡後 hull 和 tracks 留在原地，砲塔噴飛後落在旁邊（§8 #10）。材質換成 `wreck` 色，做法是共用一份灰階頂點色的 clone，不要每次重建。到回合結束（`seed`）才清掉。
- 三視（俯視／正視／側視）見特寫表第 1 區；6 種狀態（你標記、受擊、無敵、護盾、護盾碎裂、三連發光環）見第 2 區。

## 4. 場景建模表

| 物件 | 做法 | 尺寸／規格 |
|---|---|---|
| **積木柱牆** ×63 | 1 組 thin instance。roundedBox 1.9×1.7×1.9，r 0.18，segments 2；頂面加 2×2 個凸點 cylinder d 0.54 h 0.16，中心在 (±0.45, 1.7, ±0.45)，跟本體 merge 成同一份 MeshData | 頂 `wallTop`，側 `wallSide`，側面上緣 18% 用 `#F1F3F8` 做亮帶；凸點 `stud`／`studSide` |
| **外框積木** ×68 | 第 2 組 thin instance，同一個模型、高 1.9（0.95 CELL）；放在 cx 或 cy 等於 −1、16 的那一圈 | 頂 `borderTop`，側 `borderSide`，凸點 `borderStud`。**只是視覺**：碰撞原本就把場外當牆，不改 |
| **突然死亡落牆** | 第 3 組 thin instance，同柱牆模型、紅色頂。落下動畫的那一筆在落地前 scale 和 y 照 §8 #15，落地後就是靜態的一筆 | `closeTop`／`closeSide`；落地後也算不可破牆（反彈要用到，brief AC2） |
| **木箱** | 1 組 thin instance，從 `bomberFx/models` 只讀 import `crateData(CELL, 'soft')`（0.9 CELL 立方），**實例縮放 0.8**，得到 1.44 的立方，比積木牆矮，柱牆才是主要地標；貼圖沿用 bomber 的木箱圖集 | 頂 `crateTop`，側 `crateSide`，X 撐條 `crateBrace`。被打掉時用 `ThinSlots` 的 swap-remove，不 dispose |
| **地面** | 1 個 ground mesh 32×32，加 DynamicTexture 512×512（每格 32px，BILINEAR）：A／B 棋盤、1px 格縫、迷彩斑點；牆和箱子的接地陰影直接烘進貼圖（每格 3px、`#2B2440` 18%） | 不另鋪逐格的 Box |
| **場外延伸** | 第 2 個 ground 120×120，y −0.02，`void` 色，`disableLighting` 加 emissive，避免被 ACES 拉成灰色；外框底下再加一圈 37.4×37.4 的 `plinth` 平面 | `scene.clearColor = void` |
| **落牆預告格** | 1 組 thin instance 的平面 1.8×1.8（圓角用貼圖做），y 0.02，一次最多 1 筆 | `warn` 50%，邊框 100%，中間放 `triangle-alert` 圖示，用貼圖畫，白色 |
| **道具** ×5 | 每種 kind 各一個合併 mesh（代幣：roundedBox 0.9×0.86×0.22，r 0.24，加暗階下唇 0.9×0.86×0.18 往下偏 0.1，再加白色高光條 0.26×0.08）。正面是圖示，用 DynamicTexture 畫在一張 5 格的圖集上（256×64），**不新增圖檔**。y 1.1 浮動 ±0.12、`rotation.y += dt·2`，代幣永遠面向相機的 −z 方向擺動 ±0.5 rad | 色見 §2.3；下面加 blob 陰影 |
| **子彈** | 1 組 thin instance，sphere d 0.3（segments 10），y 0.35 | `bullet`，emissive `bulletHot` 0.8、`disableLighting`；反彈後那一筆用 thin instance color 換成 `bounce` |

**場地 draw call 預估**：地面 2、柱牆／外框／落牆 3、木箱 1、預告 1、子彈 1、道具最多 5、坦克 4×4=16（描邊另加 16）、你標記 1、特效粒子 4 組（spark／smoke／circle／star）、履帶痕 1、殘骸、焦痕、光柱、浮字各 1，合計約 55，加上 Glow、陰影 pass，可以落在 AC10 `N1 ≤ 90` 以內。

## 5. 材質、描邊、陰影、Glow

| 項目 | 規格 |
|---|---|
| 材質 | 全部用 `StandardMaterial` 加 `fx/look`（`new ToyLook(scene, camera, { tag: 'tank', shadowRadius: 26, outline: OUTLINE })`）套兩階 ramp（`TOON_RAMP` 亮 1.0／暗 0.62）；頂點色物件 `useVertexColors`。exposure／contrast 用預設的 1.05／1.08 |
| **描邊名單**（`renderOutline` 0.02、`OUTLINE`） | 坦克 4 個 mesh（hull、tracks、turret、barrel）、5 個道具 mesh、木箱 thin instance。**不描**：地面、積木牆、外框、落牆（輪廓靠側面暗階和亮帶）、子彈、特效、殘骸 |
| 雙光 | `ToyLook` 內建：Hemispheric 0.55（groundColor `#3A3F5C`）加 Directional 0.9 `#FFF4E0`，方向 (−0.4, −1, 0.3) |
| **陰影** | 桌機 1024 PCF，手機 512（或檔位關掉時改用 blob）。**投影者**：4 台坦克的 hull、tracks、turret、barrel 和 5 個道具 mesh。**接收者**：地面。`shadowRadius` = hypot(18, 18) × CELL / 2 ≈ 25.5，取 26 |
| **Glow 白名單**（`includeOnly`，intensity 0.7，kernel 32） | ① 子彈 thin instance ② 砲口焰 plane ③ 5 個道具 mesh ④ 落牆預告格。除此之外一律不進（護盾、天線球、光環靠 emissive 自己發亮，不帶光暈） |
| 後製 | `DefaultRenderingPipeline`：FXAA、ACES，桌機開 bloom（threshold 0.85、weight 0.3、kernel 48），手機關 |
| 解析度 | 桌機 `hardwareScalingLevel = 1 / min(dpr, 2)`，手機固定 1.5（`fx/quality` 的 `tierSettings`） |

## 6. 互動狀態（坦克）

| 狀態 | 視覺 | 時長／規則 |
|---|---|---|
| 正常 | 履帶 UV 隨移動距離捲動；移動時揚塵 | — |
| 開砲 | 砲口焰（§8 #1）、砲管後座、hull 擠壓回彈（§7，振幅 0.12） | 180ms |
| 受擊（未破盾） | 整台閃白，用 `mesh.renderOverlay`（overlayColor 白、overlayAlpha 0.75），80ms 後在 120ms 內淡到 0；hull 擠壓彈跳（振幅 0.22）；命中火花；被打的若是自己，鏡頭微震 | 260ms |
| 無敵（`INVULN_MS` 1000） | 4 個 mesh 的 `visibility` 用方波在 1 和 0.35 之間切換，10Hz，相位以剩餘時間計算，各端一致（純函式 `invulnBlinkOn(now, until)`，比照 `invincibleBlinkOn`） | 1000ms |
| 護盾 | 泡泡 sphere d 2.1（segments 24），中心 y 0.6；`shieldFill` alpha 0.22，邊緣 fresnel 用 emissive `shield`（StandardMaterial 的 `emissiveFresnelParameters`）；以 0.6 rad/s 自轉；最後 2 秒以 6Hz 閃 | 到 `SHIELD_MS` 12s 或被打破 |
| 護盾被打破（`hit.shieldBroken`） | 泡泡 scale 從 1 到 1.25、alpha 降到 0；12 片 `fx_circle` 粒子染 `shieldFill` 往外射；同時照常閃白、擠壓、擊退 | 220ms |
| 加速 buff | 揚塵量 ×2，粒子色改 `#FFE9A0` | buff 期間 |
| 連射 buff | 砲口環 emissive `#FF6B3D` 0.6（不進 Glow） | buff 期間 |
| 三連發 buff | 地上光環：plane d 2.1，貼 `fx/textures.createRingTexture`，染 `triple`、alpha 0.55，以 1.2 rad/s 轉；外加 3 顆 sphere d 0.12 繞 y 0.3 公轉（`triple`，emissive）；最後 2 秒以 6Hz 閃 | `TRIPLE_MS` 8s |
| 陣亡 | §8 #10 爆炸；HUD 卡片變灰 | — |
| 自己 | 頭上「你」標記 | 常駐 |
| bot | 青色天線球取代旗子；HUD 掛 AI 標 | 常駐 |

## 7. Juice 曲線（`tankFx/juice.ts`，純函式附單測）

開砲和受擊共用同一條擠壓曲線 `squashPose(t, amp)`，t ∈ [0, 1]，回傳 `{ sy, sxz }`：

```
sy  = 1 − amp · sin(π · min(t / 0.35, 1)) · (t < 0.35 ? 1 : 0)       // 先往下壓
    + amp · 0.8 · sin(π · clamp01((t − 0.35) / 0.65)) · (1 − t)       // 再彈高、收回（實作回寫：原寫 0.45，對不上 t≈0.6 時 sy≈1+0.3·amp 的關鍵幀）
sxz = 1 + (1 − sy) · 0.5                                               // 體積守恆的近似
```

- 關鍵幀：t=0 時 sy=1；t≈0.17 時 sy=1−amp；t≈0.6 時 sy≈1+0.3·amp；t=1 時 sy=1。單測就釘這 4 個點。
- 開砲：amp 0.12，時長 180ms。受擊：amp 0.22，時長 260ms。
- 砲管後座 `recoil(t)`：t < 0.15 時 z = −0.14·(t/0.15)；之後 z = −0.14·(1 − easeOut((t − 0.15)/0.85))，時長 180ms。
- 擠壓的 pivot 在地面：hull 的 scaling 改的是 root 底下的 hull，砲塔是 hull 的子物件，會一起被壓。

## 8. 特效表（每一列：觸發／持續／粒子或 mesh／上限）

粒子一律用 `fx/emitter` 的 `FxEmitter`，貼圖直接引用原路徑 `public/battle/bomber/fx_{spark,smoke,circle,star}.webp`，共 4 組 ParticleSystem。**每組上限：桌機 150、手機 60**。事件來源以 host 廣播的訊息為準（guest 預測的反彈也播），亂數一律用 `fxRandom`，不碰 `Math.random`。

| # | 特效 | 觸發 | 持續 | 粒子／mesh | 上限 |
|---|---|---|---|---|---|
| 1 | **砲口焰** | 收到 `bullet`，在發射者砲口（三連發 3 發共用 1 次） | 90ms | billboard plane 0.9，貼 `fx_star`，染 `#FFF6C8`→`#FF7A1A`，scale 0.5→1.0 後淡出（進 Glow）；`fx_spark` 6 顆沿砲管方向 ±25° 噴出 | plane 池 4（每台 1 片）；spark 組 150/60 |
| 2 | **子彈拖尾** | 子彈存活期間 | 跟子彈同生同滅 | `fx_circle` 每顆子彈 emitRate 40/s，life 0.18–0.26s，size 0.22→0，色是發射者 light→base；反彈後改成 `#FFFFFF`→`bounce` | circle 組 150/60 |
| 3 | **反彈火花** | host 判定反彈或 guest 預測反彈的那一刻，在撞擊點 | 160ms | `fx_spark` 10 顆，往反射後的那半球射出，白→`#FFE38A`；`fx_star` 1 顆 size 0.6；牆面上一圈白色小環（`ringPose`，d 0.8） | spark 組共用 |
| 4 | **命中火花** | `hit`（含護盾擋下） | 200ms | `fx_spark` 14 顆，染被打者的 light→白；`fx_star` 1 顆 size 0.8 | spark 組共用 |
| 5 | **受擊閃白** | `hit` | 80ms 全白，120ms 淡出 | `renderOverlay`（§6） | 每台 1 |
| 6 | **受擊擠壓彈跳** | `hit` | 260ms | hull scaling `squashPose(t, 0.22)`；擊退位移照 brief AC2 | 每台 1 |
| 7 | **無敵閃爍** | `hit` 後 `INVULN_MS` 內 | 1000ms | `visibility` 方波 10Hz，1↔0.35 | 每台 1 |
| 8 | **護盾泡泡／碎裂** | 撿到 `shield` 時出現；`hit.shieldBroken` 時碎裂；到期淡出 | 常駐；碎裂 220ms；到期淡出 300ms | 泡泡 sphere（每台 1 顆，平常 `setEnabled(false)` 收起來）；碎裂時 `fx_circle` 12 顆 | 泡泡 4；circle 組共用 |
| 9 | **三連發光環** | 撿到 `triple` | 8s | 環 plane 加 3 顆小球（每台 1 組，平常收起來） | 4 組 |
| 10 | **爆炸** | `destroyed` | 閃光 100ms、火球 300ms、煙 0.8–1.2s、焦痕到回合結束 | ① `fx_star` size 2.4 加 `fx_spark` 24 顆（白→`#FFC53A`）；② 火球 sphere d 2.2，emissive 三層 `flash` 色，scale 0.4→1.2 後淡出；③ `fx_smoke` 10 顆 `smokeDark`→`smoke`，往上飄；④ 碎片 6 塊（小 roundedBox，玩家色與 `trackSide` 交錯），重力拋射 900ms，用 1 組 thin instance；⑤ 砲塔跳起 1.5 再落到旁邊 0.8 的位置（`itemHop` 曲線）；⑥ 焦痕 plane d 3.0，貼徑向漸層 `#2B2440` 70%→0，y 0.015；被擊毀的若是自己，鏡頭微震 | 碎片池 24；焦痕池 4；火球池 2 |
| 11 | **履帶痕＋揚塵** | 移動中，每 0.42 單位距離 | 痕 2.5s 淡出；塵 0.5s | 痕：1 組 thin instance 小平面 0.24×0.16（`tread` 30%），左右履帶各 1 筆，環狀佇列；塵：`fx_smoke` 每 0.5 單位 2 顆，`dust` 50%，size 0.3→0.6 | 痕池 120（手機 60）；smoke 組共用 |
| 12 | **木箱碎裂** | 收到 `crate`（`{ ci }`，host 判定木箱被打掉後廣播；波 1 babylon 已新增此訊息），各端同時播 | 600ms | 6–8 片木板 thin instance（`#F0B866`／`#C07E33`），重力拋射；`fx_smoke` 3 顆奶白 `#FFF6E3` | 木板池 24 |
| 13 | **道具出現彈出** | `item` | 300ms | `fx/curves.itemHop(t, CELL)`：從木箱高度彈到 y 1.1＋0.4 CELL 再落回浮動高度，同時轉一圈；地上一圈白環（`ringPose`） | 環池 4 |
| 14 | **拾取光柱** | `pickup` | 400ms | cylinder d 0.9 h 3（開口，alpha 漸層貼圖），染道具色：120ms 內 scaleY 0→1，再 280ms 淡出；`fx_star` 8 顆往上；浮字（§8.1）往上飄：`+1`、`加速`、`連射`、`護盾`、`×3` | 光柱池 4 |
| 15 | **落牆預告與落下回彈** | `close` 前 `CLOSE_WARN_MS` 400ms 起出現預告；收到 `close` 時落牆 | 預告 400ms；落下 260ms；回彈 120ms | 預告：§4 的預告格，alpha 0.35↔0.65 以 6Hz 脈動（進 Glow）。落下：該筆 thin instance 從 y +6 用 easeIn 二次曲線落到 0。回彈：scaleY 0.85→1.04→1；`fx_smoke` 8 顆 `dust`，加一圈白環 d 2.6 | 預告 1 筆；smoke 組共用 |
| 16 | **連殺字卡** | `destroyed` 且 killer 不是 null：同一條命內，跟上一殺相隔 ≤ `STREAK_WINDOW_MS` 4000 就累加；2 殺顯示「雙殺」，3 殺顯示「三殺」（4 台坦克，3 殺就是上限） | 彈出 260ms、停留 900ms、上飄淡出 300ms | billboard plane 2.2×0.95，位置是擊殺者頭上 y 2.4；scale 0→1.25→1（`backOut`）；兩顆星芒 `fx_star` | 字卡池 2 |
| 17 | **鏡頭微震** | 自己受擊（`hit.targetId === selfId`）或自己陣亡 | 180ms | `camera.target` 在 (0, 0, −2) 附近抖動，振幅 0.25，線性衰減；結束時**歸位到 (0, 0, −2)**。`prefers-reduced-motion: reduce` 或手機檔時不做 | — |

### 8.1 浮字與字卡共用貼圖
一張 DynamicTexture 512×256，切成 8 格（每格 128×64）：`+1`、`加速`、`連射`、`護盾`、`×3`、`雙殺`、`三殺`，最後一格保留。字型：數字用 Fredoka 700，中文用站內中文字型 900。白字加 `OUTLINE` 6px 描邊；字卡另外畫奶油底 `#FFF6E3` 加深紫邊。開局時用 `whenFontReady` 畫一次，各 plane 只改 `uOffset`／`vOffset`，**不要每次新建**。字卡要跟著擊殺者換色：plane 的頂點色用擊殺者的 base 做色帶，或用 overlay；兩種都可以，選省 draw call 的那個。

## 9. HUD（React，`src/pages/Battle/TankHud.tsx`，根節點 `[data-tank-hud]`）

資料形狀照 brief 共用契約 `TankHud`。樣式 token 跟 bomber 玩家卡是同一套：奶油紙 `#fff6e3`、墨色 `#2b2440`、底盤 `#f3e6cc`、灰標 `#8a7a66`、邊線 2.5px、硬陰影 `0_5px_0_rgba(0,0,0,.4)`。數字用 `font-['Fredoka',_var(--font-sans)] font-bold`，中文用站內字型 900。所有 class 都加 `.tank-` 前綴，寫在 `src/index.css`，一律用 `@apply`。

### 9.1 三檔版面

| 檔位 | 條件 | `--tank-scale` | 版面 |
|---|---|---|---|
| **桌機 1920×1080** | 預設 | `hudScale(w, h)`（同 bomber，就是 min(w/960, h/540)，夾在 MIN～MAX）→ 2 | 跟 960 設計稿完全相同，等比放大 2 倍（`variant-A-gameplay.webp` 就是這一檔的 @2x） |
| **960×540** | 預設 | 1 | 計時膠囊在頂部中央，top 18。左欄放 P1、P3，右欄放 P2、P4（`splitColumns`），兩欄都是 top 18、整欄 `scale: calc(var(--tank-scale) * 0.75)`、卡片間距 14；右欄的 top 照 bomber 讓出全螢幕鈕（`.bomber-col-right` 同一個算式）。擊殺通知貼右欄左側，`right = 18 + 118×0.75 + 12 = 118.5`（乘上 scale），top 18，最多 3 則往下排，間距 6 |
| **手機 844×390** | `@media (max-height: 500px)` | 1（膠囊不縮放） | 玩家卡隱藏，改成頂部置中一排頭像膠囊（top `max(6px, safe-top)`，間距 6）；計時膠囊移到底部中央（bottom `max(8px, safe-bottom)`，高 34）；擊殺通知在右上，top = `max(0.5rem, safe-top) + 2.25rem + 6px`（在全螢幕鈕下面），scale 0.85，最多 3 則；觸控鈕照 §9.5 |

### 9.2 元件規格（960 設計尺寸）

| 元件 | class | 規格 |
|---|---|---|
| 根 | `.tank-hud` | `pointer-events-none absolute inset-0 z-10 select-none overflow-hidden [--tank-ink:#2b2440] [--tank-paper:#fff6e3] [--tank-plate:#f3e6cc]` |
| 計時膠囊 | `.tank-timer` | 同 `.bomber-timer`：`h-[44px] min-w-[200px] rounded-full border-[2.5px] border-(--tank-ink) bg-(--tank-paper) px-4 gap-2.5 shadow-[0_5px_0_rgba(0,0,0,.4)] [scale:var(--tank-scale)]`；內容依序：`AlarmClock` 20px `text-[#ff6a3d]`、`.tank-timer-text`（Fredoka 28px tabular-nums，`m:ss` 顯示 `remainSec`）、`.tank-timer-sep`（2×24 `bg-[#e4d6bc]`）、`.tank-timer-alive`（14px 800 `text-[#8a7a66]`，「存活 N/4」，N=`aliveCount`） |
| 計時：最後 10 秒 | `.tank-timer-urgent` | `remainSec ≤ 10` 且還沒進突然死亡時，字變 `text-[#ff3b4e]`，套 `animate-[tank-pulse_0.5s_ease-in-out_infinite]`（scale 1↔1.08） |
| 計時：縮圈中 | `.tank-timer-sudden` | `suddenDeath` 為 true 時：`bg-[#ff3b4e] text-white`，時間換成「縮圈中」（17px 900），圖示、分隔線、存活數都改白色 |
| 欄 | `.tank-col`、`.tank-col-left`、`.tank-col-right` | 照 `.bomber-col*` 一比一 |
| 玩家卡 | `.tank-card` | `relative flex h-[168px] w-[118px] flex-col overflow-hidden rounded-2xl border-[2.5px] border-(--tank-ink) bg-(--tank-paper) text-(--tank-ink) shadow-[0_5px_0_rgba(0,0,0,.4)] transition-[filter,opacity] duration-300`；玩家色用 CSS 變數 `--tc-light/base/dark` 傳進來（比照 bomber 的 `colorVars`） |
| 卡頭 | `.tank-card-head` | `h-[34px] border-b-[2.5px] bg-linear-to-b from-(--tc-light) to-(--tc-base) px-2 flex items-center justify-between`；名字 `.tank-card-name`（15px 900 白字，`text-shadow 0 1.5px 0 ink`，自己的卡名字直接寫「你」，跟 bomber 相同）；bot 在 P# 前面掛 `.tank-ai-tag`（同 `.bomber-ai-tag`，青色 `#39e6ff`）；`.tank-card-no`（Fredoka 16px） |
| 頭像 | `.tank-card-avatar` | `h-[66px]`，底是 `radial-gradient(circle_at_50%_62%,#efe3cc_0,#efe3cc_30px,transparent_31px)`；`TankAvatar` inline SVG 64×64（坦克正視圖，畫法同特寫表第 1 區「正視」：履帶、車身、圓頂、臉板加眼睛、砲口圓、旗子或天線） |
| 護盾標 | `.tank-card-shield` | `shield` 為 true 時，在頭像右上 `absolute right-1.5 top-[40px] size-[26px] rounded-full bg-[#39d5ff] border-2 border-(--tank-ink)`，中間放 lucide `Shield` 16px 白色 stroke 2.5 |
| HP | `.tank-card-hp` | `h-[22px] flex items-center justify-center gap-[3px]`；`maxHp ≤ 6` 時畫 `maxHp` 顆 lucide `Heart` 15px：還有的是 `.tank-heart-on`（`fill-[#ff5c8a] text-[#ff3b6a]`），扣掉的是 `.tank-heart-off`（`fill-none text-[#cdbfa6]`）；`maxHp > 6` 時改成 1 顆心加 `hp/maxHp`（Fredoka 14px） |
| 擊殺 | `.tank-card-kills` | `mx-2 h-[22px] rounded-lg bg-(--tank-plate) flex items-center justify-center gap-1.5`；lucide `Crosshair` 14px `text-[#ff3b4e]`，加 `× N`（Fredoka 15px） |
| buff 徽章 | `.tank-card-buffs`、`.tank-buff`、`.tank-buff-speed/rapid/triple` | 列：`h-[20px] pt-1 flex justify-center gap-[3px]`；徽章：`h-[15px] min-w-[34px] rounded-full border-[1.5px] border-(--tank-ink) px-1 flex items-center gap-0.5`，底色照 §2.3，圖示 10px，後面接秒數 `Ns`（Fredoka 10px），顯示 buff 的 `remainSec`。圖示與字色：speed 用 `#3a2a00`，其餘白色 |
| 陣亡 | `.tank-card-dead` | `opacity-60 grayscale`，右上 `💀`（同 `.bomber-card-skull`）；頭像不換 SVG，直接靠 grayscale |
| 擊殺通知 | `.tank-feed`、`.tank-feed-item`、`.tank-feed-leave` | 欄：`absolute flex flex-col items-end gap-1.5 origin-top-right [scale:var(--tank-scale)]`；條：`h-[26px] rounded-full border-2 border-(--tank-ink) bg-(--tank-paper) px-2 flex items-center gap-1 text-[12px] font-black shadow-[0_3px_0_rgba(0,0,0,.4)]`，進場用 `animate-[tank-feed-in_0.25s_ease-out]`（從 translateX(16px) 加 opacity 0 進來）；內容是 `[色點 10px] 擊殺者 [Crosshair 15px #ff3b4e] [色點] 被擊殺者`，`killer === null` 時換成 `[lucide SquareArrowDown 15px #c23a33] 落牆 [ChevronRight 13px] [色點] 被擊殺者`；每則從收到起算 3 秒套 `.tank-feed-leave`（`opacity-0 transition-opacity duration-300`），然後移除。React key 用 `feed[].id` |
| 手機膠囊 | `.tank-pills`、`.tank-pill`、`.tank-pill-shield` | 預設 `hidden`，`max-height: 500px` 時 `flex`。膠囊：`h-[30px] rounded-full border-2 bg-(--tank-paper) pr-2 shadow-[0_3px_0_rgba(0,0,0,.4),inset_0_0_0_2px_var(--tc-base)] flex items-center gap-1.5`；內容：頭像 SVG 34px（`-my-1`）、`Heart` 11px 加 hp、`Crosshair` 11px 加 kills（Fredoka 12px）、buff 小圓 13px（底色同 §2.3，裡面 8px 圖示）；有護盾時 `outline-2 outline-offset-1 outline-[#39d5ff]`，左上加 14px 青色小盾；陣亡 `opacity-60 grayscale` 加右上 💀 |
| 開局倒數 | 3D，不在 React | `createCountdownPanel(..., { theme: COUNTDOWN_THEME })`（`fx/countdown`），掛在 `look.uiCamera` 和 `UI_LAYER` |
| 結算 | 沿用 `setOverlay` | 名次字串照 brief AC2（bot 也排名次） |

`@keyframes tank-pulse`（同 bomber-pulse）、`tank-feed-in` 都寫在 `.tank-*` 區塊。`prefers-reduced-motion: reduce` 時 `.tank-timer-urgent` 和 `.tank-feed-item` 的動畫一律 `animate-none`。

### 9.3 手機觸控鈕（AC4，`BabylonCanvas.tsx` 的 `TOUCH_ACTIONS.tank`）

```ts
tank: [
  { label: '↺', key: 'q' },   // 砲塔左轉（逆時針；tank.ts turretAngle −=）
  { label: '↻', key: 'e' },   // 砲塔右轉（順時針）
  { label: '🔥', key: ' ' },  // 開火（原有）
],
```
三顆並排在右下（`TouchControls` 原本就是 `flex gap-3`、每顆 `size-16`），開火放最右邊，拇指最順手。按住會一直送 keydown，放開送 keyup，`tank.ts` 每幀讀 `keys.has('q'|'e')` 就會持續轉。`↺`／`↻` 是 U+21BA／U+21BB，iOS、Android、桌機的系統字型都有；qa 截圖時順便確認有畫出來，萬一變成豆腐框就改成「左」「右」。稿子裡用 lucide 的 `rotate-ccw`／`rotate-cw` 示意。

### 9.4 HUD 跟場地的關係（r 38 相機）
1920×1080 下，場地遠緣的寬度約 529～1391px、近緣約 294～1626px（有透視）。左右兩欄卡片合計寬約 18+88.5 = 107px（×2 = 213px），擋不到場地；計時膠囊會壓到遠端外框積木的上緣，跟 bomber 一樣，可以接受。

### 9.5 TankAvatar 與道具圖示 SVG
- `TankAvatar({ colorIndex, isBot, className })`，viewBox 0 0 64 64：
  - 履帶：rect (8,38) 14×20 rx4 和 (42,38) 14×20 rx4，填 `#4A4566`。
  - 車身：rect (16,36) 32×18 rx5，填 base 到 dark 的線性漸層。
  - 座圈：rect (18,30) 28×10 rx4，填 base。
  - 圓頂：path `M20 30 A12 9 0 0 1 44 30 Z`，填 radial(light, base, dark)。
  - 臉板：rect (24,24) 16×7 rx2，填 `#FFF1E0`；兩顆眼睛 ellipse (28.5,27.5) 和 (35.5,27.5)，rx1.6 ry2.2，填 `#2B2440`。
  - 砲口：circle (32,40) r5 填 `#5B6285`，裡面 circle r2 填 `#2B2440`。
  - 旗竿：line (24,24)→(24,8)；三角旗 path `M24 8 L34 11 L24 14 Z`，填 base。bot 改成天線球 circle (24,8) r3.5，填 `#39E6FF`。
  - 每個形狀都加 `stroke="#2B2440"`、strokeWidth 2。
- 三連發圖示 `TripleIcon`（24×24，stroke 用 currentColor）：`<path d="M12 20 L12 6 M12 20 L6.5 7.5 M12 20 L17.5 7.5" stroke-width="2.6" stroke-linecap="round"/>`，再加 3 顆 `<circle r="2.4">`，位置 (12,5)、(6,6.5)、(18,6.5)，填 currentColor。

## 10. 效能與檔位（照 brief AC9／AC10；這裡只補美術端的數字）

| 項目 | 桌機 | 手機 |
|---|---|---|
| 描邊／Glow／bloom | 開 | 關 |
| 陰影 | 1024 PCF | 512；檔位關掉陰影時，坦克與道具改用 blob 陰影平面（1 組 thin instance） |
| 粒子每組上限 | 150 | 60 |
| 履帶痕池 | 120 | 60 |
| 鏡頭微震 | 開（`prefers-reduced-motion` 時關） | 關 |
| 貼圖 | 全部程式產生：地面 512²、履帶紋 64×16、道具圖集 256×64、浮字圖集 512×256、「你」標籤 128×64、預告格 64²；粒子重用 `fx_*.webp`。**不新增圖檔** | 同左 |
| 自動降級順序 | 描邊 → Glow → 陰影（`fx/quality` 的 `DEGRADE_ORDER`） | — |

## 11. 給實作者的對照（波 2／波 3）

| AC | 看哪裡 |
|---|---|
| AC5 角色與場景 | §3、§4；特寫表第 1、3、4 區 |
| AC6 材質光影 | §5 |
| AC7 特效 | §6、§7、§8；特寫表第 2、5 區 |
| AC8 HUD | §9；特寫表第 6 區；`variant-A-gameplay.webp`、`variant-A-mobile.webp` |
| AC4 觸控 | §9.3 |
| AC9／AC10 | §10、§4 的 draw call 預估 |

## 12. 待確認（不擋實作，有疑義就照 brief 的 QUESTION 流程問領導）

1. 三連發的實際散角是 ±12°（`TRIPLE_SPREAD_DEG`）。圖示和光環小球為了好認，畫成誇張的 ±24°；遊戲中的子彈請照 brief 的常數。
2. 木箱實例縮放 0.8（1.44 立方），是為了讓柱牆維持主要地標的地位。如果 babylon 想維持 bomber 的 1.8，也不影響玩法，只是畫面會比較擠。
3. `↺`／`↻` 的字型覆蓋請 qa 截圖確認（§9.3）。
