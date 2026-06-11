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

## 糖果遊戲開發流程（/candy-crush 頁）

`/candy-crush`（糖果消消樂）為**完全獨立**的 Godot 4.4 match-3 專案，與 RPG 不共用任何場景/腳本/匯出產物；計畫書見 `.prompts/candyCrush.md`。

- 遊戲原始碼：`godot-candy-src/`（`board.gd` 純邏輯可單測；`board_view.gd` 渲染與結算；`level_manager.gd` + `data/candy_levels.json` 關卡定義，進 pck 不需 fetch）
- 匯出產物：`public/candy/`（進版控；CI 無 Godot 環境，需本機匯出後 commit）
- React 外殼：`src/pages/CandyCrush/`（HUD/結算面板）、`src/lib/candyBridge.ts`（postMessage 協定 v1，source: `godot-candy`）、`src/store/useCandyStore.ts`

開發循環：

```bash
# 1. 修改 godot-candy-src/ 腳本、場景或關卡 JSON
# 2. 跑純邏輯測試（盤面演算法不依賴動畫時序）
godot --headless --path godot-candy-src --script res://tests/board_test.gd
# 3. 匯出 Web 版
pnpm candy:export
# 4. 本機驗證後 commit public/candy 產物
pnpm dev   # 開 /#/candy-crush 驗收
```

注意事項：

- Web 匯出 Threads 必須 OFF（同 RPG，靜態託管限制）；export preset 的 `include_filter` 含 `*.json`（關卡定義）
- 對外名稱一律「糖果消消樂」（Candy Crush 為 King 商標，僅內部文件沿用慣稱）
- Bridge 提供 `DEBUG_SET_BOARD` / `DEBUG_GET_BOARD` / `DEBUG_SET_STATE` 指令，供 Playwright 以確定性盤面驗證消除/特殊糖/關卡流程
- 音效（`assets/sfx/*.wav`）由 `tools/gen_sfx.py` 程式合成（自製無版權），改音色重跑該腳本即可；
  React 殼 🔊 按鈕經 `SET_MUTED` 指令靜音（偏好存 localStorage）

## 多人對戰頁（/battle）開發流程

`/battle` 為 1~4 人即時對戰平台，與既有 Godot 遊戲互不相關。
架構分層見 `plan/multiplayer_battle_page_babylon_webrtc_firebase.md`：
Firebase = 控制平面、WebRTC = 傳輸層、Babylon.js = 表現層（在 React JS context 內直跑，**不走** iframe/postMessage）。

目前進度：**Phase 1（控制平面）+ Phase 2（WebRTC 傳輸層）**。Babylon 引擎（Phase 3+）尚未接入。

- 控制平面：`src/core/firebase/`（匿名登入 + Firestore client）、`src/core/room/`（房間 CRUD + 訂閱）
- 傳輸層：`src/core/room/signaling.ts`（Firestore signaling）、`src/core/webrtc/`（full-mesh DataChannel → `NetTransport`）
- 狀態：`src/store/useRoomStore.ts`（房間）、`src/store/useNetStore.ts`（連線 + ping demo）；UI：`src/pages/Battle/`
- 資料模型：`rooms/{roomId}` + `rooms/{roomId}/players/{playerId}` + `rooms/{roomId}/signals/{id}`（playerId = 匿名 uid）
- 連線方式：每對 peer 由 uid 較小者發 offer（防 glare）；negotiated DataChannel（id0 reliable / id1 unreliable）；STUN 無 TURN（對稱 NAT 可能連不上）
- 驗證：房主「開始對戰」後各端建立 mesh，房間面板可按 **Ping** 測往返 RTT（多分頁開同房號驗證）

### Firebase 設定（首次使用）

```bash
# 1. Firebase Console 建立專案，啟用 Authentication → Anonymous、建立 Firestore Database
# 2. 部署安全規則（內容見專案根 firestore.rules）
#    Console → Firestore → Rules 貼上，或 firebase deploy --only firestore:rules
# 3. 複製設定範本並填入專案值（.env.local 已被 .gitignore 忽略）
cp .env.example .env.local   # 填入 VITE_FIREBASE_*
# 4. 啟動，開 /#/battle
pnpm dev
```

注意事項：

- `.env.local` 未填或缺 `VITE_FIREBASE_API_KEY` 時，`/battle` 顯示「尚未設定 Firebase」提示而非崩潰
- Web App config 會打包進前端屬公開資訊，存取控管一律靠 `firestore.rules`（務必先部署 Rules 並啟用 Anonymous 登入）
- firebase SDK 體積大，已於 `vite.config.ts` 拆為獨立 `vendor-firebase` chunk，僅隨 lazy 的 `/battle` 載入
