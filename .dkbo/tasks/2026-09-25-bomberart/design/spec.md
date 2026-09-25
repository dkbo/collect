# 炸彈超人美術優化：方向稿 spec

> 雜務 chore-designer-1 寫於 2026-09-25。這份只定方向，沒有改程式，也沒有起 dev server。
> 目標是做到跟糖果消消樂 A 亮面經典稿同等級的精緻度；使用者還沒選風格，所以出三套差異明顯的變體。

## 0. 產出一覽（本目錄）

| 檔案 | 內容 |
|---|---|
| `variant-{A,B,C}.pen` | 三套原稿，每份有 2 個頂層 frame：`對戰畫面 Gameplay`（960×540）與 `物件特寫表 Object Sheet`（1200×1090） |
| `variant-{A,B,C}-gameplay.webp` | 對戰畫面 1920×1080（@2x）。三套用**同一個盤面**：4 位玩家（P4 是 AI），爆炸發生的當下 |
| `variant-{A,B,C}-sheet.webp` | 物件特寫表 1800×1635（@1.5x）：角色 4 色加 AI 標記、炸彈（一般／將爆）、火焰（中心／臂／端）、可破磚、硬磚、硬磚受損、柱牆、外框牆、磚碎裂中、6 種道具、地面 A／B 格、12 格色票、6 條材質要點 |

**共用盤面**（三套相同，方便直接比較）：13×11 格，外面再圍一圈外框牆，柱牆位置照 `bomberMap.ts` 放在（奇, 奇）格。炸彈在 (6,4) 以火力 3 炸開：左臂炸到 (2,4) 的木箱，右臂炸到 (10,4)，上臂炸到 (6,0)，下臂打中 (6,8) 的硬磚、讓它變成受損。另外還有兩顆炸彈：P3 身邊 (2,8) 一顆一般的，P4 身邊 (10,8) 一顆正在閃紅、即將爆炸。6 種道具全部散在場上。畫面是俯視 3/4 的斜投影：每格頂面 44×34，正面露出 20–28px 的高度。

## 1. 現況盤點（`bomber.ts` / `bomberMap.ts` / `hud.ts`）

| 物件 | 現況做法 | 行號 |
|---|---|---|
| 相機 | `ArcRotateCamera(-π/2, β 0.55, r 30)`，光源只有一盞 `HemisphericLight` | L1354–1355 |
| 玩家 | 7 件 MeshBuilder（身 Box、頭 Sphere、臉 Box、半球頭盔、天線、天線球、臂腿 Box），`StandardMaterial` 單色。**顏色是拿 id 做 hash 再用 `Color3.FromHSV(h,0.7,0.9)` 算出來的**，所以 4 位玩家可能撞色 | L268–271、L326–410 |
| AI | 身上多一個 `Torus` 灰白環，emissive 偏亮 | L373–380 |
| 可破磚 | 用 hash 從方塊、圓角、木桶、壓扁球 4 種形狀和 5 種木色裡挑，加 `enableEdgesRendering` | L489–537 |
| 硬磚（炸兩次） | 金屬 Box 加箍帶、4 顆鉚釘、亮邊；受損狀態換成 `crateDamagedMat` | L489–516、L1374–1382 |
| 柱牆／外框牆 | 灰 Box `wallMat`／`borderMat`，外框高 1.3 | L1448–1478 |
| 地面 | 一張大 ground，上面再鋪 143 塊 `CreateBox` 格子，A／B 兩色交錯 | L1428–1446 |
| 炸彈 | Sphere 加引信 Cylinder；將爆前 600ms 換成 `bombFlashMat`（紅色 emissive） | L840–846、L1383–1387 |
| 火焰 | 每一格一個 Box，中心用 `flameCoreMat`、其餘用 `flameMat`（emissive、`disableLighting`），生長 90ms、消退 180ms、共 550ms | L1045–1050、L159–161 |
| 道具 | 6 種：`bomb`、`fire`、`speed`、`kick`、`throw`、`invincible`（7 秒）。都是深色底座加光環，再用 Sphere／Cylinder／Box 拼出圖形，會旋轉加浮動 | L1149–1236、L1395–1424 |
| 突然死亡 | 開局 40 秒後，每 650ms 從外圈往內落一格 `wallMat` 牆，落地時帶碎片和震動 | L1086–1135 |
| 粒子 | 4 組爆發型粒子（爆炸火花、木箱碎片、陣亡白煙、拾取閃光），貼圖是 1×1 白點 | L1522–1570 |
| HUD | `createTextPanel(... 'glass')` 做成 3D 平面上的單行文字，內容像 `存活 3/4 💣2 🔥3 ⚡1 👟 🛡️5s 🏆2:1`；倒數用 `createCountdownPanel` 的膠囊加 3/2/1/GO!；結算交給 React 覆蓋層 `setOverlay` | L1485–1486、L1876–1900、`hud.ts` |

