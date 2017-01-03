import React, { PropTypes} from 'react'
import miniMessages from '../../../components/miniChat/components/messages'
import moment from 'moment'
import './messages.sass'

export default class Messages extends miniMessages {
	render() {
        const {photoURL, displayName, timestamp} = this.props.obj
        const message = this.props.obj.type ? this.transVideo() : this.props.obj.message
        const messageContent = this.props.obj.type ? 'messageVideo embed-responsive embed-responsive-16by9' : 'messagesContent rounded'
	    const fromNow = moment(timestamp).format('lLT')
        return (
            <li ref='message' className={this.props.className}>
                <figure><img src={photoURL} alt={displayName} /></figure>
                <div className='messagesBox'>
                    <div className='messagesName'><b>{displayName}</b></div>
                    <div className={messageContent}>{message}</div>
                    <div className='messageDate'><small><b>{fromNow}</b></small></div>
                    <div className="clearfix" />
                </div>
            </li>
	      )
	}
}

Messages.propTypes = {
	className: PropTypes.string.isRequired,
	obj: PropTypes.object.isRequired,
}
