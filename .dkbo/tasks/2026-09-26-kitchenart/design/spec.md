# 廚房快手美術優化：方向稿 spec

> 雜務 chore-designer-1 寫於 2026-09-26。這份只定方向：沒有改程式，也沒有起 dev server。
> 目標是做到跟糖果消消樂、炸彈超人 A「Toy Box」同等級的精緻度。做法延續 bomber 的定案：**全部程式建模，不引入 glTF**；HUD 改用 React。

## 0. 產出一覽（本目錄）

| 檔案 | 內容 |
|---|---|
| `variant-{A,B,C}.pen` | 三套原稿。每份有兩個頂層 frame：`對戰畫面 Gameplay`（960×540）、`物件特寫表 Object Sheet`（1200×1250） |
| `variant-{A,B,C}-gameplay.webp` | 對戰畫面，1920×1080（@2x） |
| `variant-{A,B,C}-sheet.webp` | 物件特寫表，1800×1875（@1.5x）。內容：角色 4 色（切菜／端湯／待命／拿肉四種姿勢）；工作站（兩種食材箱、出餐口、空檯面）；砧板 3 態；鍋 5 態；食材 2×4 矩陣（生／切好／煮好／焦掉）；空盤與 4 道成品；訂單卡 3 態；HUD 元件（計時＋分數、玩家卡、開局倒數、計時條與進度環、食譜列）；12 格色票；6 條材質要點 |

**共用畫面**：三套畫的是同一個廚房、同一個瞬間，方便直接比較。
- 廚房照 `overcookedKitchen.ts` 的 `STATIONS` 擺：11×7 格，外圈一圈都是檯面。上排有蔬菜箱 (2,0)、肉箱 (4,0)、出餐口 (8,0)；左排是砧板 (0,2)、(0,4)；右排是鍋 (10,2)、(10,4)。
- 4 位玩家的狀態：P1 紅（自己，頭上有「你」）在 (0,2) 切菜，進度 60%；P2 藍端著蔬菜湯走向出餐口；P3 綠顧 (10,2) 的鍋，進度環 55%，正在冒蒸氣；P4 黃拿著生肉走向砧板。
- 其他狀態：(10,4) 那鍋肉湯**快焦了**（紅色進度環、「!」警示、冒黑煙）；(0,4) 砧板上的肉已經切好（綠勾）；出餐口剛出完一份（星星加「+20」）。
- 訂單列排滿 3 張（`MAX_ORDERS = 3`）：蔬菜湯（綠，33 秒）、烤肉拼盤（黃，19 秒）、肉湯（紅，6 秒，正在抖動警告）。
- 投影方式：俯視 3/4 的斜投影。每格頂面 62×46，檯面正面露出 22px。

## 1. 現況盤點（`src/babylon/games/overcooked.ts`，下稱 oc）

| 物件 | 現況做法 | 行號 |
|---|---|---|
| 相機／光 | `ArcRotateCamera(-π/2, β 0.5, r 26)`，相機跟著全員的重心移動（lerp 0.03）；只有一盞 `HemisphericLight` | oc L330–331、L855–870 |
| 玩家顏色 | 拿 `colorFor(id)` 對 id 做 hash，再用 `Color3.FromHSV(h, 0.7, 0.9)` 取色，**4 人可能撞色** | oc L147–151 |
| 玩家 | 7 件 MeshBuilder（Box 身體、Sphere 頭、Box 臉、四肢 Box），`StandardMaterial` 單色，每人 3 份材質；四肢擺動寫在 `animateAvatar` | oc L171–223、L225–249 |
| 食材／成品 | 一律是 0.7 的方塊，換 `itemColor` 單色：蔬菜綠、肉紅、切好的會混白、湯是藍或橘、焦的是深褐；材質用 `itemMats` 快取 | oc L153–169 |
| 加工進度 | 物品方塊縮放 `0.5 + 0.5 × progress`，沒有進度條 | oc L452–461 |
| 手持物 | 0.5 的方塊浮在頭上 y = 1.9 | oc L525–549（L539） |
| 地面 | 一張大 ground，再逐格鋪 45 塊 `CreateBox` 地磚（兩色交錯） | oc L333–337、L620–632 |
| 工作站底座 | 外圈 32 格，每格一個 `CreateBox`，照 kind 上 5 種單色；食材箱上多放一顆示意方塊；有存放格的站點各帶一個物品指示方塊（29 個） | oc L339–370 |
| 牆／踢腳 | 4 面牆加 4 條踢腳線，都是 Box | oc L634–669 |
| 站點裝飾 | 鍋是扁圓柱加把手；砧板是扁 Box 加刀，**每把刀各建一份材質**；出餐鈴是 Sphere 加底座 | oc L671–711 |
| 掛架／時鐘 | 掛架是 Box 加 5 個 Cylinder 掛鉤；時鐘是 Cylinder 加 Torus | oc L713–740 |
| 粒子 | 每個鍋一組蒸氣，出餐一組金色火花；貼圖都是 1×1 白點（data URI） | oc L743–797、L799–818 |
| 浮字 | `+20` 用 billboard plane 加 DynamicTexture，**每次都新建貼圖和材質** | oc L820–853 |
| HUD | 4 塊 `createTextPanel` 3D 文字面板：`hud` 顯示分數、剩餘時間、手持物；`banner` 是倒數和結算；`orders` 是訂單清單；`recipes` 是食譜清單 | oc L376–379、L556–603 |
| 音效 | 比對前後兩次 view 的差異來觸發 | oc L464–484 |
| 廚房邏輯 | 食材只有 `v`／`m`，狀態有 `raw`／`chop`／`soup`／`burnt`；切 1.5 秒、煮 3 秒，煮好後 5 秒變焦；訂單壽命 40 秒，每 8 秒補一張 | `overcookedKitchen.ts` L9–12、L104–113 |

