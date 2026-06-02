import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

interface TodoInputProps {
  todoAdded: (value: string) => void
}

export function TodoInput({ todoAdded }: TodoInputProps) {
  const [input, setInput] = useState('')

  const handleAdd = () => {
    if (input.trim()) {
      todoAdded(input.trim())
      setInput('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAdd()
    }
  }

  const isInvalid = !input.trim()

  return (
    <div className="todo-input-wrapper">
      <input
        id="listBoxInput"
        className="todo-input-field flex-1"
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="What needs to be done?"
        data-testid="todo-input"
        maxLength={50}
        aria-label="新增待辦事項"
      />
      <Button
        onClick={handleAdd}
        disabled={isInvalid}
        className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white rounded-xl font-semibold shadow-md px-4 shrink-0 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        aria-label="確認新增待辦事項"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        新增
      </Button>
    </div>
  )
}

export default TodoInput
