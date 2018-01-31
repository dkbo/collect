import React, { Component } from 'react'
import PropTypes from 'prop-types'
import isMoveObject from '../../../constants/ismove/'

export default class Sence extends Component {
  constructor(props) {
    super(props)
    this.width = isMoveObject[props.sence.get('mapId')].map.width
    this.height = isMoveObject[props.sence.get('mapId')].map.height
    this.img = new Image()
  }
  componentDidMount() {
    this.canvas = this.refs.sence
    this.sence = this.canvas.getContext('2d')
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
    const msx = props.sence.get('msx')
    const msy = props.sence.get('msy')
    this.sence.clearRect(0, 0, window.innerWidth, window.innerHeight)
    this.sence.drawImage(this.img, msx, msy, this.width, this.height, 0, 0, this.width, this.height)
  }
  senceChange(props = this.props) {
    this.width = isMoveObject[props.sence.get('mapId')].map.width
    this.height = isMoveObject[props.sence.get('mapId')].map.height
    this.img.onload = () => {
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
          ref="sence"
          width={Math.min(window.innerWidth, this.width)}
          height={Math.min(window.innerHeight, this.height)}
        />
      </div>
    )
  }
}
Sence.propTypes = {
  sence: PropTypes.object.isRequired,
}