**從邏輯面讀出、會影響美術的事實**：
1. **沒有盤子物件**。湯從鍋裡取出後直接端著去出餐（`applyUse` 的 serve 分支）。稿子裡的「盤子與成品」只是外觀，見待裁決 #4。
2. **`combine` 步驟沒有實作**。出餐只比對 `order.ing === hand.ing`（`overcookedKitchen.ts` L157）：「蔬菜肉湯」送一碗蔬菜湯就算完成，「烤肉拼盤」送一碗肉湯就算完成。**不管哪道菜，得分都是 `SCORE_SERVE = 20`**，食譜寫的 40／35 並不會生效。見待裁決 #5。
3. **「快焦」可以直接從現有的 view 推出來，不必改協定**。湯進鍋後 `busyUntil = now + OVERCOOK_MS (5000)`，但 `buildView` 算進度時用的分母是 `COOK_MS (3000)`（L277–278）。所以狀態是 `soup` 時，前 2 秒 `progress = 0`，最後 3 秒 `progress` 從 0 走到 1。美術就依此畫：`soup` 且 `progress = 0` 顯示「煮好」（綠勾）；`soup` 且 `0 < progress < 1` 顯示「快焦」（紅環，填充量等於 progress）。這是現有算式的副作用，必須新增單測把它釘住，見待裁決 #6。另外，oc 的 `updateSteam` 把 `progress < 1` 一律當成煮中，所以湯煮好以後還會繼續冒白蒸氣，新做法要分成蒸氣和焦煙兩種狀態。

## 2. 三套變體比較

| | A · Toy Kitchen 玩具廚房 | B · Bistro 溫暖木質餐館 | C · Candy Glaze 亮面糖果廚房 |
|---|---|---|---|
| 語彙 | **跟炸彈超人 A 同一套**：Q 版圓角厚塊、兩階卡通明暗、深紫描邊 `#2B2440`、奶油色 HUD 卡 | 暖燈、木地板、銅鍋、屠夫木檯面；不描邊，用柔和漸層加烘焙 AO | 跟糖果消消樂 A 同一調：硬糖鏡面、強高光加白色硬點、檯面邊緣有糖霜滴落 |
| 角色 | bomber 的頭盔臉加白色廚師帽和圍裙（同一批角色換了工作服） | 膚色臉、八字鬍、高廚師帽、白廚師服，玩家色做成領巾和圍裙 | 果凍豆膠囊身體，大眼睛 |
| 地面／檯面 | 奶油色棋盤磚；檯面是白鋼頂配灰藍櫃門 | 胡桃木地板；楓木檯面配胡桃木櫃 | 粉紫果凍磚；薄荷色檯面配糖霜邊 |
| **玩家 4 色辨識度** | ✅ 背景色少、中性，4 色最跳 | ✅ 顏色只在領巾和圍裙上，面積小，但暖色背景上仍然分得清 | ⚠️ P1 粉紅和粉紫地磚、粉紅食材箱同一色系 |
| **工作站與食材辨識度** | ✅ 描邊加高對比，5 種站點一眼就能分 | ⚠️ 木箱、砧板、檯面、地板全是木色系，要靠明度差和銅色撐起層次 | ⚠️ 紅色鍋和肉、粉紅箱子擠在同一色域 |
| **快焦警示的醒目度** | ✅ 紅環加黑煙壓在白鋼檯面上 | ✅ 紅環壓在暖色上，稍弱 | ⚠️ 粉紅系背景會稀釋紅色警示 |
| 跟站內其他遊戲的一致性 | ✅ 跟 bomber 是同一個系列 | 自成一格 | ✅ 跟糖果頁同調 |
| 能重用多少 bomberFx | ✅ 最多：ramp、描邊、陰影、Glow、Pipeline、檔位、thin instance、特效曲線、React HUD 樣式全部沿用 | 中：陰影、Pipeline、檔位、thin instance 能用；要另做木紋貼圖和 SpotLight | 少：要 PBR（clearCoat）、HDR 環境貼圖、全場 Glow |
| vendor-babylon 增量（估） | ≈ 0 KB（bomber 已經把這些功能帶進來了） | +3–6 KB（SpotLight） | +60–90 KB（PBR、clearCoat、環境貼圖 loader），另加約 300 KB 的 `.env` 素材 |
| Web 效能 | ✅ 跟 bomber 同級 | ✅ 中 | ⚠️ 最吃 |
| 精緻度上限 | 高 | 高（氣氛最好） | 最高，但最容易雜亂 |

