import { create } from 'zustand'

export interface TodoItem {
  value: string
  isEdit: boolean
  completed: boolean
  isLeave: boolean
  timestamp: number
}

interface TodoStore {
  todos: TodoItem[]
  
  // Actions
  addTodo: (value: string) => void
  updateTodo: (value: string, timestamp: number) => void
  toggleEdit: (timestamp: number) => void
  toggleCompleted: (timestamp: number) => void
  
  // Async Deletions (with leave animations)
  deleteTodoAsync: (timestamp: number) => void
  clearCompletedAsync: () => void
  clearAllAsync: () => void
}

const loadInitialTodos = (): TodoItem[] => {
  try {
    const saved = localStorage.getItem('todos')
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (e) {
    console.error('Failed to load todos from localStorage', e)
  }
  return [
    {
      value: '大家好我是 dkbo',
      isEdit: false,
      completed: false,
      isLeave: false,
      timestamp: 1487470763624,
    },
  ]
}

const saveTodos = (todos: TodoItem[]) => {
  localStorage.setItem('todos', JSON.stringify(todos))
}

export const useTodoStore = create<TodoStore>((set, get) => ({
  todos: loadInitialTodos(),

  addTodo: (value: string) => {
    const newTodo: TodoItem = {
      value,
      isEdit: false,
      completed: false,
      isLeave: false,
      timestamp: Date.now(),
    }
    const updated = [newTodo, ...get().todos]
    saveTodos(updated)
    set({ todos: updated })
  },

  updateTodo: (value: string, timestamp: number) => {
    const updated = get().todos.map((todo) =>
      todo.timestamp === timestamp ? { ...todo, value, isEdit: false } : todo
    )
    saveTodos(updated)
    set({ todos: updated })
  },

  toggleEdit: (timestamp: number) => {
    const updated = get().todos.map((todo) =>
      todo.timestamp === timestamp ? { ...todo, isEdit: !todo.isEdit } : todo
    )
    saveTodos(updated)
    set({ todos: updated })
  },

  toggleCompleted: (timestamp: number) => {
    const updated = get().todos.map((todo) =>
      todo.timestamp === timestamp ? { ...todo, completed: !todo.completed } : todo
    )
    saveTodos(updated)
    set({ todos: updated })
  },

  deleteTodoAsync: (timestamp: number) => {
    // 1. Mark item as leaving
    const updatedLeave = get().todos.map((todo) =>
      todo.timestamp === timestamp ? { ...todo, isLeave: true } : todo
    )
    saveTodos(updatedLeave)
    set({ todos: updatedLeave })

    // 2. Actually delete after 500ms animation
    setTimeout(() => {
      const updatedDelete = get().todos.filter((todo) => todo.timestamp !== timestamp)
      saveTodos(updatedDelete)
      set({ todos: updatedDelete })
    }, 500)
  },

  clearCompletedAsync: () => {
    // 1. Mark completed items as leaving
    const updatedLeave = get().todos.map((todo) =>
      todo.completed ? { ...todo, isLeave: true } : todo
    )
    saveTodos(updatedLeave)
    set({ todos: updatedLeave })

    // 2. Delete completed items after 500ms
    setTimeout(() => {
      const updatedDelete = get().todos.filter((todo) => !todo.completed)
      saveTodos(updatedDelete)
      set({ todos: updatedDelete })
    }, 500)
  },

  clearAllAsync: () => {
    // 1. Mark all items as leaving
    const updatedLeave = get().todos.map((todo) => ({ ...todo, isLeave: true }))
    saveTodos(updatedLeave)
    set({ todos: updatedLeave })

    // 2. Delete all items after 500ms
    setTimeout(() => {
      saveTodos([])
      set({ todos: [] })
    }, 500)
  },
}))

export default useTodoStore
