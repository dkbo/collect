import map0 from './0000_map.json'
import map1 from './0001_map.json'
import map2 from './0002_map.json'
import map3 from './0003_map.json'

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

export interface MapNpc {
  b: number
  type: number
  pX: number
  pY: number
  aX: number
  aY: number
  aW: number
  aH: number
  mX: number
  mY: number
  x: number
  y: number
  w: number
  h: number
  d: number
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
  e: number
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
  npc?: MapNpc[]
}

export const mapsJson: MapJsonData[] = [
  map0 as MapJsonData,
  map1 as MapJsonData,
  map2 as MapJsonData,
  map3 as MapJsonData,
]

export default mapsJson
