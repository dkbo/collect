import React, { PropTypes } from 'react'
import Input from './components/input'
import ListBox from './components/listBox'
import { Link } from 'react-router'




import './todos.sass'

const Todolist = (props) => {
  localStorage.todos = JSON.stringify(props.todos)
  return (
    <div id="todos">
      <div id="todoBox">
        <h1>React Todos({props.todos.length})</h1>
        <div id="todoControl">
          <button onClick={props.todoDeleteCompleted}>Clear Completed</button>
          <button onClick={props.todoDeleteAll}>Clear All</button>
        </div>
        <Input {...props} />
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
          {props.todos.map((object, index) => (
            <ListBox {...props} object={object} key={object.timestamp} index={index} />
          ))}
        </ul>
      </div>
    </div>
  )
}
Todolist.propTypes = {
  todos: PropTypes.array,
  todoDeleteAll: PropTypes.func,
  todoDeleteCompleted: PropTypes.func,
}

export default Todolist
