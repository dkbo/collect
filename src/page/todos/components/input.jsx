import React, { Component } from 'react'
import PropTypes from 'prop-types'
import './input.sass'

export default class Input extends Component {
  state = {
    input: 'todos',
  }

  handleChange = e => this.setState({ input: e.target.value })

  added = (e) => {
    if (e.keyCode === 13 && e.target.value.trim()) {
      this.props.todoAdded(e.target.value)
      this.setState({ input: '' })
    }
  }

  render() {
    return (
      <input id="listBoxInput" onKeyDown={this.added} value={this.state.input} onChange={this.handleChange} placeholder="todos" />
    )
  }
}

Input.propTypes = {
  todoAdded: PropTypes.func,
}
