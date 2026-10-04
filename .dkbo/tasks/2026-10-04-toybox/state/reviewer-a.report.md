# toybox-reviewer-a 報告（波 4）

## 做了什麼
審 `waves/4.diff`（2 檔、+1/−3，皆工作樹未 commit）：react-games 的 CandyCrush 載入圖示補 strokeWidth、react-shell 刪 HeroSection 的 `onB={() => {}}` 與過時註解。另核對 `Handheld.tsx` 的 B 鍵邏輯（受控模式下沒傳 onB 也會換張）與全樹 lucide 圖示 strokeWidth。

## 規格合規
- ✅ 波 4 react-games：`src/pages/CandyCrush/index.tsx:169` `<Candy className="size-10" strokeWidth={2.5} aria-hidden="true" />`。全樹掃描（逐檔取 lucide-react 匯入名、找無 strokeWidth 的 JSX，另查跨行開標籤）：殘餘未帶 strokeWidth 的只在凍結檔 `CandyCrush/CandyHud.tsx`、`CandyCrush/CandyOverlays.tsx`、`Battle/*Hud.tsx`（全域約束列為只讀，不在本條範圍）；`src/pages/Dashboard.tsx` 未掛路由、本任務不動。可改範圍內全部 2.5。
- ✅ 波 4 react-shell：`src/pages/Home/HeroSection.tsx:61-77` 已刪 `onB={() => {}}` 與過時註解，其餘不動。行為不變的依據：`src/components/toybox/Handheld.tsx:73-76` `pressB` 先 `step(current)` 再 `onB?.(next)`；HeroSection 為受控（`index={tile}`、`onIndexChange={setTile}`），`step` 經 `onIndexChange` 推進 `tile`，B 鍵仍換張；`Handheld.test.ts`「沒傳 onB 時也換下一張」覆蓋非受控路徑且綠。
- ✅ 所有權：變更檔僅 `src/pages/CandyCrush/index.tsx`（react-games）與 `src/pages/Home/HeroSection.tsx`（react-shell），無越界；未碰凍結區、package.json、index.css。
- ✅ 全域約束：無新增相對路徑、任意色值、禁用樣式、emoji 或圖檔。
- 其他 AC1–AC15 本波未觸及，不重判。

## Important
（無）

## Minor
- 累積 Minor triage：切片標明逐波審查不 triage，本段不判。
- 受控模式下 B 鍵換張靠 `onIndexChange` 推進，`Handheld.test.ts` 只測非受控路徑（`src/components/toybox/Handheld.test.ts:31`）；不影響本波，可留（屬 react-theme 範圍）。

## 測試
### 紅
不適用: reviewer 只讀審查，不寫測試。
不適用: 本波為一行屬性補齊與刪死碼，無新增邏輯。
### 綠
`node_modules/.bin/eslint --no-cache src/pages/CandyCrush/index.tsx src/pages/Home/HeroSection.tsx` → exit 0
`node_modules/.bin/tsc -b --noEmit` → exit 0
`node_modules/.bin/vitest run src/components/toybox` → Test Files 2 passed, Tests 8 passed
跑完 `git status --short` 只剩本波兩檔，未寫入任何檔。

## 自我審查
lucide 掃描是 grep 啟發式（同行開標籤＋跨行開標籤另查），icon 以 prop 傳元件參照（如 `icon={X}`）的寫法不在本次掃描內，但本波兩檔沒有此寫法。

## 疑慮
無。
