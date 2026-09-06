import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useTodoStore } from './useTodoStore'

// 保留 create() 綁定的 actions，只重置資料欄位（setState(_, true) 會整包取代，
// 若只塞資料欄位會連 actions 一起清空）
const initialState = useTodoStore.getState()

describe('useTodoStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useTodoStore.setState({ ...initialState, todos: [] }, true)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('addTodo prepends a new item and persists to localStorage', () => {
    useTodoStore.getState().addTodo('買菜')

    const { todos } = useTodoStore.getState()
    expect(todos).toHaveLength(1)
    expect(todos[0]).toMatchObject({ value: '買菜', completed: false, isEdit: false, isLeave: false })

    const saved = JSON.parse(localStorage.getItem('todos')!)
    expect(saved).toHaveLength(1)
    expect(saved[0].value).toBe('買菜')
  })

  it('updateTodo updates the matching item and clears isEdit, leaving others untouched', () => {
    useTodoStore.setState({
      todos: [
        { value: 'A', isEdit: true, completed: false, isLeave: false, timestamp: 1 },
        { value: 'B', isEdit: false, completed: false, isLeave: false, timestamp: 2 },
      ],
    })

    useTodoStore.getState().updateTodo('A2', 1)

    const { todos } = useTodoStore.getState()
    expect(todos[0]).toMatchObject({ value: 'A2', isEdit: false })
    expect(todos[1]).toMatchObject({ value: 'B', isEdit: false })
  })

  it('toggleEdit flips isEdit only for the matching timestamp', () => {
    useTodoStore.setState({
      todos: [{ value: 'A', isEdit: false, completed: false, isLeave: false, timestamp: 1 }],
    })

    useTodoStore.getState().toggleEdit(1)
    expect(useTodoStore.getState().todos[0].isEdit).toBe(true)

    useTodoStore.getState().toggleEdit(1)
    expect(useTodoStore.getState().todos[0].isEdit).toBe(false)
  })

  it('toggleCompleted is a no-op for a timestamp that does not exist', () => {
    useTodoStore.setState({
      todos: [{ value: 'A', isEdit: false, completed: false, isLeave: false, timestamp: 1 }],
    })

    useTodoStore.getState().toggleCompleted(999)

    expect(useTodoStore.getState().todos[0].completed).toBe(false)
  })

  it('deleteTodoAsync marks the item as leaving immediately, then removes it after 500ms', () => {
    vi.useFakeTimers()
    useTodoStore.setState({
      todos: [{ value: 'A', isEdit: false, completed: false, isLeave: false, timestamp: 1 }],
    })

    useTodoStore.getState().deleteTodoAsync(1)
    expect(useTodoStore.getState().todos[0].isLeave).toBe(true)
    expect(useTodoStore.getState().todos).toHaveLength(1)

    vi.advanceTimersByTime(500)
    expect(useTodoStore.getState().todos).toHaveLength(0)
  })

  it('clearCompletedAsync removes only completed items after the animation delay', () => {
    vi.useFakeTimers()
    useTodoStore.setState({
      todos: [
        { value: 'done', isEdit: false, completed: true, isLeave: false, timestamp: 1 },
        { value: 'todo', isEdit: false, completed: false, isLeave: false, timestamp: 2 },
      ],
    })

    useTodoStore.getState().clearCompletedAsync()
    vi.advanceTimersByTime(500)

    const { todos } = useTodoStore.getState()
    expect(todos).toHaveLength(1)
    expect(todos[0].value).toBe('todo')
  })

  it('clearAllAsync clears every item and localStorage after the animation delay', () => {
    vi.useFakeTimers()
    useTodoStore.setState({
      todos: [{ value: 'A', isEdit: false, completed: false, isLeave: false, timestamp: 1 }],
    })

    useTodoStore.getState().clearAllAsync()
    vi.advanceTimersByTime(500)

    expect(useTodoStore.getState().todos).toHaveLength(0)
    expect(localStorage.getItem('todos')).toBe('[]')
  })
})
