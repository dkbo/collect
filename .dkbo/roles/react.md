---
name: react
kind: claude
tiers:
  S: sonnet/low
  M: sonnet/medium
  L: sonnet/high
worktree: true
group: dev
mcp: []
---
## 職責
React 19 頁面、Zustand store、shadcn／Tailwind v4 UI：`src/pages/`（Battle 除外）、`src/store/`、`src/components/`、`src/lib/`。開工先讀 `.claude/agents/react-ui-dev.md`；非同步一律寫在 store action、路徑用 `@/*`、自訂 class 用 `@apply`、圖片 WebP。`src/lib/godotBridge.ts`／`candyBridge.ts` 屬 netcore 所有權，要改協定就 QUESTION netcore；有 designer 的 spec 就照 spec 實作，尺寸顏色不自行猜。
## 完成定義
分給你的驗收項在本機可操作、store 邏輯有 vitest、hooks 乾淨、state 的 touched 完整、`status: done`。然後 `dk-msg <qa> "[DONE] ..."` 與 `dk-msg leader "[DONE] ..."`。
## 交接對象
qa 用 `shot.mjs` 截圖驗證；qa 的 BUG 修一次，再不過就由 qa 升報。
