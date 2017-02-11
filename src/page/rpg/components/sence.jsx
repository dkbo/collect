import React, { Component, PropTypes } from 'react'
import isMoveObject from '../../../constants/ismove/'

export default class Sence extends Component {
  componentDidMount() {
    this.canvas = this.refs.sence
    this.sence = this.canvas.getContext('2d')
    this.img = new Image()
    this.senceChange()
  }

  shouldComponentUpdate(nextProps) {
    if (this.props.sence.get('mapId') !== nextProps.sence.get('mapId')) {
      this.senceChange(nextProps)
    }
    return this.props.sence !== nextProps.sence
  }

  componentDidUpdate() {
    this.drawSence()
  }

  getSenceClassName = (className = 'sence') => (this.props.sence.get('isTransSence') ? `${className} x-hide` : className)


  drawSence(props = this.props) {
    const { width, height } = isMoveObject[props.sence.get('mapId')].map
    const msx = props.sence.get('msx')
    const msy = props.sence.get('msy')
    this.sence.clearRect(0, 0, window.innerWidth, window.innerHeight)
    this.sence.drawImage(this.img, msx, msy, width, height, this.mpx, this.mpy, width, height)
  }
  senceChange(props = this.props) {
    const { width, height } = isMoveObject[props.sence.get('mapId')].map
    this.img.onload = () => {
      this.mpx = width >= window.innerWidth ? 0 : (window.innerWidth - width) / 2
      this.mpy = height >= window.innerHeight ? 0 : (window.innerHeight - height) / 2
      this.drawSence()
      if (props.sence.get('isTransSence')) {
        setTimeout(() => props.sen({ isTransSence: false }), 1000)
      }
    }
    this.img.src = isMoveObject[props.sence.get('mapId')].map[props.senceImg]
  }

  render() {
    return (
      <div>
        <canvas
          className={this.getSenceClassName()}
          ref="sence" width={window.innerWidth}
          height={window.innerHeight}
        />
      </div>
    )
  }
}
Sence.propTypes = {
  sence: PropTypes.object.isRequired,
}
