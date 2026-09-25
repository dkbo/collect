交代：炸彈超人（Babylon.js 3D，src/babylon/games/bomber.ts／bomberMap.ts，/battle 的 bomber）美術優化的『方向稿』，不改任何程式、不起 dev server（/battle 的 port 與 Firebase 房正被 babylonslim 任務占用）。現況：角色、炸彈、磚塊、地面全用 MeshBuilder 拼的方塊與球配 StandardMaterial 單色，13×11 格地圖，爆炸用 ParticleSystem；現況外觀看 public/game-covers/bomber.webp，並讀 bomber.ts（建角色 ~L320–380、材質、粒子、HUD）與 src/babylon/hud.ts 取得所有物件種類（玩家 4 色、AI、炸彈、火焰、可破磚、不可破牆、道具種類、地面、HUD 文字面板與倒數）。目標：跟糖果消消樂同等級的精緻度（糖果的 A 亮面經典稿在 .dkbo/tasks/2026-09-25-candyart/design/ 可參考品質與 spec 寫法）。使用者尚未指定風格，產出 3 套差異明顯的變體，建議涵蓋：Q 版卡通 3D（KayKit／Kenney 類低多邊形）、方塊像素體素風、亮面糖果風（與糖果消消樂同調）。每套：一張 16:9 對戰畫面 mockup（俯視 3/4 視角、同一盤面、4 位玩家、正在爆炸的一刻）、一張物件特寫表（角色 4 色、炸彈含引信、火焰、磚、牆、每種道具、地面格），並附色票與材質要點。再寫 spec.md：推薦哪套與理由；每類物件的建模做法（程式 MeshBuilder 組合 vs 外部 glTF 素材，列出候選免費授權素材包名稱與授權，但不下載）；材質（StandardMaterial／PBR／卡通 ramp＋renderOutline）；光影（ShadowGenerator、GlowLayer、DefaultRenderingPipeline 的 bloom／FXAA／tonemap）；爆炸與道具特效；HUD 樣式；Web 效能預算（draw call、陰影貼圖尺寸、手機降級）；以及 待裁決 清單。一律照角色檔用 pen interactive＋--preview-output，禁 --prompt/--tasks，匯出 webp。全部產出寫到主樹 .claude/.superpower/specs/bomber-redesign/（不要寫 docs/ 或 repo 根目錄）。完成 dk-msg leader "[DONE] <推薦變體＋產出路徑>"。
成員：chore-designer-1 (claude / M)
status: working
touched:
結果：
結果：完成。推薦 A · Toy Box 卡通玩具（可讀性最好＋CC0 素材現成＋效能居中；精緻感向 C 借鏡面高光）。
產出：.claude/.superpower/specs/bomber-redesign/
  - variant-{A,B,C}.pen（每份 2 frame：對戰畫面 960×540、物件特寫表 1200×1090）
  - variant-{A,B,C}-gameplay.webp（@2x）、variant-{A,B,C}-sheet.webp（@1.5x）
  - spec.md（現況盤點、三套比較、推薦、固定 4 色、建模／素材候選與授權、材質、光影後製、特效、HUD、效能預算、8 條待裁決、分工）
過程：pen interactive --out … --preview-output …（stdin 餵 execute），匯出用 Export() 與 pen --in --export --export-type webp；未用 --prompt/--tasks；未改程式、未起 dev server。
注意：`@babylonjs/loaders`／`gui`／`materials` 都不在相依；新功能要補在 babylonCore.ts（共用檔）；HUD 走 React 要擴 GameOverlay（共用介面）。

---
關閉：2026-09-25T14:06 done — 炸彈超人方向稿完成：推薦 A·Toy Box 卡通玩具（可讀性最佳、CC0 素材現成），三套 .pen/webp 與 spec.md（含 8 條待裁決）在 .claude/.superpower/specs/bomber-redesign/