## 3. 推薦：A · Toy Kitchen 玩具廚房

1. **可讀性是合作搶單遊戲的第一要件。** 玩家每一秒都在判斷：「哪鍋快焦了、誰手上拿什麼、哪張單快過期」。A 用描邊加中性的奶油和白鋼底色，4 色玩家、紅色警示、綠色完成三種訊號都壓得住。B 的木色系層次偏平；C 的粉色系會把 P1 和警示紅吃掉。
2. **成本最低。** bomber 剛把卡通 ramp（`toon.ts`）、描邊、陰影、GlowLayer、DefaultRenderingPipeline、檔位降級（`quality.ts`／`look.ts`）、thin instance（`thin.ts`）和 React HUD 通道做好並合併。A 可以把它們抽成共用模組直接用（見 §6），**vendor-babylon 幾乎不增加**。
3. **同系列感。** 同一種角色換上廚師裝，同一種卡片 HUD、同一套字體（Fredoka 加站內中文字型），`/battle` 裡四款遊戲至少有兩款看起來是同一家做的。
4. **可以借用 B、C 的長處。** A 的鍋內湯面和碗的高光借 C 的白色硬點（只用在小物件）；出餐口背後的暖光借 B 的光池（一張 emissive plane 就夠，不用加 SpotLight）。

> 如果使用者更重視「餐館氣氛」，可以選 B。這時要先補一條明度規則：地板 ≤ L 45%、檯面 ≥ L 75%，稿子已經照這個調過。另外木箱要加燒印標籤、砧板改淺色楓木，跟檯面拉開距離。C 不建議，理由同 bomber spec 的 C 案（色域撞在一起），而且只有 C 需要 PBR 和環境貼圖。

## 4. A 方案：配色與角色

**固定 4 色**：直接 import `bomberFx/palette.ts` 的 `PLAYER_PALETTE`（抽成共用後改從 `@/babylon/fx/palette` 取，見 §6），不要再定義一份。

| 序 | 名稱 | 亮 | 本色 | 暗 |
|---|---|---|---|---|
| P1 | 紅 | `#FF8A94` | `#FF3B4E` | `#B3122A` |
| P2 | 藍 | `#8CC4FF` | `#2F86FF` | `#1446B8` |
| P3 | 綠 | `#93F0A8` | `#2FCF5E` | `#138A3A` |
| P4 | 黃 | `#FFF0A0` | `#FFC21A` | `#C27D00` |

- **配色規則**：`colorIndex` 等於玩家在 `ctx.players` 裡的序號，跟 `respawn()` 取出生點的 `findIndex` 用同一個序（oc L421）。拿掉 `colorFor` 的 hash 算法。各端的 `ctx.players` 順序是否一致要先確認，見待裁決 #7。
- **角色**：沿用 bomber 的 `avatar.ts` 做法（身體、頭、臉、眼睛、四肢合併成一個頂點色 mesh，四肢用 `rig.ts` 改寫頂點），只換頭飾和服裝：
  - 拿掉天線，換成**白色廚師帽**：帽圈用圓角盒 0.5×0.14×0.5；帽頂用 3 顆 Sphere（直徑 0.30／0.32／0.30）排成一排，顏色 `#FFFFFF`，暗面 `#C9C3DA`。
  - 身體前面加一片**白色圍裙**：圓角盒 0.36×0.3×0.04，貼在身體前面 z +0.23，上面有一個本色口袋。
  - 手套維持白色 Sphere。臉 `#FFF1E0`，眼睛 `#2B2440` 加白色光點（照 bomber）。褲子 `#3A3556`。
- **「你」標記**：沿用 bomber 的 billboard 標籤（`AvatarKit.labelMat`）。
- **手持物**：從頭上 y = 1.9 移到**胸前雙手之間**，位置是 y ≈ 1.0，沿面向往前 0.45。兩隻手套往內收、抬到物品兩側（稿子上 P2、P4 的姿勢）。這樣誰拿著什麼一看就懂，也不會被頭上的「你」標記擋住。
- **切菜動作**：玩家站在砧板旁、而且砧板正在加工時，把右手擺動改成上下砍（`rig.ts` 的手臂範圍換成 X 軸 ±0.9、4Hz），身旁加一道白色刀光弧 billboard（見 §8）。
- **俯角補償**：左右兩排的玩家也會有 bomber 遇過的「邊角側躺」問題，直接套 `upright.ts`。

