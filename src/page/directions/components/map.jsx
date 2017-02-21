import moment from 'moment'
import React, { Component, PropTypes } from 'react'
import overlays from '../objects/overlays'

import './map.sass'

export default class Map extends Component {

  constructor() {
    super()

    this.geocoder = new google.maps.Geocoder()
    this.directionsService = new google.maps.DirectionsService()
    this.directionsDisplay = new google.maps.DirectionsRenderer()
    this.overlayView = null

    this.map = null
    this.markers = []
    this.geoMarkers = {}

    moment.locale('zh-TW');
  }
  componentWillMount() {

    document.body.className = 'directions'
  }

  componentDidMount() {
    this.initMap()
    this.calcRoute()
  }

  shouldComponentUpdate(nextProps) {
    return nextProps.directions !== this.props.directions
  }

  componentDidUpdate() {
    this.calcRoute()
  }

  componentWillUnmount() {
    document.body.className = ''

    firebase.geoDB
      .ref('geolocation/')
      .off('child_changed', this.setGeoMarkers)

    firebase.geoDB
      .ref('geolocation/')
      .off('child_added', this.setGeoMarkers)
  }
  getDirections = key => this.props.directions.get(key)

  setGeoMarkers = (snap) => {
    const val = snap.val()
    const bounds = new google.maps.LatLngBounds(new google.maps.LatLng(val.lat, val.lng))
    const message = val.type ? this.transVideo(val.type, val.message) : val.message
    const messages = `
      <div class='card-header text-xs-center text-white'>
        ${val.displayName}
      </div>
      <p class='card-text'>${message}</p>
      <div class='card-footer text-muted'>
        ${moment(val.timestamp).fromNow()}
      </div>
    `
    if (this.geoMarkers[val.uid]) {
      this.geoMarkers[val.uid].onSet(bounds, val.photoURL, messages, this.map)
    } else {
      const Overlay = overlays()
      this.geoMarkers[val.uid] = new Overlay(bounds, val.photoURL, messages, this.map)
    }
  }

  toggleSearchBox = () => this.setState({ isSearchBox: !this.state.isSearchBox })

  transVideo = (type, message) => {
    switch (type) {
      case 'youtube':
        return `<iframe width='100%' height='100px' src='https://www.youtube.com/embed/${message}' frameborder='0' allowfullscreen ></iframe>`
      default:
        return message
    }
  }
  initMap = () => {
    const myOptions = {
      mapTypeId: google.maps.MapTypeId.ROADMAP,
    }
    this.map = new google.maps.Map(this.refs.map, myOptions)
    this.directionsDisplay.setMap(this.map)
    this.directionsDisplay.setPanel(this.refs.panel)

    firebase.geoDB
      .ref('geolocation/')
      .on('child_changed', this.setGeoMarkers)
    firebase.geoDB
      .ref('geolocation/')
      .on('child_added', this.setGeoMarkers)
  }
  calcRoute = () => {
    this.refs.panel.innerHTML = ''
    const origin = this.getDirections('origin');
    const destination = this.getDirections('destination');
    const latLng = this.getDirections('latLng');
    if (!origin) {
      return this.props.goDirections({ origin, destination })
    }
    this.DeleteMarkers()

    if (origin && destination) {
      const request = {
        origin,
        destination,
        travelMode: google.maps.DirectionsTravelMode.DRIVING,
      }
      this.directionsService.route(request, (response, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
          this.directionsDisplay.setDirections(response)
          this.toggleDirectionsBox(true)
        }
      })
    } else {
      this.toggleDirectionsBox(false)

      this.directionsDisplay.set('directions', null)
      this.map.setZoom(16)
      this.map.setCenter(latLng)
      const marker = new google.maps.Marker({
        map: this.map,
            // icon: image,
        position: latLng,
      })
      this.markers.push(marker)
      this.attachSecretMessage(marker, origin)

        // const bounds = new google.maps.LatLngBounds()
        // bounds.extend(results[0].geometry.location)
        // this.map.fitBounds(bounds)
    }
    const map = {
      origin,
      destination,
    }
    localStorage.map = JSON.stringify(map)
    return false
  }
  DeleteMarkers = () => {
    for (let i = 0; i < this.markers.length; i += 1) {
      this.markers[i].setMap(null)
    }
  }
  attachSecretMessage = (marker, content) => {
    const infowindow = new google.maps.InfoWindow({ content })
    infowindow.open(marker.get('map'), marker)
  }

  /**
   * 顯示/隱藏導航視窗
   * @return {void}
   */
  toggleSearchBox() {
    this.setState({ isSearchBox: !this.state.isSearchBox })
  }

  toggleDirectionsBox = (isActive) => {
    if (isActive) {
      this.refs.panel.className += ' active'
    } else {
      this.refs.panel.className = ''
    }
  }
  render() {
    return (
      <div>
        <div id="map" ref="map" />
        <div id="panel" ref="panel" />
      </div>
    )
  }
}

Map.propTypes = {
  directions: PropTypes.object.isRequired,
  goDirections: PropTypes.func,
}
