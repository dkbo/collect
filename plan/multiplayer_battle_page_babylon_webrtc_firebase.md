# 多人對戰頁（Babylon.js + WebRTC + Firebase）架構計畫

> 本文為 `webrtc_firebase_babylon_react_game_architecture.md` 的**落地修正版**。
> 決策：新增**一頁獨立的多人對戰頁面**，該頁**所有遊戲一律以 Babylon.js 製作**（在 React JS context 內直跑），
> **不使用** Godot iframe 模式。既有 Godot 遊戲（RPG `/godot-game`、糖果 `/candy-crush`）維持不變、互不影響。

---

## 0. 與專案現況的關係

| 項目 | 既有 Godot 遊戲 | 新「多人對戰頁」 |
|---|---|---|
| 引擎 | Godot 4.4 Web 匯出 | **Babylon.js（React 內直跑）** |
| 嵌入方式 | iframe + postMessage 橋接 | **同一 React JS context，無 iframe、無橋接** |
| 通訊 | `godotBridge` / `candyBridge` | WebRTC DataChannel 直接餵給 Babylon |
| 部署 | 產物進版控 `public/<game>/` | 隨 React build 進 `docs/`（Vite 打包） |

關鍵簡化：**因 Babylon 與 WebRTC 同在 JS，省去 Godot 方案必須的 postMessage 橋接層**。
網路事件可直接送進 Babylon 場景，遊戲狀態也直接讀 JS 物件。

分層心法（沿用原計畫）：

> Firebase = 控制平面（房間 / Signaling / 身分）
> WebRTC = 傳輸層（P2P DataChannel，JS）
> Babylon.js = 表現 + 遊戲邏輯層（Host Authority 在此，JS）
> React = UI 殼 + 大廳/房間/連線狀態

---

## 1. 整體架構

```
GitHub Pages (/collect/#/battle)
└── React 殼（單一新頁 + 子路由）
      ├── UI：Lobby / Room / GameSelect / 對戰中 HUD（shadcn/ui）
      ├── Zustand：useRoomStore（房間+玩家）、useNetStore（連線）、useBattleStore（對戰 UI 狀態）
      ├── core/firebase：Anonymous auth + Firestore（房間 + signaling）
      ├── core/webrtc：RTCPeerConnection mesh + DataChannel → NetTransport
      └── <BabylonCanvas/>：掛載 Babylon Engine
              │ 直接函式呼叫 / 事件（同 JS context，無 postMessage）
              ▼
        Babylon Engine（單一 engine，多 scene）
          ├── GameModule 介面（init/update/destroy/onNetworkMessage）
          ├── TankScene / BomberScene / …（皆 Babylon）
          └── Host Authority：碰撞 / HP / 勝負 / 世界狀態 tick
```

---

## 2. React ⇄ Babylon 整合（取代橋接）

因同處 JS context，整合直接：

- `<BabylonCanvas/>`：`useRef<HTMLCanvasElement>` + `useEffect` 內 `new Engine(canvas)`，卸載時 `engine.dispose()`。
- React → 遊戲：以 ref 取得目前 `GameModule` 實例，直接呼叫方法 / 推事件（暫停、開局、選遊戲）。
- 遊戲 → React：Babylon 場景發事件（`Observable` 或 callback）→ 更新 `useBattleStore`（HUD 分數/HP/勝負）。
- **網路 → 遊戲**：`NetTransport.on('message')` 收到對端訊息 → 直接呼叫 `gameModule.onNetworkMessage(msg)`，無序列化跨界成本。

> 對比 Godot 方案省掉的：`netBridge.ts`、postMessage 編解碼、iframe 同源驗證、視窗註冊生命週期。

---

## 3. Babylon.js 引擎架構（沿用原計畫 §8）

所有對戰遊戲共用同一 `Engine`，各遊戲一個 `Scene`：

```
Babylon Engine
  ├── SceneManager：建立/切換/釋放 scene
  ├── AssetLoader：共用資源管理
  └── 各遊戲 Scene（實作 GameModule）
```

### GameModule 標準介面（原計畫 §7，TS 實作）

```ts
interface GameModule {
  readonly gameId: string
  init(ctx: { scene: Scene; net: NetTransport; role: 'host' | 'guest'; players: string[] }): void
  update(deltaMs: number): void           // 綁 engine.runRenderLoop
  destroy(): void
  onNetworkMessage(from: string, msg: GameNetMessage): void
}
```

新增一款對戰遊戲 = 實作一個 `GameModule` + 一個 Babylon `Scene` + 註冊到 GameSelect。**不需新 Godot 專案、不需匯出步驟**。

---

## 4. 網路層（React/TS，與引擎同層）

### 4.1 抽象介面

```ts
interface NetTransport {
  send(peerId: string, data: GameNetMessage): void
  broadcast(data: GameNetMessage): void
  on(event: 'message' | 'peerJoin' | 'peerLeave' | 'open' | 'close', cb): () => void
}
interface GameNetMessage { game: string; type: string; payload: unknown }  // 沿用原計畫統一格式
```

### 4.2 WebRTC（Mesh，1~4 人）

- Full-mesh DataChannel（≤3 連線/人），無需 SFU。
- 雙 channel：`reliable`（ordered，指令/事件）＋ `unreliable`（`maxRetransmits:0`，位置高頻）。
- ICE：免費 STUN（`stun:stun.l.google.com:19302`）。無 TURN → 對稱 NAT 可能連不上（見 §8 風險）。

