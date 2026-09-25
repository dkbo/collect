# candyart-react 報告（波 2）
## 做了什麼
- **AC9 頁首／工具列／載入畫面**（`index.tsx` + `src/index.css` 新增 `.candy-title`、`.candy-subtitle`、`.candy-tool-btn`、`.candy-loading*`）：h1 改 A 的粉色漸層（#ff7cc0→#ff4fa3→#e01f78）＋深粉落影；副標淺色 #7a1d52／深色 #d9ccff，文案不變，其中拉丁字（Godot 4、match-3、iframe、React、postMessage）套 Fredoka；「遊戲說明」鈕改成次要糖果鈕樣式（白底粉框、#c2185b 字、粉落影），拿掉 shadcn Button import；載入畫面改紫夜空放射漸層＋關卡牌樣式的粉色糖球（白邊）裝 Candy 圖示彈跳＋#ffe4f2「糖果消消樂載入中...」脈動，新增 `data-testid="candy-loading"`。原本的 `animate-fade-in` 在專案裡沒有定義（no-op，@apply 時 Tailwind 直接報錯），已拿掉。
- **Minor 1**：`hudLayout` 兩側縮放 < 0.6（`MIN_SIDE_SCALE`）時退回上方橫條。1024×768 全螢幕 k≈0.71 仍在兩側；非全螢幕 ~740×550 那種剛過 4:3 的情況改走橫條。
- **Minor 2**：3★ 刻度 left 改回 100%（圖示中心在軌道末端，半顆超出軌道，卡片內距容得下）。
- **Minor 3**：版面量測改 `useLayoutEffect`，首次繪製前就決定 side/top。
- **Minor 4**：TopBar 的上／左／右內距加 `env(safe-area-inset-*)`，與 HudButtons 橫條模式同基準。實測 320px 視窗時 `.rpg-screen` 只有 248px，原排法 LV＋步數球＋4 圓鈕需要 ~310px 會重疊 → 新增 `isCompactTopBar(width)`（<310）：精簡時步數球移到第二列開頭、圓鈕縮 32px／gap 4px；一般橫條圓鈕 gap 改 6px（`.candy-topbar-btns`）。`hud-moves` testid 仍只有一個元素。
- **Minor 5**：2★ 門檻改 `Math.floor(target*1.5)`，與 `level_manager.gd:39` `int(1.5*target)` 一致。
- **qa BUG-2（AC7 320 精簡橫條星級條被擠）**：根因是精簡模式第二列同時放步數球＋分數＋`flex-1` 軌道＋目標，248px 容器扣掉其他東西後軌道只剩 ~63px，三顆 20px 刻度星互相壓住（qa 量到的 0/29/39px 是填色 `hud-progress` 的寬，分數 0 時本就 0）。修法：compact 時星級條獨立成第三列吃滿寬度（`CandyHud.tsx` TopBar），第二列留步數球／分數／目標。橫條高 106→136px。
- **qa BUG（AC8 最後一關結算卡／說明卡超出 .rpg-screen）**：根因是 `.candy-mask` 不分版面都固定留 `pt-14`（56px）給圓鈕，兩側模式圓鈕在右緣根本不壓卡片，白吃 40px；卡片也沒有依可用高度縮放，最後一關（多一行金字）與說明卡在 550／450 高的畫面放不下。修法兩步（一次一件，各自重跑重現）：① `.rpg-screen` 加 `data-hud={mode}`，`.candy-mask` 在兩側模式改 `pt-4` → 1280 修好、390 仍溢出；② 新增 `FitDialog` 外框（`CandyOverlays.tsx`）＋純函式 `dialogFitScale(available, natural)`：可用高度（遮罩高－上下內距－緞帶外凸 32）放不下時卡片 `scale` 等比縮小、外框高度同步縮 → 390 也修好。`.candy-dialog` 的 mt-8／shrink-0／max-w 移到新的 `.candy-dialog-fit`。

