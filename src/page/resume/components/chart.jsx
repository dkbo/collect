import React, { Component } from 'react'
import PropTypes from 'prop-types'

export default class Chart extends Component {

  componentWillMount() {
    this.resize = Rx.Observable
      .fromEvent(window, 'resize')
      .debounceTime(600)
      .subscribe(this.handleResize)
  }
  componentDidMount() {
    this.ctx = this.refs.canvas.getContext('2d')
    this.handleResize()
  }
  componentWillUnmount() {
    this.resize.unsubscribe()
  }
  /**
   * 取得當前畫布高寬
   * @returns {number} 取得當前畫布高寬
   */
  getSize = () => this.refs.chart.clientWidth
  /**
   * 畫儀表圓形圖
   * @param {string} color 線條顏色
   * @param {number} lineWidth 線條粗細
   * @param {number} percent 百分比
   * @param {number} size 畫圖限制的高跟寬
   * @returns {void}
   */
  drawCircle(color, lineWidth, percent, size) {
    const radius = (size - lineWidth) / 2
    const pos = this.getSize() / 2
    const percentCalc = Math.min(Math.max(0, percent || 1), 1)
    this.ctx.beginPath()
    this.ctx.arc(pos, pos, radius, 0, Math.PI * 2 * percentCalc, false)
    this.ctx.strokeStyle = color
    this.ctx.lineWidth = lineWidth
    this.ctx.stroke()
  }
  /**
   * 動畫儀表圓形圖
   * @param {string} color 線條顏色
   * @param {number} lineWidth 線條粗細
   * @param {number} percent 百分比
   * @param {number} size 畫圖限制的高跟寬
   * @returns {void}
   */
  drawCircle2 = (color, lineWidth, percent, size) => {
    for (let i = 1; i < percent; i += 1) {
      setTimeout(() => this.drawCircle(color, lineWidth, i / 100, size), 30 * i)
    }
  }
  /**
   * 動畫儀表圓形圖
   * @param {string} color 字形顏色
   * @param {string} text 文字內容
   * @param {number} size 畫圖限制的高跟寬
   * @returns {void}
   */
  drawText(color, text, size) {
    const pos = size / 2
    const font = window.innerWidth < 768 ? 14 : 20
    this.ctx.font = `${font}px Calibri`
    this.ctx.textAlign = 'center'
    this.ctx.fillStyle = color
    this.ctx.fillText(text, pos, pos)
  }

  /**
   * 清除畫布
   * @param {number} size Canvas 的高跟寬
   * @returns {void}
   */
  clearCircle(size) {
    this.ctx.clearRect(0, 0, size, size)
  }

  /**
   * 當視窗大小有所改變時，重新畫圖
   * @param {any} e event 沒用到
   * @param {number} lineWidth 線條粗細
   * @param {number} size 畫圖限制的高跟寬
   * @param {number} lineD 跟底圖的線條寬誤差值
   * @returns {void}
   */
  handleResize = (e, lineWidth = 6, size = this.getSize(), lineD = 4) => {
    this.refs.canvas.width = this.refs.canvas.height = this.getSize()
    this.clearCircle(size)
    this.drawText(this.props.textColor, this.props.text, size)
    this.drawCircle('white', lineWidth + lineD, 1, size)
    this.drawCircle2(this.props.color, lineWidth, this.props.percent, size - lineD)
  }
  render() {
    return (
      <li className="col col-xs-4">
        <div className="chart" ref="chart">
          <canvas ref="canvas" />
        </div>
      </li>
    )
  }
}
Chart.propTypes = {
  textColor: PropTypes.string.isRequired,
  text: PropTypes.string.isRequired,
  color: PropTypes.string.isRequired,
  percent: PropTypes.string.isRequired,
}
