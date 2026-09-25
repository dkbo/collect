# 炸彈超人美術優化（A Toy Box） — 波 4 審查（reviewer 切片）
你是本波的 reviewer：只讀、不改碼、不跑會寫入的指令。意見只給領導（`dk-msg leader`），不直接對 dev 說。

## 要讀的
1. 差異包 /home/bal/project/collect/.dkbo/tasks/2026-09-25-bomberart/waves/4.diff（commit 清單、stat、-U10 diff；含未 commit 的工作樹）
2. 完整 brief /home/bal/project/collect/.dkbo/tasks/2026-09-25-bomberart/brief.md（驗收標準、共用契約、所有權）
3. 本波成員：babylon(M) babylon-hud(M) qa(M)

## 全域約束（全文，逐條當硬要求檢查）
- 路徑一律用 `@/*` 別名，不得用相對路徑引入。
- 自訂 CSS class 一律用 `@apply` 套 Tailwind；`src/index.css` 只准新增 `.bomber-*` 前綴的 class，不得修改既有 class。
- 圖片只收 WebP，不得把 JPG／PNG 寫進 `src/`、`public/`；PNG 等中間檔只准放自己的 scratchpad。
- 非同步請求與資料處理寫在 Zustand store action，元件只訂閱與調用。
- 不新增任何依賴：`package.json`、`pnpm-lock.yaml` 不改（不加 `@babylonjs/loaders`／`gui`／`materials`）。
- Babylon 一律經 `src/babylon/babylonCore.ts` 深層匯入（eslint 已禁整包匯入），不用 `.pure` 版本；新功能要在那裡補副作用 import。
- 不動多人同步協定：`src/core/**`、`src/babylon/net/**`、`src/babylon/games/bomberNet.ts`、`bomberAI.ts`、`bomberMap.ts` 只讀；`*.test.ts` 不得修改，全部保持綠。
- 遊戲規則與數值不變（格數、計時、突然死亡 40 秒、道具效果、爆炸 550ms 時序等）；相機 β、fov 不調（spec §7 的相機段不做）。
- 字型：HUD 數字用站內既有的 Fredoka（`public/fonts/Fredoka-Bold.woff2`）代替 spec 的 Lilita One；中文用站內字型代替 Noto Sans TC，不新增字型檔。
- spec §11 八條採以下裁定（關卡①使用者已確認，含②）：①選 A；②**角色與所有物件都用程式建模**（不引入 glTF，理由見 ruling）；③HUD 走 React，透過 `types.ts` 新增的可選 `setHud` 通道；④卡通材質以 StandardMaterial 的 MaterialPlugin 注入 ramp（波 2 裁定；原為 NodeMaterial／ShaderMaterial）；⑤可破磚統一箱形；⑥固定 4 色依出生角；⑦相機不調；⑧`vendor-babylon` gzip 增量 ≤ 250 KB。

- 所有圖像除 AC1 的素材外一律程式產生（DynamicTexture／幾何）：地面棋盤、焦痕 decal、落地 ring、硬磚裂痕、木箱 X 撐條、石柱磚縫、青苔、「你」標記、`AI` 小章、`+1`（billboard plane＋DynamicTexture，不用 Babylon GUI）；玩家卡頭像由 babylon-hud 依 `colorIndex` 以 CSS 或 inline SVG 畫。
- `src/babylon/hud.ts` 四款遊戲共用：只准新增可選參數或 bomber 專用函式，預設外觀與行為不變。

## 本任務累積的 Minor
（逐波審查不 triage 累積的 Minor；整枝評議才做）

上面每一條是先前各波放掉的風格／可讀性意見。逐條判：哪些**必須**在 merge 前修掉、
哪些可以留著。判定寫進報告的 `## Minor` 段開頭，一條一行。

## 報告寫到 /home/bal/project/collect/.dkbo/tasks/2026-09-25-bomberart/state/reviewer-a.report.md，格式固定
## 規格合規
（逐條驗收標準 ✅/❌，缺漏寫明）
## Important
（會出錯、違反 brief 或契約、越界改檔；每條附 file:line）
## Minor
（風格、可讀性；每條附 file:line）

## 完成
state 檔 `status: done`，然後 `dk-msg leader "[DONE] review 波 4: Important N 條，見 report"`。
