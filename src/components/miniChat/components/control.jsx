import React, { Component, PropTypes } from 'react'
import geolocation from '../../../config/geolocation'
import currentHistory from '../../../config/currentHistory'
import './control.sass'

export default class Control extends Component {
  constructor(porps) {
    super(porps)
    this.SendMessage = ::this.SendMessage
    this.handleKeyDown = ::this.handleKeyDown
    this.setGeoLocation = ::this.setGeoLocation
    this.isRender = true
  }

  componentDidMount() {
    this.isRender = false
  }
  shouldComponentUpdate() {
    return this.isRender
  }
  getPlaceholder = () => (this.getUser() ? '留言' : '登入後才可留言唷~')
  getUser = () => firebase.chatAH.currentUser
  getGeoLocation(uid, json) {
    geolocation.getCurrentPosition((position) => {
      const [lat, lng] = [position.coords.latitude, position.coords.longitude]
      this.setGeoLocation(uid, {
        ...json,
        lat,
        lng,
        uid,
      })
    })
  }
  setGeoLocation = (uid, json) => {
    firebase.geoDB
      .ref(`geolocation/${uid}`)
      .set(json)
      .then(() => {
        //
      })
  }
  handleKeyDown(e) {
    if (e.keyCode === 13) {
      this.SendMessage()
    }
  }
  SendMessage() {
    const user = this.getUser()
    if (user) {
      const message = this.refs.message.value;
      this.refs.message.value = ''
      if (message.trim('')) {
        const youtubeReg = /(?:[?&]v=|\/embed\/|\/1\/|\/v\/|https:\/\/(?:www\.)?youtu\.be\/)([^&\n?#]+)/
        const youtubeMatch = message.match(youtubeReg)

        const { uid, displayName, photoURL } = user
        const timestamp = firebase.database.ServerValue.TIMESTAMP
        let json = youtubeMatch
          ? {
            uid,
            message: youtubeMatch[1],
            type: 'youtube',
            timestamp,
          }
          : {
            uid,
            message,
            timestamp,
          }

        firebase
          .chatDB
          .ref('messages/')
          .push(json)
          .then(() => {
            json = youtubeMatch
              ? {
                message: youtubeMatch[1],
                type: 'youtube',
                timestamp,
                photoURL,
                displayName,
              }
              : {
                message,
                timestamp,
                photoURL,
                displayName,
              }
            this.getGeoLocation(uid, json)
          })
      }
    } else {
      currentHistory.push('/auth')
    }
  }
  render() {
    return (
      <div className="control">
        <input
          className="form-control"
          ref="message"
          type="text"
          placeholder={this.getPlaceholder()}
          onKeyDown={this.handleKeyDown}
        />
        <button className="btn" type="button" title="發送" onClick={this.SendMessage}>
          <i className="fa fa-paper-plane" />
        </button>
        <button
          className="btn"
          type="button"
          title="清除"
          onClick={this.props.clear_message}
        >
          <i className="fa fa-eraser" />
        </button>
      </div>
    )
  }
}
Control.propTypes = {
  clear_message: PropTypes.func,
}
