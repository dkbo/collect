import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import Input from './components/input';
import ListBox from './components/listBox';
import { NavLink } from 'react-router-dom';

import './todos.sass';

const DeleteSubjectCompleted = new Rx.Subject()
const DeleteSubjectAll = new Rx.Subject()

const Todolist = (props) => {
  const [liLeave, setLiLeave] = useState(false)
  useEffect(() => {

    let DeleteCompleted = DeleteSubjectCompleted;
    let DeleteAll = DeleteSubjectAll;

    DeleteCompleted = DeleteSubjectAll.map(func =>
      props.todoLeaveAll())
      .delay(500)
      .subscribe(props.todoDeleteAll);

    DeleteAll = DeleteSubjectCompleted.map(() =>
      props.todoLeaveCompleted())
      .delay(500)
      .subscribe(props.todoDeleteCompleted);
    return () => {
      DeleteSubjectCompleted.unsubscribe();
      DeleteSubjectAll.unsubscribe();
    }
  },[])
  useEffect(() => {
    localStorage.todos = JSON.stringify(props.todos);
  })
    return (
      <div id="todos">
        <div id="todoBox">
          <h1>Todos({props.todos.length})</h1>
          <div id="todoControl">
            <button onClick={() => DeleteSubjectCompleted.next()}>
              Clear Completed
            </button>
            <button onClick={() => DeleteSubjectAll.next()}>
              Clear All
            </button>
          </div>
          <Input {...props} />
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
            {props.todos.map((object, index) => (
              <ListBox
                {...props}
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
Todolist.propTypes = {
  todos: PropTypes.array,
  todoDeleteAll: PropTypes.func,
  todoDeleteCompleted: PropTypes.func,
};

export default Todolist