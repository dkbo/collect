import React from 'react'

import Highlight  from 'react-syntax-highlighter'
import { monokai } from 'react-syntax-highlighter/dist/styles';

import direction_pc from '../../../images/direction_pc.jpg'



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
const aboutFirebase = () => (
    <div>
        <div className="h2 card-header">關於 Firebase</div>
        <div className="card-block">
            <p className="card-text">
                最近才接觸 <code>firebase</code>，主要是看重了 <code>Google</code> 這招牌，以及 <code>realtime database</code> 便捷性質，讓我覺得前端在製作簡易的即時互動的頁面時，可以更簡單更容易了，當然功能還不只這些，還提供網頁架設、授權管理、檔案上傳..等，
                在跨平台方面也變得相對容易。
            </p>
            <p className="card-text">
                目前這網頁只用即時資料庫跟授權管理的部分，剛好看到有人用 google map 做生活聊天室，自己來稍微玩一下，不過很陽春就是了
            </p>
        </div>
        <img className="card-img-top" src={direction_pc} style={{width: '100%'}} />
        <Highlight showLineNumbers language='javascript' style={monokai}>{rpgRAF}</Highlight>
    </div>
)

export default aboutFirebase
