import React, { Component } from 'react'
import PropTypes from 'prop-types'
import Input from './components/input'
import ListBox from './components/listBox'
import { NavLink } from 'react-router-dom'
import { bindActionCreators } from 'redux'

import './todos.sass'

// const mapStateToProps = state => ({
// 	chat: state.chat,
// 	miniChat: state.miniChat,
// 	directions: state.directions,
// 	showList: state.searchApi,
// 	geo: state.geo,
// 	player: state.player.toObject(),
// 	sence: state.sence,
// 	npc: state.npc.toObject(),
// 	todos: state.todos
// })
/**
 * Reducers 方法綁定在 Props 裡
 * @param {JSON} dispatch 執行 Action 方法
 * @returns {any} Reducers 方法綁定在 Props 裡
 */
// const mapDispatchToProps = dispatch => bindActionCreators(actions, dispatch)
// @connect(mapStateToProps, mapDispatchToProps)
export default class Todolist extends Component {
	state = {
		liLeave: false
	}
	constructor(props) {
		super(props)

		this.DeleteSubjectCompleted = new Rx.Subject()
		this.DeleteSubjectAll = new Rx.Subject()

		this.DeleteCompleted = this.DeleteSubjectCompleted
		this.DeleteAll = this.DeleteSubjectAll

		this.DeleteCompleted = this.DeleteSubjectAll.map(func =>
			this.props.todoLeaveAll()
		)
			.delay(500)
			.subscribe(this.props.todoDeleteAll)

		this.DeleteAll = this.DeleteSubjectCompleted.map(() =>
			this.props.todoLeaveCompleted()
		)
			.delay(500)
			.subscribe(this.props.todoDeleteCompleted)
	}
	componentWillUnmount() {
		this.DeleteSubjectCompleted.unsubscribe()
		this.DeleteSubjectAll.unsubscribe()
	}
	render() {
		localStorage.todos = JSON.stringify(this.props.todos)
		return (
			<div id="todos">
				<div id="todoBox">
					<h1>Todos({this.props.todos.length})</h1>
					<div id="todoControl">
						<button onClick={() => this.DeleteSubjectCompleted.next()}>
							Clear Completed
						</button>
						<button onClick={() => this.DeleteSubjectAll.next()}>
							Clear All
						</button>
					</div>
					<Input {...this.props} />
					<div id="todoOption">
						<NavLink to="/todos">All</NavLink>
						<NavLink to="/todos/active" activeClassName="active">
							Active
						</NavLink>
						<NavLink to="/todos/completed" activeClassName="active">
							Completed
						</NavLink>
					</div>
					<ul>
						{this.props.todos.map((object, index) => (
							<ListBox
								{...this.props}
								object={object}
								key={object.timestamp}
								index={index}
							/>
						))}
					</ul>
				</div>
			</div>
		)
	}
}
Todolist.propTypes = {
	todos: PropTypes.array,
	todoDeleteAll: PropTypes.func,
	todoDeleteCompleted: PropTypes.func
}