現況的問題：顏色全是單色、沒有陰影也沒有後製；柱牆、硬磚、外框三種灰色分不太出來；HUD 全靠 emoji 單行，看不到其他玩家的狀態；每格地面都是獨立 mesh，draw call 很多。

## 2. 三套變體比較

| | A · Toy Box 卡通玩具 | B · Voxel Block 體素方塊 | C · Sugar Rush 亮面糖果 |
|---|---|---|---|
| 語彙 | Q 版低多邊形、圓角厚塊、卡通兩階明暗加深紫描邊（KayKit／Kenney） | 零圓角、三面固定明暗、4px 像素雜點（Minecraft／Crossy Road） | 硬糖鏡面、強高光加白色硬點，跟糖果消消樂 A 同調 |
| 地面 | 草地棋盤格加草叢點綴 | 像素草皮 | 淡紫果凍磚加亮邊 |
| 柱牆／外框 | 淺灰石柱加磚縫／紫灰石牆加青苔 | 圓石／深色石磚 | 巧克力塊／糖果手杖條紋 |
| 可破磚／硬磚 | 木箱加 X 撐條／鐵角加鐵箍的強化木箱 | 木板箱／鐵塊加紅黑警示條 | 三色軟糖方塊／禮盒加緞帶蝴蝶結 |
| 火焰 | 橘、黃、奶白三層，爆心有星芒 | 方塊火，白芯外加像素火星 | 粉、橘、奶油三層加彩色糖珠 |
| **爆炸範圍辨識度** | ✅ 最好（暖火對上綠地，互補色） | ✅ 好 | ⚠️ 粉紅火焰和粉紅禮盒、手杖外框同色系，範圍邊界比較糊 |
| 4 色玩家辨識度 | ✅ 背景色少，玩家最跳 | ✅ 好 | ⚠️ 薄荷、檸檬軟糖和綠、黃玩家搶色（P3 站在薄荷磚旁邊就被吃掉） |
| 柱牆、硬磚、外框能否一眼分辨 | ✅ 石（灰）、木鐵（棕）、紫三種色相 | ⚠️ 柱牆和鐵塊都偏灰，要靠警示條分 | ✅ 巧克力、禮盒、手杖三種色相 |
| 跟站內深色頁面的協調 | ✅ 深青背景 | ✅ 深灰藍 | ✅ 紫夜空（和糖果頁一致） |
| 素材來源 | ✅ 有大量 CC0 現成 glTF（KayKit／Kenney／Quaternius） | ✅ 程式 Box 就做得出來，幾乎不用外部素材 | ⚠️ 沒有現成的糖果風俯視對戰素材包，要自建或自己組合 |
| Web 效能 | ✅ 中（描邊要多一個 pass） | ✅ 最省（沒有 Glow 也成立，貼圖極小） | ⚠️ 最吃（PBR、clearCoat、HDR 環境、全場 Glow） |
| 精緻度上限 | 高 | 中（風格本身比較素） | 最高，但最容易雜亂 |

