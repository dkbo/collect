# AI 專案開發規範 (.AGENTS.md)

## 🛠️ 技術棧
- React 19 + TypeScript + Vite
- React Router 7 (`src/App.tsx` 路由，`src/components/Layout.tsx` 佈局)
- Zustand 5 (`src/store/` 全域狀態及非同步請求)
- Axios (`src/lib/axios.ts` 封裝實例)
- shadcn/ui (`src/components/ui/` 原子元件)
- Tailwind CSS v4 (`src/index.css`)

## 🎨 樣式規範
- 自訂 CSS 類別**必須使用 `@apply` 語法**套用 Tailwind 類別：
  ```css
  .my-card { @apply bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl; }
  ```

## 📁 目錄指南
- `@/components/ui/` - 原子元件 | `@/components/` - 共用佈局 | `@/pages/` - 頁面
- `@/store/` - Zustand Store | `@/lib/` - 工具與 Axios 設定

## ⚠️ 開發規範
1. **路徑別名**：一律使用 `@/*` 引入路徑，不得使用相對路徑。
2. **狀態與非同步**：非同步請求與資料處理寫在 Zustand Store Action 中，元件僅負責訂閱與調用。
3. **溝通與回報 (節省 Token)**：回覆與任務成果總結請保持精簡扼要，僅列出關鍵的重要變更資訊即可，不需列出全部細微或重複的代碼細節。


# NOTICE

NEVER reimplement CLI tools using Python unless explicitly required.

If a CLI tool exists and is installed, always use it first.

If unsure, inspect available CLI commands via --help.