## 5. A 方案：物件程式建模

尺寸以 `CELL = 2` 為準。檯面高 0.6 CELL（沿用 oc 現值 `CELL * 0.6`）。

| 物件 | 建議做法 | 規格重點 |
|---|---|---|
| 地面 | **1 個 ground mesh**，套程式棋盤貼圖（DynamicTexture，每格 2×2 px、NEAREST），比照 bomber 的 `createGroundTexture` | A 格 `#F6E7C8`、B 格 `#EAD5AC`、磚縫 `#D9C08E` 取 50% 透明度；靠牆一圈烘 12px AO（黑色，40%→0） |
| 背牆／側牆 | 背牆 1 個 Box 加磁磚貼圖（程式畫 20×12 的磁磚與縫），側牆 2 個 Box | 磁磚 `#A9E0CF`、縫 `#8FCDB9`、牆帽 `#B3A4C9`／`#6F6490`（跟 bomber 外框牆同色，系列感） |
| 檯面 | 外圈 28 格一般檯面用**一組 thin instance**。圓角盒（倒角 2 段）的頂面和正面走 UV 圖集，櫃門和把手畫在正面貼圖上，不另建 mesh | 頂 `#E3E6EF`，頂緣亮邊 `#F1F3F8`，側面 `#9BA1B8`→`#767C95`，櫃門 `#C4C8D6`，把手 `#5D627A`，縫 `#C4C8D6` |
| 食材箱 ×2 | 圓角木箱（沿用 bomber 的 `crateData('soft')` 箱形），加一個開口內襯，上面疊 5 顆食材的縮小模型（跟 item 同一批 mesh，用 thin instance），正面貼一個白色圓標，標上食材圖 | 木 `#F7C677`／`#DC9A48`、板縫 `#8F561D`、內襯 `#6B4A2A`；兩個箱子只差裡面的食材和圓標 |
| 砧板 ×2 | 圓角扁盒 0.7×0.08×0.5（倒角 1 段），加刀（刀身扁盒 `#DDE3EE`、刀柄 `#FF6B3D`），合併成一個 mesh | 板 `#F2C98A`／`#C98E48`，右上角有掛孔 |
| 爐台加鍋 ×2 | 爐台是深色圓角盒 `#2B2440`，爐圈用 Torus（開火時 emissive `#FF5A4E`，進 Glow 白名單）；鍋是 Cylinder 做鍋身和鍋緣，加兩個把手；湯面是一片圓盤，換色表示內容物 | 鍋 `#5B6285`／`#3A3F5C`，鍋緣 `#8A93B8`；湯面：蔬菜 `#9BD65A`、肉 `#EE8A3A`、焦 `#2E2424` 加 2 顆 ember 點 |
| 出餐口 | 黃色圓角台（`#FFCF3F`），上面有瀝架條紋和 `>>` 箭頭（貼圖），加一個金色服務鈴（半球加鈕，合併 mesh）；背牆對應位置開一扇**暖光窗**（emissive plane）和紅色「出餐」牌（DynamicTexture） | 鈴 `#FFD23F`／`#C28A00`；窗是 `#FFE9B0`→`#FFB84A` 的漸層 |
| 盤架 | (6,0) 疊 3 個白盤子當裝飾（純外觀，沒有邏輯） | 盤 `#F4F6FA`，緣 `#C4C8D6` |
| 食材：蔬菜 | 生：高麗菜（Sphere 加兩片外葉扁 Sphere，葉脈畫在頂點色貼圖上）。切好：4 片圓角扁盒葉片 | `#6FCF3F`／亮 `#B6F07A`／暗 `#3E9A2A` |
| 食材：肉 | 生：牛排（擠出成形的扁平塊，或 2 個扁 Sphere 合併），加一條白色脂肪邊和一小截骨頭。切好：4 顆圓角小方塊，頂面淡色 | `#E8525E`／`#FF9A9A`／`#A62C3A`，脂肪 `#FFE9DE`，骨 `#FFF6E8` |
| 煮好（湯） | 白碗（Lathe 或 Cylinder 收底）加湯面圓盤，上面點綴 3 塊食材碎片 | 碗 `#F1F3F8`，暗面 `#B9BFD3`；湯色同上表 |
| 焦掉 | 同一個碗，裡面放一塊焦炭（變形 Sphere 加橘色裂縫頂點色），碗上常駐一縷小黑煙 | 焦 `#2E2424`，裂縫 `#FF6A2A` |
| 成品外觀 | 蔬菜湯、肉湯、蔬菜肉湯是碗加不同湯色和碎片；烤肉拼盤是盤子加肉塊加菜葉 | 只在「端著走」和 HUD 上看得到，見待裁決 #4 |
| 物品 mesh 管理 | **每種 `kind × ing` 各一個合併 mesh，用 thin instance**（共 8 種：生／切／湯／焦 × 蔬／肉）。站點上、手上的物品都是其中一筆 matrix；換狀態時把那一筆從 A 群組搬到 B 群組（`ThinSlots` 的 swap-remove） | 取代 oc 現在的 29 個 slot 方塊、4 個 hand 方塊，以及 8 份 `itemMats` |

