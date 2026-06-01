import React, { useState } from 'react'

interface TodoInputProps {
  todoAdded: (value: string) => void
}

export function TodoInput({ todoAdded }: TodoInputProps) {
  const [input, setInput] = useState('todos')

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && input.trim()) {
      todoAdded(input.trim())
      setInput('')
    }
  }

  return (
    <div className="todo-input-wrapper">
      <input
        id="listBoxInput"
        className="todo-input-field"
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="What needs to be done?"
        data-testid="todo-input"
      />
    </div>
  )
}

export default TodoInput
