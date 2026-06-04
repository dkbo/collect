# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## Godot 開發流程（/godot-game 頁）

`/godot-game` 以 Godot 4.4 Web 匯出 + iframe 嵌入重構 RPG 遊戲室，與 React 透過 postMessage 通訊（協定見 `src/lib/godotBridge.ts`）。

- 遊戲原始碼：`godot-src/`（GDScript；地圖 JSON 與 `/rpgroom` 共用單一來源 `src/pages/RpgRoom/data/`）
- 匯出產物：`public/godot/`（進版控；CI 無 Godot 環境，需本機匯出後 commit）

開發循環：

```bash
# 1. 修改 godot-src/ 腳本或場景
# 2. 匯出 Web 版（自動先同步地圖 JSON 到 public/godot/maps/）
pnpm godot:export
# 3. 本機驗證後 commit public/godot 產物
pnpm dev   # 開 /#/godot-game 對照 /#/rpgroom 驗收
```

注意事項：

- Web 匯出 Threads 必須 OFF（靜態託管無法回 COOP/COEP header）
- `rpg_maker_xp(2).png` 長條圖庫以 image importer 匯入為 CPU Image，由 `TileAtlas` 按需切塊
  （整張超過 WebGL 貼圖尺寸上限；勿改回 texture importer）
- 行為以 `/rpgroom` 為準（座標、碰撞、NPC 狀態機皆 1:1 移植），改動時兩頁對照驗收