## 6. 材質光影：重用 bomberFx，抽成共用模組

**結論**：技術上 overcooked 可以直接 import `bomberFx/*`，但 `look.ts`／`quality.ts` 寫死了 `'[bomber]'` log 前綴和 `bomberTier`／`bomberNoDegrade` 網址參數，`look.ts` 還直接讀 `TOY.outline`。建議**先抽一層 `src/babylon/fx/`**，bomber 只改 import 路徑，行為不變。

| 動作 | 檔案 | 內容 |
|---|---|---|
| 搬移（不改內容） | `bomberFx/toon.ts` → `fx/toon.ts` | MaterialPlugin ramp 本身是通用的。plugin 名稱 `BomberToon` 和 define `BOMBER_TOON` 可以留著，或改成 `ToonRamp`，只影響 shader 快取鍵 |
| 搬移 | `geometry.ts`、`thin.ts`、`thinSlots.ts`、`burstQueue.ts`、`perfLog.ts`、`rig.ts`、`upright.ts`（連同各自的 `*.test.ts`） | 純工具，不依賴 bomber 的資料 |
| 參數化 | `quality.ts` → `fx/quality.ts` | `pickTier`／`noDegradeFlag` 多收一個 `key` 參數（`'bomber'`／`'kitchen'`），網址參數變成 `${key}Tier`、`${key}NoDegrade`。bomber 傳 `'bomber'`，行為不變 |
| 參數化 | `look.ts` → `fx/look.ts` | `ToyLook` 的 `LookOptions` 加 `tag`（log 前綴）和 `outline`（描邊色）；其餘（雙光、陰影、Glow 白名單、Pipeline、UI 相機、自動降級）照舊 |
| 拆出通用部分 | `fxCurves.ts` | `backOut`、`ringPose`、`floatTextPose`、`itemHop`、`pickupFlight` 搬到 `fx/curves.ts`；`armDelayMs`、`flameEmissive`、`deathPose`、`scorchScale` 留在 bomberFx |
| 拆出通用部分 | `models.ts` | `rgba`、`sphere`、`cylinder`、`solid`、`radial`、`at`、`toMesh` 搬到 `fx/models.ts`；`pillarData`／`crateData` 留下。kitchen 的木箱要用 `crateData('soft')`，就從 bomberFx import，或順手一起搬 |
| 參數化 | `avatar.ts` | `bodyData` 多收一個 `headgear(pal) => MeshData[]` 和 `outfit(pal) => MeshData[]`，bomber 傳天線，kitchen 傳廚師帽加圍裙；`AvatarKit` 的 `antennaMat` 改成可選 |
| 保持原位 | `palette.ts` | `PLAYER_PALETTE` 和 `hexToRgb` 搬到 `fx/palette.ts`，`TOY`、`ITEM_COLORS` 留在 bomberFx；kitchen 另建 `kitchenFx/palette.ts` 放 §5 的色票 |
| 新增 | `src/babylon/games/kitchenFx/`（`palette.ts`、`textures.ts`、`models.ts`、`chef.ts`、`board.ts`、`effects.ts`、`hudModel.ts`） | 比照 bomberFx 的分法；純函式（`hudModel`、快焦判定、進度外插）要附 `*.test.ts` |
| 改寫 | `src/babylon/games/overcooked.ts` | 換掉 L147–223 的角色、L333–370 的站點底座、L525–549 的手持物、L615–853 的裝飾、粒子與浮字；HUD 改走 `setHud`（§9）；網路、`applyUse`、`tickKitchen` 不動 |
| 不改 | `babylonCore.ts` | 陰影、Glow、描邊、Pipeline 的副作用 import 在 bomber 時已經補齊，A 案**不必再加** |