## 3. 推薦：A · Toy Box 卡通玩具

1. **可讀性是對戰遊戲的第一要件。** 炸彈超人每一秒都要判斷「火會燒到哪、哪格能躲」。A 用暖色火焰配冷色草地，範圍一眼就看得清楚。C 很漂亮，但粉紅火焰落在粉紅禮盒和手杖框之間時邊界會糊掉，4 色玩家也會跟彩色軟糖搶眼。
2. **素材最現成，授權也最乾淨。** KayKit、Kenney、Quaternius 都是 CC0 的低多邊形 glTF，風格和稿子一致，角色、木箱、石牆、道具都有候選。C 幾乎全部要自建。
3. **成本和效能居中。** 卡通 ramp（`CellMaterial` 或 NodeMaterial）加 `renderOutline` 不需要 HDR 環境，也不用 PBR，手機只要關掉描邊和 Glow 就能降級。
4. **精緻度可以向 C 借。** 道具、炸彈、將爆閃光的「鏡面高光加白色硬點」直接沿用 C 的做法，讓 A 保有跟糖果消消樂一樣的光澤感。這只影響少數小物件，不會讓全場變雜。

> 如果使用者更看重「全站遊戲風格一致」（跟糖果消消樂同調），可以改選 C。這時要先解掉第 2 節的兩個 ⚠️：火焰改成暖黃白色、跟粉色脫鉤；軟糖磚改用低彩度（奶油、焦糖、可可）色，不要跟玩家 4 色撞。詳見第 11 節待裁決 #1。

## 4. A 方案：固定的 4 色玩家

`colorFor(id)` 改成**依玩家序號（P1–P4）取固定色**，不再用 hash（hash 會撞色，也可能生出難看的色相）。出生角照 `SPAWN_CORNERS` 的順序分配。

| 序 | 名稱 | 亮 | 本色 | 暗 | 用途 |
|---|---|---|---|---|---|
| P1 | 紅 | `#FF8A94` | `#FF3B4E` | `#B3122A` | 頭盔、身體、HUD 色帶 |
| P2 | 藍 | `#8CC4FF` | `#2F86FF` | `#1446B8` | 同上 |
| P3 | 綠 | `#93F0A8` | `#2FCF5E` | `#138A3A` | 同上 |
| P4 | 黃 | `#FFF0A0` | `#FFC21A` | `#C27D00` | 同上 |

- 頭盔用本色，加徑向漸層（亮 0%、本色 50%、暗 100%，中心在 35%, 25%）；臉部用 `#FFF1E0`；眼睛用 `#2B2440`，裡面點一顆白色小光點。
- **AI 標記**：天線球從粉色 `#FF5AA8` 換成青色 `#39E6FF` 並加 Glow，頭盔右上角掛一個 `AI` 小章。拿掉現有的灰白 Torus 環，它太像道具光環。
- **自己**：頭上多一個本色的「你」膠囊標記（Babylon GUI 或 billboard plane）。
- 無敵期間：身體外圈加一層金色 `#FFCF3F` 的 fresnel／Glow，閃爍頻率 8Hz；剩下 1.5 秒時改成 16Hz。

## 5. A 方案：物件建模做法

尺寸以 `CELL = 2`（世界單位）為準；稿子上 44px 就等於 1 CELL。

