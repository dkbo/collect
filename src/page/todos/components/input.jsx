import React, { useState } from 'react'
import PropTypes from 'prop-types'
import './input.sass'

const Input = (props) => {
  const [input, setInput] = useState('todos')
  const handleChange = e => setInput(e.target.value)

  const added = (e) => {
    if (e.keyCode === 13 && e.target.value.trim()) {
      props.todoAdded(e.target.value)
      setInput('')
    }
  }

  return (
    <input id="listBoxInput" onKeyDown={added} value={input} onChange={handleChange} placeholder="todos" />
  )
}

Input.propTypes = {
  todoAdded: PropTypes.func,
}

export default Input
