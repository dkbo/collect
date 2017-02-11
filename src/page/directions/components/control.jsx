import React, { Component, PropTypes } from 'react'
import './control.sass'

export default class Control extends Component {
  componentDidMount() {
    this.origin = new google.maps.places.SearchBox(this.refs.origin)
    this.destination = new google.maps.places.SearchBox(this.refs.destination)
  }
   /**
   * 按下 Enter 執行導航
   * @param {Object} e KeyCode
   * @returns {void}
   */
  handleKeyDown = (e) => {
    if (e.keyCode === 13) {
      // Setting origin and destination
      this.doDirections()
    }
  }

  /**
   * 執行地圖導航
   * @returns {void}
   */
  doDirections = () => {
    const origin = this.refs.origin.value.trim('')
    const destination = this.refs.destination.value.trim('')
    this.props.toggleSearchBox()
    this.props.directionsConfig({ origin, destination })
  }

  render() {
    const controlClassName = this.props.isSearchBox ? 'card active' : 'card'
    const origin = this.props.directions.get('origin')
    const destination = this.props.directions.get('destination')
    return (
      <div id="mapControl" ref="control" className={controlClassName}>
        <div className="card-header text-white text-xs-center">查詢</div>
        <div className="card-block">
          <input className="form-control" ref="origin" type="text" defaultValue={origin} onKeyDown={this.handleKeyDown} placeholder="起點" />
          <input className="form-control" ref="destination" type="text" defaultValue={destination} onKeyDown={this.handleKeyDown} placeholder="終點" />
          <button className="form-control btn btn-success" onClick={this.doDirections}>導航</button>
        </div>
      </div>
    )
  }
}

Control.propTypes = {
  isSearchBox: PropTypes.bool.isRequired,
  directions: PropTypes.object.isRequired,
  directionsConfig: PropTypes.func,
  toggleSearchBox: PropTypes.func,
}
