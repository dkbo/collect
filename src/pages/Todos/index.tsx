import { useParams, NavLink } from 'react-router-dom'
import { ListTodo, Trash, CheckSquare } from 'lucide-react'
import { useTodoStore } from '@/store/useTodoStore'
import TodoInput from './TodoInput'
import TodoItem from './TodoItem'

export function TodoList() {
  const { keyword } = useParams<{ keyword?: string }>()
  const filter = keyword || 'all'

  const {
    todos,
    addTodo,
    updateTodo,
    toggleEdit,
    toggleCompleted,
    deleteTodoAsync,
    clearCompletedAsync,
    clearAllAsync,
  } = useTodoStore()

  // Calculate filtered counts for buttons
  const completedCount = todos.filter((todo) => todo.completed).length

  const handleClearCompleted = () => {
    if (window.confirm("確定要清除所有已完成的待辦事項嗎？")) {
      clearCompletedAsync()
    }
  }

  const handleClearAll = () => {
    if (window.confirm("確定要清除所有的待辦事項嗎？此動作將會清除所有歷史紀錄，且無法復原！")) {
      clearAllAsync()
    }
  }

  return (
    <div id="todos" className="todo-container">
      <div id="todoBox" className="todo-box">
        {/* Title & Stats */}
        <div className="todo-header">
          <div className="flex items-center gap-2.5">
            <div className="bg-gradient-to-tr from-purple-500 to-indigo-500 p-2 rounded-xl shadow-md text-white">
              <ListTodo className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="todo-title">
              Todos ({todos.length})
            </h1>
          </div>

          {/* Action Buttons */}
          <div id="todoControl" className="todo-controls">
            {completedCount > 0 && (
              <button
                onClick={handleClearCompleted}
                className="todo-btn-control flex items-center gap-1 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/30"
                aria-label="清除所有已完成事項"
                data-testid="todo-clear-completed"
              >
                <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />
                Clear Completed
              </button>
            )}
            {todos.length > 0 && (
              <button
                onClick={handleClearAll}
                className="todo-btn-control flex items-center gap-1 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-500/30"
                aria-label="清除所有事項"
                data-testid="todo-clear-all"
              >
                <Trash className="h-3.5 w-3.5" aria-hidden="true" />
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Input */}
        <TodoInput todoAdded={addTodo} />

        {/* Filter Navigation Options */}
        <div id="todoOption" className="todo-options">
          <NavLink
            to="/todos"
            end
            className={({ isActive }) =>
              `todo-option-link ${isActive ? 'active' : ''}`
            }
            data-testid="todo-filter-all"
          >
            All
          </NavLink>
          <NavLink
            to="/todos/active"
            className={({ isActive }) =>
              `todo-option-link ${isActive ? 'active' : ''}`
            }
            data-testid="todo-filter-active"
          >
            Active
          </NavLink>
          <NavLink
            to="/todos/completed"
            className={({ isActive }) =>
              `todo-option-link ${isActive ? 'active' : ''}`
            }
            data-testid="todo-filter-completed"
          >
            Completed
          </NavLink>
        </div>

        {/* Todo Items List */}
        {todos.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-400 dark:text-slate-500">
            No tasks yet. Prefill a task above to get started!
          </div>
        ) : (
          <ul className="todo-list">
            {todos.map((todo, index) => (
              <TodoItem
                key={todo.timestamp}
                object={todo}
                index={index}
                filter={filter}
                toggleCompleted={toggleCompleted}
                toggleEdit={toggleEdit}
                updateTodo={updateTodo}
                deleteTodoAsync={deleteTodoAsync}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default TodoList
