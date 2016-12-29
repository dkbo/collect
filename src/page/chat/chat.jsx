import React, { Component, PropTypes } from 'react'
import Messages from './components/messages'
import Control from './components/control'
import './chat.sass'

export default class Chat extends Component {
	constructor(porps) {
		super(porps)
		this.resizeChatBoxHeight = ::this.resizeChatBoxHeight
	}
	componentWillMount() {
		window.addEventListener('resize', this.resizeChatBoxHeight, false)
		firebase.chatDB.ref(".info/connected").on("value", this.connected);
		document.body.className = 'chat'
	}
	componentDidMount() {
		this.resizeChatBoxHeight()
		this.refs.messageBlock.scrollTop = this.refs.messageBlockUl.clientHeight
	}
	shouldComponentUpdate(props) {
		return props.chat !== this.props.chat
	}
	componentDidUpdate() {
		this.refs.messageBlock.scrollTop = this.refs.messageBlockUl.clientHeight
	}
	componentWillUnmount() {
		window.removeEventListener('resize', this.resizeChatBoxHeight, false)
		firebase.chatDB.ref(".info/connected").off("value", this.connected);
		document.body.className = ''
		console.log('Exit Count')
	}
	connected(snap) {
		if (snap.val() === true) {
			console.log('connected');
		} else {
			console.log('disconnected');
		}
	}
	/**
	 * 依照畫面大小來調適聊天室窗的大高度
	 * @return {void}
	 */
	resizeChatBoxHeight() {
		const chatBoxHeight = window.innerHeight - document.getElementById('navTop').clientHeight - document.getElementById('control').clientHeight + 'px'
		this.refs.messageBlock.style.height = chatBoxHeight
	}

	/**
	 * 取得會員的資訊
	 * @returns {Object} 會員資訊
	 */
	getUser() {
		return firebase.chatAH.currentUser;
	}
	render() {
		// 'background': `url("${p1}")`
	    return (
	      <div className='container-fluid' ref='chat' id='chat'>
		  	<div id='chatBox' className='card'>
				<div className="card-block" ref='messageBlock'>
					<ul ref='messageBlockUl'>
						{this.props.chat.map((obj, key) =>
							<Messages
								key={key}
								className={obj.uid === this.getUser().uid ? 'clearfix messagesSelf' : 'clearfix messagesOther'}
								photoURL={obj.photoURL}
								displayName={obj.displayName}
								message={obj.message}
								type={obj.type}
							/>
						)}
					</ul>
				</div>
			</div>
			<Control
				clear_message={this.props.clear_message}
			/>
	      </div>
	      )
	}
}

Chat.propTypes = {
	chat: PropTypes.object,
    clear_message: PropTypes.func,
    chatMessageOff: PropTypes.func,
}