**光影規格（沿用 bomber §7，只調兩處）**：
- 雙光、ShadowGenerator（桌機 1024 PCF，手機 512）、GlowLayer（`includeOnly`）、DefaultRenderingPipeline（FXAA、ACES、exposure 1.05、contrast 1.08，桌機 bloom）全部照舊。
- 投影物件**只登記玩家和手持物**。檯面和站點的接地陰影烘進地面貼圖（跟 bomber 的牆、箱子同樣處理）。
- Glow 白名單：開火的爐圈、快焦的鍋緣（紅色脈動）、出餐鈴閃光、出餐窗暖光。
- `shadowRadius` 取廚房半對角線加上餘裕：`hypot(11, 7) × CELL / 2 + 2 ≈ 15`。
- 描邊（`renderOutline` 0.02、`#2B2440`）套在玩家、手持物、站點上的物品和站點本體上；地面、牆、一般檯面不描（檯面的輪廓靠貼圖上的邊線）。

## 7. 特效

事件一律從前後兩次 view 的差異觸發（跟 oc 現在的 `diffViewAudio` 同一個機制），host 和 guest 看到的一樣。粒子貼圖重用 bomber 的 `public/battle/bomber/fx_*.webp`（spec 待裁決 #9：搬到共用目錄，或直接引用原路徑）。

| 事件 | 做法（A） | 時長 |
|---|---|---|
| 切菜中 | 玩家砍的動作（§4），每砍一下（250ms）砧板往下壓到 0.95 再彈回來，噴 2–3 片食材碎片（蔬菜用 `#B6F07A`、肉用 `#FFE9DE`，重力拋射）；砧板上方有 billboard 進度條（綠色，寬 0.8 CELL） | 跟 CHOP 1.5 秒同步 |
| 切好 | 進度條換成綠色圓形勾選章（`backOut` 從 0 彈到 1），砧板上的物品換成切好的 mesh | 200ms |
| 煮中 | 爐圈 emissive 開啟，爐圈周圍 7 個小火苗 billboard 抖動；白色蒸氣（`fx_smoke` 染白，emitRate 12）；鍋上方有綠色進度環 | 跟 COOK 3 秒同步 |
| 煮好 | 湯面冒一陣大蒸氣，進度環換成綠勾，播 `cook_done` | 300ms |
| **快焦**（`soup` 且 progress > 0） | 進度環變紅，填充量等於 progress；鍋緣 emissive 紅色脈動，頻率從 2Hz 升到 6Hz；「!」警示章跟著脈動縮放；白蒸氣改成灰黑煙，emitRate 從 4 升到 20 | 最後 3 秒 |
| 焦了 | 一陣黑煙加 6 顆 ember 火花往上噴，湯面換成焦炭色，播 `burnt`；之後鍋上常駐細黑煙，直到有人把焦的東西拿走 | 500ms，之後常駐 |
| 拾取／放下 | 物品沿弧線飛到手上或檯面上（`pickupFlight`），落點冒一圈小白環（`ringPose`） | 180ms |
| 出餐 | 出餐口噴一陣金色星星（`fx_star`，12 顆）；鈴鐺壓縮後回彈；「+20」浮字改用 bomber 的 `+1` 做法（一張共用 DynamicTexture，不要每次新建，修掉 oc L834–853 的洩漏風險）；HUD 上對應的訂單卡打勾後飛出 | 600ms |
| 新訂單 | HUD 卡片從左邊滑進來（CSS `translateX` 加 back-out），播 `order_new` | 350ms |
| **訂單逾時** | 剩 25% 時 HUD 卡片換紅框，並以 4Hz 左右抖動（`prefers-reduced-motion` 時只換紅框不抖）；逾時那一刻卡片往下掉並淡出，冒一個紅色「-10」，播 `order_fail`；3D 場景不做效果（避免干擾操作） | 400ms |
| 開局倒數／結算 | 3/2/1/GO! 沿用 bomber 改色後的倒數；結算改成 React 覆蓋層（`setOverlay` 已經有了），顯示團隊分數、出餐數，加 1–3 顆星（門檻見待裁決 #8） | — |

**guest 端的平滑處理**：快照只有 8Hz，進度條和進度環要在本地外插：`progress += dt / CHOP_MS`（或 `COOK_MS`），收到下一張快照再校正，否則動畫會一頓一頓的。這個外插寫成純函式加單測。

## 8. HUD 改走 React

版面見 `variant-A-gameplay.webp`。960×540 基準下：左上是訂單列（3 張卡，每張 150×74，間距 10）；右上是計時加分數膠囊（210×48）；左側是 4 張玩家卡（120×56，間距 10）；右側是食譜（128 寬，可以收合）。

