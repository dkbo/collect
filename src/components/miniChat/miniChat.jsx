import React, { Component, PropTypes } from 'react'
import Messages from './components/messages'
import Control from './components/control'
import './miniChat.sass'

export default class Chat extends Component {
	constructor(porps) {
		super(porps)
		this.state = {
			height: 400 + 'px',
			bottom: '-1000px',
		}
		this.handleClick = ::this.handleClick
		this.resizeMiniChatBoxHeight = ::this.resizeMiniChatBoxHeight
		this.userOnlineLog = ::this.userOnlineLog
	}
	componentWillMount() {
		firebase.chatDB.ref(".info/connected").on("value", this.connected)
	}
	componentDidMount() {
		window.addEventListener('resize', this.resizeMiniChatBoxHeight, false)
		this.resizeMiniChatBoxHeight()
		firebase.chatDB.ref("members").on("child_changed", this.userOnlineLog)
		this.refs.messageBlock.scrollTop = this.refs.messageBlockUl.clientHeight

	}
	shouldComponentUpdate(props, state) {
		return props.chat !== this.props.chat || props.miniChat !== this.props.miniChat || this.state !== state
	}
	componentDidUpdate() {
		this.refs.messageBlock.scrollTop = this.refs.messageBlockUl.clientHeight
	}
	componentWillUnmount() {
		firebase.chatDB.ref(".info/connected").off("value", this.connected)
		firebase.chatDB.ref("members").off("child_changed", this.userOnlineLog)
		window.removeEventListener('resize', this.resizeMiniChatBoxHeight, false)

	}
	connected(snap) {
		if (snap.val() === true) {
			null
		} else {
			null
		}
	}
	userOnlineLog(snap) {
		const {onlineState, displayName} = snap.val()
		console.log(222);
		if(onlineState) {
			console.log(displayName + '上線了')
		} else {
			console.log(displayName + '下陷了')
		}
	}
	getUser() {
		return firebase.chatAH.currentUser
	}
	handleClick() {
		this.props.toggle_minichat(this.props.chat.size)
	}
	resizeMiniChatBoxHeight() {
		const controlHeight = 36
		let {height, bottom} = ''
		if(window.innerWidth < 768) {
			height = window.innerHeight - this.refs.miniChatHeader.offsetHeight - controlHeight
			bottom = -(height + controlHeight)
		} else {
			height = 400
			bottom = -(height + controlHeight + 2)
		}
		this.setState({
			height: height + "px",
			bottom: bottom + "px",
		})
	}
	render() {
		const user = this.getUser() ? this.getUser() : {uid: null}
		const isShow = this.props.miniChat.get('isShow')
		const count = this.props.chat.size - this.props.miniChat.get('count')
		const {height, bottom} = this.state
		const miniChatStyle = isShow ? this.props.miniChatStyle : {...this.props.miniChatStyle, bottom}
	    return (
	      <div id='miniChat' style={miniChatStyle}>
		  	<div id='miniChatBox' className='card'>
				<div className="card-header" ref='miniChatHeader' onClick={this.handleClick}>
					<b>多人聊天窗口 {!isShow && count ? <span className="tag tag-danger">{count}</span> : null }</b>
				</div>
				<div className="card-block" ref='messageBlock' style={{height}}>
					<ul ref='messageBlockUl'>
						{this.props.chat.map((obj, key) =>
							<Messages
								key={key}
								className={obj.uid === user.uid ? 'clearfix messagesSelf' : 'clearfix messagesOther'}
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
	chat: PropTypes.object.isRequired,
    clear_message: PropTypes.func,
	toggle_minichat: PropTypes.func,
	miniChat: PropTypes.object.isRequired,
	miniChatStyle: PropTypes.object,
}
