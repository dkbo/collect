import React, { Component, PropTypes } from 'react'
import Input from './components/input'
import ListBox from './components/listBox'
import { Link } from 'react-router-dom'

import './todos.sass'

export default class Todolist extends Component {
  state = {
    liLeave: false,
  }
  constructor(props) {
    super(props)

    this.DeleteSubjectCompleted = new Rx.Subject()
    this.DeleteSubjectAll = new Rx.Subject()

    this.DeleteCompleted = this.DeleteSubjectCompleted
    this.DeleteAll = this.DeleteSubjectAll

    this.DeleteCompleted = this.DeleteSubjectAll
      .map(func => this.props.todoLeaveAll())
      .delay(500)
      .subscribe(this.props.todoDeleteAll)

    this.DeleteAll = this.DeleteSubjectCompleted
      .map(() =>this.props.todoLeaveCompleted())
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
            <button onClick={() => this.DeleteSubjectCompleted.next()}>Clear Completed</button>
            <button onClick={() => this.DeleteSubjectAll.next()}>Clear All</button>
          </div>
          <Input {...this.props} />
          <div id="todoOption">
            <Link
              to="/todos"
            >
              All
            </Link>
            <Link
              to="/todos/active"
              activeClassName="active"
            >
              Active
            </Link>
            <Link
              to="/todos/completed"
              activeClassName="active"
            >
              Completed
            </Link>
          </div>
          <ul>
            {this.props.todos.map((object, index) => (
              <ListBox {...this.props} object={object} key={object.timestamp} index={index} />
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
  todoDeleteCompleted: PropTypes.func,
}
