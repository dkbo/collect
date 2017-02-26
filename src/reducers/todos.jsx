import {
  TODO_ADDED,
  TODO_UPDATE,
  TODO_UPDATE_ACTIVE,
  TODO_COMPLETED,
  TODO_LEAVE,
  TODO_LEAVE_COMPLETED,
  TODO_LEAVE_ALL,
  TODO_DELETE,
  TODO_DELETE_COMPLETED,
  TODO_DELETE_ALL,
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
    case TODO_ADDED:
      return [action.object].concat(state)
    case TODO_UPDATE:
      return state.map((object, index) => (
        index === action.index
        ? Object.assign({}, object, { value: action.value, isEdit: false })
        : object
      ))
    case TODO_UPDATE_ACTIVE:
      return state.map((object, index) => (
        index === action.index
        ? Object.assign({}, object, { isEdit: true })
        : object
      ))
    case TODO_COMPLETED:
      return state.map((object, index) => (
        index === action.index
        ? Object.assign({}, object, { completed: !object.completed })
        : object
      ))
    case TODO_LEAVE:
      return state.map((object, index) => (
        index === action.index
        ? Object.assign({}, object, { isLeave: true })
        : object
      ))
    case TODO_LEAVE_COMPLETED:
      return state.map(object => (
        object.completed === true
        ? Object.assign({}, object, { isLeave: true })
        : object
      ))
    case TODO_LEAVE_ALL:
      return state.map((object, index) => (
        Object.assign({}, object, { isLeave: true })
      ))
    case TODO_DELETE:
      return state.filter((object, index) => index !== action.index)
    case TODO_DELETE_COMPLETED:
      return state.filter(object => object.completed !== true)
    case TODO_DELETE_ALL:
      return []
    default:
      return state
  }
}

export default todos
