import React, { PropTypes } from 'react'
import miniMessages from '../../../components/miniChat/components/messages'
import './messages.sass'

export default class Messages extends miniMessages {
  render() {
    const message = this.props.type ? this.transVideo() : this.props.message
    const messageContent = this.props.type ? 'messageVideo embed-responsive embed-responsive-16by9' : 'messagesContent rounded'
    return (
      <li ref="message" className={this.props.className}>
        <figure><img src={this.props.photoURL} alt={this.props.displayName} /></figure>
        <div className="messagesBox">
          <div className="messagesName"><b>{this.props.displayName}</b></div>
          <div className={messageContent}>{message}</div>
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
}