| 物件 | 建議做法 | 規格重點 |
|---|---|---|
| 地面 | **程式**：整張 ground 一個 mesh，套 26×22 像素的棋盤格貼圖（每格 2×2 px、NEAREST 取樣）或 shader，**不要再逐格建 Box** | A 格 `#79C257`、B 格 `#6CB44C`、草叢 `#58A03C`（貼圖裡點綴）；每格頂緣 2% 寬、白色 13% 的亮邊 |
| 柱牆 | **程式**：圓角盒（`CreateBox` 加 2 段倒角，或 KayKit 的石塊 glTF），用 thin instance 一次畫完 | 頂 `#E3E6EF`→`#C4C8D6`，側 `#9BA1B8`→`#767C95`，磚縫 `#5D627A`；高 1.1 CELL |
| 外框牆 | 同柱牆，換色、加高 | 頂 `#B3A4C9`，側 `#6F6490`，青苔 `#7FB85A`；高 1.3 CELL（沿用現有高度） |
| 可破磚 | **glTF 優先**（Kenney／KayKit 的木箱），沒有的話就用程式圓角盒加 X 撐條貼圖；拿掉現有的木桶、球形變體，統一成箱形，可讀性比較好 | 頂 `#F7C677`，側 `#DC9A48`，撐條 `#8F561D`；高 0.9 CELL |
| 硬磚 | 同一個木箱模型換成「鐵角強化」貼圖，或多加 4 個角件和 1 條鐵箍的子 mesh | 木 `#D99A5A`、鐵 `#8E9AB0`／`#C3CBD8`、鉚釘 `#FFE38A`。**受損態**：鐵箍中央斷開、疊一張裂痕 decal，木色壓暗成 `#B98450` |
| 突然死亡落牆 | 重用柱牆模型，另加紅色警示頂 `#FF5A4E`，落下前 400ms 在地上畫紅色預告格 | 預告格用 `#FF3B30` 40% 加脈動 |
| 炸彈 | **程式**：Sphere（segments 16）加引信座 Cylinder，引信用 `CreateTube` 沿曲線做，末端火花用粒子 | 本體徑向漸層 `#6B7089`→`#2A2D3D`→`#15161F`，引信 `#D9A066`；將爆時本體換成 `#FF3B30` 並加 Glow，縮放 1.0↔1.12 脈動 |
| 火焰 | **程式**：中心用 billboard 星芒（粒子）加 3 層 Sphere 殼；臂用 3 層巢狀的圓角 Box（外、中、芯），端頭是半圓帽 | 外 `#FF7A1A`、中 `#FFC53A`、芯 `#FFF6C8`，全部 emissive 加 `disableLighting`；只有外層進 GlowLayer |
| 道具 | **程式**：圓角方塊代幣（外殼加下唇），正面是圖示貼圖（同一張圖集），比現在拼幾何好認得多 | 6 種底色：炸彈 `#4AA3FF`、火力 `#FF6B3D`、速度 `#FFD23F`、踢彈 `#B07CFF`、丟彈 `#3FD0A0`、無敵 `#FFCF3F`（帶 Glow）；圖示是白色（速度、無敵用深色 `#3A2A00`）；加 C 式鏡面高光 |
| 角色 | **glTF 優先**（KayKit 角色重上色，帶走、跑、死亡動畫）；沒有的話維持程式 7 件，改成圓角加徑向漸層 | 見第 4 節 |

### 5.1 候選免費素材（**未下載**；授權以素材頁實際標示為準，落地前由 assets 再核一次）

| 素材包 | 作者 | 授權 | 用途 |
|---|---|---|---|
| KayKit – Adventurers Character Pack（免費版） | Kay Lousberg | CC0 | 角色（含動畫骨架）、重上色成 4 色 |
| KayKit – Dungeon Remastered | Kay Lousberg | CC0 | 石柱、石牆、木箱、桶 |
| KayKit – Prototype Bits | Kay Lousberg | CC0 | 圓角塊、代幣底座 |
| Kenney – Platformer Kit | Kenney | CC0 | 木箱、草地塊、道具底座 |
| Kenney – Mini Characters | Kenney | CC0 | 角色備案（比較小、比較 Q） |
| Kenney – Particle Pack | Kenney | CC0 | 火焰、星芒、煙、火花的粒子貼圖 |
| Kenney – Game Icons | Kenney | CC0 | 道具圖示、HUD 圖示 |
| Quaternius – Ultimate Stylized Nature | Quaternius | CC0 | 草叢、石頭點綴（選配） |
| 字體：Lilita One／Noto Sans TC | Google Fonts | OFL 1.1 | HUD 數字／中文 |

