import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import * as actions from '../actions'
import { renderRoutes } from 'react-router-config'
import routes from '../router'

import Nav from '../components/nav/'
/**
 * 數據綁定在 Props裡
 * @param {JSON} state Store 數據資料
 * @returns {JSON} Store 數據綁定在 Props裡
 */
const mapStateToProps = state => ({
	chat: state.chat,
	miniChat: state.miniChat,
	directions: state.directions,
	showList: state.searchApi,
	geo: state.geo,
	player: state.player.toObject(),
	sence: state.sence,
	npc: state.npc.toObject(),
	todos: state.todos
})
/**
 * Reducers 方法綁定在 Props 裡
 * @param {JSON} dispatch 執行 Action 方法
 * @returns {any} Reducers 方法綁定在 Props 裡
 */
const mapDispatchToProps = dispatch => bindActionCreators(actions, dispatch)
@connect(mapStateToProps, mapDispatchToProps)
class App extends Component {
	componentWillMount() {
		firebase.chatDB.ref('.info/connected').on('value', this.connected)
	}
	componentDidMount() {
		this.chatMessageOn(this.props.addMessage)
		this.memberOnlineOn()
	}
	componentWillUnmount() {
		this.chatMessageOff(this.props.addMessage)
		this.memberOnlineOff()
	}
	/**
	 * 取得會員資料
	 * @returns {JSON} 取得會員資料
	 */
	getUser = () => firebase.chatAH.currentUser
	/**
	 * 當 會員 線上狀態改變時，發送訊息
	 * @param {any} snap firebase 連線數據
	 * @returns {void}
	 */
	connected = snap => {
		if (snap.val() === true) {
			// 連線後取消監聽 database 連線狀況避免 DOM render
			firebase.chatDB.ref('.info/connected').off('value', this.connected)

			if (this.getUser()) {
				const { uid } = this.getUser()
				const ref = firebase.chatDB.ref(`members/${uid}/onlineState`)
				ref.set(true)
				ref.onDisconnect().set(false)
			}
		}
	}
	/**
	 * 當 會員 線上狀態改變時，發送訊息
	 * @returns {void}
	 */
	memberOnlineOn() {
		firebase.chatDB.ref('members').on('child_changed', this.userOnlineLog)
	}
	/**
	 * 停止偵測會員狀態
	 * @returns {void}
	 */
	memberOnlineOff() {
		firebase.chatDB.ref('members').off('child_changed', this.userOnlineLog)
	}
	/**
	 * 當 Firebase 資料庫於 messages 底下有新筆資料時，執行方法
	 * @param {Function} func CallBack
	 * @returns {void}
	 */
	chatMessageOn = func => {
		firebase.chatDB
			.ref('messages/')
			.limitToLast(1)
			.on('child_added', func)
	}

	/**
	 * 停止與Firebase 於 messages 底下的雙向數據溝通
	 * @param {Function} func CallBack
	 * @returns {void}
	 */
	chatMessageOff = func => {
		firebase.chatDB.ref('messages/').off('child_added', func)
	}
	userOnlineLog = snap => {
		const { onlineState, displayName } = snap.val()
		if (onlineState) {
			console.log(`${displayName}上線了`)
		} else {
			console.log(`${displayName}下線了`)
		}
	}
	render(route) {
		const chatMessageOn = this.chatMessageOn
		const chatMessageOff = this.chatMessageOff
		const renderRoutesData = renderRoutes(routes, this.props)
		// const title = this.props.children.props.route.title
		// const title = 'te'
		// const Page = React.cloneElement(this.props.children, {
		// 	...this.props,
		// 	chatMessageOn,
		// 	chatMessageOff,
		// 	// title
		// })
		// document.title = `DKBO - ${title}`
		return (
			<main>
				<Nav />
				{renderRoutesData}
			</main>
		)
	}
}

App.propTypes = {
	addMessage: PropTypes.func
}

export default App
