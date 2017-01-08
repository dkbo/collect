import React, { Component, PropTypes} from 'react'
import './messages.sass'

export default class Messages extends Component {
	constructor(porps) {
		super(porps)
        this.transVideo = ::this.transVideo
	}
	componentWillMount() {
        const img = new Image()
        img.onload = () => {
            this.refs.message.style.opacity = 1
        }
        img.onerror = err => {
            console.log(err);
            this.refs.message.style.opacity = 1
        }
        img.src = this.props.photoURL
	}
    transVideo() {
        switch(this.props.type) {
            case 'youtube':
                return (
                        <iframe
                            className='embed-responsive-item'
                            src={`https://www.youtube.com/embed/${this.props.message}`}
                            frameBorder="0" allowFullScreen
                        />
                )
            default:
                return this.props.message
        }
    }
	render() {
        const message = this.props.type ? this.transVideo() : this.props.message
        const messageContent = this.props.type ? 'messageVideo embed-responsive embed-responsive-16by9' : 'messagesContent rounded'
	    return (
            <li ref='message' className={this.props.className}>
                <figure><img src={this.props.photoURL} alt={this.props.displayName} /></figure>
                <div className='messagesBox'>
                    <div className='messagesName'><b>{this.props.displayName}</b></div>
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
    type: PropTypes.any
}
