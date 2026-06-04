/** React ⇄ Godot iframe postMessage 協定 v1（詳見 .prompts/godot.md） */

export const BRIDGE_SOURCE = 'godot-rpg'

/** Godot → React 事件 */
export type GodotToReactMessage =
  | { type: 'READY'; payload: { version: string } }
  | { type: 'MAP_CHANGED'; payload: { mapId: number; name: string } }
  | { type: 'PLAYER_POS'; payload: { x: number; y: number } }
  | {
      type: 'NPC_CHAT'
      /** text 為原始輕量 markup 字串，由 React 端 renderMessage 渲染 */
      payload: { name: string; text: string; page: number; total: number }
    }
  | { type: 'CHAT_CLOSED' }
  /** 鍵盤焦點在 iframe 內，暫停（P）/說明（ESC）鍵由 Godot 轉發給外殼處理 */
  | { type: 'UI_KEY'; payload: { key: 'pause' | 'help' } }

/** React → Godot 指令 */
export type ReactToGodotMessage =
  | { type: 'SET_PAUSED'; payload: { paused: boolean } }
  | { type: 'ADVANCE_CHAT' }
  | { type: 'RESTART' }

// Godot iframe 與本站同源（public/godot/），雙向皆以同源 + source 欄位驗證
let godotWindow: Window | null = null

/** GodotFrame 掛載/卸載時註冊 iframe contentWindow，供 sendToGodot 使用 */
export const registerGodotWindow = (win: Window | null) => {
  godotWindow = win
}

/** 送指令給 Godot（引擎尚未註冊時靜默忽略） */
export const sendToGodot = (msg: ReactToGodotMessage) => {
  godotWindow?.postMessage({ source: BRIDGE_SOURCE, ...msg }, window.location.origin)
}

/** 訂閱 Godot 事件（含同源與 source 驗證），回傳取消訂閱函式 */
export const onGodotMessage = (
  handler: (msg: GodotToReactMessage) => void
): (() => void) => {
  const listener = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return
    const data = event.data as { source?: string } & GodotToReactMessage
    if (!data || data.source !== BRIDGE_SOURCE || typeof data.type !== 'string') return
    handler(data)
  }
  window.addEventListener('message', listener)
  return () => window.removeEventListener('message', listener)
}