### 4.3 Firebase 控制平面（沿用原計畫）

```jsonc
// rooms/{roomId}
{ "roomId":"A1B2C3", "gameType":"tank", "hostId":"u1",
  "players": { "u1": {...}, "u2": {...} },
  "status":"waiting" }              // waiting | playing | ended
// rooms/{roomId}/signals/{id}      ← Offer/Answer/ICE 暫存，連上後清除
{ "from":"u1", "to":"u2", "kind":"offer|answer|ice", "data":{...} }
```

- Auth：Anonymous，`uid` = `playerId`。
- 設定：`VITE_FIREBASE_*` 經 build 注入（公開 config 非機密，安全靠 Rules）。
- 連上 DataChannel 後幾乎零 Firestore 流量 → 符合 Spark 免費方案。

---

## 5. Host Authority（在 Host 的 Babylon scene，JS）

- **Host**：跑碰撞、HP/分數、勝負、世界狀態 tick；`net.broadcast()` 廣播權威快照/事件。
- **Guest**：只送 input；接收世界狀態套用，本地插值/預測。
- React 殼不參與遊戲規則，僅傳輸與房間協調。
- 同步策略：位置（unreliable 高頻）、動作事件（reliable）、指令（reliable）；不同步整個 scene。

---

## 6. 路由與專案結構

路由：`src/App.tsx` 新增 hash route（沿用 lazy import 模式）。

```ts
const Battle = lazy(() => import('@/pages/Battle'))
// children: { path: 'battle', element: <Battle /> }  // 可再加 battle/:roomId
```

結構（對齊現有 `src/`）：

```
src/
├─ core/
│  ├─ firebase/        # app/auth/firestore client
│  ├─ room/            # 建房/加入/離開 + signaling 收發
│  └─ webrtc/          # PeerConnection + DataChannel mesh → NetTransport
├─ store/
│  ├─ useRoomStore.ts  # 房間 + 玩家
│  ├─ useNetStore.ts   # 連線狀態 + transport
│  └─ useBattleStore.ts# 對戰頁 UI 狀態（HUD/勝負）
├─ pages/Battle/
│  ├─ index.tsx        # 殼：Lobby/Room/GameSelect/對戰切換
│  ├─ BabylonCanvas.tsx# Engine 掛載/釋放
│  ├─ lobby/ room/     # UI 子元件（shadcn/ui）
│  └─ games/           # ★ Babylon 遊戲：tank/、bomber/…（各含 Scene + GameModule）
└─ babylon/
   ├─ engine/          # SceneManager / AssetLoader 共用
   └─ types.ts         # GameModule / GameNetMessage 介面
```

依賴：新增 `@babylonjs/core`（按需 `@babylonjs/loaders`、`@babylonjs/gui`）、`firebase`。
打包：Babylon 體積大 → 於 `vite.config.ts` `manualChunks` 拆 `vendor-babylon`；`/battle` 已 lazy，不影響其他頁首屏。

---

## 7. 分階段路線圖

| Phase | 目標 | 驗收 |
|---|---|---|
| **0 決策** | 首款對戰遊戲、是否需 TURN、Firebase 專案 | §8 決策點拍板 |
| **1 控制平面** | Firebase + Anonymous auth + Firestore rules + `useRoomStore`、Lobby/Room UI | 多分頁可建房/入房，Firestore 可見 |
| **2 傳輸層** | `core/webrtc` mesh + signaling、`useNetStore` 出 `NetTransport` | 2~4 分頁 P2P 互通 ping（純 React） |
| **3 Babylon 殼** | `<BabylonCanvas/>` + Engine 生命週期 + `SceneManager` + GameModule 介面 | 空 scene 可掛載/切換/釋放，無洩漏 |
| **4 首款對戰遊戲** | 一款 Babylon 遊戲（建議最小 Tank）落實 Host Authority + 網路同步 | 2 人實機對戰，位置+事件同步 |
| **5 打磨** | 斷線重連、結束/離房、Playwright 驗證、文件 | docs build 通過、`/battle` 驗收 |

---

## 8. 決策點（待確認）

1. **首款對戰遊戲**：建議**最小 3D/2.5D Tank** 作 PoC（移動+射擊+HP，最能驗證 Host Authority 與同步）；Bomber/Racing 後續加。
2. **TURN 伺服器**：免費僅 STUN，對稱 NAT 連不上 → PoC 接受此限制；要可靠連線需自架/付費 TURN（超出純 GitHub Pages 免費範圍）。
3. **2D 還是 3D**：Babylon 可做 2.5D 俯視戰場（較省美術），亦可全 3D。建議 PoC 先 2.5D。
4. **規模**：鎖定 1~4 人 mesh；>4 人需 Host-relay/SFU，超出範圍。

---

## 9. 與原計畫對應

- **採納原計畫**：Babylon.js 表現層、單 engine 多 scene、GameModule 介面、WebRTC DataChannel、Firebase 控制平面、Host Authority、只同步必要資料、統一訊息格式 `{game,type,payload}`。
- **相對 Godot 方案的差異**：本頁不走 iframe / postMessage / Godot 匯出；網路直接整合進 JS 引擎，省一層橋接。
- **與 repo 現況共存**：既有 Godot 遊戲不動；Babylon 僅引入於 `/battle`，lazy 載入 + 獨立 chunk，互不干擾。
