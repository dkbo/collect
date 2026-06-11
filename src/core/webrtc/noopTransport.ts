import type { NetTransport } from './types'

/**
 * 空操作傳輸層：供單人遊玩使用。
 * 無對端、無連線——所有送出皆忽略，事件永不觸發（on 回傳空 unsubscribe）。
 * 讓 GameModule 以「唯一玩家＝主機」的權威模式單機自跑，無須 Firebase / WebRTC。
 */
export const createNoopTransport = (): NetTransport => ({
  send: () => {},
  broadcast: () => {},
  sendUnreliable: () => {},
  broadcastUnreliable: () => {},
  on: () => () => {},
})