B 案備選：Kenney Voxel Pack（CC0）、Quaternius Cube World（CC0）、自己用 MagicaVoxel 匯出。C 案備選：Kenney Food Kit（CC0，糖果、巧克力件要先確認）；Poly Pizza 單件模型的授權因作者而異（多為 CC-BY，要標示），不建議當主力。

## 6. 材質

| 類別 | A 做法 | 備註 |
|---|---|---|
| 一般物件 | `CellMaterial`（`@babylonjs/materials`，`computeHighLevel = false` 取兩階），或自己寫 NodeMaterial 的 ramp：亮 1.0／暗 0.62，交界柔化 0.05 | `@babylonjs/materials` **目前不在相依裡**；要裝就交給 it，不想加依賴就走 NodeMaterial |
| 描邊 | `mesh.renderOutline = true`、`outlineWidth = 0.02`、`outlineColor = #2B2440` | 只套玩家、炸彈、箱子、道具；地面和牆不描（省 pass，牆靠貼圖的磚縫線） |
| 發光物 | `StandardMaterial`，只用 emissive 加 `disableLighting`（火焰、將爆炸彈、無敵代幣、AI 天線） | 交給 GlowLayer 帶光暈 |
| 不用 | PBR、HDR 環境貼圖 | 那是 C 案才需要的 |

**匯入注意**：babylonslim 之後，所有 Babylon 功能都集中從 `src/babylon/babylonCore.ts` 用深層路徑匯入，**新功能要在那裡補副作用 import**，例如 `Lights/Shadows/shadowGeneratorSceneComponent`、`Layers/effectLayerSceneComponent`、`Rendering/outlineRenderer`、`PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline`，以及 glTF 要用的 `@babylonjs/loaders/glTF`（**loaders 也不在相依裡**）。這支檔案是 tank、race、overcooked 共用的，只有 babylon 角色能改，改完要重量 vendor-babylon 的 bundle 大小。

## 7. 光影與後製

- **光**：`HemisphericLight`（強度 0.55，groundColor `#3A3F5C`）加一盞 `DirectionalLight`（方向 (-0.4,-1,0.3)、強度 0.9、色 `#FFF4E0`）。暖主光配冷環境光，形成卡通的冷暖對比。
- **陰影**：`ShadowGenerator` 桌機 1024、手機 512，`usePercentageCloserFiltering`，`darkness 0.35`。**只讓玩家、炸彈、道具投影**；牆和箱子的接地陰影直接烘進地面貼圖，或用一張 blob 陰影平面，不用每幀重算。
- **GlowLayer**：`intensity 0.7`、`blurKernelSize 32`，用 `includeOnly` 白名單限定火焰外層、將爆炸彈、無敵代幣、AI 天線球，避免全場泛白。
- **DefaultRenderingPipeline**：`fxaaEnabled = true`（取代 MSAA，省）；`bloomEnabled` 只在桌機開（threshold 0.85、weight 0.3、kernel 48）；`imageProcessing.toneMappingEnabled = true`、`ACES`、exposure 1.05、contrast 1.08；手機關掉 bloom，只留 FXAA 和 tonemap。
- **相機**：β 從 0.55 調成 0.62，fov 0.6（預設 0.8），拉遠補償，減少透視造成的邊角拉伸，讓畫面更接近稿子的 3/4 斜視。震動維持 220ms。

## 8. 特效

