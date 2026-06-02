import React from 'react'

export interface NpcMessage {
  name: string
  text: Array<string | React.ReactNode>
}

const MESSAGE_0000: NpcMessage[] = [
  {
    name: '稻草人',
    text: [
      '.',
      '..',
      '...',
      '....',
      '.....',
      '......',
    ],
  },
  {
    name: '哆拉樹',
    text: [
      '大家好!',
      '我被作者配置在樹下所以我叫做哆拉樹。',
      '作者說以前有玩過一些用 RPG 製作大師所製成的遊戲，但是從來沒有親自開發過。',
      '現在作者想做一份線上履歷來介紹自己，以 RPG 製作大師的風格來實作!',
      '因作者並不會美編，所以場景布置的不好看也請多多見諒。',
      <span key="tree-msg-5">
        還不知道如何操作的話請按{' '}
        <kbd className="bg-slate-700 text-slate-100 dark:bg-slate-200 dark:text-slate-900 px-2 py-0.5 rounded text-xs font-mono shadow-sm font-semibold">
          ESC
        </kbd>
      </span>,
      '如果你是行動裝置的話請觸碰左上角的選單按鈕。',
    ],
  },
  {
    name: '古文碑',
    text: [
      <span key="mon-msg-1">
        作者本名叫{' '}
        <mark className="bg-purple-200 text-purple-950 dark:bg-purple-900/60 dark:text-purple-100 px-1 rounded font-bold">
          盧宏寶
        </mark>{' '}
        在家排名老二，畢業於高雄市正修科技大學電機工程系，在網路世界中暱稱為{' '}
        <mark className="bg-purple-200 text-purple-950 dark:bg-purple-900/60 dark:text-purple-100 px-1 rounded font-bold">
          DKBO
        </mark>
      </span>,
      '英語聽、說很差讀，美感不好，正在努力中。',
    ],
  },
]

const MESSAGE_0001: NpcMessage[] = [
  {
    name: '哆拉花',
    text: [
      '這屋子種了不少花!',
      '下班之後，看看一下花花草草能適度的釋壓。',
    ],
  },
  {
    name: '哆拉花角',
    text: [
      '我是第一個會走的 NPC 唷',
    ],
  },
]

const MESSAGE_0002: NpcMessage[] = [
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
      <span key="guest-msg-1">
        據說這個世界有著{' '}
        <a
          href="https://zh.wikipedia.org/wiki/%E5%93%8D%E5%BA%94%E5%BC%8F%E7%BD%91%E9%A1%B5%E8%AE%BE%E8%AE%A1"
          target="_blank"
          rel="noreferrer"
          className="text-purple-500 hover:text-purple-400 font-semibold underline underline-offset-4"
        >
          RWD
        </a>{' '}
        的特性，可以隨意縮小放大。
      </span>,
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
  {
    name: '哆拉剋',
    text: [
      '這個世界目前非常的和平，沒有任何打鬥的痕跡。治安也是非常的好。',
    ],
  },
]

const MESSAGE_0003: NpcMessage[] = [
  {
    name: '哆拉空',
    text: [
      '2樓今晚隔間好嚕，之後就可以慢慢擺設了。',
    ],
  },
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
  {
    name: '哆拉貓',
    text: [
      '喵～',
      '（牠似乎很享受鋪在二樓大廳的柔軟地毯，正在呼嚕呼嚕地伸懶腰。）',
    ],
  },
]

export const messageObject: NpcMessage[][] = [
  MESSAGE_0000,
  MESSAGE_0001,
  MESSAGE_0002,
  MESSAGE_0003,
]

export default messageObject
