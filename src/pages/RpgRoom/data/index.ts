import map0 from './0000_map.json'
import map1 from './0001_map.json'
import map2 from './0002_map.json'
import map3 from './0003_map.json'
import map4 from './0004_map.json'

export interface MapStyleTile {
  n: string
  l: number
  t: number
  w: number
  h: number
  b: number
  x: number
  y: number
  z?: number
}

export interface MapJsonData {
  map: {
    index: number
    name: string
    width: number
    height: number
    in: Array<{ x: number; y: number }>
  }
  styles: MapStyleTile[]
}

export const mapsJson: MapJsonData[] = [
  map0 as MapJsonData,
  map1 as MapJsonData,
  map2 as MapJsonData,
  map3 as MapJsonData,
  map4 as MapJsonData,
]

export default mapsJson
