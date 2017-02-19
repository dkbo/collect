import {
  TODO_ADDED,
  TODO_UPDATE,
  TODO_UPDATE_ACTIVE,
  TODO_COMPLETED,
  TODO_DELETE,
  TODO_DELETE_ALL,
  TODO_DELETE_COMPLETED,
} from '../constants'

export const todoAdded = value => (
  {
    type: TODO_ADDED,
    object: {
      value,
      isEdit: false,
      completed: false,
      timestamp: new Date().getTime(),
    },
  }
)

export const todoUpdate = (value, index) => (
  {
    type: TODO_UPDATE,
    value,
    index,
  }
)

export const todoUpdateActive = index => (
  {
    type: TODO_UPDATE_ACTIVE,
    index,
  }
)

export const todoCompleted = index => (
  {
    type: TODO_COMPLETED,
    index,
  }
)

export const todoDelete = index => (
  {
    type: TODO_DELETE,
    index,
  }
)

export const todoDeleteCompleted = () => (
  {
    type: TODO_DELETE_COMPLETED,
  }
)

export const todoDeleteAll = () => (
  {
    type: TODO_DELETE_ALL,
  }
)
