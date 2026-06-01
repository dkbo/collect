import { Gamepad2 } from 'lucide-react'
import SyntaxHighlighter from 'react-syntax-highlighter'
import { monokai } from 'react-syntax-highlighter/dist/esm/styles/hljs'

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

const CODEPEN_URL = 'http://codepen.io/dkbo/pen/vOvWox?editors=0010'

export function RpgSection() {
  return (
    <section
      className="home-card group"
      data-testid="home-rpg"
    >
      <h2 className="home-card-header">
        <Gamepad2 className="w-5 h-5 inline-block mr-2 -mt-0.5" />
        關於遊戲室
      </h2>

      <div className="p-6 md:p-8 space-y-6">
        {/* First Paragraph */}
        <div className="space-y-4 text-left">
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm md:text-base">
            這作品是在一年多前邊學習 <code className="home-inline-code">React</code> 邊效仿 RPG 製作大師的風格而製作的，
            當時還不是用 <code className="home-inline-code">ES6</code> 的風格來編寫，也不理解週期原理， <code className="home-inline-code">render</code> 的機制，更不用說 <code className="home-inline-code">flux</code> 架構
            及現在已經成熟的 <code className="home-inline-code">Redux</code> 架構，
            不過最後還是完成了，所以如果想學 <code className="home-inline-code">React</code>，然後遲遲還沒著手的話，其實也不用太在意別人文章內部怎講的規範啊，然後搞得太複雜，
            只要把學習的標準定在寫得出來即可，畢竟新的工具出的太快，每款都研究得太細的話，就會很耗時間唷!至少對於愚笨的小弟來說是這樣的。
          </p>

          <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm md:text-base">
            先不論以陌生的寫法來實作這遊戲網頁，那時因心血來潮，一邊爬程式教學，一邊爬2D動畫原理，一點一滴的累積出成果。
            剛開始只是先用一大堆 <code className="home-inline-code">div</code> 加上 <code className="home-inline-code">background-position</code> 來把畫面拼出來，
            畫面是拚出來了，但是覺得按鍵按下去，人物移動的非常不順暢，就像平常打字一樣，如果我按著 <code className="home-inline-code">a</code>，
            出現的規律會是 <code className="home-inline-code">a... a.a.a.a.a.a</code>，而我要呈現的是按下去就直接 <code className="home-inline-code">.a.a.a.a.a.a.a</code>，
            於是就找到了方法來呈現。
          </p>
        </div>

        {/* Code Block */}
        <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 shadow-md">
          <div className="absolute top-3 right-3 px-2 py-0.5 rounded text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-200/80 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700/50 select-none z-10">
            JavaScript
          </div>
          <SyntaxHighlighter
            language="javascript"
            style={monokai}
            showLineNumbers
            wrapLongLines={true}
            customStyle={{
              margin: 0,
              padding: '1.25rem',
              fontSize: '0.85rem',
              lineHeight: '1.6',
              background: '#272822',
              overflowY: 'hidden',
              height: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {RPG_CODE}
          </SyntaxHighlighter>
        </div>

        {/* Second Paragraph */}
        <div className="space-y-4 text-left">
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm md:text-base">
            之後就開始處理人物位置移動的問題，起先是用了 <code className="home-inline-code">margin</code> 的方式，爬了文說用 <code className="home-inline-code">translate3d</code> 這屬性，
            可以開啟顯示卡的效能，所以又改成用 <code className="home-inline-code">translate3d</code> 的屬性來做 2D 位移效果，
            當時的實作 <a href={CODEPEN_URL} target="_blank" rel="noopener noreferrer" className="home-link outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded px-1" aria-label="Codepen 最早的實作外部連結" data-testid="codepen-link">最早的實作</a>
          </p>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm md:text-base">
            上面所說的只是當初剛起步時的歷程，但是千萬別用上列的方式來構成畫面，畢竟幾百幾千的 <code className="home-inline-code">DIV</code>，效能會非常的差唷!
          </p>
        </div>

        {/* RPG Screenshot Placeholder */}
        <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 aspect-video group/img shadow-md transition-all duration-300">
          <img
            src="/rpg_pc.jpg"
            alt="RPG Game Interface Screenshot Concept"
            className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-105"
            data-testid="rpg-pc-image"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
        </div>
      </div>
    </section>
  )
}

export default RpgSection
