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
		this.resize = Rx.Observable
			.fromEvent(window, 'resize')
			.debounceTime(300)
			.subscribe(this.resizeChatBoxHeight)
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
		this.resize.unsubscribe()
		firebase.chatDB.ref(".info/connected").off("value", this.connected);
		document.body.className = ''
	}
	connected(snap) {
		if (snap.val() === true) {
			null
		} else {
			null
		}
	}
	/**
	 * 依照畫面大小來調適聊天室窗的大高度
	 * @return {void}
	 */
	resizeChatBoxHeight() {
		const controlHeight = 36
		const chatBoxHeight = window.innerHeight - document.getElementById('navTop').clientHeight - controlHeight + 'px'
		this.refs.messageBlock.style.height = chatBoxHeight
	}

	/**
	 * 取得會員的資訊
	 * @returns {Object} 會員資訊
	 */
	getUser() {
		return firebase.chatAH.currentUser;
	}

	/**
	 * 判斷 message 是使用者自己的還是他人的來決定放哪個 className
	 * @param {any} uid uid
	 * @returns {String} className
	 */
	getMessageClassName(uid) {
		if(this.getUser()) {
			return uid === this.getUser().uid ? 'clearfix messagesSelf' : 'clearfix messagesOther'
		} else {
			return 'clearfix messagesOther'
		}
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
								className={this.getMessageClassName(obj.uid)}
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
