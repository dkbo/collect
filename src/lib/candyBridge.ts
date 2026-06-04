/** React ⇄ Godot-Candy iframe postMessage 協定 v1（詳見 .prompts/candyCrush.md） */

export const CANDY_BRIDGE_SOURCE = 'godot-candy'

/** Godot → React 事件 */
export type CandyToReactMessage =
  | { type: 'READY'; payload: { version: string } }
  | { type: 'STATE'; payload: { level: number; score: number; moves: number; target: number; stars: number } }
  | { type: 'LEVEL_END'; payload: { won: boolean; level: number; score: number; stars: number } }

/** React → Godot 指令 */
export type ReactToCandyMessage =
  | { type: 'SET_PAUSED'; payload: { paused: boolean } }
  | { type: 'START_LEVEL'; payload: { level: number } }
  | { type: 'SET_MUTED'; payload: { muted: boolean } }

let candyWindow: Window | null = null

export const registerCandyWindow = (win: Window | null) => {
  candyWindow = win
}

export const sendToCandy = (msg: ReactToCandyMessage) => {
  candyWindow?.postMessage({ source: CANDY_BRIDGE_SOURCE, ...msg }, window.location.origin)
}

export const onCandyMessage = (
  handler: (msg: CandyToReactMessage) => void
): (() => void) => {
  const listener = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return
    const data = event.data as { source?: string } & CandyToReactMessage
    if (!data || data.source !== CANDY_BRIDGE_SOURCE || typeof data.type !== 'string') return
    handler(data)
  }
  window.addEventListener('message', listener)
  return () => window.removeEventListener('message', listener)
}
