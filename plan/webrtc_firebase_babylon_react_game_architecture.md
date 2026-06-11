# WebRTC + Firebase + Babylon.js + React 多人遊戲平台架構設計

## 1. 專案目標

建立一個可部署在 GitHub Pages 的 1~4 人即時多人對戰遊戲平台，支援多種遊戲模式（Tank、Bomberman、Racing 等），並具備可擴充架構。

---

## 2. 技術選型

- **React**：UI（大廳、房間、遊戲選單）
- **Babylon.js**：3D 遊戲引擎
- **WebRTC**：玩家即時資料傳輸（DataChannel）
- **Firebase Firestore**：房間管理 + Signaling
- **Firebase Auth (Anonymous)**：玩家識別
- **GitHub Pages**：前端部署

---

## 3. 整體架構

```
GitHub Pages
    │
    ├── React UI
    │     ├── Lobby
    │     ├── Room
    │     └── Game Select
    │
    ├── Game Layer
    │     ├── Tank Game
    │     ├── Bomber Game
    │     ├── Racing Game
    │     └── Card Game
    │
    ├── Babylon.js Engine
    │     ├── Scene Manager
    │     ├── Asset Loader
    │     └── Physics / Collision
    │
    └── Networking Layer
          ├── Firebase (Signaling)
          └── WebRTC DataChannel
```

---

## 4. Firebase 用途（只做控制層）

Firebase 不負責遊戲同步，只負責：

- 房間建立
- 玩家加入 / 離開
- 遊戲類型選擇
- WebRTC Signaling（Offer / Answer / ICE）

### Room 資料範例

```json
{
  "roomId": "A1B2C3",
  "gameType": "tank",
  "hostId": "user1",
  "players": ["user1", "user2"],
  "status": "waiting"
}
```

---

## 5. WebRTC 網路層設計

### 目標
建立 P2P DataChannel，進行即時遊戲同步。

### 基本 API

```ts
network.send(data)
network.broadcast(data)
network.on(event, callback)
```

---

### 訊息格式統一

```json
{
  "game": "tank",
  "type": "move",
  "payload": {
    "x": 10,
    "z": 5
  }
}
```

---

## 6. Host Authority 架構（推薦）

```
Host (玩家A)
   │
   ├── Player B
   ├── Player C
   └── Player D
```

### Host 負責：

- 碰撞判定
- HP / 分數
- 勝負邏輯
- 世界狀態更新

### 玩家負責：

- 輸入（input）
- 接收狀態更新

---

## 7. Game Module 標準介面

```ts
interface GameModule {
  init(): void
  update(delta: number): void
  destroy(): void

  onNetworkMessage(data: any): void
}
```

---

## 8. Babylon.js 架構

所有遊戲共用同一引擎：

```
Babylon Engine
    ├── TankScene
    ├── BomberScene
    ├── RacingScene
    └── CardScene
```

優點：

- 減少初始化成本
- 統一資源管理
- 易於切換遊戲

---

## 9. 遊戲同步策略

### 不做：
- 同步整個 Scene
- 傳整個世界狀態

### 只做：
- 玩家位置
- 動作事件
- 遊戲指令

例：

```json
{ "type": "move", "x": 10, "z": 5 }
{ "type": "shoot" }
{ "type": "placeBomb" }
```

---

## 10. 專案結構建議

```
src/
├─ core/
│  ├─ firebase/
│  ├─ webrtc/
│  ├─ room/
│  └─ gameManager/
│
├─ games/
│  ├─ tank/
│  ├─ bomber/
│  ├─ racing/
│  └─ card/
│
├─ babylon/
│  ├─ engine/
│  ├─ scene/
│  └─ assets/
│
├─ ui/
│  ├─ lobby/
│  ├─ room/
│  └─ gameSelect/
│
└─ App.tsx
```

---

## 11. 擴充方向

- 排行榜系統
- Replay（回放）
- 房間觀戰模式
- AI 玩家（Bot）
- Matchmaking（配對系統）
- 語音聊天（WebRTC Audio）

---

## 12. 結論

此架構適合：

- GitHub Pages 免費部署
- 1~4 人即時對戰
- 小型派對遊戲
- 快速擴充多種遊戲模式

核心理念：

> Firebase = 控制平面  
> WebRTC = 傳輸層  
> Babylon.js = 表現層  
> React = UI 層