- **資料通道**：目前的 `GameHud`（`src/babylon/types.ts` L47）是 bomber 專用的形狀，`BabylonCanvas` 收到就直接渲染 `BomberHud`。kitchen 需要另一種形狀，建議做成有 `kind` 標記的聯集，**舊欄位一個都不改**：
  ```ts
  interface KitchenHud {
    kind: 'kitchen'
    remainSec: number                 // 量化到整秒
    score: number
    delivered: number
    orders: { recipeId: string; ing: 'v' | 'm'; remainMs: number }[]   // remainMs 量化到 100ms；最多 3 張
    players: { id: string; name: string; colorIndex: 0 | 1 | 2 | 3; isSelf: boolean; held: { ing: 'v' | 'm'; kind: 'raw' | 'chop' | 'soup' | 'burnt' } | null }[]
  }
  setHud?: (hud: GameHud | KitchenHud | null) => void   // 沒有 kind 的一律當 bomber
  ```
  這動到共用契約，見待裁決 #3。食譜是靜態資料，React 端直接 import `overcookedKitchen.ts` 的 `RECIPES`（純模組），不經過通道傳。
- **訂單卡**：`bg-[#fff6e3] border-[2.5px] border-[#2b2440] rounded-[14px] shadow-[0_4px_0_rgba(0,0,0,.4)]`（跟 bomber 玩家卡同一套 token）。左邊是 48px 的圓形餐點底（`#F3E6CB`），裡面畫成品（inline SVG，照特寫表畫）；右邊是菜名（站內中文字型 900、13px）和步驟圖示列（食材小圖 › lucide `slice` › `cooking-pot`，拼盤多一個 › `hand-platter`）；底部是計時條（高 9px，綠 `#2FCF5E` > 50%、黃 `#FFC21A` 25–50%、紅 `#FF3B4E` < 25%）加秒數（Fredoka 700、12px）；右上角是分數徽章（`#FFCF3F`，深紫描邊）。剩 < 25% 時整張卡換紅框 `border-[#FF3B4E]`、外發光、抖動，左上掛 `triangle-alert` 圖示。自訂 class 一律加 `.kitchen-` 前綴並用 `@apply` 寫。
- **計時加分數**：鬧鐘圖示（`#FF3B4E`）、剩餘時間（Fredoka 700、30px，`m:ss`）、分隔線、`coins` 圖示、分數（Fredoka 22px）、「出餐 N」（9px）。最後 15 秒時間變紅並跳動。
- **玩家卡**：左側 44px 色塊（亮色到本色的漸層，深紫描邊），裡面是廚師頭像（inline SVG，同 `BomberAvatar` 的做法再加廚師帽）；右邊是名字（12px 900）、`P#`（Fredoka、本色暗階）、**手持物槽**（34px 圓，空手時是淡色 `hand` 圖示）；自己的卡掛「你」標籤。
- **食譜**：`book-open` 標題加 4 列（成品小圖、菜名、分數、步驟列）。預設**展開**；按 `R` 或點標題收合成一顆 44px 的圓鈕。分數欄照待裁決 #5 的結果顯示實際得分。
- **手機（`max-height: 500px`）**：訂單卡縮成 3 顆 64×40 的膠囊（成品圖加計時條）；計時膠囊縮到 140 寬；玩家卡隱藏，只在自己頭上顯示手持物泡泡（3D billboard）；食譜固定收合。
- **移除**：oc L376–379 的 4 塊 `createTextPanel`，以及 L556–603 的面板繪製。倒數改用 bomber 的新配色：`hud.ts` 的 `createCountdownPanel` 已經收 `opts.theme`，把 `bomber.ts` L174 的 `COUNTDOWN_THEME` 搬到 `fx/` 共用後傳進去即可，`hud.ts` 不用改。

## 9. 效能預算

| 項目 | 現況（估） | 目標：桌機 | 目標：手機（降級） |
|---|---|---|---|
| draw calls | ≈ 140–160（地磚 45、底座 32、站點裝飾約 20、角色 28、牆和踢腳 8、指示方塊和手持物最多 33、文字面板 4） | **≤ 90** | ≤ 60 |
| 地面 | 1 張 ground 加 45 塊 Box | 1 個 mesh | 同左 |
| 檯面 | 32 個 Box | 1 組 thin instance（28 格）＋站點各 1 組（食材箱、砧板、爐台加鍋、出餐口，共 4 組） | 同左 |
| 物品 | 29 個 slot 方塊加 4 個 hand 方塊 | 8 組 thin instance（kind × ing） | 同左 |
| 角色 | 7 mesh × 4 人 | 1 個合併 mesh × 4 人，加標籤 | 同左 |
| 陰影 | 無 | 1024 PCF，只給玩家和手持物投影 | 512，或改用 blob 陰影 |
| Glow／描邊／bloom | 無 | 開 | 關 |
| 粒子 | 3 組，1×1 白點 | 5 組（蒸氣、焦煙、碎片、星星、ember），每組上限 150 | 上限 60 |
| 貼圖 | 無 | 程式產生的 DynamicTexture（地面、牆磚、檯面圖集、標籤）＋重用 bomber 的 `fx_*.webp`；**不新增圖檔** | 同左 |
| vendor-babylon gzip | 448 KB（`docs/assets` 實測，已含 bomber 的功能） | **增量 ≤ 10 KB**（A 案理論上是 0） | 同左 |
| 遊戲程式（index chunk，overcooked 是靜態 import） | — | 增量 ≤ 25 KB gzip（kitchenFx 加 HUD 元件）；抽出共用模組後 bomber 和 kitchen 不會重複打包 | 同左 |
| 解析度 | 預設 | `hardwareScalingLevel = 1 / min(dpr, 2)` | 固定 1.5 |

