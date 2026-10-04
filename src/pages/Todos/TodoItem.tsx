import React, { useEffect, useRef } from 'react'
import { clsx } from 'clsx'
import { Pencil, Trash2, Check } from 'lucide-react'
import { IconButton } from '@/components/toybox'
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleCompleted()
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

  return (
    <li
      className={clsx('todos-item', object.completed && 'todos-item--done', object.isLeave && 'todos-item--leave')}
      data-testid={`todo-item-${index}`}
    >
      {/* 勾選＋文字 */}
      <div
        className="todos-toggle"
        onMouseDown={handleCompleted}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={object.completed ? `標記 "${object.value}" 為未完成` : `標記 "${object.value}" 為已完成`}
      >
        <span className="todos-check" aria-hidden="true">
          {object.completed && <Check className="size-4" strokeWidth={2.5} />}
        </span>

        <div className="min-w-0 flex-1 pr-4">
          {object.isEdit ? (
            <input
              ref={editRef}
              className="tb-input todos-edit"
              type="text"
              defaultValue={object.value}
              onBlur={handleBlur}
              onKeyDown={handleEditKeyDown}
              onMouseDown={(e) => e.stopPropagation()}
              data-testid={`todo-edit-input-${index}`}
              aria-label="編輯待辦事項內容"
            />
          ) : (
            <span
              className="todos-text"
              title={object.completed ? undefined : '雙擊以編輯'}
              onDoubleClick={(e) => {
                e.stopPropagation()
                if (!object.completed) {
                  toggleEdit(object.timestamp)
                }
              }}
              onMouseDown={(e) => {
                // If double click target is active, we don't want it to toggle completion on single click
                e.stopPropagation()
              }}
            >
              {object.value}
            </span>
          )}
        </div>
      </div>

      {/* 編輯／刪除 */}
      <div className="todos-item-actions" onMouseDown={(e) => e.stopPropagation()}>
        {!object.completed && (
          <IconButton
            onClick={() => toggleEdit(object.timestamp)}
            className="todos-iconbtn"
            label="編輯待辦事項"
            icon={<Pencil strokeWidth={2.5} aria-hidden="true" />}
            data-testid={`todo-edit-btn-${index}`}
          />
        )}
        <IconButton
          onClick={() => deleteTodoAsync(object.timestamp)}
          className="todos-iconbtn"
          label="刪除待辦事項"
          icon={<Trash2 strokeWidth={2.5} aria-hidden="true" />}
          data-testid={`todo-delete-btn-${index}`}
        />
      </div>
    </li>
  )
}

export default TodoItem
