import type { Scene } from '@/babylon/babylonCore'
import type { GameNetMessage, NetTransport } from '@/core/webrtc'

/** 對戰中的玩家精簡資訊（由房間玩家列表帶入） */
export interface GamePlayer {
  id: string
  name: string
}

/** 覆蓋層按鈕（如「重新開始」） */
export interface OverlayAction {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary'
}

/** 遊戲自畫面內彈出的 React 覆蓋層（陣亡/結算等情境的 UI 介面） */
export interface GameOverlay {
  title: string
  /** 副標，支援多行（\n）；如結算名次 */
  subtitle?: string
  actions: OverlayAction[]
}

/** HUD 玩家卡資料；P 編號 = colorIndex + 1（固定 4 色依出生角） */
export interface GameHudPlayer {
  id: string
  name: string
  colorIndex: 0 | 1 | 2 | 3
  isSelf: boolean
  isAI: boolean
  alive: boolean
  wins: number
  bombs: number
  fire: number
  speed: number
  kick: boolean
  throw: boolean
  /** 無敵剩餘毫秒，0 表示沒有無敵 */
  invincibleMs: number
}

/**
 * 遊戲自畫面的 React HUD 資料（目前只有 bomber 使用，由 BabylonCanvas 渲染玩家卡與計時器）。
 * 共用契約：欄位只增不改；其他遊戲不呼叫 setHud 即不受影響。
 */
export interface GameHud {
  /** 距突然死亡倒數；suddenDeath 為 true 時 secondsLeft 無意義 */
  timer: { secondsLeft: number; suddenDeath: boolean }
  aliveCount: number
  totalCount: number
  players: GameHudPlayer[]
}

/** GameModule 初始化情境（計畫 §3：Babylon 與網路同處 JS，直接拿 NetTransport） */
export interface GameContext {
  scene: Scene
  net: NetTransport
  selfId: string
  role: 'host' | 'guest'
  /** 房主 uid（單人模式即自己）：guest 只信任來自它的權威訊息（安全審查 C1） */
  hostId: string
  players: GamePlayer[]
  /** 設定/清除畫面覆蓋層 UI（由 BabylonCanvas 以 React 渲染）；傳 null 收起 */
  setOverlay?: (overlay: GameOverlay | null) => void
  /** 設定/清除 HUD（由 BabylonCanvas 以 React 渲染）；傳 null 收起。內容未變的呼叫會被略過，可每幀呼叫（每次傳新物件，勿原地改舊物件） */
  setHud?: (hud: GameHud | null) => void
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
