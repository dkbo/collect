import React, { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/toybox'

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
    <div className="todos-input-row">
      <input
        id="listBoxInput"
        className="tb-input flex-1"
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
        variant="primary"
        size="s"
        onClick={handleAdd}
        disabled={isInvalid}
        icon={<Plus strokeWidth={2.5} aria-hidden="true" />}
        aria-label="確認新增待辦事項"
      >
        新增
      </Button>
    </div>
  )
}

export default TodoInput
