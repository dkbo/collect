/**
 * 道具圖示屬性與 matrix 的 slot 對齊（純函式）。
 * 5 種道具共用一組 thin instance：第 i 個 matrix 用第 i 個圖示值，兩組 ThinSlots 必須一一對應。
 * 平常兩邊以同樣的 add／remove 順序維護就會對齊；這裡每幀核對，不齊就依 matrix 的順序重建圖示，
 * 不再靠「操作順序相同」這個隱性前提。
 */
import type { ThinSlots } from '@/babylon/fx/thinSlots'

/** 回傳是否重建過（測試用） */
export function alignIconSlots<K>(matrix: ThinSlots<K>, icons: ThinSlots<K>, iconOf: (key: K) => number): boolean {
  const keys = matrix.keys()
  const aligned = icons.count === keys.length && keys.every((k, i) => icons.slotOf(k) === i)
  if (aligned) return false
  icons.clear()
  for (const k of keys) {
    icons.add(k)
    icons.write(k, (buf, o) => (buf[o] = iconOf(k)))
  }
  return true
}
