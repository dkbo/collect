/** RPG 地圖統一 Schema（single source of truth：data/000N_map.json） */

export interface SpawnPoint {
  x: number
  y: number
}

export interface MapInfo {
  index: number
  name: string
  width: number
  height: number
  /** 傳送落點清單，索引對應其他地圖碰撞區的 cmm */
  in: SpawnPoint[]
}

export interface MapStyleTile {
  n?: string // 名稱
  l: number // 畫布 X 座標
  t: number // 畫布 Y 座標
  w: number // 寬
  h: number // 高
  b: number // 圖庫索引（0: man, 1: rpg_maker_xp, 2: rpg_maker_xp2）
  x: number // 圖庫來源 X
  y: number // 圖庫來源 Y
  z?: number // 2 = 前景遮罩層，其餘為背景層
  rx?: number // 沿 X 重複次數（壓縮欄位，預設 1）
  ry?: number // 沿 Y 重複次數（壓縮欄位，預設 1）
}

export interface MapCollision {
  n?: string // 區域名稱
  x: number
  y: number
  w: number
  h: number
  e?: number // 對話事件索引（對應 messages[e]）
  cm?: number // 傳送目標地圖索引
  cmm?: number // 傳送目標地圖落點索引（map.in[cmm]）
}

export interface MapNpc {
  b: number // 圖庫索引
  type: number // 0: 站立, 4: 行走
  pX: number // 位置 X
  pY: number // 位置 Y
  aX: number // 活動範圍 X
  aY: number // 活動範圍 Y
  aW: number // 活動範圍寬
  aH: number // 活動範圍高
  mX: number
  mY: number
  x: number
  y: number
  w: number
  h: number
  d: number // 朝向（0:下 1:左 2:右 3:上）
  l: number
  r: number
  u: number
  t: number
  s: number
  f: number
  footSpeed: number
  isR: boolean
  isU: boolean
  isD: boolean
  isL: boolean
  isM: boolean
  e: number // 對話事件索引（對應 messages[e]）
}

export interface NpcMessage {
  name: string
  /** 支援輕量 markup：[[kbd:文字]]、[[link:url|文字]]、[[mark:文字]] */
  text: string[]
}

export interface MapJsonData {
  map: MapInfo
  styles: MapStyleTile[]
  isMove: MapCollision[]
  npc?: MapNpc[]
  messages?: NpcMessage[]
}

/** AABB 相交判斷（與既有碰撞語意一致：邊界接觸視為相交） */
export const aabbIntersect = (
  x: number,
  y: number,
  w: number,
  h: number,
  r: { x: number; y: number; w: number; h: number }
): boolean => x + w >= r.x && x <= r.x + r.w && y + h >= r.y && y <= r.y + r.h
