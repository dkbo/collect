import React, { Component, PropTypes } from 'react'
import geolocation from '../../../config/geolocation'
import currentHistory from '../../../config/currentHistory'
import './control.sass'

export default class Control extends Component {
  state = {
    message: '',
  }

  componentWillMount() {
    this.keyDownSubject = new Rx.Subject()
    this.changeSubject = new Rx.Subject()
    this.clickSubject = new Rx.Subject()

    this.keyDown = this.keyDownSubject
      .filter(e => e.keyCode === 13)
      .throttleTime(1000)
      .do(this.SendMessage)

    this.change = this.changeSubject
      .do(this.setMessage)

    this.click = this.clickSubject
      .throttleTime(500)
      .do(this.props.clearMessage)

    this.event = Rx.Observable
      .merge(this.change, this.keyDown, this.click)
      .subscribe()
  }

  componentWillUnmount() {
    this.event.unsubscribe()
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

  setMessage = e => this.setState({ message: e.target.value })

  setGeoLocation = (uid, json) => {
    firebase.geoDB
      .ref(`geolocation/${uid}`)
      .set(json)
      .then(() => {
        //
      })
  }

  SendMessage = () => {
    const user = this.getUser()
    if (user) {
      const { message } = this.state;
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

        firebase.chatDB.ref('messages/')
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
        this.setState({ message: '' })
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
          type="text"
          value={this.state.message}
          placeholder={this.getPlaceholder()}
          onChange={e => this.changeSubject.next(e)}
          onKeyDown={e => this.keyDownSubject.next(e)}
        />
        <button className="btn" type="button" title="發送" onClick={this.SendMessage}>
          <i className="fa fa-paper-plane" />
        </button>
        <button
          className="btn"
          type="button"
          title="清除"
          onClick={e => this.clickSubject.next(e)}
        >
          <i className="fa fa-eraser" />
        </button>
      </div>
    )
  }
}
Control.propTypes = {
  clearMessage: PropTypes.func,
}
