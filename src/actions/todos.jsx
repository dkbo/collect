import {
  TODO_ADDED_EPICS,
  TODO_UPDATE_EPICS,
  TODO_UPDATE_ACTIVE_EPICS,
  TODO_COMPLETED_EPICS,
  TODO_LEAVE_EPICS,
  TODO_LEAVE_COMPLETED_EPICS,
  TODO_LEAVE_ALL_EPICS,
  TODO_DELETE_EPICS,
  TODO_DELETE_ALL_EPICS,
  TODO_DELETE_COMPLETED_EPICS,
} from '../constants'

export const todoAdded = value => (
  {
    type: TODO_ADDED_EPICS,
    value,
  }
)

export const todoUpdate = (value, index) => (
  {
    type: TODO_UPDATE_EPICS,
    value,
    index,
  }
)

export const todoUpdateActive = index => (
  {
    type: TODO_UPDATE_ACTIVE_EPICS,
    index,
  }
)

export const todoCompleted = index => (
  {
    type: TODO_COMPLETED_EPICS,
    index,
  }
)

export const todoLeave = index => (
  {
    type: TODO_LEAVE_EPICS,
    index,
  }
)

export const todoLeaveCompleted = () => (
  {
    type: TODO_LEAVE_COMPLETED_EPICS,
  }
)

export const todoLeaveAll = () => (
  {
    type: TODO_LEAVE_ALL_EPICS,
  }
)

export const todoDelete = index => (
  {
    type: TODO_DELETE_EPICS,
    index,
  }
)

export const todoDeleteCompleted = () => (
  {
    type: TODO_DELETE_COMPLETED_EPICS,
  }
)

export const todoDeleteAll = () => (
  {
    type: TODO_DELETE_ALL_EPICS,
  }
)
