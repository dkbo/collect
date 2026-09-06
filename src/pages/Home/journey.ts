export type SnippetLanguage = 'html' | 'javascript'

export interface JourneyLesson {
  label: string
  text: string
}

export interface JourneySnippet {
  summary: string
  language: SnippetLanguage
  code: string
}

export interface JourneyLink {
  label: string
  href: string
  testId: string
}

export interface JourneyItem {
  year: string
  title: string
  body: string
  /** 最新節點：漸層實心圓 */
  current?: boolean
  lessons?: readonly JourneyLesson[]
  snippet?: JourneySnippet
  links?: readonly JourneyLink[]
}

export const CODEPEN_URL = 'https://codepen.io/dkbo/pen/vOvWox?editors=0010'

/** 2015 年首頁原始碼（自 PastSection.tsx 搬入，內容不動） */
const CODE_HIGHLIGHT = `/**
 * @作者 DKBO
 * @Blog https://dkbo-blog.github.io
 * @LICENSE MIT
 * @returns {作品} Me
 */

<div className="col col-md-6">
  <div className="card">
    <img className="card-img-top" src={head} style={{ width: '100%' }} />
  </div>
</div>
<div className="col col-md-6">
  <div className="hidden-md-down">
    <div className="h1">
      <a href="https://github.com/dkbo/collect">
        <i className="fa fa-github"></i>
      </a>
      大家好我是<code>DKBO</code>
    </div>
    <hr />
  </div>
  <div>
    <div className="h2">
      <a href="https://github.com/dkbo/collect">
        <i className="fa fa-github"></i>
      </a>
      大家好我是<code>DKBO</code>
    </div>
    <hr />
  </div>
  <div className="hidden-sm-down">
    <div className="h3">
      <a href="https://github.com/dkbo/collect">
        <i className="fa fa-github"></i>
      </a>
      大家好我是<code>DKBO</code>
    </div>
    <hr />
  </div>
  <div className="hidden-sm-down">
    <div className="h4">
      <a href="https://github.com/dkbo/collect">
        <i className="fa fa-github"></i>
      </a>
      大家好我是<code>DKBO</code>
    </div>
    <hr />
  </div>
  <div className="hidden-sm-down">
    <div className="h5">
      <a href="https://github.com/dkbo/collect">
        <i className="fa fa-github"></i>
      </a>
      大家好我是<code>DKBO</code>
    </div>
    <hr />
  </div>
  <div className="hidden-sm-down">
    <div className="h6">
      <a href="https://github.com/dkbo/collect">
        <i className="fa fa-github"></i>
      </a>
      大家好我是<code>DKBO</code>
    </div>
  </div>
</div>`

/** requestAnimationFrame 片段（自 RpgSection.tsx 搬入，內容不動） */
const RPG_CODE = `// 一開始就跑 requestAFrame
var requestAFrame =
  window.requestAnimationFrame ||
  window.webkitRequestAnimationFrame ||
  window.mozRequestAnimationFrame ||
  window.oRequestAnimationFrame ||
  function (callback) {
    window.setTimeout(callback, 1000 / 60)
  }

function moveAframe() {
  // 當左鍵按下才執行，也就是說當方向鍵都沒按的情況下，就不會執行任何動作
  if (keyDownLeft) {
    // setLeftMove()
  }
}

// 定時執行 moveAframe()
requestAFrame(moveAframe)`

export const JOURNEY: readonly JourneyItem[] = [
  {
    year: '2015',
    title: 'jQuery + Bootstrap 的第一版首頁',
    body: '當時最流行的組合。標題用 h1 到 h6 一路排下去，只為了展示 Bootstrap 的級距。',
    snippet: { summary: '彩蛋：2015 年的首頁原始碼', language: 'html', code: CODE_HIGHLIGHT },
  },
  {
    year: '2016',
    title: '邊學 React 邊做 RPG 遊戲室',
    body: '仿 RPG 製作大師的風格，還不懂生命週期和 flux，硬是做完了。',
    lessons: [
      { label: '問題', text: '按住方向鍵，人物像打字一樣「a… a.a.a」一頓一頓地走。' },
      { label: '解法', text: '改用 requestAnimationFrame 每幀讀取按鍵狀態，位移改 translate3d。' },
      { label: '教訓', text: '別用幾百個 div 加 background-position 拼畫面，效能會很慘。' },
    ],
    snippet: { summary: '看 requestAnimationFrame 片段', language: 'javascript', code: RPG_CODE },
    links: [{ label: 'Codepen 最早的實作', href: CODEPEN_URL, testId: 'codepen-link' }],
  },
  {
    year: '2017 – 2023',
    title: 'Vue / React 大型平台與團隊帶領',
    body: 'B2B / B2C 平台、財務系統、RWD 網頁遊戲。前端架構規劃、效能優化，帶團隊。',
  },
  {
    year: '2025',
    title: '整站重寫：React 19 + Tailwind v4 + Godot',
    body: 'RPG 遊戲室搬進 Canvas 離屏渲染，糖果消消樂與 Godot 遊戲透過 iframe bridge 接進來。',
  },
  {
    year: '2026 · Now',
    title: 'Babylon.js 多人對戰 + AI 協作開發',
    body: 'WebRTC mesh、Host 權威同步、Firestore 房間。開發流程全面改成 Claude Code agent team 拆解、派工、審查。',
    current: true,
  },
]