## 測試
### 紅
`node_modules/.bin/vitest run src/pages/CandyCrush/candyHud.test.ts`
`× 兩側縮放低於 0.6（字太小）時也退回上方橫條 — Expected {mode:"top",scale:1} Received {mode:"side",scale:0.5231…}`；`× 1.5 倍非整數時無條件捨去 — expected 1502 to be 1501`（Tests 2 failed | 14 passed (16)）
BUG 重現（`bash /tmp/claude-1000/-home-bal-project-collect--worktrees-candyart/6f9e7f3f-2562-428a-b3d1-4b39e3d4f058/scratchpad/repro.sh`，跑 qa 的 probe.mjs result／overlay 於私有 port 5188）：1280 `last-level dialog.bottom 829 > screen.bottom 801`、`help 812 > 801`；390 `last-level 766 > 737`、`help 800 > 737`。
`vitest run candyHud.test.ts` → `× dialogFitScale … TypeError: dialogFitScale is not a function`（3 failed | 17 passed）
第二輪（橫條精簡）：`× 橫條寬度放不下…改精簡排法 — TypeError: isCompactTopBar is not a function`（Tests 1 failed | 16 passed (17)）
BUG-2 重現（`bash /tmp/claude-1000/-home-bal-project-collect--worktrees-candyart/6f9e7f3f-2562-428a-b3d1-4b39e3d4f058/scratchpad/repro2.sh` = qa probe `narrow`，320×640）：三顆刻度星 left 167／183／198（相距 15–16px，寬 20 → 重疊）。
### 綠
BUG-2 重跑 `bash /tmp/claude-1000/-home-bal-project-collect--worktrees-candyart/6f9e7f3f-2562-428a-b3d1-4b39e3d4f058/scratchpad/repro2.sh`：score 0／12345／99999 三顆星 left 皆 150／200／249（相距 50px），截圖 `/tmp/claude-1000/-home-bal-project-collect--worktrees-candyart/6f9e7f3f-2562-428a-b3d1-4b39e3d4f058/scratchpad/r/narrow-320-12345.png` 目視無重疊。
`node_modules/.bin/vitest run src/pages/CandyCrush/candyHud.test.ts` → `Tests 20 passed (20)`
BUG 重跑 `bash /tmp/claude-1000/-home-bal-project-collect--worktrees-candyart/6f9e7f3f-2562-428a-b3d1-4b39e3d4f058/scratchpad/repro.sh`：1280 勝 dialog 326–762、最後一關 306–784、說明 314–774（screen 251–801）；390 勝／敗／最後一關／說明 dialog 皆 376–720（screen 287–737）。截圖 `/tmp/claude-1000/-home-bal-project-collect--worktrees-candyart/6f9e7f3f-2562-428a-b3d1-4b39e3d4f058/scratchpad/r/result-390-last-level-1400ms.png`、`instructions-390.png`、`instructions-1280.png` 目視按鈕完整。
送 FIXED 前完整跑（BUG-1、BUG-2 各一次）：`eslint .` exit 0；`tsc -b --noEmit` exit 0；`vitest run` → `Test Files 25 passed, Tests 297 passed`。
自看（私有 port 5188 起 vite，看完已 kill 自己的 pid；截圖在 `/tmp/claude-1000/-home-bal-project-collect--worktrees-candyart/6f9e7f3f-2562-428a-b3d1-4b39e3d4f058/scratchpad/`）：
- `w2-320.png`（320×640，精簡橫條）量測：LV 49–111、圓鈕 131–271，不重疊；`w2-390.png`：步數球 119–157、圓鈕 171–341，不重疊。
- `w2-1280.png`（兩側、3★ 刻度在 100%）、`w2-load-dark.png`（深色模式頁首／工具列）、`w2-loading.png`（playwright 擋掉 `/candy/**` 讓載入畫面停住，腳本 `/tmp/claude-1000/-home-bal-project-collect--worktrees-candyart/6f9e7f3f-2562-428a-b3d1-4b39e3d4f058/scratchpad/load.mjs`）。

## 自我審查
- BUG 排除紀錄：只改遮罩內距 → 1280 過、390 仍溢出 34／63px，排除「單純內距問題」，加縮放外框後兩者都過。卡片原始高仍是 436（最後一關 478），比 spec 420×380 高；本次沒壓內部間距，縮放只在放不下時生效。
- 路徑 `@/*`、自訂 class 全 @apply、只新增 `.candy-*` class（reduced-motion 段多列兩個新 class）；bridge／store 未動；既有 testid 全保留。
- `isCompactTopBar` 門檻 310 是依 LV 單位數估的；LV 兩位數目前不會出現（5 關）。

## 疑慮
- AC9 字面「黑底」：我照「改成 A 的配色」改成紫夜空漸層（#3a1f8c→#12083a），不是純黑；要純黑請說。
- Minor 1 的 0.6 下限只影響高 550 時容器寬約 733–777px 的區間（改成橫條）；1000×800 非全螢幕（容器≈840×550，k≈0.73）仍是兩側，AC12 照舊要全螢幕截。
