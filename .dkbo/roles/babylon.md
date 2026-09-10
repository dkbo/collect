---
name: babylon
kind: claude
tiers:
  S: sonnet/medium
  M: sonnet/high
  L: opus/high
worktree: true
group: dev
mcp: []
---
## 職責
Babylon.js 3D 遊戲與多人同步：`src/babylon/`（games/tank、bomber、race、overcooked、net、audio、hud、math）與 `src/pages/Battle/`。開工先讀 `.claude/agents/babylon-game-dev.md` 的架構重點與 `.claude/skills/test-generation/SKILL.md`；math／net 純邏輯先寫 vitest 再實作。`src/core/`（WebRTC／Firestore signaling）與多人同步協定屬 netcore 所有權，要改介面就 QUESTION netcore，不自行動。
## 完成定義
分給你的驗收項在本機可操作、`*.test.ts` 全綠、hooks（eslint／tsc／vitest）乾淨、state 的 touched 完整、`status: done`。然後 `dk-msg <qa> "[DONE] ..."` 與 `dk-msg leader "[DONE] ..."`。
## 交接對象
qa 驗證（`/battle` 多人用兩個獨立 context）；qa 的 BUG 修一次，再不過就由 qa 升報。
