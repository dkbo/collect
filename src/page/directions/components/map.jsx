import React, { Component, PropTypes } from "react"
import overlays from '../objects/overlays'
import moment from 'moment'
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

    this.resizeMapBoxHeight = ::this.resizeMapBoxHeight
    this.initMap = ::this.initMap
    this.calcRoute = ::this.calcRoute
    this.DeleteMarkers = ::this.DeleteMarkers
    this.toggleDirectionsBox = ::this.toggleDirectionsBox
    this.setGeoMarkers = ::this.setGeoMarkers

    moment.locale('zh-TW');
  }
  componentWillMount() {
    window.addEventListener('resize', this.resizeMapBoxHeight, false)
    document.body.className = 'directions'
  }
  componentDidMount() {
    this.resizeMapBoxHeight()
    this.initMap()
    this.calcRoute()
  }
  componentWillUnmount() {
    window.removeEventListener('resize', this.resizeMapBoxHeight, false)
    document.body.className = ''
    firebase.geoDB.ref('geolocation/').off('child_changed', this.setGeoMarkers)
    firebase.geoDB.ref('geolocation/').off('child_added', this.setGeoMarkers)
  }

  transVideo(type, message) {
      switch(type) {
        case 'youtube':
          return `<iframe width='100%' height='100px' src='https://www.youtube.com/embed/${message}' frameborder='0' allowfullscreen ></iframe>`
        default:
          return message
      }
  }
  setGeoMarkers(snap) {
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
    if(this.geoMarkers[val.uid]) {
      this.geoMarkers[val.uid].onSet(bounds, val.photoURL, messages, this.map)
    } else {
      const overlay = overlays()
      this.geoMarkers[val.uid] = new overlay(bounds, val.photoURL, messages, this.map)
    }
  }
  initMap() {
    const myOptions = {
        mapTypeId: google.maps.MapTypeId.ROADMAP
    }
    this.map = new google.maps.Map(this.refs.map, myOptions)
    this.directionsDisplay.setMap(this.map)
    this.directionsDisplay.setPanel(this.refs.panel)
    firebase.geoDB.ref('geolocation/').on('child_changed', this.setGeoMarkers)
    firebase.geoDB.ref('geolocation/').on('child_added', this.setGeoMarkers)

  }
  shouldComponentUpdate(nextProps) {
    return nextProps.directions !== this.props.directions
  }
  componentDidUpdate() {
    this.calcRoute()
  }
  calcRoute() {
    this.refs.panel.innerHTML = ''
    const origin = this.props.directions.get('origin');
    const destination = this.props.directions.get('destination');
    const latLng = this.props.directions.get('latLng');
    if(!origin) {
        return this.props.directions_config({origin, destination})
    }
    this.DeleteMarkers()

    if (origin && destination) {
        const request = {
            origin,
            destination,
            travelMode: google.maps.DirectionsTravelMode.DRIVING
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
            position: latLng
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
  }
  DeleteMarkers() {
    for (let i = 0 ;i < this.markers.length; i++) {
        this.markers[i].setMap(null)
    }
  }
  attachSecretMessage(marker, content) {
    const infowindow = new google.maps.InfoWindow({content})
    infowindow.open(marker.get('map'), marker)
  }

  resizeMapBoxHeight() {
		const mapBoxHeight = window.innerHeight - document.getElementById('navTop').clientHeight + 'px'
    this.refs.map.style.height = mapBoxHeight
    this.refs.panel.style.height = mapBoxHeight
	}
  toggleSearchBox() {
    this.setState({isSearchBox: !this.state.isSearchBox})
  }
  toggleDirectionsBox(isActive) {
    if(isActive) {
      this.refs.panel.className += ' active'
    } else {
      this.refs.panel.className = ''
    }
  }
  render() {
    return (
      <div>
        <div id="map" ref='map'></div>
        <div id="panel" ref='panel'></div>
      </div>
    )
  }
}

Map.propTypes = {
  directions: PropTypes.object.isRequired,
  directions_config: PropTypes.func,
}
