import React from 'react'

import Highlight from 'react-syntax-highlighter'
import { monokai } from 'react-syntax-highlighter/dist/styles';

import rpg_pc from '../../../images/rpg_pc.jpg'


const rpgRAF = `//一開始就跑 requestAFrame
var requestAFrame =
  return window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.oRequestAnimationFrame ||
    function(callback) {
      window.setTimeout(callback, 1000 / 60)
    }

function moveAframe() {
  //當左鍵按下才執行，也就是說當方向鍵都沒按的情況下，就不會執行任何動作
  if(keyDownLeft) {
    //setLeftMove()
  }
}

//定時執行 moveAframe()
requestAFrame(moveAframe)
`
const rpgCodepen = 'http://codepen.io/dkbo/pen/vOvWox?editors=0010'
const RPG = () => (
  <div>
    <div className="h2 card-header">關於遊戲室</div>
    <div className="card-block">
      <p className="card-text">
          這作品是在一年多前邊學習 <code>React</code> 邊效仿 RPG 製作大師的風格而製作的，
          當時還不是用 <code>ES6</code> 的風格來編寫，也不理解週期原理， <code>render</code> 的機制，更不用說 <code>flux</code> 架構
          及現在已經成熟的 <code>Redux</code> 架構，
          不過最後還是完成了，所以如果想學 <code>React</code>，然後遲遲還沒著手的話，其實也不用太在意別人文章內部怎講的規範啊，然後搞得太複雜，
          只要把學習的標準定在寫得出來即可，畢竟新的工具出的太快，每款都研究得太細的話，就會很耗時間唷!至少對於愚笨的小弟來說是這樣的。
      </p>
      <p className="card-text">
          先不論以陌生的寫法來實作這遊戲網頁，那時因心血來潮，一邊爬程式教學，一邊爬2D動畫原理，一點一滴的累積出成果。
          剛開始只是先用一大堆 <code>div</code> 加上 <code>background-position</code> 來把畫面拼出來，
          畫面是拚出來了，但是覺得按鍵按下去，人物移動的非常不順暢，就像平常打字一樣，如果我按著 <code>a</code>，
          出現的規律會是 <code>a... a.a.a.a.a.a</code>，而我要呈現的是按下去就直接 <code>.a.a.a.a.a.a.a</code>，
          於是就找到了方法來呈現。
      </p>
    </div>
    <Highlight showLineNumbers language="javascript" style={monokai}>{rpgRAF}</Highlight>
    <div className="card-block">
      <p className="card-text">
          之後就開始處理人物位置移動的問題，起先是用了 <code>margin</code> 的方式，爬了文說用 <code>translate3d</code> 這屬性，
          可以開啟顯示卡的效能，所以又改成用 <code>translate3d</code> 的屬性來做 2D 位移效果，
          當時的實作<a href={rpgCodepen}>最早的實作</a>
      </p>
      <p className="card-text">
          上面所說的只是當初剛起步時的歷程，但是千萬別用上列的方式來構成畫面，畢竟幾百幾千的 <code>DIV</code>，效能會非常的差唷!
      </p>
    </div>
    <img className="card-img-top" src={rpg_pc} style={{ width: '100%' }} alt="" />
  </div>
)

export default RPG
