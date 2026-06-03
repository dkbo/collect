import type { MapJsonData } from '@/pages/RpgRoom/types'

// 自動註冊：新增地圖只需放入 data/000N_map.json，不必改 code。
// 檔名數字前綴即地圖索引，依檔名排序對齊 map.index。
const modules = import.meta.glob('./[0-9]*_map.json', {
  eager: true,
  import: 'default',
})

export const mapsJson: MapJsonData[] = Object.keys(modules)
  .sort()
  .map((key) => modules[key] as MapJsonData)

export type { MapJsonData, MapStyleTile, MapNpc } from '@/pages/RpgRoom/types'

export default mapsJson
