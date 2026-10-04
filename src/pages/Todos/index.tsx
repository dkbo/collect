import { useParams, NavLink } from 'react-router-dom'
import { Trash, CheckSquare } from 'lucide-react'
import { Button } from '@/components/toybox'
import { useTodoStore } from '@/store/useTodoStore'
import TodoInput from '@/pages/Todos/TodoInput'
import TodoItem from '@/pages/Todos/TodoItem'
import '@/pages/Todos/Todos.css'

const FILTERS = [
  { to: '/todos', label: 'All', testId: 'todo-filter-all' },
  { to: '/todos/active', label: 'Active', testId: 'todo-filter-active' },
  { to: '/todos/completed', label: 'Completed', testId: 'todo-filter-completed' },
]

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
    <div id="todos" className="tb-container todos-page" data-testid="page-todos">
      <header className="tb-sechead">
        <div className="tb-sechead__text">
          <span className="tb-sechead__eyebrow">— TO DO LIST —</span>
          <h1 className="tb-sechead__title">Todos ({todos.length})</h1>
        </div>

        {/* Action Buttons */}
        <div id="todoControl" className="todos-actions">
          {completedCount > 0 && (
            <Button
              size="s"
              onClick={handleClearCompleted}
              icon={<CheckSquare strokeWidth={2.5} aria-hidden="true" />}
              aria-label="清除所有已完成事項"
              data-testid="todo-clear-completed"
            >
              Clear Completed
            </Button>
          )}
          {todos.length > 0 && (
            <Button
              size="s"
              onClick={handleClearAll}
              icon={<Trash strokeWidth={2.5} aria-hidden="true" />}
              aria-label="清除所有事項"
              data-testid="todo-clear-all"
            >
              Clear All
            </Button>
          )}
        </div>
      </header>

      <div id="todoBox" className="todos-box">
        <TodoInput todoAdded={addTodo} />

        {/* Filter Navigation Options */}
        <nav id="todoOption" className="tb-seg todos-filter" aria-label="篩選待辦事項">
          {FILTERS.map((f) => (
            <NavLink key={f.to} to={f.to} end className="tb-seg__opt" data-testid={f.testId}>
              {f.label}
            </NavLink>
          ))}
        </nav>

        {/* Todo Items List */}
        {todos.length === 0 ? (
          <div className="todos-empty">
            <span className="todos-empty__mark" aria-hidden="true">
              EMPTY
            </span>
            No tasks yet. Prefill a task above to get started!
          </div>
        ) : (
          <ul className="todos-list">
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
