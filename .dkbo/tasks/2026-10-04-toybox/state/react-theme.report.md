# toybox-react-theme 報告（波 3）
## 做了什麼
- **AC4 舊頁面區段清除**（`src/index.css`）：刪掉 FLOATING NAVBAR、HOME PAGE、HERO SECTION、RESUME PAGE、RPG GAME ROOM、TODOS PAGE、UTILITY CLASSES 整段（原 468–1037 行，共 −631 行）。逐 class 以完全比對 token 的 `rg -e '(^|[^a-zA-Z0-9_-])<class>([^a-zA-Z0-9_-]|$)' src index.html`（排除 index.css）驗證零引用：95 個 class 中，除下列仍保留者外，外部命中只有註解（`RpgRoom.css`／`GodotGame.css` 的「沿用舊 rpg-screen」）、`gameFrames.test.ts` 的 OLD_CLASSES 正則（反向斷言舊名不得出現）、store 資料欄位 `completed`、babylon 的 `tag:` 物件鍵——皆非 class 引用。也查過動態組 class（`` `xxx-${…}` ``）只有 data-testid。被刪區段內的 10 個 `@keyframes`（homeShimmer、homeTile*、homeMarquee、todoLi* 等）也零外部引用。
- **SCROLL-TRIGGERED ANIMATIONS 段保留但瘦身**：`animate-on-scroll`／`animate-fade-in-up`／`animate-scale-in`／`animate-stagger-1..4`／`is-visible` 仍被 `Resume/index.tsx`、`Resume/AboutSection.tsx`、`lib/useScrollAnimation.ts` 使用，保留；零引用的 `slideInLeft/Right`、`floatSlow` keyframes、`animate-slide-in-*`、`animate-stagger-5`，及 reduced-motion 區塊裡指向已刪 class（hero-*、work-card*、marquee-*、journey-line）的規則一併刪。→ 沒有「仍有引用、需裁定」的舊頁面 class。
- **Handheld B 鍵**：根因是 `onB?.(count > 1 ? step(current) : current)`——optional call 在 `onB` 未定義時連引數都不求值，`step` 沒跑。改成先 `step` 再 `onB?.(next)`。首頁 `HeroSection.tsx:72` 的空 `onB` 繞道（波 2 minor 3）現在可拿掉，屬 react-shell 所有權，我未動。
- **SectionHeader**：加 `as?: 'h1' | 'h2'`（預設 h2，只增）；另在 `.tb-sechead__title` 補 `tracking-normal`，因為 Todos／Search／Battle／Directions／Resume／gameUi 都是手寫 `h1.tb-sechead__title`，不經元件，只加 `as` 救不到它們。
- **SegmentedControl**（波 2 minor 5）：`options[].testId?` → 掛成選項按鈕的 `data-testid`（只增）。WorksSection 改用它屬 react-shell，未動。
- **vitest.config.ts**：新增 `components` project（`src/components/**/*.test.ts`、node）；要 DOM 的測試檔首自帶 `// @vitest-environment jsdom`。
- **`src/lib/utils.ts` 的 `cn`** 改為委派 `tbCn`（同一套 `extendTailwindMerge`），兩者統一。`cn.test.ts` 的對照斷言依 11:34 ruling（採 A）改為新行為。
- 波 2 沒有轉給我的 QUESTION（messages.log 查無），此項無事可做。

## 測試
### 紅
node_modules/.bin/vitest run --project components
Error: No projects were found. Make sure your configuration is correct. The filter matched no projects: components.
node_modules/.bin/vitest run --project components   （加 project 與 Handheld.test.ts 後、修 Handheld 前）
FAIL  |components| src/components/toybox/Handheld.test.ts > Handheld B 鍵 > 沒傳 onB 時也換下一張
AssertionError: expected '/a.webp' to be '/b.webp' // Object.is equality
Tests  1 failed | 7 passed (8)
node_modules/.bin/vitest run --project components   （cn 斷言改新行為後、改 lib cn 前）
FAIL  |components| src/components/toybox/cn.test.ts > tbCn（認得 toybox token 的 tailwind-merge） > lib 的 cn 與 tbCn 同一套，不再吃掉字級 token
AssertionError: expected 'text-ink' to be 'text-heading-m text-ink' // Object.is equality
Tests  1 failed | 7 passed (8)
### 綠
node_modules/.bin/vitest run --project components
Test Files  2 passed (2)
Tests  8 passed (8)
node_modules/.bin/eslint . && node_modules/.bin/tsc -b --noEmit && node_modules/.bin/vitest run
ESLINT-OK
TSC-OK
Test Files  99 passed (99)
Tests  1044 passed (1044)

其他驗證：
- AC10：`src/index.css` 全檔禁用 regex 命中 13 行 = CANDY CRUSH 起到檔尾 13 行 = base 13；`src/components src/pages src/styles index.html` 依排除規則後 0 筆。
- AC13：CANDY CRUSH 區段到檔尾 md5 修改前後皆 `275ef212aa9be7f32db27b0aa34fdbd9`。
- AC14：`vite build --outDir <scratchpad>/dist` 成功；主 CSS `index-*.css` raw 291139 B、gzip 38410 B（刪了 631 行舊樣式，較波 2 只減不增）。
- 自查截圖（vite :5174，1440×900）：12 個路由（含 NotFound）× 淺／深共 24 張，在 scratchpad `shots/`；每張 `scrollWidth == innerWidth == 1440`、深色時 `<html>.dark` 正確；目視 Home 深色、Resume、Todos 正常，Resume 的捲動進場動畫仍生效。console 錯誤皆與 CSS 無關：godot-game 的 `MapLoader: 無法載入地圖 0000_map.json`（worktree 的 public/godot/maps 產物）、Directions 的 Google Maps billing／deprecation，Candy 只有 GL 效能 warning。

## 自我審查
- 刪除前後只動 `src/index.css` 的 334–1037 行範圍，HUD 區段 hash 不變；只增不改共用契約（SectionHeader `as`、SegmentedControl `testId`、Handheld 行為修正符合既有 props 註解「有多張時先換下一張，再帶新的張數」）。
- `.tb-sechead__title` 加 `tracking-normal`：SectionHeader 的 h2 原本也吃 base h2 的 `-0.24px`，現在一併歸零；toybox 的 display-l 本無字距 token，視為更貼規格。
- Handheld 測試用 react-dom/client + jsdom，不加依賴。
- `cn` 改委派後 `src/components/ui/*` 全部吃到 toybox token 合併規則；行為差異只在含 toybox token 的合併（以前會被誤吃）。

## 疑慮
- 留給其他擁有者的收尾（不在我所有權）：`HeroSection.tsx:72` 的空 `onB` 可拿掉；`WorksSection.tsx` 的自組 tb-seg 可改用 `SegmentedControl` 的 `options[].testId`。
- 波 1 Minor 中 `ui/button` 的 `link` variant 對比 2.7:1（目前無人使用）與每個 variant 重寫 lift 規則：契約寫「link 不變」，未動，交領導決定是否另開雜務。
- vite :5174 仍在背景執行（我開的），供 qa 使用；不用時由 wave-close 收。
