import {
  TODO_SET,
} from '../constants'

const stateInitial = localStorage.todos
  ? JSON.parse(localStorage.todos)
  : [
    {
      value: '大家好我是 dkbo',
      isEdit: false,
      completed: false,
      isLeave: false,
      timestamp: 1487470763624,
    },
  ]


const todos = (state = stateInitial, action) => {
  switch (action.type) {
    case TODO_SET:
      return action.state
    default:
      return state
  }
}

export default todos
