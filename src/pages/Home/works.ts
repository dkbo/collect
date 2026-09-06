import { LayoutGrid, ListChecks, MapPin, Search, type LucideIcon } from 'lucide-react'

export type WorkKind = 'game' | 'tool'
export type WorkCardVariant = 'featured' | 'shot' | 'icon'

export interface Work {
  id: string
  title: string
  desc: string
  tags: readonly string[]
  to: string
  kind: WorkKind
  variant: WorkCardVariant
  /** 640×360 WebP；variant 為 featured / shot 時必填 */
  shot?: string
  /** variant 為 icon 時必填 */
  icon?: LucideIcon
  /** Hero 右欄漂浮預覽卡 */
  heroTile?: boolean
}

const shotUrl = (id: string) => `${import.meta.env.BASE_URL}works/${id}.webp`

/** 首頁作品清單（單一來源：Bento、Hero 漂浮卡、統計數字共用） */
export const WORKS: readonly Work[] = [
  {
    id: 'battle',
    title: '多人對戰',
    desc: '開房間邀朋友，WebRTC 點對點同步。坦克對戰、極速賽車、炸彈超人、廚房快手四款遊戲，Host 權威架構。',
    tags: ['Babylon.js', 'WebRTC', 'Firebase', 'Zustand'],
    to: '/battle',
    kind: 'game',
    variant: 'featured',
    shot: shotUrl('battle'),
    heroTile: true,
  },
  {
    id: 'rpgroom',
    title: 'RPG 遊戲室',
    desc: '從 2015 年的第一版一路重寫到現在，Canvas 離屏預渲染的 2D 地圖與 NPC 對話。',
    tags: ['Canvas', 'React'],
    to: '/rpgroom',
    kind: 'game',
    variant: 'shot',
    shot: shotUrl('rpgroom'),
    heroTile: true,
  },
  {
    id: 'minigame',
    title: '小遊戲',
    desc: 'Babylon.js 3D 單機練手場，多人對戰的原型都從這裡長出來。',
    tags: ['Babylon.js', 'WebGL'],
    to: '/miniGame',
    kind: 'game',
    variant: 'shot',
    shot: shotUrl('minigame'),
  },
  {
    id: 'godot',
    title: 'Godot 遊戲',
    desc: 'Godot 4 匯出 Web，React 透過 bridge 與引擎互傳 NPC 對話與地圖狀態。',
    tags: ['Godot 4', 'GDScript', 'iframe bridge'],
    to: '/godot-game',
    kind: 'game',
    variant: 'shot',
    shot: shotUrl('godot'),
  },
  {
    id: 'candy',
    title: '糖果消消樂',
    desc: '三消玩法、關卡 JSON 驗證與 board 單元測試，Godot 引擎第二作。',
    tags: ['Godot 4', '關卡 JSON'],
    to: '/candy-crush',
    kind: 'game',
    variant: 'shot',
    shot: shotUrl('candy'),
    heroTile: true,
  },
  {
    id: 'search',
    title: '外部查詢',
    desc: 'GitHub 倉庫與維基百科條目搜尋，Axios 封裝與 Store 非同步流程。',
    tags: ['REST API'],
    to: '/search',
    kind: 'tool',
    variant: 'icon',
    icon: Search,
  },
  {
    id: 'todos',
    title: 'Todos',
    desc: '待辦清單，Zustand 狀態與路由參數篩選。',
    tags: ['Zustand'],
    to: '/todos',
    kind: 'tool',
    variant: 'icon',
    icon: ListChecks,
  },
  {
    id: 'directions',
    title: '地圖導覽',
    desc: 'Google Maps 路線規劃與自訂資訊視窗。',
    tags: ['Maps API'],
    to: '/directions',
    kind: 'tool',
    variant: 'icon',
    icon: MapPin,
  },
  {
    id: 'mapdev',
    title: '地圖開發',
    desc: 'RPG 遊戲室的地圖編輯器，畫完直接匯出場景 JSON。',
    tags: ['Canvas', 'JSON'],
    to: '/map-developer',
    kind: 'tool',
    variant: 'icon',
    icon: LayoutGrid,
  },
]

export const HERO_TILES: readonly Work[] = WORKS.filter((w) => w.heroTile)
