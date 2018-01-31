import React, { Component } from 'react'
import PropTypes from 'prop-types'
import './messages.sass'

export default class Messages extends Component {
  state = {
    opacity: 0,
  }

  componentWillMount() {
    const img = new Image()
    img.onload = () => {
      this.setState({ opacity: 1 })
    }
    img.onerror = (err) => {
      console.log(err);
      this.setState({ opacity: 1 })
    }
    img.src = this.props.photoURL
  }

  getMessage = () => (this.props.type ? this.transVideo() : this.props.message)

  getMessageContent = () => (this.props.type ? 'messageVideo embed-responsive embed-responsive-16by9' : 'messagesContent rounded')

  transVideo = () => {
    switch (this.props.type) {
      case 'youtube':
        return (
          <iframe
            className="embed-responsive-item"
            src={`https://www.youtube.com/embed/${this.props.message}`}
            frameBorder="0"
            allowFullScreen
          />
        )
      default:
        return this.props.message
    }
  }

  render() {
    return (
      <li className={this.props.className} style={{ opacity: this.state.opacity }}>
        <figure><img src={this.props.photoURL} alt={this.props.displayName} /></figure>
        <div className="messagesBox">
          <div className="messagesName">
            <b>{this.props.displayName}</b>
          </div>
          <div className={this.getMessageContent()}>{this.getMessage()}</div>
          <div className="clearfix" />
        </div>
      </li>
    )
  }
}

Messages.propTypes = {
  className: PropTypes.string.isRequired,
  displayName: PropTypes.string.isRequired,
  photoURL: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  type: PropTypes.any,
}