降級判定和自動降級沿用 `fx/quality.ts`：觸控裝置或 `hardwareConcurrency <= 4` 走手機檔，連續 60 幀平均 < 45fps 時依序關掉描邊、Glow、陰影。量測也沿用 bomber：每 2 秒印一次 `console.info('[kitchen] drawCalls=<N> fps=<N>')`，網址用 `?kitchenTier=desktop|mobile`、`?kitchenNoDegrade=1`。

## 10. 待裁決

1. **選哪一套**：推薦 A（可讀性最好、重用最多、跟 bomber 同系列）；B（氣氛最好，但木色系要靠明度規則撐起層次）；C（不建議）。
2. **抽共用模組**：要不要先把 bomberFx 的通用部分抽到 `src/babylon/fx/`（§6 表格）？抽的話會動到 bomber 的 import 和 `*.test.ts` 的位置（bomber 的行為不變，測試照跑）；不抽的話 overcooked 直接 import `bomberFx/*`，但 log 前綴和網址參數會是 `bomber`。
3. **HUD 通道**：採用 §8 的 `KitchenHud`（有 `kind` 標記的聯集，沒有 `kind` 的當 bomber），還是另開一條 `setKitchenHud`？兩者都動到 `src/babylon/types.ts` 的共用契約，由 netcore 或 babylon-hud 擁有。
4. **盤子**：只做外觀（端湯時畫碗，HUD 上的成品圖是盤或碗），還是做成真的可拿取物件（「取盤、盛湯、出餐」多一步）？後者要改 `overcookedKitchen.ts` 和快照協定，屬於玩法變更，建議另開任務。
5. **食譜名實不符**：`combine` 沒實作，出餐只比食材，得分固定 20。三個選項：(a) HUD 照實顯示，只保留「蔬菜湯」「肉湯」兩道菜，或者 4 道菜都顯示 +20；(b) 美術任務外另開任務實作 combine 和各菜分數；(c) 維持現狀（HUD 顯示的 40／35 跟實際不符）。**建議 (a) 或 (b)，不要 (c)**。
6. **快焦判定依賴 `buildView` 的分母**：美術直接用「`soup` 且 progress > 0」當快焦（不改協定），但要新增 `overcookedKitchen.test.ts`（目前沒有這個檔），用一條單測把這個語意釘住；另一個做法是在 view 加 `burnAt` 欄位（改協定）。建議前者。
7. **固定 4 色的序號來源**：確認各端 `ctx.players` 的順序一致（bomber 用的是 `entities()` 名冊；overcooked 沒有 AI，可以直接用 `ctx.players`）。不一致的話，要改由 host 在快照裡帶 `colorIndex`。
8. **結算星數門檻**：例如 ≥ 60／120／200 分給 1／2／3 顆星，要不要做？數值由誰定？
9. **粒子貼圖的位置**：重用 `public/battle/bomber/fx_*.webp` 的原路徑（最省事），還是搬到 `public/battle/common/`（要改 bomber 的 `bomberAssetUrl`）？
10. **相機**：稿子的 3/4 構圖是示意。沿用 bomber「相機不調」的決定，只套 `upright.ts` 補償邊角角色；如果 qa 截圖發現左右兩排的站點太扁，再另外裁決 β。
11. **bundle 上限**：建議 vendor-babylon gzip 增量 ≤ 10 KB、index chunk 增量 ≤ 25 KB，超過就要回報。

## 11. 建議分工（給領導）

1. **babylon**（L 檔，第 1 波）：抽出 `src/babylon/fx/`（如果 #2 通過），bomber 只改 import，全部測試保持綠；建 kitchenFx 的幾何、配色和 thin instance，固定 4 色、廚師角色、手持物移到胸前；接光影。
2. **babylon-hud**（第 1 波並行）：落 `KitchenHud` 型別與 `BabylonCanvas` 的分流（如果 #3 通過）；做訂單卡、計時膠囊、玩家卡、食譜，以及手機版面；先用假資料自查。
3. **babylon**（第 2 波）：§7 全部特效、guest 端外插、快焦判定加單測，overcooked 改走 `setHud`、移除 3D 面板。
4. **qa**：`shot.mjs --contexts 2` 截 1920×1080、960×540、844×390，對照 `variant-A-*`；量 draw call 和 fps；確認 bomber 零回歸（截圖並排比對）。
5. **不需要 assets／it**：A 案不新增圖檔，也不新增依賴。
