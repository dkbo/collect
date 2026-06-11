import type { GameType } from '@/core/room'

/** 對戰遊戲型錄項目（單一資料來源：列表、選單、房間共用） */
export interface GameMeta {
  id: GameType
  label: string
  desc: string
}

/** 對戰遊戲清單（新增遊戲於此登記，並在 games/index.ts 註冊工廠） */
export const GAME_CATALOG: GameMeta[] = [
  { id: 'tank', label: '坦克對戰', desc: 'Babylon.js 2.5D・移動 + 射擊 + HP' },
  { id: 'race', label: '極速賽車', desc: '環道 3 圈衝線・WASD / 方向鍵駕駛' },
  { id: 'bomber', label: '炸彈超人', desc: '放彈炸箱拼生存・空白鍵放炸彈' },
  { id: 'overcooked', label: '廚房快手', desc: '合作做菜拼出餐・E / 空白鍵互動' },
]

/** 依 gameType 取得型錄項目 */
export const getGameMeta = (id: GameType): GameMeta | undefined =>
  GAME_CATALOG.find((g) => g.id === id)

/** 封面圖路徑（public/game-covers/<id>.jpg，含 /collect/ base） */
export const coverUrl = (id: GameType): string =>
  `${import.meta.env.BASE_URL}game-covers/${id}.jpg`
