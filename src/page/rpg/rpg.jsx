import React, { Component, PropTypes } from 'react'
import Player from './components/player'
import Sence from './components/sence'
import Chat from './components/chat'
import Load from '../../components/loading'
import MiniChat from '../../components/miniChat'
import './rpg.sass'

export default class Rpg extends Component {
  componentWillMount() {
    const touchStart = Rx.Observable.fromEvent(document, 'touchstart')
    const touchMove = Rx.Observable.fromEvent(document, 'touchmove')
    const touchEnd = Rx.Observable.fromEvent(document, 'touchend')

    this.move = touchStart
      .concatMap(() => touchMove.takeUntil(touchEnd.do(this.handleTouchEnd)))
      .withLatestFrom(touchStart, (move, start) => ({ move, start }))
      .subscribe(this.handleTouchMove)
  }

  componentDidMount() {
    document.oncontextmenu = () => false
  }

  componentWillUnmount() {
    document.oncontextmenu = () => true
    this.move.unsubscribe()
  }

  getTouchPos = e => (
    {
      x: e.changedTouches[0].pageX,
      y: e.changedTouches[0].pageY,
    }
  )

  requestAFrame = () =>
    window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.oRequestAnimationFrame ||
    function raf(callback) {
      window.setTimeout(callback, 1000 / 60)
    }

  cancelAFrame = () =>
    window.cancelAnimationFrame ||
    window.webkitCancelAnimationFrame ||
    window.mozCancelAnimationFrame ||
    window.oCancelAnimationFrame ||
    window.clearTimeout

  // 返回觸碰移動時 XY 座標
  handleTouchMove = ({ move, start }) => {
    const movePos = this.getTouchPos(move);
    const startPos = this.getTouchPos(start);
    const startTouchXCalc = movePos.x - startPos.x
    const startTouchYCalc = movePos.y - startPos.y
    if (startTouchXCalc < -30) {
      this.isTouchStart('left')
    } else {
      this.isTouchEnd('left')
    }
    if (startTouchXCalc > 30) {
      this.isTouchStart('right')
    } else {
      this.isTouchEnd('right')
    }
    if (startTouchYCalc < -30) {
      this.isTouchStart('up')
    } else {
      this.isTouchEnd('up')
    }
    if (startTouchYCalc > 30) {
      this.isTouchStart('down')
    } else {
      this.isTouchEnd('down')
    }
  }

  // 處理觸碰結束時事件
  handleTouchEnd = () => {
    this.isTouchEnd('left')
    this.isTouchEnd('right')
    this.isTouchEnd('up')
    this.isTouchEnd('down')
  }

  isTouchEnd(way) {
    if (this.props.player[way]) {
      this.props.way(way, false)
    }
  }

  isTouchStart(way) {
    if (!this.props.player[way]) {
      this.props.way(way, true)
    }
  }

  render() {
    return (
      <div>
        {this.props.sence.get('isTransSence')
          ? <Load loadText="載入中請稍後" bodyClass="rpg" />
          : null
        }
        <Sence {...this.props} senceImg={'second'} />
        <Player {...this.props} rAF={this.requestAFrame} cAF={this.cancelAFrame} />
        <Sence {...this.props} senceImg={'first'} />
        {this.props.npc.isChat ? <Chat npc={this.props.npc} /> : null }
        <MiniChat {...this.props} miniChatStyle={{ left: 0 }} />
      </div>
    )
  }
}
Rpg.propTypes = {
  sence: PropTypes.any,
  npc: PropTypes.object,
  way: PropTypes.func,
  player: PropTypes.object,
}
