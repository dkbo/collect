---
name: frontend-design
description: Guidelines for high-quality, distinctive frontend interfaces using React 19 + Tailwind v4 + shadcn/ui.
model: sonnet
effort: high
---

# Frontend Design (React 19 + Tailwind v4 + shadcn/ui)

## 💡 設計思維
- **拒絕 AI 罐頭風**：根據專案定位決定視覺調性（如極簡、科技感、動態），避免平庸的設計。
- **視覺層次**：善用 CSS Grid / Flexbox 佈局、漸層、陰影、玻璃擬態 (glassmorphism) 以創造視覺深度。
- **微互動**：使用輕量的 CSS transition 提升操作體驗，並遵循 `prefers-reduced-motion`。

## 🧩 元件設計
- **路徑別名**：使用 `@/components/...` 等路徑別名。
- **組合優先**：使用 shadcn/ui 原子元件，藉由 props 或 `cn(...)` 工具類別擴充樣式。
- **資料驅動**：嚴禁死資料 (Placeholders)，使用 props 與 API 對接真實資料。

## ⚙️ 交付標準
- 無 layout shifts，且無 production `console.log`。
- 程式碼必須通過編譯檢查 (`pnpm build`)。
