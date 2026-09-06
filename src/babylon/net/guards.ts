/**
 * 網路 payload 執行期防護（安全審查 C2）。
 *
 * 對端訊息一律視為不可信輸入：欄位可能缺漏、型別錯誤、為 NaN/Infinity，
 * 或索引/座標超出合法範圍。各遊戲的訊息 handler 在套用前先以此處純函式驗證，
 * 驗不過就直接丟棄該則訊息（絕不 throw，避免單一惡意封包打斷 render loop）。
 *
 * 全部為無依賴純函式，可直接單測。
 */

/** 非 null 的一般物件（陣列不算） */
export const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** 有限數（排除 NaN / ±Infinity） */
export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** 有限數且落在 [min, max] */
export const isNumIn = (v: unknown, min: number, max: number): v is number =>
  isNum(v) && v >= min && v <= max

/** 整數且落在 [min, max] */
export const isIntIn = (v: unknown, min: number, max: number): v is number =>
  isNum(v) && Number.isInteger(v) && v >= min && v <= max

/** 非空字串，且長度不超過 max（預設 64）——避免超長 id 撐爆 Map/mesh 名稱 */
export const isStr = (v: unknown, max = 64): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= max

/** 值屬於允許清單（用於 kind/enum 欄位） */
export const isOneOf = <T extends string>(v: unknown, allowed: readonly T[]): v is T =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v)

/** 陣列，長度不超過 maxLen，且每個元素通過 pred */
export const isArrayOf = <T>(
  v: unknown,
  pred: (x: unknown) => boolean,
  maxLen: number
): v is T[] => Array.isArray(v) && v.length <= maxLen && v.every(pred)

/** 字串陣列（元素為非空字串） */
export const isStrArray = (v: unknown, maxLen = 64): v is string[] =>
  isArrayOf<string>(v, (x) => isStr(x), maxLen)

/** [cx, cy] 格座標配對，且兩軸皆為界內整數 */
export const isCell = (v: unknown, w: number, h: number): v is [number, number] =>
  Array.isArray(v) && v.length === 2 && isIntIn(v[0], 0, w - 1) && isIntIn(v[1], 0, h - 1)

/** [cx, cy][] 格座標陣列（長度上限預設整張圖的格數） */
export const isCellArray = (
  v: unknown,
  w: number,
  h: number,
  maxLen = w * h
): v is [number, number][] => isArrayOf<[number, number]>(v, (c) => isCell(c, w, h), maxLen)

/** 夾取到 [min, max]；非有限數回傳 fallback（預設 min） */
export const clampNum = (v: unknown, min: number, max: number, fallback = min): number =>
  isNum(v) ? Math.min(max, Math.max(min, v)) : fallback
