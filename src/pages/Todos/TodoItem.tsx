import React, { useEffect, useRef } from 'react'
import { Edit, Trash2, CheckCircle2, Circle } from 'lucide-react'
import type { TodoItem as TodoItemType } from '@/store/useTodoStore'

interface TodoItemProps {
  object: TodoItemType
  index: number
  filter?: string
  toggleCompleted: (timestamp: number) => void
  toggleEdit: (timestamp: number) => void
  updateTodo: (value: string, timestamp: number) => void
  deleteTodoAsync: (timestamp: number) => void
}

export function TodoItem({
  object,
  index,
  filter,
  toggleCompleted,
  toggleEdit,
  updateTodo,
  deleteTodoAsync,
}: TodoItemProps) {
  const editRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (object.isEdit && editRef.current) {
      editRef.current.focus()
      // Put cursor at the end of the text
      const length = editRef.current.value.length
      editRef.current.setSelectionRange(length, length)
    }
  }, [object.isEdit])

  // Determine if item should be hidden based on the filter
  const isHidden = 
    (filter === 'completed' && !object.completed) ||
    (filter === 'active' && object.completed)

  if (isHidden) return null

  const handleCompleted = () => {
    if (!object.isEdit) {
      toggleCompleted(object.timestamp)
    }
  }

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      updateTodo(e.currentTarget.value, object.timestamp)
    } else if (e.key === 'Escape') {
      toggleEdit(object.timestamp)
    }
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    updateTodo(e.target.value, object.timestamp)
  }

  // Calculate classes
  let itemClasses = 'todo-item'
  if (object.completed) {
    itemClasses += ' completed'
  }
  if (object.isLeave) {
    itemClasses += ' leaved'
  }

  return (
    <li className={itemClasses} data-testid={`todo-item-${index}`}>
      {/* Complete Checkbox & Text */}
      <div 
        className="flex items-center gap-3 flex-1 select-none py-1"
        onMouseDown={handleCompleted}
      >
        <div className="flex-shrink-0 cursor-pointer text-slate-400 dark:text-slate-500 hover:text-purple-500 dark:hover:text-purple-400 transition-colors duration-200">
          {object.completed ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-500 dark:text-emerald-400 fill-emerald-500/10" />
          ) : (
            <Circle className="h-5 w-5" />
          )}
        </div>
        
        <div className="flex-1 min-w-0 pr-4">
          {object.isEdit ? (
            <input
              ref={editRef}
              className="todo-item-edit-input"
              type="text"
              defaultValue={object.value}
              onBlur={handleBlur}
              onKeyDown={handleEditKeyDown}
              onMouseDown={(e) => e.stopPropagation()}
              data-testid={`todo-edit-input-${index}`}
            />
          ) : (
            <span className={`text-slate-700 dark:text-slate-300 break-words block text-base font-medium transition-all duration-300 ${object.completed ? 'line-through opacity-60' : ''}`}>
              {object.value}
            </span>
          )}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-1.5 flex-shrink-0" onMouseDown={(e) => e.stopPropagation()}>
        {!object.completed && (
          <button
            onClick={() => toggleEdit(object.timestamp)}
            className="p-2 text-slate-400 dark:text-slate-500 hover:text-purple-500 dark:hover:text-purple-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-lg transition-all duration-200 cursor-pointer"
            aria-label="Edit todo"
            data-testid={`todo-edit-btn-${index}`}
          >
            <Edit className="h-4.5 w-4.5" />
          </button>
        )}
        
        <button
          onClick={() => deleteTodoAsync(object.timestamp)}
          className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-lg transition-all duration-200 cursor-pointer"
          aria-label="Delete todo"
          data-testid={`todo-delete-btn-${index}`}
        >
          <Trash2 className="h-4.5 w-4.5" />
        </button>
      </div>
    </li>
  )
}

export default TodoItem