| 事件 | 做法（A） | 時長 |
|---|---|---|
| 放炸彈 | 從 0.6 彈到 1.0 縮放（back-out），落地時地上擴散一圈白色 ring decal | 180ms |
| 引信燃燒 | 引信末端火花粒子（Kenney spark 貼圖，emitRate 30）；最後 600ms 本體閃紅並脈動，火花加倍 | 2000ms |
| 爆炸 | 爆心星芒 billboard 從 0.3 放大到 1.2 再淡出；臂從中心往外依序生長（每格延遲 25ms）；火焰 emissive 從 1.0 降到 0.4 再收縮；地上留焦痕 decal 1.5 秒；相機震動 | 沿用 550ms（生長 90ms／消退 180ms） |
| 木箱炸毀 | 6–8 塊木片（小 Box 的 SPS 或粒子，貼 `#F0B866`／`#C07E33`）配重力拋射，加 3 團奶白煙 | 600ms |
| 硬磚受損 | 鐵箍閃白 1 幀，換成受損貼圖，噴幾顆金屬火花 | 120ms |
| 道具出現 | 從箱子位置往上彈 0.4 CELL 再落回、代幣旋轉；無敵代幣常駐金色 Glow | 300ms |
| 拾取 | 代幣縮到 0 並飛向玩家頭頂，飄出一個 `+1` 圖示（Babylon GUI），配 sparkle 粒子 | 250ms |
| 陣亡 | 角色往上跳、旋轉、縮小，噴一團白煙和頭盔色的星星；觀戰時自己的 HUD 卡片變灰 | 700ms |
| 突然死亡 | 落牆前 400ms 在地上畫紅色預告格並脈動，落地時灰塵環加震動；計時器在最後 10 秒變紅、開始跳動 | — |

粒子貼圖一律改用 Kenney Particle Pack 的軟邊圓、星、煙（要轉成 WebP 放進 `public/`），不再用 1×1 白點。

## 9. HUD

版面見 `variant-A-gameplay.webp`：左右兩側各放兩張玩家卡（左 P1、P3；右 P2、P4），頂部中央放計時器。

- **做法**：建議改成 **React 覆蓋層**（Battle 頁面已經有 `setOverlay` 管道），不要再用 3D 平面的 `createTextPanel`。DOM 文字清楚、字體正確，也容易做 RWD。**但目前 `GameOverlay` 只有 title／subtitle／actions**，要傳 4 位玩家的能力值，需要擴充 `src/babylon/types.ts` 的介面，這屬於共用契約，要另外裁決（見第 11 節 #3）。不擴充的替代方案是用 Babylon GUI `AdvancedDynamicTexture` 全螢幕 UI，一樣能照稿子做。
- **玩家卡**（118×206 @960 寬基準）：`bg-[#fff6e3] border-[2.5px] border-[#2b2440] rounded-2xl shadow-[0_5px_0_rgba(0,0,0,.4)]`。頂部 34px 放玩家色帶（亮→本色的漸層）、名字（Noto Sans TC 900、15px、白字）、`P1` 編號（Lilita One 16px）。中間放角色頭像（用 3D 快照或 2D 圖）。勝場用 3 顆星（`MATCH_TARGET = 3`，已得的星是 `#FFCF3F`，沒得的是 `#E4D6BC`）。底部 3 格能力值（💣 炸彈數、🔥 火力、⚡ 速度等級），用 lucide 的 `bomb`／`flame`／`zap` 圖示，數字用 Lilita One 17px。持有踢彈、丟彈、無敵時，在能力列下方多一排小徽章（無敵附倒數秒數）。陣亡時整張卡 `grayscale opacity-60`，右上角標 💀。自訂 class 一律用 `@apply` 寫。
- **計時器**：200×44 膠囊，`rounded-full`，鬧鐘圖示加時間（Lilita One 28px）加分隔線加「存活 4/4」。內容顯示**距離突然死亡的倒數**（40 秒）；進入突然死亡後改成紅底 `#FF3B4E`、寫「縮圈中」。
- **開局倒數 3/2/1/GO!**：沿用 `createCountdownPanel` 的節奏，但改成 A 的配色（奶油底、深紫描邊、Lilita One）。
- **手機**：寬度 < 640px 時，玩家卡縮成頂部一排 4 顆頭像膠囊（頭像加 3 個小數字），計時器移到下方中央。

## 10. Web 效能預算

