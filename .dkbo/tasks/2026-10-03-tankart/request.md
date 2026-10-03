# 坦克美術優化＋可玩度（A Toy Army）

## 需求原文
規劃一下 多人遊戲 > 坦克 美術方面操照 炸彈超人 跟 糖果 以及廚房快手，並且讓遊戲可玩度更精緻

（2026-10-03 使用者對下列規劃與七項建議回「ok」，全數採建議。）

## 現況（src/babylon/games/tank.ts，942 行）
- 美術：方塊／圓柱拼車、牆與木箱為方塊、純色 StandardMaterial，無陰影／描邊／Glow／後製。
- HUD：3D `createTextPanel`；顏色 `colorFor` hash（各 client 可能不同）。
- 玩法：3 HP、直線子彈、道具 hp／speed／rapid、木箱 50% 掉寶、最後存活者勝；無 AI，單人空洞。

## 目標
與炸彈超人（A Toy Box）、廚房快手（A Toy Kitchen）同系列「A Toy Army 玩具坦克」全面美化，並提升可玩度。

### 美術（重用 src/babylon/fx/）
- 依 `ctx.players` 序號固定 4 色（`PLAYER_PALETTE`），程式建模 Q 版玩具坦克（圓角車身、履帶、砲塔、旗子），頭上「你」標記。
- 牆＝積木 thin instance；可破箱沿用 bomber 木箱語彙；地面程式棋盤／玩具地毯貼圖。
- 卡通 ramp、描邊、雙光、陰影、Glow 白名單、Pipeline；`?tankTier`／`?tankNoDegrade` 檔位與自動降級、`[tank]` perf log。
- 參照糖果：只借 juice（開砲後座、擠壓回彈、命中彈出、連殺字卡），不借色域。
- 特效：砲口焰、子彈拖尾、命中火花、受擊閃白＋微震、爆炸（煙／碎片／殘骸）、履帶痕與揚塵、道具浮動發光。
- HUD 走 React：`setHud` 聯集加 `kind: 'tank'`（玩家卡 HP 格、擊殺、buff 倒數、存活數、計時）。

### 可玩度（使用者已同意）
1. 子彈撞牆反彈 1 次（host 裁決，純函式＋單測）— 做
2. 受擊短暫無敵＋擊退 — 做
3. 新道具：護盾、三連發（`ITEM_KINDS` 與封包驗證同步擴）— 做；彈跳彈不做
4. 縮圈／突然死亡（比照 bomber）— 做
5. 單人 AI bot（比照 `bomberAI.ts`）— 做
6. best-of-3 回合制 — 不做，維持一局決勝
7. 手機觸控：檢查 `src/pages/Battle/TouchControls.tsx` 能否瞄準砲塔，不足再補 — 做

## 不動
`src/core/**`、`src/babylon/net/**`、`src/babylon/hud.ts`、相機；其他三款零回歸；不加依賴、不新增圖檔（貼圖程式產生，粒子可重用 `public/battle/bomber/fx_*.webp`）。玩法改動限於 tank 自身訊息與數值（`tank.ts`／`tankNet.ts`）。

## 波次草案
0. designer 方向稿 A/B/C（spec.md＋mockup），使用者選定後再定 brief。
1. 玩法規則抽純函式＋測試（反彈、無敵、新道具、縮圈）、AI bot、React `TankHud`；qa 驗玩法與零回歸。
2. 場景、角色、材質光影、檔位降級；qa 對稿。
3. 特效、HUD 接線、bundle 量測；qa 全項（多人：Firestore 已改回 (default)，應可實測）。
碰 `tankNet` 的波難度標 L。

---
## 對話原文（逐字）
**使用者 2026-10-03**
> 規劃一下 多人遊戲 > 坦克 美術方面操照 炸彈超人 跟 糖果 以及廚房快手，並且讓遊戲可玩度更精緻

**領導列給使用者的可玩度建議**
> | # | 項目 | 建議 |
> |---|---|---|
> | 1 | 子彈撞牆反彈 1 次 | 做。走位與角度變有意義，host 裁決、純函式可單測 |
> | 2 | 受擊短暫無敵＋擊退 | 做 |
> | 3 | 新道具：護盾、三連發、彈跳彈 | 做前兩種，`ITEM_KINDS` 與封包驗證要一起擴 |
> | 4 | 縮圈／突然死亡（比照炸彈超人） | 做，解決最後兩台互躲拖台 |
> | 5 | 單人 AI bot（比照 `bomberAI.ts`） | 做，單人可玩度提升最多 |
> | 6 | 改成 best-of-3 回合制 | 先不做，維持一局決勝 |
> | 7 | 手機觸控 | 檢查 `TouchControls.tsx` 能不能瞄砲塔，不足再補 |
>
> 執行順序第 1 步：先派 designer 出方向稿 A/B/C（spec.md＋mockup），你選定後再寫 brief。

**使用者**
> ok

（之後使用者叫 `/dkbo-plan`。）
