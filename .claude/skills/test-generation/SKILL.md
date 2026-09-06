---
name: test-generation
description: 為本專案撰寫 vitest 單元測試（src/**/*.test.ts，與被測檔同目錄）：src/babylon 的 math / net 純函式與 Zustand store。Use when asked to write tests, add coverage, or do TDD. UI、3D 渲染、GDScript 場景不進單測。
model: sonnet
effort: high
---

# 測試撰寫（vitest 5）

## 範圍與環境

| 目標 | 環境 | 說明 |
| --- | --- | --- |
| `src/babylon/math.ts`、`src/babylon/net/*.ts` | node | 純函式與 factory；`net/` 依賴 `NetTransport`（`@/core/webrtc`）介面，用假 transport 注入，**不連真 WebRTC** |
| `src/store/*.ts`、`src/lib/*.ts` | jsdom | Zustand store；碰 `window.postMessage`、`localStorage`、bridge 的用 `vi.spyOn` / `vi.mock` |
| UI 元件、Babylon 場景、GDScript | 不測 | 改用 `web-verifier` 截圖；糖果 `board.gd` 走 `godot --headless --script res://tests/board_test.gd` |

- 指令：`pnpm test`（`vitest run`）、`pnpm test:watch`。設定在 `vitest.config.ts`（兩個 project：`babylon` node、`store` jsdom）。
- 檔名 `<被測檔>.test.ts`，放同目錄。tsconfig 會一併型別檢查，**不要用 vitest globals**，一律 `import { describe, it, expect, vi } from 'vitest'`。
- 路徑別名 `@/*` 可用（AGENTS.md：禁止相對路徑跨目錄）。

## 規則

- 只測**行為與契約**，不測實作細節；一個 `it` 一個斷言主題。
- 覆蓋：happy path、邊界（角度環繞、空快照、0 玩家、非 host 收到 host 訊息）、錯誤／忽略路徑。
- 時間相關（fixedTick、snapshot 插值）用 `vi.useFakeTimers()` 或直接傳入 `now`，不 sleep。
- 網路訊息用假 `NetTransport`：記錄 `send` 的呼叫、手動觸發 `onMessage`，斷言送出的 `GameNetMessage` 型別與 payload。
- Zustand store 每個 `it` 前用 `store.setState(初始值, true)` 重設，避免測試間汙染。
- 外部 IO（axios、firebase、bridge 的 postMessage）一律 mock，不打真服務。
- 寫完跑 `pnpm test` 與 `pnpm lint`；Stop hook 會再驗一次。

## 輸出格式

```
### Test Plan
**Target:** <檔案>
**Tests:**
- [UNIT] <it 名稱> — 驗什麼
- [EDGE] <it 名稱> — 邊界
**Result:** pnpm test 全綠（N tests）
```