| 項目 | 桌機 | 手機（降級） |
|---|---|---|
| draw calls | ≤ 120 | ≤ 70 |
| 地面 | 1 個 mesh（目前是 143 格加 1 張） | 同左 |
| 柱牆加外框 | thin instance，1–2 個 draw call（目前各自獨立，約 30 根柱加 4 面牆） | 同左 |
| 木箱／硬磚 | 各 1 個 thin instance 群組；炸毀時更新 matrix buffer，不要 dispose mesh | 同左 |
| 陰影貼圖 | 1024、PCF | 512，或關掉改用 blob 陰影 |
| GlowLayer | 開（`includeOnly` 白名單） | 關，只留 emissive |
| 描邊 | 開 | 關 |
| 後製 | FXAA、bloom、ACES | FXAA、ACES |
| 解析度 | `hardwareScalingLevel = 1 / min(devicePixelRatio, 2)` | 固定 1.5 |
| 粒子 | 每組上限 150（沿用） | 上限 60 |
| 貼圖 | 全部 WebP，圖集 ≤ 1024²，總量 ≤ 1.5 MB | 同左 |
| glTF | 角色 ≤ 300 KB／個（共用一份，4 色換材質），全部模型 ≤ 1.5 MB（Draco 或 meshopt 壓縮） | 同左 |

**降級判定**：`engine.getCaps().maxTextureSize < 4096`、`navigator.hardwareConcurrency <= 4` 或觸控裝置，都走手機檔；另外量連續 60 幀的平均，低於 45fps 就自動降一級（先關描邊，再關 Glow，最後關陰影）。

## 11. 待裁決

1. **選哪一套**：A（推薦，可讀性和素材最好）、C（全站糖果同調，但要先解火焰和軟糖撞色），還是 B（最省、風格最素）。
2. **素材路線**：角色和箱子用 CC0 glTF（要裝 `@babylonjs/loaders`，由 it 處理，assets 負責下載、轉檔、核授權），還是全部用程式 MeshBuilder 升級（不加依賴，但角色精緻度有上限）。
3. **HUD 用 React 還是 Babylon GUI**：用 React 要擴充 `GameOverlay` 或另開一個 HUD 資料通道（改到 `src/babylon/types.ts` 共用介面，影響所有 Babylon 遊戲）；用 Babylon GUI 不動介面，但要多帶 `@babylonjs/gui`（也不在相依裡）。
4. **卡通材質**：要不要加 `@babylonjs/materials`（CellMaterial），還是自己寫 NodeMaterial ramp。
5. **可破磚要不要保留形狀變體**（木桶、壓扁球）：稿子建議統一成箱形，靠色調變化保留趣味。
6. **固定 4 色**：確認改用序號配色、不再用 id hash（會牽動 `colorFor`，而且對手的顏色在各端要一致，要確認是依 `entities()` 順序還是依出生角）。
7. **相機 β／fov 要不要調**：會影響 AI 視角測試和觸控移動，要由 qa 截圖確認。
8. **bundle 預算**：babylonslim 才剛瘦完身，這次會加回 ShadowGenerator、GlowLayer、Pipeline、Outline，可能還有 loaders、gui、materials。可以接受的上限要定一個數字，建議 vendor-babylon gzip 增量 ≤ 250 KB。

## 12. 建議分工（給領導）

1. **assets**：依第 5.1 節核授權、下載、重上色，glTF 壓縮，貼圖轉成 WebP（圖集、粒子、圖示）。
2. **it**：依裁決加相依（`@babylonjs/loaders`／`gui`／`materials` 之中選定的）。
3. **babylon**（L 檔）：在 `babylonCore.ts` 補 import，接光影、後製、GlowLayer，換物件建模、thin instance、材質，做特效和固定 4 色。
4. **react**（若選 React HUD）：玩家卡、計時器元件，要先有 netcore／babylon 定好的 HUD 資料介面。
5. **qa**：用 `shot.mjs --contexts 2` 截桌機和手機（390 寬）畫面對照稿子，量 draw call 和 fps（`SceneInstrumentation.drawCallsCounter`、`engine.getFps()`）。
