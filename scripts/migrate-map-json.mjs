/**
 * 一次性遷移 script（Phase 1 資料統一）
 * 將 constants/isMove.ts 的 map 中繼資料/碰撞區（運行時實際來源）
 * 與 constants/message.tsx 的對話（轉輕量 markup）合併進 data/000N_map.json，
 * 使「一張地圖 = 一個 JSON 檔」成為 single source of truth。
 *
 * 用法：node scripts/migrate-map-json.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dataDir = path.join(root, 'src/pages/RpgRoom/data')
const isMoveTs = path.join(root, 'src/pages/RpgRoom/constants/isMove.ts')

// --- 從 isMove.ts 萃取資料（去除型別註記後 eval）---
let src = fs.readFileSync(isMoveTs, 'utf8')
src = src.slice(src.indexOf('const ISMOVE_0000'))
src = src.replace(/: MapData/g, '')
src = src.slice(0, src.indexOf('export const isMoveObject'))
const isMoveData = new Function(
  `${src}; return [ISMOVE_0000, ISMOVE_0001, ISMOVE_0002, ISMOVE_0003];`
)()

// --- 對話遷移：JSX 改為輕量 markup（[[kbd:..]] / [[link:url|text]] / [[mark:..]]）---
const messagesData = [
  [
    { name: '稻草人', text: ['.', '..', '...', '....', '.....', '......'] },
    {
      name: '哆拉樹',
      text: [
        '大家好!',
        '我被作者配置在樹下所以我叫做哆拉樹。',
        '作者說以前有玩過一些用 RPG 製作大師所製成的遊戲，但是從來沒有親自開發過。',
        '現在作者想做一份線上履歷來介紹自己，以 RPG 製作大師的風格來實作!',
        '因作者並不會美編，所以場景布置的不好看也請多多見諒。',
        '還不知道如何操作的話請按 [[kbd:ESC]]',
        '如果你是行動裝置的話請觸碰左上角的選單按鈕。',
      ],
    },
    {
      name: '古文碑',
      text: [
        '作者本名叫 [[mark:盧宏寶]] 在家排名老二，畢業於高雄市正修科技大學電機工程系，在網路世界中暱稱為 [[mark:DKBO]]',
        '英語聽、說很差讀，美感不好，正在努力中。',
      ],
    },
  ],
  [
    { name: '哆拉花', text: ['這屋子種了不少花!', '下班之後，看看一下花花草草能適度的釋壓。'] },
    { name: '哆拉花角', text: ['我是第一個會走的 NPC 唷'] },
  ],
  [
    {
      name: '哆拉工',
      text: [
        '用老闆做的編輯器隔間二樓，雖然比以前快多了!但還是很累人呢。',
        '過陣子外面也要重整一下了',
      ],
    },
    {
      name: '哆拉客',
      text: [
        '據說這個世界有著 [[link:https://zh.wikipedia.org/wiki/%E5%93%8D%E5%BA%94%E5%BC%8F%E7%BD%91%E9%A1%B5%E8%AE%BE%E8%AE%A1|RWD]] 的特性，可以隨意縮小放大。',
        '想把我變大隻一點的話就縮放一下瀏覽器吧!整個畫面都會跟著變大唷!',
      ],
    },
    {
      name: '哆拉喀',
      text: [
        '老闆說想要把這世界改造成是網頁抑是遊戲，真不懂老闆在想甚麼。',
        '像我這樣每天走來走去的倒是輕鬆自在呀!',
      ],
    },
    { name: '哆拉剋', text: ['這個世界目前非常的和平，沒有任何打鬥的痕跡。治安也是非常的好。'] },
  ],
  [
    { name: '哆拉空', text: ['2樓今晚隔間好嚕，之後就可以慢慢擺設了。'] },
    {
      name: '哆拉美',
      text: [
        '歡迎來到二樓的休息區！',
        '我是負責二樓規劃的哆拉美。',
        '這裡的空間很大，之後我們會在這裡擺上大沙發和家庭劇院唷！',
      ],
    },
    {
      name: '哆拉廚',
      text: [
        '呼，二樓空氣真好！我正在考慮在右上角弄個簡易的吧檯。',
        '這樣就可以一邊欣賞窗外風景，一邊喝著手沖咖啡了。',
      ],
    },
    { name: '哆拉貓', text: ['喵～', '（牠似乎很享受鋪在二樓大廳的柔軟地毯，正在呼嚕呼嚕地伸懶腰。）'] },
  ],
]

for (let i = 0; i < 4; i++) {
  const file = path.join(dataDir, `000${i}_map.json`)
  const json = JSON.parse(fs.readFileSync(file, 'utf8'))
  const ts = isMoveData[i]

  json.map = ts.map // index/name/width/height/in 以 TS（運行時實際來源）為準
  json.isMove = ts.isMove.filter((c) => c.w > 0 && c.h > 0) // 移除無效的 0 尺寸碰撞區
  json.messages = messagesData[i]

  // 欄位順序固定：map -> styles -> isMove -> npc -> messages
  const ordered = {
    map: json.map,
    styles: json.styles,
    isMove: json.isMove,
    npc: json.npc ?? [],
    messages: json.messages,
  }
  fs.writeFileSync(file, JSON.stringify(ordered, null, '\t') + '\n')
  console.log(
    `${path.basename(file)} → isMove: ${ordered.isMove.length}, npc: ${ordered.npc.length}, messages: ${ordered.messages.length}, in: ${ordered.map.in.length}`
  )
}
console.log('done')
