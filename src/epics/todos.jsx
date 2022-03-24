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
  TODO_SET,
} from '../constants'

export const todoAddedEpics = (action$, store) =>
  action$.ofType(TODO_ADDED_EPICS)
    .map(({ value }) => {
      const obj = {
        value,
        isEdit: false,
        completed: false,
        isLeave: false,
        timestamp: new Date().getTime(),
      }
      return {
        type: TODO_SET,
        state: [obj, ...store.getState().todos],
      }
    })

export const todoUpdateEpics = (action$, store) =>
  action$.ofType(TODO_UPDATE_EPICS)
    .map(({ value, index }) => {
      const state = store.getState().todos.map((obj, index2) =>
        (index === index2
          ? { ...obj, value, isEdit: false }
          : obj))
      return {
        type: TODO_SET,
        state,
      }
    })

export const todoUpdateActiveEpics = (action$, store) =>
  action$.ofType(TODO_UPDATE_ACTIVE_EPICS)
    .map(({ index }) => {
      const state = store.getState().todos.map((obj, index2) =>
        (index === index2
          ? { ...obj, isEdit: true }
          : obj))
      return {
        type: TODO_SET,
        state,
      }
    })

export const todoCompletedEpics = (action$, store) =>
  action$.ofType(TODO_COMPLETED_EPICS)
    .map(({ index }) => {
      const state = store.getState().todos.map((obj, index2) =>
        (index === index2
          ? { ...obj, completed: !obj.completed }
          : obj))
      return {
        type: TODO_SET,
        state,
      }
    })

export const todoLeaveEpics = (action$, store) =>
  action$.ofType(TODO_LEAVE_EPICS)
    .map(({ index }) => {
      const state = store.getState().todos.map((obj, index2) =>
        (index === index2
          ? { ...obj, isLeave: true }
          : obj))
      return {
        type: TODO_SET,
        state,
      }
    })

export const todoLeaveCompletedEpics = (action$, store) =>
  action$.ofType(TODO_LEAVE_COMPLETED_EPICS)
    .map(() => {
      const state = store.getState().todos.map(obj =>
        (obj.completed === true
          ? { ...obj, isLeave: true }
          : obj))
      return {
        type: TODO_SET,
        state,
      }
    })

export const todoLeaveAllEpics = (action$, store) =>
  action$.ofType(TODO_LEAVE_ALL_EPICS)
    .map(() => {
      const state = store.getState().todos.map(obj =>
        (obj.completed === true
          ? { ...obj, isLeave: true }
          : obj))
      return {
        type: TODO_SET,
        state,
      }
    })

export const todoDeleteEpics = (action$, store) =>
  action$.ofType(TODO_DELETE_EPICS)
    .map(({ index }) => ({
      type: TODO_SET,
      state: store.getState().todos.filter((obj, index2) => index !== index2),
    }))

export const todoDeleteCompletedEpics = (action$, store) =>
  action$.ofType(TODO_DELETE_COMPLETED_EPICS)
    .map(() => ({
      type: TODO_SET,
      state: store.getState().todos.filter(obj => obj.completed !== true),
    }))

export const todoDeleteAllEpics = action$ =>
  action$.ofType(TODO_DELETE_ALL_EPICS)
    .map(() => ({
      type: TODO_SET,
      state: [],
    }))
