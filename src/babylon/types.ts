import type { Scene } from '@babylonjs/core'
import type { GameNetMessage, NetTransport } from '@/core/webrtc'

/** 對戰中的玩家精簡資訊（由房間玩家列表帶入） */
export interface GamePlayer {
  id: string
  name: string
}

/** GameModule 初始化情境（計畫 §3：Babylon 與網路同處 JS，直接拿 NetTransport） */
export interface GameContext {
  scene: Scene
  net: NetTransport
  selfId: string
  role: 'host' | 'guest'
  players: GamePlayer[]
}

/**
 * 對戰遊戲標準介面（計畫 §3）。
 * 每款 Babylon 遊戲實作此介面 + 一個 Scene；新增遊戲不需 Godot 專案或匯出。
 */
export interface GameModule {
  readonly gameId: string
  /** 建場景、註冊輸入、初始網路握手 */
  init(ctx: GameContext): void
  /** 綁 engine render loop，deltaMs 為上一幀毫秒 */
  update(deltaMs: number): void
  /** 收到對端遊戲訊息（由 BabylonCanvas 轉自 NetTransport 'message'） */
  onNetworkMessage(from: string, msg: GameNetMessage): void
  /** 釋放自建資源（mesh/material/observer）；Engine/Scene 由外層處理 */
  dispose(): void
}

/** 無參數工廠，回傳一個全新 GameModule 實例 */
export type GameFactory = () => GameModule
