import React, { Component, PropTypes } from 'react'
import './control.sass'

export default class Control extends Component {

  componentWillMount() {
    this.originChangeSubject = new Rx.Subject()
    this.destinationChangeSubject = new Rx.Subject()

    this.originChange = this.originChangeSubject
      .do(e => this.setDirectionsConfig({ origin: e.target.value }))
      .debounceTime(1000)
      .do(() => this.props.goDirections({ origin: this.getDirections('origin'), destination: this.getDirections('destination') }))

    this.destinationChange = this.destinationChangeSubject
      .do(e => this.setDirectionsConfig({ destination: e.target.value }))

    this.event = Rx.Observable
      .merge(this.originChange, this.destinationChange)
      .subscribe()
  }

  componentDidMount() {
    this.origin = new google.maps.places.SearchBox(this.refs.origin)
    this.origin.addListener('places_changed', () => this.props.goDirections({ origin: this.refs.origin.value, destination: this.getDirections('destination') }))

    this.destination = new google.maps.places.SearchBox(this.refs.destination)
    this.destination.addListener('places_changed', () => this.setDirectionsConfig({ destination: this.refs.destination.value }))
  }

  componentWillUnmount() {
    this.event.unsubscribe()
  }

  setDirectionsConfig = config => this.props.directionsConfig(config)

  getDirections = key => this.props.directions.get(key)

  render() {
    return (
      <div id="mapControl">
        <input
          className="form-control"
          ref="origin"
          type="text"
          value={this.getDirections('origin')}
          onChange={e => this.originChangeSubject.next(e)}
          placeholder="起點"
        />
        <input
          className="form-control"
          ref="destination"
          type="text"
          value={this.getDirections('destination')}
          onChange={e => this.destinationChangeSubject.next(e)}
          placeholder="終點"
        />
      </div>
    )
  }
}

Control.propTypes = {
  directions: PropTypes.object.isRequired,
  directionsConfig: PropTypes.func,
  goDirections: PropTypes.func,
}
